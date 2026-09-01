/**
 * Push siteSettings values from studio/seed.ndjson to the live document.
 *
 * siteSettings is a singleton edited in place, so a `dataset import` of
 * seed.ndjson would replace the whole document and discard any Studio edit to a
 * field this script is not concerned with. This patches named fields only.
 *
 * The seed file is the single source for these values, so the repo and the
 * dataset cannot drift: change it there, run this, and both agree. Idempotent.
 *
 *   cd studio
 *   npx sanity exec scripts/sync-site-settings.js --with-user-token -- --dry-run
 *   npx sanity exec scripts/sync-site-settings.js --with-user-token
 */
import fs from 'node:fs'
import path from 'node:path'
import {getCliClient} from 'sanity/cli'

// Deliberately not every field. Tracking IDs and the HubSpot form GUID are
// expected to be set in the Studio ahead of the repo, so pushing placeholders
// over them would undo real configuration.
const FIELDS = ['enquiryEmail', 'groupDescriptor', 'whatsappNumber', 'siteUrl', 'rtpStatement']

const dryRun = process.argv.includes('--dry-run')
const client = getCliClient({
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_WRITE_TOKEN,
})

function seedSettings() {
  const file = path.join(process.cwd(), 'seed.ndjson')
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const doc = JSON.parse(line)
    if (doc._type === 'siteSettings') return doc
  }
  throw new Error('no siteSettings document in seed.ndjson')
}

async function main() {
  const {projectId, dataset} = client.config()
  const seed = seedSettings()
  const live = (await client.fetch('*[_id == "siteSettings"][0]')) || {}
  const patch = {}
  for (const f of FIELDS) {
    if (seed[f] === undefined) continue
    if (live[f] !== seed[f]) patch[f] = seed[f]
  }
  const keys = Object.keys(patch)
  console.log(`${projectId}/${dataset}: siteSettings`)
  if (!keys.length) {
    console.log('  already in step, nothing to patch')
    return
  }
  for (const k of keys) console.log(`  ${k}: ${JSON.stringify(live[k])} -> ${JSON.stringify(patch[k])}`)
  if (dryRun) {
    console.log('  dry run, nothing written')
    return
  }
  await client.patch('siteSettings').set(patch).commit()
  console.log(`  patched ${keys.length} field(s)`)
}

main().catch(e => {
  console.error(`FAILED: ${e.message}`)
  process.exit(1)
})
