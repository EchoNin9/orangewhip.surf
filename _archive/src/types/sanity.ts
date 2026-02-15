export interface SanitySlugRef {
  slug: string;
}

export interface SanityImageAsset {
  url: string;
}

export interface SanityImage {
  asset?: SanityImageAsset;
  alt?: string;
}

export interface SanityGig {
  _id: string;
  title: string;
  date: string;
  venue?: string;
  address?: string;
  city?: string;
  description?: string;
  isUpcoming?: boolean;
  slug: string;
  poster?: SanityImage;
  gallery?: SanityImage[];
  content?: Array<Record<string, unknown>>;
}

export interface SanityPress {
  _id: string;
  title: string;
  date: string;
  description?: string;
  tags?: string[];
  slug: string;
  heroImage?: SanityImage;
  content?: Array<Record<string, unknown>>;
}

export interface SanityDailyMedia {
  _type: 'dailyMedia';
  kind?: 'image' | 'video';
  url?: string;
  caption?: string;
}

export interface SanityDailyItem {
  _type: 'dailyItem';
  title?: string;
  description?: string;
  link?: string;
  source?: string;
  publishedAt?: string;
  media?: SanityDailyMedia[];
}

export interface SanityDaily {
  _id: string;
  _type: 'daily';
  title: string;
  slug: string;
  date: string;
  generatedAt?: string;
  items?: SanityDailyItem[];
}
