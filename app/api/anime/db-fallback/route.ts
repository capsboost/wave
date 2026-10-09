import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { animeMetadata } from "@/db/schema";
import { eq, or, and, desc, ilike } from "drizzle-orm";
import type { AniListAnime } from "@/lib/api/anilist";

function mapRowToAniList(row: typeof animeMetadata.$inferSelect): AniListAnime {
  return {
    id: row.ani_id || row.mal_id,
    idMal: row.mal_id,
    title: {
      english: row.title_english,
      romaji: row.title_romaji || row.title_english,
    },
    bannerImage: row.banner_image,
    coverImage: {
      extraLarge: row.cover_image_extra_large || row.cover_image_large || "",
      large: row.cover_image_large || row.cover_image_extra_large || "",
      color: row.cover_color,
    },
    description: row.description,
    genres: row.genres || [],
    isAdult: row.is_adult,
    episodes: row.episodes,
    format: row.format || "TV",
    status: row.status,
    averageScore: row.average_score,
    nextAiringEpisode: null,
    seasonYear: row.season_year,
    startDate: row.season_year ? { year: row.season_year, month: 1, day: 1 } : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "popular";
    const id = searchParams.get("id");
    const q = searchParams.get("q");
    const limit = Math.min(Math.max(1, Number(searchParams.get("limit")) || 20), 50);

    // 1. Single anime details lookup
    if (action === "details" && id) {
      const numId = Number(id);
      if (!numId || Number.isNaN(numId)) {
        return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
      }

      const rows = await db
        .select()
        .from(animeMetadata)
        .where(
          and(
            eq(animeMetadata.is_adult, false),
            or(eq(animeMetadata.mal_id, numId), eq(animeMetadata.ani_id, numId))
          )
        )
        .limit(1);

      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Anime not found in DB cache" },
          {
            status: 404,
            headers: {
              "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
            },
          }
        );
      }

      return NextResponse.json(
        { media: mapRowToAniList(rows[0]) },
        {
          headers: {
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        }
      );
    }

    // 2. Search query fallback
    if (action === "search" && q) {
      const trimmedQ = q.trim();
      if (trimmedQ.toLowerCase().includes("hentai")) {
        return NextResponse.json({ media: [] });
      }

      const pattern = `%${trimmedQ}%`;
      const rows = await db
        .select()
        .from(animeMetadata)
        .where(
          and(
            eq(animeMetadata.is_adult, false),
            or(
              ilike(animeMetadata.title_english, pattern),
              ilike(animeMetadata.title_romaji, pattern)
            )
          )
        )
        .orderBy(desc(animeMetadata.average_score), desc(animeMetadata.updated_at))
        .limit(limit);

      return NextResponse.json(
        { media: rows.map(mapRowToAniList) },
        {
          headers: {
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        }
      );
    }

    // 3. Trending anime fallback
    if (action === "trending") {
      const rows = await db
        .select()
        .from(animeMetadata)
        .where(eq(animeMetadata.is_adult, false))
        .orderBy(desc(animeMetadata.updated_at), desc(animeMetadata.average_score))
        .limit(limit);

      return NextResponse.json(
        { media: rows.map(mapRowToAniList) },
        {
          headers: {
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        }
      );
    }

    // 4. Popular anime fallback (default)
    const rows = await db
      .select()
      .from(animeMetadata)
      .where(eq(animeMetadata.is_adult, false))
      .orderBy(desc(animeMetadata.average_score), desc(animeMetadata.updated_at))
      .limit(limit);

    return NextResponse.json(
      { media: rows.map(mapRowToAniList) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("[DB Fallback API Error]:", error);
    return NextResponse.json({ error: "Database fallback query failed", media: [] }, { status: 500 });
  }
}
