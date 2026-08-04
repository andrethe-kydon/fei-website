# CLAUDE.md

Context for Claude Code working in this repository.

## What this is

The website for **Future Edge Institute Private Limited** (FEI), the education institute of Kydon Group, Singapore. FEI is working towards SSG Registered Training Provider (RTP) status.

The site carries **two product series**, and the distinction runs through the schema, the templates and the homepage:

| Series | Codes | What it is | Audience | Renders through |
| --- | --- | --- | --- | --- |
| **Operator**, The AI Operator Professional Series (AOP) | AOP 101 to AOP 106 | Six standalone **assessed** professional courses teaching people to operate AI (agents, RAG knowledge bases, n8n automation) as working business assets | Individuals | `course.template.html` |
| **Adoption**, The AI Adoption Series (AIA) | AIA 101 to AIA 102 | Two **participation based** corporate workshops, two days each, delivered in house | Organisations | `workshop.template.html` |

The `series` field on the course document decides which template a document renders through and which homepage section it appears in. `codePrefix` gives the displayed code, `AOP` or `AIA`. Both default to the Operator values, so content written before the Adoption series existed is unaffected.

**Adoption documents must never display assessment modes, pass thresholds or a delivery hour split.** These workshops make no assessment claim: they award a certificate of participation. `workshop.template.html` deliberately has nowhere to put an assessment card, a pass criteria box, a learning outcome list or an hour split line, and their Course JSON-LD omits `teaches`. Do not add any of it, and do not solve an Adoption layout problem by adding conditionals to the course template.

**Both series share one catalogue** at `#courses`: all eight programmes in a single filterable grid, Operator first and each series by number. Every card carries a series pill so the two are still told apart at a glance. The audience filters (For individuals, For organisations) and the audience segment on each card are derived from `series`, never from a course number or a list, so the filter cannot disagree with the card.

This replaced an earlier split, where the AIA workshops sat in the organisations section instead. Anything still describing the homepage as two separate lists is out of date.

**Registered names, exact.** FEI's registered name is **Future Edge Institute Private Limited**, spelled out in full, never abbreviated to Pte. Ltd. UEN **202634510R**, incorporated in Singapore on 30 July 2026. It is a wholly owned subsidiary of **Kydon Holdings Pte. Ltd.**, which is registered with the abbreviated form. The two differ deliberately: each must match ACRA exactly, so never normalise one to match the other and never apply a blanket Pte. Ltd. replacement. Standalone **Future Edge Institute** is the brand name and is correct wherever the legal entity is not being named.

## Architecture

Content driven static site. No framework, no dependencies for the site build.

- `build/build.js` renders everything into `dist/`. Content comes from Sanity when `SANITY_PROJECT_ID` is set, otherwise from `content/content.json`. Sanity failure falls back to the local file with a warning: never let a CMS problem break the build.
- `templates/*.template.html` use `{{TOKEN}}` placeholders filled by `build.js`.
- `static/` is copied verbatim into `dist/`. `static/styles.css` is the single stylesheet for every page.
- `studio/` is the Sanity Studio (its own package.json; not part of the site build).
- `dist/` is generated. Never edit it, never commit it.

Build and check: `npm run build`, then `npx serve dist`. A correct build reports **11 pages**.

## Pages

| Page | Template | Notes |
| --- | --- | --- |
| `index.html` | `index.template.html` | The homepage. Section order below. |
| `about.html` | `about.template.html` | Story timeline and market context. |
| `policies.html` | `policies.template.html` + `content/policies.html` | Privacy, terms, fees and refunds. |
| `aop101.html` to `aop106.html` | `course.template.html` | One per Operator course, rendered from content. |
| `aia101.html` to `aia102.html` | `workshop.template.html` | One per Adoption workshop, rendered from content. |

**Homepage section order:** hero, trust strip, marquee, catalogue (`#courses`), pathway (`#pathway`), the operator difference (`#difference`), who it is for (`#audience`), organisations (`#corporate`), funding (`#funding`), FAQ (`#faq`), contact (`#contact`).

