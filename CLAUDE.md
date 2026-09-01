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
- `docs/DECISIONS.md` records every value the site needs and does not have, grouped by what it blocks, with the person who decides it. An unconfirmed value is omitted from the page and recorded there. Never left on the page as a marker.
- The enquiry address lives in **one** field, `siteSettings.enquiryEmail`. Templates read it as `{{EMAIL}}`, and **content prose may carry `{{EMAIL}}` too**: `resolveContentTokens()` in `build.js` walks every string in the content tree and fills it, for both content sources, before anything renders. Never type an address into a CMS field or a template. The exception is the PDFs, which are images of text and carry whatever address they were built with: see below.
- `.github/workflows/daily-rebuild.yml` calls a Vercel deploy hook once a day. **Anything on this site derived from the build date depends on it.** See below before writing more of it.

Build and check: `npm run build`, then `npx serve dist`. A correct build reports **11 pages**.

## Dates and the daily rebuild

This is a statically built site, so **anything derived from the build date freezes
at the moment of the last deploy.** Two things already depend on it:

| What | Where | Goes stale as |
| --- | --- | --- |
| Upcoming intakes | `upcomingIntakes()` filters on the build date | An intake that has since started is still advertised |
| The enrolment button | `enrolment()` renders "Enrol now, closes this month" | Still says "this month" in a later month |

**What keeps them honest is `.github/workflows/daily-rebuild.yml`**, which curls a
Vercel deploy hook at 22:00 UTC, so 06:00 Singapore, every day. Filtering at build
time is necessary and not sufficient; the daily rebuild is what makes it
sufficient. The hook URL is the repo secret `VERCEL_DEPLOY_HOOK`, and the workflow
checks the HTTP status and exits non zero on anything but a 2xx, because a hook
that silently 404s means the site quietly stops refreshing, which is the failure
nobody notices. It never echoes the secret, on success or failure.

**If you add build date derived copy, it inherits this dependency.** That is fine,
and it is the reason the rebuild exists. Two rules follow:

1. **Degrade in one direction only.** Never let a stale build make a claim that
   is worse than silence. `enrolment()` is the pattern: once the deadline passes
   it stops offering enrolment, says the cohort closed, and warns on the build
   console. It never invents urgency it cannot support.
2. **Filter at build time, never in the browser.** Client side filtering leaves
   the stale claim in the HTML where it can be scraped and indexed, shows a
   closed intake as open to anyone with JavaScript off, and does nothing for a
   line like "closes this month" that is baked into the markup.

**Two ways this mechanism can fail quietly, both worth knowing.** GitHub disables
scheduled workflows in a repository with no commit activity for 60 days, so a
quiet period stops the rebuild without any error at all: re-enable it in the
Actions tab. And a 2xx from the hook means Vercel queued the build, not that it
succeeded; a failed build is visible in Vercel and leaves the previous deploy
serving. Scheduled workflow failures email the repository owner by default, which
is the only thing making "fail loudly" audible, so do not turn that off.


## Pages

| Page | Template | Notes |
| --- | --- | --- |
| `index.html` | `index.template.html` | The homepage. Section order below. |
| `about.html` | `about.template.html` | Story timeline and market context. |
| `policies.html` | `policies.template.html` + `content/policies.html` | Privacy, terms, fees and refunds. |
| `aop101.html` to `aop106.html` | `course.template.html` | One per Operator course, rendered from content. |
| `aia101.html` to `aia102.html` | `workshop.template.html` | One per Adoption workshop, rendered from content. |
| `opc.html` | `programme.template.html` | The OPC Launchpad, a Career Programme. Built only when the document is published. |

**Homepage section order:** hero, trust strip, marquee, catalogue (`#courses`), pathway (`#pathway`), why this matters (`#difference`), what you leave with (`#outcomes`), who it is for (`#audience`), organisations (`#corporate`), funding (`#funding`), FAQ (`#faq`), contact (`#contact`).

