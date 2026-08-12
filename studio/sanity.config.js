import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'default',
  title: 'Future Edge Institute',

  projectId: process.env.SANITY_STUDIO_PROJECT_ID || '6h8r2soo',
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
            // One document type, two series, two lists. Keeping them apart in
            // the Studio mirrors how they are kept apart on the site: the
            // assessed Operator courses and the participation based Adoption
            // workshops are never presented as one catalogue.
            S.listItem()
              .title('Operator Series (AOP)')
              .schemaType('course')
              .child(
                S.documentTypeList('course')
                  .title('Operator Series (AOP)')
                  // An unset series means Operator, matching the default in
                  // build.js. Documents created before the series field existed
                  // must not disappear from the Studio while they wait to be
                  // backfilled: see scripts/backfill-series.js.
                  .filter('_type == "course" && (!defined(series) || series == "Operator")')
                  .defaultOrdering([{field: 'number', direction: 'asc'}])
                  .initialValueTemplates([
                    S.initialValueTemplateItem('course-operator'),
                  ])
              ),
            S.listItem()
              .title('Adoption Series (AIA)')
              .schemaType('course')
              .child(
                S.documentTypeList('course')
                  .title('Adoption Series (AIA)')
                  .filter('_type == "course" && series == "Adoption"')
                  .defaultOrdering([{field: 'number', direction: 'asc'}])
                  .initialValueTemplates([
                    S.initialValueTemplateItem('course-adoption'),
                  ])
              ),
            S.divider(),
            // People: trainers and the team grid on the about page, in the
            // order the grid renders them.
            S.listItem()
              .title('Team')
              .schemaType('person')
              .child(
                S.documentTypeList('person')
                  .title('Team')
                  .defaultOrdering([{field: 'order', direction: 'asc'}])
              ),
          ]),
    }),
  ],

  schema: {
    types: schemaTypes,
    templates: (prev) => [
      // Hide Site Settings from the "create new" menu: there is only ever one
      ...prev.filter((t) => t.schemaType !== 'siteSettings'),
      // One template per series, so creating a document from inside either list
      // lands in that list instead of defaulting to Operator.
      {
        id: 'course-operator',
        title: 'Operator course (AOP)',
        schemaType: 'course',
        value: {series: 'Operator', codePrefix: 'AOP'},
      },
      {
        id: 'course-adoption',
        title: 'Adoption workshop (AIA)',
        schemaType: 'course',
        value: {series: 'Adoption', codePrefix: 'AIA'},
      },
    ],
  },

  document: {
    // Remove the delete action for the settings singleton
    actions: (prev, {schemaType}) =>
      schemaType === 'siteSettings'
        ? prev.filter(({action}) => action !== 'delete' && action !== 'duplicate')
        : prev,
  },
})
