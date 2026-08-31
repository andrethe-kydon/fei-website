// Sanity schema: aboutPage (create exactly one document of this type)
//
// The about page holds its copy in templates/about.template.html, the same way
// the homepage does. This document exists only for its photography.
//
// There is deliberately no people array here. Each person on the about page is
// already a person document, listed under Team, ordered by `order` and included
// by `showOnAbout`, and renderTeam() in build/build.js already renders that grid
// from it. A second inline list would give editors two places to enter the same
// team member and only one of them would reach the page. Portraits are set on
// the person document, where they have always been.
//
// Every field is optional and the page renders as it does today when empty.
export default {
  name: 'aboutPage',
  title: 'About Page',
  type: 'document',
  fields: [
    {
      name: 'hero',
      title: 'Hero photo',
      description: 'The top of the about page. Unlike the homepage hero, which keeps its animated illustration, this one is free to carry a photograph.',
      type: 'heroMedia',
    },
    {
      name: 'storyPhoto',
      title: 'Story photo',
      description: 'Sits beside the institute story. The people on this page are not set here: each one is a Person document under Team.',
      type: 'figure',
    },
  ],
  preview: {prepare: () => ({title: 'About Page'})},
}
