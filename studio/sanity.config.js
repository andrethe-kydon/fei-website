import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './schemaTypes'

// One document each, edited in place: never created from the "create new" menu,
// never deleted, never duplicated.
const SINGLETONS = ['siteSettings', 'homePage', 'aboutPage']

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
            // Page photography. Neither page has its copy in the CMS: these
            // documents exist so the images on them are editable without the
            // prose following them in.
            S.listItem()
              .title('Homepage')
              .id('homePage')
              .child(
                S.document()
                  .schemaType('homePage')
                  .documentId('homePage')
                  .title('Homepage')
              ),
            S.listItem()
              .title('About Page')
              .id('aboutPage')
              .child(
                S.document()
                  .schemaType('aboutPage')
                  .documentId('aboutPage')
                  .title('About Page')
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
            // The long cohort programmes: OPC now, FDO later. A separate list
            // rather than a third series of `course`, because they are
            // deliberately outside the #courses catalogue and share none of the
            // short course shape.
            S.listItem()
              .title('Career Programmes')
              .schemaType('careerProgramme')
              .child(
                S.documentTypeList('careerProgramme')
                  .title('Career Programmes')
                  .defaultOrdering([{field: 'code', direction: 'asc'}])
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
      // Hide the singletons from the "create new" menu: there is only ever one
      ...prev.filter((t) => !SINGLETONS.includes(t.schemaType)),
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
    // Remove the delete and duplicate actions from the singletons
    actions: (prev, {schemaType}) =>
      SINGLETONS.includes(schemaType)
        ? prev.filter(({action}) => action !== 'delete' && action !== 'duplicate')
        : prev,
  },
})
