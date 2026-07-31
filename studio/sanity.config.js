import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'default',
  title: 'Future Edge Institute',

  projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'YOUR_PROJECT_ID',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            // Site Settings is a singleton: one document, edited in place
            S.listItem()
              .title('Site Settings')
              .id('siteSettings')
              .child(
                S.document()
                  .schemaType('siteSettings')
                  .documentId('siteSettings')
                  .title('Site Settings')
              ),
            S.divider(),
            S.listItem()
              .title('Courses')
              .schemaType('course')
              .child(
                S.documentTypeList('course')
                  .title('Courses')
                  .defaultOrdering([{field: 'number', direction: 'asc'}])
              ),
          ]),
    }),
  ],

  schema: {
    types: schemaTypes,
    // Hide Site Settings from the "create new" menu: there is only ever one
    templates: (prev) => prev.filter((t) => t.schemaType !== 'siteSettings'),
  },

  document: {
    // Remove the delete action for the settings singleton
    actions: (prev, {schemaType}) =>
      schemaType === 'siteSettings'
        ? prev.filter(({action}) => action !== 'delete' && action !== 'duplicate')
        : prev,
  },
})
