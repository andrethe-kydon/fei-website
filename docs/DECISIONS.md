# Decisions outstanding

Every value this site needs and does not yet have, grouped by what it blocks,
with the person who decides it.

Two rules for this file. A value that is not confirmed is **omitted from the
page** and recorded here: nothing ships with a placeholder, a marker or a
provisional figure standing in for it. And an item leaves this file only when
the decision is made, never because the page was written around it.

Owners beyond David are the best current attribution rather than a confirmed
assignment. Correct them in place.

Created 1 September 2026.

---

## Blocking: any fee appearing on the site

House rule 4 in `CLAUDE.md` is that no fee, price or unverified figure appears
anywhere on the site. Three items sit against it.

| Item | Decided by | Note |
| --- | --- | --- |
| Programme fees for the AOP courses | David | Six Operator courses. Until set, every summary card shows "Fees confirmed at enquiry", which is the built in empty state of `feeDisplay` and needs no change to ship. |
| Programme fees for the AIA workshops | David | Two Adoption workshops. Priced per engagement, so these may never appear on the site at all. |

Publishing subsidised SCTP fees on the OPC Launchpad page is **settled**: see
Decisions made, below. House rule 4 now carries its scope, so the two rows above
are the only fee questions still open.

## Blocking: publishing the OPC Launchpad page

The document ships with `published` set to false. Everything below is a value
marked CONFIRM in `opc-kit/OPC_FEI_Page_Content.md`, and each one is omitted
from the built page until it is settled.

| Item | Where | Decided by | Note |
| --- | --- | --- | --- |
| TGS code | Programme details | **Singapore Polytechnic**, awaiting issue | Genuinely unissued rather than unrecorded, so it is not ours to supply and not David's to decide. **The row is on the page carrying the value "To be confirmed", not omitted.** This is a deliberate exception to the rule that an unconfirmed value is left off: on a course funded under an SSG scheme, showing no TGS reference at all reads as a programme that is not registered, which is worse than showing one that is pending. Replace the value when SP issues the code. See the scoped rule in `CLAUDE.md`. |
| Whether the Startup SG Founder figure is reinstated | Partners, section 8 | David | The source page states graduates can access up to $50,000. It was removed: the amount is set by Enterprise Singapore rather than by us, the grant is not guaranteed, and a specific figure on a training page reads as a promise. Reinstate only on an explicit instruction. |
| Whether Kydon client names appear | Removed content | David | Korn Ferry, ResMed, Australian Volunteers, UWC South East Asia. These are Kydon's clients on a Future Edge Institute page. Only with each client's agreement, and only labelled as Kydon's. |
| Which HubSpot form, and whether the action is waitlist or enquiry | Enquiry, section 10 | David, with Kydon marketing for the form itself | Bound to the closed registration window above: the right call depends on whether there is a live intake to join. |
| Whether a Future Edge Institute version of the brochure is produced | Removed content | David | The current download is a Kydon branded PDF. Either an FEI version is made, or the page routes to enquiry with no download. |
| The fourteen FAQ answers | FAQ, section 9 | David | The kit describes the edits to make but carries none of the text: the source answers were never transcribed into it. Drafted fresh against the described changes and awaiting sign off, since the FAQ is the part of the page most likely to be challenged. |

## Blocking: two PDFs naming the old enquiry address

The site moved to `enquiry@futureedgeinstitute.com` on 1 September 2026. The nine
brochures were reissued and are done, see Decisions made. Two rendered PDFs are
left, and no field can reach them: the address is drawn into the document.

| Item | Decided by | Note |
| --- | --- | --- |
| The two OPC schedule PDFs | David, with Kydon for the workbook | Version 1, 1 September 2026, built by hand from the approved workbook. The overview names `sales@kydongrp.com` twice and the detailed schedule four times. **Version 2 copies exist and replacing the two Sanity file assets is with David.** Attach them and re-run `studio/scripts/load-opc-schedule-files.js`, then verify the text layer rather than the render. The page offers the day by day schedule by email as well as by download, so pulling the detailed PDF stays an option if reissuing it does not happen. |

## Blocking: live tracking and lead capture

| Item | Decided by | Note |
| --- | --- | --- |
| GA4 measurement ID | Kydon Group marketing | Placeholder in `siteSettings`. Every conversion event on the site is already wired and fires into nothing until this lands. |
| Meta Pixel ID | Kydon Group marketing | As above. |
| HubSpot form GUID | Kydon Group marketing | Portal 2457674 is live and correct. The GUID ships as `FORM_GUID_HERE`, which the build treats as unset: the programme directory falls back to an email route rather than showing a broken form. |

