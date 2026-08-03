# Future Edge Institute Website

Static site for Future Edge Institute Private Limited (futureedge.institute placeholder domain), home of The AI Operator Professional Series. Built as a content driven static site: course content and site settings live in Sanity (or the local `content/content.json` fallback), a Node build script renders the pages, Vercel hosts and auto deploys.

## Architecture

| Layer | Tool | Job |
| --- | --- | --- |
| Code maintenance | Claude Code + GitHub | Edit templates, styles and build logic; commit and push |
| Content management | Sanity | Courses, fees copy, WhatsApp number, tracking IDs, RTP statement |
| Hosting and deploys | Vercel | Builds on every push and on Sanity publish (via webhook) |
| CRM, forms, attribution | HubSpot (portal 2457674) | Enquiry form embed and tracking script already wired |

## Repository layout

```
CLAUDE.md                    Project context and house rules for Claude Code
SETUP.md                     Step by step: GitHub, Vercel, Sanity, go live
build/build.js               The whole build: content in, dist/ out
content/content.json         Local content fallback (used when Sanity is not configured)
templates/                   index.template.html and course.template.html
static/                      styles.css and assets/ (local course images, og-image)
studio/                      Sanity Studio: run it, edit content, publish
  schemaTypes/               course.js and siteSettings.js
  seed.ndjson                Imports all six courses and settings in one command
dist/                        Build output (gitignored, regenerated every build)
```

## Getting started

Full step by step with exact commands: see **SETUP.md**. In short:

```
npm run build                # renders dist/ from content.json or Sanity
cd studio && npm install && npm run dev    # the CMS, at localhost:3333
```

Set `SANITY_PROJECT_ID` in Vercel to switch the build from `content.json` to Sanity. If Sanity is unreachable the build falls back to `content.json` and logs a warning, so the CMS can never take the site down.

Course images can be uploaded in Sanity (served from its CDN) or committed to `static/assets/courses/`. Sanity wins when both exist.

## Before launch checklist

- [ ] Replace `G-XXXXXXXXXX` (GA4) and `META_PIXEL_ID` in Site Settings with real IDs (Nada).
- [ ] Create the HubSpot form (Marketing, Forms) and put its GUID in Site Settings. Suggested fields: first name, last name, email, company (optional), a Course of interest dropdown (AOP 101 to AOP 106, OPC Programme, Corporate enquiry, Notify me when funding is available), message.
- [ ] Set the real domain in Site Settings `siteUrl` and point the domain at Vercel.
- [ ] Drop course images into `static/assets/courses/` as `aop101.jpg` ... `aop106.jpg` (1200 x 750 for cards; the same file is reused as the page banner) and `og-image.jpg` (1200 x 630) in `static/assets/`. Alternatively wire the Sanity image fields into the templates when ready.
- [ ] SSG RTP gate: before filing, fees and named trainers must appear on the site. Both are content edits in Sanity once decided.

## House rules baked into this site

British spelling. No dashes in prose (colons and full stops instead). Brand: navy #1C3557, orange #F15522 (per the live kydongrp.com), purple reserved for assessment content and unused here. No fees anywhere until verified. All enquiries route to sales@kydongrp.com and WhatsApp. No Anthropic attribution.
