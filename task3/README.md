# Task 03 — Integration Design
## Landing page → HubSpot → WhatsApp (Karix) → Google Ads

### End-to-end architecture

The form posts directly to a Vercel serverless function (`/api/submit-lead`) rather than through Zapier/Make or a native HubSpot embed. This needs a read-before-write — search HubSpot, decide, then write — for the phone-dedup check below, which a native embed can't run at all, and which a no-code tool handles more slowly across three chained calls (search → upsert → Karix → Ads) than a serverless function, at effectively no extra cost. A direct client-side Forms API call is also out — it would expose the private app token in front-end JS.

**Order of operations:**
1. Form submit fires the `consultation_form_submitted` dataLayer push, then POSTs `{name, phone, clinicPreference, utm}` to `/api/submit-lead`.
2. The function normalizes the phone to E.164 and searches HubSpot's Contacts API by `phone` — the dedup step, before any write.
3. It creates or updates the contact, setting Source = "Google Ads - Consultation Landing Page" and Lead Status = "New Enquiry".
4. In parallel, it calls Karix's WhatsApp API and fires the Google Ads Conversions API using the captured `gclid`, server-side, so the conversion fires even if the patient closes the tab.
5. All three outcomes are logged so failures are visible without the patient reporting a missing confirmation.

### The phone deduplication problem

HubSpot's default dedup is on **email** — this form never collects one, so HubSpot would otherwise create a fresh duplicate on every submission. The fix is our own pre-write search filtered on `phone`.

**If two patients submit the same phone with different names:** phone is the source of truth for identity, not the name. The existing contact is updated (new clinic preference, Lead Status reset), but the name is never silently overwritten — the incoming name goes into a `name_conflict_flag` property instead, surfacing the record for manual review. This could be a shared family phone or a typo; overwriting risks losing the original patient's identity, and auto-creating a duplicate fragments their history. Flagging is the only option that doesn't silently corrupt a real patient record.

### Biggest failure point, and its fallback

The biggest risk is the **HubSpot API call** failing (timeout, rate limit, outage), silently losing a lead the patient believes they've booked. Fallback: every submission is written to a durable queue first, tagged `pending_hubspot_sync`; on failure the row stays pending and a retry job reprocesses it — the lead is never lost even if HubSpot is down.

### What could break the 2-minute WhatsApp SLA

Karix latency, or running WhatsApp *after* HubSpot instead of in parallel. To monitor: timestamp at submit, a second at Karix's delivery-confirmation webhook, and alert on any gap exceeding 2 minutes — a live breach, not a retrospective one.