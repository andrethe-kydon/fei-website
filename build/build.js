#!/usr/bin/env node
/**
 * FEI Website build script.
 *
 * Content source priority:
 *   1. Sanity Content Lake, when SANITY_PROJECT_ID (and optionally
 *      SANITY_DATASET, default "production") are set in the environment.
 *   2. content/content.json, the local fallback and development source.
 *
 * Output: dist/ (index.html, one page per course, styles.css, assets/)
 * Run: node build/build.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

/**
 * Social sharing images.
 *
 * Crawlers fetch og:image from their own servers, with no page context, so a
 * relative path is simply dropped and the link renders without a preview. Every
 * og:image on the site is therefore absolute, built from siteUrl.
 *
 * The site image is 1200 x 630 JPEG, matching the og:image:width, height and
 * type declared in the templates. WhatsApp in particular wants those before it
 * will render a large preview.
 */
const OG_SITE_IMAGE = "assets/og-image.jpg";
const siteOgImage = s => `${s.siteUrl}/${OG_SITE_IMAGE}`;

// ---------- content loading ----------
/**
 * Turn a Sanity image asset reference into a CDN URL.
 * Refs look like: image-<assetId>-<width>x<height>-<ext>
 * Returns null when there is no image, so the build falls back to
 * the local static path and then to the branded placeholder.
 */
function sanityImageUrl(img, projectId, dataset, width) {
  const ref = img && img.asset && img.asset._ref;
  if (!ref) return null;
  const [, assetId, dims, ext] = ref.split("-");
  if (!assetId || !dims || !ext) return null;
  const base = `https://cdn.sanity.io/images/${projectId}/${dataset}/${assetId}-${dims}.${ext}`;
  return width ? `${base}?w=${width}&auto=format&fit=crop` : base;
}

/**
 * The same image asset, cropped to the share ratio. A course banner is 16 by 5,
 * so it is requested at 1200 x 630 rather than passed through at its own size:
 * the width, height and type tags on the page then describe the file that is
 * actually served. Format is pinned to JPEG rather than left to auto, for the
 * same reason.
 */
function sanityOgImage(img, projectId, dataset) {
  const url = sanityImageUrl(img, projectId, dataset);
  return url ? `${url}?w=1200&h=630&fit=crop&fm=jpg` : null;
}

