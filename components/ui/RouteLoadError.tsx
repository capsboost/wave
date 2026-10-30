interface RouteLoadErrorProps {
  message: string;
  onRetry: () => void;
}

export function RouteLoadError({ message, onRetry }: RouteLoadErrorProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[70vh] flex-col items-center justify-center gap-4 bg-void-black px-6 text-center text-on-surface"
    >
      <p className="font-label-caps text-sm tracking-widest text-on-surface-variant">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="clip-chip bg-neon-crimson px-5 py-3 font-label-caps text-sm font-bold text-void-black transition-opacity hover:opacity-80"
      >
        Try again
      </button>
    </div>
  );
}
