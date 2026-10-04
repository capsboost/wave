import type { Metadata } from "next";
import { anilistApi } from "@/lib/api/anilist";
import AnimeClient from "./AnimeClient";

export const revalidate = 3600; // Cache for 1 hour

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const anime = await anilistApi.getAnimeDetails(id);
    if (!anime) return { title: "Anime Not Found" };

    const title = anime.title.english || anime.title.romaji || "Anime";
    const cleanDesc = (anime.description || "")
      .replace(/<[^>]*>/g, "")
      .replace(/(\(|<i>)?Source:.*$/i, "")
      .trim()
      .slice(0, 160);

    const year = anime.seasonYear ? ` (${anime.seasonYear})` : "";
    const genres = anime.genres?.slice(0, 3).join(", ") || "Anime";
    const cover = anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large || "";

    return {
      title: `Watch ${title}${year} English Sub/Dub Online Free`,
      description: `Stream ${title}${year} online free in HD. ${cleanDesc || `Watch ${title} with English subtitles and dubbing on Wave Anime.`} Genres: ${genres}. The premier ad-free alternative to Aniwave and HiAnime.`,
      keywords: [
        title,
        `${title} anime`,
        `watch ${title} online`,
        `${title} english sub`,
        `${title} english dub`,
        `${title} episodes`,
        `aniwave ${title}`,
        `hianime ${title}`,
        `animepahe ${title}`,
      ],
      openGraph: {
        title: `Watch ${title}${year} English Sub/Dub Online Free | Wave Anime`,
        description: cleanDesc,
        images: cover ? [{ url: cover, alt: title }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: `Watch ${title}${year} English Sub/Dub Online Free`,
        description: cleanDesc,
        images: cover ? [cover] : [],
      },
    };
  } catch {
    return { title: "Anime Details | Wave Anime" };
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let schemaData: Record<string, unknown> | null = null;
  try {
    const anime = await anilistApi.getAnimeDetails(id);
    if (anime) {
      const title = anime.title.english || anime.title.romaji || "Anime";
      const cleanDesc = (anime.description || "")
        .replace(/<[^>]*>/g, "")
        .replace(/(\(|<i>)?Source:.*$/i, "")
        .trim()
        .slice(0, 200);

      schemaData = {
        "@context": "https://schema.org",
        "@type": anime.format === "MOVIE" ? "Movie" : "TVSeries",
        name: title,
        alternateName: [anime.title.romaji, anime.title.english].filter(Boolean),
        image: anime.coverImage?.extraLarge || anime.bannerImage || undefined,
        description: cleanDesc,
        genre: anime.genres,
        datePublished: anime.startDate?.year ? `${anime.startDate.year}` : undefined,
        numberOfEpisodes: anime.episodes || undefined,
        aggregateRating: anime.averageScore
          ? {
              "@type": "AggregateRating",
              ratingValue: (anime.averageScore / 10).toFixed(1),
              bestRating: "10",
              reviewCount: "1000+",
            }
          : undefined,
      };
    }
  } catch {
    // Graceful fallback if AniList details fetch fails on server
  }

  return (
    <>
      {schemaData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
        />
      )}
      <AnimeClient id={id} />
    </>
  );
}

