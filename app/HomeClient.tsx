"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { useWatchStore, getAnimeResumeInfo } from "@/store/useWatchStore";
import { timeAgo } from "@/lib/timeAgo";
import { useMounted } from "@/hooks/useMounted";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { useRef } from "react";
import type { AniListAnime } from "@/lib/api/anilist";

interface HomeClientProps {
  heroAnimeList: AniListAnime[];
  trendingAnime: AniListAnime[];
  recentEpisodes: AniListAnime[];
  topThisWeek: AniListAnime[];
  scheduleAnime: AniListAnime[];
}

export default function HomeClient({
  heroAnimeList,
  trendingAnime,
  recentEpisodes,
  topThisWeek,
  scheduleAnime
}: HomeClientProps) {
  // Data passed from server component

  // Hydration safe store access
  const history = useWatchStore((state) => state.history);
  const mounted = useMounted();

  const trendingRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = direction === 'left' ? -600 : 600;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const historyItems = Object.values(history).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section via AniList Banners */}
      {heroAnimeList && <HeroCarousel animeList={heroAnimeList} />}

      <div className="flex-1 space-y-12 py-12">
        {/* Continue Watching Section */}
        {mounted && historyItems.length > 0 && (
          <section className="px-margin-mobile md:px-margin-desktop">
            <div className="flex justify-between items-center mb-stack-lg">
              <h2 className="font-headline-xl text-headline-xl text-on-surface uppercase border-l-4 border-cyber-cyan pl-3 flex items-center gap-2">
                Continue Watching
              </h2>
              <Link
                href="/continue-watching"
                className="font-label-caps text-xs text-cyber-cyan hover:text-white border border-cyber-cyan/40 hover:border-cyber-cyan px-3 py-1.5 clip-chip transition-all flex items-center gap-1.5 group cursor-pointer"
              >
                <span>VIEW ALL</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-gutter">
              {historyItems.map((item, idx) => {
                const resume = getAnimeResumeInfo(item, item.max_episodes);
                const targetEp = resume.episode;
                const progressPct = resume.percentage;

                return (
                  <Link key={`history-${item.mal_id}-${idx}`} href={`/watch/${item.mal_id}/${targetEp}?lang=${item.language || "sub"}`} className="relative aspect-video bg-surface-container overflow-hidden group border border-outline-variant/30 hover:border-cyber-cyan transition-all block">
                    <Image 
                      src={item.image_url} 
                      alt={item.title} 
                      fill 
                      className="object-cover opacity-60 group-hover:opacity-100 transition-opacity z-0"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-void-black via-void-black/40 to-transparent z-0" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/20">
                      <div className="bg-neon-crimson/90 clip-corner p-3 drop-shadow-[0_0_10px_rgba(255,0,60,0.8)]">
                        <Play className="text-void-black w-6 h-6 fill-current ml-1" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 p-4 z-10 w-full bg-linear-to-t from-void-black to-transparent">
                      <h3 className="font-headline-md text-headline-sm text-on-surface line-clamp-1 group-hover:text-cyber-cyan transition-colors">
                        {item.title}
                      </h3>
                      <div className="flex items-center justify-between font-label-caps text-label-caps text-on-surface-variant">
                        <span>
                          {resume.isCompleted
                            ? `Episode ${targetEp} • Completed`
                            : resume.isNextEpisode 
                            ? `Episode ${targetEp} • Up Next` 
                            : `Episode ${targetEp}${progressPct > 0 ? ` (${progressPct}%)` : ""}`}
                        </span>
                        {item.timestamp && (
                          <span className="text-[10px] text-outline-variant">
                            {timeAgo(item.timestamp)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Progress Bar */}
                    {resume.isCompleted ? (
                      <div className="absolute bottom-0 left-0 h-1 bg-surface-container-high w-full z-20">
                        <div className="h-full bg-cyber-cyan w-full shadow-[0_0_8px_#00F0FF]" />
                      </div>
                    ) : !resume.isNextEpisode && item.time && item.duration ? (
                      <div className="absolute bottom-0 left-0 h-1 bg-surface-container-high w-full z-20">
                        <div 
                          className="h-full bg-neon-crimson shadow-[0_0_8px_#FF003C]" 
                          style={{ width: `${Math.min((item.time / item.duration) * 100, 100)}%` }} 
                        />
                      </div>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Trending Now Row */}
        <section className="px-margin-mobile md:px-margin-desktop border-b border-outline-variant/10 pb-12 relative group/section">
          <div className="flex justify-between items-end mb-stack-lg">
            <h2 className="font-headline-xl text-headline-xl text-on-surface uppercase border-l-4 border-neon-crimson pl-3">
              Trending Now
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => scroll(trendingRef, 'left')}
                aria-label="Scroll trending anime left"
                className="bg-surface-container border border-outline-variant hover:border-cyber-cyan hover:text-cyber-cyan p-2 text-on-surface-variant transition-colors clip-corner cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => scroll(trendingRef, 'right')}
                aria-label="Scroll trending anime right"
                className="bg-surface-container border border-outline-variant hover:border-cyber-cyan hover:text-cyber-cyan p-2 text-on-surface-variant transition-colors clip-corner cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div ref={trendingRef} className="flex overflow-x-auto gap-gutter pb-4 snap-x snap-mandatory hide-scrollbar scroll-smooth">
            {trendingAnime?.map((anime, idx) => (
              <Link key={`trending-${anime.idMal || anime.id}-${idx}`} href={`/anime/${anime.idMal}`} className="relative shrink-0 w-50 md:w-62.5 aspect-2/3 bg-surface-container rounded-none overflow-hidden group snap-start border border-transparent hover:scale-[1.02] hover:border-neon-crimson hover:shadow-[0_0_20px_rgba(255,0,60,0.4)] transition-all duration-300 block clip-corner">
                <Image 
                  src={anime.coverImage.extraLarge} 
                  alt={anime.title.english || anime.title.romaji || ""} 
                  fill 
                  className="absolute inset-0 object-cover z-0"
                />
                <div className="absolute top-0 left-0 bg-neon-crimson text-white font-label-caps text-sm font-bold px-3 py-1 z-10 clip-chip shadow-[0_0_10px_rgba(255,0,60,0.5)]">
                  #{idx + 1}
                </div>
                <div className="absolute inset-0 bg-linear-to-t from-void-black via-transparent to-transparent opacity-90 group-hover:opacity-100 transition-opacity z-0" />
                <div className="absolute bottom-0 left-0 w-full p-4 bg-linear-to-t from-void-black via-void-black/80 to-transparent pt-12 z-10">
                  <h3 className="font-headline-lg text-[18px] text-white leading-tight mb-1 truncate group-hover:text-neon-crimson transition-colors">
                    {anime.title.english || anime.title.romaji}
                  </h3>
                  <div className="flex gap-2 text-cyber-cyan font-label-caps text-[10px] truncate">
                    {anime.genres.slice(0,2).map((g, i, arr) => (
                      <span key={g}>
                        {g}{i < arr.length - 1 && " • "}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Schedule Section */}
        {scheduleAnime && scheduleAnime.length > 0 && (
          <section className="px-margin-mobile md:px-margin-desktop border-b border-outline-variant/10 pb-12 relative group/section">
            <div className="flex justify-between items-end mb-stack-lg">
              <h2 className="font-headline-xl text-headline-xl text-on-surface uppercase border-l-4 border-data-purple pl-3 flex items-center gap-3">
                <CalendarClock className="text-data-purple w-6 h-6" /> Airing Now
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => scroll(scheduleRef, 'left')}
                  className="bg-surface-container border border-outline-variant hover:border-data-purple hover:text-data-purple p-2 text-on-surface-variant transition-colors clip-corner"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => scroll(scheduleRef, 'right')}
                  className="bg-surface-container border border-outline-variant hover:border-data-purple hover:text-data-purple p-2 text-on-surface-variant transition-colors clip-corner"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div ref={scheduleRef} className="flex overflow-x-auto gap-gutter pb-4 snap-x snap-mandatory hide-scrollbar scroll-smooth">
              {scheduleAnime.map((anime, idx) => (
                <Link key={`schedule-${anime.idMal || anime.id}-${idx}`} href={`/anime/${anime.idMal}`} className="relative shrink-0 w-70 h-24 bg-surface-container-low border border-outline-variant/30 flex items-center p-3 gap-4 group hover:border-data-purple hover:bg-surface-container transition-all snap-start clip-corner">
                  <div className="relative w-16 h-full shrink-0">
                    <Image src={anime.coverImage.large} alt={anime.title.english || anime.title.romaji || ""} fill className="object-cover" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="font-headline-lg text-[16px] text-white leading-tight truncate group-hover:text-cyber-cyan transition-colors">
                      {anime.title.english || anime.title.romaji}
                    </h3>
                    <p className="text-on-surface-variant font-label-caps text-xs mt-1 truncate">
                      {anime.nextAiringEpisode ? `EPISODE ${anime.nextAiringEpisode.episode} AIRING SOON` : 'SIMULCAST'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Top Anime This Week (Expanded Bento Style) */}
        <section className="px-margin-mobile md:px-margin-desktop bg-surface-container-lowest/50">
          {topThisWeek && topThisWeek.length > 0 && (
            <>
              <h2 className="font-headline-xl text-headline-xl text-on-surface uppercase border-l-4 border-cyber-cyan pl-3 mb-stack-lg">
                Top Anime This Week
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-gutter">
                {/* Large Feature Item (Takes up 2x2) */}
                <Link href={`/anime/${topThisWeek[0].idMal}`} className="md:col-span-2 md:row-span-2 relative aspect-square md:aspect-auto bg-surface-container overflow-hidden group border border-outline-variant/20 hover:border-cyber-cyan transition-colors block clip-corner">
                  <Image 
                    src={topThisWeek[0].bannerImage || topThisWeek[0].coverImage.extraLarge} 
                    alt={topThisWeek[0].title.english || topThisWeek[0].title.romaji || ""} 
                    fill 
                    className="absolute inset-0 object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 z-0"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-void-black/90 via-void-black/20 to-transparent z-0" />
                  <div className="absolute bottom-0 left-0 w-full p-8 flex justify-between items-end z-10">
                    <div className="max-w-[80%]">
                      <span className="clip-chip bg-cyber-cyan/20 text-cyber-cyan font-label-caps text-xs px-3 py-1 uppercase border border-cyber-cyan/30 mb-3 inline-block">#1 This Week</span>
                      <h3 className="font-headline-lg text-3xl text-white leading-tight line-clamp-2">
                        {topThisWeek[0].title.english || topThisWeek[0].title.romaji}
                      </h3>
                      {topThisWeek[0].description && (
                        <p 
                          className="font-body-md text-on-surface-variant mt-2 line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: topThisWeek[0].description }}
                        />
                      )}
                    </div>
                    <button className="bg-surface-glass backdrop-blur-md p-4 border border-outline-variant clip-corner text-white hover:text-neon-crimson hover:border-neon-crimson hover:scale-110 transition-all hover:shadow-[0_0_15px_rgba(255,0,60,0.5)]">
                      <Play className="w-8 h-8 fill-current" />
                    </button>
                  </div>
                </Link>
                
                {/* Grid Items */}
                {topThisWeek.slice(1, 9).map((anime, idx) => (
                  <Link key={`top-${anime.idMal || anime.id}-${idx}`} href={`/anime/${anime.idMal}`} className="relative aspect-4/3 bg-surface-container overflow-hidden group border border-outline-variant/20 hover:border-neon-crimson transition-colors block clip-corner">
                    <Image 
                      src={anime.coverImage.extraLarge} 
                      alt={anime.title.english || anime.title.romaji || ""} 
                      fill 
                      className="absolute inset-0 object-cover opacity-60 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500 z-0"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-void-black/90 to-transparent z-0" />
                    <div className="absolute bottom-0 left-0 p-4 z-10">
                      <h3 className="font-headline-lg text-[16px] text-white leading-tight line-clamp-2">
                        {anime.title.english || anime.title.romaji}
                      </h3>
                      <span className="font-label-caps text-[10px] text-neon-crimson mt-1 inline-block">{anime.format || "TV"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Recent Releases (Normal Grid) */}
        <section className="px-margin-mobile md:px-margin-desktop py-4">
          {recentEpisodes && recentEpisodes.length > 0 && (
            <>
              <div className="flex justify-between items-end mb-stack-lg">
                <h2 className="font-headline-xl text-headline-xl text-on-surface uppercase border-l-4 border-cyber-cyan pl-3">
                  Recent Releases
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-gutter">
                {recentEpisodes.map((anime, idx) => (
                  <Link key={`recent-${anime.idMal || anime.id}-${idx}`} href={`/anime/${anime.idMal}`} className="relative aspect-3/4 bg-surface-container rounded-none overflow-hidden group border border-transparent hover:scale-[1.02] hover:border-cyber-cyan transition-all duration-300 block clip-corner">
                    <Image 
                      src={anime.coverImage.extraLarge} 
                      alt={anime.title.english || anime.title.romaji || ""} 
                      fill 
                      className="absolute inset-0 object-cover opacity-80 group-hover:opacity-100 transition-opacity z-0"
                    />
                    <div className="absolute top-2 right-2 bg-void-black/80 text-neon-crimson font-label-caps text-[10px] px-2 py-1 border border-neon-crimson/50 clip-chip z-10">
                      {anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "N/A"}
                    </div>
                    <div className="absolute inset-0 bg-linear-to-t from-void-black via-transparent to-transparent opacity-90 z-0" />
                    <div className="absolute bottom-0 left-0 w-full p-4 z-10">
                      <h3 className="font-headline-lg text-[16px] text-white leading-tight line-clamp-2 group-hover:text-cyber-cyan transition-colors">
                        {anime.title.english || anime.title.romaji}
                      </h3>
                      <span className="font-label-caps text-[10px] text-on-surface-variant mt-1 inline-block">
                        {anime.format || 'TV'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

    </div>
  );
}