async function loadFromSanity(projectId, dataset) {
  // Trainers are references to person documents, so they are dereferenced in
  // the query and arrive in the same shape the local content file uses.
  const query = encodeURIComponent(`{
    "settings": *[_type == "siteSettings"][0],
    "courses": *[_type == "course"] | order(number asc){
      ...,
      "trainers": trainers[]->{name, role, bio, photo}
    },
    "team": *[_type == "person" && (!defined(showOnAbout) || showOnAbout == true)] | order(order asc, name asc)
  }`);
  const url = `https://${projectId}.api.sanity.io/v2024-01-01/data/query/${dataset}?query=${query}`;
  const headers = process.env.SANITY_READ_TOKEN
    ? { Authorization: `Bearer ${process.env.SANITY_READ_TOKEN}` }
    : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Sanity query failed: ${res.status}`);
  const { result } = await res.json();
  if (!result || !result.settings || !result.courses || !result.courses.length) {
    throw new Error("Sanity returned no content; is the dataset seeded?");
  }
  // Reshape Sanity docs into the internal content shape. Both series live in
  // the same document type and are split apart here, into courses (Operator)
  // and workshops (Adoption), so each renders through its own template. The
  // field mapping is shared: each series simply leaves the other's fields empty.
  const courses = {}, workshops = {};
  for (const c of result.courses) {
    const series = c.series || "Operator";
    const target = series === "Adoption" ? workshops : courses;
    target[String(c.number)] = {
      series,
      codePrefix: c.codePrefix || "AOP",
      number: c.number,
      slug: c.slug.current || c.slug,
      title: c.title, subtitle: c.subtitle, tag: c.tagline,
      metaDescription: c.metaDescription || "", tileCopy: c.tileCopy || "",
      hours: c.hours, days: c.days,
      contact: String(c.contactHours), il: String(c.instructorLedHours),
      pr: String(c.practicalHours), asmt: String(c.assessmentHours),
      brks: String(c.breakHours),
      tags: c.tags || [], aiTags: c.aiTags || [], audience: c.audience,
      feeDisplay: c.feeDisplay || "",
      intakes: (c.intakes || []).map(i => ({
        label: i.label, dates: i.dates, timing: i.timing, venue: i.venue,
        format: i.format || "Weekday", status: i.status || "Open",
      })),
      trainers: (c.trainers || []).map(t => ({
        name: t.name, role: t.role, bio: t.bio,
        photoUrl: sanityImageUrl(t.photo, projectId, dataset, 400),
      })),
      overview: c.overview || [], los: c.learningOutcomes || [],
      outline: (c.outline || []).map(d => [d.day, d.theme, d.content, String(d.hours)]),
      builds: c.builds || [],
      assess: (c.assessments || []).map(a => [a.mode, a.description]),
      related: (c.related || []).map(r => [r.number, r.why]),
      disclaim: c.disclaimer || null,
      thumbUrl: sanityImageUrl(c.thumbnail, projectId, dataset, 1200),
      bannerUrl: sanityImageUrl(c.banner, projectId, dataset, 1600),
      ogImageUrl: sanityOgImage(c.banner, projectId, dataset),
      // Adoption series fields. Empty on every Operator document.
      groupSize: c.groupSize || "",
      taughtHours: c.taughtHours || c.hours,
      deliverables: c.deliverables || [],
      sessions: (c.sessions || []).map(x => [x.when, x.theme, x.whatHappens]),
      methodNote: c.methodNote || "",
      certificateNote: c.certificateNote || "",
    };
  }
  // The team grid is optional: an empty result is a valid state, not a failure,
  // and renders no section at all.
  const team = (result.team || []).map(p => ({
    name: p.name, role: p.role, bio: p.bio || "",
    photoUrl: sanityImageUrl(p.photo, projectId, dataset, 600),
  }));
  return { settings: result.settings, courses, workshops, team };
}

function loadLocal() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "content/content.json"), "utf8"));
}

/**
 * Normalise either content source into the same shape: two collections, keyed
 * by number, with series and codePrefix always set. Content written before the
 * Adoption series existed carries neither field, so it defaults to Operator and
 * AOP and renders exactly as it did before.
 */
function splitSeries(content) {
  const courses = {}, workshops = {};
  const entries = [
    ...Object.entries(content.courses || {}),
    ...Object.entries(content.workshops || {}),
  ];
  for (const [n, c] of entries) {
    const doc = {
      ...c,
      series: c.series || "Operator",
      codePrefix: c.codePrefix || "AOP",
      // content.json keys by number without repeating it as a field; Sanity
      // supplies it. Setting it here means every document carries one, whichever
      // source it came from, so the catalogue can sort on it.
      number: Number(c.number ?? n),
    };
    (doc.series === "Adoption" ? workshops : courses)[n] = doc;
  }
  return { ...content, courses, workshops };
}

// ---------- rendering ----------
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fill(template, map) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) =>
    k in map ? map[k] : `{{${k}}}`);
}

function waLink(number, code) {
  const text = encodeURIComponent(
    code
      ? `Hi, I'd like to know more about ${code} at Future Edge Institute.`
      : "Hi, I'd like to know more about the programmes at Future Edge Institute.");
  return `https://wa.me/${number}?text=${text}`;
}

/**
 * AI capability tags as their own row. Returns "" when the course teaches no
 * AI, so nothing is emitted: no wrapper, no spacing. `after` is appended only
 * when there is something to show, to keep the generated markup tidy.
 */
function aiTagRow(aiTags, after = "") {
  if (!aiTags || !aiTags.length) return "";
  const pills = aiTags.map(t => `<span class="c-tag-ai">${t}</span>`).join("");
  return `<div class="c-tags-ai">${pills}</div>${after}`;
}

/**
 * One catalogue for both series: all eight programmes in a single grid, Operator
 * first and each series by number ascending.
 *
 * Everything that differs between the two is derived from the `series` field
 * rather than from a course number or a hardcoded list, so adding a programme to
 * either series cannot put the wrong card together. In particular an Adoption
 * card shows group size where an Operator card shows assessment modes: these
 * workshops make no assessment claim, and the meta bar must never imply one.
 */
function catalogueEntries(content) {
  const rank = c => (c.series === "Adoption" ? 1 : 0);
  return [
    ...Object.entries(content.courses),
    ...Object.entries(content.workshops),
  ].sort(([na, a], [nb, b]) => rank(a) - rank(b) || Number(na) - Number(nb));
}

