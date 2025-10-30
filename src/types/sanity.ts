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
