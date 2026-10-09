"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";

export interface WatchlistItem {
  id: string;
  userId: string;
  animeId: string;
  createdAt: string;
}

export function useWatchlist() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  const queryKey = ["watchlist", userId];

  const { data: items = [], isLoading } = useQuery<WatchlistItem[]>({
    queryKey,
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch("/api/watchlist");
      if (!res.ok) return [];
      const data = await res.json();
      return (data.items || []) as WatchlistItem[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const watchlistSet = new Set(items.map((i) => String(i.animeId)));

  const toggleMutation = useMutation({
    mutationFn: async (animeId: string) => {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId: String(animeId) }),
      });
      if (!res.ok) throw new Error("Failed to toggle watchlist");
      return (await res.json()) as { action: "added" | "removed" };
    },
    onMutate: async (animeId: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previousItems = queryClient.getQueryData<WatchlistItem[]>(queryKey) || [];
      const strId = String(animeId);
      const isAlready = previousItems.some((item) => item.animeId === strId);

      let nextItems: WatchlistItem[];
      if (isAlready) {
        nextItems = previousItems.filter((item) => item.animeId !== strId);
      } else {
        nextItems = [
          ...previousItems,
          {
            id: `temp-${Date.now()}`,
            userId: userId || "",
            animeId: strId,
            createdAt: new Date().toISOString(),
          },
        ];
      }

      queryClient.setQueryData<WatchlistItem[]>(queryKey, nextItems);
      return { previousItems };
    },
    onError: (_err, _animeId, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(queryKey, context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    items,
    isInWatchlist: (animeId: string | number) => watchlistSet.has(String(animeId)),
    toggleWatchlist: (animeId: string | number) => toggleMutation.mutate(String(animeId)),
    isLoading,
    isToggling: toggleMutation.isPending,
  };
}
