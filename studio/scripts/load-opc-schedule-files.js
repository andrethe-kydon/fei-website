/**
 * Upload the two schedule PDFs and attach them to the OPC Launchpad document.
 *
 * The dates, the weekly pattern and the holidays travel in seed-opc.ndjson, which
 * is text and reviewable in a diff. A file asset cannot: it has to be uploaded
 * before anything can reference it, so this script does that half and then
 * patches schedule.files to point at the results.
 *
 * Idempotent by originalFilename: a PDF already in the dataset is reused rather
 * than uploaded again, so running this twice does not litter the asset store
 * with duplicates. schedule.files is then set outright, not appended, so the
 * document ends in the same state whichever way it started.
 *
 * Run it through the CLI, which authenticates as the logged in user:
 *
 *   cd studio
 *   npx sanity exec scripts/load-opc-schedule-files.js --with-user-token
 */
import fs from 'node:fs'
import path from 'node:path'
import {getCliClient} from 'sanity/cli'

const DOC = 'careerProgramme-opc'
const KIT = path.join(process.cwd(), '..', 'schedule-kit')
const FILES = [
  {
    name: 'FEI_OPC_Schedule_Overview.pdf',
    label: 'Schedule overview',
    description: 'One page. Dates, the weekly pattern and the eight modules.',
  },
  {
    name: 'FEI_OPC_Schedule_Detailed.pdf',
    label: 'Detailed schedule',
    description: 'Every session, day by day, across the five months.',
  },
]

const client = getCliClient({
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_WRITE_TOKEN,
})

async function assetFor({name}) {
  const existing = await client.fetch(
    '*[_type == "sanity.fileAsset" && originalFilename == $name][0]{_id, size}',
    {name},
  )
  if (existing) {
    console.log(`  reusing ${name} (${existing.size} bytes)`)
    return existing._id
  }
  const file = path.join(KIT, name)
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`)
  const uploaded = await client.assets.upload('file', fs.createReadStream(file), {
    filename: name,
    contentType: 'application/pdf',
  })
  console.log(`  uploaded ${name} (${uploaded.size} bytes)`)
  return uploaded._id
}

async function main() {
  const {projectId, dataset} = client.config()
  console.log(`${projectId}/${dataset}: attaching ${FILES.length} PDFs to ${DOC}`)
  const files = []
  for (const [i, f] of FILES.entries()) {
    files.push({
      _key: `schedfile${i}`,
      _type: 'object',
      label: f.label,
      description: f.description,
      file: {_type: 'file', asset: {_type: 'reference', _ref: await assetFor(f)}},
    })
  }
  await client.patch(DOC).set({'schedule.files': files}).commit()
  console.log(`done: schedule.files set to ${files.length} entries`)
}

main().catch((e) => {
  console.error(`FAILED: ${e.message}`)
  process.exit(1)
})
