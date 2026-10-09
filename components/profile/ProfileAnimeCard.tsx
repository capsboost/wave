"use client";

import Link from "next/link";
import Image from "next/image";
import { useAnimeDetails } from "@/hooks/useAnime";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";

export function ProfileAnimeCard({ animeId, dateAdded }: { animeId: string, dateAdded: string }) {
  const { data: anime, isLoading } = useAnimeDetails(animeId);

  if (isLoading) {
    return <div className="aspect-3/4 bg-surface-container/50 animate-pulse clip-corner border border-outline-variant/30"></div>;
  }

  if (!anime) return null;

  return (
    <div className="perspective-[1000px]">
      <div className="relative aspect-3/4 bg-surface-container overflow-hidden group border border-outline-variant/30 hover:border-cyber-cyan transition-all duration-300 block clip-corner transform hover:rotate-x-[4deg] hover:rotate-y-[-4deg] hover:shadow-[0_20px_40px_rgba(0,240,255,0.15)]">
        <Link href={`/anime/${animeId}`} className="absolute inset-0 z-0">
          <Image 
            src={anime.coverImage?.extraLarge || anime.coverImage?.large || ""} 
            alt={anime.title?.english || anime.title?.romaji || "Anime"} 
            fill 
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 z-0"
          />
          <div className="absolute inset-0 bg-linear-to-t from-void-black via-void-black/40 to-transparent z-0" />
        </Link>
        
        <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
          <div className="bg-void-black/80 text-neon-crimson font-label-caps text-[10px] px-2 py-1 border border-neon-crimson/50 clip-chip">
            {anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "N/A"}
          </div>
          <WatchlistButton animeId={animeId} initialInList={true} showText={false} className="w-8 h-8 p-0" />
        </div>

        <Link href={`/anime/${animeId}`} className="absolute bottom-0 left-0 w-full p-4 z-10">
          <h3 className="font-headline-lg text-[16px] text-white leading-tight line-clamp-2 group-hover:text-cyber-cyan transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {anime.title?.english || anime.title?.romaji}
          </h3>
          <span className="font-label-caps text-[10px] text-on-surface-variant mt-1 block">
            Added: {new Date(dateAdded).toLocaleDateString()}
          </span>
        </Link>
      </div>
    </div>
  );
}
