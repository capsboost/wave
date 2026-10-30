import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WatchHistoryItem {
  mal_id: string | number;
  title: string;
  image_url: string;
  episode: string | number;
  timestamp: number;        // local timestamp (Date.now())
  time?: number;            // playback position in seconds (float)
  duration?: number;        // total duration in seconds (float)
  language?: "sub" | "dub";
  max_episodes?: number;    // total available/aired episodes
  status?: string;          // FINISHED, RELEASING, etc.
  dirty?: boolean;          // needs syncing to server
  lastSyncedAt?: number;    // last time this entry was synced to server
}

export interface ResumeInfo {
  hasProgress: boolean;
  episode: number;
  time: number;
  duration: number;
  percentage: number;
  isNextEpisode: boolean;
  isCompleted?: boolean;
  previousEpisode?: number;
  language: "sub" | "dub";
}

/**
 * Netflix-style resume calculator:
 * - If >= 90% watched (or credits reached), Netflix advances to next episode at 0:00 ONLY IF the next episode exists.
 * - If user is at or beyond the maximum available/aired episodes (e.g. series finale or caught up with airing), marks as completed and stays on current episode.
 * - If < 90% watched, resumes current episode at the exact timestamp.
 */
export function getAnimeResumeInfo(item?: WatchHistoryItem, maxEpisodes?: number): ResumeInfo {
  if (!item) {
    return {
      hasProgress: false,
      episode: 1,
      time: 0,
      duration: 0,
      percentage: 0,
      isNextEpisode: false,
      isCompleted: false,
      language: "sub",
    };
  }

  const currentEp = Number(item.episode) || 1;
  const time = item.time || 0;
  const duration = item.duration || 0;
  const percentage = duration > 0 ? Math.min(100, Math.round((time / duration) * 100)) : 0;
  const language = item.language || "sub";
  const effectiveMaxEpisodes = maxEpisodes ?? item.max_episodes;

  // If >= 90% watched:
  if (percentage >= 90) {
    // If anime is at or past the maximum available/aired episodes:
    // Do NOT navigate to a non-existent next episode. Flag as completed / caught up.
    if (effectiveMaxEpisodes && effectiveMaxEpisodes > 0 && currentEp >= effectiveMaxEpisodes) {
      return {
        hasProgress: true,
        episode: currentEp,
        time: 0,
        duration,
        percentage: 100,
        isNextEpisode: false,
        isCompleted: true,
        previousEpisode: currentEp,
        language,
      };
    }

    // Next episode exists and is valid to advance to
    const nextEp = currentEp + 1;
    return {
      hasProgress: true,
      episode: nextEp,
      time: 0,
      duration: 0,
      percentage: 0,
      isNextEpisode: true,
      isCompleted: false,
      previousEpisode: currentEp,
      language,
    };
  }

  // Still watching current episode (< 90%)
  return {
    hasProgress: true,
    episode: currentEp,
    time,
    duration,
    percentage,
    isNextEpisode: false,
    isCompleted: false,
    language,
  };
}

export interface ServerWatchItem {
  id: string;
  userId: string;
  animeId: string;
  episodeNumber: number;
  progressSeconds: number;
  durationSeconds: number;
  title: string | null;
  imageUrl: string | null;
  language: string;
  updatedAt: string;
}

interface WatchStoreState {
  history: Record<string, WatchHistoryItem>;
  getResumeInfo: (mal_id: string | number, maxEpisodes?: number) => ResumeInfo;
  addToHistory: (item: Omit<WatchHistoryItem, 'timestamp' | 'dirty'>) => void;
  updateProgress: (mal_id: string | number, time: number, duration: number) => void;
  removeFromHistory: (mal_id: string | number) => void;
  clearHistory: () => void;
  markDirty: (mal_id: string | number) => void;
  markSynced: (item: WatchHistoryItem) => void;
  getDirtyEntries: () => WatchHistoryItem[];
  mergeFromServer: (serverItems: ServerWatchItem[]) => void;
}

