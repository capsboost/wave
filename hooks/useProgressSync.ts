"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { useWatchStore, type ServerWatchItem } from "@/store/useWatchStore";

const SYNC_INTERVAL_MS = 30_000; // 30 seconds

/**
 * useProgressSync — background sync hook for watch progress.
 * 
 * - On login/mount: fetches server progress and merges into local store (with conflict detection).
 * - Every 30s: pushes dirty local entries to the server.
 * - On page unload: final flush of dirty entries.
 * - No-ops entirely for unauthenticated users.
 */
export function useProgressSync() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedRef = useRef(false);

  const getDirtyEntries = useWatchStore((s) => s.getDirtyEntries);
  const markSynced = useWatchStore((s) => s.markSynced);
  const mergeFromServer = useWatchStore((s) => s.mergeFromServer);

  // Push dirty entries to server
  const syncToServer = useCallback(async () => {
    if (!isAuthenticated) return;

    const dirtyEntries = getDirtyEntries();
    if (dirtyEntries.length === 0) return;

    // Batch: send each dirty entry to the API
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
          markSynced(entry.mal_id);
        }
      } catch (err) {
        console.warn("Failed to sync progress for", entry.mal_id, err);
      }
    });

    await Promise.allSettled(promises);
  }, [isAuthenticated, getDirtyEntries, markSynced]);

  // Fetch server state and merge
  const fetchAndMerge = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const res = await fetch("/api/progress");
      if (!res.ok) return;

      const data = await res.json();
      const items: ServerWatchItem[] = data.items || [];
      mergeFromServer(items);
    } catch (err) {
      console.warn("Failed to fetch server progress:", err);
    }
  }, [isAuthenticated, mergeFromServer]);

  // On mount / login: fetch server state, merge, and immediately sync local offline progress to cloud
  useEffect(() => {
    if (!isAuthenticated) {
      hasFetchedRef.current = false;
      return;
    }

    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchAndMerge().then(() => {
        // Immediately sync any local entries that were watched offline or are ahead
        syncToServer();
      });
    }
  }, [isAuthenticated, fetchAndMerge, syncToServer]);

  // Background push sync: ONLY runs if dirty entries exist (no network call if empty)
  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      syncToServer(); // pushes only if dirty entries exist
    }, SYNC_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, syncToServer]);

  // Event-driven sync on pause/leave, visibilitychange, pagehide, and unload
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleCustomSync = () => {
      syncToServer();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        syncToServer();
      }
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
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("wave-sync-progress", handleCustomSync);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [isAuthenticated, syncToServer, getDirtyEntries]);
}
