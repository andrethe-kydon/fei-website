// Sanity schema: figure (object)
//
// The single image object behind every photograph on the site. Declared once
// and reused, so alt text, the licence record and the focal point behave the
// same way wherever a photograph appears.
//
// Hotspot is the part that earns its place: an editor sets the focal point once
// and every crop holds the subject, so the same photograph cannot lose a face
// at one ratio and keep it at another. The build does not read the hotspot yet:
// sanityImageUrl() in build/build.js centre crops. Setting focal points now
// means they are already right when it does.
//
// lqip is the blurred preview Sanity generates, for giving a block colour while
// the photograph loads. palette gives the dominant colours. Both are metadata
// on the asset: neither is fetched by the current GROQ query, which takes the
// raw asset reference and nothing else.
//
// Every field is optional, and alt text is enforced as a warning rather than an
// error, so an incomplete photograph still saves and publishes and an empty
// figure stays a valid silent state.
export default {
  name: 'figure',
  title: 'Photo',
  type: 'image',
  options: {
    hotspot: true,
    metadata: ['lqip', 'palette'],
  },
  fields: [
    {
      name: 'alt',
      title: 'Alt text',
      description: 'What the photograph shows, in plain words, for screen readers and search. Example: three colleagues reviewing a workflow on a laptop.',
      type: 'string',
      validation: R => R.required().min(10).max(160)
        .warning('Every photograph needs alt text before the page goes live.'),
    },
    {
      name: 'caption',
      title: 'Caption',
      description: 'Optional, shown under the photograph. Leave empty unless the caption adds something the picture does not. Never write a caption implying a library photograph shows one of our own runs.',
      type: 'string',
      validation: R => R.max(120),
    },
    {
      name: 'credit',
      title: 'Credit and licence reference',
      description: 'Internal only, never rendered. Record the library, the asset ID and the licence type, for example: Getty 1234567890, standard licence, purchased 2 September 2026. This is what we would produce if a licence were ever queried.',
      type: 'string',
    },
    {
      name: 'isStock',
      title: 'Library photo',
      description: 'On for a purchased library photograph. Off only for photography of a real Future Edge Institute run. A library photograph must never sit beside a testimonial, a quotation or a named person: a stock face under a real name misrepresents the institute.',
      type: 'boolean',
      initialValue: true,
    },
  ],
  preview: {
    select: {media: 'asset', title: 'alt', subtitle: 'credit'},
  },
}