## Blocking: legal and corporate detail

| Item | Decided by | Note |
| --- | --- | --- |
| Registered office address | Kydon Group corporate secretarial | Does not appear anywhere on the site today. |
| Data Protection Officer appointment | Kydon Group corporate secretarial | `policies.html` directs data protection questions to the general enquiry address. A named officer is a PDPA requirement. |
| GST registration status | Kydon Group finance | `policies.html` states that Future Edge Institute is not currently registered for GST and that any change will be stated at enquiry. Confirm that remains true. **Note the apparent clash and do not resolve it by editing either page.** The OPC Launchpad page states that its fees include 9 percent GST. Both are correct: those are Singapore Polytechnic's SCTP fees, charged by Singapore Polytechnic, and FEI's own GST position is a separate fact about a separate seller. If the FEI position changes, this is the row that governs `policies.html`; the OPC figure follows Singapore Polytechnic. |
| Refund schedule | David | `policies.html` already publishes a schedule: full refund more than 14 days before the start date, 50 percent within 14 days, none on or after. This is therefore an **amendment to a published term**, not a blank waiting to be filled. Treat any change as a change of contract, not a gap. |

Note also that the site deliberately publishes **no** cancellation terms for the
Adoption Series. Those belong in the engagement agreement signed per client,
which is an outstanding business document rather than a website task. Do not
close that gap by writing terms into `policies.html`.

## Blocking: the faculty section

| Item | Decided by | Note |
| --- | --- | --- |
| Trainer names, roles and biographies | David | No trainer is confirmed. The build omits the entire trainer section when `trainers` is empty: no heading, no placeholder, no reserved space. Nothing to do until people are named. |

## Blocking: SSG Registered Training Provider registration

| Item | Decided by | Note |
| --- | --- | --- |
| Tier 2 skills mapping | Future Edge Institute curriculum lead | Required for the RTP filing. The delivery hour split declared on the six Operator course pages must match that filing exactly, so do not adjust those figures while this is open. |

---

## Scoping notes for CLAUDE.md

Neither of these is a decision. Both are recorded so that a future reader does
not mistake correct content for a rule violation and "fix" it.

**The ban on asynchronous hours is scoped to the RTP filing.** House rule 9
forbids describing any hours as asynchronous or self directed. That constraint
exists because the Operator series hour split must match what Future Edge
Institute files with SkillsFuture Singapore. It binds FEI's own courses. It does
not bind the OPC Launchpad, which is a Singapore Polytechnic delivered SCTP
programme, published by SP as full time classroom **and asynchronous e
learning**. Describing it accurately is required, not permitted.

**The certificate rule assumes Future Edge Institute is the issuer.** As written
it covers two cases: Operator courses award Certificates of Completion issued by
Future Edge Institute on assessed evidence, and Adoption workshops award a
digital certificate of participation from Future Edge Institute. On the OPC
Launchpad, **Singapore Polytechnic issues all eight certificates**, one per
module. The attribution paragraph on that page says so, and it is not editorial
prose to be shortened for style: it is what keeps the SCTP subsidy claims from
contradicting the SSG line carried on the eight short course pages.

---

## Decisions made

Kept rather than deleted, because a settled decision is the thing people
re-litigate. If one of these is reopened, it comes back to the list above.

