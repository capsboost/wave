import { Grid } from "ldrs/react";
import "ldrs/react/Grid.css";

interface RouteLoadingProps {
  message: string;
}

export function RouteLoading({ message }: RouteLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[70vh] flex-col items-center justify-center gap-4 bg-void-black text-on-surface"
    >
      <Grid size="60" speed="1" color="#FF003C" />
      <p className="font-label-caps text-sm tracking-widest text-on-surface-variant">
        {message}
      </p>
    </div>
  );
}
