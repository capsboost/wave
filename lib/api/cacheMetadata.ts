import { db } from "@/db";
import { animeMetadata } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isSafeAnime, type AniListAnime } from "@/lib/api/anilist";

// In-memory set of known MAL IDs to avoid redundant DB queries within the same serverless instance
const knownCachedMalIds = new Set<number>();

/**
 * Checks if anime already exists in DB fallback cache.
 * If not present, dynamically saves it so it is available as Tier 3/4 fallback.
 * Only executes if anime is safe and has a valid ID.
 * Never throws or blocks page rendering.
 */
export async function cacheAnimeMetadataIfMissing(anime?: AniListAnime | null): Promise<void> {
  if (!anime || !isSafeAnime(anime)) return;

  const malId = anime.idMal || anime.id;
  if (!malId || typeof malId !== "number" || malId <= 0) return;

  // 1. Fast in-memory check (0 DB queries)
  if (knownCachedMalIds.has(malId)) return;

  try {
    // 2. Check if already exists in DB (0 writes if already cached)
    const existing = await db
      .select({ mal_id: animeMetadata.mal_id })
      .from(animeMetadata)
      .where(eq(animeMetadata.mal_id, malId))
      .limit(1);

    if (existing.length > 0) {
      knownCachedMalIds.add(malId);
      return;
    }

    // 3. New anime! Insert into DB fallback cache
    const aniId = anime.id && anime.id !== malId ? anime.id : null;
    await db.insert(animeMetadata).values({
      mal_id: malId,
      ani_id: aniId,
      title_english: anime.title?.english || null,
      title_romaji: anime.title?.romaji || null,
      cover_image_large: anime.coverImage?.large || null,
      cover_image_extra_large: anime.coverImage?.extraLarge || null,
      cover_color: anime.coverImage?.color || null,
      banner_image: anime.bannerImage || null,
      description: anime.description || null,
      genres: Array.isArray(anime.genres) ? anime.genres : [],
      episodes: anime.episodes || null,
      format: anime.format || null,
      status: anime.status || null,
      average_score: anime.averageScore || null,
      season_year: anime.seasonYear || null,
      is_adult: false,
      updated_at: new Date(),
    });

    knownCachedMalIds.add(malId);
  } catch (err) {
    console.warn(`[cacheAnimeMetadataIfMissing] Error caching anime ${malId}:`, err);
  }
}
