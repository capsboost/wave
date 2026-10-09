"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AniListAnime } from "@/lib/api/anilist";

interface HeroCarouselProps {
  animeList: AniListAnime[];
}

export function HeroCarousel({ animeList }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

  const slideDuration = 6000;
  const swipeThreshold = 50;

  // Auto-slide logic
  React.useEffect(() => {
    if (!animeList || animeList.length === 0) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % animeList.length);
    }, slideDuration);
    return () => clearInterval(interval);
  }, [animeList]);

  // Touch handlers for lightweight swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > swipeThreshold) {
      // Swiped left, go next
      setActiveIndex((prev) => (prev + 1) % animeList.length);
    } else if (distance < -swipeThreshold) {
      // Swiped right, go prev
      setActiveIndex((prev) => (prev === 0 ? animeList.length - 1 : prev - 1));
    }
  };

  const scrollPrev = () => {
    setActiveIndex((prev) => (prev === 0 ? animeList.length - 1 : prev - 1));
  };

  const scrollNext = () => {
    setActiveIndex((prev) => (prev + 1) % animeList.length);
  };

  if (!animeList || animeList.length === 0) return null;

  return (
    <div 
      className="relative w-full h-179 min-h-125 overflow-hidden group bg-void-black"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Absolute Layers for Crossfade */}
      {animeList.map((anime, index) => {
        const isActive = index === activeIndex;

        return (
          <div
            key={anime.idMal}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            {/* Background Image with Ken Burns */}
            <div className="absolute inset-0 z-0 overflow-hidden bg-void-black">
              <Image
                src={anime.bannerImage || anime.coverImage.extraLarge}
                alt={anime.title.english || anime.title.romaji || "Anime"}
                fill
                className={`object-cover opacity-60 ${isActive ? "animate-ken-burns" : ""}`}
                priority={index === 0}
              />
              <div className="absolute inset-0 bg-linear-to-t from-void-black via-void-black/70 to-transparent z-0" />
              <div className="absolute inset-0 bg-linear-to-r from-void-black via-void-black/50 to-transparent z-0" />
            </div>

            {/* Breathing Glow Effects */}
            <div className="hidden md:block absolute top-1/4 left-1/4 w-96 h-96 bg-neon-crimson/20 rounded-full blur-[120px] z-0 pointer-events-none animate-breathe" />
            <div className="hidden md:block absolute bottom-0 right-1/4 w-125 h-125 bg-cyber-cyan/10 rounded-full blur-[150px] z-0 pointer-events-none animate-breathe" style={{ animationDelay: '2s' }} />

            {/* Content with Sequential Staggers */}
            <div className="relative z-10 px-margin-mobile md:px-margin-desktop w-full max-w-7xl h-full flex flex-col justify-end pb-margin-tablet md:pb-margin-desktop">
              
              <div 
                className={`inline-block bg-surface-glass border border-neon-crimson text-neon-crimson font-label-caps text-label-caps px-3 py-1 mb-stack-md uppercase tracking-widest clip-chip shadow-[0_0_10px_rgba(255,0,60,0.3)] w-max transition-all duration-700 transform ${isActive ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
                style={{ transitionDelay: '100ms' }}
              >
                #{index + 1} Trending
              </div>
              
              <h1 
                className={`font-display-lg text-display-lg-mobile md:text-display-lg text-white mb-stack-md leading-tight text-shadow-glow line-clamp-2 max-w-4xl transition-all duration-700 transform ${isActive ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
                style={{ transitionDelay: '200ms' }}
              >
                {anime.title.english || anime.title.romaji}
              </h1>
              
              <div 
                className={`flex gap-2 text-cyber-cyan font-label-caps text-sm mb-stack-sm drop-shadow-md transition-all duration-700 transform ${isActive ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
                style={{ transitionDelay: '300ms' }}
              >
                {anime.genres.slice(0, 3).map((g) => (
                  <span key={g} className="px-2 py-1 bg-cyber-cyan/10 border border-cyber-cyan/20 clip-corner">
                    {g}
                  </span>
                ))}
              </div>

              {anime.description && (
                <p 
                  className={`font-body-lg text-body-lg text-on-surface-variant max-w-2xl mb-stack-lg drop-shadow-md line-clamp-3 transition-all duration-700 transform ${isActive ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
                  style={{ transitionDelay: '400ms' }}
                >
                  {anime.description
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .replace(/(\(|<i>)?Source:.*$/i, '')
                    .trim()}
                </p>
              )}
              
              <div 
                className={`flex flex-wrap gap-stack-md transition-all duration-700 transform ${isActive ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
                style={{ transitionDelay: '500ms' }}
              >
                {anime.idMal && (
                  <Link href={`/anime/${anime.idMal}`}>
                    <Button className="flex items-center justify-center gap-2 bg-neon-crimson text-void-black font-label-caps font-bold uppercase tracking-widest px-8 py-6 clip-corner hover:bg-white hover:drop-shadow-[0_0_15px_rgba(255,0,60,0.6)] transition-all duration-300 scale-105 active:scale-95 group border-none cursor-pointer">
                      <Play className="w-5 h-5 mr-1 fill-void-black group-hover:scale-110 transition-transform" />
                      WATCH NOW
                    </Button>
                  </Link>
                )}
              </div>

            </div>
          </div>
        );
      })}

      {/* Navigation Controls */}
      <div className="absolute bottom-8 right-margin-desktop flex gap-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" role="region" aria-label="Hero Carousel Navigation">
        <button 
          onClick={scrollPrev}
          aria-label="Previous slide"
          className="relative bg-surface-glass border border-outline-variant hover:border-cyber-cyan text-white hover:text-cyber-cyan rounded-none h-12 w-12 flex items-center justify-center clip-corner transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button 
          onClick={scrollNext}
          aria-label="Next slide"
          className="relative bg-surface-glass border border-outline-variant hover:border-cyber-cyan text-white hover:text-cyber-cyan rounded-none h-12 w-12 flex items-center justify-center clip-corner transition-colors cursor-pointer"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
