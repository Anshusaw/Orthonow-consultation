# OrthoNow — Namoza Developer Assignment

GTM event tracking schema, a conversion-optimized landing page, and a HubSpot/WhatsApp lead integration for OrthoNow, a 9-clinic orthopaedic chain. Submission for Developer – Position 1 (Client Web + Martech).

```
├── task1/
│   └── GTM_Event_Schema.md      — full event schema, funnel dataLayer JSON, Ads conversion pick
├── task2/
│   ├── index.html               — single-file landing page (deployed to Vercel)
│   ├── api/
│   │   └── submit-lead.js       — Vercel serverless function: phone-dedup + rate limiting
│   └── pagespeed-mobile.png     — PageSpeed Insights Mobile screenshot
└── task3/
    └── README.md                — integration architecture write-up (300–400 words)
```

---

## Running the landing page locally

`task2/index.html` is a single self-contained file — no build step, no dependencies. Open it directly in a browser, or use VS Code's Live Server extension for auto-reload during editing.

To see the dataLayer push fire: open DevTools → Console, fill in the form, submit. The push is logged to console on every submit. Appending `?debug=1` to the URL also reveals an on-page event log panel (hidden by default in production, since a patient shouldn't see a JSON log on a booking page).

## Deployment

The landing page and its serverless function are deployed to Vercel with the project root set to `task2/`. The function at `task2/api/submit-lead.js` runs real dedup-search-then-write logic against HubSpot's Contacts API and per-phone rate limiting; without a `HUBSPOT_ACCESS_TOKEN` environment variable set, it returns the exact decision it would make (create / update / flag-conflict) without requiring live credentials.

## Performance

`task2/index.html` has zero external requests — no webfonts, no images, no CDN scripts, no frameworks — by design, so it clears 90+ on PageSpeed Insights Mobile without lazy-loading or compression workarounds. Screenshot at `task2/pagespeed-mobile.png`.