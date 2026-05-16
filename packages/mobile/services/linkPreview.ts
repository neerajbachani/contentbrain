import { api } from "../lib/api";

export interface LinkPreview {
  url: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
  favicon?: string | null;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const res = await api.scrape.$post({ json: { url } });

  if (!res.ok) {
    return { url, title: null, description: null, imageUrl: null, siteName: null };
  }

  return res.json() as Promise<LinkPreview>;
}
