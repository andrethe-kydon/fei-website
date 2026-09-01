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
function sanityImageUrl(img, projectId, dataset, opts) {
  const ref = img && img.asset && img.asset._ref;
  if (!ref) return null;
  const [, assetId, dims, ext] = ref.split("-");
  if (!assetId || !dims || !ext) return null;
  const base = `https://cdn.sanity.io/images/${projectId}/${dataset}/${assetId}-${dims}.${ext}`;
  // The fourth argument was a width and still may be. It is now also an options
  // object, {w, h}, so one function serves both the single sized course images
  // and the page photography, which needs a height to crop to a ratio and a
  // rung for every srcset width. There is deliberately no second URL builder:
  // everything that makes a Sanity CDN URL goes through here.
  const o = typeof opts === "number" ? { w: opts } : (opts || {});
  if (!o.w && !o.h) return base;
  const q = [];
  if (o.w) q.push(`w=${Math.round(o.w)}`);
  if (o.h) q.push(`h=${Math.round(o.h)}`);
  // The focal point, and only when an editor has actually set one. A figure
  // with no hotspot keeps the centred crop it has always had, which is what
  // holds the course banners and thumbnails already published byte identical.
  const hs = img.hotspot;
  if (hs && typeof hs.x === "number" && typeof hs.y === "number") {
    q.push(`fp-x=${+hs.x.toFixed(4)}`, `fp-y=${+hs.y.toFixed(4)}`, "crop=focalpoint");
  }
  q.push("auto=format", "fit=crop");
  return `${base}?${q.join("&")}`;
}

/**
 * Placement geometry. Each page photograph has one fixed shape, so its ratio,
 * its srcset rungs and its sizes attribute live here rather than being restated
 * at each call site.
 */
const PHOTO = {
  corporate: { ratio: 16 / 9, widths: [640, 960, 1280], sizes: "(min-width:900px) 1100px, 100vw" },
  cta: { ratio: 32 / 9, widths: [1024, 1440, 1920], sizes: "100vw" },
  heroSplit: { ratio: 4 / 5, widths: [480, 720, 960], sizes: "(min-width:880px) 38vw, 100vw" },
  heroFull: { ratio: 21 / 9, widths: [1024, 1440, 1920], sizes: "100vw" },
  story: { ratio: 4 / 5, widths: [400, 600, 800], sizes: "(min-width:900px) 300px, 100vw" },
};

/**
 * A figure from Sanity resolved into everything the markup needs, or null when
 * no photograph is set, which is the state every one of these ships in. This
 * maps a placement onto sanityImageUrl; it builds no URLs of its own.
 */
function sanityFigure(fig, projectId, dataset, place) {
  const w = place.widths[place.widths.length - 1];
  const h = Math.round(w / place.ratio);
  const src = sanityImageUrl(fig, projectId, dataset, { w, h });
  if (!src) return null;
  return {
    src,
    srcset: place.widths
      .map(x => `${sanityImageUrl(fig, projectId, dataset, { w: x, h: Math.round(x / place.ratio) })} ${x}w`)
      .join(", "),
    sizes: place.sizes,
    width: w, height: h,
    alt: fig.alt || "", caption: fig.caption || "",
  };
}

/**
 * The two photography documents, resolved into the internal shape. Both are
 * singletons that may not exist at all: an absent document, an absent field and
 * an empty field are the same thing here, and all three render nothing.
 *
 * The hero photograph is cropped to its treatment, portrait beside the copy and
 * wide behind it, so the ratio follows the layout rather than the other way
 * round. A treatment chosen without a photograph falls back to no photograph,
 * because the Studio allows that combination as a warning rather than an error.
 */
/**
 * A heroMedia object resolved into the shape the templates read: a treatment, a
 * veil strength and a photograph, or that same shape carrying no photograph.
 * The about page and every career programme hold the identical heroMedia object,
 * so they resolve through one function and cannot crop it differently.
 *
 * A treatment chosen without a photograph falls back to no photograph, because
 * the Studio allows that combination as a warning rather than an error.
 */
function heroFigure(hero, projectId, dataset) {
  const h = hero || {};
  const layout = h.layout || "none";
  const photo = layout === "none" ? null
    : sanityFigure(h.photo, projectId, dataset, layout === "full" ? PHOTO.heroFull : PHOTO.heroSplit);
  return {
    layout: photo ? layout : "none",
    veil: typeof h.veil === "number" ? h.veil : 72,
    photo,
  };
}

