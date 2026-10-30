import { WaveLogo } from "@/components/ui/WaveLogo";

interface RouteLoadingProps {
  message: string;
  compact?: boolean;
}

export function RouteLoading({ message, compact = false }: RouteLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full flex-col items-center justify-center gap-6 px-4 text-center text-on-surface ${
        compact
          ? "min-h-64"
          : "mt-16 min-h-[calc(100dvh-4rem)] md:mt-20 md:min-h-[calc(100dvh-5rem)]"
      }`}
    >
      <div
        aria-hidden="true"
        className={`relative grid place-items-center ${
          compact ? "size-24" : "size-28 sm:size-32 lg:size-36"
        }`}
      >
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-cyber-cyan/20 border-t-cyber-cyan [animation-duration:2.4s]" />
        <div className="absolute inset-3 animate-[spin_1.7s_linear_infinite_reverse] rounded-full border-2 border-neon-crimson/30 border-b-neon-crimson" />
        <div className="absolute inset-6 rounded-full bg-neon-crimson/10 shadow-[0_0_30px_rgba(255,0,60,0.28)] animate-pulse" />
        <WaveLogo
          variant="icon"
          size={compact ? "lg" : "xl"}
          className="relative z-10 animate-pulse [animation-duration:1.8s]"
        />
      </div>
      <p className="font-label-caps text-xs tracking-[0.24em] text-on-surface-variant sm:text-sm">
        {message}
      </p>
    </div>
  );
}
