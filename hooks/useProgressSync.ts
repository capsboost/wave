"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { useWatchStore, type ServerWatchItem } from "@/store/useWatchStore";

/**
 * useProgressSync — background sync hook for watch progress.
 * 
 * - On login: fetches server progress and merges into local store.
 * - On pause, backgrounding, or page exit: pushes dirty entries to the server.
 * - No-ops entirely for unauthenticated users.
 */
export function useProgressSync() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const syncRequestedRef = useRef(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const getDirtyEntries = useWatchStore((s) => s.getDirtyEntries);
  const markSynced = useWatchStore((s) => s.markSynced);
  const mergeFromServer = useWatchStore((s) => s.mergeFromServer);

  // Push dirty entries to server
  const syncToServer = useCallback(async () => {
    if (!userId) return;

    if (syncInFlightRef.current) {
      syncRequestedRef.current = true;
      await syncInFlightRef.current;
      return;
    }

    const sync = (async () => {
      do {
        syncRequestedRef.current = false;
        const dirtyEntries = getDirtyEntries();
        const promises = dirtyEntries.map(async (entry) => {
          try {
            const res = await fetch("/api/progress", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                animeId: String(entry.mal_id),
                episodeNumber: Number(entry.episode),
                progressSeconds: entry.time || 0,
                durationSeconds: entry.duration || 0,
                title: entry.title || "",
                imageUrl: entry.image_url || "",
                language: entry.language || "sub",
              }),
            });

            if (res.ok) {
              markSynced(entry);
            } else {
              console.warn(`Failed to sync progress for ${entry.mal_id}: HTTP ${res.status}`);
            }
          } catch (err) {
            console.warn("Failed to sync progress for", entry.mal_id, err);
          }
        });

        await Promise.allSettled(promises);
      } while (syncRequestedRef.current && userId);
    })();

    syncInFlightRef.current = sync;
    try {
      await sync;
    } finally {
      if (syncInFlightRef.current === sync) {
        syncInFlightRef.current = null;
      }
    }
  }, [userId, getDirtyEntries, markSynced]);

  // Fetch server state and merge
  const fetchAndMerge = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    try {
      const res = await fetch("/api/progress", { cache: "no-store" });
      if (!res.ok) return false;

      const data = await res.json();
      const items: ServerWatchItem[] = data.items || [];
      mergeFromServer(items);
      return true;
    } catch (err) {
      console.warn("Failed to fetch server progress:", err);
      return false;
    }
  }, [userId, mergeFromServer]);

  // Merge cloud progress before pushing local changes for each signed-in account.
  useEffect(() => {
    if (!userId) {
      lastFetchedUserIdRef.current = null;
      return;
    }

    if (lastFetchedUserIdRef.current === userId) return;
    lastFetchedUserIdRef.current = userId;

    void fetchAndMerge();
  }, [userId, fetchAndMerge]);

  // Refresh cloud progress when a user returns to this tab; do not poll in the background.
  useEffect(() => {
    if (!userId) return;

    const refreshProgress = () => {
      if (document.visibilityState === "hidden") return;
      void fetchAndMerge();
    };

    window.addEventListener("focus", refreshProgress);
    document.addEventListener("visibilitychange", refreshProgress);
    return () => {
      window.removeEventListener("focus", refreshProgress);
      document.removeEventListener("visibilitychange", refreshProgress);
    };
  }, [userId, fetchAndMerge]);

  // Flush local progress when playback pauses, the tab is backgrounded, or the page exits.
  useEffect(() => {
    if (!userId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void syncToServer();
      }
    };

    const handleCustomSync = () => {
      void syncToServer();
    };

    const handleUnload = () => {
      const dirtyEntries = getDirtyEntries();
      for (const entry of dirtyEntries) {
        const payload = JSON.stringify({
          animeId: String(entry.mal_id),
          episodeNumber: Number(entry.episode),
          progressSeconds: entry.time || 0,
          durationSeconds: entry.duration || 0,
          title: entry.title || "",
          imageUrl: entry.image_url || "",
          language: entry.language || "sub",
        });
        navigator.sendBeacon("/api/progress", new Blob([payload], { type: "application/json" }));
      }
    };

    window.addEventListener("wave-sync-progress", handleCustomSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleUnload);
    return () => {
      window.removeEventListener("wave-sync-progress", handleCustomSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [userId, syncToServer, getDirtyEntries]);
}