**The homepage is deliberately light on prose.** It carries the argument in visuals and reaches the catalogue quickly; the detail lives on the programme pages and on `about.html`. Three rules follow from that, and reversing any of them puts the text back:

- `#difference` is a **four step flow**, not prose: one lead sentence, four steps of a bold label and two short lines, one closing line. Two short lines per step, never a paragraph.
- `#outcomes` is the five assets as glyphs and one line each. It is the promoted answer to "what do I actually leave with".
- The FAQ is **five questions**. Prerequisites, software and provenance moved to `about.html#faq`. Each page carries the `FAQPage` JSON-LD for its own questions only, so no two pages claim the same question: move the schema entry whenever you move a question.

`#difference` is a **navy** band, on the same gradient as `.pain` on the about page. Everything inside it is set for a navy ground, and the brand rule for a dark panel holds throughout: **blue light for accents, never the brand blue.** The base `.eyebrow` is `--blue`, so the section has to override it.

| Element | Colour |
| --- | --- |
| Heading, step labels | `#FFFFFF` |
| Eyebrow, closing italic line | `--blue-light` |
| Lead sentence, the two lines under each step | `#9FBBD4` |
| Step dots, in order | `#FFFFFF`, `#C4E3F3`, `#A2D3E9`, `--blue-light` |
| Dot numerals, all four | `--navy` |
| Rail | gradient `#FFFFFF` to `--blue-light` |
| Hairline rule under the closing line | `rgba(255,255,255,.16)` |

The dot fills are all light, so every numeral is `--navy`: worst case is 7.26:1 on the last dot, where white would sit near 1.9:1. If an element does not work on the band, adapt the element. Do not lighten the section.

The organisations section keeps the id `#corporate` from when it was the corporates section, so every existing link into it still works. It covers **private delivery only**: the three engagement formats and the four step discover, design, deliver, evidence flow, because that consultative process is what corporate buyers respond to. It does not list the AIA workshops, which live in the catalogue with everything else; it carries one line pointing readers up to them.

**Catalogue filter row**, in order: All programmes, For individuals, For organisations, a decorative divider, then AI Skills, Operations, Marketing, Sales, Business Foundations. The divider is a 1px rule, `aria-hidden`, and takes no tab stop, so the tablist still reads as eight tabs. The row scrolls horizontally on narrow screens; it is not meant to wrap.

**Card composition is driven by `series`, and the meta bar is the part that matters.** An Operator card shows hours, days and assessment modes. An Adoption card shows taught hours, days and group size, and must never show assessment modes or a pass threshold. Keep these derived from `series` so they cannot drift as content changes.

**Catalogue cards carry no takeaway list.** Eight cards times three bullets was about a quarter of the homepage's text, for content already on each programme page. `builds` and `deliverables` are still rendered in full there, and the card's own buttons link to them: do not put the list back on the card. The card's footer uses `margin-top:auto` to hold the buttons at the foot, which is the job the list used to do.

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

## Career Programmes

A third kind of page, and a third document type, `careerProgramme`. The long
cohort programmes: the **OPC Launchpad** now, FDO later. Deliberately not a third
series of `course`, which is shaped around short courses: days, a contact hour
split three ways, declared assessment modes.

**They are deliberately outside the `#courses` catalogue.** Those filters work by
hiding and showing siblings in one grid, and a five month programme sitting among
eight short courses would misrepresent both. Do not add one to the catalogue, and
do not derive its card from `series`.

Instead they reach the visitor through the nav. The **Programmes** item becomes a
disclosure when at least one programme is published, listing All short courses
and then each programme; with none published it is the plain link it has always
been, and the nav is byte for byte unchanged. The existing item was reused rather
than a seventh added, because the row already tightens its gap at 1080px to keep
six items on one line. The control is a `<button>`: `navScript()` closes the
mobile menu whenever a link inside it is followed, so an anchor would collapse
the panel on the tap that opened it.