function pagePhotos(home, about, projectId, dataset) {
  const fig = (f, place) => sanityFigure(f, projectId, dataset, place);
  const h = home || {}, a = about || {};
  return {
    homePage: {
      corporatePhoto: fig(h.corporatePhoto, PHOTO.corporate),
      ctaPhoto: fig(h.ctaPhoto, PHOTO.cta),
    },
    aboutPage: {
      hero: heroFigure(a.hero, projectId, dataset),
      storyPhoto: fig(a.storyPhoto, PHOTO.story),
    },
  };
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

/**
 * Career programmes, in menu order, mapped into the internal shape.
 *
 * Two gates, both in the query rather than here. `published` is the editorial
 * one: off means absent from the menu, absent from the sitemap, and no page
 * built at all. The drafts exclusion is the other half, and it is stated
 * explicitly rather than left to the absence of a read token. This build has
 * never sent one, so drafts have never arrived, but the day a token is added for
 * any other reason an unpublished draft would otherwise reach the live site.
 * The existing course, person and settings queries are unchanged and still rely
 * on that absence.
 */
function mapCareerProgrammes(docs, projectId, dataset) {
  return (docs || []).map(p => ({
    code: p.code,
    slug: (p.slug && p.slug.current) || p.slug,
    title: p.title, subtitle: p.subtitle || "",
    attribution: p.attribution || "",
    eyebrow: p.eyebrow || "",
    startDate: p.startDate || "",
    enrolmentDeadline: p.enrolmentDeadline || "",
    standfirst: p.standfirst || "",
    stats: (p.stats || []).map(x => ({
      value: x.value, label: x.label, attribution: x.attribution || "",
    })),
    hero: heroFigure(p.hero, projectId, dataset),
    // The section that sets this programme against the alternative. Both column
    // headings come from the document, so a second programme comparing itself
    // against something else needs no code change.
    positioning: {
      lead: (p.positioning && p.positioning.lead) || [],
      programmeColumn: (p.positioning && p.positioning.programmeColumn) || "",
      alternativeColumn: (p.positioning && p.positioning.alternativeColumn) || "",
      rows: ((p.positioning && p.positioning.rows) || [])
        .map(r => [r.dimension, r.programme, r.alternative]),
    },
    training: {
      label: (p.training && p.training.label) || "",
      body: (p.training && p.training.body) || "",
      points: (p.training && p.training.points) || [],
    },
    modulesStandfirst: p.modulesStandfirst || "",
    schedule: {
      cohort: (p.schedule && p.schedule.cohort) || "",
      pattern: (p.schedule && p.schedule.pattern) || "",
      patternNote: (p.schedule && p.schedule.patternNote) || "",
      holidays: ((p.schedule && p.schedule.holidays) || [])
        .map(h => ({ date: h.date || "", name: h.name || "" })),
      // A file with no asset is a half filled row in the Studio, not a download.
      files: ((p.schedule && p.schedule.files) || [])
        .filter(f => f.asset && f.asset.url)
        .map(f => ({
          label: f.label || "", description: f.description || "",
          url: f.asset.url, size: f.asset.size || 0,
          extension: (f.asset.extension || "pdf").toUpperCase(),
        })),
    },
    certificateAwarded: p.certificateAwarded || "",
    graduateRoles: p.graduateRoles || [],
    arcs: (p.arcs || []).map(a => ({
      label: a.label, deliveredBy: a.deliveredBy || "",
      modules: (a.modules || []).map(m => ({
        num: m.num, title: m.title, hours: m.hours,
        // Taught and assessment are stored; the total never is.
        assessmentHours: m.assessmentHours || 0,
        dateFrom: m.dateFrom || "", dateTo: m.dateTo || "",
        deliveredBy: m.deliveredBy || "", certificate: m.certificate || "",
        synopsis: m.synopsis || "", objectives: m.objectives || [],
      })),
    })),
    pathways: (p.pathways || []).map(x => ({
      tag: x.tag || "", title: x.title, body: x.body || "", points: x.points || [],
    })),
    intakes: mapIntakes(p.intakes),
    audienceBody: p.audienceBody || "",
    details: (p.details || []).map(d => [d.label, d.value]),
    entryRequirements: p.entryRequirements || [],
    entryNote: p.entryNote || "",
    // showFees gates the whole block, the funding note included. A fee tier left
    // in the document with the switch off never reaches the page.
    showFees: Boolean(p.showFees),
    fees: (p.fees || []).map(f => [f.eligibility, f.fee]),
    feeNote: p.feeNote || "",
    fundingNote: p.fundingNote || "",
    paymentMethods: p.paymentMethods || [],
    refundTerms: (p.refundTerms || []).map(r => [r.window, r.outcome]),
    partners: (p.partners || []).map(x => ({
      name: x.name, role: x.role || "", body: x.body || "",
      url: x.url || "", disclaimer: x.disclaimer || "",
    })),
    faqs: (p.faqs || []).map(f => [f.q, f.a]),
  }));
}


/**
 * Intakes, from either document type, in one shape.
 *
 * Dates stay as dates all the way through. The field they replaced held prose
 * describing a date, which is why the old intakes could never be filtered: you
 * cannot compare "14, 21 and 28 April 2026" against today.
 */
function mapIntakes(list) {
  return (list || []).map(i => ({
    startDate: i.startDate || "", endDate: i.endDate || "",
    registrationCloses: i.registrationCloses || "",
    status: i.status || "scheduled",
    label: i.label || "", venue: i.venue || "", note: i.note || "",
  }));
}

async function loadFromSanity(projectId, dataset) {
  // Trainers are references to person documents, so they are dereferenced in
  // the query and arrive in the same shape the local content file uses.
  // homePage and aboutPage hold page photography and nothing else. Neither is
  // projected: like siteSettings they are taken whole, because the figures are
  // read as raw asset references rather than dereferenced.
  const query = encodeURIComponent(`{
    "settings": *[_type == "siteSettings"][0],
    "homePage": *[_type == "homePage"][0],
    "aboutPage": *[_type == "aboutPage"][0],
    "courses": *[_type == "course"] | order(number asc){
      ...,
      "trainers": trainers[]->{name, role, bio, photo}
    },
    "team": *[_type == "person" && (!defined(showOnAbout) || showOnAbout == true)] | order(order asc, name asc),
    "careerProgrammes": *[_type == "careerProgramme" && published == true && !(_id in path("drafts.**"))] | order(code asc){
      ...,
      schedule{
        ...,
        files[]{label, description, "asset": file.asset->{url, size, originalFilename, extension}}
      }
    }
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
      intakes: mapIntakes(c.intakes),
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
  return {
    settings: result.settings, courses, workshops, team,
    careerProgrammes: mapCareerProgrammes(result.careerProgrammes, projectId, dataset),
    ...pagePhotos(result.homePage, result.aboutPage, projectId, dataset),
  };
}

function loadLocal() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "content/content.json"), "utf8"));
}

/**
 * Resolve {{EMAIL}} inside content.
 *
 * Templates read the enquiry address from siteSettings already. Content prose
 * could not: a sentence like "write to us for the full timetable" had the
 * address typed into it, in the CMS, where it goes stale silently. Content may
 * now carry the {{EMAIL}} token and it is filled here, once, for both content
 * sources, so the address lives in exactly one field.
 *
 * Every string in the tree is walked rather than a named list of fields,
 * because the next field an editor puts an address in should not need a code
 * change to be covered. That includes FAQ answers, which the FAQPage structured
 * data is built from, so the schema data cannot disagree with the page.
 *
 * With the field unset the token is left visible rather than substituted away.
 * A blank leaves "write to  for the timetable", which reads as a typo and
 * survives review; a visible token does not. The build says so either way.
 */
function resolveContentTokens(content) {
  const email = (content.settings && content.settings.enquiryEmail) || "";
  let seen = 0;
  const walk = v => {
    if (typeof v === "string") {
      if (!v.includes("{{EMAIL}}")) return v;
      seen += 1;
      return email ? v.split("{{EMAIL}}").join(email) : v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v)) out[k] = walk(v[k]);
      return out;
    }
    return v;
  };
  const resolved = walk(content);
  if (seen && !email) {
    console.warn(`WARN: ${seen} content string(s) contain {{EMAIL}} but settings.enquiryEmail is empty. The token is left visible rather than replaced with nothing.`);
  }
  return resolved;
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
  // Page photography comes from Sanity only: content.json carries the keys so
  // the two sources stay in step, but a local build has no CDN to serve from,
  // so both documents normalise to empty and every placement renders nothing.
  const home = content.homePage || {};
  const about = content.aboutPage || {};
  return {
    ...content, courses, workshops,
    // Career programmes come from Sanity only, for the same reason page
    // photography does: content.json carries the key so the two sources stay in
    // step, and a local build renders none.
    careerProgrammes: content.careerProgrammes || [],
    homePage: { corporatePhoto: null, ctaPhoto: null, ...home },
    aboutPage: {
      storyPhoto: null, ...about,
      hero: { layout: "none", veil: 72, photo: null, ...(about.hero || {}) },
    },
  };
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
 * A nav item that opens a panel instead of navigating.
 *
 * The control is a button and not an anchor, and that is not a stylistic
 * preference: navScript() closes the mobile menu whenever a link inside it is
 * followed, so an anchor here would collapse the panel on the same tap that
 * opened it.
 *
 * The panel is hidden with the `hidden` attribute rather than a class, so it is
 * out of the accessibility tree and out of the tab order while closed, with no
 * script needed to keep those two in step.
 */
function navGroup(label, rows) {
  const id = `nav-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  const items = rows
    .map(([l, href]) => `          <li><a href="${href}">${l}</a></li>`)
    .join("\n");
  return `      <li class="nav-group">
        <button class="nav-group-btn" aria-expanded="false" aria-controls="${id}">${label}</button>
        <ul class="nav-panel" id="${id}" hidden>
${items}
        </ul>
      </li>`;
}

/**
 * The Programmes item.
 *
 * With no career programme published it is the plain anchor it has always been,
 * so the nav stays byte for byte what it is today until there is something to
 * put in it. With one or more published it becomes a disclosure, and the anchor
 * it would have been becomes the first row of the panel.
 *
 * The existing item is reused rather than a seventh added. The row already
 * tightens its gap at 1080px to keep six items on one line, so a seventh would
 * have to be paid for somewhere. It is also the better answer: a visitor looking
 * for programmes should not have to know that the word silently excludes the
 * five month one.
 *
 * No group heading inside the panel. With one published programme there is
 * nothing to head, and the right label for two is not visible from here.
 */
function programmesItem(href, programmes) {
  if (!programmes.length) return ["Programmes", href];
  return ["Programmes", href, [
    ["All short courses", href],
    ...programmes.map(p => [p.title, `${p.slug}.html`]),
  ]];
}

/**
 * The group descriptor, beside the logo in every footer.
 *
 * Future Edge Institute Private Limited is a wholly owned subsidiary of Kydon
 * Holdings Pte. Ltd., and the site names Kydon in a dozen places: the flagship
 * method, the AI Marketplace, the partnership that delivers the OPC Launchpad.
 * Without this line a visitor meets those as an unexplained third party. It is
 * short deliberately. The precise subsidiary wording is the small print directly
 * beneath it, and the fuller statement is on the about page.
 *
 * Driven from siteSettings, so it is one edit for the whole site, and absent
 * entirely when the field is empty.
 */
const groupDescriptor = s => (s.groupDescriptor
  ? `<p class="foot-group">${esc(s.groupDescriptor)}</p>\n        `
  : "");

/**
 * The site header, rendered once for every page.
 *
 * This was five hand maintained copies of the same block, one per template,
 * which is exactly how the five drifted apart: each page points its Programmes,
 * Fees and Enquire links at its own target, and the homepage points the brand
 * at #top rather than back at itself. Those differences are deliberate and are
 * kept, so every target is an argument here rather than something the renderer
 * decides. Adding a nav item now means editing one function instead of five
 * files that can disagree.
 *
 * `items` is the plain links, in order. The WhatsApp link and the Enquire
 * button carry their own markup and are not part of it.
 */
function siteHeader({ brand, items, wa, cta }) {
  const links = items
    .map(([label, href, panel]) => panel
      ? navGroup(label, panel)
      : `      <li><a href="${href}">${label}</a></li>`)
    .join("\n");
  return `<header>
  <div class="wrap nav">
    <a class="brand" href="${brand}" aria-label="Future Edge Institute home">
      <img class="brand-logo" src="assets/brand/fei_logo_secondary_notag.svg" alt="Future Edge Institute" width="121" height="46">
      <!-- The logo file is the version without the tagline, because a baked in
           tagline renders at about 4px at header size. This is the tagline set
           as live text instead. aria-hidden: the img alt already names the
           brand, and a screen reader should not read it twice. -->
      <span class="brand-tagline" aria-hidden="true">Future Ready. Future Strong</span>
    </a>
    <button class="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="navlinks">
      <span></span><span></span><span></span>
    </button>
    <ul class="nav-links" id="navlinks">
${links}
      <li><a class="nav-wa" id="nav-wa" href="${wa}"><span class="wa-dot"></span>WhatsApp</a></li>
      <li><a href="${cta}" class="nav-cta">Enquire</a></li>
    </ul>
  </div>
</header>`;
}

/**
 * The homepage has always carried the apostrophe in its WhatsApp message as
 * %27, while every other page carries it literally: encodeURIComponent leaves
 * an apostrophe alone, and the homepage URL was written by hand. The two decode
 * to the same message. Preserved rather than normalised so that generating the
 * header changes no bytes; normalising it is a separate one line change.
 */
const waApostrophe = u => u.replace(/'/g, "%27");

/**
 * The mobile menu toggle, rendered once for every page, for the same reason the
 * header itself is: this was five identical copies, and the next change to the
 * nav would have had to land in all five.
 *
 * The second handler closes the panel when any link inside it is followed,
 * which is right for a link and wrong for a control: anything added here that
 * opens a submenu rather than navigating must be a button, or this will collapse
 * the whole menu under it.
 */
function navScript(hasGroup) {
  const base = `const btn=document.querySelector('.menu-btn');
const links=document.getElementById('navlinks');
btn.addEventListener('click',()=>{
  const open=links.classList.toggle('open');
  btn.setAttribute('aria-expanded',open);
});
links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
  links.classList.remove('open');btn.setAttribute('aria-expanded','false');
}));`;
  // Appended, never interleaved: with no disclosure in the markup the base
  // block above is emitted exactly as it has always been.
  if (!hasGroup) return base;
  return `${base}

// Programmes disclosure. The only interactive nav element on the site, so it
// carries the full keyboard contract: aria-expanded tracks the panel, Escape
// closes it and returns focus to the button, and focus leaving the group closes
// it too. That last check is deferred a tick because Safari does not focus a
// link on click, so reading activeElement synchronously would close the panel
// before the click it is closing for had been dispatched.
const groupBtn=document.querySelector('.nav-group-btn');
if(groupBtn){
  const group=groupBtn.parentNode;
  const panel=document.getElementById(groupBtn.getAttribute('aria-controls'));
  const setOpen=o=>{panel.hidden=!o;groupBtn.setAttribute('aria-expanded',o);};
  groupBtn.addEventListener('click',()=>setOpen(panel.hidden));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!panel.hidden){setOpen(false);groupBtn.focus();}
  });
  document.addEventListener('click',e=>{
    if(!panel.hidden&&!group.contains(e.target))setOpen(false);
  });
  group.addEventListener('focusout',()=>setTimeout(()=>{
    if(!group.contains(document.activeElement))setOpen(false);
  },0));
  // The hamburger and the panel links both close the panel: reopening the
  // mobile menu should never reveal a panel left open from last time.
  btn.addEventListener('click',()=>setOpen(false));
  panel.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
}`;
}

/**
 * The header carried by every page that is neither the homepage nor a programme
 * page: about and policies. Both point Fees and Funding and Enquire back at the
 * homepage, because neither has a section of its own to jump to.
 */
const staticPageHeader = (s, programmes) => siteHeader({
  brand: "index.html",
  items: [["About", "about.html"], programmesItem("index.html#courses", programmes),
    ["Fees and Funding", "index.html#funding"], ["For Organisations", "index.html#corporate"]],
  wa: waLink(s.whatsappNumber), cta: "index.html#contact",
});

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
 * Page photography.
 *
 * Four placements, every one of them optional. Each renderer returns the empty
 * string when its photograph is not set, and each token in the templates abuts
 * the markup that follows it, so an empty placement leaves the page byte for
 * byte what it was. That is the property the whole feature rests on: the schema
 * and the rendering ship now, the photographs arrive whenever they arrive, and
 * nothing changes on the site until they do.
 */
function photoImg(p, cls, { decorative = false, eager = false } = {}) {
  // A photograph behind a veil carries nothing a screen reader needs, and an
  // empty alt is how you say so. Everything else uses the alt from the Studio.
  const alt = decorative ? "" : p.alt;
  return `<img${cls ? ` class="${cls}"` : ""} src="${esc(p.src)}" srcset="${esc(p.srcset)}"`
    + ` sizes="${esc(p.sizes)}" width="${p.width}" height="${p.height}" alt="${esc(alt)}"`
    + ` loading="${eager ? "eager" : "lazy"}" decoding="async">`;
}

/** A caption, or nothing. Never an empty figcaption taking up space. */
function photoCaption(p) {
  return p.caption ? `\n        <figcaption>${esc(p.caption)}</figcaption>` : "";
}

/** The For Organisations photograph, between the section head and the band. */
function corporatePhoto(p) {
  if (!p) return "";
  return `<figure class="photo corp-photo reveal">
        ${photoImg(p)}${photoCaption(p)}
      </figure>

    `;
}

/**
 * The enquiry band photograph. This section is light: navy heading, slate body,
 * a white card. A photograph behind it only works under a veil, and under a
 * veil none of those colours do, so the section carries a modifier that adapts
 * its own text for a dark ground rather than the photograph being lightened
 * until it stops being a photograph. Both halves are absent together.
 */
const contactMod = p => (p ? " has-photo" : "");
function ctaPhoto(p) {
  if (!p) return "";
  return `${photoImg(p, "contact-bg", { decorative: true })}\n  `;
}

/**
 * The about page hero, in three treatments. Split puts the photograph beside
 * the copy through the grid, so the existing children keep their place in the
 * DOM and no wrapper is introduced. Full puts it behind, under a veil whose
 * strength is set in the Studio. No photograph renders the header exactly as it
 * is today.
 */
const aboutHeroMod = h => (h.layout === "split" ? " hero-split" : h.layout === "full" ? " hero-full" : "");
const aboutHeroStyle = h => (h.layout === "full" ? ` style="--veil:${(h.veil / 100).toFixed(2)}"` : "");
function aboutHeroBg(h) {
  if (h.layout !== "full") return "";
  return `${photoImg(h.photo, "hero-bg", { decorative: true, eager: true })}\n  `;
}
function aboutHeroFig(h) {
  if (h.layout !== "split") return "";
  return `    <figure class="photo hero-photo">
      ${photoImg(h.photo, null, { eager: true })}${photoCaption(h.photo)}
    </figure>
`;
}

/** The story photograph, in the second column beside the timeline. */
const storyMod = p => (p ? " has-photo" : "");
function storyPhoto(p) {
  if (!p) return "";
  return `<figure class="photo story-photo reveal">
        ${photoImg(p)}${photoCaption(p)}
      </figure>
    `;
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
 * Upcoming intakes only, in date order.
 *
 * Filtered on the build date, so a past date is never in the HTML at all: not
 * hidden by script, not merely styled as closed, absent. It cannot be scraped,
 * indexed or read with JavaScript off.
 *
 * That is necessary and not sufficient, because a static build from last month
 * still serves last month's answer. The build cannot solve that on its own: it
 * needs the site rebuilt on a schedule. Note that the enrolment button on a
 * career programme page already depends on build freshness in exactly the same
 * way, so one daily rebuild settles both.
 */
function upcomingIntakes(intakes, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return (intakes || [])
    .filter(i => {
      const d = parseDate(i.startDate);
      return d && d >= today;
    })
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}

const STATUS_WORD = {
  open: "Open", waitlist: "Waitlist", closed: "Closed", scheduled: "Scheduled",
};

/** An intake's run: both dates when there are two, the start alone otherwise. */
function intakeDates(i) {
  return i.endDate && i.endDate !== i.startDate
    ? `${formatDate(i.startDate)} to ${formatDate(i.endDate)}`
    : formatDate(i.startDate);
}

/** One intake card, shared by both page types. */
function intakeCard(i) {
  const closed = i.status === "closed";
  const word = STATUS_WORD[i.status] || STATUS_WORD.scheduled;
  // With no label the heading is the date range, so a Dates row would repeat it
  // word for word two lines down.
  const rows = [
    ["Dates", i.label ? intakeDates(i) : ""],
    ["Closes", i.registrationCloses ? formatDate(i.registrationCloses) : ""],
    ["Venue", i.venue],
    ["Note", i.note],
  ].filter(([, v]) => v)
    .map(([l, v]) => `<div><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>`).join("\n          ");
  return `<article class="intake-card${closed ? " closed" : ""}">
        <div class="intake-top">
          <span class="intake-pill${i.status === "waitlist" ? " hot" : ""}">${word}</span>
        </div>
        <h3>${esc(i.label || intakeDates(i))}</h3>
        <dl class="intake-rows">
          ${rows}
        </dl>
        ${closed ? "" : `<a class="intake-link" href="#enquire">Enquire about this intake</a>`}
      </article>`;
}

/**
 * Intake cards for a course page.
 *
 * The empty state is unchanged and deliberately not silent: a course with no
 * dates says so and routes to enquiry, which reads better than a missing
 * section. It covers both empty cases, no dates recorded and every recorded
 * date past, because to a reader they are the same situation.
 */
function renderIntakes(intakes, now) {
  const upcoming = upcomingIntakes(intakes, now);
  if (!upcoming.length) {
    return `<div class="intake-empty">
        <p>Intake dates for this course are confirmed at enquiry. We run small cohorts and schedule them around confirmed demand, so tell us which course you are interested in and we will come back with the next available dates, including weekday and weekend options.</p>
        <a class="btn btn-solid" href="#enquire">Ask about the next intake</a>
      </div>`;
  }
  // Filter tabs are deliberately not built yet: the threshold below marks where
  // they become worth building.
  const tabs = upcoming.length > 4
    ? `<!-- format filter tabs belong here once there are more than four intakes -->\n      ` : "";
  return `${tabs}<div class="intake-grid">${upcoming.map(intakeCard).join("")}</div>`;
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

function renderCoursePage(template, n, c, content, s, now) {
  const programmes = content.careerProgrammes;
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
    HEADER: siteHeader({
      brand: "index.html",
      items: [["About", "about.html"], programmesItem("index.html#courses", programmes),
        ["Fees and Funding", "#fees"], ["For Organisations", "index.html#corporate"]],
      wa: waLink(s.whatsappNumber, code), cta: "#enquire",
    }),
    NAV_SCRIPT: navScript(programmes.length > 0),
    GROUP_DESCRIPTOR: groupDescriptor(s),
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
    INTAKES: renderIntakes(c.intakes || [], now),
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
function renderWorkshopPage(template, n, w, s, programmes) {
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
    HEADER: siteHeader({
      brand: "index.html",
      items: [["About", "about.html"], programmesItem("index.html#courses", programmes),
        ["Fees and Funding", "#fees"], ["For Organisations", "index.html#corporate"]],
      wa: waLink(s.whatsappNumber, code), cta: "#enquire",
    }),
    NAV_SCRIPT: navScript(programmes.length > 0),
    GROUP_DESCRIPTOR: groupDescriptor(s),
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

// ---------- career programme page ----------
/**
 * A Sanity date, "YYYY-MM-DD", as a local date and as prose.
 *
 * Parsed from its parts rather than handed to the Date constructor, which reads
 * a bare date string as UTC midnight: in any timezone behind UTC that renders
 * the day before, so a cohort starting on the 5th would advertise the 4th.
 */
function parseDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : null;
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
function formatDate(iso) {
  const d = parseDate(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "";
}

/**
 * The hero enrolment line and the primary button.
 *
 * The button is time relative on purpose, because "closes this month" is what
 * makes a deadline feel like one. That means the build has to know the date,
 * and it means a stale deadline is a hazard, so this degrades in one direction
 * only: once the deadline has passed the button stops claiming the cohort is
 * open and the build says so on the console. It never invents urgency.
 */
function enrolment(p, now) {
  const line = [];
  if (p.startDate) line.push(`Cohort 1 starts ${formatDate(p.startDate)}.`);
  const close = p.enrolmentDeadline ? parseDate(p.enrolmentDeadline) : null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const open = close ? close >= today : null;
  if (close) {
    line.push(open
      ? `Applications close ${formatDate(p.enrolmentDeadline)}.`
      : `Applications for this cohort closed on ${formatDate(p.enrolmentDeadline)}.`);
  }
  let cta = "Enquire about this programme";
  if (open) {
    cta = (close.getFullYear() === now.getFullYear() && close.getMonth() === now.getMonth())
      ? "Enrol now, closes this month"
      : `Enrol now, closes ${close.getDate()} ${MONTHS[close.getMonth()]}`;
  } else if (close) {
    console.warn(`WARN: ${p.code} enrolment deadline ${p.enrolmentDeadline} has passed. The page no longer offers enrolment; set the next cohort or clear the date.`);
  }
  return {
    cta,
    line: line.length
      ? `<p class="enrolment${open ? " is-open" : ""}">${line.join(" ")}</p>\n    `
      : "",
  };
}
/**
 * The attribution paragraph.
 *
 * Rendered by the build in two fixed places, never placed by an editor: under
 * the hero, and beside the certificate claim in the module summary. Those are
 * the two points at which a reader learns who they are dealing with, and the
 * paragraph resolves who delivers, who accredits and who issues certificates.
 * It is what keeps the subsidy claims on this page from reading as a
 * contradiction of the SSG line carried on the eight short course pages, so it
 * is not editorial prose to be shortened for style or moved for layout.
 */
function attributionBlock(text, place) {
  if (!text) return "";
  // The hero copy is a band of its own and carries the layout wrap. The modules
  // copy sits inside a section that already has one, so it adds none.
  if (place === "modules") {
    return `<aside class="attribution attribution-modules reveal" aria-label="How this programme is delivered"><p>${esc(text)}</p></aside>`;
  }
  return `<aside class="attribution attribution-hero" aria-label="How this programme is delivered">
  <div class="wrap"><p>${esc(text)}</p></div>
</aside>

`;
}

/** The hero stat bar. Each figure that belongs to a partner says so. */
function statBar(stats) {
  if (!stats.length) return "";
  const items = stats.map(s => `<div class="stat-item">
        <strong>${esc(s.value)}</strong>
        <small>${esc(s.label)}${s.attribution ? `<span class="stat-attr">${esc(s.attribution)}</span>` : ""}</small>
      </div>`).join("\n      ");
  return `<div class="stat-bar">
      ${items}
    </div>
    `;
}

/**
 * Where this programme sits beside the short courses.
 *
 * Both column headings come from the document rather than from here, so the
 * next career programme can set itself against something else without a code
 * change. The dimension is a row header rather than a cell: on a comparison
 * table that is what lets a screen reader announce which row a value belongs
 * to when reading across.
 */
function positioningSection(p) {
  const pos = p.positioning;
  if (!pos.rows.length && !pos.lead.length) return "";
  const lead = pos.lead.map(t => `<p>${esc(t)}</p>`).join("\n        ");
  const rows = pos.rows.map(([d, a, b]) => `<tr>
          <th scope="row">${esc(d)}</th>
          <td>${esc(a)}</td>
          <td>${esc(b)}</td>
        </tr>`).join("\n        ");
  const table = pos.rows.length ? `<p class="table-hint reveal">Scroll the table sideways to compare the two.</p>
    <div class="policy-table-scroll reveal">
      <table class="day-table compare-table">
        <thead><tr>
          <th scope="col"><span class="vh">Dimension</span></th>
          <th scope="col">${esc(pos.programmeColumn)}</th>
          <th scope="col">${esc(pos.alternativeColumn)}</th>
        </tr></thead>
        <tbody>
        ${rows}
        </tbody>
      </table>
    </div>` : "";
  return `<!-- ================= WHERE THIS SITS ================= -->
<section class="cpage-section positioning" id="positioning">
  <div class="wrap">
    <div class="section-head reveal" style="max-width:760px">
      <span class="eyebrow">One Programme, Or One Module At A Time</span>
      <h2>Where this sits beside the short courses</h2>
    </div>
    <div class="why-body reveal">
        ${lead}
    </div>
    ${table}
  </div>
</section>

`;
}

/** The training block and the ways out of it. */
function monthsSection(p) {
  if (!hasMonths(p)) return "";
  const t = p.training;
  const points = t.points.length
    ? `\n        <ul class="build-list">${t.points.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`
    : "";
  const training = t.body ? `<div class="training-block reveal">
        ${t.label ? `<span class="eyebrow">${esc(t.label)}</span>` : ""}
        <p>${esc(t.body)}</p>${points}
      </div>` : "";
  const paths = p.pathways.map(x => `<article class="pathway-card reveal">
        ${x.tag ? `<span class="pc-tag">${esc(x.tag)}</span>` : ""}
        <h3>${esc(x.title)}</h3>
        ${x.body ? `<p>${esc(x.body)}</p>` : ""}
        ${x.points.length ? `<ul class="build-list">${x.points.map(q => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}
      </article>`).join("\n      ");
  return `<!-- ================= THE MONTHS AND THE WAYS FORWARD ================= -->
<section class="cpage-section months" id="pathways">
  <div class="wrap">
    <div class="section-head reveal" style="max-width:760px">
      <span class="eyebrow">The Programme</span>
      <h2>The training, and the two ways forward</h2>
    </div>
    ${training}
    <div class="pathway-grid">
      ${paths}
    </div>
  </div>
</section>

`;
}

/**
 * The modules, grouped by arc.
 *
 * The number and the title are joined with a middot, not a colon: six of the
 * eight titles carry a colon of their own, so a colon here reads as two. The
 * approved workbook uses a middot in the same place.
 *
 * A details element rather than a scripted accordion: it opens with the
 * keyboard, announces its own state, and prints expanded, with no code of ours
 * standing between the reader and the content.
 *
 * The summary bar totals the hours from the modules rather than restating a
 * figure, so it can never disagree with the list above it, and the attribution
 * sits directly beneath it because that is where the certificate claim is made.
 */
function modulesSection(p) {
  if (!hasModules(p)) return "";
  let total = 0, count = 0;
  const arcs = p.arcs.map(a => {
    const mods = a.modules.map(m => {
      total += Number(m.hours) || 0;
      count += 1;
      const by = m.deliveredBy || a.deliveredBy;
      const meta = [`${m.hours} hours`, by].filter(Boolean).map(esc).join(" · ");
      return `<details class="faq-item module-item" data-module="${esc(m.num || m.title)}">
          <summary>
            <span class="mod-head"><b>${esc(m.num ? `${m.num} \u00b7 ` : "")}${esc(m.title)}</b><span class="mod-meta">${meta}</span></span>
          </summary>
          <div class="faq-a">
            ${m.certificate ? `<p class="mod-cert">Certificate: ${esc(m.certificate)}</p>` : ""}
            ${m.synopsis ? `<p>${esc(m.synopsis)}</p>` : ""}
            ${m.objectives.length ? `<ul class="build-list">${m.objectives.map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
          </div>
        </details>`;
    }).join("\n        ");
    return `<div class="arc reveal">
        <h3 class="arc-label">${esc(a.label)}${a.deliveredBy ? ` <span class="arc-by">Delivered by ${esc(a.deliveredBy)}</span>` : ""}</h3>
        ${mods}
      </div>`;
  }).join("\n      ");
  // Trailing zeros are noise on a whole number and meaning on a half hour.
  const assess = p.arcs.reduce((t, a) =>
    t + a.modules.reduce((u, m) => u + (Number(m.assessmentHours) || 0), 0), 0);
  const roles = p.graduateRoles.length
    ? `<p class="mod-roles reveal"><b>Graduate roles:</b> ${p.graduateRoles.map(esc).join(", ")}. Aligned to the approved course outcomes.</p>`
    : "";
  return `<!-- ================= THE MODULES ================= -->
<section class="cpage-section modules" id="modules">
  <div class="wrap">
    <div class="section-head reveal" style="max-width:820px">
      <span class="eyebrow">The Modules</span>
      <h2>${count} modules. One programme.</h2>
      ${p.modulesStandfirst ? `<p>${esc(p.modulesStandfirst)}</p>` : ""}
    </div>
    ${roles}
    <div class="arc-list">
      ${arcs}
    </div>
    <div class="mod-summary reveal">
      <span>${hoursPhrase(total, assess)}</span>
      <span><b>${count}</b> modules</span>
      ${p.certificateAwarded ? `<span>${esc(p.certificateAwarded)}</span>` : ""}
    </div>
    ${attributionBlock(p.attribution, "modules")}
  </div>
</section>

`;
}

/**
 * A number as it should read: 580.5 keeps its half, 614 does not grow a ".0".
 */
const hrs = n => (Number.isInteger(n) ? String(n) : Number(n.toFixed(1)).toString());

/**
 * Hours, always with their parts.
 *
 * Never a bare total. The per module figures elsewhere on this page are taught
 * hours and the schedule's are totals, so a lone number invites the reader to
 * conclude the two contradict each other. Stating both is what stops that.
 * With no assessment recorded there is no second part to state, so it falls back
 * to the plain figure.
 */
function hoursPhrase(taught, assess) {
  if (!assess) return `${hrs(taught)} hours`;
  return `${hrs(taught)} taught plus ${hrs(assess)} assessment, ${hrs(taught + assess)} in total`;
}

/**
 * Every module in one flat list, with its arc's delivering partner resolved the
 * same way the module list resolves it, plus the totals and the outer dates.
 *
 * The programme start and end are derived here from the earliest and latest
 * module dates rather than stored, so the at a glance block cannot disagree with
 * the table under it.
 */
function moduleSchedule(p) {
  const mods = [];
  for (const a of p.arcs) {
    for (const m of a.modules) {
      mods.push({ ...m, by: m.deliveredBy || a.deliveredBy || "" });
    }
  }
  const dates = mods.flatMap(m => [m.dateFrom, m.dateTo]).filter(Boolean).sort();
  return {
    mods,
    taught: mods.reduce((t, m) => t + (Number(m.hours) || 0), 0),
    assess: mods.reduce((t, m) => t + (Number(m.assessmentHours) || 0), 0),
    first: dates[0] || "",
    last: dates[dates.length - 1] || "",
  };
}

/** A module's run, with the year stated once unless it straddles two. */
function dateRange(from, to) {
  if (!from || !to) return "";
  const a = parseDate(from), b = parseDate(to);
  const short = d => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return a.getFullYear() === b.getFullYear()
    ? `${short(a)} to ${short(b)} ${b.getFullYear()}`
    : `${short(a)} ${a.getFullYear()} to ${short(b)} ${b.getFullYear()}`;
}

/** A file size a person can read. */
function fileSize(bytes) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/**
 * The programme schedule.
 *
 * Placed between the modules and who it is for, because a candidate reads what
 * the eight modules are and immediately asks when they run.
 *
 * Absent in full when the schedule object is empty: no heading, no reserved
 * space, and the page is byte for byte what it was. The venue is read from the
 * existing details rows rather than stored twice.
 */
function scheduleSection(p, email) {
  if (!hasSchedule(p)) return "";
  const sc = p.schedule || {};
  const s = moduleSchedule(p);
  const dated = s.mods.filter(m => m.dateFrom && m.dateTo);
  const cohort = sc.cohort || "the current cohort";
  const venue = (p.details.find(([l]) => /venue/i.test(l)) || [])[1] || "";

  const row = (label, value) => (value
    ? `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : "");
  const glance = [
    row("Starts", s.first ? formatDate(s.first) : ""),
    row("Ends", s.last ? formatDate(s.last) : ""),
    row("Pattern", sc.pattern),
    row("The non teaching day", sc.patternNote),
    row("Hours", hoursPhrase(s.taught, s.assess)),
    row("Venue", venue),
  ].filter(Boolean).join("\n        ");

  // The module table. Seven columns, so it scrolls inside the wrapper the fees
  // and comparison tables use rather than being squeezed on a phone.
  const table = dated.length ? `<p class="table-hint reveal">Scroll the table sideways for the full breakdown.</p>
    <div class="policy-table-scroll reveal">
      <table class="day-table sched-table">
        <thead><tr>
          <th scope="col">Module</th><th scope="col">Dates</th><th scope="col">Delivered by</th>
          <th scope="col">Taught</th><th scope="col">Assessment</th><th scope="col">Total</th>
        </tr></thead>
        <tbody>
        ${dated.map(m => `<tr>
          <th scope="row">${esc(m.num ? `${m.num} \u00b7 ` : "")}${esc(m.title)}</th>
          <td class="t t-wrap">${esc(dateRange(m.dateFrom, m.dateTo))}</td>
          <td>${esc(m.by)}</td>
          <td class="hrs">${hrs(Number(m.hours) || 0)}</td>
          <td class="hrs">${hrs(Number(m.assessmentHours) || 0)}</td>
          <td class="hrs">${hrs((Number(m.hours) || 0) + (Number(m.assessmentHours) || 0))}</td>
        </tr>`).join("\n        ")}
        </tbody>
        <tfoot><tr>
          <th scope="row">Total</th><td></td><td></td>
          <td class="hrs">${hrs(s.taught)}</td>
          <td class="hrs">${hrs(s.assess)}</td>
          <td class="hrs">${hrs(s.taught + s.assess)}</td>
        </tr></tfoot>
      </table>
    </div>` : "";

  const holidays = (sc.holidays || []).filter(h => h.date && h.name);
  const holidayLine = holidays.length
    ? `<p class="sched-note reveal"><b>Public holidays.</b> No class on ${
        holidays.map(h => `${esc(h.name)}, ${formatDate(h.date)}`).join("; ")
      }. Singapore public holidays are observed throughout.</p>`
    : "";
  // No standalone pattern note. It would repeat, word for word and within one
  // screen, the "non teaching day" row already in the at a glance block above,
  // which is the same single field. One statement of it, in the place a reader
  // scans for facts.

  const files = (sc.files || []);

  /**
   * The route to the day by day schedule, which resolves itself.
   *
   * Files attached: the downloads. None attached: an invitation to ask for it.
   * Never both, and never neither while there is an address to ask. A future
   * intake whose files nobody remembered to upload still gives a reader
   * somewhere to go, rather than a section that simply stops.
   *
   * The mailto is gated on the address being set, so an unset field cannot
   * render a link that goes nowhere.
   */
  const byEmail = email
    ? `<p class="sched-note reveal"><b>The day by day schedule.</b> Request it from <a href="mailto:${esc(email)}?subject=${encodeURIComponent(`${p.title} detailed schedule request`)}">${esc(email)}</a> and we will send it over.</p>`
    : "";
  const downloads = files.length ? `<h3 class="block-h3 reveal">Download the schedule</h3>
    <div class="related-grid reveal">
      ${files.map(f => `<a class="rel-card" href="${esc(f.url)}" target="_blank" rel="noopener" download>
        <small>${esc(f.extension)}${f.size ? ` · ${fileSize(f.size)}` : ""}</small>
        <h4>${esc(f.label)}</h4>
        <p>${esc(f.description)}</p>
      </a>`).join("\n      ")}
    </div>` : "";

  return `<!-- ================= SCHEDULE ================= -->
<section class="cpage-section schedule" id="schedule" style="background:var(--bg-alt)">
  <div class="wrap">
    <div class="section-head reveal" style="max-width:760px">
      <span class="eyebrow">Schedule</span>
      <h2>When it runs</h2>
      <p>These are the dates for ${esc(cohort)}. A later intake runs to its own schedule, so check with us before planning around them.</p>
      <!-- Hidden in markup and revealed by script, so a control that needs
           JavaScript to do anything never appears without it. Hidden again in
           print, where it would be an unusable button on paper. -->
      <button class="print-btn" type="button" hidden>Print this schedule</button>
    </div>
    <div class="info-panel reveal">
      <dl class="sc-list">
        ${glance}
      </dl>
    </div>
    ${table}
    ${holidayLine}${files.length ? downloads : byEmail}
  </div>
</section>

`;
}

/**
 * The in page section menu.
 *
 * Built from the predicates above, so a section that did not render gets no
 * link and the bar can never point at a dead anchor. Fees off means no Fees
 * link, with nothing to keep in step by hand.
 *
 * Sticky below the site header once the reader scrolls past it, at every width.
 * The alternatives were worse: static on mobile removes in page navigation from
 * the longest page on the site exactly where it matters most, and a "jump to"
 * disclosure would be the third interactive nav control on this page, after the
 * mobile menu and the Programmes dropdown. A horizontally scrolling row is
 * already how .filters handles the same problem on the homepage.
 *
 * Plain markup: a nav landmark with a name and a list of anchors. With no
 * JavaScript nothing is marked current and every link still works, which is the
 * whole of its function.
 */
function sectionNav(p) {
  const items = [
    ["#why-now", "Why now", () => true],
    ["#pathways", "The five months", hasMonths],
    ["#modules", "Modules", hasModules],
    ["#schedule", "Schedule", hasSchedule],
    ["#intakes", "Upcoming dates", hasIntakes],
    ["#audience", "Who it is for", hasAudience],
    ["#details", "Programme details", hasDetails],
    [`#fees`, hasFees(p) ? "Fees" : "Funding", hasFeesSection],
    ["#partners", "Partners", hasPartners],
    ["#faq", "FAQ", hasFaqs],
    ["#enquire", "Enquire", () => true],
  ].filter(([, , test]) => test(p));
  // One link is not a menu. Two is the least that earns the space it takes.
  if (items.length < 3) return "";
  const links = items
    .map(([href, label]) => `      <li><a href="${href}">${label}</a></li>`)
    .join("\n");
  return `<!-- ================= SECTION MENU ================= -->
<nav class="sectionnav" aria-label="Sections of this page">
  <ul class="wrap">
${links}
  </ul>
</nav>

`;
}

/**
 * Upcoming dates on a career programme page.
 *
 * Absent while no intake is recorded, which is the state today: the schedule
 * section already states the current cohort's dates and the hero states its
 * enrolment deadline, so an empty "no upcoming dates" panel beside them would
 * contradict both.
 *
 * Present but empty is a different situation and gets a different answer. If
 * every recorded date has passed, silence would be wrong on a page inviting
 * enquiries, so the section stays and routes to enquiry. So the rule is: nothing
 * scheduled yet, say nothing; everything we listed has been and gone, say so.
 */
function intakesSection(p, now) {
  if (!hasIntakes(p)) return "";
  const upcoming = upcomingIntakes(p.intakes, now);
  const body = upcoming.length
    ? `<div class="intake-grid reveal">${upcoming.map(intakeCard).join("")}</div>`
    : `<div class="intake-empty reveal">
        <p>The dates listed for this programme have passed and the next cohort is not yet scheduled. Tell us you are interested and we will come back with the next intake as soon as it is confirmed.</p>
        <a class="btn btn-solid" href="#enquire">Ask about the next cohort</a>
      </div>`;
  return `<!-- ================= UPCOMING DATES ================= -->
<section class="cpage-section" id="intakes">
  <div class="wrap">
    <div class="section-head reveal" style="max-width:760px">
      <span class="eyebrow">Upcoming Dates</span>
      <h2>Future cohorts</h2>
    </div>
    ${body}
  </div>
</section>

`;
}

/**
 * Which sections this programme actually has.
 *
 * One predicate each, and every consumer reads them: the section renderer that
 * decides whether to emit anything, the in page section nav that decides whether
 * to link to it, and the site nav that decides where Fees and Funding points.
 * A second copy of any of these conditions is how a nav ends up linking to an
 * anchor that was never rendered.
 */
const hasMonths = p => Boolean(p.training.body) || p.pathways.length > 0;
const hasModules = p => p.arcs.length > 0;
const hasAudience = p => Boolean(p.audienceBody) || p.entryRequirements.length > 0;
const hasDetails = p => p.details.length > 0 || Boolean(p.startDate) || Boolean(p.enrolmentDeadline);
const hasPartners = p => p.partners.length > 0;
const hasFaqs = p => p.faqs.length > 0;
// Presence, not freshness: a programme whose every date has passed still gets
// the section, because that is worth saying. See intakesSection().
const hasIntakes = p => p.intakes.length > 0;
const hasSchedule = p => {
  const sc = p.schedule || {};
  return moduleSchedule(p).mods.some(m => m.dateFrom && m.dateTo)
    || Boolean(sc.pattern) || (sc.files || []).length > 0;
};

/** Who it is for, and who may apply. */
function audienceSection(p) {
  if (!hasAudience(p)) return "";
  return `<!-- ================= WHO IT IS FOR ================= -->
<section class="cpage-section" id="audience">
  <div class="wrap">
    <div class="section-head reveal" style="max-width:760px">
      <span class="eyebrow">Who It Is For</span>
      <h2>Built for professionals with domain expertise, not developers</h2>
      ${p.audienceBody ? `<p>${esc(p.audienceBody)}</p>` : ""}
    </div>
    ${p.entryRequirements.length ? `<div class="reveal" style="max-width:760px">
      <h3 class="block-h3">Entry requirements</h3>
      <ul class="build-list">${p.entryRequirements.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
      ${p.entryNote ? `<p class="entry-note">${esc(p.entryNote)}</p>` : ""}
    </div>` : ""}
  </div>
</section>

`;
}

/** The programme details table. */
function infoSection(p) {
  // The date rows come from the two date fields rather than from hand typed
  // detail rows, so the table and the hero cannot disagree.
  if (!hasDetails(p)) return "";
  const dated = [
    ...(p.startDate ? [["Course start date", formatDate(p.startDate)]] : []),
    ...(p.enrolmentDeadline ? [["Applications close", formatDate(p.enrolmentDeadline)]] : []),
    ...p.details,
  ];
  const rows = dated.map(([l, v]) => `<div><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>`).join("\n        ");
  return `<!-- ================= COURSE INFORMATION ================= -->
<section class="cpage-section" id="details" style="background:var(--bg-alt)">
  <div class="wrap">
    <div class="section-head reveal" style="max-width:760px">
      <span class="eyebrow">Course Information</span>
      <h2>Programme details</h2>
    </div>
    <div class="info-panel reveal">
      <dl class="sc-list">
        ${rows}
      </dl>
    </div>
  </div>
</section>

`;
}

/**
 * Fees, and the funding scope note.
 *
 * The note is NOT gated on showFees, and that is the whole point of it. Its job
 * is not to qualify the fee table: it is to stop the subsidy claim contradicting
 * the eight short course pages, which say plainly that those courses are
 * commercial and not subsidised. The standfirst and the comparison table make
 * that claim whether or not a figure is on the page, so the note has to survive
 * independently of the figures. An earlier version tied the two together and
 * left a page that claimed a subsidy with nothing scoping it.
 *
 * So there are three states, decided here rather than at the call site: fees
 * with the note inside them, the note alone in the same slot, or nothing.
 */
const hasFees = p => Boolean(p.showFees) && p.fees.length > 0;
const hasFeesSection = p => hasFees(p) || Boolean(p.fundingNote);
const fundingNoteBlock = p => (p.fundingNote
  ? `<div class="funding-note"><h3>What this subsidy applies to</h3><p>${esc(p.fundingNote)}</p></div>`
  : "");

function feesSection(p) {
  if (!hasFeesSection(p)) return "";
  // The note alone, in the slot the fees would have occupied.
  if (!hasFees(p)) {
    return `<!-- ================= FUNDING ================= -->
<section class="cpage-section fees" id="fees">
  <div class="wrap">
    <div class="section-head reveal" style="max-width:760px">
      <span class="eyebrow">Funding</span>
      <h2>What this subsidy applies to</h2>
    </div>
    <div class="fees-body reveal">
      ${fundingNoteBlock(p)}
    </div>
  </div>
</section>

`;
  }
  const tiers = p.fees.map(([e, f]) => `<tr><td class="t t-wrap">${esc(e)}</td><td>${esc(f)}</td></tr>`).join("\n          ");
  const refunds = p.refundTerms.length ? `<h3 class="block-h3">If you withdraw or cancel</h3>
      <div class="policy-table-scroll">
        <table class="day-table">
          <thead><tr><th scope="col">When we receive your notice</th><th scope="col">Outcome</th></tr></thead>
          <tbody>
          ${p.refundTerms.map(([w, o]) => `<tr><td class="t t-wrap">${esc(w)}</td><td>${esc(o)}</td></tr>`).join("\n          ")}
          </tbody>
        </table>
      </div>` : "";
  const payment = p.paymentMethods.length
    ? `<h3 class="block-h3">Payment</h3>\n      <p>${p.paymentMethods.map(esc).join(", ")}.</p>`
    : "";
  return `<!-- ================= FEES AND FUNDING ================= -->
<section class="cpage-section fees" id="fees">
  <div class="wrap">
    <div class="section-head reveal" style="max-width:760px">
      <span class="eyebrow">Fees and Funding</span>
      <h2>What it costs, and what the subsidy covers</h2>
    </div>
    <div class="fees-body reveal">
      <div class="policy-table-scroll">
        <table class="day-table">
          <thead><tr><th scope="col">Eligibility</th><th scope="col">Total course fee</th></tr></thead>
          <tbody>
          ${tiers}
          </tbody>
        </table>
      </div>
      ${p.feeNote ? `<p class="fee-note">${esc(p.feeNote)}</p>` : ""}
      ${payment}
      ${refunds}
      ${fundingNoteBlock(p)}
    </div>
  </div>
</section>

`;
}

/** Partners, each with the limits of its own role stated. */
function partnersSection(p) {
  if (!hasPartners(p)) return "";
  // h3, not the h4 the assessment cards use, so the outline does not skip a
  // level under the section heading.
  const cards = p.partners.map(x => `<article class="assess-card reveal">
        <h3>${esc(x.name)}</h3>
        ${x.role ? `<p class="partner-role">${esc(x.role)}</p>` : ""}
        ${x.body ? `<p>${esc(x.body)}</p>` : ""}
        ${x.url ? `<p><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a></p>` : ""}
        ${x.disclaimer ? `<p class="partner-disclaim">${esc(x.disclaimer)}</p>` : ""}
      </article>`).join("\n      ");
  return `<!-- ================= PARTNERS ================= -->
<section class="cpage-section" id="partners">
  <div class="wrap">
    <div class="section-head reveal" style="max-width:760px">
      <span class="eyebrow">Partners</span>
      <h2>Who else is involved</h2>
    </div>
    <div class="assess-grid">
      ${cards}
    </div>
  </div>
</section>

`;
}

/** The FAQ, and nothing at all when there are no questions. */
function faqSection(p) {
  if (!hasFaqs(p)) return "";
  const items = p.faqs.map(([q, a]) => `<details class="faq-item">
        <summary>${esc(q)}</summary>
        <div class="faq-a">${esc(a)}</div>
      </details>`).join("\n      ");
  return `<!-- ================= FAQ ================= -->
<section class="section faq" id="faq">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">Questions</span>
      <h2>Frequently asked questions</h2>
    </div>
    <div class="faq-list reveal">
      ${items}
    </div>
  </div>
</section>

`;
}

/**
 * Career programme page.
 *
 * A third sibling of renderCoursePage and renderWorkshopPage rather than a
 * branch inside either. This page makes no assessment claim, declares no
 * delivery hour split, and is not delivered by Future Edge Institute at all,
 * so nothing it needs belongs in a template shaped around a short course.
 *
 * The structured data says the same thing the attribution does: the provider is
 * Kydon Group with the academic partner named as contributor, and the credential
 * carries its actual issuer. Defaulting either to Future Edge Institute would
 * put a claim in the machine readable data that the visible page contradicts.
 */
function renderProgrammePage(template, p, s, now) {
  const enrol = enrolment(p, now);
  const fullTitle = p.subtitle ? `${p.title}: ${p.subtitle}` : p.title;
  const canonical = `${s.siteUrl}/${p.slug}.html`;
  const desc = p.standfirst || p.subtitle || p.title;
  const partner = p.partners.length ? p.partners[0].name : "";
  const schemaCourse = JSON.stringify({
    "@context": "https://schema.org", "@type": "Course",
    name: fullTitle, description: desc,
    provider: { "@type": "Organization", name: "Kydon Group" },
    ...(partner ? { contributor: { "@type": "CollegeOrUniversity", name: partner } } : {}),
    ...(p.certificateAwarded ? { educationalCredentialAwarded: p.certificateAwarded } : {}),
    url: canonical,
  });
  const schemaCrumb = JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${s.siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Programmes", item: `${s.siteUrl}/#courses` },
      { "@type": "ListItem", position: 3, name: fullTitle, item: canonical }],
  });
  // FAQPage for this page's own questions only, which is the site rule: no two
  // pages may claim the same question. These are new, so nothing collides.
  const schemaFaq = p.faqs.length
    ? `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: p.faqs.map(([q, a]) => ({
          "@type": "Question", name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      })}</script>\n`
    : "";
  const hero = p.hero;
  return fill(template, {
    CODE: p.code, SLUG: p.slug,
    TITLE: esc(p.title), SUBTITLE: esc(p.subtitle), FULL_TITLE: esc(fullTitle),
    META_DESC: esc(desc), CANONICAL: canonical,
    GA4_ID: s.ga4Id, META_PIXEL_ID: s.metaPixelId, HS_PORTAL: s.hubspotPortalId,
    SCHEMA_COURSE: schemaCourse, SCHEMA_CRUMB: schemaCrumb, SCHEMA_FAQ: schemaFaq,
    HEADER: siteHeader({
      brand: "index.html",
      items: [["About", "about.html"], programmesItem("index.html#courses", [p]),
        // The section is optional, so the nav follows the same predicate it
        // does. Pointing at #fees on a page that rendered no such section would
        // be a link into nothing.
        ["Fees and Funding", hasFeesSection(p) ? "#fees" : "index.html#funding"],
        ["For Organisations", "index.html#corporate"]],
      wa: waLink(s.whatsappNumber, p.code), cta: "#enquire",
    }),
    NAV_SCRIPT: navScript(true),
    GROUP_DESCRIPTOR: groupDescriptor(s),
    WA_LINK: waLink(s.whatsappNumber, p.code),
    EMAIL: s.enquiryEmail,
    MAIL_SUBJECT: encodeURIComponent(`Enquiry: ${p.title}`),
    // The hero photo reuses the about page treatments, so a photograph uploaded
    // here crops exactly as one uploaded there.
    HERO_MOD: aboutHeroMod(hero),
    HERO_STYLE: aboutHeroStyle(hero),
    HERO_BG: aboutHeroBg(hero),
    HERO_FIG: aboutHeroFig(hero),
    // Absent rather than marked. There is no confirmation style on this site: a
    // value that is not settled is left out and recorded in docs/DECISIONS.md.
    EYEBROW: p.eyebrow ? `<span class="eyebrow">${esc(p.eyebrow)}</span>\n    ` : "",
    STANDFIRST: esc(p.standfirst),
    STAT_BAR: statBar(p.stats),
    ENROLMENT_LINE: enrol.line,
    CTA_PRIMARY: esc(enrol.cta),
    ATTRIBUTION_HERO: attributionBlock(p.attribution, "hero"),
    SECTION_NAV: sectionNav(p),
    POSITIONING_SECTION: positioningSection(p),
    MONTHS_SECTION: monthsSection(p),
    MODULES_SECTION: modulesSection(p),
    SCHEDULE_SECTION: scheduleSection(p, s.enquiryEmail),
    INTAKES_SECTION: intakesSection(p, now),
    AUDIENCE_SECTION: audienceSection(p),
    INFO_SECTION: infoSection(p),
    FEES_SECTION: feesSection(p),
    PARTNERS_SECTION: partnersSection(p),
    FAQ_SECTION: faqSection(p),
    OG_IMAGE: siteOgImage(s),
  });
}

/**
 * Legal and policies page. The document body lives in content/policies.html
 * so the prose stays out of the build script; it is injected first so that
 * tokens used inside it are filled along with the template's own.
 */
function renderPoliciesPage(template, body, s, updated, programmes) {
  const withBody = template.replace("{{POLICY_BODY}}", () => body);
  return fill(withBody, {
    HEADER: staticPageHeader(s, programmes),
    NAV_SCRIPT: navScript(programmes.length > 0),
    GROUP_DESCRIPTOR: groupDescriptor(s),
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
function renderAboutPage(template, s, team, page, programmes) {
  const hero = page.hero;
  return fill(template, {
    TEAM_SECTION: renderTeam(team),
    ABOUT_HERO_MOD: aboutHeroMod(hero),
    ABOUT_HERO_STYLE: aboutHeroStyle(hero),
    ABOUT_HERO_BG: aboutHeroBg(hero),
    ABOUT_HERO_FIG: aboutHeroFig(hero),
    STORY_MOD: storyMod(page.storyPhoto),
    STORY_PHOTO: storyPhoto(page.storyPhoto),
    HEADER: staticPageHeader(s, programmes),
    NAV_SCRIPT: navScript(programmes.length > 0),
    GROUP_DESCRIPTOR: groupDescriptor(s),
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
  content = splitSeries(resolveContentTokens(content));
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
  const programmes = content.careerProgrammes;
  const idx = fill(idxTpl, {
    HEADER: siteHeader({
      brand: "#top",
      items: [["About", "about.html"], programmesItem("#courses", programmes),
        ["The Pathways", "#pathway"], ["For Organisations", "#corporate"]],
      wa: waApostrophe(waLink(s.whatsappNumber)), cta: "#contact",
    }),
    NAV_SCRIPT: navScript(programmes.length > 0),
    GROUP_DESCRIPTOR: groupDescriptor(s),
    COURSE_CARDS: renderCourseCards(content),
    CORPORATE_PHOTO: corporatePhoto(content.homePage.corporatePhoto),
    CONTACT_MOD: contactMod(content.homePage.ctaPhoto),
    CTA_PHOTO: ctaPhoto(content.homePage.ctaPhoto),
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
      renderCoursePage(cTpl, n, c, content, s, new Date()));
  }

  // workshop pages: the participation based Adoption series
  const wTpl = fs.readFileSync(path.join(ROOT, "templates/workshop.template.html"), "utf8");
  for (const [n, w] of Object.entries(content.workshops)) {
    fs.writeFileSync(path.join(DIST, `${w.slug}.html`),
      renderWorkshopPage(wTpl, n, w, s, content.careerProgrammes));
  }

  // career programme pages: the long cohort programmes, outside the catalogue.
  // The list is built once and feeds both the write loop and the sitemap below,
  // so a page and its sitemap entry cannot diverge. Unpublished programmes are
  // already absent from the collection, so they reach neither.
  const prTpl = fs.readFileSync(path.join(ROOT, "templates/programme.template.html"), "utf8");
  const programmePages = content.careerProgrammes.map(p => ({
    file: `${p.slug}.html`, html: renderProgrammePage(prTpl, p, s, new Date()),
  }));
  for (const { file, html } of programmePages) {
    fs.writeFileSync(path.join(DIST, file), html);
  }

  // about
  const aTpl = fs.readFileSync(path.join(ROOT, "templates/about.template.html"), "utf8");
  fs.writeFileSync(path.join(DIST, "about.html"),
    renderAboutPage(aTpl, s, content.team, content.aboutPage, content.careerProgrammes));

  // policies
  const pTpl = fs.readFileSync(path.join(ROOT, "templates/policies.template.html"), "utf8");
  const pBody = fs.readFileSync(path.join(ROOT, "content/policies.html"), "utf8");
  fs.writeFileSync(path.join(DIST, "policies.html"),
    renderPoliciesPage(pTpl, pBody, s, formatUpdated(new Date()), content.careerProgrammes));

  // sitemap
  const pages = ["",
    ...Object.values(content.courses).map(c => `${c.slug}.html`),
    ...Object.values(content.workshops).map(w => `${w.slug}.html`),
    ...programmePages.map(x => x.file),
    "about.html", "policies.html"];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages.map(p => `  <url><loc>${s.siteUrl}/${p}</loc></url>`).join("\n") + "\n</urlset>\n";
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap);
  fs.writeFileSync(path.join(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${s.siteUrl}/sitemap.xml\n`);

  console.log(`Built ${pages.length} pages to dist/ from ${source}`);
})();
