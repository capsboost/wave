interface RouteLoadingProps {
  message: string;
}

export function RouteLoading({ message }: RouteLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-6 px-4 text-center text-on-surface"
    >
      <div
        aria-hidden="true"
        className="relative grid size-24 place-items-center sm:size-28 lg:size-32"
      >
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-cyber-cyan/20 border-t-cyber-cyan [animation-duration:2.4s]" />
        <div className="absolute inset-3 animate-[spin_1.7s_linear_infinite_reverse] rounded-full border-2 border-neon-crimson/30 border-b-neon-crimson" />
        <div className="absolute inset-6 rounded-full bg-neon-crimson/10 shadow-[0_0_30px_rgba(255,0,60,0.28)] animate-pulse" />
        <span className="relative font-headline-xl text-3xl font-bold tracking-widest text-on-surface drop-shadow-[0_0_12px_rgba(0,240,255,0.8)] sm:text-4xl">
          W
        </span>
      </div>
      <p className="font-label-caps text-xs tracking-[0.24em] text-on-surface-variant sm:text-sm">
        {message}
      </p>
    </div>
  );
}
