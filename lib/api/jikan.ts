import { AniListAnime, isSafeAnime } from "./anilist";
import { getSearchCandidates } from "@/lib/utils/searchNormalize";

const JIKAN_BASE_URL = "https://api.jikan.moe/v4";
const KITSU_BASE_URL = "https://kitsu.io/api/edge";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in-memory cache
const MIN_REQUEST_GAP_MS = 350; // Max ~2.8 requests/second to prevent Jikan 429 rate-limiting

// ---------------------------------------------------------------------------
// Internal type definitions for Jikan and Kitsu API payloads
// ---------------------------------------------------------------------------

interface JikanImage {
  image_url?: string;
  large_image_url?: string;
}

interface JikanImages {
  jpg?: JikanImage;
  webp?: JikanImage;
}

interface JikanAiredProp {
  from?: { year?: number; month?: number; day?: number };
}

interface JikanRelationEntry {
  type: string;
  mal_id: number;
  name?: string;
  images?: JikanImages;
}

interface JikanRelation {
  relation?: string;
  entry?: JikanRelationEntry[];
}

interface JikanRecommendation {
  entry?: JikanRelationEntry & { images?: JikanImages };
}

export interface JikanAnime {
  mal_id: number;
  title?: string;
  title_english?: string;
  title_japanese?: string;
  synopsis?: string;
  images?: JikanImages;
  genres?: { name: string }[];
  episodes?: number | null;
  type?: string;
  status?: string;
  score?: number;
  rating?: string;
  year?: number;
  aired?: { prop?: JikanAiredProp };
  relations?: JikanRelation[];
  recommendations?: JikanRecommendation[];
}

interface KitsuAttributes {
  titles?: { en?: string; en_jp?: string };
  canonicalTitle?: string;
  synopsis?: string;
  description?: string;
  coverImage?: { large?: string; original?: string };
  posterImage?: { large?: string; original?: string; medium?: string; small?: string };
  status?: string;
  showType?: string;
  episodeCount?: number | null;
  averageRating?: string | number;
  ageRating?: string;
  ageRatingGuide?: string;
  startDate?: string;
  slug?: string;
}

interface KitsuMappingAttributes {
  externalSite?: string;
  externalId?: string;
}

interface KitsuMapping {
  id: string;
  type: string;
  attributes?: KitsuMappingAttributes;
}

export interface KitsuItem {
  id: string;
  type?: string;
  attributes?: KitsuAttributes;
  relationships?: {
    mappings?: { data?: { id: string; type: string }[] };
  };
}

interface KitsuResponse<T> {
  data?: T;
  included?: KitsuMapping[];
  meta?: { count?: number };
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------
const memoryCache = new Map<string, { data: unknown; expiry: number }>();

// Request throttler queue to avoid 429s from Jikan
let lastRequestTime = 0;
let queuePromise = Promise.resolve();

function throttledFetch(url: string, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    queuePromise = queuePromise
      .then(async () => {
        const now = Date.now();
        const elapsed = now - lastRequestTime;
        if (elapsed < MIN_REQUEST_GAP_MS) {
          await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS - elapsed));
        }
        lastRequestTime = Date.now();
        return fetch(url, {
          ...init,
          signal: init?.signal ?? AbortSignal.timeout(8_000),
          headers: {
            "Accept": "application/json",
            // User-Agent is a forbidden header in browser Fetch -- only set server-side
            ...(typeof window === "undefined" ? { "User-Agent": "WaveAnime/1.0" } : {}),
            ...init?.headers,
          },
        });
      })
      .then(resolve)
      .catch(reject);
  });
}

