import { defineCollection, z } from 'astro:content'

const pressSchema = z
  .object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.string()).default([]),
    heroImage: z.string().optional(),
  })
  .passthrough()

type PressFrontmatter = z.infer<typeof pressSchema> & { slug?: string }

const press = defineCollection({
  type: 'content',
  schema: pressSchema,
  slug: ({ data, slug }) => (data as PressFrontmatter).slug ?? slug,
})

const gigs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    venue: z.string(),
    address: z.string().optional(),
    city: z.string().default('Vancouver, BC'),
    poster: z.string(),
    description: z.string(),
    isUpcoming: z.boolean(),
    gallery: z.array(z.string()).optional(),
  }),
})

const daily = defineCollection({
  type: 'content',
  schema: z.object({
    date: z.date(),
    today: z.array(z.object({
      title: z.string(),
      date: z.string(),
      venue: z.string().optional(),
      url: z.string().optional(),
    })).default([]),
    thisWeek: z.array(z.object({
      title: z.string(),
      date: z.string(),
      venue: z.string().optional(),
      url: z.string().optional(),
    })).default([]),
    next: z.array(z.object({
      title: z.string(),
      date: z.string(),
      venue: z.string().optional(),
      url: z.string().optional(),
    })).default([]),
  }),
})

export const collections = {
  press,
  gigs,
  daily,
}