The `published` boolean is the gate: off means absent from the menu, absent from
the sitemap, and no page built. The Sanity query also excludes drafts explicitly
rather than relying on the absence of a read token. One list feeds both the write
loop and the sitemap, so a page and its sitemap entry cannot diverge.

**Future Edge Institute does not deliver this programme.** The OPC Launchpad is
delivered by Kydon Group in partnership with Singapore Polytechnic under the
SkillsFuture Career Transition Programme, and **Singapore Polytechnic issues all
eight certificates**. That is a real exception to the certificate rule below, not
a slip. The Course JSON-LD says the same: provider is Kydon Group, the academic
partner is the contributor, and `certificateAwarded` names the actual issuer, so
nothing defaults to FEI.

**Two rules live in the template, not in editable prose.**

1. **The attribution paragraph renders in two fixed places**, under the hero and
   beside the certificate claim in the module summary. It resolves who delivers,
   who accredits and who issues certificates. Never shorten it for style, never
   move it for layout.
2. **The funding scope note renders whenever it is set, independently of
   `showFees`.** An earlier version tied it to the fee block. That was wrong. Its
   job is not to qualify the fee table: it is to stop the subsidy claim
   contradicting the eight short course pages, which say plainly that those
   courses are commercial and not subsidised. The standfirst and the comparison
   table make that claim whether or not a figure is on the page, so the note has
   to survive the figures being hidden. With fees shown it sits inside the fees
   block; with fees hidden it stands alone in the same slot. Do not re-tie it.

**Hours never appear as a bare total.** Always with their parts: *580.5 taught
plus 33.5 assessment, 614 in total*. The per module figures elsewhere on the page
are **taught** hours and the schedule's are **totals**, so a lone number invites a
reader to conclude the two contradict each other. Stating both is what stops
that. `hoursPhrase()` in `build.js` is the only place that formats them, and with
no assessment recorded it falls back to the plain figure rather than inventing a
breakdown. The module object stores taught and assessment; a module total is
computed where it is shown and never stored, so the parts and the total cannot
disagree.

**The schedule derives its own outer dates.** Programme start and end are the
earliest and latest module dates, not separate fields, so the at a glance block
can never contradict the module table under it. The section names the cohort it
belongs to, so a visitor arriving for a later intake cannot read those dates as
theirs. It renders nothing at all when the schedule object is empty.

**Eleven PDFs carry a contact address that no field can reach.** The nine
brochures in `static/assets/brochures/` and the two schedule PDFs in Sanity all
have the enquiry address drawn into them, three occurrences each in the
brochures and two and four in the schedule pair. Changing
`siteSettings.enquiryEmail` does not touch them, and no build step can: they are
rendered documents, not markup. Whenever that address changes, every one of them
has to be reissued from its source, or pulled. This is already true: all eleven
still say `sales@kydongrp.com`, which the site no longer uses.

**The downloads block resolves itself.** Files attached renders the downloads;
none attached renders a line inviting the reader to request the day by day
schedule from the enquiry address. Never both, and never neither while there is
an address to ask, so a future intake whose files nobody uploaded still gives a
reader somewhere to go instead of a section that stops.

**Printing.** "Print this schedule" prints a schedule, not the page. The print
block in `styles.css` hides every direct child of the body except the header, the
attribution, `#schedule` and the footer, and inside those it drops the navigation,
the section bar, the download cards, the scroll hint and the print button itself.
What survives is what a standalone document needs to be trusted: the logo, the
attribution naming who delivers and who certifies, and the registered entity with
its UEN. A4 portrait, table header rows repeat across pages, no row splits across
a break, and no href is appended to a link. One rule there is load bearing:
`.reveal` is forced visible, because reveal on scroll otherwise prints blank
paper for anything below the fold. The control is `hidden` in the markup and
revealed by script, so it never appears without the script that makes it work.

