# OrthoNow — Namoza Developer Assignment

Submission for Developer – Position 1 (Client Web + Martech).

```
├── task1/
│   └── GTM_Event_Schema.md      — full event schema, funnel dataLayer JSON, Ads conversion pick
├── task2/
│   ├── index.html               — single-file landing page (deploy this to Vercel)
│   └── api/
│       └── submit-lead.js       — Vercel serverless function: phone-dedup + rate limiting
└── task3/
    └── README.md                — integration architecture write-up (300–400 words)
```

---

## How to run this locally in VS Code (step by step)

1. **Install VS Code** if you don't have it: https://code.visualstudio.com
2. **Create the project folder** on your machine, e.g. `orthonow-assignment`, and open it in VS Code (`File → Open Folder…`).
3. **Recreate the folder structure above.** In VS Code's file explorer (left sidebar), right-click → **New Folder** to make `task1`, `task2`, `task2/api`, `task3`.
4. **Create each file** (right-click the relevant folder → **New File**, name it exactly as shown above) and paste in the matching content:
   - `task1/GTM_Event_Schema.md` ← paste the schema doc
   - `task2/index.html` ← paste the landing page
   - `task2/api/submit-lead.js` ← paste the serverless function
   - `task3/README.md` ← paste the integration write-up
   - `README.md` (this file) at the project root
5. **Preview the landing page instantly, no server needed:** in VS Code's file explorer, right-click `task2/index.html` → if you have the **Live Server** extension (Extensions icon in the sidebar → search "Live Server" by Ritwick Dey → Install), click **"Open with Live Server."** Otherwise just double-click `index.html` in your OS file explorer — it opens directly in the browser since it's a self-contained file with no build step.
6. **Watch the dataLayer push live:** open the page, press `F12` (or right-click → Inspect) to open DevTools, click the **Console** tab, fill in the form, and submit. You'll see the logged `dataLayer.push(...)` object in the console, and the on-page green-tinted log panel at the bottom of the page will show the same event in real time — that panel exists specifically so you can demo this in the Loom without narrating over DevTools.

---

## How to deploy Task 2 to Vercel (so it's a real, live URL)

1. **Push this repo to GitHub**:
   ```bash
   cd orthonow-assignment
   git init
   git add .
   git commit -m "OrthoNow developer assignment"
   git branch -M main
   git remote add origin https://github.com/<your-username>/orthonow-assignment.git
   git push -u origin main
   ```
2. **Sign up / log in at** https://vercel.com **with your GitHub account.**
3. Click **"Add New… → Project"**, select this repo.
4. Under **"Root Directory,"** click **Edit** and set it to `task2` — this is the important step, since the landing page and the serverless function both live under `task2/`, not the repo root.
5. Leave the framework preset as **"Other"** (no build command needed — it's a static HTML file plus one serverless function, both of which Vercel picks up automatically).
6. Click **Deploy**. Vercel gives you a live URL like `https://orthonow-assignment.vercel.app` within about a minute.
7. **(Optional, to make Task 3's function fully live rather than simulated):** in the Vercel project → **Settings → Environment Variables**, add `HUBSPOT_ACCESS_TOKEN` with a HubSpot private-app token that has `crm.objects.contacts.write` and `.read` scopes, then redeploy. Without this variable set, `/api/submit-lead` still runs and returns the exact decision it *would* make (create vs. update vs. flag-conflict) — useful for demoing the logic without exposing a real token in the Loom.

---

## Recording the Loom (suggested structure, ~8 min)

- **0:00–2:00** — Screen-share `task1/GTM_Event_Schema.md`. Walk through the table, then specifically explain the multi-step form point in your own words: GTM doesn't natively see JS-state-driven step changes, so the front-end dev has to push the three JSON payloads to `dataLayer` manually — this is the one thing to be ready to explain live if asked, since it's the actual filter in this task.
- **2:00–5:00** — Open the live Vercel URL **with `?debug=1` appended** (e.g. `https://your-site.vercel.app/?debug=1`) so the on-page dataLayer log panel is visible — it's hidden by default on the real URL since a patient shouldn't see a JSON log on a booking page. Open DevTools console too, fill and submit the form. Show the `dataLayer.push` object appear in both the console and the debug panel. Also show the PageSpeed Insights Mobile screenshot (run https://pagespeed.web.dev against your **plain** deployed URL, without `?debug=1`, since that's the real production page — screenshot after deploying, since PageSpeed needs a live URL, not a local file).
- **5:00–8:00** — Open `task3/README.md`, talk through the architecture, and specifically state your answer to the "same phone, different name" question out loud, in your own words, before reading it off the page.

## Note on getting the PageSpeed screenshot

This page has zero external requests (no webfonts, no images, no CDN scripts, no frameworks) specifically so it clears 90+ on mobile without needing image compression or lazy-loading tricks. After deploying to Vercel:
1. Go to https://pagespeed.web.dev
2. Paste your live Vercel URL, run it, select the **Mobile** tab.
3. Screenshot the score circle + the Core Web Vitals section, save as `task2/pagespeed-mobile.png`, and reference it in your submission email.