The organisations section keeps the id `#corporate` from when it was the corporates section, so every existing link into it still works. It covers **private delivery only**: the three engagement formats and the four step discover, design, deliver, evidence flow, because that consultative process is what corporate buyers respond to. It does not list the AIA workshops, which live in the catalogue with everything else; it carries one line pointing readers up to them.

**Catalogue filter row**, in order: All programmes, For individuals, For organisations, a decorative divider, then AI Skills, Operations, Marketing, Sales, Business Foundations. The divider is a 1px rule, `aria-hidden`, and takes no tab stop, so the tablist still reads as eight tabs. The row scrolls horizontally on narrow screens; it is not meant to wrap.

**Card composition is driven by `series`, and the meta bar is the part that matters.** An Operator card shows hours, days and assessment modes. An Adoption card shows taught hours, days and group size, and must never show assessment modes or a pass threshold. Operator cards list `builds`, Adoption cards list `deliverables`. Keep these derived from `series` so they cannot drift as content changes.

The **story** (`#story`) and **market context** (`#why`) sections live on `about.html` and must not be reintroduced to the homepage: the homepage reaches the catalogue quickly by design. Anything linking to them points at `about.html`, never `index.html#story` or `index.html#why`.

The day by day outline appears only on the individual course pages. The homepage cards link to them and carry no outline accordion.

**Course page structure**, in order: hero with the sticky summary card, overview and audience, learning outcomes, outline, what you build, assessment including the certificate block, intakes, trainer (only when present), for teams, fees and funding with related courses, enquire band. The first four content blocks sit in a two column grid beside the sticky card; everything from intakes down is full width.

Three fields drive the conditional parts, and all three are safe to leave empty:

| Field | Empty behaviour |
| --- | --- |
| `feeDisplay` | Summary card shows "Fees confirmed at enquiry". Never put a figure here until fees are set. |
| `intakes` | The intakes section still renders, saying dates are being scheduled. Filter tabs are not built yet: the markup carries a comment marking where they go, at more than four intakes for format tabs and more than one month for month tabs. |
| `trainers` | The whole trainer section is omitted: no heading, no placeholder, no reserved space. |

**Workshop page structure** (Adoption series), in order: hero with the sticky summary card, who this workshop is for, what every participant leaves with, the two days, how we teach, the certificate note, fees and funding, the full pathway cross sell, enquire band. The first five blocks sit beside the sticky card; fees and funding down is full width. The funding wording here is not the course wording: these are commercial corporate engagements, not government subsidised, and RTP registration is being sought for the assessed AOP courses.

The **full pathway** cross sell block is rendered by `pathwayBlock()` in `build.js` and injected into both templates through `{{PATHWAY_BLOCK}}`, so the two series can never end up describing each other differently. Edit it in one place.

The brochure button appears only when `static/assets/brochures/<slug>.pdf` exists, checked with `fs.existsSync` at build time. It opens the PDF directly in a new tab: the brochure is for reading, so there is no form and no email gate in front of it. The click still fires `brochure_request` to GA4 and Meta. Both templates get it on the summary card; workshop pages also carry it as the hero's secondary button, under the same condition.

**Course pages state the current position honestly rather than showing TBC markers.** Visible `[TO BE CONFIRMED: ...]` markers are reserved for `policies.html`, where unresolved legal detail must be obvious. On a course page, say what is true now: dates being scheduled, fees at enquiry, the certificate issued by the institute and not yet accredited.

## Where to make a change

| Change | Where |
| --- | --- |
| Course details, fees copy, hours, outcomes, images, tracking IDs, WhatsApp number | Sanity (or `content/content.json` for local work). Not in templates. |
| Layout, new sections, new page types, styling | `templates/`, `static/styles.css`, `build/build.js` |
| New content field | Add to `studio/schemaTypes/course.js` **and** the Sanity mapping in `build.js` **and** `content/content.json`, so both content sources stay in step |

`content.json` keeps the two series in separate maps, `courses` and `workshops`, because both series number from 101 and one map keyed by number would collide. Sanity holds them in one document type; `splitSeries()` in `build.js` partitions either source into the same two collections and applies the `series` and `codePrefix` defaults. The Studio shows them as two lists, Operator Series (AOP) and Adoption Series (AIA), each with its own creation template so a new document lands in the list it was created from.

