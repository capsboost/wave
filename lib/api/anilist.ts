import { jikanApi } from "./jikan";
import { getSearchCandidates } from "@/lib/utils/searchNormalize";

const ANILIST_API_URL = "https://graphql.anilist.co";

export interface AniListAnime {
  id: number;
  idMal: number | null;
  title: {
    english: string | null;
    romaji: string | null;
  };
  bannerImage: string | null;
  coverImage: {
    extraLarge: string;
    large: string;
    color: string | null;
  };
  description: string | null;
  genres: string[];
  isAdult?: boolean;
  episodes: number | null;
  format: string | null;
  status: string | null;
  averageScore: number | null;
  nextAiringEpisode: {
    episode: number;
    airingAt: number;
  } | null;
  seasonYear: number | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  recommendations?: AniListAnime[];
  relations?: (AniListAnime & { relationType: string })[];
}

export function isSafeAnime(anime?: AniListAnime | null): boolean {
  if (!anime) return false;
  if (anime.isAdult) return false;

  const genres = anime.genres || [];
  for (const g of genres) {
    const lower = g.toLowerCase();
    if (lower === "hentai" || lower === "erotica") {
      return false;
    }
  }

  const title = (anime.title?.english || anime.title?.romaji || "").toLowerCase();
  if (title.includes("hentai")) return false;

  return true;
}

const MEDIA_FIELDS = `
  id
  idMal
  type
  isAdult
  title {
    english
    romaji
  }
  bannerImage
  coverImage {
    extraLarge
    large
    color
  }
  description
  genres
  episodes
  format
  status
  averageScore
  nextAiringEpisode {
    episode
    airingAt
  }
  seasonYear
  startDate {
    year
    month
    day
  }
`;

// Circuit breaker state to prevent spamming AniList when disabled/down
let circuitOpenUntil = 0;
const CIRCUIT_BREAKER_DURATION_MS = 90 * 1000; // 90 seconds

const ANILIST_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "Origin": "https://anilist.co",
  "Referer": "https://anilist.co/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

function isAniListCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

function tripAniListCircuit(reason: string) {
  circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_DURATION_MS;
  console.warn(`[AniList Circuit Breaker] Tripped for 90s (${reason}). Falling back to Jikan API.`);
}

