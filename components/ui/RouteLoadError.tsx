import { AlertTriangle } from "lucide-react";

interface RouteLoadErrorProps {
  message: string;
  onRetry: () => void;
}

export function RouteLoadError({ message, onRetry }: RouteLoadErrorProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[70vh] flex-col items-center justify-center gap-4 border-y border-neon-crimson/30 bg-neon-crimson/5 px-6 text-center text-on-surface"
    >
      <AlertTriangle aria-hidden="true" className="size-8 text-neon-crimson" />
      <p className="max-w-xl font-label-caps text-sm tracking-widest text-on-surface">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="clip-chip border border-neon-crimson bg-neon-crimson px-5 py-3 font-label-caps text-sm font-bold text-void-black transition-colors hover:bg-transparent hover:text-neon-crimson"
      >
        Try again
      </button>
    </div>
  );
}