function renderCourseCards(content) {
  const segMap = t => ({
    "Business Foundations": "foundations", "Foundations": "foundations",
    "Operations": "operations", "Marketing": "marketing", "Sales": "sales",
  }[t] || t.toLowerCase());
  let out = "";
  for (const [n, c] of catalogueEntries(content)) {
    const adoption = c.series === "Adoption";
    // The "ai" filter segment is derived from aiTags, never hardcoded, so the
    // filter and the blue capability tags can never disagree. The audience
    // segment is derived from series for the same reason.
    const segs = [
      ...c.tags.map(segMap),
      ...(c.aiTags && c.aiTags.length ? ["ai"] : []),
      adoption ? "organisations" : "individuals",
    ].join(" ");
    const tags = c.tags.map(t => `<span class="c-tag">${t}</span>`).join("");
    // Catalogue cards carry no takeaway list. Eight cards times three bullets was
    // a quarter of the homepage's text for content that is already on each
    // programme page, which the card's own buttons link to. `builds` and
    // `deliverables` are still rendered in full there.
    // Assessment modes on Operator cards only. An Adoption workshop shows who is
    // in the room instead, because it declares no assessment at all.
    const thirdMeta = adoption
      ? `<span>${c.groupSize}</span>`
      : `<span>${c.assess.map(a => a[0]).join(" · ")}</span>`;
    const hoursMeta = adoption
      ? `<span><b>${c.taughtHours}</b> taught hours</span>`
      : `<span><b>${c.hours}</b> hours</span>`;
    // AI capability tags: only the programmes that genuinely teach AI carry them,
    // and an empty list renders nothing at all, not an empty row.
    // In the catalogue the row is always present, even when a programme teaches
    // no AI, so every card reserves the same height for it and the titles below
    // stay on one line across a row. Empty is rendered as an empty row here,
    // never on the course and workshop pages, where nothing sits below it to
    // knock out of alignment.
    const aiRow = c.aiTags && c.aiTags.length
      ? aiTagRow(c.aiTags, "\n          ")
      : `<div class="c-tags-ai"></div>\n          `;
    const thumbSrc = c.thumbUrl || `assets/courses/${c.slug}.jpg`;
    const kind = adoption ? "workshop" : "course";
    out += `
      <article class="course-card reveal" data-seg="${segs}" data-series="${c.series}">
        <!-- Thumbnail: upload in Sanity, or drop assets/courses/${c.slug}.jpg (1200 x 750) -->
        <div class="c-thumb">
          <span class="ph-label">Thumbnail</span>
          <span class="ph-code">${n}</span>
          <img src="${thumbSrc}" alt="${c.codePrefix} ${n} ${kind} thumbnail" loading="lazy" onerror="this.remove()">
        </div>
        <div class="c-body">
          <div class="c-top">
            <span class="c-code">${c.codePrefix} ${n}</span>
            <span class="c-series">${c.series} Series</span>
            <div class="c-tags">${tags}</div>
          </div>
          <h3>${c.title}: ${c.subtitle}</h3>
          <p class="c-sub">${adoption ? (c.tileCopy || c.tag) : c.tag}</p>
          ${aiRow}<div class="c-meta">
            ${hoursMeta}<span><b>${c.days}</b> days</span>${thirdMeta}
          </div>
          <div class="c-foot"><a class="cf-primary" href="${c.slug}.html">Full ${kind} details</a><a href="#contact">Enquire</a></div>
        </div>
      </article>`;
  }
  return out;
}

/**
 * The cross sell block, rendered identically at the foot of every course page
 * and every workshop page. It lives here rather than in both templates so the
 * two series can never end up describing each other differently.
 */
function pathwayBlock() {
  return `<!-- ================= THE FULL PATHWAY ================= -->
<section class="cpage-section pathway-block">
  <div class="wrap">
    <div class="reveal" style="max-width:760px">
      <div class="section-head" style="margin-bottom:0"><h2 style="font-size:1.6rem">The full pathway</h2></div>
      <p style="margin-top:18px;color:var(--slate)">Organisations see the strongest results running the Adoption Series in sequence: AI for Leaders creates the mandate and the roadmap, AI at Work equips the teams who deliver it. Individuals who want to go further progress into The AI Operator Professional Series, where they build AI agents, knowledge bases and business automations of their own. The Adoption Series teaches organisations to use AI. The Operator Series teaches individuals to run it.</p>
      <div class="pathway-ctas">
        <a class="btn btn-solid" href="index.html#courses">See the Adoption Series</a>
        <a class="btn btn-ghost" href="index.html#courses">See the Operator Series</a>
      </div>
    </div>
  </div>
</section>

`;
}

/**
 * The brochure button. Present only when the PDF is actually on disk, so a
 * course or workshop without one never shows a link that leads nowhere, and it
 * opens the PDF straight away: no form, no gate.
 */
function brochureBtn(slug, label, cls) {
  if (!fs.existsSync(path.join(ROOT, "static/assets/brochures", `${slug}.pdf`))) return "";
  return `<a class="${cls} brochure-link" href="assets/brochures/${slug}.pdf" target="_blank" rel="noopener">${label}</a>`;
}

