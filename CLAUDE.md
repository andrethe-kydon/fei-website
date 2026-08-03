# CLAUDE.md

Context for Claude Code working in this repository.

## What this is

The website for **Future Edge Institute Private Limited** (FEI), the education institute of Kydon Group, Singapore. FEI delivers **The AI Operator Professional Series (AOP)**: six standalone professional courses, AOP 101 to AOP 106, teaching working adults to operate AI (agents, RAG knowledge bases, n8n automation) as working business assets. FEI is working towards SSG Registered Training Provider (RTP) status.

**Registered names, exact.** FEI's registered name is **Future Edge Institute Private Limited**, spelled out in full, never abbreviated to Pte. Ltd. UEN **202634510R**, incorporated in Singapore on 30 July 2026. It is a wholly owned subsidiary of **Kydon Holdings Pte. Ltd.**, which is registered with the abbreviated form. The two differ deliberately: each must match ACRA exactly, so never normalise one to match the other and never apply a blanket Pte. Ltd. replacement. Standalone **Future Edge Institute** is the brand name and is correct wherever the legal entity is not being named.

## Architecture

Content driven static site. No framework, no dependencies for the site build.

- `build/build.js` renders everything into `dist/`. Content comes from Sanity when `SANITY_PROJECT_ID` is set, otherwise from `content/content.json`. Sanity failure falls back to the local file with a warning: never let a CMS problem break the build.
- `templates/*.template.html` use `{{TOKEN}}` placeholders filled by `build.js`.
- `static/` is copied verbatim into `dist/`. `static/styles.css` is the single stylesheet for every page.
- `studio/` is the Sanity Studio (its own package.json; not part of the site build).
- `dist/` is generated. Never edit it, never commit it.

Build and check: `npm run build`, then `npx serve dist`. A correct build reports **9 pages**.

## Pages

| Page | Template | Notes |
| --- | --- | --- |
| `index.html` | `index.template.html` | The homepage. Section order below. |
| `about.html` | `about.template.html` | Story timeline and market context. |
| `policies.html` | `policies.template.html` + `content/policies.html` | Privacy, terms, fees and refunds. |
| `aop101.html` to `aop106.html` | `course.template.html` | One per course, rendered from content. |

**Homepage section order:** hero, trust strip, marquee, catalogue (`#courses`), pathway (`#pathway`), the operator difference (`#difference`), who it is for (`#audience`), corporates (`#corporate`), funding (`#funding`), FAQ (`#faq`), contact (`#contact`).

The **story** (`#story`) and **market context** (`#why`) sections live on `about.html` and must not be reintroduced to the homepage: the homepage reaches the catalogue quickly by design. Anything linking to them points at `about.html`, never `index.html#story` or `index.html#why`.

The day by day outline appears only on the individual course pages. The homepage cards link to them and carry no outline accordion.

**Course page structure**, in order: hero with the sticky summary card, overview and audience, learning outcomes, outline, what you build, assessment including the certificate block, intakes, trainer (only when present), for teams, fees and funding with related courses, enquire band. The first four content blocks sit in a two column grid beside the sticky card; everything from intakes down is full width.

Three fields drive the conditional parts, and all three are safe to leave empty:

| Field | Empty behaviour |
| --- | --- |
| `feeDisplay` | Summary card shows "Fees confirmed at enquiry". Never put a figure here until fees are set. |
| `intakes` | The intakes section still renders, saying dates are being scheduled. Filter tabs are not built yet: the markup carries a comment marking where they go, at more than four intakes for format tabs and more than one month for month tabs. |
| `trainers` | The whole trainer section is omitted: no heading, no placeholder, no reserved space. |

The brochure button on the summary card appears only when `static/assets/brochures/<slug>.pdf` exists, checked with `fs.existsSync` at build time. Its modal embeds the HubSpot form when `hubspotFormGuid` is set, and offers the brochure by email until then.