**The schedule PDFs are file assets in Sanity, not files in `static/`.** They are
attached by `studio/scripts/load-opc-schedule-files.js`, which is idempotent and
reuses an already uploaded asset. **A `sanity dataset import` of `seed-opc.ndjson`
wipes `schedule.files`**, because the seed carries an empty array and `--replace`
replaces the whole document. Re-run the script after any import. The PDFs are
built by hand from an approved workbook and are the one part of this page that
can drift from it: if a session moves, the workbook is the source of truth and
both PDFs are reissued with the version line bumped.

**Nothing on the page is ever marked as unconfirmed**, because nothing
unconfirmed goes on the page. There is no confirmation style on this site: an
unsettled value is omitted and recorded in `docs/DECISIONS.md`. Do not invent a
marker for one.

**One scoped exception: a reference the funding regime expects.** Where the
absence of a value would itself mislead, the row stays and states plainly that
the value is pending. The case on this site is the **TGS code** in the OPC
Launchpad programme details, which carries the value "To be confirmed": on a
course funded under an SSG scheme, no TGS reference at all reads as a programme
that is not registered, which is worse than one visibly awaiting its code. Do
not delete that row as a stray marker. Note the distinction it rests on: the
value is plain prose that a reader understands, not a styled marker of the
`[TO BE CONFIRMED: ...]` kind, which remains banned everywhere but
`policies.html`. The exception is narrow. It does not licence pending values in
general, and everything still unsettled is recorded in `docs/DECISIONS.md`.

**Fees.** House rule 4 carries a scoped exception for exactly this case, and it
is the only page using it: the SCTP fee tiers are already published by Singapore
Polytechnic under a government subsidy scheme, so they may appear here.
`showFees` is on for the OPC Launchpad, approved by David on 1 September 2026.
`showFees` still defaults to off for a new programme, and the commercial fees of
Future Edge Institute never appear anywhere, which is not affected by this.

**Section 3 of the page, why now, is static prose in the template** and has no
schema fields. It is FEI's market argument rather than any one programme's, it
reads the same on the next career programme, and its two sourced statistics are
load bearing enough that they should not be editable in passing. Everything else
on the page comes from the document.

**Scoping, so neither reads as a rule violation later.** House rule 9 forbids
describing hours as asynchronous or self directed: that is an RTP filing
constraint on FEI's own Operator courses and does not bind an SP delivered SCTP
programme, which is published as full time classroom **and** asynchronous e
learning. And the certificate rule assumes FEI is the issuer, which is not true
here, as above.


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
3. **Brand:** navy and blue, **not** Kydon orange. FEI has its own identity: the wordmark led lockup with navy "Future", blue "Edge", spaced INSTITUTE between two rules, and the tagline **Future Ready. Future Strong**. Kydon orange `#F15522` was retired from this site and must not come back; purple `#5B2D86` is reserved for assessment materials and is not used on the website. Use the CSS custom properties at the top of `styles.css`; do not introduce new raw hex values.

   | Token | Hex | Use |
   | --- | --- | --- |
   | `--navy` | `#122C50` | Wordmark, headings, dark panels |
   | `--navy-deep` | `#0C1F3A` | Footer, the dark end of panel gradients |
   | `--ink` | `#16304F` | Body text default |
   | `--blue` | `#2196CC` | **Decorative only.** Eyebrow labels, section rules, AI capability tags, list markers, active indicators |
   | `--blue-dark` | `#1B7BA8` | **Interactive only.** Buttons, links, the sticky mobile bar, anything solid carrying white text |
   | `--blue-light` | `#7FC4E2` | Accents that sit on a navy or dark panel |
   | `--blue-dim` | `rgba(33,150,204,.12)` | Tint backgrounds and hover washes |
   | `--slate` | `#5A6B82` | Secondary text |
   | `--fog` | `#8494A8` | Muted labels and captions |
   | `--line` | `#DDE4EC` | Borders and dividers |
   | `--bg` / `--bg-alt` | `#F6F9FC` / `#EDF3F8` | Page and alternating section backgrounds |

   **Why there are two blues.** The logo blue `--blue` measures 3.33:1 against white, which fails the WCAG AA 4.5:1 threshold for normal text and only passes for large text. `--blue-dark` measures 4.72:1 and passes. So the logo blue stays decorative, and everything clickable or carrying white text uses `--blue-dark`. Both read as the same colour family to a visitor. Never put white text on `--blue`, and never use `--blue-dark` for decoration where `--blue` belongs.

   Brand assets live in `static/assets/brand/`. The header uses `fei_logo_secondary_notag.svg` (no tagline: it is illegible at 44px), the footer uses `fei_logo_mono_white.svg`, and `fei_icon_navy.svg` is the watermark behind card thumbnail numbers. The favicon set and `site.webmanifest` sit at the root of `static/` so they serve from the site root.