/**
 * The animated hero illustration.
 *
 * Inlined rather than referenced, because its animation is SMIL and a browser
 * ignores that when an SVG arrives through <img src>. The file on disk stays
 * the single source: it is read here at build time, never copied into a
 * template. Its animated elements carry .fei-motion, which the reduced motion
 * rule in styles.css hides, leaving the static composition.
 *
 * Absent file, absent column: the hero falls back to the single column it had
 * before, with no gap and no broken image.
 */
const HERO_ILLUSTRATION = "static/assets/brand/hero-illustration.svg";
const HERO_NARROW_VIEWBOX = "70 8 420 444";

function heroIllustration() {
  const file = path.join(ROOT, HERO_ILLUSTRATION);
  if (!fs.existsSync(file)) return "";
  const svg = fs.readFileSync(file, "utf8").trim();
  return `<div class="hero-art" aria-hidden="true">
${heroIllustrationCopy(svg, "wide")}
${heroIllustrationCopy(svg, "narrow")}
    </div>`;
}

/**
 * One of the two copies of the illustration. Both ship; a media query shows one.
 * That costs about 7KB of duplicated inline markup and buys a crop that needs no
 * script, on an element that is decorative.
 *
 * The narrow copy is cropped to the central column, and has its accessible name
 * stripped: one diagram should not be described twice, and the wrapper is
 * aria-hidden regardless.
 *
 * Its ids are also namespaced, which is not cosmetic. The animation elements
 * address their targets by href, as in `<animate href="#feiA1">`, and a
 * duplicated id resolves to the first match in the document. Without the
 * suffix, the narrow copy's eight animations would drive the wide copy's nodes,
 * so the phone would show a diagram with those parts frozen while the hidden
 * copy animated twice.
 */
