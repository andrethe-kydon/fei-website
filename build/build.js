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

async function loadFromSanity(projectId, dataset) {
  const query = encodeURIComponent(`{
    "settings": *[_type == "siteSettings"][0],
    "courses": *[_type == "course"] | order(number asc)
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
  // Reshape Sanity docs into the internal content shape
  const courses = {};
  for (const c of result.courses) {
    courses[String(c.number)] = {
      slug: c.slug.current || c.slug,
      title: c.title, subtitle: c.subtitle, tag: c.tagline,
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
    };
  }
  return { settings: result.settings, courses };
}

function loadLocal() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "content/content.json"), "utf8"));
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
      : "Hi, I'd like to know more about the AOP courses.");
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

function renderCourseCards(content) {
  const segMap = t => ({
    "Business Foundations": "foundations", "Foundations": "foundations",
    "Operations": "operations", "Marketing": "marketing", "Sales": "sales",
  }[t] || t.toLowerCase());
  let out = "";
  for (const [n, c] of Object.entries(content.courses)) {
    // The "ai" filter segment is derived from aiTags, never hardcoded, so the
    // filter and the orange capability tags can never disagree.
    const segs = [...c.tags.map(segMap), ...(c.aiTags && c.aiTags.length ? ["ai"] : [])].join(" ");
    const tags = c.tags.map(t => `<span class="c-tag">${t}</span>`).join("");
    const takes = c.builds.map(b => `<li>${b}</li>`).join("\n            ");
    const modes = c.assess.map(a => a[0]).join(" · ");
    // AI capability tags: only the courses that genuinely teach AI carry them,
    // and an empty list renders nothing at all, not an empty row.
    const aiRow = aiTagRow(c.aiTags, "\n          ");
    const thumbSrc = c.thumbUrl || `assets/courses/${c.slug}.jpg`;
    out += `
      <article class="course-card reveal" data-seg="${segs}">
        <!-- Thumbnail: upload in Sanity, or drop assets/courses/${c.slug}.jpg (1200 x 750) -->
        <div class="c-thumb">
          <span class="ph-label">Thumbnail</span>
          <span class="ph-code">${n}</span>
          <img src="${thumbSrc}" alt="AOP ${n} course thumbnail" loading="lazy" onerror="this.remove()">
        </div>
        <div class="c-body">
          <div class="c-top">
            <span class="c-code">AOP ${n}</span>
            <div class="c-tags">${tags}</div>
          </div>
          <h3>${c.title}: ${c.subtitle}</h3>
          <p class="c-sub">${c.tag}</p>
          ${aiRow}<div class="c-meta">
            <span><b>${c.hours}</b> hours</span><span><b>${c.days}</b> days</span><span>${modes}</span>
          </div>
          <ul class="c-take">
            ${takes}
          </ul>
          <div class="c-foot"><a class="cf-primary" href="${c.slug}.html">Full course details</a><a href="#contact">Enquire</a></div>
        </div>
      </article>`;
  }
  return out;
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
  const code = `AOP ${n}`;
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
      { "@type": "ListItem", position: 2, name: "Courses", item: `${s.siteUrl}/#courses` },
      { "@type": "ListItem", position: 3, name: fullTitle, item: canonical }],
  });
  const relCards = c.related.map(([rn, why]) => {
    const rc = content.courses[String(rn)];
    return `<a class="rel-card" href="${rc.slug}.html">
        <small>AOP ${rn} · ${why}</small>
        <h4>${rc.title}: ${rc.subtitle}</h4>
        <p>${rc.hours} hours · ${rc.days} days</p>
      </a>`;
  }).join("");
  // The brochure button appears only when the file is actually on disk, so a
  // course without a brochure never shows a link that leads nowhere. It opens
  // the PDF straight away: no form, no gate.
  const hasBrochure = fs.existsSync(path.join(ROOT, "static/assets/brochures", `${c.slug}.pdf`));
  const brochureBtn = hasBrochure
    ? `<a class="sc-btn sc-btn-ghost" id="brochure-btn" href="assets/brochures/${c.slug}.pdf" target="_blank" rel="noopener">Read the course brochure</a>`
    : "";

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
    BROCHURE_BTN: brochureBtn,
    INTAKES: renderIntakes(c.intakes || [], code),
    TRAINER_SECTION: renderTrainers(c.trainers || []),
    BANNER_SRC: c.bannerUrl || `assets/courses/${c.slug}.jpg`,
    OG_IMAGE: c.bannerUrl || `assets/courses/${c.slug}.jpg`,
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
function renderAboutPage(template, s) {
  return fill(template, {
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
  const s = content.settings;

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.cpSync(path.join(ROOT, "static"), DIST, { recursive: true });

  // index
  const idxTpl = fs.readFileSync(path.join(ROOT, "templates/index.template.html"), "utf8");
  const idx = fill(idxTpl, {
    COURSE_CARDS: renderCourseCards(content),
    WHATSAPP: s.whatsappNumber, GA4_ID: s.ga4Id, META_PIXEL_ID: s.metaPixelId,
    HS_PORTAL: s.hubspotPortalId, HS_FORM_GUID: s.hubspotFormGuid,
    HS_REGION: s.hubspotFormRegion, EMAIL: s.enquiryEmail, SITE_URL: s.siteUrl,
  });
  fs.writeFileSync(path.join(DIST, "index.html"), idx);

  // course pages
  const cTpl = fs.readFileSync(path.join(ROOT, "templates/course.template.html"), "utf8");
  for (const [n, c] of Object.entries(content.courses)) {
    fs.writeFileSync(path.join(DIST, `${c.slug}.html`),
      renderCoursePage(cTpl, n, c, content, s));
  }

  // about
  const aTpl = fs.readFileSync(path.join(ROOT, "templates/about.template.html"), "utf8");
  fs.writeFileSync(path.join(DIST, "about.html"), renderAboutPage(aTpl, s));

  // policies
  const pTpl = fs.readFileSync(path.join(ROOT, "templates/policies.template.html"), "utf8");
  const pBody = fs.readFileSync(path.join(ROOT, "content/policies.html"), "utf8");
  fs.writeFileSync(path.join(DIST, "policies.html"),
    renderPoliciesPage(pTpl, pBody, s, formatUpdated(new Date())));

  // sitemap
  const pages = ["", ...Object.values(content.courses).map(c => `${c.slug}.html`),
    "about.html", "policies.html"];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages.map(p => `  <url><loc>${s.siteUrl}/${p}</loc></url>`).join("\n") + "\n</urlset>\n";
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap);
  fs.writeFileSync(path.join(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${s.siteUrl}/sitemap.xml\n`);

  console.log(`Built ${pages.length} pages to dist/ from ${source}`);
})();