async function fetchJikan<T>(endpoint: string): Promise<T> {
  const cacheKey = `jikan:${endpoint}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }

  const url = `${JIKAN_BASE_URL}${endpoint}`;
  const res = await throttledFetch(url);

  if (!res.ok) {
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      const retry = await throttledFetch(url);
      if (!retry.ok) {
        throw new Error(`Jikan API rate limited (${retry.status})`);
      }
      const json = await retry.json() as T;
      memoryCache.set(cacheKey, { data: json, expiry: Date.now() + CACHE_TTL_MS });
      return json;
    }
    throw new Error(`Jikan API failed with status ${res.status}: ${res.statusText}`);
  }

  const json = await res.json() as T;
  memoryCache.set(cacheKey, { data: json, expiry: Date.now() + CACHE_TTL_MS });
  return json;
}

async function fetchKitsu<T>(endpoint: string): Promise<T> {
  const cacheKey = `kitsu:${endpoint}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }

  const url = `${KITSU_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    throw new Error(`Kitsu API failed with status ${res.status}`);
  }

  const json = await res.json() as T;
  memoryCache.set(cacheKey, { data: json, expiry: Date.now() + CACHE_TTL_MS });
  return json;
}

function mapJikanToAniList(jikan: JikanAnime): AniListAnime {
  const images = jikan.images;
  const webp = images?.webp;
  const jpg = images?.jpg;
  const coverLarge =
    webp?.large_image_url ||
    jpg?.large_image_url ||
    webp?.image_url ||
    jpg?.image_url ||
    "";
  const coverMedium =
    webp?.image_url ||
    jpg?.image_url ||
    coverLarge;

  let status: string | null = null;
  if (jikan.status === "Currently Airing") status = "RELEASING";
  else if (jikan.status === "Finished Airing") status = "FINISHED";
  else if (jikan.status === "Not yet aired") status = "NOT_YET_RELEASED";
  else status = jikan.status || null;

  const titleEnglish = jikan.title_english || jikan.title || null;
  const titleRomaji = jikan.title || jikan.title_japanese || titleEnglish;

  const genres = Array.isArray(jikan.genres)
    ? jikan.genres.map((g) => g.name).filter(Boolean)
    : [];
  const isHentaiGenre = genres.some((g) => g.toLowerCase() === "hentai" || g.toLowerCase() === "erotica");
  const isHentaiRating = Boolean(jikan.rating && (jikan.rating.toLowerCase().includes("hentai") || jikan.rating.toLowerCase().startsWith("rx")));
  const isAdult = isHentaiGenre || isHentaiRating;

  return {
    id: jikan.mal_id,
    idMal: jikan.mal_id,
    title: {
      english: titleEnglish,
      romaji: titleRomaji,
    },
    bannerImage: coverLarge || null,
    coverImage: {
      extraLarge: coverLarge,
      large: coverMedium,
      color: null,
    },
    description: jikan.synopsis || null,
    genres,
    isAdult,
    episodes: jikan.episodes || null,
    format: jikan.type ? String(jikan.type).toUpperCase() : "TV",
    status,
    averageScore: typeof jikan.score === "number" ? Math.round(jikan.score * 10) : null,
    nextAiringEpisode: null,
    seasonYear: jikan.year || jikan.aired?.prop?.from?.year || null,
    startDate: {
      year: jikan.aired?.prop?.from?.year ?? null,
      month: jikan.aired?.prop?.from?.month ?? null,
      day: jikan.aired?.prop?.from?.day ?? null,
    },
  };
}

function mapKitsuToAniList(kitsuItem: KitsuItem, malId?: number | null): AniListAnime {
  const attrs = kitsuItem.attributes || {};
  const coverLarge =
    attrs.coverImage?.large ||
    attrs.coverImage?.original ||
    attrs.posterImage?.large ||
    attrs.posterImage?.original ||
    "";
  const posterLarge =
    attrs.posterImage?.large ||
    attrs.posterImage?.original ||
    coverLarge;
  const posterMedium =
    attrs.posterImage?.medium ||
    attrs.posterImage?.small ||
    posterLarge;

  let status: string | null = null;
  if (attrs.status === "current") status = "RELEASING";
  else if (attrs.status === "finished") status = "FINISHED";
  else if (attrs.status === "unreleased" || attrs.status === "upcoming") status = "NOT_YET_RELEASED";
  else status = attrs.status || null;

  const resolvedMalId = malId || Number(attrs.slug) || Number(kitsuItem.id) || null;
  const titleEnglish = attrs.titles?.en || attrs.canonicalTitle || null;
  const titleRomaji = attrs.titles?.en_jp || attrs.canonicalTitle || titleEnglish;

  let year: number | null = null;
  let startDate = null;
  if (attrs.startDate) {
    const parts = String(attrs.startDate).split("-").map(Number);
    year = parts[0] || null;
    startDate = {
      year: parts[0] || null,
      month: parts[1] || null,
      day: parts[2] || null,
    };
  }

  const isAdult = attrs.ageRating === "R18" || Boolean(attrs.ageRatingGuide && attrs.ageRatingGuide.toLowerCase().includes("hentai"));

  return {
    id: resolvedMalId || Number(kitsuItem.id),
    idMal: resolvedMalId,
    title: {
      english: titleEnglish,
      romaji: titleRomaji,
    },
    bannerImage: coverLarge || null,
    coverImage: {
      extraLarge: posterLarge,
      large: posterMedium,
      color: null,
    },
    description: attrs.synopsis || attrs.description || null,
    genres: [],
    isAdult,
    episodes: attrs.episodeCount || null,
    format: attrs.showType ? String(attrs.showType).toUpperCase() : "TV",
    status,
    averageScore: attrs.averageRating ? Math.round(Number(attrs.averageRating)) : null,
    nextAiringEpisode: null,
    seasonYear: year,
    startDate,
  };
}

function parseKitsuDataWithMappings(kitsuResponse: KitsuResponse<KitsuItem[]>): AniListAnime[] {
  if (!kitsuResponse?.data || !Array.isArray(kitsuResponse.data)) return [];

  const mappingToMalId = new Map<string, number>();
  const mappingToAniId = new Map<string, number>();
  if (Array.isArray(kitsuResponse.included)) {
    kitsuResponse.included.forEach((inc) => {
      if (inc.type === "mappings") {
        if (inc.attributes?.externalSite === "myanimelist/anime") {
          mappingToMalId.set(inc.id, Number(inc.attributes.externalId));
        } else if (inc.attributes?.externalSite === "anilist/anime") {
          mappingToAniId.set(inc.id, Number(inc.attributes.externalId));
        }
      }
    });
  }

  return kitsuResponse.data.map((item) => {
    let malId: number | null = null;
    let aniId: number | null = null;
    const mappingRefs = item.relationships?.mappings?.data;
    if (Array.isArray(mappingRefs)) {
      for (const ref of mappingRefs) {
        if (mappingToMalId.has(ref.id)) {
          malId = mappingToMalId.get(ref.id)!;
        }
        if (mappingToAniId.has(ref.id)) {
          aniId = mappingToAniId.get(ref.id)!;
        }
      }
    }
    const anime = mapKitsuToAniList(item, malId);
    if (aniId) {
      anime.id = aniId;
    }
    return anime;
  });
}

function deduplicateAnime(list: AniListAnime[]): AniListAnime[] {
  const seen = new Set<number | string>();
  return list.filter((item) => {
    if (!isSafeAnime(item)) return false;
    const key = item.idMal || item.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getKitsuStatusFilter(status?: string): string | null {
  if (!status || status === "Any") return null;
  if (status === "FINISHED") return "filter[status]=finished";
  if (status === "NOT_YET_RELEASED") return "filter[status]=upcoming";
  return "filter[status]=current";
}

function getKitsuSortParam(sort?: string, hasSearch = false): string | null {
  if (sort === "SCORE_DESC") return "sort=-average_rating";
  if (sort === "UPDATED_AT_DESC") return "sort=-startDate";
  if (sort === "SEARCH_MATCH" && hasSearch) return null;
  return "sort=-user_count";
}

function buildKitsuFilterQuery(
  search?: string,
  filters?: {
    genre?: string;
    year?: number;
    format?: string;
    sort?: string;
    score?: number;
    status?: string;
  },
  limit = 20,
  offset = 0
): string {
  const params: string[] = ["filter[ageRating]=G,PG,R"];
  const trimmedSearch = search?.trim();

  if (trimmedSearch) {
    params.push(`filter[text]=${encodeURIComponent(trimmedSearch)}`);
  }

  if (filters?.genre && filters.genre !== "Any") {
    params.push(`filter[categories]=${encodeURIComponent(filters.genre.toLowerCase())}`);
  }

  if (filters?.year && filters.year > 0) {
    params.push(`filter[seasonYear]=${filters.year}`);
  }

  if (filters?.format && filters.format !== "Any") {
    params.push(`filter[subtype]=${encodeURIComponent(filters.format.toLowerCase())}`);
  }

  const statusFilter = getKitsuStatusFilter(filters?.status);
  if (statusFilter) params.push(statusFilter);

  if (filters?.score && filters.score > 0) {
    params.push(`filter[average_rating]=${filters.score}..100`);
  }

  const sortParam = getKitsuSortParam(filters?.sort, Boolean(trimmedSearch));
  if (sortParam) params.push(sortParam);

  const safeLimit = Math.min(Math.max(1, limit), 20);
  params.push(`page[limit]=${safeLimit}`);
  if (offset > 0) {
    params.push(`page[offset]=${offset}`);
  }
  params.push("include=mappings");

  return `/anime?${params.join("&")}`;
}

async function resolveAniListId(targetMalId: number): Promise<number | null> {
  try {
    const mappedData = await fetchKitsu<KitsuResponse<KitsuItem>>(
      `/mappings?filter[external_site]=myanimelist/anime&filter[external_id]=${targetMalId}&include=item`
    );
    const kitsuId = (mappedData?.included?.[0] as KitsuItem | undefined)?.id;
    if (!kitsuId) return null;
    const mapRes = await fetchKitsu<KitsuResponse<KitsuMapping[]>>(`/anime/${kitsuId}/mappings`);
    const anilistMap = mapRes?.data?.find(
      (m) => m.attributes?.externalSite === "anilist/anime"
    );
    return anilistMap ? Number(anilistMap.attributes?.externalId) : null;
  } catch {
    return null;
  }
}

function parseJikanRelations(relationsData?: JikanRelation[]): (AniListAnime & { relationType: string })[] {
  if (!Array.isArray(relationsData)) return [];
  const relations: (AniListAnime & { relationType: string })[] = [];
  for (const rel of relationsData) {
    const relationType = (rel.relation || "RELATED").toUpperCase().replace(/\s+/g, "_");
    if (!Array.isArray(rel.entry)) continue;
    for (const entry of rel.entry) {
      if (entry.type === "anime" && entry.mal_id) {
        relations.push({
          id: entry.mal_id,
          idMal: entry.mal_id,
          title: { english: entry.name || null, romaji: entry.name || null },
          bannerImage: null,
          coverImage: { extraLarge: "", large: "", color: null },
          description: null,
          genres: [],
          episodes: null,
          format: "TV",
          status: null,
          averageScore: null,
          nextAiringEpisode: null,
          seasonYear: null,
          relationType,
        });
      }
    }
  }
  return relations;
}

function parseJikanRecommendations(recsData?: JikanRecommendation[]): AniListAnime[] {
  if (!Array.isArray(recsData)) return [];
  const recs: AniListAnime[] = [];
  for (const rec of recsData) {
    if (rec?.entry?.mal_id) {
      recs.push(mapJikanToAniList({ ...rec.entry, images: rec.entry.images }));
    }
  }
  return recs;
}

async function fetchKitsuAnimeDetails(malId: number, idOrMalId: number | string): Promise<AniListAnime | null> {
  try {
    const mappedData = await fetchKitsu<KitsuResponse<KitsuItem>>(
      `/mappings?filter[external_site]=myanimelist/anime&filter[external_id]=${malId}&include=item`
    );
    const kitsuAnime = mappedData?.included?.[0] as KitsuItem | undefined;
    if (kitsuAnime) {
      const baseMedia = mapKitsuToAniList(kitsuAnime, malId);
      const aniId = await resolveAniListId(malId);
      if (aniId) {
        baseMedia.id = aniId;
      }
      return baseMedia;
    }
  } catch (e) {
    console.warn(`[Kitsu getAnimeDetails] Mapping lookup failed:`, e);
  }

  try {
    const directData = await fetchKitsu<KitsuResponse<KitsuItem>>(`/anime/${idOrMalId}`);
    if (directData?.data) {
      return mapKitsuToAniList(directData.data, malId);
    }
  } catch (e) {
    console.warn(`[Kitsu getAnimeDetails] Direct ID lookup failed:`, e);
  }

  return null;
}

export const jikanApi = {
  getTrending: async (limit = 15, page = 1): Promise<AniListAnime[]> => {
    // 1. Try Jikan
    try {
      const data = await fetchJikan<{ data: JikanAnime[] }>(`/top/anime?limit=${limit}&page=${page}`);
      if (data?.data?.length) {
        return deduplicateAnime(data.data.map(mapJikanToAniList));
      }
    } catch (e) {
      console.warn("[Jikan getTrending] 504/Rate limited, falling back to Kitsu:", e);
    }

    // 2. Fallback to Kitsu
    try {
      const endpoint = buildKitsuFilterQuery(undefined, { sort: "POPULARITY_DESC" }, limit, (page - 1) * limit);
      const kitsuData = await fetchKitsu<KitsuResponse<KitsuItem[]>>(endpoint);
      return deduplicateAnime(parseKitsuDataWithMappings(kitsuData));
    } catch (e) {
      console.warn("[Kitsu getTrending] Failed:", e);
    }

    return [];
  },

  getPopular: async (limit = 15): Promise<AniListAnime[]> => {
    try {
      const endpoint = buildKitsuFilterQuery(undefined, { sort: "POPULARITY_DESC" }, limit, 0);
      const kitsuData = await fetchKitsu<KitsuResponse<KitsuItem[]>>(endpoint);
      const parsed = parseKitsuDataWithMappings(kitsuData);
      if (parsed.length > 0) return deduplicateAnime(parsed);
    } catch (e) {
      console.warn("[Kitsu getPopular] Failed:", e);
    }

    try {
      const safeLimit = Math.min(limit, 25);
      const data = await fetchJikan<{ data: JikanAnime[] }>(`/top/anime?sfw=true&limit=${safeLimit}`);
      return deduplicateAnime((data.data || []).map(mapJikanToAniList));
    } catch {
      return [];
    }
  },

  getRecentReleases: async (limit = 20): Promise<AniListAnime[]> => {
    try {
      const endpoint = buildKitsuFilterQuery(undefined, { status: "RELEASING", sort: "UPDATED_AT_DESC" }, limit, 0);
      const kitsuData = await fetchKitsu<KitsuResponse<KitsuItem[]>>(endpoint);
      const parsed = parseKitsuDataWithMappings(kitsuData);
      if (parsed.length > 0) return deduplicateAnime(parsed);
    } catch (e) {
      console.warn("[Kitsu getRecentReleases] Failed:", e);
    }

    try {
      const safeLimit = Math.min(limit, 25);
      const data = await fetchJikan<{ data: JikanAnime[] }>(`/seasons/now?sfw=true&limit=${safeLimit}`);
      return deduplicateAnime((data.data || []).map(mapJikanToAniList));
    } catch {
      return [];
    }
  },

  getTopThisWeek: async (limit = 9): Promise<AniListAnime[]> => {
    try {
      const endpoint = buildKitsuFilterQuery(undefined, { status: "RELEASING", sort: "SCORE_DESC" }, limit, 0);
      const kitsuData = await fetchKitsu<KitsuResponse<KitsuItem[]>>(endpoint);
      const parsed = parseKitsuDataWithMappings(kitsuData);
      if (parsed.length > 0) return deduplicateAnime(parsed);
    } catch (e) {
      console.warn("[Kitsu getTopThisWeek] Failed:", e);
    }

    try {
      const safeLimit = Math.min(limit, 25);
      const data = await fetchJikan<{ data: JikanAnime[] }>(`/top/anime?sfw=true&limit=${safeLimit}`);
      return deduplicateAnime((data.data || []).map(mapJikanToAniList));
    } catch {
      return [];
    }
  },

  getAiringSchedule: async (limit = 20): Promise<AniListAnime[]> => {
    // 1. Kitsu currently releasing anime with calculated weekly broadcast schedules
    try {
      const endpoint1 = buildKitsuFilterQuery(undefined, { status: "RELEASING", sort: "POPULARITY_DESC" }, 20, 0);
      const endpoint2 = buildKitsuFilterQuery(undefined, { status: "RELEASING", sort: "POPULARITY_DESC" }, 20, 20);
      const [data1, data2] = await Promise.all([
        fetchKitsu<KitsuResponse<KitsuItem[]>>(endpoint1),
        fetchKitsu<KitsuResponse<KitsuItem[]>>(endpoint2).catch(() => null),
      ]);
      const parsed = deduplicateAnime([
        ...parseKitsuDataWithMappings(data1),
        ...(data2 ? parseKitsuDataWithMappings(data2) : []),
      ]);

      if (parsed.length > 0) {
        const now = Date.now();
        const today = new Date();

        return parsed.map((anime, idx) => {
          let dayOfWeek = (idx % 7);
          let ep = Math.max(1, 12 - (idx % 12));

          if (anime.startDate?.year && anime.startDate?.month) {
            const s = new Date(anime.startDate.year, anime.startDate.month - 1, anime.startDate.day || 1);
            if (!Number.isNaN(s.getTime())) {
              dayOfWeek = s.getDay();
              const weeks = Math.floor((now - s.getTime()) / (7 * 24 * 60 * 60 * 1000));
              ep = Math.max(1, Math.min(weeks + 1, 2000));
            }
          }

          let diff = dayOfWeek - today.getDay();
          if (diff < 0) diff += 7;

          // Target broadcast time around 6:00 PM JST
          const nextDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff, 18, 0, 0);
          const airingAt = Math.floor(nextDate.getTime() / 1000);

          return {
            ...anime,
            nextAiringEpisode: {
              airingAt,
              episode: ep,
            },
          };
        });
      }
    } catch (e) {
      console.warn("[Kitsu getAiringSchedule] Failed:", e);
    }

    // 2. Fallback to Jikan schedules
    try {
      const safeLimit = Math.min(limit, 25);
      const data = await fetchJikan<{ data: JikanAnime[] }>(`/schedules?sfw=true&limit=${safeLimit}`);
      return deduplicateAnime((data.data || []).map(mapJikanToAniList));
    } catch {
      return [];
    }
  },

  searchAnime: async (
    search: string,
    filters?: { genre?: string; year?: number; format?: string; sort?: string; score?: number; status?: string },
    limit = 20
  ): Promise<AniListAnime[]> => {
    if (search && search.toLowerCase().includes("hentai")) {
      return [];
    }

    const candidates = search && search.trim().length > 0 ? getSearchCandidates(search) : [search];

    // 1. Try Kitsu with candidates
    for (const candidate of candidates) {
      try {
        const endpoint = buildKitsuFilterQuery(candidate, filters, limit, 0);
        const kitsuData = await fetchKitsu<KitsuResponse<KitsuItem[]>>(endpoint);
        const media = parseKitsuDataWithMappings(kitsuData);
        if (media.length > 0) return deduplicateAnime(media);
      } catch (e) {
        console.warn("[Kitsu searchAnime] Failed, trying next candidate/Jikan:", e);
      }
    }

    // 2. Fallback to Jikan search with candidates
    if (search && search.trim().length > 0) {
      for (const candidate of candidates) {
        try {
          const params = new URLSearchParams();
          params.set("q", candidate.trim());
          params.set("limit", String(limit));
          params.set("sfw", "true");
          const data = await fetchJikan<{ data: JikanAnime[] }>(`/anime?${params.toString()}`);
          if (data?.data?.length) {
            return deduplicateAnime(data.data.map(mapJikanToAniList));
          }
        } catch (e) {
          console.warn("[Jikan searchAnime] Failed:", e);
        }
      }
    }

    return [];
  },

  searchAnimePaginated: async (
    search: string,
    filters?: { genre?: string; year?: number; format?: string; sort?: string; score?: number; status?: string },
    limit = 20,
    page = 1
  ): Promise<{ media: AniListAnime[]; hasNextPage: boolean }> => {
    if (search && search.toLowerCase().includes("hentai")) {
      return { media: [], hasNextPage: false };
    }

    const safeLimit = Math.min(Math.max(1, limit), 20);
    const offset = (page - 1) * safeLimit;
    const candidates = search && search.trim().length > 0 ? getSearchCandidates(search) : [search];

    // 1. Try Kitsu with candidates
    for (const candidate of candidates) {
      try {
        const endpoint = buildKitsuFilterQuery(candidate, filters, safeLimit, offset);
        const kitsuData = await fetchKitsu<KitsuResponse<KitsuItem[]>>(endpoint);
        const media = deduplicateAnime(parseKitsuDataWithMappings(kitsuData));
        if (media.length > 0 || page > 1) {
          return {
            media,
            hasNextPage: media.length === safeLimit,
          };
        }
      } catch (e) {
        console.warn("[Kitsu searchAnimePaginated] Failed, trying next candidate/Jikan:", e);
      }
    }

    // 2. Fallback to Jikan search if text provided
    if (search && search.trim().length > 0) {
      for (const candidate of candidates) {
        try {
          const params = new URLSearchParams();
          params.set("q", candidate.trim());
          params.set("limit", String(safeLimit));
          params.set("page", String(page));
          params.set("sfw", "true");
          const data = await fetchJikan<{ data: JikanAnime[]; pagination?: { has_next_page?: boolean } }>(
            `/anime?${params.toString()}`
          );
          if (data?.data?.length) {
            return {
              media: deduplicateAnime(data.data.map(mapJikanToAniList)),
              hasNextPage: Boolean(data?.pagination?.has_next_page),
            };
          }
        } catch (e) {
          console.warn("[Jikan searchAnimePaginated] Failed:", e);
        }
      }
    }

    return { media: [], hasNextPage: false };
  },

  getAnimeDetails: async (
    idOrMalId: number | string
  ): Promise<
    AniListAnime & {
      recommendations?: AniListAnime[];
      relations?: (AniListAnime & { relationType: string })[];
    }
  > => {
    const malId = Number(idOrMalId);

    // 1. Try Jikan /anime/{id}/full
    try {
      const data = await fetchJikan<{ data: JikanAnime & { relations?: JikanRelation[]; recommendations?: JikanRecommendation[] } }>(`/anime/${malId}/full`);
      const jikanAnime = data.data;

      if (jikanAnime) {
        const baseMedia = mapJikanToAniList(jikanAnime);
        if (!isSafeAnime(baseMedia)) {
          throw new Error("Anime not found (content restricted)");
        }

        // Attempt to enrich with real AniList ID for the player
        try {
          const aniId = await resolveAniListId(malId);
          if (aniId) {
            baseMedia.id = aniId;
          }
        } catch {}

        const relations = parseJikanRelations(jikanAnime.relations).filter(isSafeAnime);
        const recommendations = parseJikanRecommendations(jikanAnime.recommendations).filter(isSafeAnime);

        return {
          ...baseMedia,
          relations: relations.length ? relations : undefined,
          recommendations: recommendations.length ? recommendations : undefined,
        };
      }
    } catch (e) {
      console.warn(`[Jikan getAnimeDetails] Failed for MAL ID ${malId}, falling back to Kitsu:`, e);
    }

    // 2. Fallback to Kitsu
    const kitsuMedia = await fetchKitsuAnimeDetails(malId, idOrMalId);
    if (kitsuMedia) {
      if (!isSafeAnime(kitsuMedia)) {
        throw new Error("Anime not found (content restricted)");
      }
      return {
        ...kitsuMedia,
        relations: undefined,
        recommendations: undefined,
      };
    }

    throw new Error(`Anime not found for ID: ${idOrMalId}`);
  },

  getAnimeTitlesByIds: async (malIds: number[]): Promise<Record<number, string>> => {
    const titles: Record<number, string> = {};
    if (!malIds || malIds.length === 0) return titles;

    for (const id of malIds.slice(0, 10)) {
      try {
        const data = await fetchJikan<{ data: JikanAnime }>(`/anime/${id}`);
        if (data?.data?.title) {
          titles[id] = data.data.title_english || data.data.title || `Anime #${id}`;
          continue;
        }
      } catch {}

      try {
        const mappedData = await fetchKitsu<KitsuResponse<KitsuItem>>(
          `/mappings?filter[external_site]=myanimelist/anime&filter[external_id]=${id}&include=item`
        );
        const item = (mappedData?.included?.[0] as KitsuItem | undefined);
        if (item?.attributes?.canonicalTitle) {
          titles[id] = item.attributes.titles?.en || item.attributes.canonicalTitle;
          continue;
        }
      } catch {}

      titles[id] = `Anime #${id}`;
    }
    return titles;
  },
};