function heroIllustrationCopy(svg, variant) {
  let out = svg.replace(/^<svg\b/, `<svg class="hero-art-${variant}" aria-hidden="true"`);
  if (variant !== "narrow") return out;
  return out
    .replace(/viewBox="[^"]*"/, `viewBox="${HERO_NARROW_VIEWBOX}"`)
    .replace(/\s*role="img"/, "")
    .replace(/\s*aria-label="[^"]*"/, "")
    .replace(/<title>[\s\S]*?<\/title>\s*/, "")
    .replace(/id="([^"]+)"/g, 'id="$1-n"')
    .replace(/href="#([^"]+)"/g, 'href="#$1-n"')
    .replace(/url\(#([^)]+)\)/g, "url(#$1-n)");
}

/**
 * The programme directory: one PDF covering all eight programmes, offered from
 * the homepage hero.
 *
 * Gated on the file being on disk exactly as the brochures are, so the link is
 * never dead. Unlike a brochure it is not handed over directly. A brochure is
 * for reading and carries no gate; the directory is a lead capture asset, so
 * the link opens a dialog: the HubSpot form when a real form GUID is
 * configured, and an email fallback carrying the subject line when it is not.
 * `hubspotFormGuid` ships as the placeholder FORM_GUID_HERE, which is not a
 * form, so it counts as unset here.
 */
const DIRECTORY_PDF = "assets/brochures/programme-directory.pdf";
const hasDirectory = () => fs.existsSync(path.join(ROOT, "static", DIRECTORY_PDF));
const hasHubspotForm = s => Boolean(s.hubspotFormGuid) && s.hubspotFormGuid !== "FORM_GUID_HERE";

function directoryLink() {
  if (!hasDirectory()) return "";
  return `<button class="hero-directory" id="directory-open" type="button" aria-haspopup="dialog">Download the programme directory</button>`;
}

function directoryModal(s) {
  if (!hasDirectory()) return "";
  const subject = encodeURIComponent("Programme directory request");
  const body = hasHubspotForm(s)
    ? `      <div id="directory-form" data-region="${s.hubspotFormRegion}" data-portal="${s.hubspotPortalId}" data-form="${s.hubspotFormGuid}"></div>
      <p class="modal-note" id="directory-ready" hidden>Thank you. <a href="${DIRECTORY_PDF}" target="_blank" rel="noopener">Open the programme directory</a>.</p>`
    : `      <p class="modal-note">Email us and the directory comes back with our reply, usually within one working day.</p>
      <a class="btn btn-solid" href="mailto:${s.enquiryEmail}?subject=${subject}">Email ${s.enquiryEmail}</a>`;
  return `
<!-- ================= PROGRAMME DIRECTORY ================= -->
<dialog class="modal" id="directory-modal" aria-labelledby="directory-title">
  <form method="dialog" class="modal-dismiss">
    <button class="modal-close" aria-label="Close">&times;</button>
  </form>
  <h2 id="directory-title">The programme directory</h2>
  <p>All eight programmes in one document: what each one covers, who it is for, the hours, and what you leave with.</p>
${body}
</dialog>
`;
}

/**
 * Intake cards. An empty schedule is stated plainly rather than hidden: a
 * missing section reads worse than an acknowledged one.
 * Filter tabs are deliberately not built yet, because there is nothing to
 * filter; the thresholds below decide when they become worth building.
 */
function renderIntakes(intakes, code) {
  if (!intakes.length) {
    return `<div class="intake-empty">
        <p>Intake dates for this course are confirmed at enquiry. We run small cohorts and schedule them around confirmed demand, so tell us which course you are interested in and we will come back with the next available dates, including weekday and weekend options.</p>
        <a class="btn btn-solid" href="#enquire">Ask about the next intake</a>
      </div>`;
  }
  const months = new Set(intakes.map(i => String(i.dates).replace(/[^A-Za-z]/g, " ").trim()));
  const needsFormatTabs = intakes.length > 4;
  const needsMonthTabs = months.size > 1;
  const cards = intakes.map(i => {
    const closed = i.status === "Closed";
    const pillClass = i.status === "Filling fast" ? "intake-pill hot" : "intake-pill";
    return `<article class="intake-card${closed ? " closed" : ""}">
        <div class="intake-top">
          <span class="${pillClass}">${i.format}</span>
          <span class="intake-status">${i.status}</span>
        </div>
        <h3>${i.label}</h3>
        <dl class="intake-rows">
          <div><dt>Dates</dt><dd>${i.dates}</dd></div>
          <div><dt>Timing</dt><dd>${i.timing}</dd></div>
          <div><dt>Venue</dt><dd>${i.venue}</dd></div>
        </dl>
        ${closed ? "" : `<a class="intake-link" href="#enquire">Enquire about this intake</a>`}
      </article>`;
  }).join("");
  const tabs = [
    needsFormatTabs ? `<!-- format filter tabs belong here once there are more than four intakes -->` : "",
    needsMonthTabs ? `<!-- month tabs belong here once intakes span more than one month -->` : "",
  ].filter(Boolean).join("\n      ");
  return `${tabs}\n      <div class="intake-grid">${cards}</div>`;
}

/** The people who appear in the team grid, in the order they render. */
function teamPeople(team) {
  return (team || []).filter(p => p && p.name);
}

/**
 * The homepage line pointing at the team grid. It is gated on the same list the
 * grid is built from: with no person published there is no team section, so no
 * #team anchor, and the link would land at the top of the about page instead.
 */
function teamLink(team) {
  if (!teamPeople(team).length) return "";
  return `<p class="aud-team reveal"><a href="about.html#team">Meet the team behind Future Edge Institute</a></p>`;
}

/**
 * Initials for a photo placeholder: at most two, from the first and last word
 * of the name.
 */
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (parts[0][0] + last).toUpperCase();
}

/**
 * The team grid on the about page, or nothing at all when no person is
 * published: no heading, no empty grid, no reserved space, exactly as the
 * trainer section behaves on a programme page.
 *
 * A person without a photo gets the branded placeholder the course thumbnails
 * use, carrying their initials where a course carries its number. The initials
 * are always rendered underneath the image, so a broken CDN URL falls back to
 * them rather than to an empty box.
 */
function renderTeam(team) {
  const people = teamPeople(team);
  if (!people.length) return "";
  const cards = people.map(p => `
      <article class="person-card reveal">
        <div class="person-photo">
          <span class="ph-initials">${esc(initials(p.name))}</span>
          ${p.photoUrl ? `<img src="${p.photoUrl}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()">` : ""}
        </div>
        <h3>${p.name}</h3>
        <p class="person-role">${p.role}</p>
        ${p.bio ? `<p class="person-bio">${p.bio}</p>` : ""}
      </article>`).join("");
  return `
<!-- ================= TEAM ================= -->
<section class="section team" id="team">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">The Team</span>
      <h2>Who you learn from</h2>
      <p>The people who designed the programmes and stand in front of the room.</p>
    </div>
    <div class="person-grid">${cards}
    </div>
  </div>
</section>
`;
}

