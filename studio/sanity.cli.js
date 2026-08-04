import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    // Replace with your project ID from sanity.io/manage, or set
    // SANITY_STUDIO_PROJECT_ID in studio/.env.local
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || '6h8r2soo',
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  },
  // Set here rather than answered at the prompt, which crashes the CLI.
  // Deploys the hosted Studio to https://fei-studio.sanity.studio
  studioHost: 'fei-studio',
})
