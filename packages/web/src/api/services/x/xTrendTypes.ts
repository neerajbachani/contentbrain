import type { TrendItem } from "../normalizer";

export interface TodayXNewsGroup {
  headline: TrendItem;
  relatedPosts: TrendItem[];
}

export interface XTrendFetchResult {
  todayXNews: TodayXNewsGroup[];
  nichePosts: TrendItem[];
}