/** Trainer cards, or nothing at all when no trainer is confirmed. */
function renderTrainers(trainers) {
  if (!trainers.length) return "";
  const cards = trainers.map(t => `<article class="trainer-card">
        <div class="trainer-photo">
          <span class="ph-label">Photo</span>
          ${t.photoUrl ? `<img src="${t.photoUrl}" alt="${esc(t.name)}" loading="lazy" onerror="this.remove()">` : ""}
        </div>
        <div>
          <h3>${t.name}</h3>
          <p class="trainer-role">${t.role}</p>
          <p>${t.bio}</p>
        </div>
      </article>`).join("");
  return `<section class="cpage-section" id="trainer">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">Your Trainer</span>
      <h2 style="font-size:1.6rem">Who is in the room</h2>
    </div>
    <div class="trainer-grid reveal">${cards}</div>
  </div>
</section>

`;
}

function renderCoursePage(template, n, c, content, s) {
  const code = `${c.codePrefix} ${n}`;
  const fullTitle = `${c.title}: ${c.subtitle}`;
  const canonical = `${s.siteUrl}/${c.slug}.html`;
  const schemaCourse = JSON.stringify({
    "@context": "https://schema.org", "@type": "Course",
    courseCode: code, name: fullTitle, description: c.tag,
    timeRequired: `PT${c.hours}H`,
    coursePrerequisites: "None. Basic computer literacy and a personal laptop.",
    educationalCredentialAwarded: "Certificate of Completion issued by Future Edge Institute",
    teaches: c.los,
    provider: {
      "@type": "EducationalOrganization", name: "Future Edge Institute Private Limited",
      identifier: { "@type": "PropertyValue", name: "UEN", value: "202634510R" },
      parentOrganization: { "@type": "Organization", name: "Kydon Group" }
    },
    url: canonical,
  });
  const schemaCrumb = JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${s.siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Programmes", item: `${s.siteUrl}/#courses` },
      { "@type": "ListItem", position: 3, name: fullTitle, item: canonical }],
  });
  const relCards = c.related.map(([rn, why]) => {
    const rc = content.courses[String(rn)];
    return `<a class="rel-card" href="${rc.slug}.html">
        <small>${rc.codePrefix} ${rn} · ${why}</small>
        <h4>${rc.title}: ${rc.subtitle}</h4>
        <p>${rc.hours} hours · ${rc.days} days</p>
      </a>`;
  }).join("");
  return fill(template, {
    CODE: code, NUM: String(n), SLUG: c.slug,
    TITLE: c.title, SUBTITLE: c.subtitle, FULL_TITLE: fullTitle,
    TAGLINE: c.tag, TAG_ESC: esc(c.tag), CANONICAL: canonical,
    GA4_ID: s.ga4Id, META_PIXEL_ID: s.metaPixelId, HS_PORTAL: s.hubspotPortalId,
    SCHEMA_COURSE: schemaCourse, SCHEMA_CRUMB: schemaCrumb,
    WA_LINK: waLink(s.whatsappNumber, code),
    EMAIL: s.enquiryEmail,
    MAIL_SUBJECT: encodeURIComponent(`Enquiry: ${code} ${c.title}`),
    TAGS: c.tags.map(t => `<span class="c-tag">${t}</span>`).join(""),
    AI_TAGS: aiTagRow(c.aiTags),
    HOURS: String(c.hours), DAYS: String(c.days),
    ASSESS_MODES: c.assess.map(a => a[0]).join(" + "),
    OVERVIEW: c.overview.map(p => `<p>${p}</p>`).join(""),
    AUDIENCE: c.audience,
    LO_ITEMS: c.los.map(lo => `<li>${lo}</li>`).join(""),
    OUTLINE_ROWS: c.outline.map(([d, t, txt, hrs]) =>
      `<tr><td class="d">${d}</td><td class="t">${t}</td><td>${txt}</td><td class="hrs">${hrs} hrs</td></tr>`).join(""),
    CONTACT: c.contact, IL: c.il, PR: c.pr, ASMT: c.asmt, BRKS: c.brks,
    BUILD_ITEMS: c.builds.map(b => `<li>${b}</li>`).join(""),
    ASSESS_CARDS: c.assess.map(([a, p]) =>
      `<div class="assess-card"><h4>${a}</h4><p>${p}</p></div>`).join(""),
    RTP_STATEMENT: s.rtpStatement,
    DISCLAIM: c.disclaim ? `<p class="disclaim">${c.disclaim}</p>` : "",
    REL_CARDS: relCards,
    FEE_DISPLAY: c.feeDisplay || "Fees confirmed at enquiry",
    BROCHURE_BTN: brochureBtn(c.slug, "Read the course brochure", "sc-btn sc-btn-ghost"),
    INTAKES: renderIntakes(c.intakes || [], code),
    TRAINER_SECTION: renderTrainers(c.trainers || []),
    PATHWAY_BLOCK: pathwayBlock(),
    BANNER_SRC: c.bannerUrl || `assets/courses/${c.slug}.jpg`,
    // The banner path may not exist yet: in the page the placeholder shows
    // instead, but a scraper has no such fallback, so og:image points at the
    // logo until a purpose made share image exists.
    OG_IMAGE: c.ogImageUrl || siteOgImage(s),
  });
}

