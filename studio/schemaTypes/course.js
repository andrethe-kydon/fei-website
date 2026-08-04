// Sanity schema: course
// Drop this file into your Sanity Studio's schemaTypes folder and register it.
//
// One document type carries both series. `series` decides which template the
// document renders through and which homepage section it appears in:
//   Operator (AOP) renders through course.template.html: assessed, for individuals.
//   Adoption (AIA) renders through workshop.template.html: participation based,
//   for organisations, and never shows assessment modes, pass thresholds or an
//   hour split.
// The Operator only and Adoption only field groups are both optional, so a
// document of either series saves cleanly without the other's fields.
// An unset series counts as Operator, the same default build.js applies, so
// documents that predate the series field behave correctly in the Studio until
// scripts/backfill-series.js has run.
const seriesOf = doc => doc?.series || 'Operator'
const isAdoption = doc => seriesOf(doc) === 'Adoption'
const isOperator = doc => seriesOf(doc) === 'Operator'

export default {
  name: 'course',
  title: 'Course',
  type: 'document',
  fields: [
    {
      name: 'series',
      title: 'Series',
      description: 'Operator is the assessed AOP series for individuals. Adoption is the AIA corporate workshop series.',
      type: 'string',
      options: {list: [{title: 'Operator (AOP)', value: 'Operator'}, {title: 'Adoption (AIA)', value: 'Adoption'}], layout: 'radio'},
      initialValue: 'Operator',
      validation: R => R.required(),
    },
    {name: 'number', title: 'Course number (e.g. 101)', type: 'number', validation: R => R.required()},
    {
      name: 'codePrefix',
      title: 'Code prefix',
      description: 'The displayed code is prefix then number, for example AOP 101 or AIA 101.',
      type: 'string',
      initialValue: 'AOP',
      validation: R => R.required(),
    },
    // The slug is its own field, not a mirror of the number: the prefix and the
    // number together no longer decide the filename, so a document can be
    // renumbered or moved between series without its published URL changing.
    // Generate suggests prefix and number as a convenience only.
    {name: 'slug', title: 'Slug (page filename, e.g. aop101)', type: 'slug', options: {source: doc => `${(doc.codePrefix || 'AOP').toLowerCase()}${doc.number || ''}`}, validation: R => R.required()},
    {name: 'title', title: 'Title', type: 'string', validation: R => R.required()},
    {name: 'subtitle', title: 'Subtitle', type: 'string', validation: R => R.required()},
    {name: 'tagline', title: 'Tagline (course objective, one sentence set)', type: 'text', rows: 3, validation: R => R.required()},
    {
      name: 'metaDescription',
      title: 'Meta description',
      description: 'Search result and social preview text. Leave empty to use the tagline.',
      type: 'text',
      rows: 3,
    },
    {
      name: 'tileCopy',
      title: 'Homepage tile copy',
      description: 'The short pitch on the homepage card. Adoption workshops only; Operator cards list what participants build instead.',
      type: 'text',
      rows: 3,
      hidden: isOperator,
    },
    {
      name: 'hours',
      title: 'Total hours',
      description: 'Operator courses count every contact hour including breaks. Adoption workshops carry the taught hours figure here, and declare no split.',
      type: 'number',
      validation: R => R.required(),
    },
    {name: 'days', title: 'Days', type: 'number', validation: R => R.required()},
    // The delivery hour split is declared for the Operator series only, because
    // it must match the RTP filing. Adoption workshops do not declare a split.
    {name: 'contactHours', title: 'Contact hours', type: 'number', hidden: isAdoption},
    {name: 'instructorLedHours', title: 'Instructor led hours', type: 'number', hidden: isAdoption},
    {name: 'practicalHours', title: 'Practical hours', type: 'number', hidden: isAdoption},
    {name: 'assessmentHours', title: 'Assessment hours', type: 'number', hidden: isAdoption},
    {name: 'breakHours', title: 'Break hours', type: 'number', hidden: isAdoption},
    // ---- Adoption series only ----
    {name: 'groupSize', title: 'Group size (e.g. 10 to 18 participants)', type: 'string', hidden: isOperator},
    {name: 'taughtHours', title: 'Taught hours', type: 'number', hidden: isOperator},
    {
      name: 'deliverables',
      title: 'What every participant leaves with',
      type: 'array',
      of: [{type: 'string'}],
      hidden: isOperator,
    },
    {name: 'sessions', title: 'The two days', type: 'array', hidden: isOperator, of: [{
      type: 'object',
      fields: [
        {name: 'when', title: 'When (e.g. Day 1, morning)', type: 'string'},
        {name: 'theme', title: 'Theme', type: 'string'},
        {name: 'whatHappens', title: 'What happens', type: 'text', rows: 3},
      ],
      preview: {select: {title: 'when', subtitle: 'theme'}},
    }]},
    {name: 'methodNote', title: 'How we teach (method paragraph)', type: 'text', rows: 4, hidden: isOperator},
    {name: 'certificateNote', title: 'Certificate note', type: 'text', rows: 3, hidden: isOperator},
    {name: 'tags', title: 'Segments (Operations, Marketing, Sales, Business Foundations)', type: 'array', of: [{type: 'string'}]},
    {
      name: 'aiTags',
      title: 'AI capabilities taught',
      description: 'Leave empty where the course does not teach AI. Do not add these unless the curriculum genuinely covers them.',
      type: 'array',
      of: [{type: 'string'}],
    },
    {
      name: 'feeDisplay',
      title: 'Fee line on the summary card',
      description: 'Leave empty to show "Fees confirmed at enquiry". No figure goes here until fees are set.',
      type: 'string',
    },
    {name: 'audience', title: 'Who it is for', type: 'text', rows: 3},
    {name: 'intakes', title: 'Intake schedule', description: 'Leave empty until dates are confirmed. The page says so honestly rather than hiding the section.', type: 'array', of: [{
      type: 'object',
      fields: [
        {name: 'label', title: 'Label (e.g. Every Tuesday)', type: 'string'},
        {name: 'dates', title: 'Dates (e.g. 14, 21 and 28 April 2026)', type: 'string'},
        {name: 'timing', title: 'Timing', type: 'string', initialValue: '9:00 AM to 6:00 PM'},
        {name: 'venue', title: 'Venue', type: 'string'},
        {name: 'format', title: 'Format', type: 'string', options: {list: ['Weekday', 'Weekend', 'Custom']}},
        {name: 'status', title: 'Status', type: 'string', options: {list: ['Open', 'Filling fast', 'Closed']}, initialValue: 'Open'},
      ],
      preview: {select: {title: 'label', subtitle: 'dates'}},
    }]},
    {name: 'trainers', title: 'Trainers', description: 'Leave empty until trainers are confirmed. The section is omitted entirely when empty.', type: 'array', of: [{
      type: 'object',
      fields: [
        {name: 'name', title: 'Name', type: 'string'},
        {name: 'role', title: 'Role', type: 'string'},
        {name: 'bio', title: 'Bio', type: 'text', rows: 4},
        {name: 'photo', title: 'Photo', type: 'image'},
      ],
      preview: {select: {title: 'name', subtitle: 'role'}},
    }]},
    {name: 'overview', title: 'Overview paragraphs', type: 'array', of: [{type: 'text', rows: 4}]},
    // Visible on both series, because both carry outcomes as content. Only the
    // Operator series presents them as numbered, assessed LO1 to LO5 outcomes;
    // an Adoption workshop states the same capability without the assessment
    // framing, so never render these through the numbered lo-list on a workshop.
    {name: 'learningOutcomes', title: 'Learning outcomes', description: 'Operator courses show these as assessed outcomes, LO1 to LO5. Adoption workshops state them as capability, with no assessment claim.', type: 'array', of: [{type: 'string'}]},
    {name: 'outline', title: 'Day by day outline', type: 'array', hidden: isAdoption, of: [{
      type: 'object',
      fields: [
        {name: 'day', title: 'Day label', type: 'string'},
        {name: 'theme', title: 'Theme', type: 'string'},
        {name: 'content', title: 'Content', type: 'text', rows: 2},
        {name: 'hours', title: 'Hours', type: 'number'},
      ],
      preview: {select: {title: 'day', subtitle: 'theme'}},
    }]},
    {name: 'builds', title: 'What participants build', type: 'array', of: [{type: 'string'}], hidden: isAdoption},
    // Assessment is never declared for the Adoption series: those workshops make
    // no assessment claim and the workshop template has nowhere to show one.
    {name: 'assessments', title: 'Assessment modes', type: 'array', hidden: isAdoption, of: [{
      type: 'object',
      fields: [
        {name: 'mode', title: 'Mode (Practical Exam, Project, Oral Interview)', type: 'string'},
        {name: 'description', title: 'Description with duration', type: 'text', rows: 2},
      ],
      preview: {select: {title: 'mode'}},
    }]},
    {name: 'related', title: 'Related courses', type: 'array', of: [{
      type: 'object',
      fields: [
        {name: 'number', title: 'Course number', type: 'number'},
        {name: 'why', title: 'Relationship label', type: 'string'},
      ],
      preview: {select: {title: 'why'}},
    }]},
    {name: 'disclaimer', title: 'Disclaimer (awareness not advice), optional', type: 'text', rows: 3},
    {name: 'banner', title: 'Banner image (1600 x 640)', type: 'image'},
    {name: 'thumbnail', title: 'Card thumbnail (1200 x 750)', type: 'image'},
  ],
  orderings: [{title: 'Course number', name: 'numberAsc', by: [{field: 'number', direction: 'asc'}]}],
  preview: {
    select: {title: 'title', subtitle: 'subtitle', prefix: 'codePrefix', number: 'number'},
    prepare: ({title, subtitle, prefix, number}) => ({
      title: `${prefix || 'AOP'} ${number}: ${title}`,
      subtitle,
    }),
  },
}
