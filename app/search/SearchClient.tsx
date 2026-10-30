"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { RefreshCw, Search, SearchX, X } from "lucide-react";
import { useExploreAnime } from "@/hooks/useAnime";
import { Grid } from "ldrs/react";
import "ldrs/react/Grid.css";
import { CatalogSkeletonGrid } from "@/components/search/CatalogSkeletonGrid";
import { QuickGenreBar } from "@/components/search/QuickGenreBar";
import { ActiveFilterHud, CatalogFilters } from "@/components/search/ActiveFilterHud";

export default function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Single Source of Truth: URL Search Parameters
  const urlQuery = searchParams.get("q") || "";
  const genre = searchParams.get("genre") || "Any";
  const year = Number(searchParams.get("year")) || 0;
  const format = searchParams.get("format") || "Any";
  const score = Number(searchParams.get("score")) || 0;
  const status = searchParams.get("status") || "Any";
  const sort = searchParams.get("sort") || (urlQuery ? "SEARCH_MATCH" : "TRENDING_DESC");

  // Local state for user typing, synced with urlQuery without cascading effect renders
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  const [searchInput, setSearchInput] = useState(urlQuery);

  if (prevUrlQuery !== urlQuery) {
    setPrevUrlQuery(urlQuery);
    setSearchInput(urlQuery);
  }

  // Stable memoized filters: ONLY creates a new reference when primitive values actually change
  const filters: CatalogFilters = useMemo(
    () => ({
      genre,
      year,
      format,
      score,
      status,
      sort,
    }),
    [genre, year, format, score, status, sort]
  );

  // Helper to push URL updates without feedback loops
  const updateParams = useCallback(
    (updates: Partial<CatalogFilters & { q: string }>) => {
      const current = {
        q: updates.q !== undefined ? updates.q : urlQuery,
        genre: updates.genre !== undefined ? updates.genre : genre,
        year: updates.year !== undefined ? updates.year : year,
        format: updates.format !== undefined ? updates.format : format,
        score: updates.score !== undefined ? updates.score : score,
        status: updates.status !== undefined ? updates.status : status,
        sort: updates.sort !== undefined ? updates.sort : sort,
      };

      const params = new URLSearchParams();
      if (current.q.trim()) params.set("q", current.q.trim());
      if (current.genre && current.genre !== "Any") params.set("genre", current.genre);
      if (current.year > 0) params.set("year", String(current.year));
      if (current.format && current.format !== "Any") params.set("format", current.format);
      if (current.score > 0) params.set("score", String(current.score));
      if (current.status && current.status !== "Any") params.set("status", current.status);

      const defaultSort = current.q.trim() ? "SEARCH_MATCH" : "TRENDING_DESC";
      if (current.sort && current.sort !== defaultSort) {
        params.set("sort", current.sort);
      }

      const queryString = params.toString();
      const targetUrl = queryString ? `/search?${queryString}` : "/search";
      router.replace(targetUrl, { scroll: false });
    },
    [router, urlQuery, genre, year, format, score, status, sort]
  );

  // Debounce search input: ONLY updates URL if value actually differs from current URL query
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === urlQuery.trim()) return;

    const handler = setTimeout(() => {
      updateParams({ q: trimmed });
    }, 350);

    return () => clearTimeout(handler);
  }, [searchInput, urlQuery, updateParams]);

  // Global hotkey: press "/" to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // TanStack Query: Stable memoized query and filter keys prevent loop queries
  const {
    data,
    isLoading,
    isError,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useExploreAnime(urlQuery, filters);

  const results = data?.pages.flatMap((page) => page.media) || [];

  const handleSelectGenre = (newGenre: string) => {
    updateParams({ genre: newGenre });
  };

  const handleRemoveFilter = (key: keyof CatalogFilters) => {
    updateParams({ [key]: key === "year" || key === "score" ? 0 : "Any" });
  };

  const handleClearQuery = () => {
    setSearchInput("");
    updateParams({ q: "" });
  };

  const handleResetAll = () => {
    setSearchInput("");
    router.replace("/search", { scroll: false });
  };

  return (
    <div className="flex-1 min-h-screen pt-30 px-margin-mobile md:px-margin-desktop bg-void-black pb-12">
      {/* Header & Result Counter */}
      <div className="mb-stack-lg border-b border-outline-variant/20 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <h1 className="font-headline-xl text-3xl text-on-surface">
            {urlQuery ? (
              <>
                Search Results for{" "}
                <span className="text-cyber-cyan">&quot;{urlQuery}&quot;</span>
              </>
            ) : (
              <>
                Browse <span className="text-cyber-cyan">Anime Catalog</span>
              </>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-cyber-cyan/80 font-label-caps text-xs tracking-widest px-2.5 py-1 bg-surface-container/60 border border-cyber-cyan/30 clip-chip select-none">
              {isLoading ? "SEARCHING..." : `${results.length} TITLES LOADED`}
            </span>
          </div>
        </div>
      </div>

      {/* In-Page Cyber Search Bar */}
      <div className="relative mb-stack-md">
        <div className="flex items-center relative border border-outline-variant/40 focus-within:border-neon-crimson transition-colors bg-surface-container/50 clip-chip min-h-11">
          <Search className="w-4 h-4 text-cyber-cyan ml-3.5 shrink-0" />
          <input
            ref={searchInputRef}
            id="catalog-search"
            aria-label="Search anime catalog"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search anime catalog by title, character, or studio..."
            className="bg-transparent !outline-none border-none focus:ring-0 focus-visible:!outline-none text-on-surface font-label-caps text-sm w-full py-2.5 px-3 placeholder:text-on-surface-variant/70"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearQuery}
              className="mr-2 p-1.5 text-on-surface-variant hover:text-neon-crimson transition-colors cursor-pointer"
              aria-label="Clear search input"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center mr-3 px-2 py-0.5 text-label-caps text-on-surface-variant/60 bg-surface-container border border-outline-variant/40 clip-chip select-none">
            PRESS [/]
          </span>
        </div>
      </div>

      {/* Quick-Genre Ribbon */}
      <QuickGenreBar selectedGenre={genre} onSelectGenre={handleSelectGenre} />

      {/* Advanced Filter Dropdowns */}
      <div className="flex flex-wrap gap-3 mb-stack-md">
        <select
          aria-label="Filter by year"
          value={year}
          onChange={(e) => updateParams({ year: Number(e.target.value) })}
          className="bg-surface-container text-on-surface border border-outline-variant/40 px-3 py-2.5 font-label-caps text-xs clip-chip outline-none focus:border-neon-crimson hover:border-cyber-cyan transition-colors min-h-11 cursor-pointer"
        >
          <option value={0}>Any Year</option>
          {Array.from({ length: 40 }, (_, i) => new Date().getFullYear() - i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by format"
          value={format}
          onChange={(e) => updateParams({ format: e.target.value })}
          className="bg-surface-container text-on-surface border border-outline-variant/40 px-3 py-2.5 font-label-caps text-xs clip-chip outline-none focus:border-neon-crimson hover:border-cyber-cyan transition-colors min-h-11 cursor-pointer"
        >
          <option value="Any">Any Format</option>
          <option value="TV">TV Series</option>
          <option value="MOVIE">Movie</option>
          <option value="OVA">OVA</option>
          <option value="SPECIAL">Special</option>
        </select>

        <select
          aria-label="Filter by rating"
          value={score}
          onChange={(e) => updateParams({ score: Number(e.target.value) })}
          className="bg-surface-container text-on-surface border border-outline-variant/40 px-3 py-2.5 font-label-caps text-xs clip-chip outline-none focus:border-neon-crimson hover:border-cyber-cyan transition-colors min-h-11 cursor-pointer"
        >
          <option value={0}>Any Rating</option>
          <option value={90}>Masterpiece (90+)</option>
          <option value={80}>Great (80+)</option>
          <option value={70}>Good (70+)</option>
          <option value={60}>Average (60+)</option>
        </select>

        <select
          aria-label="Filter by release status"
          value={status}
          onChange={(e) => updateParams({ status: e.target.value })}
          className="bg-surface-container text-on-surface border border-outline-variant/40 px-3 py-2.5 font-label-caps text-xs clip-chip outline-none focus:border-neon-crimson hover:border-cyber-cyan transition-colors min-h-11 cursor-pointer"
        >
          <option value="Any">Any Status</option>
          <option value="RELEASING">Airing</option>
          <option value="FINISHED">Finished</option>
          <option value="NOT_YET_RELEASED">Upcoming</option>
        </select>

        <select
          aria-label="Sort anime"
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="bg-surface-container text-on-surface border border-outline-variant/40 px-3 py-2.5 font-label-caps text-xs clip-chip outline-none focus:border-neon-crimson hover:border-cyber-cyan transition-colors min-h-11 cursor-pointer md:ml-auto"
        >
          <option value="SEARCH_MATCH">Sort: Best Match</option>
          <option value="TRENDING_DESC">Sort: Trending</option>
          <option value="POPULARITY_DESC">Sort: Most Popular</option>
          <option value="SCORE_DESC">Sort: Highest Rated</option>
          <option value="UPDATED_AT_DESC">Sort: Recently Updated</option>
        </select>
      </div>

      {/* Active Filter HUD */}
      <ActiveFilterHud
        filters={filters}
        query={urlQuery}
        onRemoveFilter={handleRemoveFilter}
        onClearQuery={handleClearQuery}
        onResetAll={handleResetAll}
      />

      {/* Content Rendering: Skeletons vs Empty vs Results Grid */}
      {isLoading ? (
        <CatalogSkeletonGrid count={15} />
      ) : isError && results.length === 0 ? (
        <div role="alert" className="flex flex-col items-center justify-center py-20 text-center bg-surface-container/20 border border-outline-variant/20 clip-corner p-8">
          <SearchX className="w-12 h-12 text-neon-crimson mb-4" aria-hidden="true" />
          <h2 className="font-headline-xl text-on-surface text-xl">SEARCH COULD NOT LOAD</h2>
          <p className="text-on-surface-variant/70 mt-2 font-label-caps text-xs max-w-md">
            The catalog request failed. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-neon-crimson text-void-black font-label-caps text-xs font-bold clip-chip hover:shadow-[0_0_15px_rgba(255,0,60,0.5)] transition-all cursor-pointer min-h-11"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            RETRY SEARCH
          </button>
        </div>
      ) : !results || results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-surface-container/20 border border-outline-variant/20 clip-corner p-8">
          <SearchX className="w-12 h-12 text-cyber-cyan mb-4" aria-hidden="true" />
          <h2 className="font-headline-xl text-on-surface text-xl">NO TELEMETRY FOUND</h2>
          <p className="text-on-surface-variant/70 mt-2 font-label-caps text-xs max-w-md">
            No anime matched your current search parameters. Try clearing filters or searching for another title.
          </p>
          <button
            type="button"
            onClick={handleResetAll}
            className="mt-6 px-6 py-2.5 bg-neon-crimson text-void-black font-label-caps text-xs font-bold clip-chip hover:shadow-[0_0_15px_rgba(255,0,60,0.5)] transition-all cursor-pointer min-h-11"
          >
            RESET ALL FILTERS
          </button>
        </div>
      ) : (
        <div className="flex flex-col">
          {(isError || isFetchNextPageError) && (
            <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-neon-crimson/40 bg-neon-crimson/5 px-4 py-3 text-xs font-label-caps text-on-surface-variant">
              <span>Some results could not be refreshed. Your loaded titles are still available.</span>
              <button
                type="button"
                onClick={() => void refetch()}
                className="inline-flex min-h-11 items-center gap-2 px-3 text-neon-crimson hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                RETRY
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-gutter">
            {results.map((anime, index) => (
              <Link
                key={anime.idMal}
                href={`/anime/${anime.idMal}`}
                className="relative aspect-3/4 bg-surface-container overflow-hidden group border border-outline-variant/30 hover:border-neon-crimson hover:shadow-[0_0_15px_rgba(255,0,60,0.25)] transition-all block clip-corner"
              >
                <Image
                  src={anime.coverImage.extraLarge || anime.coverImage.large}
                  alt={anime.title.english || anime.title.romaji || ""}
                  fill
                  loading={index === 0 ? "eager" : "lazy"}
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                  className="object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 z-0"
                />
                <div className="absolute inset-0 bg-linear-to-t from-void-black via-void-black/20 to-transparent z-0" />

                {/* Score badge */}
                <div className="absolute top-2 right-2 bg-void-black/80 text-neon-crimson font-label-caps text-label-caps px-2 py-0.5 border border-neon-crimson/50 clip-chip z-10 select-none">
                  {anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "N/A"}
                </div>

                {/* Primary genre micro-chip */}
                {anime.genres && anime.genres.length > 0 && (
                  <div className="absolute top-2 left-2 bg-void-black/80 text-cyber-cyan font-label-caps text-label-caps px-1.5 py-0.5 border border-cyber-cyan/40 clip-chip z-10 select-none hidden sm:block">
                    {anime.genres[0].toUpperCase()}
                  </div>
                )}

                {/* Bottom title & metadata */}
                <div className="absolute bottom-0 left-0 w-full p-4 z-10">
                  <h3 className="font-headline-lg text-body-md text-white leading-tight line-clamp-2 group-hover:text-neon-crimson transition-colors">
                    {anime.title.english || anime.title.romaji}
                  </h3>
                  <span className="font-label-caps text-label-caps text-on-surface-variant mt-1 inline-block">
                    {anime.format || "TV"} &bull; {anime.seasonYear || "N/A"}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {hasNextPage && (
            <div className="mt-12 flex justify-center">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="bg-surface-glass border border-neon-crimson text-neon-crimson hover:bg-neon-crimson hover:text-void-black px-12 py-3.5 font-label-caps font-bold transition-all clip-corner shadow-[0_0_15px_rgba(255,0,60,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-11"
              >
                {isFetchingNextPage ? (
                  <span className="flex items-center gap-2">
                    <Grid size="20" speed="1" color="currentColor" /> LOADING...
                  </span>
                ) : (
                  isFetchNextPageError ? "RETRY LOADING MORE" : "LOAD MORE ANIME"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
