// Sanity schema: homePage (create exactly one document of this type)
//
// The homepage has never had a content document: its copy lives in
// templates/index.template.html and is deliberately staying there. This
// document exists only to hold the photography, so the images become editable
// without dragging the prose into the CMS with them.
//
// Every field is optional. With all of them empty the homepage renders exactly
// as it does now, which is the state it ships in until photographs arrive.
//
// There is deliberately no hero field. The homepage hero keeps its animated
// illustration and will not carry a photograph, so offering the choice in the
// Studio would only invite a change the front end does not implement. The
// heroMedia type still exists and is used by aboutPage.
//
// There is deliberately no outcomePhotos field either: #outcomes is five glyphs
// and stays that way.
//
// There is deliberately no per series photograph, and no Operator photograph at
// all. The photography brief predates the homepage as it currently stands and
// assumed a band per series. There is none: #courses is one flat filtered grid
// of all eight programmes, with a single heading, a single filter row and a
// single card grid, distinguished only by a pill on each card. Photographs
// cannot sit there. The filters also work by hiding and showing sibling cards
// within that one grid, so splitting it into two labelled bands would break
// "All programmes" and the function filters, which cut across both series.
//
// #corporate is the only series specific section on the page: it is Adoption
// only, which is why the corporate photograph below survives and the Operator
// one does not. A field with nowhere to appear invites an editor to fill it and
// then wonder why nothing happens.
export default {
  name: 'homePage',
  title: 'Homepage',
  type: 'document',
  fields: [
    {
      name: 'corporatePhoto',
      title: 'For Organisations photo',
      description: 'Appears in the For Organisations section (#corporate) on the homepage. A small group of senior people around a table, laptops open. Reads as a corporate workshop, not a lecture.',
      type: 'figure',
    },
    {
      name: 'ctaPhoto',
      title: 'Enquiry band photo',
      description: 'Sits behind the enquiry band at the foot of the page, under a heavy navy veil, so nothing detailed survives. A wide, quiet room shot.',
      type: 'figure',
    },
  ],
  preview: {prepare: () => ({title: 'Homepage'})},
}
