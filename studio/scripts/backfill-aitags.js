/**
 * Backfill aiTags on Operator course documents that predate the field.
 *
 * A patch and not a re-import, for the same reason as backfill-series.js: these
 * documents carry Studio edits that importing seed.ndjson would overwrite. This
 * script touches one field and nothing else.
 *
 * AOP 105 and 106 are absent from the map deliberately. The capability tags mark
 * courses whose curriculum genuinely teaches AI, so those two carry none, and
 * this script must never invent tags to make the catalogue look uniform.
 *
 * Only documents whose codePrefix is AOP or unset are considered, so the two AIA
 * documents keep the tags they were imported with.
 *
 * It uses setIfMissing and queries only documents where aiTags is undefined, so
 * running it twice is a no-op the second time. A document with an explicitly
 * empty aiTags array is left alone: an empty array is a decision that the course
 * teaches no AI, not missing data.
 *
 * Run it through the CLI, which authenticates as the logged in user, so no
 * token needs to be created or exported. Note the `--` before the script's own
 * flags: without it the CLI swallows them.
 *
 *   cd studio
 *   npx sanity exec scripts/backfill-aitags.js --with-user-token -- --dry-run
 *   npx sanity exec scripts/backfill-aitags.js --with-user-token
 *
 * or, equivalently, `npm run backfill-aitags` and `npm run backfill-aitags:dry`.
 *
 * The project id and dataset come from sanity.cli.js, which is the single place
 * they are configured. SANITY_WRITE_TOKEN is honoured when set, for CI, but is
 * not required: without it the CLI user's own credentials are used.
 */
import {getCliClient} from 'sanity/cli'

// Course number to capability tags. Numbers absent from this map are skipped.
const TAGS_BY_NUMBER = {
  101: ['AI-Assisted Research'],
  102: ['AI Agents', 'Model Selection'],
  103: ['RAG Knowledge Bases', 'AI Agent Teams'],
  104: ['AI Workflow Automation', 'Orchestration'],
}

const dryRun = process.argv.includes('--dry-run')

const client = getCliClient({
  apiVersion: '2024-01-01',
  useCdn: false, // never read a cached copy before writing to it
  // An unset env var leaves this undefined, which falls through to the token
  // the CLI already holds. Setting it overrides that, for CI.
  token: process.env.SANITY_WRITE_TOKEN,
})

async function main() {
  const {projectId, dataset, token} = client.config()
  console.log(`Project ${projectId}, dataset ${dataset}${dryRun ? ' (dry run)' : ''}`)

  if (!token && !dryRun) {
    console.error(
      'ERROR: no credentials. Run this through `sanity exec --with-user-token`, ' +
        'or set SANITY_WRITE_TOKEN. Pass --dry-run to see what would change ' +
        'without writing.'
    )
    process.exit(1)
  }

  const docs = await client.fetch(
    `*[_type == "course" && !defined(aiTags) && (!defined(codePrefix) || codePrefix == "AOP")]
      {_id, number, title, codePrefix} | order(number asc)`
  )

  if (!docs.length) {
    console.log('Nothing to do: no Operator course document is missing aiTags.')
    return
  }

  console.log(`Found ${docs.length} Operator course document(s) without aiTags.`)

  let patched = 0
  let skipped = 0
  for (const doc of docs) {
    const label = `${doc._id} (${doc.codePrefix || 'AOP'} ${doc.number}: ${doc.title})`
    const tags = TAGS_BY_NUMBER[doc.number]

    if (!tags) {
      console.log(`  skipped ${label}: this course teaches no AI, so it carries no tags`)
      skipped++
      continue
    }

    if (dryRun) {
      console.log(`  would patch ${label} -> aiTags: ${JSON.stringify(tags)}`)
      continue
    }

    await client
      .patch(doc._id)
      .setIfMissing({aiTags: tags})
      .commit({autoGenerateArrayKeys: false})
    patched++
    console.log(`  patched ${label} -> aiTags: ${JSON.stringify(tags)}`)
  }

  if (dryRun) {
    const would = docs.filter(d => TAGS_BY_NUMBER[d.number]).length
    console.log(`Dry run complete. ${would} document(s) would be patched, ${skipped} skipped.`)
  } else {
    console.log(`Done. Patched ${patched} document(s), skipped ${skipped}. Safe to run again.`)
  }
}

main().catch(err => {
  console.error(`ERROR: ${err.message}`)
  process.exit(1)
})
