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
    // The two dates the hero speaks with. They are the single source: the
    // programme details table renders its start and enrolment rows from these,
    // so a date cannot be right in one place and stale in another.
    {
      name: 'startDate',
      title: 'Cohort start date',
      description: 'Leave empty until it is confirmed. The hero then says nothing about when the cohort begins rather than guessing.',
      type: 'date',
      options: {dateFormat: 'D MMMM YYYY'},
      group: 'overview',
    },
    {
      name: 'enrolmentDeadline',
      title: 'Applications close',
      description: 'Drives the primary button. While the deadline falls in the current month the button reads "Enrol now, closes this month"; earlier in the year it names the date; once it has passed the button falls back to a plain enquiry and the build prints a warning. So a closed cohort can never be advertised as open, but a passed deadline still needs clearing.',
      type: 'date',
      options: {dateFormat: 'D MMMM YYYY'},
      group: 'overview',
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
    {
      name: 'eyebrow',
      title: 'Hero eyebrow',
      description: 'The small line above the headline, for example the cohort and its month. Leave it empty when the cohort is not confirmed: nothing renders and the headline moves up.',
      type: 'string',
      group: 'overview',
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

    // The section that lets a five month programme sit beside the short course
    // catalogue without confusing a visitor. Per programme rather than template
    // prose, because FDO sets this programme against a different alternative and
    // every row of its table will differ.
    {
      name: 'positioning',
      title: 'Where this sits beside the short courses',
      type: 'object',
      group: 'overview',
      fields: [
        {
          name: 'lead',
          title: 'Lead paragraphs',
          description: 'The prose above the table. One entry per paragraph.',
          type: 'array',
          of: [{type: 'text', rows: 4}],
        },
        {
          name: 'programmeColumn',
          title: 'Column heading: this programme',
          description: 'For example OPC Launchpad.',
          type: 'string',
        },
        {
          name: 'alternativeColumn',
          title: 'Column heading: the alternative',
          description: 'What this programme is being set against, for example The AI Operator Professional Series.',
          type: 'string',
        },
        {
          name: 'rows',
          title: 'Comparison rows',
          type: 'array',
          of: [{
            type: 'object',
            fields: [
              {name: 'dimension', title: 'Dimension', type: 'string'},
              {name: 'programme', title: 'This programme', type: 'text', rows: 2},
              {name: 'alternative', title: 'The alternative', type: 'text', rows: 2},
            ],
            preview: {select: {title: 'dimension', subtitle: 'programme'}},
          }],
        },
      ],
    },

    // ---- Modules --------------------------------------------------------
    // The training block that stands above the pathways: what the months
    // actually consist of, before the two ways out of them.
    {
      name: 'training',
      title: 'The training block',
      type: 'object',
      group: 'structure',
      fields: [
        {name: 'label', title: 'Label', description: 'For example Months 1 to 5.', type: 'string'},
        {name: 'body', title: 'Body', type: 'text', rows: 4},
        {name: 'points', title: 'Points', type: 'array', of: [{type: 'string'}]},
      ],
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
    {
      name: 'modulesStandfirst',
      title: 'Modules standfirst',
      description: 'The paragraph above the module list. Where a partner delivers part of the programme, this is where the split is stated: which modules, to whose syllabus, and how many of the total hours.',
      type: 'text',
      rows: 4,
      group: 'structure',
    },
    {
      name: 'certificateAwarded',
      title: 'Certificate awarded',
      description: 'The exact credential and, where a partner issues it, the exact issuer. For example: 8 Certificates of Completion, one per module, issued by Singapore Polytechnic. It is printed in the module summary bar and is the credential in the structured data, so the issuer is never defaulted to Future Edge Institute.',
      type: 'string',
      group: 'structure',
    },
    {
      name: 'graduateRoles',
      title: 'Graduate roles',
      description: 'The roles the programme is aligned to. Only roles carried by the approved course outcomes.',
      type: 'array',
      of: [{type: 'string'}],
      group: 'structure',
    },
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
                // Retitled, not renamed. This field has always held taught
                // hours; the title now says so, and the field name is left
                // alone so no published data moves.
                {name: 'hours', title: 'Taught hours', type: 'number'},
                {name: 'assessmentHours', title: 'Assessment hours', type: 'number'},
                // A module total is taught plus assessment, computed where it is
                // shown and never stored, so the parts and the total cannot
                // disagree.
                {name: 'dateFrom', title: 'Runs from', type: 'date', options: {dateFormat: 'D MMMM YYYY'}},
                {name: 'dateTo', title: 'Runs to', type: 'date', options: {dateFormat: 'D MMMM YYYY'}},
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

    // ---- Schedule -------------------------------------------------------
    // Nothing here is required. With the whole object empty the schedule section
    // does not render and the page is exactly what it was.
    //
    // The programme start and end are NOT stored here: they are derived from the
    // earliest and latest module dates, so the schedule can never contradict the
    // module table beneath it.
    {
      name: 'schedule',
      title: 'Schedule',
      type: 'object',
      group: 'structure',
      fields: [
        {
          name: 'cohort',
          title: 'Which cohort these dates are for',
          description: 'For example Cohort 1. Named in the section heading so a visitor arriving for a later intake cannot read these dates as theirs. Left empty the section says "the current cohort" instead.',
          type: 'string',
        },
        {
          name: 'pattern',
          title: 'Weekly pattern',
          description: 'The rhythm of a normal week in plain words, for example the teaching days and the hours.',
          type: 'string',
        },
        {
          name: 'patternNote',
          title: 'The non teaching day',
          description: 'What happens on the day that carries no class, and what the weekend looks like.',
          type: 'text',
          rows: 3,
        },
        {
          name: 'holidays',
          title: 'Public holidays with no class',
          type: 'array',
          of: [{
            type: 'object',
            fields: [
              {name: 'date', title: 'Date', type: 'date', options: {dateFormat: 'D MMMM YYYY'}},
              {name: 'name', title: 'Holiday', type: 'string'},
            ],
            preview: {select: {title: 'name', subtitle: 'date'}},
          }],
        },
        {
          name: 'files',
          title: 'Downloads',
          description: 'The schedule as published. An empty list renders no downloads block.',
          type: 'array',
          of: [{
            type: 'object',
            fields: [
              {name: 'label', title: 'Label', type: 'string'},
              {name: 'description', title: 'Description', type: 'text', rows: 2},
              {name: 'file', title: 'PDF', type: 'file', options: {accept: 'application/pdf'}},
            ],
            preview: {select: {title: 'label', subtitle: 'description'}},
          }],
        },
      ],
    },
    // ---- Details, fees, FAQ ---------------------------------------------
    {
      name: 'audienceBody',
      title: 'Who it is for',
      type: 'text',
      rows: 4,
      group: 'admin',
    },
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
      name: 'entryNote',
      title: 'Entry note',
      description: 'What happens for an applicant who does not meet the stated minimum, and where to write. Sits under the requirements list.',
      type: 'text',
      rows: 3,
      group: 'admin',
    },
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
