// Sanity schema: heroMedia (object)
//
// A figure wrapped in the hero treatment, so which hero a page carries is a
// content decision rather than a code change.
//
// The conditional fields read Sanity's conditional property context, which is
// {document, parent, value, currentUser} and not the document itself. Inside an
// object the sibling values sit on parent, so the treatment is read as
// parent.layout. Reading it off the context directly would silently evaluate to
// undefined and the condition would never fire.
//
// The default treatment is no photograph, so an untouched heroMedia is complete
// and valid and its page renders exactly as it does today. Choosing a treatment
// without supplying a photograph is a warning rather than an error, so nothing
// here can block a publish.
export default {
  name: 'heroMedia',
  title: 'Hero photo',
  type: 'object',
  fields: [
    {
      name: 'layout',
      title: 'Hero treatment',
      description: 'Split keeps the headline on flat navy and is the safer choice. Full width sets the copy over the photograph behind a navy veil, so it needs a photograph with a calm area on the left.',
      type: 'string',
      options: {
        list: [
          {title: 'No photo, navy panel only', value: 'none'},
          {title: 'Split: copy left, photo right', value: 'split'},
          {title: 'Full width photo behind the copy', value: 'full'},
        ],
        layout: 'radio',
      },
      initialValue: 'none',
    },
    {
      name: 'photo',
      title: 'Photo',
      type: 'figure',
      hidden: ({parent}) => !parent || !parent.layout || parent.layout === 'none',
      validation: R => R.custom((value, context) => {
        const layout = context.parent && context.parent.layout
        if (layout && layout !== 'none' && !(value && value.asset)) {
          return 'Choose a photograph, or set the treatment back to navy panel only.'
        }
        return true
      }).warning(),
    },
    {
      name: 'veil',
      title: 'Veil strength',
      description: 'How much navy sits over the photograph, as a percentage. Below 60 the headline starts to lose contrast. 72 is the tested default.',
      type: 'number',
      hidden: ({parent}) => !parent || parent.layout !== 'full',
      initialValue: 72,
      validation: R => R.min(50).max(90),
    },
  ],
}
