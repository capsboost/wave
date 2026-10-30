"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Search, Bell, Menu, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchAnime } from "@/hooks/useAnime";
import { useAuthModal } from "@/store/useAuthModal";
import { useSession, signOut } from "@/lib/auth-client";
import { Grid } from 'ldrs/react';
import { User as UserIcon } from "lucide-react";
import 'ldrs/react/Grid.css';
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { useNotifications } from "@/hooks/useNotifications";
import { WaveLogo } from "@/components/ui/WaveLogo";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 500);
  const { openModal } = useAuthModal();
  const { data: session, isPending } = useSession();
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: searchResults, isLoading: isSearchLoading } = useSearchAnime(debouncedQuery);
  const { unreadCount } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menus on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isMobileMenuOpen) setIsMobileMenuOpen(false);
      if (isProfileMenuOpen) setIsProfileMenuOpen(false);
      if (isFocused) setIsFocused(false);
      if (isMobileSearchOpen) setIsMobileSearchOpen(false);
      if (isNotificationPanelOpen) setIsNotificationPanelOpen(false);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobileMenuOpen, isProfileMenuOpen, isFocused, isMobileSearchOpen, isNotificationPanelOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      setIsFocused(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-surface-glass backdrop-blur-xl border-b border-neon-crimson/25 shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-2 px-margin-mobile sm:px-6 lg:px-margin-desktop py-2 md:py-3 w-full max-w-full">
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-gutter">
          <Link
            href="/"
            className="flex shrink-0 items-center group whitespace-nowrap"
            aria-label="Wave Anime Home"
          >
            <WaveLogo variant="full" size="md" />
          </Link>
          <div className="hidden min-w-0 flex-1 xl:block">
            <div className="flex items-center gap-3 lg:gap-stack-md font-label-caps text-[10px] lg:text-label-caps uppercase">
            <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              className={`${pathname === "/" ? "text-neon-crimson border-b-2 border-neon-crimson pb-1" : "text-on-surface-variant hover:text-cyber-cyan"} transition-colors duration-200`}
            >
              Home
            </Link>
            <Link
              href="/schedule"
              aria-current={pathname === "/schedule" ? "page" : undefined}
              className={`${pathname === "/schedule" ? "text-neon-crimson border-b-2 border-neon-crimson pb-1" : "text-on-surface-variant hover:text-cyber-cyan"} transition-colors duration-200`}
            >
              Schedule
            </Link>
            <Link
              href="/search"
              aria-current={pathname === "/search" ? "page" : undefined}
              className={`${pathname === "/search" ? "text-neon-crimson border-b-2 border-neon-crimson pb-1" : "text-on-surface-variant hover:text-cyber-cyan"} transition-colors duration-200`}
            >
              Catalog
            </Link>
            <Link
              href="/continue-watching"
              aria-current={pathname === "/continue-watching" ? "page" : undefined}
              className={`${pathname === "/continue-watching" ? "text-neon-crimson border-b-2 border-neon-crimson pb-1" : "text-on-surface-variant hover:text-cyber-cyan"} transition-colors duration-200`}
            >
              Recents
            </Link>
            <a
              href="https://flicmovies.me"
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap text-on-surface-variant hover:text-cyber-cyan transition-colors duration-200"
            >
              Movies & TV Shows
            </a>
            <a
              href="https://sports.flicmovies.me"
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap text-on-surface-variant hover:text-cyber-cyan transition-colors duration-200"
            >
              Sports
            </a>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-stack-md">
          <div ref={wrapperRef} className="relative hidden xl:block">
            <form 
              onSubmit={handleSearch}
              className="flex items-center relative border-b border-outline-variant transition-colors bg-surface-glass w-28 lg:w-40 xl:w-64"
            >
              <Search className="w-4 h-4 text-on-surface-variant ml-2" />
              <input
                aria-label="Search anime"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                placeholder="Search anime..."
                className="bg-transparent !outline-none border-none text-on-surface font-label-caps text-label-caps w-full py-2 px-2 placeholder:text-on-surface-variant"
              />
            </form>
            
            {/* Auto-suggest Dropdown */}
            {isFocused && query.length >= 2 && (
              <div className="absolute top-full mt-2 w-75 right-0 bg-surface-container border border-outline-variant/30 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 flex flex-col clip-corner">
                {isSearchLoading ? (
                  <div className="flex items-center justify-center py-6 text-cyber-cyan">
                    <Grid size="35" speed="1" color="#00F0FF" />
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  <>
                    <div className="py-2 flex flex-col">
                      {searchResults.slice(0, 5).map(anime => (
                        <Link 
                          key={anime.idMal} 
                          href={`/anime/${anime.idMal}`}
                          onClick={() => setIsFocused(false)}
                          className="flex items-center gap-3 p-3 hover:bg-surface-glass transition-colors group border-b border-outline-variant/10 last:border-0"
                        >
                          <div className="relative w-10 h-14 shrink-0 bg-void-black">
                            <Image 
                              src={anime.coverImage.large || anime.coverImage.extraLarge} 
                              alt={anime.title.english || anime.title.romaji || "Anime cover"}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <h4 className="font-headline-lg text-[14px] text-on-surface truncate group-hover:text-neon-crimson transition-colors">
                              {anime.title.english || anime.title.romaji}
                            </h4>
                            <p className="font-label-caps text-[10px] text-on-surface-variant mt-1">
                              {anime.format || 'TV'} • {anime.seasonYear || 'N/A'}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <button 
                      onClick={handleSearch}
                      className="w-full py-3 bg-neon-crimson text-void-black font-label-caps text-[12px] font-bold hover:bg-white transition-colors"
                    >
                      VIEW ALL RESULTS
                    </button>
                  </>
                ) : (
                  <div className="py-6 px-4 text-center font-label-caps text-[12px] text-on-surface-variant">
                    NO RESULTS FOUND
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Mobile Search Toggle */}
          <button 
            type="button"
            aria-label={isMobileSearchOpen ? "Close search" : "Open search"}
            aria-expanded={isMobileSearchOpen}
            aria-controls="mobile-search-panel"
            className="xl:hidden text-on-surface-variant hover:text-cyber-cyan transition-colors p-2 nav-glow"
            onClick={() => {
              setIsMobileSearchOpen(!isMobileSearchOpen);
              setIsMobileMenuOpen(false);
              setIsNotificationPanelOpen(false);
            }}
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Mobile Notification Toggle */}
          <div className="relative xl:hidden">
            <button 
              type="button"
              aria-label={isNotificationPanelOpen ? "Close notifications" : `Open notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={isNotificationPanelOpen}
              onClick={() => {
                setIsNotificationPanelOpen(!isNotificationPanelOpen);
                setIsMobileMenuOpen(false);
                setIsMobileSearchOpen(false);
              }}
              className="text-on-surface-variant hover:text-cyber-cyan transition-colors p-2 nav-glow relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-neon-crimson rounded-full shadow-[0_0_8px_#FF003C]" />
              )}
            </button>
            {isNotificationPanelOpen && (
              <NotificationPanel onClose={() => setIsNotificationPanelOpen(false)} />
            )}
          </div>
          
          {/* Mobile Menu Toggle */}
          <button 
            type="button"
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-menu"
            className={`xl:hidden flex items-center justify-center w-10 h-10 transition-all duration-300 clip-corner ${isMobileMenuOpen ? 'bg-neon-crimson text-void-black shadow-[0_0_15px_rgba(255,0,60,0.5)]' : 'bg-surface-glass border border-outline-variant/30 text-on-surface hover:border-neon-crimson hover:text-neon-crimson'}`}
            onClick={() => {
              setIsMobileMenuOpen(!isMobileMenuOpen);
              setIsMobileSearchOpen(false);
              setIsNotificationPanelOpen(false);
            }}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 animate-in spin-in-90 duration-300" /> : <Menu className="w-5 h-5 animate-in spin-in-[-90deg] duration-300" />}
          </button>

          <div className="relative hidden xl:block">
            <button 
              type="button"
              aria-label={isNotificationPanelOpen ? "Close notifications" : `Open notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={isNotificationPanelOpen}
              onClick={() => {
                setIsNotificationPanelOpen(!isNotificationPanelOpen);
                setIsProfileMenuOpen(false);
              }}
              className="text-on-surface-variant hover:text-cyber-cyan transition-colors p-2 nav-glow relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-neon-crimson rounded-full shadow-[0_0_8px_#FF003C]" />
              )}
            </button>
            {isNotificationPanelOpen && (
              <NotificationPanel onClose={() => setIsNotificationPanelOpen(false)} />
            )}
          </div>
          
          {isPending ? (
            <div className="hidden xl:block w-8 h-8 bg-surface-container animate-pulse clip-chip" />
          ) : session ? (
            <div className="relative hidden xl:block">
              <button 
                type="button"
                aria-label="Open profile menu"
                aria-expanded={isProfileMenuOpen}
                onClick={() => {
                  setIsProfileMenuOpen(!isProfileMenuOpen);
                  setIsNotificationPanelOpen(false);
                }}
                className="w-8 h-8 bg-cyber-cyan text-void-black font-headline-md flex items-center justify-center uppercase clip-chip"
              >
                {session.user.name.charAt(0)}
              </button>
              {isProfileMenuOpen && (
                <div className="absolute top-full right-0 mt-4 w-48 bg-surface-container border border-outline-variant/30 shadow-[0_10px_30px_rgba(0,0,0,0.8)] clip-corner flex flex-col z-50">
                  <div className="px-4 py-3 border-b border-outline-variant/20">
                    <p className="font-headline-md text-sm text-on-surface truncate">{session.user.name}</p>
                    <p className="font-label-caps text-[10px] text-on-surface-variant truncate">{session.user.email}</p>
                  </div>
                  <Link href="/profile" onClick={() => setIsProfileMenuOpen(false)} className="px-4 py-3 text-sm font-label-caps text-on-surface hover:bg-surface-glass transition-colors">Profile & Watchlist</Link>
                  <button onClick={() => { signOut(); setIsProfileMenuOpen(false); }} className="px-4 py-3 text-sm font-label-caps text-neon-crimson hover:bg-neon-crimson/10 transition-colors text-left border-t border-outline-variant/20">Log Out</button>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={() => openModal('login')}
              className="hidden xl:flex items-center gap-2 bg-neon-crimson/10 border border-neon-crimson text-neon-crimson px-4 py-2 font-label-caps text-xs clip-chip hover:bg-neon-crimson hover:text-void-black transition-colors"
            >
              <UserIcon className="w-4 h-4" /> LOG IN
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div id="mobile-navigation-menu" className="xl:hidden absolute top-full left-0 w-full bg-void-black/95 backdrop-blur-2xl border-b border-neon-crimson/50 flex flex-col shadow-[0_20px_40px_rgba(255,0,60,0.15)] z-40 animate-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col p-4 gap-3">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 font-label-caps uppercase clip-chip transition-all ${pathname === "/" ? "text-neon-crimson bg-neon-crimson/10 border-l-2 border-neon-crimson" : "text-on-surface bg-surface-container/40 hover:bg-surface-glass"}`}
            >
              Home
            </Link>
            <Link
              href="/schedule"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 font-label-caps uppercase clip-chip transition-all ${pathname === "/schedule" ? "text-neon-crimson bg-neon-crimson/10 border-l-2 border-neon-crimson" : "text-on-surface bg-surface-container/40 hover:bg-surface-glass"}`}
            >
              Schedule
            </Link>
            <Link
              href="/search"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 font-label-caps uppercase clip-chip transition-all ${pathname === "/search" ? "text-neon-crimson bg-neon-crimson/10 border-l-2 border-neon-crimson" : "text-on-surface bg-surface-container/40 hover:bg-surface-glass"}`}
            >
              Catalog
            </Link>
            <Link
              href="/continue-watching"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 font-label-caps uppercase clip-chip transition-all ${pathname === "/continue-watching" ? "text-neon-crimson bg-neon-crimson/10 border-l-2 border-neon-crimson" : "text-on-surface bg-surface-container/40 hover:bg-surface-glass"}`}
            >
              Recents
            </Link>
            <a
              href="https://flicmovies.me"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-4 py-3 font-label-caps uppercase clip-chip text-on-surface bg-surface-container/40 hover:bg-surface-glass transition-all"
            >
              Movies & TV Shows
            </a>
            <a
              href="https://sports.flicmovies.me"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-4 py-3 font-label-caps uppercase clip-chip text-on-surface bg-surface-container/40 hover:bg-surface-glass transition-all"
            >
              Sports
            </a>
          </div>
          
          {/* Mobile Auth */}
          <div className="mt-auto border-t border-neon-crimson/30 p-margin-mobile">
            {isPending ? (
              <div className="w-full h-10 bg-surface-container animate-pulse clip-chip" />
            ) : session ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-cyber-cyan text-void-black font-headline-md flex items-center justify-center uppercase clip-chip">
                    {session.user.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-headline-md text-sm text-on-surface truncate">{session.user.name}</p>
                    <p className="font-label-caps text-[10px] text-on-surface-variant truncate">{session.user.email}</p>
                  </div>
                </div>
                <Link 
                  href="/profile" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full py-3 bg-surface-glass border border-neon-crimson shadow-[0_0_15px_rgba(255,0,60,0.5)] text-center font-label-caps text-xs clip-chip text-white hover:bg-neon-crimson hover:text-void-black transition-all"
                >
                  PROFILE & WATCHLIST
                </Link>
                <button 
                  onClick={() => { signOut(); setIsMobileMenuOpen(false); }}
                  className="w-full py-3 bg-neon-crimson/10 border border-neon-crimson/30 text-center font-label-caps text-xs clip-chip text-neon-crimson"
                >
                  LOG OUT
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  openModal('login');
                }}
                className="w-full py-3 bg-neon-crimson text-void-black font-headline-md uppercase text-sm clip-chip flex justify-center items-center gap-2"
              >
                <UserIcon className="w-4 h-4" /> LOG IN
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Search Bar Overlay */}
      {isMobileSearchOpen && (
        <div id="mobile-search-panel" className="xl:hidden absolute top-full left-0 w-full bg-surface-container/95 backdrop-blur-xl border-b border-outline-variant/30 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-40">
          <form 
            onSubmit={handleSearch}
            className="flex items-center relative border border-outline-variant transition-colors bg-surface-glass w-full mb-2"
          >
            <Search className="w-4 h-4 text-on-surface-variant ml-3" />
            <input
              aria-label="Search anime"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anime..."
              className="bg-transparent !outline-none border-none text-on-surface font-label-caps text-label-caps w-full py-3 px-3 placeholder:text-on-surface-variant"
              autoFocus
            />
          </form>
          <div className="flex justify-end">
            <button 
              onClick={handleSearch}
              className="px-4 py-2 bg-neon-crimson text-void-black font-label-caps text-[12px] font-bold"
            >
              SEARCH
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
