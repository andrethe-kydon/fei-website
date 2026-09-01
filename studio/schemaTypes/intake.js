// Sanity schema: intake (object)
//
// One shared type for every kind of scheduled run: a second OPC cohort and a
// January date for AOP 102 are the same idea, so they are the same object rather
// than two implementations that drift.
//
// Used by `course` (both series) and by `careerProgramme`. Adding a date to
// either is filling in four fields in the Studio: no template work, no deploy
// beyond the automatic one.
//
// Dates only, never prose describing a date. The page formats them, so "5 Oct"
// and "5 October 2026" cannot both be entered and disagree, and a past intake
// can be filtered out by comparison rather than by reading a string.
export default {
  name: 'intake',
  title: 'Intake',
  type: 'object',
  fields: [
    {
      name: 'startDate',
      title: 'Starts',
      type: 'date',
      options: {dateFormat: 'D MMMM YYYY'},
      validation: R => R.required(),
    },
    {
      name: 'endDate',
      title: 'Ends',
      description: 'Leave empty for a short course that finishes inside the same week.',
      type: 'date',
      options: {dateFormat: 'D MMMM YYYY'},
    },
    {
      name: 'registrationCloses',
      title: 'Registration closes',
      type: 'date',
      options: {dateFormat: 'D MMMM YYYY'},
    },
    {
      name: 'status',
      title: 'Status',
      description: 'Shown as a word, not a colour, so it reads the same to everyone.',
      type: 'string',
      options: {
        list: [
          {title: 'Open', value: 'open'},
          {title: 'Waitlist', value: 'waitlist'},
          {title: 'Closed', value: 'closed'},
          {title: 'Scheduled', value: 'scheduled'},
        ],
        layout: 'radio',
      },
      initialValue: 'scheduled',
    },
    {
      name: 'label',
      title: 'Label',
      description: 'A name where one exists, for example Cohort 2. Left empty the card is headed by its dates.',
      type: 'string',
    },
    {
      name: 'venue',
      title: 'Venue',
      description: 'Only when it differs from the usual venue for this programme.',
      type: 'string',
    },
    {name: 'note', title: 'Note', type: 'text', rows: 2},
  ],
  preview: {
    select: {start: 'startDate', label: 'label', status: 'status'},
    prepare: ({start, label, status}) => ({
      title: label || start || 'Intake',
      subtitle: [start && label ? start : null, status].filter(Boolean).join(' · '),
    }),
  },
}