/**
 * Adoption series workshop page. A sibling of renderCoursePage, not a branch
 * inside it: these workshops declare no assessment, no pass threshold and no
 * delivery hour split, so the template has nowhere to put one and this function
 * never supplies one.
 */
function renderWorkshopPage(template, n, w, s) {
  const code = `${w.codePrefix} ${n}`;
  const fullTitle = `${w.title}: ${w.subtitle}`;
  const canonical = `${s.siteUrl}/${w.slug}.html`;
  const desc = w.metaDescription || w.tag;
  const credential = "Digital certificate of participation issued by Future Edge Institute";
  // No `teaches` property: these workshops publish deliverables and a method,
  // not assessed learning outcomes, so there is nothing to claim there.
  const schemaCourse = JSON.stringify({
    "@context": "https://schema.org", "@type": "Course",
    courseCode: code, name: fullTitle, description: w.tag,
    timeRequired: `PT${w.taughtHours}H`,
    educationalCredentialAwarded: credential,
    provider: {
      "@type": "EducationalOrganization", name: "Future Edge Institute Private Limited",
      identifier: { "@type": "PropertyValue", name: "UEN", value: "202634510R" },
      parentOrganization: { "@type": "Organization", name: "Kydon Group" }
    },
    url: canonical,
  });
  const schemaCrumb = JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${s.siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Programmes", item: `${s.siteUrl}/#courses` },
      { "@type": "ListItem", position: 3, name: fullTitle, item: canonical }],
  });

  return fill(template, {
    CODE: code, NUM: String(n), SLUG: w.slug,
    TITLE: w.title, SUBTITLE: w.subtitle, FULL_TITLE: fullTitle,
    LEAD: w.tag, META_DESC: esc(desc), CANONICAL: canonical,
    GA4_ID: s.ga4Id, META_PIXEL_ID: s.metaPixelId, HS_PORTAL: s.hubspotPortalId,
    SCHEMA_COURSE: schemaCourse, SCHEMA_CRUMB: schemaCrumb,
    WA_LINK: waLink(s.whatsappNumber, code),
    EMAIL: s.enquiryEmail,
    MAIL_SUBJECT: encodeURIComponent(`Enquiry: ${code} ${w.title}`),
    TAGS: (w.tags || []).map(t => `<span class="c-tag">${t}</span>`).join(""),
    AI_TAGS: aiTagRow(w.aiTags),
    DAYS: String(w.days), TAUGHT_HOURS: String(w.taughtHours),
    GROUP_SIZE: w.groupSize,
    AUDIENCE: w.audience,
    OVERVIEW: (w.overview || []).map(p => `<p>${p}</p>`).join(""),
    DELIVERABLE_ITEMS: (w.deliverables || []).map(d => `<li>${d}</li>`).join(""),
    SESSION_ROWS: (w.sessions || []).map(([when, theme, what]) =>
      `<tr><td class="d">${when}</td><td class="t">${theme}</td><td>${what}</td></tr>`).join(""),
    METHOD_NOTE: w.methodNote,
    CERT_NOTE: w.certificateNote,
    BROCHURE_BTN: brochureBtn(w.slug, "Download the brochure", "sc-btn sc-btn-ghost"),
    BROCHURE_HERO_BTN: brochureBtn(w.slug, "Download the brochure", "btn btn-ghost"),
    PATHWAY_BLOCK: pathwayBlock(),
    BANNER_SRC: w.bannerUrl || `assets/courses/${w.slug}.jpg`,
    OG_IMAGE: w.ogImageUrl || siteOgImage(s),
  });
}

/**
 * Legal and policies page. The document body lives in content/policies.html
 * so the prose stays out of the build script; it is injected first so that
 * tokens used inside it are filled along with the template's own.
 */
function renderPoliciesPage(template, body, s, updated) {
  const withBody = template.replace("{{POLICY_BODY}}", () => body);
  return fill(withBody, {
    SITE_URL: s.siteUrl,
    EMAIL: s.enquiryEmail,
    WA_LINK: waLink(s.whatsappNumber),
    GA4_ID: s.ga4Id, META_PIXEL_ID: s.metaPixelId, HS_PORTAL: s.hubspotPortalId,
    RTP_STATEMENT: s.rtpStatement,
    UPDATED: updated,
  });
}

