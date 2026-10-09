import type { Metadata } from "next";
import { Suspense } from "react";
import { anilistApi, type AniListAnime } from "@/lib/api/anilist";
import { cacheAnimeMetadataIfMissing } from "@/lib/api/cacheMetadata";
import WatchClient from "./WatchClient";

export const revalidate = 3600; // Cache for 1 hour

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; episode: string }>;
}): Promise<Metadata> {
  const { id, episode } = await params;
  try {
    const anime = await anilistApi.getAnimeDetails(id);
    const title = anime?.title?.english || anime?.title?.romaji || "Anime";
    const year = anime?.seasonYear ? ` (${anime.seasonYear})` : "";
    const cover = anime?.bannerImage || anime?.coverImage?.extraLarge || anime?.coverImage?.large || "";

    return {
      title: `Watch ${title} Episode ${episode} English Sub & Dub HD Online Free`,
      description: `Stream ${title}${year} Episode ${episode} online free in 1080p HD with English Subbed & Dubbed audio on Wave Anime. Fast, ad-free alternative to Aniwave, HiAnime, and Animepahe.`,
      keywords: [
        `${title} episode ${episode}`,
        `watch ${title} episode ${episode}`,
        `${title} ep ${episode} english sub`,
        `${title} ep ${episode} english dub`,
        `aniwave ${title} episode ${episode}`,
        `hianime ${title} episode ${episode}`,
      ],
      openGraph: {
        title: `Watch ${title} Episode ${episode} Online Free | Wave Anime`,
        description: `Stream ${title} Episode ${episode} in HD with English subtitles & dubbing on Wave Anime.`,
        images: cover ? [{ url: cover, alt: `${title} Episode ${episode}` }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: `Watch ${title} Episode ${episode} Online Free`,
        description: `Stream ${title} Episode ${episode} in HD with English sub/dub.`,
        images: cover ? [cover] : [],
      },
    };
  } catch {
    return { title: `Watch Anime Episode ${episode} | Wave Anime` };
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; episode: string }>;
}) {
  const { id, episode } = await params;

  let episodeSchema: Record<string, unknown> | null = null;
  let anime: AniListAnime | null = null;
  try {
    anime = await anilistApi.getAnimeDetails(id);
    if (anime) {
      // Dynamically cache new anime metadata to Neon DB for Tier 3/4 fallback (0 writes if already cached)
      cacheAnimeMetadataIfMissing(anime).catch(() => {});

      const title = anime.title.english || anime.title.romaji || "Anime";
      episodeSchema = {
        "@context": "https://schema.org",
        "@type": "TVEpisode",
        name: `${title} Episode ${episode}`,
        episodeNumber: Number(episode) || episode,
        partOfSeries: {
          "@type": "TVSeries",
          name: title,
        },
        image: anime.coverImage?.extraLarge || anime.bannerImage || undefined,
        description: `Watch ${title} Episode ${episode} in high definition with English Sub & Dub on Wave Anime.`,
      };
    }
  } catch {
    // Graceful fallback
  }

  return (
    <>
      {episodeSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(episodeSchema) }}
        />
      )}
      <Suspense fallback={<div className="min-h-screen bg-void-black flex items-center justify-center text-neon-crimson font-mono text-sm tracking-widest uppercase">INITIALIZING FEED...</div>}>
        <WatchClient id={id} episode={episode} initialAnime={anime || undefined} />
      </Suspense>
    </>
  );
}

