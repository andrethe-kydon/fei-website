// Sanity schema: careerProgramme
//
// The long, cohort based programmes: OPC Launchpad now, FDO later. Deliberately
// not the `course` type, which is shaped around short courses: days, a contact
// hour split three ways, declared assessment modes, deliverable gates. A five
// month programme has arcs, modules, fee tiers and a delivering partner, none of
// which `course` can hold.
//
// Also deliberately outside the #courses catalogue. Those filters work by hiding
// and showing siblings in one grid, and a five month programme sitting among
// eight short courses would misrepresent both.
//
// A normal document type, not a singleton: there will be at least two.
//
// Conditional fields read Sanity's conditional property context, which is
// {document, parent, value, currentUser} and not the document itself. For a
// field at the root of the document those two happen to coincide, but course.js
// records what happens when the distinction is missed: the condition silently
// evaluates undefined and the field is hidden forever. Everything here reads the
// value off `document` for that reason.
const feesHidden = ({document}) => !document?.showFees

export default {
  name: 'careerProgramme',
  title: 'Career Programme',
  type: 'document',
  groups: [
    {name: 'overview', title: 'Overview', default: true},
    {name: 'structure', title: 'Modules'},
    {name: 'admin', title: 'Details, fees and FAQ'},
  ],
  fields: [
    // ---- Overview -------------------------------------------------------
    {
      name: 'code',
      title: 'Short code',
      description: 'OPC or FDO. Used in the menu and to suggest the slug.',
      type: 'string',
      group: 'overview',
      validation: R => R.required(),
    },
    {name: 'title', title: 'Programme title', type: 'string', group: 'overview', validation: R => R.required()},
    {name: 'subtitle', title: 'Subtitle', type: 'string', group: 'overview'},
    // The slug is the page filename, as it is on a course. Pages are flat at the
    // site root, so this becomes <slug>.html beside the other eleven.
    {
      name: 'slug',
      title: 'Slug (page filename, e.g. opc)',
      type: 'slug',
      group: 'overview',
      options: {source: 'code', maxLength: 40},
      validation: R => R.required(),
    },
    {
      name: 'published',
      title: 'Show on the site',
      description: 'Off until the programme is ready to be seen. An unpublished programme is absent from the menu, absent from the sitemap, and its page is not built at all.',
      type: 'boolean',
      group: 'overview',
      initialValue: false,
    },
    {
      name: 'attribution',
      title: 'Delivery attribution',
      description: 'Who delivers, who accredits, who issues certificates. Rendered wherever the programme is described, by the template rather than by an editor placing it. This resolves the relationship between Future Edge Institute, Kydon Group and any academic partner, and it is what keeps a subsidised programme from contradicting the SSG line carried on the short course pages. Do not shorten it for style.',
      type: 'text',
      rows: 4,
      group: 'overview',
      validation: R => R.required(),
    },
    {name: 'standfirst', title: 'Hero standfirst', type: 'text', rows: 4, group: 'overview'},
    {
      name: 'stats',
      title: 'Headline figures',
      type: 'array',
      group: 'overview',
      validation: R => R.max(4),
      of: [{
        type: 'object',
        fields: [
          {name: 'value', title: 'Figure', type: 'string'},
          {name: 'label', title: 'Label', type: 'string'},
          {
            name: 'attribution',
            title: 'Whose figure is this',
            description: 'Fill in when the figure belongs to a partner rather than to this programme, for example a platform learner count. It is printed with the label, so the page never presents a figure belonging to another organisation as its own.',
            type: 'string',
          },
        ],
        preview: {select: {title: 'value', subtitle: 'label'}},
      }],
    },
    {name: 'hero', title: 'Hero photo', type: 'heroMedia', group: 'overview'},

    // ---- Modules --------------------------------------------------------
    {
      name: 'arcs',
      title: 'Arcs',
      type: 'array',
      group: 'structure',
      of: [{
        type: 'object',
        name: 'arc',
        fields: [
          {name: 'label', title: 'Arc label', type: 'string', validation: R => R.required()},
          {
            name: 'deliveredBy',
            title: 'Delivered by',
            description: 'Named on the arc when a partner delivers it, for example Singapore Polytechnic. Leave empty when it is delivered in house.',
            type: 'string',
          },
          {
            name: 'modules',
            title: 'Modules',
            type: 'array',
            of: [{
              type: 'object',
              name: 'module',
              fields: [
                {name: 'num', title: 'Module number', type: 'string'},
                {name: 'title', title: 'Module title', type: 'string'},
                {name: 'hours', title: 'Hours', type: 'number'},
                {
                  name: 'deliveredBy',
                  title: 'Delivered by',
                  description: 'Overrides the arc value when a single module differs.',
                  type: 'string',
                },
                {
                  name: 'certificate',
                  title: 'Certificate title',
                  description: 'The exact certificate awarded for this module, and the exact issuer wording where it differs from the arc.',
                  type: 'string',
                },
                {name: 'synopsis', title: 'Synopsis', type: 'text', rows: 4},
                {name: 'objectives', title: 'Learning objectives', type: 'array', of: [{type: 'string'}]},
              ],
              preview: {select: {title: 'title', subtitle: 'num'}},
            }],
          },
        ],
        preview: {select: {title: 'label'}},
      }],
    },
    {
      name: 'pathways',
      title: 'Post graduation pathways',
      type: 'array',
      group: 'structure',
      validation: R => R.max(3),
      of: [{
        type: 'object',
        fields: [
          {name: 'tag', title: 'Short tag', type: 'string'},
          {name: 'title', title: 'Title', type: 'string'},
          {name: 'body', type: 'text', rows: 4},
          {name: 'points', type: 'array', of: [{type: 'string'}]},
        ],
        preview: {select: {title: 'title', subtitle: 'tag'}},
      }],
    },

    // ---- Details, fees, FAQ ---------------------------------------------
    {
      name: 'details',
      title: 'Programme details',
      description: 'Label and value rows: course title, intake number, venue, dates and so on. A value that is not confirmed is left out entirely rather than marked: there is no confirmation style on this site, and an unconfirmed value belongs in docs/DECISIONS.md, not on the page.',
      type: 'array',
      group: 'admin',
      of: [{
        type: 'object',
        fields: [
          {name: 'label', type: 'string'},
          {name: 'value', type: 'string'},
        ],
        preview: {select: {title: 'label', subtitle: 'value'}},
      }],
    },
    {name: 'entryRequirements', title: 'Entry requirements', type: 'array', of: [{type: 'string'}], group: 'admin'},
    {
      name: 'showFees',
      title: 'Show fees on the page',
      description: 'Off by default. Fees appear on this site only for a subsidised programme where the published fee is part of the offer, and only with approval. The commercial fees of Future Edge Institute never appear. With this off the whole fees block is absent, including the funding scope note that sits inside it.',
      type: 'boolean',
      group: 'admin',
      initialValue: false,
    },
    {
      name: 'fees',
      title: 'Fee tiers',
      type: 'array',
      group: 'admin',
      hidden: feesHidden,
      of: [{
        type: 'object',
        fields: [
          {name: 'eligibility', type: 'string'},
          {name: 'fee', type: 'string', description: 'Written in full, for example S$2,844.80'},
        ],
        preview: {select: {title: 'eligibility', subtitle: 'fee'}},
      }],
    },
    {
      name: 'feeNote',
      title: 'Fee note',
      description: 'Tax treatment, subsidy criteria, and what the fee excludes.',
      type: 'text',
      rows: 3,
      group: 'admin',
      hidden: feesHidden,
    },
    {
      name: 'fundingNote',
      title: 'Funding scope note',
      description: 'States which programmes the subsidy applies to and which it does not. Required whenever a subsidised programme sits on the same site as commercial ones, so the two positions do not read as a contradiction. The template renders it inside the fees block and never apart from it.',
      type: 'text',
      rows: 4,
      group: 'admin',
    },
    {
      name: 'paymentMethods',
      title: 'Payment methods',
      type: 'array',
      of: [{type: 'string'}],
      group: 'admin',
      hidden: feesHidden,
    },
    {
      name: 'refundTerms',
      title: 'Refund terms',
      type: 'array',
      group: 'admin',
      of: [{
        type: 'object',
        fields: [
          {name: 'window', type: 'string'},
          {name: 'outcome', type: 'string'},
        ],
        preview: {select: {title: 'window', subtitle: 'outcome'}},
      }],
    },
    {
      name: 'partners',
      title: 'Partners',
      type: 'array',
      group: 'admin',
      of: [{
        type: 'object',
        fields: [
          {name: 'name', type: 'string'},
          {name: 'role', title: 'Role in this programme', type: 'string'},
          {name: 'body', type: 'text', rows: 4},
          {name: 'url', type: 'url'},
          {
            name: 'disclaimer',
            description: 'Where a partner administers something we do not award, say who decides and on what criteria. A grant or an award named without one reads as a promise.',
            type: 'text',
            rows: 3,
          },
        ],
        preview: {select: {title: 'name', subtitle: 'role'}},
      }],
    },
    {
      name: 'faqs',
      title: 'Frequently asked questions',
      description: 'Each page carries the FAQPage JSON-LD for its own questions only, so no two pages claim the same question.',
      type: 'array',
      group: 'admin',
      of: [{
        type: 'object',
        fields: [
          {name: 'q', title: 'Question', type: 'string'},
          {name: 'a', title: 'Answer', type: 'text', rows: 6},
        ],
        preview: {select: {title: 'q'}},
      }],
    },
  ],
  orderings: [{title: 'Code', name: 'codeAsc', by: [{field: 'code', direction: 'asc'}]}],
  preview: {
    select: {title: 'title', code: 'code', published: 'published'},
    prepare: ({title, code, published}) => ({
      title,
      subtitle: published ? code : `${code} (not shown on the site)`,
    }),
  },
}
