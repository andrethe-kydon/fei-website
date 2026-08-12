// Sanity schema: person
//
// One document per person, referenced from wherever they appear. A trainer is
// defined here once and pointed at from every course they teach, so a change of
// role or photo reaches all of them: `trainers` on the course document is an
// array of references to this type, not a repeated inline object.
//
// `showOnAbout` controls the team grid on the about page only. It does not
// affect the trainer section on a programme page, which is driven entirely by
// the references on that course, so a trainer can be credited on their courses
// without appearing in the team grid.
export default {
  name: 'person',
  title: 'Person',
  type: 'document',
  fields: [
    {name: 'name', title: 'Name', type: 'string', validation: R => R.required()},
    {name: 'role', title: 'Role', type: 'string', validation: R => R.required()},
    {
      name: 'bio',
      title: 'Bio',
      description: 'A short paragraph. Shown in full on the about page team grid and on the programme pages of any course this person trains.',
      type: 'text',
      rows: 4,
    },
    {
      name: 'photo',
      title: 'Photo',
      description: 'Square works best: it is cropped to 1:1. Leave empty and a branded placeholder carrying the initials is used instead.',
      type: 'image',
      options: {hotspot: true},
    },
    {
      name: 'order',
      title: 'Display order',
      description: 'Low numbers first. Sets the sequence in the team grid.',
      type: 'number',
      initialValue: 100,
    },
    {
      name: 'showOnAbout',
      title: 'Show on the about page',
      description: 'Uncheck to keep this person out of the team grid. Their trainer credit on a programme page is unaffected.',
      type: 'boolean',
      initialValue: true,
    },
  ],
  orderings: [
    {
      title: 'Display order',
      name: 'orderAsc',
      by: [{field: 'order', direction: 'asc'}, {field: 'name', direction: 'asc'}],
    },
  ],
  preview: {
    select: {title: 'name', subtitle: 'role', media: 'photo'},
  },
}
