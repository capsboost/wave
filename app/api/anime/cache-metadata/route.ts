import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { animeMetadata } from "@/db/schema";
import { sql, inArray } from "drizzle-orm";
import { isSafeAnime, type AniListAnime } from "@/lib/api/anilist";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawList: AniListAnime[] = Array.isArray(body.animeList)
      ? body.animeList
      : body.anime
      ? [body.anime]
      : [];

    if (rawList.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Filter strictly for safe, non-adult anime with valid MAL ID
    const validItems = rawList.filter((item) => {
      if (!item || !isSafeAnime(item)) return false;
      const id = item.idMal || item.id;
      return typeof id === "number" && id > 0 && !Number.isNaN(id);
    });

    if (validItems.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const now = new Date();
    const records = validItems.map((item) => {
      const malId = item.idMal || item.id;
      const aniId = item.id && item.id !== malId ? item.id : null;

      return {
        mal_id: malId,
        ani_id: aniId,
        title_english: item.title?.english || null,
        title_romaji: item.title?.romaji || null,
        cover_image_large: item.coverImage?.large || null,
        cover_image_extra_large: item.coverImage?.extraLarge || null,
        cover_color: item.coverImage?.color || null,
        banner_image: item.bannerImage || null,
        description: item.description || null,
        genres: Array.isArray(item.genres) ? item.genres : [],
        episodes: item.episodes || null,
        format: item.format || null,
        status: item.status || null,
        average_score: item.averageScore || null,
        season_year: item.seasonYear || null,
        is_adult: false,
        updated_at: now,
      };
    });

    // Deduplicate by mal_id before upsert
    const uniqueMap = new Map<number, (typeof records)[0]>();
    for (const rec of records) {
      uniqueMap.set(rec.mal_id, rec);
    }
    const dedupedRecords = Array.from(uniqueMap.values());
    if (dedupedRecords.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Check which IDs already exist in the database (0 writes for existing anime)
    const malIds = dedupedRecords.map((r) => r.mal_id);
    const existingRows = await db
      .select({ mal_id: animeMetadata.mal_id })
      .from(animeMetadata)
      .where(inArray(animeMetadata.mal_id, malIds));

    const existingIdSet = new Set(existingRows.map((r) => r.mal_id));
    const newRecords = dedupedRecords.filter((r) => !existingIdSet.has(r.mal_id));

    if (newRecords.length === 0) {
      return NextResponse.json({ success: true, count: 0, skipped: dedupedRecords.length });
    }

    // Insert only brand new anime
    await db.insert(animeMetadata).values(newRecords);

    return NextResponse.json({ success: true, count: newRecords.length, skipped: dedupedRecords.length - newRecords.length });
  } catch (error) {
    console.error("[Cache Metadata API Error]:", error);
    return NextResponse.json({ error: "Failed to cache metadata" }, { status: 500 });
  }
}
