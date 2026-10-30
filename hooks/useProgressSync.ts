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
  const userId = session?.user?.id;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const getDirtyEntries = useWatchStore((s) => s.getDirtyEntries);
  const markSynced = useWatchStore((s) => s.markSynced);
  const mergeFromServer = useWatchStore((s) => s.mergeFromServer);

  // Push dirty entries to server
  const syncToServer = useCallback(async () => {
    if (!userId || syncInFlightRef.current) return;

    const dirtyEntries = getDirtyEntries();
    if (dirtyEntries.length === 0) return;

    const sync = (async () => {
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
          }
        } catch (err) {
          console.warn("Failed to sync progress for", entry.mal_id, err);
        }
      });

      await Promise.allSettled(promises);
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

    void fetchAndMerge().then((merged) => {
      if (merged && lastFetchedUserIdRef.current === userId) {
        void syncToServer();
      }
    });
  }, [userId, fetchAndMerge, syncToServer]);

  // Push local changes every 30 seconds and pull changes from other devices every minute.
  useEffect(() => {
    if (!userId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    let tick = 0;
    intervalRef.current = setInterval(() => {
      tick += 1;
      if (tick % 2 === 0) {
        void fetchAndMerge().then((merged) => {
          if (merged) void syncToServer();
        });
      } else {
        void syncToServer();
      }
    }, SYNC_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [userId, syncToServer, fetchAndMerge]);

  // Refresh from the server when a user returns to this tab or browser.
  useEffect(() => {
    if (!userId) return;

    const refreshProgress = () => {
      if (document.visibilityState === "hidden") return;
      void fetchAndMerge().then((merged) => {
        if (merged) void syncToServer();
      });
    };

    window.addEventListener("focus", refreshProgress);
    document.addEventListener("visibilitychange", refreshProgress);
    return () => {
      window.removeEventListener("focus", refreshProgress);
      document.removeEventListener("visibilitychange", refreshProgress);
    };
  }, [userId, fetchAndMerge, syncToServer]);

  // Flush local progress during navigation and page shutdown.
  useEffect(() => {
    if (!userId) return;

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
    window.addEventListener("pagehide", handleUnload);
    return () => {
      window.removeEventListener("wave-sync-progress", handleCustomSync);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [userId, syncToServer, getDirtyEntries]);
}
