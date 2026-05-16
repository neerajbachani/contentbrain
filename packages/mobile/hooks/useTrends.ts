import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTrends, refreshTrends, TrendItem, TrendSource } from "../services/trends";

export function useTrends(niches: string[], source: "all" | TrendSource = "all") {
  return useQuery<TrendItem[]>({
    queryKey: ["trends", niches.join(","), source],
    queryFn: () => fetchTrends(niches, source),
    enabled: niches.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
}

export function useRefreshTrends() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshTrends,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trends"] });
    },
  });
}