4. **No fees, prices or unverified figures anywhere on the site, with one scoped exception.** Any number that appears must be verifiable (course hours, days, Kydon's published track record).

   | Fees | May they appear |
   | --- | --- |
   | FEI's own commercial fees for the AOP courses and AIA workshops | **No, nowhere on the site.** They are not set, and they would not go on the site if they were. Enquiries route to `enquiry@futureedgeinstitute.com` and WhatsApp. |
   | Published subsidised fees for a partner delivered programme, on that programme's own page | **Yes.** They are already published by the partner under a government subsidy scheme, and funding is the first question that audience asks. |

   The exception is narrow and deliberate: it covers a fee somebody else has already published, on the page for that programme, and nowhere else. It does not open the door to FEI pricing. The OPC Launchpad is the only page it currently applies to, where `showFees` is on and the SCTP tiers are shown. Approved by David on 1 September 2026: see `docs/DECISIONS.md`. Wherever a subsidised fee appears, the funding scope note appears with it, which is a separate rule and not optional.
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
- **AI capability tags** (`aiTags`, blue pills) are separate from the segment tags and are not filterable. They appear only where the curriculum genuinely teaches AI: AOP 101 to 104, and both AIA workshops. AOP 105 and 106 must not carry them unless a curriculum revision introduces real AI content. Do not add tags to make the catalogue look uniform.
- HubSpot portal `2457674` is live and correct. GA4 and Meta Pixel IDs are placeholders until supplied.
- Conversion events already fire on: course enquiry clicks, course detail clicks, workshop detail clicks (tagged with the AIA code), WhatsApp clicks (tagged by placement), funding interest, corporate enquiry, and course outline opens. An enquiry click on an AIA card reports as `corporate_enquiry_click` with the workshop code, because that is what it is. Preserve these when editing; add matching events for any new call to action.

## Known pending items

Domain (canonical URLs currently use a placeholder), GA4 and Meta Pixel IDs, HubSpot form GUID, course and workshop images, and the faculty section (trainers not confirmed). A purpose made social share image at 1200 x 630 is still outstanding: `og:image` falls back to `assets/brand/fei_logo_primary_1200.png` on every page. The nine brochures in `static/assets/brochures/` still carry the retired orange and the old text wordmark, and the course image prompts still specify the old orange as the accent: both need regenerating against the new palette.

**`policies.html` now reads as final.** Every `[TO BE CONFIRMED]` marker has been cleared and the `.tbc` style that flagged them is gone, so the page no longer signals anywhere that a detail is unresolved. Do not treat a silence on that page as an oversight: check whether it is deliberate before filling it.

Its fees section states its own scope. It covers individuals enrolling in public intakes of Operator Series courses, and says that Adoption Series workshops are delivered in house, priced per engagement, and that cancellation, postponement and payment terms for a workshop are set out in the agreement signed for that engagement.

**So the site publishes no cancellation terms for the Adoption Series at all**, by design. The gap sits in the contract, not on the website: a standard corporate engagement agreement carrying those terms is an outstanding business document and not a website task. Do not resolve it by writing workshop cancellation terms into `policies.html`, which would publish commercial terms that have not been agreed.
