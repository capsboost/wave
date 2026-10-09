"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { ArrowLeft, MessageSquare, Mic, FastForward } from "lucide-react";
import { useAnimeDetails } from "@/hooks/useAnime";
import { type AniListAnime, isSafeAnime } from "@/lib/api/anilist";
import { Grid } from 'ldrs/react';
import 'ldrs/react/Grid.css';
import { useWatchStore } from "@/store/useWatchStore";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import { CommentsSection } from "@/components/comments/CommentsSection";

import { useSearchParams, useRouter } from "next/navigation";

function getDubTooltip(isDubAvailable: boolean, dubCount?: number | null): string {
  if (isDubAvailable) return "Switch to DUB audio";
  if (dubCount && dubCount > 0) return `Dub only available up to Episode ${dubCount}`;
  return "Dub not available for this episode";
}

function calculateBaseWatchEpisodes(anime: AniListAnime | undefined, counts: { is_sub: number | null } | null, epNum: number): number {
  if (!anime || anime.status === 'NOT_YET_RELEASED') return 0;
  if (anime.nextAiringEpisode) {
    return Math.max(0, anime.nextAiringEpisode.episode - 1);
  }
  if (anime.status === 'RELEASING') {
    if (counts?.is_sub) return counts.is_sub;
    if (anime.episodes) return anime.episodes;
    if (anime.startDate?.year && anime.startDate?.month) {
      const start = new Date(anime.startDate.year, anime.startDate.month - 1, anime.startDate.day || 1);
      const elapsedWeeks = Math.floor((Date.now() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
      return Math.max(1, Math.min(elapsedWeeks + 1, 2000));
    }
    return epNum || 12;
  }
  return anime.episodes || counts?.is_sub || 0;
}

function getApplicableWatchEpisodes(
  baseEpisodes: number,
  anime: AniListAnime | undefined,
  counts: { is_sub: number | null, is_dub: number | null } | null,
  effectiveLanguage: "sub" | "dub",
  epNum: number
): number {
  let finalNum = baseEpisodes;
  if (counts) {
    const limit = effectiveLanguage === "dub" ? counts.is_dub : counts.is_sub;
    if (limit !== null && limit !== undefined && limit > 0) {
      if (anime?.nextAiringEpisode) {
        finalNum = Math.min(baseEpisodes, limit);
      } else if (anime?.status === 'FINISHED' && anime.episodes) {
        finalNum = Math.min(anime.episodes, limit);
      } else {
        finalNum = limit;
      }
    } else if (effectiveLanguage === "dub") {
      finalNum = 0;
    }
  }

  if (finalNum === 0 && epNum && anime?.status !== 'NOT_YET_RELEASED') {
    return epNum;
  }
  return finalNum;
}

function useEpisodeCounts(id: string) {
  const [counts, setCounts] = useState<{ is_sub: number | null; is_dub: number | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchCounts() {
      try {
        const res = await fetch(`/api/episodes/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data && (typeof data.is_sub === 'number' || typeof data.is_dub === 'number' || data.is_sub !== undefined)) {
              setCounts({ is_sub: data.is_sub ?? null, is_dub: data.is_dub ?? null });
            }
            setIsLoading(false);
          }
        } else if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch episode counts", err);
        if (isMounted) setIsLoading(false);
      }
    }
    fetchCounts();
    return () => { isMounted = false; };
  }, [id]);

  return { counts, isLoading };
}

function usePlayerEvents(
  id: string,
  provider: "ani" | "mal",
  autoNext: boolean,
  setStreamFailed: (v: boolean) => void,
  updateProgress: (id: string, time: number, duration: number) => void
) {
  const hasTriggeredRef = useRef(false);

  // Reset completion trigger on anime/id change
  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [id]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      let data = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }

      if (!data || typeof data !== "object") return;

      if (data.event === "error") {
        if (provider === "ani") {
          console.log("Stream error on ani provider, silently switching to mal...");
          setStreamFailed(true);
        }
      } else if (data.event === "time" || data.event === "timeupdate" || data.event === "CURRENT_TIME") {
        const time = Number(data.time ?? data.position ?? 0);
        const duration = Number(data.duration ?? 0);
        if (duration > 0 && time > 0) {
          updateProgress(id, time, duration);

          // Failsafe auto-trigger if video reaches the final seconds and has not yet triggered complete
          if (autoNext && !hasTriggeredRef.current && duration > 20 && time >= duration - 1.5) {
            hasTriggeredRef.current = true;
            window.dispatchEvent(new CustomEvent('megaplay-complete'));
          }
        }
      } else if (data.event === "pause" || data.event === "paused" || data.event === "STOP") {
        window.dispatchEvent(new CustomEvent('wave-sync-progress'));
      } else if (data.event === "complete" || data.event === "ended") {
        window.dispatchEvent(new CustomEvent('wave-sync-progress'));
        if (autoNext && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          window.dispatchEvent(new CustomEvent('megaplay-complete'));
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.dispatchEvent(new CustomEvent('wave-sync-progress'));
    };
  }, [provider, id, updateProgress, autoNext, setStreamFailed]);
}

function useAutoNextEpisode(
  id: string,
  episode: string,
  maxAvailableEpisodes: number,
  effectiveLanguage: "sub" | "dub",
  counts: { is_dub: number | null } | null
) {
  const router = useRouter();

  useEffect(() => {
    let triggered = false;

    function handleAutoNext() {
      if (triggered) return;

      const currentEpNum = Number.parseInt(episode, 10);
      const nextEpNum = currentEpNum + 1;

      if (!Number.isNaN(currentEpNum)) {
        // If we have a known upper episode limit, do not advance past the series/season finale
        if (maxAvailableEpisodes > 0 && nextEpNum > maxAvailableEpisodes) {
          return;
        }

        triggered = true;

        let targetLang = effectiveLanguage;
        // If current stream is dub but next episode only has sub available, auto-switch to sub
        if (effectiveLanguage === "dub" && counts?.is_dub !== null && counts?.is_dub !== undefined && counts.is_dub < nextEpNum) {
          targetLang = "sub";
        }
        router.push(`/watch/${id}/${nextEpNum}?lang=${targetLang}`);
      }
    }

    window.addEventListener('megaplay-complete', handleAutoNext);
    return () => window.removeEventListener('megaplay-complete', handleAutoNext);
  }, [episode, maxAvailableEpisodes, effectiveLanguage, counts, id, router]);
}

interface WatchClientProps {
  readonly id: string;
  readonly episode: string;
  readonly initialAnime?: AniListAnime;
}

export default function WatchClient({ id, episode, initialAnime }: WatchClientProps) {
  const searchParams = useSearchParams();
  const initLang = searchParams.get("lang") === "dub" ? "dub" : "sub";

  const { data: anime, isLoading: isAnimeLoading } = useAnimeDetails(id, initialAnime);
  const { counts, isLoading: isCountsLoading } = useEpisodeCounts(id);
  const addToHistory = useWatchStore((state) => state.addToHistory);
  const updateProgress = useWatchStore((state) => state.updateProgress);

  const [language, setLanguage] = useState<"sub" | "dub">(initLang);
  const [autoNext, setAutoNext] = useState(true);
  const [streamFailed, setStreamFailed] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  const hasDistinctAniId = Boolean(anime?.id && anime?.idMal && anime.id !== anime.idMal);
  const provider: "ani" | "mal" = (hasDistinctAniId && !streamFailed) ? "ani" : "mal";

  const epNum = Number.parseInt(episode, 10) || 1;
  const isDubAvailable = counts?.is_dub !== null && counts?.is_dub !== undefined && counts.is_dub >= epNum;
  const effectiveLanguage = (language === "dub" && !isDubAvailable) ? "sub" : language;

  const [selectedChunk, setSelectedChunk] = useState<{ ep: string; chunk: number } | null>(null);
  const activeChunk = (selectedChunk?.ep === episode) 
    ? selectedChunk.chunk 
    : Math.floor(Math.max(0, epNum - 1) / 100);

  const baseEpisodes = calculateBaseWatchEpisodes(anime, counts, epNum);
  const finalNumEpisodes = getApplicableWatchEpisodes(baseEpisodes, anime, counts, effectiveLanguage, epNum);
  const maxAvailableEpisodes = Math.max(baseEpisodes, finalNumEpisodes);

  useEffect(() => {
    if (anime && isSafeAnime(anime)) {
      const maxEps = baseEpisodes > 0 ? baseEpisodes : (anime.episodes || undefined);
      addToHistory({
        mal_id: id,
        title: anime.title.english || anime.title.romaji || "Anime",
        image_url: anime.coverImage.extraLarge || anime.coverImage.large,
        episode,
        max_episodes: maxEps,
        status: anime.status || undefined,
        language: effectiveLanguage,
      });
    }
  }, [anime, baseEpisodes, episode, id, addToHistory, effectiveLanguage]);

  usePlayerEvents(id, provider, autoNext, setStreamFailed, updateProgress);
  useAutoNextEpisode(id, episode, maxAvailableEpisodes, effectiveLanguage, counts);

  if ((isAnimeLoading && !anime) || (!anime && isCountsLoading)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-void-black relative">
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.03)_2px,rgba(255,255,255,0.03)_4px)]" />
        <Grid size="60" speed="1" color="#FF003C" />
        <span className="mt-8 font-label-caps text-cyber-cyan text-xs uppercase tracking-widest animate-pulse">INITIATING STREAM LINK...</span>
      </div>
    );
  }

  if (!anime || !isSafeAnime(anime)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-void-black text-on-surface">
        <h1 className="font-headline-xl text-headline-xl">Anime not found</h1>
      </div>
    );
  }

  const titleStr = anime.title.english || anime.title.romaji;
  
  const baseId = provider === "ani" ? (anime.id || id) : (anime.idMal || id);
  const iframeSrc = `https://megaplay.buzz/stream/${provider}/${baseId}/${episode}/${effectiveLanguage}?autoPlay=1`;

  const CHUNK_SIZE = 100;
  const numChunks = Math.ceil(finalNumEpisodes / CHUNK_SIZE);
  const startEp = activeChunk * CHUNK_SIZE + 1;
  const endEp = Math.min((activeChunk + 1) * CHUNK_SIZE, finalNumEpisodes);
  const currentEpisodes = Array.from({ length: Math.max(0, endEp - startEp + 1) }, (_, i) => startEp + i);

  return (
    <div className="flex-1 bg-void-black min-h-screen pb-20 pt-18">
      {/* Navigation Bar / Return */}
      <div className="w-full bg-void-black px-margin-mobile md:px-margin-desktop py-2.5 flex items-center gap-4">
        <Link href={`/anime/${id}`} className="text-on-surface-variant hover:text-cyber-cyan transition-colors flex items-center gap-2 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="font-label-caps text-xs uppercase tracking-widest"><span className="text-outline-variant mr-1">[</span>RETURN<span className="text-outline-variant ml-1">]</span></span>
        </Link>
      </div>

      {/* Content Layout */}
      <div className="w-full px-margin-mobile md:px-margin-desktop py-4 grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        
        {/* Left Column: Player, Controls, Episodes, Comments */}
        <div className="lg:col-span-8 flex flex-col gap-stack-lg">
          {/* Video Player Section */}
          <section className="w-full bg-black relative">
            <div ref={playerRef} className="w-full aspect-video bg-surface-container flex items-center justify-center shadow-[0_0_30px_rgba(255,0,60,0.15)] relative">
              {/* Iframe key removes episode so it doesn't unmount on auto-next, allowing fullscreen preservation */}
              <iframe
                key={`${provider}-${effectiveLanguage}`}
                src={iframeSrc}
                allowFullScreen
                allow="autoplay; fullscreen"
                className="w-full h-full border-none absolute inset-0 z-10"
                title={`Watch ${titleStr} Episode ${episode}`}
              />
            </div>
          </section>

          {/* Player Controls Bar */}
          <div className="w-full bg-surface-container-lowest border-b border-surface-variant p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-label-caps text-cyber-cyan uppercase tracking-widest border border-cyber-cyan px-2 py-0.5 text-xs clip-corner bg-cyber-cyan/10">
                  {anime.format || "TV"}
                </span>
                <span className="font-label-caps text-on-surface-variant text-xs">
                  EPISODE {episode}
                </span>
              </div>
              <h1 className="font-headline-xl text-xl sm:text-2xl text-on-surface drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] line-clamp-1">
                {titleStr}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-surface-container px-4 py-2 clip-chip border border-outline-variant/30">
              {/* Sub / Dub Selector */}
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={() => setLanguage("sub")}
                  className={`flex items-center gap-1.5 font-label-caps text-xs px-3 py-1.5 transition-all cursor-pointer clip-chip ${
                    effectiveLanguage === "sub" 
                      ? 'bg-neon-crimson text-void-black font-bold shadow-[0_0_10px_rgba(255,0,60,0.5)]' 
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-glass hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3 h-3" /> SUB
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (isDubAvailable) {
                      setLanguage("dub");
                    }
                  }}
                  disabled={!isDubAvailable}
                  className={`flex items-center gap-1.5 font-label-caps text-xs px-3 py-1.5 transition-all clip-chip ${
                    effectiveLanguage === "dub" 
                      ? 'bg-neon-crimson text-void-black font-bold shadow-[0_0_10px_rgba(255,0,60,0.5)]' 
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-glass hover:text-white'
                  } ${!isDubAvailable ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                  title={getDubTooltip(isDubAvailable, counts?.is_dub)}
                >
                  <Mic className="w-3 h-3" /> DUB
                </button>
              </div>

              <div className="w-px h-6 bg-outline-variant/50 hidden sm:block"></div>
              
              {/* Auto Next */}
              <button 
                type="button"
                onClick={() => setAutoNext(!autoNext)}
                className={`flex items-center gap-2 font-label-caps text-xs px-3 py-1.5 border transition-all cursor-pointer clip-chip ${
                  autoNext 
                    ? 'border-neon-crimson text-neon-crimson bg-neon-crimson/10 shadow-[0_0_10px_rgba(255,0,60,0.2)]' 
                    : 'border-outline-variant text-on-surface-variant hover:text-white hover:border-white'
                }`}
              >
                <FastForward className="w-3.5 h-3.5 shrink-0" /> 
                <span>AUTO NEXT</span>
              </button>

              <div className="w-px h-6 bg-outline-variant/50"></div>
              
              <WatchlistButton animeId={id} className="px-3 py-1.5 bg-transparent border-none hover:bg-surface-glass text-xs cursor-pointer" showText={false} />
            </div>
          </div>

          {/* Episode Selector */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant pb-4 mb-4">
              <h2 className="font-headline-xl text-xl text-on-surface uppercase tracking-widest">EPISODES <span className="text-neon-crimson font-label-caps text-xs align-top">{finalNumEpisodes}</span></h2>
              {anime.nextAiringEpisode && (
                <div className="text-xs font-label-caps text-neon-crimson border border-neon-crimson/30 bg-neon-crimson/5 px-3 py-1.5 clip-chip self-start sm:self-auto flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-neon-crimson animate-pulse shadow-[0_0_8px_rgba(255,0,60,0.8)]"></span>
                  EP {anime.nextAiringEpisode.episode} AIRS ON {new Date(anime.nextAiringEpisode.airingAt * 1000).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase()}
                </div>
              )}
            </div>
            
            {/* Episode Pagination */}
            {numChunks > 1 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {Array.from({ length: numChunks }).map((_, i) => {
                  const s = i * CHUNK_SIZE + 1;
                  const e = Math.min((i + 1) * CHUNK_SIZE, finalNumEpisodes);
                  return (
                    <button
                      type="button"
                      key={`chunk-${s}-${e}`}
                      onClick={() => setSelectedChunk({ ep: episode, chunk: i })}
                      className={`font-label-caps text-xs px-4 py-2 border clip-chip transition-all cursor-pointer ${
                        activeChunk === i 
                          ? 'bg-neon-crimson border-neon-crimson text-void-black font-bold shadow-[0_0_10px_rgba(255,0,60,0.5)]' 
                          : 'bg-surface-container border-outline-variant text-on-surface-variant hover:border-cyber-cyan hover:text-cyber-cyan hover:bg-cyber-cyan/10'
                      }`}
                    >
                      EP {s} - {e}
                    </button>
                  );
                })}
              </div>
            )}
            
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2 max-h-100 overflow-y-auto pr-2 custom-scrollbar">
              {currentEpisodes.length > 0 ? (
                currentEpisodes.map((epNum) => {
                  const isCurrent = epNum.toString() === episode;
                  
                  // Predictively switch to sub for next episodes if dub isn't out yet
                  const targetLang = (effectiveLanguage === "dub" && counts && (counts.is_dub === null || counts.is_dub === 0 || epNum > counts.is_dub)) ? "sub" : effectiveLanguage;
                  
                  return (
                    <Link key={epNum} href={`/watch/${id}/${epNum}?lang=${targetLang}`}>
                      <div className={`flex items-center justify-center p-3 font-headline-lg transition-colors clip-chip text-center cursor-pointer border ${
                        isCurrent 
                        ? 'bg-neon-crimson text-void-black border-neon-crimson shadow-[0_0_10px_rgba(255,0,60,0.5)] font-bold' 
                        : 'bg-surface-container hover:bg-neon-crimson hover:text-void-black text-on-surface border-outline-variant hover:border-neon-crimson hover:shadow-[0_0_10px_rgba(255,0,60,0.5)]'
                      }`}>
                        {epNum}
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="col-span-full text-on-surface-variant py-8">No episodes found.</div>
              )}
            </div>
          </div>

          <CommentsSection animeId={id} episodeNumber={episode} />
        </div>

        {/* Right Column: Anime Info & Recommendations */}
        <div className="lg:col-span-4 flex flex-col gap-stack-lg">
          {/* Anime Info Context */}
          <div className="bg-surface-container/50 border border-outline-variant/30 clip-corner relative overflow-hidden group">
            {/* Faded Banner Background */}
            {(anime.bannerImage || anime.coverImage?.extraLarge) && (
              <div className="absolute inset-0 z-0">
                <Image 
                  src={anime.bannerImage || anime.coverImage?.extraLarge || ""}
                  alt="Banner"
                  fill
                  className="object-cover opacity-10 md:opacity-20 mix-blend-screen"
                />
                <div className="absolute inset-0 bg-linear-to-r from-void-black via-void-black/80 to-transparent" />
                <div className="absolute inset-0 bg-linear-to-t from-void-black via-transparent to-transparent" />
              </div>
            )}
            
            <div className="p-5 flex flex-col gap-4 relative z-10">
              <div className="flex gap-4 items-start">
                <div className="relative w-24 h-36 shrink-0 border border-outline-variant/30 shadow-[0_0_15px_rgba(255,0,60,0.2)]">
                  <Image 
                    src={anime.coverImage?.extraLarge || anime.coverImage?.large}
                    alt={titleStr || ""}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col flex-1 min-w-0 justify-center">
                  <h2 className="font-headline-xl text-lg text-on-surface mb-1.5 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] line-clamp-2">{titleStr}</h2>
                  <div className="flex items-center gap-2 mb-2 text-xs">
                    <span className="text-cyber-cyan font-bold font-headline-lg">{anime.averageScore ? `${(anime.averageScore / 10).toFixed(1)}/10` : "N/A"}</span>
                    <span className="text-on-surface-variant font-label-caps">&bull;</span>
                    <span className="text-on-surface-variant font-label-caps uppercase">{anime.seasonYear || 'N/A'}</span>
                    <span className="text-on-surface-variant font-label-caps">&bull;</span>
                    <span className="text-on-surface-variant font-label-caps uppercase">{anime.status?.replace('_', ' ')}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {anime.genres?.slice(0, 4).map(g => (
                      <span key={g} className="text-[11px] font-label-caps px-1.5 py-0.5 border border-outline-variant/30 text-on-surface-variant">{g}</span>
                    ))}
                  </div>
                </div>
              </div>
              <p 
                className="text-on-surface-variant/80 text-xs sm:text-sm leading-relaxed line-clamp-4"
                dangerouslySetInnerHTML={{ __html: anime.description || 'No description available.' }}
              />
            </div>
          </div>

          {/* More Like This Recommendations */}
          <div className="flex flex-col gap-stack-lg">
            <div className="flex items-center justify-between border-b border-outline-variant pb-4">
              <h2 className="font-headline-xl text-xl text-on-surface tracking-wider">MORE LIKE THIS</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {anime.recommendations?.slice(0, 8).map((rec) => (
                <Link key={rec.idMal || ""} href={`/anime/${rec.idMal || ""}`} className="relative aspect-3/4 bg-surface-container overflow-hidden group border border-outline-variant/30 hover:border-cyber-cyan transition-all block clip-corner">
                  <Image 
                    src={rec.coverImage?.extraLarge || rec.coverImage?.large || ""} 
                    alt={rec.title?.english || rec.title?.romaji || ""} 
                    fill 
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
                    className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 z-0"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-void-black via-void-black/20 to-transparent z-0" />
                  <div className="absolute top-2 right-2 bg-void-black/80 text-neon-crimson font-label-caps text-xs px-2 py-1 border border-neon-crimson/50 clip-chip z-10">
                    {rec.averageScore ? (rec.averageScore / 10).toFixed(1) : "N/A"}
                  </div>
                  <div className="absolute bottom-0 left-0 w-full p-3 z-10">
                    <h3 className="font-headline-md text-sm text-white leading-tight line-clamp-2 group-hover:text-cyber-cyan transition-colors">
                      {rec.title?.english || rec.title?.romaji}
                    </h3>
                    <span className="font-label-caps text-xs text-on-surface-variant mt-1 inline-block">
                      {rec.format || 'TV'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
