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
| Whether published SCTP fees may appear on the OPC Launchpad page | David | The five fee tiers are already published by Singapore Polytechnic under a government subsidy scheme. See the scope amendment below: this is a rule change, not an exception, and `CLAUDE.md` must record it before the page publishes. |

**The `CLAUDE.md` amendment this requires.** Rule 4 currently reads as an
absolute. It needs to distinguish two cases: published subsidised fees for a
programme delivered by a partner under a government scheme may appear, because
they are already public and funding is the first question the audience asks;
Future Edge Institute's own commercial fees may not. Without that wording the
OPC page reads as a violation of the house rules rather than a scoped exception
to them.

## Blocking: publishing the OPC Launchpad page

The document ships with `published` set to false. Everything below is a value
marked CONFIRM in `opc-kit/OPC_FEI_Page_Content.md`, and each one is omitted
from the built page until it is settled.

| Item | Where | Decided by | Note |
| --- | --- | --- | --- |
| Cohort status, and whether "Market Sensing Phase" still applies | Hero eyebrow, section 1 | David | The eyebrow currently reads Cohort 1, September 2026. |
| Intake month and venue | The five months, section 4 | David | Stated as September 2026 at Singapore Polytechnic. |
| Cohort size of 30 | Who it is for, section 6 | David | |
| TGS code | Course information, section 7 | Singapore Polytechnic | The source itself says "to be confirmed", so this is genuinely unissued rather than merely unrecorded. |
| Course duration, 6 September 2026 to 4 March 2027 | Course information, section 7 | Singapore Polytechnic | |
| Registration period, 24 May 2026 to 16 August 2026 | Course information, section 7 | David | This window has already closed. Publishing it unchanged would advertise a shut door. |
| Whether the Startup SG Founder figure is reinstated | Partners, section 8 | David | The source page states graduates can access up to $50,000. It was removed: the amount is set by Enterprise Singapore rather than by us, the grant is not guaranteed, and a specific figure on a training page reads as a promise. Reinstate only on an explicit instruction. |
| Whether Kydon client names appear | Removed content | David | Korn Ferry, ResMed, Australian Volunteers, UWC South East Asia. These are Kydon's clients on a Future Edge Institute page. Only with each client's agreement, and only labelled as Kydon's. |
| Which HubSpot form, and whether the action is waitlist or enquiry | Enquiry, section 10 | David, with Kydon marketing for the form itself | Bound to the closed registration window above: the right call depends on whether there is a live intake to join. |
| Whether a Future Edge Institute version of the brochure is produced | Removed content | David | The current download is a Kydon branded PDF. Either an FEI version is made, or the page routes to enquiry with no download. |
| The fourteen FAQ answers | FAQ, section 9 | David | The kit describes the edits to make but carries none of the text: the source answers were never transcribed into it. Drafted fresh against the described changes and awaiting sign off, since the FAQ is the part of the page most likely to be challenged. |

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
