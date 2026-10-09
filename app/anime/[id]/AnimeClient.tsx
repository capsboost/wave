"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useMemo, useRef } from "react";
import { Play, Star, MessageSquare, Mic } from "lucide-react";
import { useAnimeDetails } from "@/hooks/useAnime";
import { type AniListAnime, isSafeAnime } from "@/lib/api/anilist";
import { Grid } from 'ldrs/react';
import 'ldrs/react/Grid.css';
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import { useWatchStore, getAnimeResumeInfo } from "@/store/useWatchStore";
import { useMounted } from "@/hooks/useMounted";

function calculateBaseEpisodes(anime: AniListAnime, isSubCount?: number | null): number {
  if (anime.status === 'NOT_YET_RELEASED') return 0;
  if (anime.nextAiringEpisode) {
    return Math.max(0, anime.nextAiringEpisode.episode - 1);
  }
  if (anime.status === 'RELEASING') {
    if (isSubCount) return isSubCount;
    if (anime.episodes) return anime.episodes;
    if (anime.startDate?.year && anime.startDate?.month) {
      const start = new Date(anime.startDate.year, anime.startDate.month - 1, anime.startDate.day || 1);
      const elapsedWeeks = Math.floor((Date.now() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
      return Math.max(1, Math.min(elapsedWeeks + 1, 2000));
    }
    return 12;
  }
  return anime.episodes || isSubCount || 0;
}

function getApplicableEpisodes(
  baseEpisodes: number,
  anime: AniListAnime,
  counts: { is_sub: number | null, is_dub: number | null } | null,
  language: "sub" | "dub"
): number {
  if (!counts) return baseEpisodes;
  const limit = language === "dub" ? counts.is_dub : counts.is_sub;
  if (limit !== null && limit !== undefined && limit > 0) {
    if (anime.nextAiringEpisode) return Math.min(baseEpisodes, limit);
    if (anime.status === 'FINISHED' && anime.episodes) return Math.min(anime.episodes, limit);
    return limit;
  }
  return language === "dub" ? 0 : baseEpisodes;
}

function getCleanDescription(description?: string | null): string {
  if (!description) return 'No description available.';
  const sourceIndex = description.search(/(\(|<i>)?Source:/i);
  if (sourceIndex === -1) return description;
  return description.slice(0, sourceIndex).replace(/<br\s*\/?>\s*$/i, '');
}

interface AnimeClientProps {
  readonly id: string;
  readonly initialAnime?: AniListAnime;
}

export default function AnimeClient({ id, initialAnime }: AnimeClientProps) {
  const { data: anime, isLoading: isAnimeLoading } = useAnimeDetails(id, initialAnime);
  const [episodeChunk, setEpisodeChunk] = useState(0);
  const [language, setLanguage] = useState<"sub" | "dub">("sub");
  const [counts, setCounts] = useState<{ is_sub: number | null, is_dub: number | null } | null>(null);
  const mounted = useMounted();
  const bannerRef = useRef<HTMLDivElement>(null);

  // 60/120fps Velvet LERP scroll parallax on GPU via CSS variables (Zero React Re-renders)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return;

    let targetY = 0;
    let currentY = 0;
    let animationFrameId: number;
    let isRunning = false;

    const render = () => {
      currentY += (targetY - currentY) * 0.12;

      if (bannerRef.current) {
        const parallaxY = currentY * 0.35;
        const opacity = Math.max(0.4 - currentY / 1200, 0.1);

        bannerRef.current.style.setProperty("--banner-y", `${parallaxY.toFixed(2)}px`);
        bannerRef.current.style.setProperty("--banner-opacity", `${opacity.toFixed(3)}`);
      }

      if (Math.abs(targetY - currentY) > 0.05) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        isRunning = false;
      }
    };

    const handleScroll = () => {
      const y = window.scrollY;
      if (y < 900) {
        targetY = y;
        if (!isRunning) {
          isRunning = true;
          animationFrameId = requestAnimationFrame(render);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const watchHistoryItem = useWatchStore((state) => state.history[String(id)]);

  // Fetch Anikoto Sub/Dub counts with cleanup signal
  useEffect(() => {
    const controller = new AbortController();
    async function fetchCounts() {
      try {
        const res = await fetch(`/api/episodes/${id}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data && (typeof data.is_sub === 'number' || typeof data.is_dub === 'number' || data.is_sub !== undefined)) {
            setCounts({ is_sub: data.is_sub ?? null, is_dub: data.is_dub ?? null });
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          console.error("Failed to fetch episode counts", err);
        }
      }
    }
    if (anime) fetchCounts();
    return () => controller.abort();
  }, [anime, id]);

  const baseEpisodes = useMemo(
    () => (anime ? calculateBaseEpisodes(anime, counts?.is_sub) : 0),
    [anime, counts?.is_sub]
  );
  const numEpisodes = useMemo(
    () => (anime ? getApplicableEpisodes(baseEpisodes, anime, counts, language) : 0),
    [baseEpisodes, anime, counts, language]
  );
  const episodeArray = useMemo(
    () => Array.from({ length: numEpisodes }, (_, i) => i + 1),
    [numEpisodes]
  );

  const resumeInfo = mounted ? getAnimeResumeInfo(watchHistoryItem, numEpisodes) : null;
  const targetEpisode = resumeInfo?.hasProgress ? resumeInfo.episode : 1;
  const effectiveResumeLang = (resumeInfo?.hasProgress ? resumeInfo.language : language) || "sub";
  const finalResumeLang = (effectiveResumeLang === "dub" && counts && counts.is_dub !== null && targetEpisode > counts.is_dub) ? "sub" : effectiveResumeLang;
  
  const CHUNK_SIZE = 100;
  const numChunks = Math.ceil(episodeArray.length / CHUNK_SIZE);
  const currentEpisodes = useMemo(
    () => episodeArray.slice(episodeChunk * CHUNK_SIZE, (episodeChunk + 1) * CHUNK_SIZE),
    [episodeArray, episodeChunk]
  );
  const cleanDescription = useMemo(
    () => (anime ? getCleanDescription(anime.description) : ''),
    [anime]
  );

  if (isAnimeLoading && !anime) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-void-black">
        <Grid size="60" speed="1" color="#FF003C" />
      </div>
    );
  }

  if (!anime || !isSafeAnime(anime)) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-void-black text-on-surface">
        <h1 className="font-headline-xl text-headline-xl">Anime not found</h1>
      </div>
    );
  }

  return (
    <>
      <div ref={bannerRef} className="relative w-full h-100 md:h-125 lg:h-150 mt-18 overflow-hidden">
        <div className="absolute inset-0 bg-void-black z-0" />
        <div 
          className="absolute inset-0 z-0 mix-blend-screen will-change-transform scale-110 pointer-events-none"
          style={{
            transform: "translate3d(0, var(--banner-y, 0px), 0)",
            opacity: "var(--banner-opacity, 0.4)",
          }}
        >
          <Image 
            src={anime.bannerImage || anime.coverImage.extraLarge} 
            alt={anime.title.english || anime.title.romaji || ""} 
            fill 
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
        <div className="absolute inset-0 bg-linear-to-t from-void-black via-void-black/80 to-transparent z-10 pointer-events-none" />
        
        <div className="absolute bottom-0 left-0 w-full z-20 px-margin-mobile md:px-margin-desktop pb-12">
          <div className="flex flex-col md:flex-row items-end md:items-center gap-6">
            <div className="relative w-32 h-48 md:w-48 md:h-72 shrink-0 border-2 border-outline-variant/30 shadow-[0_0_30px_rgba(255,0,60,0.2)] clip-corner bg-surface-container overflow-hidden hidden md:block">
              <Image 
                src={anime.coverImage.extraLarge || anime.coverImage.large} 
                alt={anime.title.english || anime.title.romaji || ""} 
                fill 
                sizes="(max-width: 768px) 128px, 192px"
                className="object-cover"
                priority
              />
            </div>
            
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-label-caps text-cyber-cyan uppercase tracking-widest border border-cyber-cyan px-2 py-0.5 text-xs clip-corner bg-cyber-cyan/10">
                  {anime.format || "TV"}
                </span>
                {anime.seasonYear && (
                  <span className="font-label-caps text-on-surface-variant text-xs">
                    {anime.seasonYear}
                  </span>
                )}
                <span className="font-label-caps text-on-surface-variant text-xs uppercase">
                  &bull; {anime.status?.replace('_', ' ')}
                </span>
              </div>
              
              <h1 className="font-headline-xl text-3xl md:text-5xl lg:text-display text-white leading-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                {anime.title.english || anime.title.romaji}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-neon-crimson font-bold font-headline-lg">
                  <Star className="w-5 h-5 fill-neon-crimson text-neon-crimson drop-shadow-[0_0_5px_#FF003C]" />
                  <span>{anime.averageScore ? `${(anime.averageScore / 10).toFixed(1)}/10` : "N/A"}</span>
                </div>
                
                {counts && (
                  <div className="flex items-center gap-3 bg-surface-container px-3 py-1 clip-chip border border-outline-variant/30 font-label-caps text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-on-surface-variant">SUB:</span>
                      <span className="text-white font-bold">{counts.is_sub ?? '?'}</span>
                    </div>
                    <div className="w-px h-3 bg-outline-variant/50"></div>
                    <div className="flex items-center gap-1">
                      <span className="text-on-surface-variant">DUB:</span>
                      <span className="text-white font-bold">{counts.is_dub ?? '?'}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2 mt-4">
                {anime.genres.map((g: string) => (
                  <span key={g} className="font-label-caps text-xs uppercase tracking-wider px-3 py-1 border border-outline-variant/30 text-on-surface-variant clip-chip">
                    {g}
                  </span>
                ))}
              </div>
              
              <div className="flex flex-wrap items-center gap-4 mt-6">
                <Link 
                  href={`/watch/${id}/${targetEpisode}?lang=${finalResumeLang}`}
                  className="flex items-center justify-center gap-2 bg-neon-crimson text-void-black font-label-caps font-bold px-8 py-4 clip-corner hover:bg-white hover:drop-shadow-[0_0_15px_rgba(255,0,60,0.6)] transition-all duration-300 scale-105 active:scale-95 group"
                >
                  <Play className="w-5 h-5 fill-void-black group-hover:scale-110 transition-transform" />
                  {resumeInfo?.hasProgress
                    ? (resumeInfo.isCompleted
                        ? (anime.status === "FINISHED"
                            ? `COMPLETED • REPLAY EP ${resumeInfo.episode}`
                            : `CAUGHT UP (EP ${resumeInfo.episode}) • REPLAY`)
                        : resumeInfo.isNextEpisode 
                        ? `CONTINUE EP ${resumeInfo.episode}` 
                        : `RESUME EP ${resumeInfo.episode}${resumeInfo.percentage > 0 ? ` (${resumeInfo.percentage}%)` : ""}`)
                    : "START WATCHING"}
                </Link>
                {resumeInfo?.hasProgress && (resumeInfo.episode > 1 || resumeInfo.isCompleted) && (
                  <Link
                    href={`/watch/${id}/1?lang=${language === "dub" && counts && counts.is_dub !== null && 1 > counts.is_dub ? "sub" : language}`}
                    className="font-label-caps text-xs text-on-surface-variant hover:text-white border border-outline-variant/50 hover:border-cyber-cyan px-4 py-4 clip-chip transition-colors"
                  >
                    WATCH EP 1
                  </Link>
                )}
                <WatchlistButton animeId={id as string} />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="w-full bg-void-black">
        <section className="px-margin-mobile md:px-margin-desktop py-8 border-b border-outline-variant/20">
          <h2 className="font-headline-xl text-xl text-on-surface tracking-wider">SYNOPSIS</h2>
          <p 
            className="text-on-surface-variant text-base md:text-lg leading-relaxed max-w-4xl"
            dangerouslySetInnerHTML={{ __html: cleanDescription }}
          />
        </section>
        
        {anime.relations && anime.relations.length > 0 && (
          <section className="px-margin-mobile md:px-margin-desktop py-8 border-b border-outline-variant/20">
            <div className="flex items-center justify-between border-b border-outline-variant pb-4 mb-6">
              <h2 className="font-headline-xl text-xl text-on-surface tracking-wider">FRANCHISE</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
              {anime.relations.map((rel) => (
                <Link key={rel.idMal} href={`/anime/${rel.idMal}`} className="flex gap-4 group hover:bg-surface-glass p-3 transition-colors border border-outline-variant/30 hover:border-neon-crimson clip-corner bg-surface-container/30">
                  <div className="relative w-16 h-24 shrink-0 bg-surface-container overflow-hidden clip-corner">
                    <Image 
                      src={rel.coverImage?.large || rel.coverImage?.extraLarge || ""} 
                      alt={rel.title?.english || rel.title?.romaji || ""} 
                      fill 
                      sizes="64px"
                      className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                    />
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden">
                    <span className="text-cyber-cyan font-label-caps text-xs uppercase mb-1 tracking-widest">{rel.relationType.replace('_', ' ')}</span>
                    <h3 className="font-headline-md text-sm text-on-surface line-clamp-2 group-hover:text-neon-crimson transition-colors">
                      {rel.title?.english || rel.title?.romaji}
                    </h3>
                    <span className="text-on-surface-variant font-label-caps text-xs mt-2">
                      {rel.format || 'TV'} &bull; {rel.seasonYear || rel.startDate?.year || 'N/A'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className="px-margin-mobile md:px-margin-desktop py-margin-desktop grid grid-cols-1 lg:grid-cols-12 gap-gutter relative bg-void-black min-h-screen">
        {/* Left Column: Episodes */}
        <div className="lg:col-span-8 flex flex-col gap-stack-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-outline-variant pb-4 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <h2 className="font-headline-xl text-headline-xl text-on-surface">EPISODES <span className="text-neon-crimson font-label-caps text-label-caps text-sm align-top">{numEpisodes}</span></h2>
              {anime.nextAiringEpisode && (
                <div className="text-xs font-label-caps text-neon-crimson border border-neon-crimson/30 bg-neon-crimson/5 px-3 py-1.5 clip-chip self-start flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-neon-crimson animate-pulse shadow-[0_0_8px_rgba(255,0,60,0.8)]"></span>
                  EP {anime.nextAiringEpisode.episode} AIRS ON {new Date(anime.nextAiringEpisode.airingAt * 1000).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-surface-container px-2 py-1 clip-chip border border-outline-variant/30">
              <button 
                type="button"
                onClick={() => setLanguage("sub")}
                className={`flex items-center gap-1.5 font-label-caps text-xs px-3 py-1.5 transition-all cursor-pointer clip-chip ${
                  language === "sub" 
                    ? 'bg-neon-crimson text-void-black font-bold shadow-[0_0_10px_rgba(255,0,60,0.5)]' 
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-glass hover:text-white'
                }`}
              >
                <MessageSquare className="w-3 h-3" /> SUB
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (counts?.is_dub && counts.is_dub > 0) {
                    setLanguage("dub");
                  }
                }}
                disabled={counts !== null && (!counts.is_dub || counts.is_dub <= 0)}
                className={`flex items-center gap-1.5 font-label-caps text-xs px-3 py-1.5 transition-all clip-chip ${
                  language === "dub" 
                    ? 'bg-neon-crimson text-void-black font-bold shadow-[0_0_10px_rgba(255,0,60,0.5)]' 
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-glass hover:text-white'
                } ${counts !== null && (!counts.is_dub || counts.is_dub <= 0) ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                title={counts !== null && (!counts.is_dub || counts.is_dub <= 0) ? "Dub not available for this anime" : "Switch to DUB"}
              >
                <Mic className="w-3 h-3" /> DUB
              </button>
            </div>
          </div>
          
          {/* Episode Pagination */}
          {numChunks > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {Array.from({ length: numChunks }).map((_, i) => {
                const start = i * CHUNK_SIZE + 1;
                const end = Math.min((i + 1) * CHUNK_SIZE, numEpisodes);
                return (
                  <button
                    type="button"
                    key={`chunk-${start}-${end}`}
                    onClick={() => setEpisodeChunk(i)}
                    className={`font-label-caps text-xs px-4 py-2 border clip-chip transition-all ${
                      episodeChunk === i 
                        ? 'bg-neon-crimson border-neon-crimson text-void-black font-bold' 
                        : 'bg-surface-container border-outline-variant text-on-surface-variant hover:border-cyber-cyan hover:text-cyber-cyan'
                    }`}
                  >
                    EP {start} - {end}
                  </button>
                );
              })}
            </div>
          )}
          
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {currentEpisodes.length > 0 ? (
              currentEpisodes.map((epNum) => {
                const targetLang = (language === "dub" && counts && counts.is_dub !== null && epNum > counts.is_dub) ? "sub" : language;
                const isCurrentWatchEp = resumeInfo?.hasProgress && resumeInfo.episode === epNum;

                return (
                  <Link key={epNum} href={`/watch/${id}/${epNum}?lang=${targetLang}`}>
                    <div className={`relative bg-surface-container hover:bg-neon-crimson hover:text-void-black text-on-surface border transition-colors clip-chip text-center cursor-pointer flex items-center justify-center p-3 font-headline-lg ${
                      isCurrentWatchEp 
                        ? 'border-cyber-cyan text-cyber-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)] bg-cyber-cyan/10 font-bold' 
                        : 'border-outline-variant hover:border-neon-crimson'
                    }`}>
                      {epNum}
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="col-span-full text-on-surface-variant py-8 font-label-caps text-center">No episodes currently available for {language.toUpperCase()}.</div>
            )}
          </div>
        </div>

        {/* Right Column: Recommendations & Franchise */}
        <div className="lg:col-span-4 flex flex-col gap-stack-lg mt-12 lg:mt-0">

          <div className="flex items-center justify-between border-b border-outline-variant pb-4">
            <h2 className="font-headline-xl text-xl text-on-surface tracking-wider">MORE LIKE THIS</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {anime.recommendations?.slice(0, 6).map((rec) => (
              <div key={rec.idMal || ""} className="perspective-[1000px]">
                <Link href={`/anime/${rec.idMal || ""}`} className="relative aspect-3/4 bg-surface-container overflow-hidden group border border-outline-variant/30 hover:border-cyber-cyan transition-all duration-300 block clip-corner transform hover:rotate-x-[4deg] hover:rotate-y-[-4deg] hover:shadow-[0_20px_40px_rgba(0,240,255,0.15)]">
                  <Image 
                    src={rec.coverImage?.extraLarge || ""} 
                    alt={rec.title?.english || rec.title?.romaji || ""} 
                    fill 
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 z-0"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-void-black via-void-black/20 to-transparent z-0" />
                  <div className="absolute top-2 right-2 bg-void-black/80 text-neon-crimson font-label-caps text-xs px-2 py-1 border border-neon-crimson/50 clip-chip z-10">
                    {rec.averageScore ? (rec.averageScore / 10).toFixed(1) : "N/A"}
                  </div>
                  <div className="absolute bottom-0 left-0 w-full p-3 z-10">
                    <h3 className="font-headline-md text-sm text-white leading-tight line-clamp-2 group-hover:text-cyber-cyan transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {rec.title?.english || rec.title?.romaji}
                    </h3>
                    <span className="font-label-caps text-xs text-on-surface-variant mt-1 inline-block">
                      {rec.format || 'TV'}
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
