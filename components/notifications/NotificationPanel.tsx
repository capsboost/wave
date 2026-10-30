import { MessageSquare, Megaphone, BellOff } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useSession } from "@/lib/auth-client";
import { timeAgo } from "@/lib/timeAgo";
import { useRouter } from "next/navigation";

interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { items, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();
  const { data: session } = useSession();
  const router = useRouter();

  const handleItemClick = (id: string, isBroadcast: boolean, linkUrl: string | null) => {
    markAsRead(id, isBroadcast);
    onClose();
    if (linkUrl) {
      router.push(linkUrl);
    }
  };

  return (
    <div className="absolute top-full right-0 mt-4 w-80 sm:w-96 bg-surface-container border border-outline-variant/30 shadow-[0_10px_40px_rgba(0,0,0,0.9)] clip-corner flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container/50">
        <h3 className="font-headline-md text-sm text-on-surface uppercase tracking-wider">Notifications</h3>
        {session && unreadCount > 0 && (
          <button 
            onClick={() => markAllAsRead()}
            className="text-xs font-label-caps text-neon-crimson hover:text-white transition-colors cursor-pointer"
          >
            Mark All Read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden flex flex-col">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4 animate-pulse">
            <div className="h-16 bg-surface-glass clip-corner w-full"></div>
            <div className="h-16 bg-surface-glass clip-corner w-full"></div>
            <div className="h-16 bg-surface-glass clip-corner w-full"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 gap-3 text-on-surface-variant">
            <BellOff className="w-8 h-8 opacity-50" />
            <p className="font-label-caps text-xs">No notifications yet</p>
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id, item.isBroadcast, item.linkUrl)}
              className={`text-left p-4 flex gap-3 hover:bg-surface-glass transition-colors border-b border-outline-variant/10 last:border-0 relative group ${!item.read ? 'bg-surface-glass/30' : ''}`}
            >
              {/* Unread dot */}
              {!item.read && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-neon-crimson shadow-[0_0_8px_#FF003C]" />
              )}
              
              <div className="shrink-0 mt-1">
                {item.type === "comment_reply" ? (
                  <div className="w-8 h-8 rounded-full bg-cyber-cyan/10 flex items-center justify-center text-cyber-cyan border border-cyber-cyan/30">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-neon-crimson/10 flex items-center justify-center text-neon-crimson border border-neon-crimson/30">
                    <Megaphone className="w-4 h-4" />
                  </div>
                )}
              </div>
              
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className={`font-headline-sm text-sm truncate ${!item.read ? 'text-white font-bold' : 'text-on-surface'}`}>
                    {item.title}
                  </span>
                  <span className="font-label-caps text-xs text-on-surface-variant shrink-0 mt-0.5">
                    {timeAgo(item.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                  {item.message}
                </p>
                {item.linkLabel && (
                  <span className="text-xs font-label-caps text-cyber-cyan mt-2 uppercase tracking-wider group-hover:text-neon-crimson transition-colors">
                    {item.linkLabel}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
