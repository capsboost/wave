import { NextResponse } from 'next/server';
import { db } from '@/db';
import { animeEpisodes } from '@/db/schema';
import { inArray } from 'drizzle-orm';

export const revalidate = 3600; // Cache for 1 hour

export async function GET(
  request: Request,
  context: { params: Promise<{ mal_id: string }> }
) {
  const { mal_id } = await context.params;
  const { searchParams } = new URL(request.url);
  const malIdParam = searchParams.get('malId');
  const aniIdParam = searchParams.get('aniId');
  
  try {
    // Generate all candidate anime_ids to match either MAL ID or AniList ID variants
    const candidateSet = new Set<string>();
    
    const addVariants = (val?: string | null) => {
      if (!val) return;
      const clean = val.trim();
      if (!clean || clean === '0' || clean === 'null' || clean === 'undefined') return;
      candidateSet.add(clean);
      if (!clean.startsWith('ani_')) {
        candidateSet.add(`ani_${clean}`);
      } else {
        candidateSet.add(clean.replace(/^ani_/, ''));
      }
    };

    addVariants(mal_id);
    addVariants(malIdParam);
    addVariants(aniIdParam);

    const candidates = Array.from(candidateSet);

    if (candidates.length === 0) {
      return NextResponse.json(
        { is_sub: null, is_dub: null, error: "Invalid ID parameter" },
        { status: 400 }
      );
    }

    const result = await db.select().from(animeEpisodes).where(
      inArray(animeEpisodes.anime_id, candidates)
    );
    
    if (result.length > 0) {
      // Pick the row with the most complete episode coverage if multiple matches exist
      const bestMatch = result.reduce((prev, curr) => {
        const prevTotal = (prev.is_sub ?? 0) + (prev.is_dub ?? 0);
        const currTotal = (curr.is_sub ?? 0) + (curr.is_dub ?? 0);
        return currTotal >= prevTotal ? curr : prev;
      }, result[0]);

      return NextResponse.json(bestMatch, {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      });
    }

    // Not found in database
    return NextResponse.json(
      {
        is_sub: null,
        is_dub: null,
        error: "Not found in Anikoto database",
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );

  } catch (error) {
    console.error("API Error reading database:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
