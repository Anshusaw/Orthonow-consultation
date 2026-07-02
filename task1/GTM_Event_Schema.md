# Task 01 — GTM Event Schema
## OrthoNow · Namoza Digital Growth Engagement

---

## 1. Full Event Schema

| # | Event Name | Trigger Type | Key Parameters | Feeds Into (GA4) |
|---|---|---|---|---|
| 1 | `booking_step_1_view` | Custom Event (dataLayer push, fired by front-end on step render) | `step_number`, `step_name`, `clinic_location` (if pre-selected via UTM) | GA4 Funnel Exploration — "Appointment Booking" funnel, step 1. Feeds a "Booking Started" audience. |
| 2 | `booking_step_complete` (fired 3x, once per step, `step_number` differentiates) | Custom Event (dataLayer push on "Next"/"Confirm" click) | `step_number`, `step_name`, `clinic_location`, `specialty` | Funnel Exploration steps 1–3. Also feeds Free-Form exploration for drop-off by clinic/specialty. |
| 3 | `booking_confirmed` | Custom Event (dataLayer push on final confirmation screen render, server-validated) | `booking_id`, `clinic_location`, `specialty`, `preferred_date`, `lead_source` | Mark as **key event / conversion**. Primary GA4 conversion + import candidate for Google Ads. |
| 4 | `call_now_click` | GTM Click Trigger — Click Classes contains `call-now-btn` (or `href` starts with `tel:`) | `page_location`, `clinic_location` (from page context or data-attribute), `button_position` (header/footer/card) | GA4 "Engagement" report; secondary conversion for Search campaigns (call-driven). |
| 5 | `whatsapp_widget_open` | GTM Click Trigger — Click ID `whatsapp-widget` or Click URL contains `wa.me` | `page_location`, `clinic_location`, `widget_state` (opened) | Engagement report; audience for retargeting non-form leads. |
| 6 | `patient_guide_download` | Custom Event (dataLayer push after gated form success, before/at PDF trigger) | `page_location`, `guide_name`, `lead_source`, `form_id` | Key event — top-of-funnel lead capture. Feeds "Guide Downloaders" audience for nurture remarketing. |
| 7 | `clinic_page_view` | GTM Trigger — Page View, condition on URL path pattern `/clinics/*` (or use GA4's automatic `page_view` + a custom parameter `clinic_name` pushed to dataLayer on page load) | `clinic_name`, `clinic_city`, `page_location` | GA4 standard `page_view` report filtered by `clinic_name`; used to compare interest across the 9 locations. |
| 8 | `blog_scroll_depth` | GTM Trigger — Scroll Depth (built-in GTM trigger type), thresholds 25/50/75/90% | `percent_scrolled`, `page_location`, `article_title` | GA4 Engagement report; feeds a "Highly Engaged Reader" audience (90%+) for content remarketing. |
| 9 | `cta_click_landing_page` | GTM Click Trigger — Click ID `hero-cta` on the paid landing page | `page_location`, `cta_text`, `utm_campaign` (from dataLayer, captured on page load) | GA4 Engagement + feeds paid-media CTA-to-form-fill ratio analysis. |

**Trigger type key:** "Custom Event" = GTM listens for a `dataLayer.push({event: '...'})` fired manually by the front-end developer. "GTM Click/Scroll Trigger" = GTM's built-in auto-event listeners (Click Trigger, Scroll Depth Trigger), which don't require a manual dataLayer push because GTM's own JS listens for the DOM event.

---

## 2. Booking Funnel — Step-by-Step Drop-off Tracking

### Which trigger fires at each step

| Step | What happens on the page | GTM Trigger | Fires |
|---|---|---|---|
| 1 | User selects clinic + specialty, clicks "Next" | Custom Event trigger listening for `event: 'booking_step_complete'` where `step_number == 1` | `booking_step_complete` |
| 2 | User enters name/phone/preferred date, clicks "Next" | Same Custom Event trigger, filtered on `step_number == 2` | `booking_step_complete` |
| 3 | User clicks "Confirm Booking" and sees the success screen | Custom Event trigger filtered on `step_number == 3`, plus a separate `booking_confirmed` push | `booking_step_complete` (step 3) + `booking_confirmed` |

### dataLayer JSON — actual payloads, not pseudocode

**Step 1 — Location & specialty selected:**
```json
{
  "event": "booking_step_complete",
  "step_number": 1,
  "step_name": "location_specialty_selected",
  "clinic_location": "Koramangala",
  "specialty": "Knee & Joint Care"
}
```

**Step 2 — Contact details entered:**
```json
{
  "event": "booking_step_complete",
  "step_number": 2,
  "step_name": "contact_details_entered",
  "clinic_location": "Koramangala",
  "specialty": "Knee & Joint Care",
  "preferred_date": "2026-07-08"
}
```

**Step 3 — Booking confirmed:**
```json
{
  "event": "booking_step_complete",
  "step_number": 3,
  "step_name": "booking_confirmed_screen",
  "clinic_location": "Koramangala",
  "specialty": "Knee & Joint Care"
}
```

**Separate, dedicated conversion event fired immediately after step 3:**
```json
{
  "event": "booking_confirmed",
  "booking_id": "ORN-24871",
  "clinic_location": "Koramangala",
  "specialty": "Knee & Joint Care",
  "preferred_date": "2026-07-08",
  "lead_source": "organic_website"
}
```

### A plain-language note on who actually implements this

**GTM cannot see inside a multi-step form on its own.** GTM's built-in triggers (Click, Scroll Depth, Page View) work because they listen for real browser/DOM events — a click, a scroll, a page load. Moving from step 1 to step 2 of a form that's built as a single-page component with JavaScript state (no page reload, no URL change, often not even a real DOM click GTM can cleanly target) is invisible to GTM unless something explicitly tells it a step happened. That "something" is a `dataLayer.push()` call written into the front-end code by the developer, at the exact moment each step completes. GTM only listens; it never generates these events by itself. In practice this means: **I would write the front-end dev a short spec** — "at the point the user clicks 'Next' on step 1, push this exact JSON object to `window.dataLayer` before advancing the UI state" (and hand them the three JSON payloads above verbatim) — and GTM's Custom Event trigger picks it up from there. Without that front-end code change, the booking funnel has zero step-level visibility, no matter how the GTM container itself is configured.

### Why a separate `booking_confirmed` event, not just `step_number: 3`

Step 3 completing (the user clicking "Confirm") and the booking actually being validated server-side aren't guaranteed to be the same moment — validation can fail (invalid phone, clinic fully booked). Firing the conversion event only once the success screen renders after server confirmation avoids counting failed submissions as bookings in Google Ads.

### Surfacing drop-off in GA4 Funnel Exploration

1. In GA4, create a new **Funnel Exploration**.
2. Add three steps, each defined as `event: booking_step_complete` with a parameter filter:
   - Step 1: `step_number = 1`
   - Step 2: `step_number = 2`
   - Step 3: `step_number = 3`
3. Turn **"Show elapsed time"** on to see how long users take between steps, and turn on **"Open funnel"** off (closed funnel) so you're only counting users who genuinely moved sequentially, not out-of-order events.
4. Add a breakdown dimension of `clinic_location` or `specialty` to see whether drop-off is concentrated at a specific clinic (e.g., a clinic with fewer available slots showing higher step-1→2 drop-off) — this is the number the performance marketing team will actually act on, since it tells them where the funnel is leaking, not just that it's leaking.
5. GA4 auto-calculates the abandonment rate between each step pair from the difference in unique users hitting `step_number: 1` vs `step_number: 2` vs `step_number: 3`.

---

## 3. Google Ads Conversion Import — Which Event, and Why

**Import `booking_confirmed` into Google Ads as the primary conversion action.** Not `patient_guide_download`, not `call_now_click`.

**Why this one over the others:**

- **It's the only event that represents a real, validated, revenue-adjacent outcome.** A guide download or a WhatsApp widget open signals interest, but a confirmed booking is the thing OrthoNow is actually running paid media to generate — Google's bidding algorithms (Target CPA / Maximize Conversions) will only optimize toward whatever signal you feed them, and optimizing toward a weak signal (a click) trains the algorithm to find more clicks, not more patients.
- **It carries clean, structured value data** (`clinic_location`, `specialty`) that can later support value-based bidding if OrthoNow assigns different revenue values per specialty (e.g., a knee surgery consult is worth more than a general consult).
- **`call_now_click` is a reasonable secondary conversion** (import it too, as a secondary/observation-only action) since a meaningful share of healthcare leads in India convert by phone rather than by form — but it shouldn't be primary, because a click on a `tel:` link doesn't confirm a call actually happened or lasted long enough to be a real enquiry, whereas `booking_confirmed` is only fired after successful server-side validation.
