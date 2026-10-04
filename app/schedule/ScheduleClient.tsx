"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { CalendarClock } from "lucide-react";
import type { AniListAnime } from "@/lib/api/anilist";

interface ScheduleClientProps {
  initialSchedule: AniListAnime[];
}

export default function ScheduleClient({ initialSchedule: scheduleAnime }: ScheduleClientProps) {

  const formatAiringDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000); // Update every minute to keep countdowns and groups live
    return () => clearInterval(interval);
  }, []);

  const getDayInfo = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const today = new Date(now);
    
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    
    const diffDays = Math.round((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: "Airing now", order: -1 };
    if (diffDays === 0) return { label: "Today", order: 0 };
    if (diffDays === 1) return { label: "Tomorrow", order: 1 };
    
    if (diffDays < 7) {
      return { label: date.toLocaleDateString(undefined, { weekday: 'long' }), order: diffDays };
    }
    
    return { label: `In ${diffDays} days`, order: diffDays };
  };

  const getCountdown = (timestamp: number) => {
    const diff = (timestamp * 1000) - now;
    if (diff < 0) return "Airing now";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) return `In ${minutes}m`;
    if (hours < 24) return `In ${hours}h ${minutes}m`;
    
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `In ${days}d ${remainingHours}h`;
  };

  const getThemeProps = (order: number) => {
    if (order <= 0) return {
      border: "border-neon-crimson",
      hoverBorder: "hover:border-neon-crimson",
      textHover: "group-hover:text-neon-crimson",
      chipBg: "bg-neon-crimson/20",
      chipText: "text-neon-crimson",
      chipBorder: "border-neon-crimson/30",
    };
    if (order === 1) return {
      border: "border-cyber-cyan",
      hoverBorder: "hover:border-cyber-cyan",
      textHover: "group-hover:text-cyber-cyan",
      chipBg: "bg-cyber-cyan/20",
      chipText: "text-cyber-cyan",
      chipBorder: "border-cyber-cyan/30",
    };
    if (order === 2) return {
      border: "border-data-purple",
      hoverBorder: "hover:border-data-purple",
      textHover: "group-hover:text-data-purple",
      chipBg: "bg-data-purple/20",
      chipText: "text-data-purple",
      chipBorder: "border-data-purple/30",
    };
    return {
      border: "border-outline-variant",
      hoverBorder: "hover:border-on-surface",
      textHover: "group-hover:text-on-surface",
      chipBg: "bg-surface-container-high",
      chipText: "text-on-surface-variant",
      chipBorder: "border-outline-variant",
    };
  };

  const getGroupedSchedule = () => {
    if (!scheduleAnime) return [];
    
    const groupsMap = new Map<number, { order: number, label: string, items: typeof scheduleAnime }>();
    const unknownItems: typeof scheduleAnime = [];

    scheduleAnime.forEach(anime => {
      if (anime.nextAiringEpisode) {
        const info = getDayInfo(anime.nextAiringEpisode.airingAt);
        if (!groupsMap.has(info.order)) {
          groupsMap.set(info.order, { order: info.order, label: info.label, items: [] });
        }
        groupsMap.get(info.order)!.items.push(anime);
      } else {
        unknownItems.push(anime);
      }
    });

    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.order - b.order);

    if (unknownItems.length > 0) {
      sortedGroups.push({ order: 999, label: "Currently Airing", items: unknownItems });
    }

    return sortedGroups;
  };

  const groupedSchedule = getGroupedSchedule();

  let content;
  if (!scheduleAnime || scheduleAnime.length === 0) {
    content = (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <div className="text-6xl mb-4">👾</div>
        <h2 className="font-headline-xl text-on-surface-variant text-xl">NO DATA FOUND</h2>
      </div>
    );
  } else {
    content = (
      <div className="space-y-12">
        {groupedSchedule.map((group) => {
          const theme = getThemeProps(group.order);
          return (
            <div key={group.label}>
              <h2 className={`font-headline-lg text-xl text-on-surface border-l-4 pl-3 mb-6 uppercase ${theme.border}`}>
                {group.label}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
                {group.items.map((anime, idx) => (
                  <Link key={`sched-${group.label}-${anime.idMal || anime.id}-${idx}`} href={`/anime/${anime.idMal}`} className={`relative flex flex-row gap-4 bg-surface-container p-3 overflow-hidden group border border-outline-variant/20 transition-all duration-300 clip-corner ${theme.hoverBorder}`}>
                    <div className="relative w-20 md:w-24 aspect-3/4 shrink-0 bg-void-black">
                      <Image 
                        src={anime.coverImage.large || anime.coverImage.extraLarge} 
                        alt={anime.title.english || anime.title.romaji || ""} 
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="flex-1 flex flex-col min-w-0 py-1">
                      <h3 className={`font-headline-md text-[14px] md:text-base text-white leading-tight line-clamp-2 transition-colors mb-2 ${theme.textHover}`}>
                        {anime.title.english || anime.title.romaji}
                      </h3>
                      
                      {anime.nextAiringEpisode ? (
                        <div className="mt-auto">
                          <span className={`inline-block border px-2 py-1 font-label-caps text-[10px] mb-1 clip-chip ${theme.chipBg} ${theme.chipText} ${theme.chipBorder}`}>
                            EP {anime.nextAiringEpisode.episode}
                          </span>
                          <p className="text-on-surface-variant text-xs font-label-caps">
                            {getCountdown(anime.nextAiringEpisode.airingAt)}
                          </p>
                          <p className="text-on-surface-variant/60 text-[10px] font-label-caps mt-0.5">
                            {formatAiringDate(anime.nextAiringEpisode.airingAt)}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-auto">
                          <span className="inline-block bg-surface-container-high text-on-surface-variant border border-outline-variant px-2 py-1 font-label-caps text-[10px] clip-chip">
                            Airing
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen pt-30 px-margin-mobile md:px-margin-desktop bg-void-black pb-12">
      <div className="mb-stack-lg border-b border-outline-variant/20 pb-4">
        <h1 className="flex items-center gap-3 font-headline-xl text-3xl text-on-surface">
          <CalendarClock className="w-8 h-8 text-cyber-cyan" />
          Airing <span className="text-cyber-cyan">Schedule</span>
        </h1>
        <p className="text-on-surface-variant mt-2 font-label-caps text-sm">
          Currently Releasing Anime
        </p>
      </div>

      {content}
    </div>
  );
}
