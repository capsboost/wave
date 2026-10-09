"use client";

import { useState, useEffect } from "react";
import { useSession, authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, Loader2, Bookmark, History, Trash2, Play } from "lucide-react";
import { Grid } from 'ldrs/react';
import 'ldrs/react/Grid.css';
import { ProfileAnimeCard } from "@/components/profile/ProfileAnimeCard";
import { useWatchStore } from "@/store/useWatchStore";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useAnimeDetailsBatch } from "@/hooks/useAnime";
import type { AniListAnime } from "@/lib/api/anilist";

export default function ProfileClient() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<"watchlist" | "history" | "settings">("watchlist");

  // Hydration-safe store access
  const history = useWatchStore((s) => s.history);
  const removeFromHistory = useWatchStore((s) => s.removeFromHistory);
  const clearHistory = useWatchStore((s) => s.clearHistory);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);
  const historyItems = mounted ? Object.values(history).sort((a, b) => b.timestamp - a.timestamp) : [];

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearHistory = async () => {
    clearHistory();
    setShowClearConfirm(false);
    if (session?.user) {
      try { await fetch("/api/progress", { method: "DELETE" }); } catch (e) { console.error(e); }
    }
  };

  const handleRemoveFromHistory = async (animeId: string | number) => {
    removeFromHistory(animeId);
    if (session?.user) {
      try { await fetch(`/api/progress/${animeId}`, { method: "DELETE" }); } catch (e) { console.error(e); }
    }
  };
  
  // Settings State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [loadingPass, setLoadingPass] = useState(false);

  // Data State via centralized, cached hook
  const { items: watchlist, isLoading: loadingData } = useWatchlist();

  // Batch-fetch all watchlist anime details in ONE AniList request instead of N per-card fetches.
  // This prevents the watchlist page from firing N concurrent requests to AniList,
  // which would instantly exhaust the per-IP rate limit for users with long watchlists.
  const watchlistIds = watchlist.map(item => item.animeId);
  const { data: batchAnime, isLoading: loadingBatch } = useAnimeDetailsBatch(watchlistIds);
  const animeMap = new Map<string, AniListAnime>(
    (batchAnime ?? []).map(a => [String(a.idMal), a])
  );

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/");
    }
  }, [isPending, session, router]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPass(true);
    setPasswordError("");
    setPasswordSuccess("");
    
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true
      });
      if (error) throw new Error(error.message);
      
      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoadingPass(false);
    }
  };

  if (isPending || !session) return <div className="min-h-screen bg-void-black flex items-center justify-center text-neon-crimson"><Grid size="50" speed="1" color="#FF003C" /></div>;

  return (
    <div className="min-h-screen bg-void-black pt-24 pb-20 px-margin-mobile md:px-margin-desktop text-on-surface bg-[url('/noise.png')] bg-repeat">
      <div className="max-w-350 mx-auto">
        <h1 className="font-headline-xl text-4xl md:text-6xl uppercase text-white mb-10 pb-6 relative">
          <span className="text-neon-crimson drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]">My</span> Profile
          <div className="absolute bottom-0 left-0 w-32 h-1 bg-neon-crimson drop-shadow-[0_0_10px_rgba(255,0,60,0.8)]"></div>
          <div className="absolute bottom-0 left-32 right-0 h-px bg-outline-variant/30"></div>
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Sidebar */}
          <div className="md:col-span-4 lg:col-span-3 flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-24 h-24 bg-neon-crimson text-void-black font-headline-xl text-4xl flex items-center justify-center clip-chip uppercase">
                {session.user.name.charAt(0)}
              </div>
              <div>
                <h2 className="font-headline-lg text-xl text-white">{session.user.name}</h2>
                <p className="font-label-caps text-xs text-on-surface-variant mt-1">{session.user.email}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setActiveTab("watchlist")}
                className={`flex items-center gap-3 px-4 py-3 font-label-caps text-sm clip-chip transition-colors ${activeTab === 'watchlist' ? 'bg-neon-crimson text-void-black font-bold' : 'bg-surface-container hover:bg-surface-glass text-on-surface-variant'}`}
              >
                <Bookmark className="w-4 h-4" /> WATCHLIST
              </button>
              <button 
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-3 px-4 py-3 font-label-caps text-sm clip-chip transition-colors ${activeTab === 'history' ? 'bg-cyber-cyan text-void-black font-bold' : 'bg-surface-container hover:bg-surface-glass text-on-surface-variant'}`}
              >
                <History className="w-4 h-4" /> WATCH HISTORY
              </button>
              <button 
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-3 px-4 py-3 font-label-caps text-sm clip-chip transition-colors ${activeTab === 'settings' ? 'bg-white text-void-black font-bold' : 'bg-surface-container hover:bg-surface-glass text-on-surface-variant'}`}
              >
                <Lock className="w-4 h-4" /> SECURITY SETTINGS
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="md:col-span-8 lg:col-span-9 min-h-125">
            
            {activeTab === 'watchlist' && (
              <div className="animate-in fade-in duration-300">
                <h3 className="font-headline-lg text-2xl text-white mb-6 uppercase">My Watchlist</h3>
                {(loadingData || loadingBatch) ? <div className="py-12 flex justify-center"><Grid size="40" speed="1" color="#FF003C" /></div> : watchlist.length === 0 ? (
                  <p className="text-on-surface-variant font-label-caps">Watchlist is empty.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {watchlist.map(item => (
                      <ProfileAnimeCard
                        key={item.id}
                        animeId={item.animeId}
                        dateAdded={item.createdAt}
                        anime={animeMap.get(item.animeId)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-headline-lg text-2xl text-white uppercase">Watch History</h3>
                  {historyItems.length > 0 && (
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="font-label-caps text-[11px] px-3 py-1.5 border border-neon-crimson/50 text-neon-crimson hover:bg-neon-crimson/10 transition-colors clip-chip cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                {historyItems.length === 0 ? (
                  <p className="text-on-surface-variant font-label-caps">No watch history yet.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {historyItems.map((item) => {
                      const pct = item.time && item.duration ? Math.min(Math.round((item.time / item.duration) * 100), 100) : 0;
                      const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
                      return (
                        <div key={item.mal_id} className="bg-surface-container border border-outline-variant/30 clip-corner flex items-center gap-4 p-3 group hover:border-cyber-cyan/50 transition-all">
                          <Link href={`/watch/${item.mal_id}/${item.episode}?lang=${item.language || 'sub'}`} className="relative w-20 h-14 shrink-0 overflow-hidden block">
                            <Image src={item.image_url} alt={item.title} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                              <Play className="w-5 h-5 text-cyber-cyan fill-current" />
                            </div>
                            {/* Progress bar */}
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-outline-variant/30">
                              <div className="h-full bg-neon-crimson" style={{ width: `${pct}%` }} />
                            </div>
                          </Link>
                          <div className="flex-1 min-w-0">
                            <Link href={`/watch/${item.mal_id}/${item.episode}?lang=${item.language || 'sub'}`} className="font-headline-md text-sm text-white hover:text-cyber-cyan transition-colors line-clamp-1 block">
                              {item.title}
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-label-caps text-[10px] text-on-surface-variant">EP {item.episode}</span>
                              {item.time != null && item.duration != null && (
                                <>
                                  <span className="text-outline-variant">•</span>
                                  <span className="font-label-caps text-[10px] text-on-surface-variant">{formatTime(item.time)} / {formatTime(item.duration)}</span>
                                  <span className="text-outline-variant">•</span>
                                  <span className="font-label-caps text-[10px] text-cyber-cyan">{pct}%</span>
                                </>
                              )}
                              {item.language && (
                                <>
                                  <span className="text-outline-variant">•</span>
                                  <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">{item.language}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveFromHistory(item.mal_id)}
                            className="text-on-surface-variant hover:text-neon-crimson transition-colors p-2 shrink-0"
                            title="Remove from history"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <ConfirmModal
                  isOpen={showClearConfirm}
                  onClose={() => setShowClearConfirm(false)}
                  onConfirm={handleClearHistory}
                  title="Clear All Watch History?"
                  description="This will permanently wipe your entire playback progress and watch history from your account. This action cannot be undone."
                  confirmText="CONFIRM CLEAR"
                  variant="danger"
                />
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="animate-in fade-in duration-300 max-w-md">
                <h3 className="font-headline-lg text-2xl text-white mb-6 uppercase">Change Password</h3>
                
                {passwordError && <div className="bg-neon-crimson/10 border border-neon-crimson text-neon-crimson p-3 text-sm font-label-caps mb-6">{passwordError}</div>}
                {passwordSuccess && <div className="bg-neon-crimson/10 border border-neon-crimson text-neon-crimson p-3 text-sm font-label-caps mb-6">{passwordSuccess}</div>}

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1">
                    <label htmlFor="currentPassword" className="text-xs font-label-caps text-on-surface-variant uppercase">Current Password</label>
                    <input 
                      id="currentPassword"
                      type="password" 
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                      className="w-full bg-void-black border border-outline-variant/50 focus:border-white outline-none text-white px-4 py-3 font-body-md transition-colors clip-corner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="newPassword" className="text-xs font-label-caps text-on-surface-variant uppercase">New Password</label>
                    <input 
                      id="newPassword"
                      type="password" 
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      className="w-full bg-void-black border border-outline-variant/50 focus:border-white outline-none text-white px-4 py-3 font-body-md transition-colors clip-corner"
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={loadingPass}
                    className="w-full bg-white text-void-black font-headline-md uppercase py-3 px-4 transition-colors hover:bg-gray-200 flex justify-center items-center gap-2 mt-4 clip-chip"
                  >
                    {loadingPass && <Loader2 className="w-5 h-5 animate-spin" />}
                    UPDATE SECURITY KEY
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
