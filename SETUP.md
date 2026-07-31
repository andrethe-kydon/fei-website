# Setup: from this folder to a live, CMS driven site

Follow in order. Steps 1 and 2 get the site live. Steps 3 to 5 turn on the CMS. Step 6 is the launch checklist.

Everything below assumes **Node 18 or newer**. Check with `node -v`; if it is older, or missing, install the current LTS from nodejs.org before starting.

Nothing in the repository needs editing before you begin. The site build has no dependencies, so there is no `npm install` at the root: `npm run build` works straight out of the folder.

---

## Step 1: Local check

From the repository root:

```
npm run build
npx serve dist
```

Open the URL it prints. You should see the homepage and be able to click through to all six course pages. There are no dependencies to install for the site build itself.

---

## Step 2: Start the GitHub project

You are creating a brand new repository for this. Two ways: the GitHub CLI is faster, the web route needs one specific setting to avoid a push conflict.

**First, get the folder in place.** Unzip `fei-website-repo.zip` wherever you keep projects. You should end up with a single folder named `fei-website` containing `build/`, `templates/`, `studio/` and so on. Do not nest it inside another `fei-website` folder, and work in that folder directly (`cd fei-website`) for every command below.

### Option A: GitHub CLI (recommended)

If you have the `gh` command (`brew install gh` on macOS, or github.com/cli/cli), this is one pass:

```
cd fei-website
git init
git add .
git commit -m "Initial commit: FEI website"
git branch -M main
gh repo create fei-website --private --source=. --remote=origin --push
```

Done: the repository is created, connected and pushed.

### Option B: GitHub web interface

1. Go to github.com/new.
2. Repository name: `fei-website`. Visibility: **Private**.
3. **Important:** leave "Add a README file", "Add .gitignore" and "Choose a license" all **unticked**. GitHub must create the repository completely empty. If it adds any file, your first push is rejected and needs an awkward merge to fix.
4. Create the repository, then run:

```
cd fei-website
git init
git add .
git commit -m "Initial commit: FEI website"
git branch -M main
git remote add origin https://github.com/<your-account>/fei-website.git
git push -u origin main
```

### Notes on this repository

- **Private is right.** Nothing here is secret, but the site is pre launch. Vercel deploys private repositories on the free tier without issue.
- **Nothing sensitive is committed.** Tracking IDs are placeholders, the HubSpot portal ID is public by design, and `.gitignore` already excludes `.env` files, `node_modules/` and `dist/`. Never commit a Sanity read token or any API key: those belong in Vercel environment variables and `studio/.env.local`.
- **`studio/` lives in the same repository** as the site. That is deliberate: one project, one history. Vercel only builds the root, because `vercel.json` declares the build command, so the Studio folder is ignored at deploy time.
- **`CLAUDE.md` is in the root.** When you open this folder in Claude Code, it reads that file automatically and inherits the architecture, the house rules (British spelling, no dashes, brand colours, no fees on the site, the exact RTP wording) and the pending items. You should not need to re-explain the project each session.

### Connect Vercel

In Vercel: **Add New, Project**, import the repository you just created. The settings come from `vercel.json`:

- Build command: `npm run build`
- Output directory: `dist`

Deploy. You now have a live URL, and every push to `main` redeploys automatically.

### Working in Claude Code from here

```
cd fei-website
claude
```

Then describe the change you want, for example "add a faculty section to the homepage with four placeholder profiles". Review the diff, then commit and push:

```
git add .
git commit -m "Add faculty section"
git push
```

Vercel picks it up and redeploys within a minute or so.

---

## Step 3: Create the Sanity project

This repository already contains a configured Studio, so you only need to create the Sanity project and tell the Studio its ID. Do **not** run `sanity init` here: it is meant for scaffolding a Studio from scratch and may prompt to overwrite the config and schema files that are already set up for you.

1. Install the Studio's dependencies:

```
cd studio
npm install
```

2. Create the project in the browser at **sanity.io/manage**: sign in, **Create new project**, name it `Future Edge Institute`, and let it create the default dataset named `production` with **public** visibility. (Public means the site build can read content without a token. If you choose private instead, see the note in Step 5.)