## House rules, non negotiable

1. **British spelling** throughout (organisation, programme, recognised, licence as noun).
2. **No dashes in prose.** No em dashes, no en dashes, and no hyphens used as punctuation. Use colons, full stops or lists. Hyphens survive only inside proper nouns and established compounds: human-in-the-loop, go-to-market, Without-You Test, n8n node names, Pte. Ltd.
3. **Brand:** navy `#1C3557`, orange `#F15522` (matching the live kydongrp.com), with the light theme tokens defined at the top of `styles.css`. Purple `#5B2D86` is reserved for assessment materials and is not used on the website. Use the existing CSS custom properties; do not introduce new raw hex values.
4. **No fees, prices or unverified figures anywhere on the site.** Fees are not set. Enquiries route to `sales@kydongrp.com` and WhatsApp. Any number that appears must be verifiable (course hours, days, Kydon's published track record).
5. **Funding language is exact:** FEI *is working on obtaining its licence as a Registered Training Provider from SkillsFuture Singapore (SSG)*. Never imply courses are SkillsFuture claimable, WSQ accredited or subsidised. Never state or imply RTP registration is granted.
6. **AOP 106 and AOP 101 Day 4 are awareness only:** never legal, tax or accounting advice. Keep the existing disclaimers intact.
7. **No Anthropic attribution** anywhere in the site or its content.
8. **Accessibility:** keep `prefers-reduced-motion` handling, focus-visible outlines, and `aria` attributes on the nav toggle and filters. Semantic headings in order.
9. **SSG defensibility:** Operator course pages must keep declaring the delivery hour split (instructor led, practical, assessment, breaks separately) and must never describe any hours as asynchronous or self directed. These figures must match the RTP filing exactly, so do not adjust them without being asked. Adoption workshop pages declare taught hours only and no split at all: they are not part of the RTP filing, so giving them a split would misrepresent both series.

## Facts worth knowing

- Courses are **standalone, no prerequisites**. Participants without their own business work on **Brightleaf Bookkeeping**, the reference business (founder Wei Lin, a one person bookkeeping practice for Singapore F&B operators; personas Marcus and Priya).
- Assessment modes are only ever **Practical Exam, Project, Oral Interview**, and only ever on Operator courses. Pass threshold 70 percent, attendance 75 percent.
- Operator certificates are **Certificates of Completion issued by Future Edge Institute**, awarded on evidence. Adoption workshops issue a **digital certificate of participation** from Future Edge Institute within 24 hours, recognising participation and output. Never blur the two.
- Segment tags used for catalogue filtering: Operations, Marketing, Sales, Business Foundations. Adoption workshops carry segment tags too, but the filter belongs to the AOP catalogue only.
- **AI capability tags** (`aiTags`, orange pills) are separate from the segment tags and are not filterable. They appear only where the curriculum genuinely teaches AI: AOP 101 to 104, and both AIA workshops. AOP 105 and 106 must not carry them unless a curriculum revision introduces real AI content. Do not add tags to make the catalogue look uniform.
- HubSpot portal `2457674` is live and correct. GA4 and Meta Pixel IDs are placeholders until supplied.
- Conversion events already fire on: course enquiry clicks, course detail clicks, workshop detail clicks (tagged with the AIA code), WhatsApp clicks (tagged by placement), funding interest, corporate enquiry, and course outline opens. An enquiry click on an AIA card reports as `corporate_enquiry_click` with the workshop code, because that is what it is. Preserve these when editing; add matching events for any new call to action.

## Known pending items

Domain (canonical URLs currently use a placeholder), Kydon logo file (text wordmark until then), GA4 and Meta Pixel IDs, HubSpot form GUID, course and workshop images, faculty section (trainers not confirmed), and a legal and policies page. `policies.html` still describes the assessed courses only: it needs a pass on the Adoption workshops (in house delivery, engagement pricing, cancellation by the client organisation) once the commercial terms are set.
