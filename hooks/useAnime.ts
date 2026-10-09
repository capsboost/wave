import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { anilistApi, type AniListAnime } from "@/lib/api/anilist";


export function useTrendingAnime(limit = 15, page = 1) {
  return useQuery({
    queryKey: ["anime", "trending", limit, page],
    queryFn: () => anilistApi.getTrending(limit, page),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });
}

export function useRecentEpisodes(limit = 20) {
  return useQuery({
    queryKey: ["anime", "recent", limit],
    queryFn: () => anilistApi.getRecentReleases(limit),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });
}

export function useTopThisWeek(limit = 9) {
  return useQuery({
    queryKey: ["anime", "top-this-week", limit],
    queryFn: () => anilistApi.getTopThisWeek(limit),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });
}

export function useSchedule(limit = 15) {
  return useQuery({
    queryKey: ["anime", "schedule", limit],
    queryFn: () => anilistApi.getAiringSchedule(limit),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });
}

export function useSearchAnime(query: string, filters?: { genre?: string; year?: number; format?: string; sort?: string; score?: number; status?: string }) {
  return useQuery({
    queryKey: ["anime", "search", query, filters],
    queryFn: () => anilistApi.searchAnime(query, filters),
    staleTime: 60 * 60 * 1000, // 1 hour
    enabled: query.trim().length >= 2 || !!filters?.genre || !!filters?.year || !!filters?.format || !!filters?.score || !!filters?.status,
    retry: 1,
  });
}

export function useExploreAnime(query: string, filters?: { genre?: string; year?: number; format?: string; sort?: string; score?: number; status?: string }) {
  return useInfiniteQuery({
    queryKey: ["anime", "explore", query, filters],
    queryFn: ({ pageParam = 1 }) => anilistApi.searchAnimePaginated(query, filters, 20, pageParam),
    getNextPageParam: (lastPage, allPages) => lastPage.hasNextPage ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });
}

export function useAniListBanners(limit = 10, page = 1) {
  return useQuery({
    queryKey: ["anime", "anilist-banners", limit, page],
    queryFn: () => anilistApi.getTrending(limit, page),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });
}

export function useAnimeDetails(malId: string | number, initialData?: AniListAnime) {
  return useQuery({
    queryKey: ["anime", String(malId), "details"],
    queryFn: () => anilistApi.getAnimeDetails(malId),
    initialData,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    enabled: !!malId,
    retry: 1,
  });
}

/**
 * Batch-fetch full details for multiple MAL IDs in ONE AniList request.
 * Use this on list pages (profile watchlist, history, etc.) to avoid N parallel requests
 * that would hammer the per-IP rate limit.
 */
export function useAnimeDetailsBatch(malIds: (string | number)[]) {
  return useQuery({
    queryKey: ["anime", "batch-details", malIds.map(String).sort().join(",")],
    queryFn: () => anilistApi.getAnimeDetailsByIds(malIds),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    enabled: malIds.length > 0,
    retry: 1,
  });
}
