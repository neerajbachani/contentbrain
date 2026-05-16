import { useQuery } from "@tanstack/react-query";
import { fetchLinkPreview, LinkPreview } from "../services/linkPreview";

export function useLinkPreview(url: string | null) {
  return useQuery<LinkPreview>({
    queryKey: ["linkPreview", url],
    queryFn: () => fetchLinkPreview(url!),
    enabled: !!url && url.startsWith("http"),
    staleTime: 30 * 60 * 1000, // 30 minutes — link previews don't change much
    retry: 0,
  });
}
