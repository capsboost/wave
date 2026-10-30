import type { Metadata } from "next";
import { cache } from "react";
import { anilistApi } from "@/lib/api/anilist";
import { cacheAnimeMetadataIfMissing } from "@/lib/api/cacheMetadata";
import AnimeClient from "./AnimeClient";

export const revalidate = 3600;

const getAnimeDetails = cache((id: string) => anilistApi.getAnimeDetails(id));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const anime = await getAnimeDetails(id);
    if (!anime) return { title: "Anime Not Found" };

    void cacheAnimeMetadataIfMissing(anime);

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
  return <AnimeClient id={id} />;
}
