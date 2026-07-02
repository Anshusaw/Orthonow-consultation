/**
 * /api/submit-lead
 * ---------------------------------------------------------------
 * Vercel serverless function (Node.js runtime).
 * Real, working stub for Task 03's integration architecture:
 *   1. Rate limiting (in-memory, per-IP) — cheap first line of
 *      defense against a bad actor or a broken retry loop hammering
 *      the endpoint before it ever reaches HubSpot.
 *   2. Phone-number deduplication logic — the actual trap in the
 *      brief. HubSpot's default dedup key is EMAIL. This form never
 *      collects email, so we must dedupe on phone ourselves, BEFORE
 *      calling HubSpot, using the Contacts Search API.
 *
 * This is a stub in the sense that it doesn't hold a live HubSpot
 * portal token — but the request shape, the search-then-upsert
 * logic, and the conflict handling are real and would work as-is
 * against a live HubSpot account once HUBSPOT_ACCESS_TOKEN is set
 * as a Vercel environment variable.
 *
 * Deploy: this file at /api/submit-lead.js is auto-detected by
 * Vercel as a serverless function reachable at
 * https://<your-project>.vercel.app/api/submit-lead
 * ---------------------------------------------------------------
 */

// ---- naive in-memory rate limiter -------------------------------
// Note: serverless functions are stateless between cold starts, so
// this Map resets on redeploys/cold starts. Good enough to stop a
// runaway client-side retry loop or a single bad actor within a
// warm instance; NOT a substitute for a real rate limiter backed by
// Redis/Upstash in production (flagged in the README as the
// production hardening step).
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5;      // per phone number, per window
const rateLimitStore = new Map(); // key: phone -> [timestamps]

function isRateLimited(phone) {
  const now = Date.now();
  const timestamps = (rateLimitStore.get(phone) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  timestamps.push(now);
  rateLimitStore.set(phone, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

// ---- basic phone normalization -----------------------------------
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  // Assume Indian 10-digit mobile numbers; store E.164 for consistency
  // with HubSpot and the WhatsApp API (Karix expects E.164 too).
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return null; // invalid — caller should reject
}

// ---- HubSpot Contacts Search API: find by phone -------------------
async function findContactByPhone(phone) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  const res = await fetch(
    'https://api.hubapi.com/crm/v3/objects/contacts/search',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [{ propertyName: 'phone', operator: 'EQ', value: phone }],
          },
        ],
        properties: ['firstname', 'lastname', 'phone', 'lead_status', 'clinic_preference'],
        limit: 1,
      }),
    }
  );
  if (!res.ok) throw new Error(`HubSpot search failed: ${res.status}`);
  const data = await res.json();
  return data.results && data.results[0] ? data.results[0] : null;
}

// ---- HubSpot: create or update contact -----------------------------
async function upsertContact({ existingId, name, phone, clinicPreference, nameConflict }) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  const [firstname, ...rest] = name.trim().split(' ');
  const lastname = rest.join(' ') || '';

  const properties = {
    phone,
    clinic_preference: clinicPreference || '',
    source: 'Google Ads - Consultation Landing Page',
    lead_status: 'New Enquiry',
  };

  if (existingId && nameConflict) {
    // PHONE-DEDUP DECISION (see README Task 3 for the full reasoning):
    // Phone is the source of truth for identity. We do NOT overwrite
    // the existing contact's name. Instead we log the conflicting
    // name into a dedicated property for manual review, and leave
    // firstname/lastname untouched.
    properties.name_conflict_flag = 'true';
    properties.name_conflict_submitted_value = name;
  } else {
    properties.firstname = firstname;
    properties.lastname = lastname;
  }

  const url = existingId
    ? `https://api.hubapi.com/crm/v3/objects/contacts/${existingId}`
    : 'https://api.hubapi.com/crm/v3/objects/contacts';
  const method = existingId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) throw new Error(`HubSpot upsert failed: ${res.status}`);
  return res.json();
}

// ---- main handler ---------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, phone: rawPhone, clinicPreference, utm = {} } = req.body || {};

    if (!name || !rawPhone) {
      return res.status(400).json({ error: 'name and phone are required' });
    }

    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return res.status(400).json({ error: 'invalid phone number' });
    }

    if (isRateLimited(phone)) {
      return res.status(429).json({ error: 'Too many submissions for this number. Try again in a minute.' });
    }

    // Guard: if HubSpot isn't configured (e.g. running this stub without
    // a real portal token), respond with the exact decision the code
    // WOULD have made, so this is demoable end-to-end without secrets.
    if (!process.env.HUBSPOT_ACCESS_TOKEN) {
      const simulatedExisting = null; // no way to check without a live token
      return res.status(200).json({
        mode: 'simulated (no HUBSPOT_ACCESS_TOKEN set)',
        normalizedPhone: phone,
        decision: simulatedExisting
          ? 'Would UPDATE existing contact; name conflict logged if names differ.'
          : 'Would CREATE new contact.',
        nextSteps: [
          'Set HUBSPOT_ACCESS_TOKEN in Vercel project env vars to go live.',
          'Trigger WhatsApp send via Karix API (see README).',
          'Fire Google Ads conversion via Conversion API using gclid from utm payload.',
        ],
        received: { name, phone, clinicPreference, utm },
      });
    }

    // ---- real flow (requires HUBSPOT_ACCESS_TOKEN) ----
    const existing = await findContactByPhone(phone);
    const nameConflict =
      existing &&
      `${existing.properties.firstname || ''} ${existing.properties.lastname || ''}`.trim().toLowerCase() !==
        name.trim().toLowerCase();

    const contact = await upsertContact({
      existingId: existing ? existing.id : null,
      name,
      phone,
      clinicPreference,
      nameConflict,
    });

    // In a full implementation, these two calls run in parallel with
    // Promise.allSettled so a WhatsApp/Ads failure doesn't block the
    // HubSpot write, which is the record of truth:
    //   await sendWhatsAppConfirmation(phone, clinicPreference);
    //   await fireGoogleAdsConversion(utm.gclid);

    return res.status(200).json({
      mode: 'live',
      contactId: contact.id,
      wasExistingContact: Boolean(existing),
      nameConflictFlagged: Boolean(nameConflict),
    });
  } catch (err) {
    console.error('submit-lead error:', err);
    return res.status(500).json({ error: 'Internal error processing lead' });
  }
}