3. Copy the **Project ID** shown on the project's page.

4. Create the local env file and paste the ID in:

```
cp .env.local.example .env.local
```

Open `studio/.env.local` and set:

```
SANITY_STUDIO_PROJECT_ID=your_project_id_here
SANITY_STUDIO_DATASET=production
```

5. Log the CLI in, so the seed import in the next step is authorised:

```
npx sanity login
```

Keep the project ID handy: you need it again in Step 5 for Vercel.

---

## Step 4: Load the content and open the Studio

Still in `studio/`:

```
npm run seed      # imports seed.ndjson: all six courses plus Site Settings
npm run dev       # opens the Studio at http://localhost:3333
```

You should see **Site Settings** and **Courses** with AOP 101 to AOP 106 in order. Everything the site displays is editable here.

To give Nada a hosted Studio she can use without running anything locally:

```
npm run deploy
```

Choose a hostname (for example `fei`), and the Studio lives at `https://fei.sanity.studio`. Invite her under Members in sanity.io/manage.

---

## Step 5: Point the site build at Sanity

In Vercel, open the project, then **Settings, Environment Variables**, and add:

| Name | Value |
| --- | --- |
| `SANITY_PROJECT_ID` | your project ID from Step 3 |
| `SANITY_DATASET` | `production` (optional, this is the default) |

Redeploy. The build log should now say `Built 8 pages to dist/ from Sanity (<project id>)`. If Sanity is ever unreachable the build falls back to `content/content.json` and says so, so a CMS problem can never take the site down.

*Private dataset only:* create a read token in sanity.io/manage under API, Tokens, and add it to Vercel as `SANITY_READ_TOKEN`.

### Make publishing redeploy the site

1. In Vercel: **Settings, Git, Deploy Hooks**. Create a hook named `sanity-publish` on branch `main`. Copy the URL.
2. In sanity.io/manage: **API, Webhooks, Create webhook**. Paste the URL, set Dataset to `production`, Trigger on Create, Update and Delete, HTTP method POST. Save.

Now: Nada edits a course, hits Publish, the site rebuilds itself within a minute or two. This is the whole CMS loop working.

---

## Step 6: Before the domain goes live

Content items, all edited in Sanity under **Site Settings**, no code needed:

- [ ] `siteUrl`: the real domain, no trailing slash. This drives canonical URLs and the sitemap.
- [ ] `ga4Id`: the GA4 measurement ID (Nada).
- [ ] `metaPixelId`: the Meta Pixel ID (Nada).
- [ ] `hubspotFormGuid`: from the HubSpot form once created. Portal ID `2457674` is already correct. Suggested fields: first name, last name, email, company (optional), a **Course of interest** dropdown (AOP 101 to AOP 106, OPC Programme, Corporate enquiry, Notify me when funding is available), and a message box.
- [ ] `whatsappNumber`: digits only with country code. Currently the Indonesian number; swap if a Singapore line is set up.

Images, either uploaded per course in Sanity (**Card thumbnail** and **Banner image** fields, which then serve from the Sanity CDN automatically) or committed to `static/assets/courses/` as `aop101.jpg` to `aop106.jpg`. Sizes: 1200 x 750 for cards, 1600 x 640 for banners. The social share image `static/assets/og-image.jpg` at 1200 x 630 is a file commit.

Domain: add it in Vercel under **Settings, Domains** and follow the DNS instructions. Update `siteUrl` in Sanity to match.

---

## Who changes what, after setup

| Change | Where | Who |
| --- | --- | --- |
| Fees, intake dates, course copy, hours, outcomes, images | Sanity Studio, then Publish | Andre or Nada |
| WhatsApp number, tracking IDs, RTP statement, domain | Sanity, Site Settings | Andre or Nada |
| New sections, new page types, layout, design, styling | This repo, via Claude Code | Andre with Claude Code |
| What the content should say (positioning, compliance wording) | This project | Andre with Claude |

## Useful commands

```
npm run build                      # rebuild the site into dist/
cd studio && npm run dev           # local Studio
cd studio && npm run deploy        # publish the hosted Studio
cd studio && npx sanity dataset export production backup.tar.gz   # content backup
```