**Course pages state the current position honestly rather than showing TBC markers.** Visible `[TO BE CONFIRMED: ...]` markers are reserved for `policies.html`, where unresolved legal detail must be obvious. On a course page, say what is true now: dates being scheduled, fees at enquiry, the certificate issued by the institute and not yet accredited.

## Where to make a change

| Change | Where |
| --- | --- |
| Course details, fees copy, hours, outcomes, images, tracking IDs, WhatsApp number | Sanity (or `content/content.json` for local work). Not in templates. |
| Layout, new sections, new page types, styling | `templates/`, `static/styles.css`, `build/build.js` |
| New content field | Add to `studio/schemaTypes/course.js` **and** the Sanity mapping in `build.js` **and** `content/content.json`, so both content sources stay in step |

## House rules, non negotiable

1. **British spelling** throughout (organisation, programme, recognised, licence as noun).
2. **No dashes in prose.** No em dashes, no en dashes, and no hyphens used as punctuation. Use colons, full stops or lists. Hyphens survive only inside proper nouns and established compounds: human-in-the-loop, go-to-market, Without-You Test, n8n node names, Pte. Ltd.
3. **Brand:** navy `#1C3557`, orange `#F15522` (matching the live kydongrp.com), with the light theme tokens defined at the top of `styles.css`. Purple `#5B2D86` is reserved for assessment materials and is not used on the website. Use the existing CSS custom properties; do not introduce new raw hex values.
4. **No fees, prices or unverified figures anywhere on the site.** Fees are not set. Enquiries route to `sales@kydongrp.com` and WhatsApp. Any number that appears must be verifiable (course hours, days, Kydon's published track record).
5. **Funding language is exact:** FEI *is working on obtaining its licence as a Registered Training Provider from SkillsFuture Singapore (SSG)*. Never imply courses are SkillsFuture claimable, WSQ accredited or subsidised. Never state or imply RTP registration is granted.
6. **AOP 106 and AOP 101 Day 4 are awareness only:** never legal, tax or accounting advice. Keep the existing disclaimers intact.
7. **No Anthropic attribution** anywhere in the site or its content.
8. **Accessibility:** keep `prefers-reduced-motion` handling, focus-visible outlines, and `aria` attributes on the nav toggle and filters. Semantic headings in order.
9. **SSG defensibility:** course pages must keep declaring the delivery hour split (instructor led, practical, assessment, breaks separately) and must never describe any hours as asynchronous or self directed. These figures must match the RTP filing exactly, so do not adjust them without being asked.

## Facts worth knowing

- Courses are **standalone, no prerequisites**. Participants without their own business work on **Brightleaf Bookkeeping**, the reference business (founder Wei Lin, a one person bookkeeping practice for Singapore F&B operators; personas Marcus and Priya).
- Assessment modes are only ever **Practical Exam, Project, Oral Interview**. Pass threshold 70 percent, attendance 75 percent.
- Certificates are **Certificates of Completion issued by Future Edge Institute**.
- Segment tags used for catalogue filtering: Operations, Marketing, Sales, Business Foundations.
- **AI capability tags** (`aiTags`, orange pills) are separate from the segment tags and are not filterable. They appear only on courses whose curriculum genuinely teaches AI, currently AOP 101 to 104. AOP 105 and 106 must not carry them unless a curriculum revision introduces real AI content. Do not add tags to make the catalogue look uniform.
- HubSpot portal `2457674` is live and correct. GA4 and Meta Pixel IDs are placeholders until supplied.
- Conversion events already fire on: course enquiry clicks, course detail clicks, WhatsApp clicks (tagged by placement), funding interest, corporate enquiry, and course outline opens. Preserve these when editing; add matching events for any new call to action.

## Known pending items

Domain (canonical URLs currently use a placeholder), Kydon logo file (text wordmark until then), GA4 and Meta Pixel IDs, HubSpot form GUID, course images, faculty section (trainers not confirmed), and a legal and policies page.