async function fetchAniList<T>(query: string, variables: Record<string, string | number | boolean | number[]> = {}): Promise<T> {
  if (isAniListCircuitOpen()) {
    throw new Error("AniList circuit breaker is open (service unavailable)");
  }

  const isClient = typeof window !== "undefined";

  // IMPORTANT: In the browser we ALWAYS route through our /api/anilist proxy.
  // Rationale: AniList's rate limit is per-IP. If we call graphql.anilist.co directly
  // from users' browsers, every user has their own 90-req/min bucket. A profile page
  // with 20 watchlist items fires 20 simultaneous requests and instantly 429s that user.
  // Via the proxy our server IP is shared, Next.js fetch-caches responses (5-min TTL),
  // and the same query from multiple users hits the cache instead of AniList.
  const url = isClient ? "/api/anilist" : ANILIST_API_URL;
  const headers = isClient
    ? { "Content-Type": "application/json", "Accept": "application/json" }
    : ANILIST_HEADERS;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
  } catch (err: unknown) {
    tripAniListCircuit(err instanceof Error ? err.message : "Network error");
    throw err;
  }

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const delayMs = retryAfterHeader ? Math.max(1000, Number(retryAfterHeader) * 1000) : 2000;
      await new Promise((res) => setTimeout(res, Math.min(delayMs, 5000)));
      // On 429, both client and server retry through the proxy
      const retry = await fetch(isClient ? "/api/anilist" : ANILIST_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      });
      if (!retry.ok) {
        tripAniListCircuit(`Rate limited (${retry.status})`);
        throw new Error("AniList API Rate Limit Exceeded");
      }
      const json = await retry.json();
      return json.data;
    }

    if (response.status === 403 || response.status >= 500) {
      tripAniListCircuit(`Status ${response.status}`);
    }
    throw new Error(`Failed to fetch AniList data (status: ${response.status})`);
  }

  const json = await response.json();
  if (json.errors && json.errors.length > 0) {
    if (json.errors.some((e: { status?: number; message?: string }) => e.status === 403 || e.message?.includes("disabled"))) {
      tripAniListCircuit("AniList API disabled upstream");
    }
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

async function fetchDbFallback<T>(params: Record<string, string | number>): Promise<T | null> {
  try {
    let baseUrl = "";
    if (typeof window !== "undefined") {
      baseUrl = window.location.origin;
    } else if (process.env.NEXT_PUBLIC_SITE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = "http://localhost:3000";
    }

    const url = new URL("/api/anime/db-fallback", baseUrl);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch (e) {
    console.warn("[DB Fallback API] Request failed:", e);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function writeThroughCache(_anime: AniListAnime | AniListAnime[]): void {
  // Disabled on client to eliminate hundreds of thousands of redundant Vercel function invocations and Neon DB writes
  return;
}

export const anilistApi = {
  getTrending: async (limit = 15, page = 1): Promise<AniListAnime[]> => {
    // 1. Tier 1: AniList
    if (!isAniListCircuitOpen()) {
      try {
        const query = `
          query($limit: Int, $page: Int) {
            Page(page: $page, perPage: $limit) {
              media(sort: TRENDING_DESC, type: ANIME, isAdult: false, genre_not_in: ["Hentai"]) {
                ${MEDIA_FIELDS}
              }
            }
          }
        `;
        const data = await fetchAniList<{ Page: { media: AniListAnime[] } }>(query, { limit, page });
        const media = data.Page.media.filter(a => a.idMal && isSafeAnime(a));
        if (media.length > 0) {
          writeThroughCache(media);
          return media;
        }
      } catch (err) {
        console.warn("[AniList getTrending] Failed, using Jikan fallback:", err);
      }
    }

    // 2. Tier 2: Jikan Fallback
    try {
      const jikanData = await jikanApi.getTrending(limit, page);
      if (jikanData && jikanData.length > 0) {
        writeThroughCache(jikanData);
        return jikanData;
      }
    } catch (jikanErr) {
      console.warn("[Jikan getTrending] Failed:", jikanErr);
    }

    // 3. Tier 3: Local Neon DB Fallback
    const dbData = await fetchDbFallback<{ media: AniListAnime[] }>({ action: "trending", limit });
    return dbData?.media || [];
  },

  getPopular: async (limit = 15): Promise<AniListAnime[]> => {
    // 1. Tier 1: AniList
    if (!isAniListCircuitOpen()) {
      try {
        const query = `
          query($limit: Int) {
            Page(page: 1, perPage: $limit) {
              media(sort: POPULARITY_DESC, type: ANIME, isAdult: false, genre_not_in: ["Hentai"]) {
                ${MEDIA_FIELDS}
              }
            }
          }
        `;
        const data = await fetchAniList<{ Page: { media: AniListAnime[] } }>(query, { limit });
        const media = data.Page.media.filter(a => a.idMal && isSafeAnime(a));
        if (media.length > 0) {
          writeThroughCache(media);
          return media;
        }
      } catch (err) {
        console.warn("[AniList getPopular] Failed, using Jikan fallback:", err);
      }
    }

    // 2. Tier 2: Jikan Fallback
    try {
      const jikanData = await jikanApi.getPopular(limit);
      if (jikanData && jikanData.length > 0) {
        writeThroughCache(jikanData);
        return jikanData;
      }
    } catch (jikanErr) {
      console.warn("[Jikan getPopular] Failed:", jikanErr);
    }

    // 3. Tier 3: Local Neon DB Fallback
    const dbData = await fetchDbFallback<{ media: AniListAnime[] }>({ action: "popular", limit });
    return dbData?.media || [];
  },

  getRecentReleases: async (limit = 20): Promise<AniListAnime[]> => {
    // 1. Tier 1: AniList
    if (!isAniListCircuitOpen()) {
      try {
        const currentTime = Math.floor(Date.now() / 1000);
        const query = `
          query($limit: Int, $time: Int) {
            Page(page: 1, perPage: $limit) {
              airingSchedules(airingAt_lesser: $time, sort: TIME_DESC) {
                media {
                  ${MEDIA_FIELDS}
                }
              }
            }
          }
        `;
        const data = await fetchAniList<{ Page: { airingSchedules: { media: AniListAnime }[] } }>(query, { limit, time: currentTime });
        
        const uniqueMedia = new Map<number, AniListAnime>();
        data.Page.airingSchedules.forEach(schedule => {
          if (schedule.media && schedule.media.idMal && isSafeAnime(schedule.media) && !uniqueMedia.has(schedule.media.idMal)) {
            uniqueMedia.set(schedule.media.idMal, schedule.media);
          }
        });
        const media = Array.from(uniqueMedia.values());
        if (media.length > 0) {
          writeThroughCache(media);
          return media;
        }
      } catch (err) {
        console.warn("[AniList getRecentReleases] Failed, using Jikan fallback:", err);
      }
    }

    // 2. Tier 2: Jikan Fallback
    try {
      const jikanData = await jikanApi.getRecentReleases(limit);
      if (jikanData && jikanData.length > 0) {
        writeThroughCache(jikanData);
        return jikanData;
      }
    } catch (jikanErr) {
      console.warn("[Jikan getRecentReleases] Failed:", jikanErr);
    }

    // 3. Tier 3: Local Neon DB Fallback
    const dbData = await fetchDbFallback<{ media: AniListAnime[] }>({ action: "trending", limit });
    return dbData?.media || [];
  },

  getTopThisWeek: async (limit = 9): Promise<AniListAnime[]> => {
    // 1. Tier 1: AniList
    if (!isAniListCircuitOpen()) {
      try {
        const query = `
          query($limit: Int) {
            Page(page: 1, perPage: $limit) {
              media(status: RELEASING, type: ANIME, sort: TRENDING_DESC, isAdult: false, genre_not_in: ["Hentai"], format: TV) {
                ${MEDIA_FIELDS}
              }
            }
          }
        `;
        const data = await fetchAniList<{ Page: { media: AniListAnime[] } }>(query, { limit });
        const media = data.Page.media.filter(a => a.idMal && isSafeAnime(a));
        if (media.length > 0) {
          writeThroughCache(media);
          return media;
        }
      } catch (err) {
        console.warn("[AniList getTopThisWeek] Failed, using Jikan fallback:", err);
      }
    }

    // 2. Tier 2: Jikan Fallback
    try {
      const jikanData = await jikanApi.getTopThisWeek(limit);
      if (jikanData && jikanData.length > 0) {
        writeThroughCache(jikanData);
        return jikanData;
      }
    } catch (jikanErr) {
      console.warn("[Jikan getTopThisWeek] Failed:", jikanErr);
    }

    // 3. Tier 3: Local Neon DB Fallback
    const dbData = await fetchDbFallback<{ media: AniListAnime[] }>({ action: "popular", limit });
    return dbData?.media || [];
  },

  getAiringSchedule: async (limit = 15): Promise<AniListAnime[]> => {
    // 1. Tier 1: AniList
    if (!isAniListCircuitOpen()) {
      try {
        const currentTime = Math.floor(Date.now() / 1000);
        const query = `
          query($limit: Int, $time: Int) {
            Page(page: 1, perPage: $limit) {
              airingSchedules(airingAt_greater: $time, sort: TIME) {
                media {
                  ${MEDIA_FIELDS}
                }
              }
            }
          }
        `;
        const data = await fetchAniList<{ Page: { airingSchedules: { media: AniListAnime }[] } }>(query, { limit, time: currentTime });
        
        const uniqueMedia = new Map<number, AniListAnime>();
        data.Page.airingSchedules.forEach(schedule => {
          if (schedule.media && schedule.media.idMal && isSafeAnime(schedule.media) && !uniqueMedia.has(schedule.media.idMal)) {
            uniqueMedia.set(schedule.media.idMal, schedule.media);
          }
        });
        const media = Array.from(uniqueMedia.values());
        if (media.length > 0) {
          writeThroughCache(media);
          return media;
        }
      } catch (err) {
        console.warn("[AniList getAiringSchedule] Failed, using Jikan fallback:", err);
      }
    }

    // 2. Tier 2: Jikan Fallback
    try {
      const jikanData = await jikanApi.getAiringSchedule(limit);
      if (jikanData && jikanData.length > 0) {
        writeThroughCache(jikanData);
        return jikanData;
      }
    } catch (jikanErr) {
      console.warn("[Jikan getAiringSchedule] Failed:", jikanErr);
    }

    // 3. Tier 3: Local Neon DB Fallback
    const dbData = await fetchDbFallback<{ media: AniListAnime[] }>({ action: "trending", limit });
    return dbData?.media || [];
  },

  searchAnime: async (
    search: string,
    filters?: { genre?: string; year?: number; format?: string; sort?: string; score?: number; status?: string },
    limit = 20
  ): Promise<AniListAnime[]> => {
    if (search && search.toLowerCase().includes("hentai")) {
      return [];
    }

    if (!isAniListCircuitOpen()) {
      try {
        const candidates = search && search.trim().length > 0 ? getSearchCandidates(search) : [search];
        let sort = filters?.sort ? filters.sort : (search ? "SEARCH_MATCH" : "TRENDING_DESC");
        if (sort === "SEARCH_MATCH" && (!search || search.trim().length === 0)) {
          sort = "TRENDING_DESC";
        }
        const query = `
          query($search: String, $limit: Int, $genre: String, $seasonYear: Int, $format: MediaFormat, $status: MediaStatus, $averageScore_greater: Int) {
            Page(page: 1, perPage: $limit) {
              media(
                search: $search, 
                type: ANIME, 
                genre: $genre,
                seasonYear: $seasonYear,
                format: $format,
                status: $status,
                averageScore_greater: $averageScore_greater,
                sort: [${sort}], 
                isAdult: false,
                genre_not_in: ["Hentai"]
              ) {
                ${MEDIA_FIELDS}
              }
            }
          }
        `;
        
        const mergedResults: AniListAnime[] = [];
        const seenIds = new Set<number>();

        for (const candidate of candidates) {
          const variables: Record<string, string | number> = { limit };
          if (candidate && candidate.trim().length > 0) variables.search = candidate;
          if (filters?.genre && filters.genre !== "Any") variables.genre = filters.genre;
          if (filters?.year && filters.year > 0) variables.seasonYear = filters.year;
          if (filters?.format && filters.format !== "Any") variables.format = filters.format;
          if (filters?.status && filters.status !== "Any") variables.status = filters.status;
          if (filters?.score && filters.score > 0) variables.averageScore_greater = filters.score;

          try {
            const data = await fetchAniList<{ Page: { media: AniListAnime[] } }>(query, variables);
            const batch = data.Page.media.filter((a) => a.idMal && isSafeAnime(a));
            for (const item of batch) {
              if (item.idMal && !seenIds.has(item.idMal)) {
                seenIds.add(item.idMal);
                mergedResults.push(item);
              }
            }
          } catch (e) {
            console.warn(`[AniList candidate query failed for "${candidate}"]:`, e);
          }

          // If we returned fewer than 3 results, continue loop to secondary query and merge
          if (mergedResults.length >= 3) {
            break;
          }
        }

        if (mergedResults.length > 0) {
          writeThroughCache(mergedResults);
          return mergedResults.slice(0, limit);
        }
      } catch (err) {
        console.warn("[AniList searchAnime] Failed, using Jikan fallback:", err);
      }
    }

    // 2. Tier 2: Jikan Fallback
    try {
      const jikanData = await jikanApi.searchAnime(search, filters, limit);
      if (jikanData && jikanData.length > 0) {
        writeThroughCache(jikanData);
        return jikanData;
      }
    } catch (jikanErr) {
      console.warn("[Jikan searchAnime] Failed:", jikanErr);
    }

    // 3. Tier 3: Local Neon DB Fallback
    const dbData = await fetchDbFallback<{ media: AniListAnime[] }>({
      action: search ? "search" : "popular",
      q: search || "",
      limit,
    });
    return dbData?.media || [];
  },

  searchAnimePaginated: async (
    search: string,
    filters?: { genre?: string; year?: number; format?: string; sort?: string; score?: number; status?: string },
    limit = 20,
    page = 1
  ): Promise<{ media: AniListAnime[], hasNextPage: boolean }> => {
    if (search && search.toLowerCase().includes("hentai")) {
      return { media: [], hasNextPage: false };
    }

    if (!isAniListCircuitOpen()) {
      try {
        const candidates = search && search.trim().length > 0 ? getSearchCandidates(search) : [search];
        let sort = filters?.sort ? filters.sort : (search ? "SEARCH_MATCH" : "TRENDING_DESC");
        if (sort === "SEARCH_MATCH" && (!search || search.trim().length === 0)) {
          sort = "TRENDING_DESC";
        }
        const query = `
          query($search: String, $limit: Int, $page: Int, $genre: String, $seasonYear: Int, $format: MediaFormat, $status: MediaStatus, $averageScore_greater: Int) {
            Page(page: $page, perPage: $limit) {
              pageInfo {
                hasNextPage
              }
              media(
                search: $search, 
                type: ANIME, 
                genre: $genre,
                seasonYear: $seasonYear,
                format: $format,
                status: $status,
                averageScore_greater: $averageScore_greater,
                sort: [${sort}], 
                isAdult: false,
                genre_not_in: ["Hentai"]
              ) {
                ${MEDIA_FIELDS}
              }
            }
          }
        `;
        
        const mergedResults: AniListAnime[] = [];
        const seenIds = new Set<number>();
        let hasNextPage = false;

        for (const candidate of candidates) {
          const variables: Record<string, string | number> = { limit, page };
          if (candidate && candidate.trim().length > 0) variables.search = candidate;
          if (filters?.genre && filters.genre !== "Any") variables.genre = filters.genre;
          if (filters?.year && filters.year > 0) variables.seasonYear = filters.year;
          if (filters?.format && filters.format !== "Any") variables.format = filters.format;
          if (filters?.status && filters.status !== "Any") variables.status = filters.status;
          if (filters?.score && filters.score > 0) variables.averageScore_greater = filters.score;

          try {
            const data = await fetchAniList<{ Page: { pageInfo: { hasNextPage: boolean }, media: AniListAnime[] } }>(query, variables);
            hasNextPage = hasNextPage || data.Page.pageInfo.hasNextPage;
            const batch = data.Page.media.filter((a) => a.idMal && isSafeAnime(a));
            for (const item of batch) {
              if (item.idMal && !seenIds.has(item.idMal)) {
                seenIds.add(item.idMal);
                mergedResults.push(item);
              }
            }
          } catch (e) {
            console.warn(`[AniList paginated candidate query failed for "${candidate}"]:`, e);
          }

          if (page > 1 || mergedResults.length >= 3) {
            break;
          }
        }

        if (mergedResults.length > 0 || page > 1) {
          writeThroughCache(mergedResults);
          return {
            media: mergedResults.slice(0, limit),
            hasNextPage
          };
        }
      } catch (err) {
        console.warn("[AniList searchAnimePaginated] Failed, using Jikan fallback:", err);
      }
    }

    // 2. Tier 2: Jikan Fallback
    try {
      const jikanData = await jikanApi.searchAnimePaginated(search, filters, limit, page);
      if (jikanData && jikanData.media && jikanData.media.length > 0) {
        writeThroughCache(jikanData.media);
        return jikanData;
      }
    } catch (jikanErr) {
      console.warn("[Jikan searchAnimePaginated] Failed:", jikanErr);
    }

    // 3. Tier 3: Local Neon DB Fallback
    const dbData = await fetchDbFallback<{ media: AniListAnime[] }>({
      action: search ? "search" : "popular",
      q: search || "",
      limit,
    });
    return {
      media: dbData?.media || [],
      hasNextPage: false,
    };
  },

  getAnimeDetails: async (idOrMalId: number | string): Promise<AniListAnime & { recommendations?: AniListAnime[], relations?: (AniListAnime & { relationType: string })[] }> => {
    // 1. Tier 1: AniList
    if (!isAniListCircuitOpen()) {
      try {
        const numId = Number(idOrMalId);
        
        const buildQuery = (isMal: boolean) => `
          query($id: Int) {
            Media(${isMal ? "idMal: $id" : "id: $id"}, type: ANIME, isAdult: false) {
              ${MEDIA_FIELDS}
              recommendations(perPage: 10, sort: RATING_DESC) {
                nodes {
                  mediaRecommendation {
                    ${MEDIA_FIELDS}
                  }
                }
              }
              relations {
                edges {
                  relationType
                  node {
                    ${MEDIA_FIELDS}
                  }
                }
              }
            }
          }
        `;

        type DetailResponse = { 
          Media: AniListAnime & { 
            recommendations?: { nodes: { mediaRecommendation: AniListAnime }[] }, 
            relations?: { edges: { relationType: string, node: AniListAnime & { type?: string } }[] } 
          } 
        };

        let data: DetailResponse | null = null;

        // First attempt: try looking up by idMal
        try {
          data = await fetchAniList<DetailResponse>(buildQuery(true), { id: numId });
        } catch {
          // Lookup by idMal failed, will attempt fallback
        }

        // Fallback attempt: if idMal didn't return Media and circuit didn't trip, query by AniList native id
        if (!data?.Media && !isAniListCircuitOpen()) {
          data = await fetchAniList<DetailResponse>(buildQuery(false), { id: numId });
        }

        if (data?.Media) {
          // Block any hentai/adult content immediately
          if (!isSafeAnime(data.Media)) {
            throw new Error("Anime not found (content restricted)");
          }

          const media: AniListAnime & { recommendations?: AniListAnime[], relations?: (AniListAnime & { relationType: string })[] } = {
            ...data.Media,
            recommendations: undefined,
            relations: undefined
          };
          
          // Map recommendations and filter out adult/hentai
          if (data.Media.recommendations?.nodes) {
            media.recommendations = data.Media.recommendations.nodes
              .map((n) => n.mediaRecommendation)
              .filter((r) => r && (r.idMal || r.id) && isSafeAnime(r));
          }
          
          // Map relations, filter OTHER/MANGA/ADULT, sort by startDate
          if (data.Media.relations?.edges) {
            const mappedRelations = data.Media.relations.edges
              .map((edge) => ({
                relationType: edge.relationType,
                ...edge.node
              }))
              .filter((r) => 
                r && 
                (r.idMal || r.id) && 
                isSafeAnime(r) &&
                r.type !== "MANGA" && 
                r.relationType !== "OTHER" &&
                r.relationType !== "CHARACTER"
              );
              
            mappedRelations.sort((a, b) => {
              const dateA = (a.startDate?.year || 9999) * 10000 + (a.startDate?.month || 12) * 100 + (a.startDate?.day || 31);
              const dateB = (b.startDate?.year || 9999) * 10000 + (b.startDate?.month || 12) * 100 + (b.startDate?.day || 31);
              return dateA - dateB;
            });
            
            media.relations = mappedRelations as (AniListAnime & { relationType: string })[];
          }
          
          writeThroughCache(media);
          return media;
        }
      } catch (err) {
        console.warn(`[AniList getAnimeDetails] Failed for ID ${idOrMalId}, using Jikan fallback:`, err);
      }
    }

    // 2. Tier 2: Jikan Fallback
    try {
      const jikanData = await jikanApi.getAnimeDetails(idOrMalId);
      if (jikanData) {
        writeThroughCache(jikanData);
        return jikanData;
      }
    } catch (jikanErr) {
      console.warn(`[Jikan getAnimeDetails] Failed for ID ${idOrMalId}:`, jikanErr);
    }

    // 3. Tier 3: Local Neon DB Fallback
    const dbData = await fetchDbFallback<{ media: AniListAnime }>({
      action: "details",
      id: idOrMalId,
    });
    if (dbData?.media && isSafeAnime(dbData.media)) {
      return dbData.media;
    }

    throw new Error(`Anime not found for ID: ${idOrMalId}`);
  },

  getAnimeTitlesByIds: async (malIds: number[]): Promise<Record<number, string>> => {
    if (!malIds || malIds.length === 0) return {};
    
    if (!isAniListCircuitOpen()) {
      try {
        const query = `
          query($idMal_in: [Int]) {
            Page(page: 1, perPage: 50) {
              media(idMal_in: $idMal_in, type: ANIME, isAdult: false, genre_not_in: ["Hentai"]) {
                idMal
                title {
                  romaji
                  english
                }
              }
            }
          }
        `;
        const data = await fetchAniList<{ Page: { media: { idMal: number, title: { romaji: string, english: string } }[] } }>(query, { idMal_in: malIds });
        
        const titles: Record<number, string> = {};
        if (data?.Page?.media) {
          data.Page.media.forEach(m => {
            if (m.idMal) {
              titles[m.idMal] = m.title.english || m.title.romaji || `Unknown (${m.idMal})`;
            }
          });
          return titles;
        }
      } catch (e) {
        console.warn("[AniList getAnimeTitlesByIds] Failed, using Jikan fallback:", e);
      }
    }
    return jikanApi.getAnimeTitlesByIds(malIds);
  },

  // Batch-fetch full AniListAnime details for multiple MAL IDs in a single request.
  // Use this instead of calling getAnimeDetails() per item (N+1 problem).
  getAnimeDetailsByIds: async (malIds: (string | number)[]): Promise<AniListAnime[]> => {
    if (!malIds || malIds.length === 0) return [];

    const numericIds = malIds.map(Number).filter(n => !isNaN(n) && n > 0);
    if (numericIds.length === 0) return [];

    if (!isAniListCircuitOpen()) {
      try {
        const query = `
          query($idMal_in: [Int]) {
            Page(page: 1, perPage: 50) {
              media(idMal_in: $idMal_in, type: ANIME, isAdult: false, genre_not_in: ["Hentai"]) {
                ${MEDIA_FIELDS}
              }
            }
          }
        `;
        const data = await fetchAniList<{ Page: { media: AniListAnime[] } }>(query, { idMal_in: numericIds });
        if (data?.Page?.media) {
          return data.Page.media.filter(isSafeAnime);
        }
      } catch (e) {
        console.warn("[AniList getAnimeDetailsByIds] Batch fetch failed, falling back per-item:", e);
      }
    }

    // Fallback: fetch individually (each goes through proxy + TanStack cache)
    const results = await Promise.allSettled(
      numericIds.map(id => jikanApi.getAnimeDetails(id).catch(() => null))
    );
    return results
      .map(r => (r.status === "fulfilled" ? r.value : null))
      .filter((a): a is AniListAnime => a !== null && isSafeAnime(a));
  },
};