export const useWatchStore = create<WatchStoreState>()(
  persist(
    (set, get) => ({
      history: {},

      getResumeInfo: (mal_id, maxEpisodes) => {
        const item = get().history[String(mal_id)];
        return getAnimeResumeInfo(item, maxEpisodes);
      },

      addToHistory: (item) =>
        set((state) => {
          const key = String(item.mal_id);
          const existing = state.history[key];
          const isSameEpisode = existing && String(existing.episode) === String(item.episode);

          return {
            history: {
              ...state.history,
              [key]: {
                ...existing,
                ...item,
                // Only preserve playback position if staying on the same episode
                time: isSameEpisode ? existing?.time : (item.time ?? 0),
                duration: isSameEpisode ? existing?.duration : (item.duration ?? 0),
                timestamp: Date.now(),
                dirty: true,
              },
            },
          };
        }),

      updateProgress: (mal_id, time, duration) =>
        set((state) => {
          const key = String(mal_id);
          if (!state.history[key]) return state;
          return {
            history: {
              ...state.history,
              [key]: {
                ...state.history[key],
                time,
                duration,
                dirty: true,
              },
            },
          };
        }),

      removeFromHistory: (mal_id) =>
        set((state) => {
          const newHistory = { ...state.history };
          delete newHistory[String(mal_id)];
          return { history: newHistory };
        }),

      clearHistory: () => set({ history: {} }),

      markDirty: (mal_id) =>
        set((state) => {
          const key = String(mal_id);
          if (!state.history[key]) return state;
          return {
            history: {
              ...state.history,
              [key]: { ...state.history[key], dirty: true },
            },
          };
        }),

      markSynced: (syncedItem) =>
        set((state) => {
          const key = String(syncedItem.mal_id);
          const currentItem = state.history[key];
          if (
            !currentItem ||
            String(currentItem.episode) !== String(syncedItem.episode) ||
            currentItem.time !== syncedItem.time ||
            currentItem.duration !== syncedItem.duration ||
            currentItem.timestamp !== syncedItem.timestamp
          ) {
            return state;
          }
          return {
            history: {
              ...state.history,
              [key]: {
                ...currentItem,
                dirty: false,
                lastSyncedAt: Date.now(),
              },
            },
          };
        }),

      getDirtyEntries: () => {
        const { history } = get();
        return Object.values(history).filter((item) => item.dirty);
      },

      /**
       * Netflix-style automatic reconciliation:
       * Silently picks the furthest progress in the series without prompting the user.
       * - Furthest episode wins.
       * - If same episode, furthest progress seconds/time wins.
       * - If local wins, marked dirty so it syncs up to cloud.
       * - If cloud wins, local updates and marked clean.
       */
      mergeFromServer: (serverItems) =>
        set((state) => {
          const newHistory = { ...state.history };
          const serverIds = new Set(serverItems.map((s) => s.animeId));

          for (const serverItem of serverItems) {
            const localItem = newHistory[serverItem.animeId];

            if (!localItem) {
              // No local entry — accept server data directly
              newHistory[serverItem.animeId] = {
                mal_id: serverItem.animeId,
                title: serverItem.title || "",
                image_url: serverItem.imageUrl || "",
                episode: serverItem.episodeNumber,
                timestamp: new Date(serverItem.updatedAt).getTime(),
                time: serverItem.progressSeconds,
                duration: serverItem.durationSeconds,
                language: (serverItem.language as "sub" | "dub") || "sub",
                dirty: false,
                lastSyncedAt: Date.now(),
              };
              continue;
            }

            // Both exist — Netflix auto-determination
            const localEp = Number(localItem.episode) || 1;
            const serverEp = serverItem.episodeNumber || 1;
            const localProgress = localItem.time || 0;
            const serverProgress = serverItem.progressSeconds || 0;

            let useServer = false;
            if (serverEp > localEp) {
              // Cloud watched a further episode
              useServer = true;
            } else if (localEp > serverEp) {
              // Local watched a further episode
              useServer = false;
            } else {
              // Same episode: furthest progress seconds wins
              if (serverProgress > localProgress) {
                useServer = true;
              } else if (localProgress > serverProgress) {
                useServer = false;
              } else {
                // Exact tie: use server
                useServer = true;
              }
            }

            if (useServer) {
              newHistory[serverItem.animeId] = {
                ...localItem,
                episode: serverItem.episodeNumber,
                time: serverItem.progressSeconds,
                duration: serverItem.durationSeconds,
                title: serverItem.title || localItem.title,
                image_url: serverItem.imageUrl || localItem.image_url,
                language: (serverItem.language as "sub" | "dub") || localItem.language,
                timestamp: new Date(serverItem.updatedAt).getTime(),
                dirty: false,
                lastSyncedAt: Date.now(),
              };
            } else {
              // Local is further ahead: keep local and mark dirty so it syncs up
              newHistory[serverItem.animeId] = {
                ...localItem,
                dirty: true,
              };
            }
          }

          // Handle remote deletions
          for (const localId of Object.keys(newHistory)) {
            const item = newHistory[localId];
            if (!serverIds.has(localId) && !item.dirty && item.lastSyncedAt !== undefined) {
              delete newHistory[localId];
            }
          }

          return {
            history: newHistory,
          };
        }),
    }),
    {
      name: 'wave-anime-storage',
    }
  )
);
