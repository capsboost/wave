import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string | null;
  linkLabel: string | null;
  actorName: string | null;
  read: boolean;
  createdAt: string;
  isBroadcast: boolean;
}

export function useNotifications() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", session?.user?.id ?? "guest"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: session?.user ? 900000 : false, // Poll every 15m ONLY if logged in, NEVER for guests
    refetchIntervalInBackground: false, 
    refetchOnWindowFocus: false, 
    staleTime: session?.user ? 5 * 60 * 1000 : 60 * 60 * 1000, // 5m for users, 1h for guests 
  });

  const markAsReadMutation = useMutation({
    mutationFn: async ({ id, isBroadcast }: { id: string, isBroadcast: boolean }) => {
      const payload = isBroadcast ? { broadcastIds: [id] } : { notificationIds: [id] };
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to mark read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", session?.user?.id ?? "guest"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!res.ok) throw new Error("Failed to mark all read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", session?.user?.id ?? "guest"] });
    },
  });

  return {
    items: (data?.items || []) as NotificationItem[],
    unreadCount: (data?.unreadCount || 0) as number,
    isLoading,
    markAsRead: (id: string, isBroadcast: boolean) => {
      if (session) {
        markAsReadMutation.mutate({ id, isBroadcast });
      }
    },
    markAllAsRead: () => {
      if (session) {
        markAllAsReadMutation.mutate();
      }
    },
  };
}
