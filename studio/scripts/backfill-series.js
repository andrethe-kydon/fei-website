/**
 * Backfill series and codePrefix on course documents that predate those fields.
 *
 * These documents carry Studio edits, so this is a patch and not a re-import: a
 * `sanity dataset import` of seed.ndjson would overwrite every field back to
 * its seeded value and destroy that work. This script touches two fields and
 * nothing else.
 *
 * It uses setIfMissing and queries only documents where series is undefined, so
 * running it twice is a no-op the second time: nothing is found, nothing is
 * patched, and an already correct document can never be rewritten.
 *
 * Run it through the CLI, which authenticates as the logged in user, so no
 * token needs to be created or exported. Note the `--` before the script's own
 * flags: without it the CLI swallows them.
 *
 *   cd studio
 *   npx sanity exec scripts/backfill-series.js --with-user-token -- --dry-run
 *   npx sanity exec scripts/backfill-series.js --with-user-token
 *
 * or, equivalently, `npm run backfill-series` and `npm run backfill-series:dry`.
 *
 * The project id and dataset come from sanity.cli.js, which is the single place
 * they are configured. SANITY_WRITE_TOKEN is honoured when set, for CI, but is
 * not required: without it the CLI user's own credentials are used.
 */
import {getCliClient} from 'sanity/cli'

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
    `*[_type == "course" && !defined(series)]{_id, number, title, codePrefix} | order(number asc)`
  )

  if (!docs.length) {
    console.log('Nothing to do: every course document already has a series.')
    return
  }

  console.log(`Found ${docs.length} course document(s) without a series.`)

  let patched = 0
  for (const doc of docs) {
    const label = `${doc._id} (${doc.codePrefix || 'AOP'} ${doc.number}: ${doc.title})`
    if (dryRun) {
      console.log(`  would patch ${label} -> series: Operator, codePrefix: AOP`)
      continue
    }
    // setIfMissing, so a codePrefix an editor has already set by hand survives.
    await client
      .patch(doc._id)
      .setIfMissing({series: 'Operator', codePrefix: 'AOP'})
      .commit({autoGenerateArrayKeys: false})
    patched++
    console.log(`  patched ${label}`)
  }

  if (dryRun) {
    console.log(`Dry run complete. ${docs.length} document(s) would be patched.`)
  } else {
    console.log(`Done. Patched ${patched} document(s). Safe to run again.`)
  }
}

main().catch(err => {
  console.error(`ERROR: ${err.message}`)
  process.exit(1)
})
