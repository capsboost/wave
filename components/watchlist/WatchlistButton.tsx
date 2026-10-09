"use client";

import { useSession } from "@/lib/auth-client";
import { Plus, Check, Loader2 } from "lucide-react";
import { useAuthModal } from "@/store/useAuthModal";
import { useWatchlist } from "@/hooks/useWatchlist";

interface WatchlistButtonProps {
  animeId: string | number;
  className?: string;
  showText?: boolean;
  initialInList?: boolean;
}

export function WatchlistButton({
  animeId,
  className = "px-6 py-4",
  showText = true,
  initialInList,
}: WatchlistButtonProps) {
  const { data: session } = useSession();
  const { openModal } = useAuthModal();
  const { isInWatchlist, toggleWatchlist, isToggling, isLoading } = useWatchlist();

  const inWatchlist = session?.user ? isInWatchlist(animeId) : false;
  const inList = (isLoading && initialInList !== undefined)
    ? initialInList
    : inWatchlist;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      openModal("login");
      return;
    }
    toggleWatchlist(animeId);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isToggling}
      className={`flex items-center justify-center gap-2 bg-surface-container border border-outline-variant transition-all duration-300 group clip-corner font-label-caps font-bold active:scale-95 cursor-pointer ${
        inList
          ? "text-cyber-cyan border-cyber-cyan hover:bg-cyber-cyan/10"
          : "text-white hover:border-cyber-cyan hover:text-cyber-cyan"
      } ${className}`}
    >
      {isToggling ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : inList ? (
        <Check className="w-5 h-5 transition-transform group-hover:scale-110" />
      ) : (
        <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
      )}
      {showText && (inList ? "IN LIST" : "MY LIST")}
    </button>
  );
}
