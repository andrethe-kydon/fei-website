import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    // Replace with your project ID from sanity.io/manage, or set
    // SANITY_STUDIO_PROJECT_ID in studio/.env.local
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || '6h8r2soo',
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  },
})