| Decision | Made by | Date | What changed |
| --- | --- | --- | --- |
| Published subsidised SCTP fees may appear on the OPC Launchpad page | David | 1 September 2026 | House rule 4 in `CLAUDE.md` now carries its scope: a fee already published by a partner under a government subsidy scheme may appear on that programme's own page, and nowhere else. FEI's own commercial fees for the AOP courses and AIA workshops may not appear anywhere on the site, which is unchanged. `showFees` is on for this document, and the funding scope note renders with the figures. |
| Programme schedule, including the end date | Singapore Polytechnic | 1 September 2026 | SP approved the schedule, so the module dates are confirmed rather than provisional. The programme ends **1 March 2027**, which closes the row that was open under the OPC blockers: it is not stored anywhere, it is derived as the latest module date, so it cannot drift from the table it sits above. Hours are 580.5 taught plus 33.5 assessment, 614 in total, and are never published as a bare total. The two schedule PDFs are Version 1, 1 September 2026, built by hand from the approved workbook, which remains the source of truth for them. |
| Module titles follow the approved workbook | David | 1 September 2026 | **Seven** of the eight differed from the workbook the PDFs were built from, not four as first reported: only module 2 already matched. The page has moved to the workbook titles, since those are the ones Singapore Polytechnic approved, so the page and both downloads now name every module identically. The module number and title are joined with a middot rather than a colon, because six of the titles carry a colon of their own and the workbook uses a middot in the same place. |
| "Kydon Group" as the delivered by value | David | 1 September 2026 | The module `deliveredBy` field read "Kydon led", which was fine in the module list as "43.5 hours, Kydon led" but read oddly in a Delivered by column beside "Singapore Polytechnic". It now reads "Kydon Group", matching the PDFs, and works in both places. |
| Nine brochures reissued on the new address | David | 1 September 2026 | All nine in `static/assets/brochures/` now carry `enquiry@futureedgeinstitute.com`, at the same counts the old address had: three in each course and workshop brochure, two in the programme directory. **Verified in the text layer, not in a render.** An earlier attempt at this replacement painted over the old address and left it in the text layer, so it looked right on screen while copy and paste still produced the old address. The checker was itself validated by running it against the previous copies from git, where it reports the old address in all nine and exits non zero. Filenames are unchanged, so every brochure button still resolves and the eleven pages are byte identical. |
| Daily rebuild verified end to end | David | 1 September 2026 | `Daily rebuild` was run by hand from the Actions tab, came back green, and Vercel confirmed a deployment. The `VERCEL_DEPLOY_HOOK` secret is live and the schedule is active. Note the standing hazard recorded in `CLAUDE.md`: GitHub disables a scheduled workflow in a repository with no commit activity for 60 days, silently, and that is the one way this stops without an error. |
| Enquiry address moved to `enquiry@futureedgeinstitute.com` | David | 1 September 2026 | FEI routes to its own domain. Held in one field, `siteSettings.enquiryEmail`, and read everywhere: templates already did, and content prose now carries an `{{EMAIL}}` token that the build fills, so an address can no longer be typed into a CMS field and go stale. Eleven PDFs are outside that reach and are listed above as still open. |
| The Kydon references on the OPC page | David | 1 September 2026 | Audited, 24 sentences. The fifteen factual mentions of delivery, partnership and certification are untouched, because Kydon Group holds the SP partnership and SP issues the certificates. The service and asset mentions now name Kydon Group consistently and say what they are: "ecosystem" became "business network", "Kydon's" and "Kydon mentorship" became "Kydon Group's", and "Kydon led: modules 1, 5, 6, 7 and 8" became "Delivered by Kydon Group", matching the five module fields that already said so. The AI Marketplace answer keeps its substance, which was already the most careful wording on the page. Two things were dropped rather than reworded: the "100K+ learners on the Kydon platform" stat, a group figure for an unnamed platform standing beside three programme facts, and FAQ 14, which reintroduced the AOP comparison in detail and only existed because the positioning section did. The funding note and FAQ 7 keep their AOP mentions, which exist to say the subsidy does not apply. |
| The positioning section is removed from the OPC page | David | 1 September 2026 | The whole section went, lead paragraphs and the six row comparison table against the AI Operator Professional Series. The AOP courses are not sellable yet, and setting them beside an SCTP funded programme risks reading as though they are funded too. Removed as **content**, by clearing the `positioning` object on the document, not by deleting the renderer: the field and the section survive for FDO, and **this returns if and when AOP is sellable.** It had no section bar entry to remove, having been left out of the bar deliberately when the bar was built. |
| A group descriptor appears in every footer | David | 1 September 2026 | `siteSettings.groupDescriptor`, "Part of Kydon Group", beside the logo on all eleven pages, so a visitor meets the group relationship without hunting and a Kydon reference elsewhere reads as the same group. The about page carries the full statement naming Future Edge Institute Private Limited and Kydon Holdings Pte. Ltd. The homepage structured data already had a `parentOrganization`, but it named the brand; it now names the registered entity with Kydon Group as an `alternateName`. **Not in the header:** measured at 1080 there are 25px of vertical room, so it would be a third line crowding the lockup, and the nav links are a fixed 664px at their gap floor, so the horizontal gap falls to 41px by 901px. |
| Cohort size of 20 | David | 1 September 2026 | Twenty participants, not the thirty the source material carried. Published as a row in the programme details table rather than as a line in Who it is for, so it sits with the intake number, venue and delivery mode a candidate hunts for, and needs no field of its own. |
| Cohort 1 dates | David | 1 September 2026 | Starts 5 October 2026. Enrolment is open and closes 30 September 2026. The page reads as open for applications: the hero states both dates, the primary action reads "Enrol now, closes this month" while that is true, and the programme details table takes its date rows from the same two fields so they cannot drift. The earlier 6 September start, the 24 May to 16 August registration window and the Market Sensing Phase framing are gone. None of them had ever been loaded: all three were omitted as unconfirmed when the document was created. |
