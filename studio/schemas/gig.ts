export default {
  name: 'gig',
  title: 'Gig',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
    },
    {
      name: 'date',
      title: 'Date',
      type: 'datetime',
    },
    {
      name: 'venue',
      title: 'Venue',
      type: 'string',
    },
    {
      name: 'address',
      title: 'Address',
      type: 'string',
    },
    {
      name: 'city',
      title: 'City',
      type: 'string',
    },
    {
      name: 'poster',
      title: 'Poster',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
    },
    {
      name: 'isUpcoming',
      title: 'Is Upcoming',
      type: 'boolean',
      initialValue: true,
    },
    {
      name: 'gallery',
      title: 'Gallery',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
    },
    {
      name: 'content',
      title: 'Content',
      type: 'array', 
      of: [{type: 'block'}]
    },
  ],
}
