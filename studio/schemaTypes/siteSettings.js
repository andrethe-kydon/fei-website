// Sanity schema: siteSettings (create exactly one document of this type)
export default {
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
    {name: 'whatsappNumber', title: 'WhatsApp number (digits only, with country code)', type: 'string'},
    {name: 'enquiryEmail', title: 'Enquiry email', type: 'string'},
    {name: 'ga4Id', title: 'GA4 measurement ID', type: 'string'},
    {name: 'metaPixelId', title: 'Meta Pixel ID', type: 'string'},
    {name: 'hubspotPortalId', title: 'HubSpot portal ID', type: 'string'},
    {name: 'hubspotFormGuid', title: 'HubSpot form GUID', type: 'string'},
    {name: 'hubspotFormRegion', title: 'HubSpot form region (na1, na2, eu1)', type: 'string'},
    {name: 'siteUrl', title: 'Canonical site URL (no trailing slash)', type: 'url'},
    {name: 'rtpStatement', title: 'RTP status statement (shown on funding sections)', type: 'text', rows: 3},
  ],
  preview: {prepare: () => ({title: 'Site Settings'})},
}
