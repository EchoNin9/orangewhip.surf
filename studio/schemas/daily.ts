const mediaOptions = [
  { title: 'Image', value: 'image' },
  { title: 'Video', value: 'video' },
];

export default {
  name: 'daily',
  title: 'Daily Roundup',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: Rule => Rule.required(),
    },
    {
      name: 'date',
      title: 'Feed Date',
      type: 'datetime',
      validation: Rule => Rule.required(),
    },
    {
      name: 'generatedAt',
      title: 'Generated At',
      type: 'datetime',
      description: 'Timestamp of when the feed was ingested.',
    },
    {
      name: 'items',
      title: 'Items',
      type: 'array',
      of: [
        {
          name: 'dailyItem',
          title: 'Daily Item',
          type: 'object',
          fields: [
            {
              name: 'title',
              title: 'Title',
              type: 'string',
              validation: Rule => Rule.required(),
            },
            {
              name: 'description',
              title: 'Description',
              type: 'text',
            },
            {
              name: 'link',
              title: 'Link',
              type: 'url',
              validation: Rule => Rule.uri({
                allowRelative: false,
                scheme: ['http', 'https'],
              }),
            },
            {
              name: 'source',
              title: 'Source',
              type: 'string',
            },
            {
              name: 'publishedAt',
              title: 'Published At',
              type: 'datetime',
            },
            {
              name: 'media',
              title: 'Media',
              type: 'array',
              of: [
                {
                  name: 'dailyMedia',
                  title: 'Daily Media',
                  type: 'object',
                  fields: [
                    {
                      name: 'kind',
                      title: 'Type',
                      type: 'string',
                      options: {
                        list: mediaOptions,
                        layout: 'radio',
                      },
                    },
                    {
                      name: 'url',
                      title: 'URL',
                      type: 'url',
                      validation: Rule => Rule.uri({
                        allowRelative: false,
                        scheme: ['http', 'https'],
                      }),
                    },
                    {
                      name: 'caption',
                      title: 'Caption',
                      type: 'string',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'date',
      count: 'items.length',
    },
    prepare(selection) {
      const { title, subtitle, count } = selection;
      const details = [
        subtitle ? new Date(subtitle).toLocaleString() : null,
        typeof count === 'number' ? `${count} items` : null,
      ]
        .filter(Boolean)
        .join(' • ');

      return {
        title,
        subtitle: details,
      };
    },
  },
};

