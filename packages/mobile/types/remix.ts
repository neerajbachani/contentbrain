export type RemixVariation = {
  label: string;
  content: string;
  why_it_works?: string;
};

export type PlatformId = "x" | "instagram" | "linkedin" | "youtube" | "reddit";

export type MemePost = {
  title: string;
  url: string;
  score: number;
  platform: string;
  summary?: string;
  thumbnailUrl?: string;
  engagementLabel?: string;
};

export type MemeSearchMeta = {
  rawPosts: number;
  withThumbnail: number;
  returned: number;
};
