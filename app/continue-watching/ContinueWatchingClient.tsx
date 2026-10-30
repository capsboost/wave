"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useState, useMemo, useCallback, useDeferredValue } from "react";
import { 
  Play, 
  Trash2, 
  Clock, 
  Film, 
  Search, 
  ArrowLeft, 
  CheckCircle2, 
  RotateCcw,
  X
} from "lucide-react";
import { useWatchStore, getAnimeResumeInfo, type WatchHistoryItem } from "@/store/useWatchStore";
import { timeAgo } from "@/lib/timeAgo";
import { useMounted } from "@/hooks/useMounted";
import { useSession } from "@/lib/auth-client";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

function formatSeconds(sec?: number): string {
  if (!sec || Number.isNaN(sec) || sec < 0 || !Number.isFinite(sec)) return "0:00";
  const totalSec = Math.floor(sec);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Memoized Card Component for zero unnecessary re-renders
interface ContinueWatchingCardProps {
  item: WatchHistoryItem;
  onRemove: (malId: string | number) => void;
}

const ContinueWatchingCard = React.memo(function ContinueWatchingCard({
  item,
  onRemove,
}: ContinueWatchingCardProps) {
  const resume = getAnimeResumeInfo(item, item.max_episodes);
  const targetEp = resume.episode;
  const progressPct = resume.percentage;
  const watchLink = `/watch/${item.mal_id}/${targetEp}?lang=${item.language || "sub"}`;

  return (
    <div className="bg-surface-container border border-outline-variant/30 hover:border-cyber-cyan/70 clip-corner flex flex-col overflow-hidden group transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] [content-visibility:auto] [contain-intrinsic-size:310px]">
      {/* Card Thumbnail Box (16:9) */}
      <Link href={watchLink} className="relative aspect-video w-full bg-black block overflow-hidden">
        <Image
          src={item.image_url}
          alt={item.title}
          fill
          loading="lazy"
          decoding="async"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
        />
        <div className="absolute inset-0 bg-linear-to-t from-void-black via-void-black/30 to-transparent pointer-events-none" />

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/30 pointer-events-none">
          <div className="w-12 h-12 bg-neon-crimson text-void-black clip-corner flex items-center justify-center shadow-[0_0_20px_rgba(255,0,60,0.8)]">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Top Badges: Sub/Dub & Progress Pct */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
          <span className="font-label-caps text-xs px-2 py-0.5 bg-void-black/90 border border-outline-variant/40 text-cyber-cyan clip-chip uppercase font-bold tracking-wider">
            {item.language || "SUB"}
          </span>
          {progressPct > 0 && !resume.isCompleted && (
            <span className="font-label-caps text-xs px-2 py-0.5 bg-void-black/90 border border-neon-crimson/50 text-neon-crimson clip-chip font-bold">
              {progressPct}%
            </span>
          )}
          {resume.isCompleted && (
            <span className="font-label-caps text-xs px-2 py-0.5 bg-void-black/90 border border-cyber-cyan/50 text-cyber-cyan clip-chip font-bold">
              DONE
            </span>
          )}
        </div>

        {/* Bottom Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-surface-container-high z-20">
          {resume.isCompleted ? (
            <div className="h-full bg-cyber-cyan w-full shadow-[0_0_8px_#00F0FF]" />
          ) : (
            <div
              className="h-full bg-neon-crimson shadow-[0_0_8px_#FF003C]"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          )}
        </div>
      </Link>

      {/* Card Body */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3 bg-surface-container">
        <div>
          <Link
            href={watchLink}
            className="font-headline-md text-base text-white hover:text-cyber-cyan transition-colors line-clamp-1 block mb-1"
            title={item.title}
          >
            {item.title}
          </Link>

          <div className="flex items-center justify-between text-xs font-label-caps text-on-surface-variant">
            <span className="text-white font-medium">
              {resume.isCompleted
                ? `Episode ${targetEp} • Completed`
                : resume.isNextEpisode
                ? `Episode ${targetEp} • Up Next`
                : `Episode ${targetEp}`}
            </span>
            {item.timestamp && (
              <span className="text-outline-variant">
                {timeAgo(item.timestamp)}
              </span>
            )}
          </div>

          {/* Exact Playback Timestamp */}
          {item.time != null && item.duration != null && item.duration > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-label-caps text-on-surface-variant/80 mt-1.5">
              <Clock className="w-3 h-3 text-cyber-cyan shrink-0" />
              <span>
                {formatSeconds(item.time)} / {formatSeconds(item.duration)}
              </span>
            </div>
          )}
        </div>

        {/* Actions: Resume button & Trash button */}
        <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
          <Link
            href={watchLink}
            className="flex-1 min-h-11 px-3 bg-surface-container-high hover:bg-neon-crimson hover:text-void-black transition-all clip-chip text-center font-label-caps text-xs font-bold tracking-wider text-white flex items-center justify-center gap-1.5 group/btn"
          >
            {resume.isCompleted ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 group-hover/btn:rotate-180 transition-transform" />
                <span>REWATCH</span>
              </>
            ) : resume.isNextEpisode ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>PLAY NEXT</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>RESUME</span>
              </>
            )}
          </Link>

          <button
            type="button"
            onClick={() => onRemove(item.mal_id)}
            className="min-w-11 min-h-11 flex items-center justify-center text-on-surface-variant hover:text-neon-crimson hover:bg-neon-crimson/10 transition-colors clip-chip cursor-pointer"
            title="Remove from history"
            aria-label={`Remove ${item.title} from history`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default function ContinueWatchingClient() {
  const mounted = useMounted();
  const { data: session } = useSession();
  const [activeFilter, setActiveFilter] = useState<"all" | "in_progress" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // useDeferredValue ensures input stays at 60fps without lag during heavy filtering
  const deferredSearch = useDeferredValue(searchQuery);

  const history = useWatchStore((state) => state.history);
  const removeFromHistory = useWatchStore((state) => state.removeFromHistory);
  const clearHistory = useWatchStore((state) => state.clearHistory);

  const handleRemove = useCallback(
    async (malId: string | number) => {
      removeFromHistory(malId);
      if (session?.user) {
        try {
          await fetch(`/api/progress/${encodeURIComponent(String(malId))}`, {
            method: "DELETE",
          });
        } catch (e) {
          console.error("Failed to delete progress from DB:", e);
        }
      }
    },
    [removeFromHistory, session?.user]
  );

  const handleClearAll = useCallback(async () => {
    clearHistory();
    setShowClearConfirm(false);
    if (session?.user) {
      try {
        await fetch("/api/progress", { method: "DELETE" });
      } catch (e) {
        console.error("Failed to clear progress from DB:", e);
      }
    }
  }, [clearHistory, session?.user]);

  const allItems: WatchHistoryItem[] = useMemo(() => {
    return Object.values(history).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
  }, [history]);

  const inProgressItems = useMemo(() => {
    return allItems.filter((item) => {
      const resume = getAnimeResumeInfo(item, item.max_episodes);
      return !resume.isCompleted && resume.percentage < 90;
    });
  }, [allItems]);

  const completedItems = useMemo(() => {
    return allItems.filter((item) => {
      const resume = getAnimeResumeInfo(item, item.max_episodes);
      return resume.isCompleted || resume.percentage >= 90;
    });
  }, [allItems]);

  const displayedItems = useMemo(() => {
    const base = activeFilter === "in_progress"
      ? inProgressItems
      : activeFilter === "completed"
      ? completedItems
      : allItems;

    if (!deferredSearch.trim()) return base;
    const q = deferredSearch.toLowerCase().trim();
    return base.filter((item) => item.title.toLowerCase().includes(q));
  }, [activeFilter, inProgressItems, completedItems, allItems, deferredSearch]);

  if (!mounted) {
    return (
      <div className="flex-1 bg-void-black min-h-screen pt-24 pb-20 px-margin-mobile md:px-margin-desktop">
        <div className="animate-pulse">
          <div className="h-10 bg-surface-container w-64 mb-8 clip-chip" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
            {Array.from({ length: 8 }).map((_, i) => (
              <div 
                key={i} 
                className="bg-surface-container border border-outline-variant/20 clip-corner flex flex-col overflow-hidden h-77.5"
              >
                <div className="aspect-video bg-surface-container-high w-full" />
                <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-4 bg-surface-container-high w-3/4 clip-chip" />
                    <div className="h-3 bg-surface-container-high w-1/2 clip-chip" />
                  </div>
                  <div className="h-11 bg-surface-container-high w-full clip-chip mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-void-black min-h-screen pt-24 pb-20 px-margin-mobile md:px-margin-desktop text-on-surface">
      <div className="flex flex-col gap-stack-lg">
        {/* Top Breadcrumb / Return */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-on-surface-variant hover:text-cyber-cyan transition-colors flex items-center gap-2 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-label-caps text-xs uppercase tracking-widest">
              <span className="text-outline-variant mr-1">[</span>RETURN TO HOME<span className="text-outline-variant ml-1">]</span>
            </span>
          </Link>

          {allItems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="text-on-surface-variant hover:text-neon-crimson transition-colors font-label-caps text-xs flex items-center gap-1.5 px-3 py-1.5 border border-outline-variant/30 hover:border-neon-crimson/50 clip-chip cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>CLEAR ALL HISTORY</span>
            </button>
          )}
        </div>

        {/* Header Title Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-outline-variant/30">
          <div>
            <h1 className="font-headline-xl text-3xl md:text-5xl uppercase tracking-wider text-white flex items-center gap-3">
              <span>CONTINUE WATCHING</span>
              <span className="text-xs font-label-caps bg-surface-container px-3 py-1 text-neon-crimson clip-chip border border-neon-crimson/30 tracking-wider">
                {allItems.length}
              </span>
            </h1>
          </div>

          {/* Search Input */}
          {allItems.length > 0 && (
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your history..."
                aria-label="Search watch history"
                autoComplete="off"
                spellCheck="false"
                className="w-full bg-surface-container border border-outline-variant/40 focus:border-neon-crimson outline-none pl-9 pr-8 py-2 font-label-caps text-xs text-white clip-chip placeholder:text-on-surface-variant transition-colors tracking-wider"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search input"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white transition-colors p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live announcer for screen readers */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {displayedItems.length} {displayedItems.length === 1 ? "anime found" : "anime found"}
        </div>

        {/* Filter Navigation Tabs */}
        {allItems.length > 0 && (
          <div 
            role="tablist" 
            aria-label="Filter watch history" 
            className="flex flex-wrap items-center gap-2"
          >
            <button
              id="tab-all"
              role="tab"
              aria-selected={activeFilter === "all"}
              aria-controls="tabpanel-history"
              onClick={() => setActiveFilter("all")}
              className={`font-label-caps text-xs px-4 py-2 clip-chip tracking-wider transition-all cursor-pointer ${
                activeFilter === "all"
                  ? "bg-neon-crimson text-void-black font-bold shadow-[0_0_12px_rgba(255,0,60,0.5)]"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-glass hover:text-white"
              }`}
            >
              ALL ({allItems.length})
            </button>
            <button
              id="tab-in-progress"
              role="tab"
              aria-selected={activeFilter === "in_progress"}
              aria-controls="tabpanel-history"
              onClick={() => setActiveFilter("in_progress")}
              className={`font-label-caps text-xs px-4 py-2 clip-chip tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === "in_progress"
                  ? "bg-cyber-cyan text-void-black font-bold shadow-[0_0_12px_rgba(0,240,255,0.5)]"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-glass hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>IN PROGRESS ({inProgressItems.length})</span>
            </button>
            <button
              id="tab-completed"
              role="tab"
              aria-selected={activeFilter === "completed"}
              aria-controls="tabpanel-history"
              onClick={() => setActiveFilter("completed")}
              className={`font-label-caps text-xs px-4 py-2 clip-chip tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === "completed"
                  ? "bg-white text-void-black font-bold shadow-[0_0_12px_rgba(255,255,255,0.5)]"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-glass hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>COMPLETED ({completedItems.length})</span>
            </button>
          </div>
        )}

        {/* Confirmation Modal for Clear All */}
        <ConfirmModal
          isOpen={showClearConfirm}
          onClose={() => setShowClearConfirm(false)}
          onConfirm={handleClearAll}
          title="Clear All Watch History?"
          description="This will wipe your entire local progress and watch order across all anime. This action cannot be undone."
          confirmText="CONFIRM CLEAR"
          variant="danger"
        />

        {/* Content Section: Cards or Empty State */}
        {displayedItems.length === 0 ? (
          <div className="bg-surface-container/40 border border-outline-variant/30 clip-corner p-12 flex flex-col items-center justify-center text-center gap-4 my-8">
            <div className="w-16 h-16 clip-corner bg-surface-container flex items-center justify-center text-on-surface-variant border border-outline-variant/30">
              <Film className="w-8 h-8 opacity-60" />
            </div>
            <div>
              <h3 className="font-headline-lg text-xl uppercase tracking-wider text-white">
                {searchQuery ? "No Matching Anime Found" : "No Watch History Recorded"}
              </h3>
              <p className="text-sm text-on-surface-variant max-w-md mt-1">
                {searchQuery
                  ? `No items match "${searchQuery}". Try a different search query or clear your search.`
                  : "Episodes you start watching will automatically appear here with real-time playback resume markers."}
              </p>
            </div>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-2 px-6 py-3 bg-surface-container border border-cyber-cyan/50 text-cyber-cyan font-headline-md text-xs uppercase clip-chip font-bold hover:bg-cyber-cyan hover:text-void-black transition-colors"
              >
                CLEAR SEARCH QUERY
              </button>
            ) : (
              <Link
                href="/"
                className="mt-2 px-6 py-3 bg-neon-crimson text-void-black font-headline-md text-xs uppercase clip-chip font-bold hover:bg-white transition-colors shadow-[0_0_15px_rgba(255,0,60,0.4)]"
              >
                EXPLORE ANIME
              </Link>
            )}
          </div>
        ) : (
          <div 
            id="tabpanel-history"
            role="tabpanel"
            aria-labelledby={`tab-${activeFilter}`}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter"
          >
            {displayedItems.map((item) => (
              <ContinueWatchingCard 
                key={item.mal_id} 
                item={item} 
                onRemove={handleRemove} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