/**
 * About page. Story and market context live here, not on the homepage.
 * Static content, so this only fills the shared tracking and contact tokens.
 */
function renderAboutPage(template, s, team) {
  return fill(template, {
    TEAM_SECTION: renderTeam(team),
    SITE_URL: s.siteUrl,
    EMAIL: s.enquiryEmail,
    WA_LINK: waLink(s.whatsappNumber),
    GA4_ID: s.ga4Id, META_PIXEL_ID: s.metaPixelId, HS_PORTAL: s.hubspotPortalId,
  });
}

/** Build date as "31 July 2026". */
function formatUpdated(d) {
  return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "long" })} ${d.getFullYear()}`;
}

// ---------- main ----------
(async () => {
  let content, source;
  const pid = process.env.SANITY_PROJECT_ID;
  if (pid) {
    try {
      content = await loadFromSanity(pid, process.env.SANITY_DATASET || "production");
      source = `Sanity (${pid})`;
    } catch (e) {
      console.warn(`WARN: ${e.message}. Falling back to content.json.`);
    }
  }
  if (!content) { content = loadLocal(); source = "content/content.json"; }
  content = splitSeries(content);
  const s = content.settings;
  // A series with no documents is not a build failure, but it does leave a
  // section heading standing over an empty grid, so say so loudly. The usual
  // cause is Sanity content that predates the series field being populated.
  for (const [name, coll] of [["Operator", content.courses], ["Adoption", content.workshops]]) {
    if (!Object.keys(coll).length) {
      console.warn(`WARN: no ${name} series documents in ${source}. Pages and homepage cards for that series will be missing.`);
    }
  }

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.cpSync(path.join(ROOT, "static"), DIST, { recursive: true });

  // index
  const idxTpl = fs.readFileSync(path.join(ROOT, "templates/index.template.html"), "utf8");
  const idx = fill(idxTpl, {
    COURSE_CARDS: renderCourseCards(content),
    TEAM_LINK: teamLink(content.team),
    HERO_ILLUSTRATION: heroIllustration(),
    DIRECTORY_LINK: directoryLink(),
    DIRECTORY_MODAL: directoryModal(s),
    WHATSAPP: s.whatsappNumber, GA4_ID: s.ga4Id, META_PIXEL_ID: s.metaPixelId,
    HS_PORTAL: s.hubspotPortalId, HS_FORM_GUID: s.hubspotFormGuid,
    HS_REGION: s.hubspotFormRegion, EMAIL: s.enquiryEmail, SITE_URL: s.siteUrl,
  });
  fs.writeFileSync(path.join(DIST, "index.html"), idx);

  // course pages: the assessed Operator series
  const cTpl = fs.readFileSync(path.join(ROOT, "templates/course.template.html"), "utf8");
  for (const [n, c] of Object.entries(content.courses)) {
    fs.writeFileSync(path.join(DIST, `${c.slug}.html`),
      renderCoursePage(cTpl, n, c, content, s));
  }

  // workshop pages: the participation based Adoption series
  const wTpl = fs.readFileSync(path.join(ROOT, "templates/workshop.template.html"), "utf8");
  for (const [n, w] of Object.entries(content.workshops)) {
    fs.writeFileSync(path.join(DIST, `${w.slug}.html`),
      renderWorkshopPage(wTpl, n, w, s));
  }

  // about
  const aTpl = fs.readFileSync(path.join(ROOT, "templates/about.template.html"), "utf8");
  fs.writeFileSync(path.join(DIST, "about.html"), renderAboutPage(aTpl, s, content.team));

  // policies
  const pTpl = fs.readFileSync(path.join(ROOT, "templates/policies.template.html"), "utf8");
  const pBody = fs.readFileSync(path.join(ROOT, "content/policies.html"), "utf8");
  fs.writeFileSync(path.join(DIST, "policies.html"),
    renderPoliciesPage(pTpl, pBody, s, formatUpdated(new Date())));

  // sitemap
  const pages = ["",
    ...Object.values(content.courses).map(c => `${c.slug}.html`),
    ...Object.values(content.workshops).map(w => `${w.slug}.html`),
    "about.html", "policies.html"];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages.map(p => `  <url><loc>${s.siteUrl}/${p}</loc></url>`).join("\n") + "\n</urlset>\n";
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap);
  fs.writeFileSync(path.join(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${s.siteUrl}/sitemap.xml\n`);

  console.log(`Built ${pages.length} pages to dist/ from ${source}`);
})();
