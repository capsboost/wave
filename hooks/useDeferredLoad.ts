import { useEffect, useState } from "react";

export function useDeferredLoad(timeoutMs = 1000) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let idleCallbackId: number | undefined;

    const release = () => setIsReady(true);

    if (typeof window.requestIdleCallback === "function") {
      idleCallbackId = window.requestIdleCallback(release, { timeout: timeoutMs });
    } else {
      timeoutId = globalThis.setTimeout(release, timeoutMs);
    }

    return () => {
      if (idleCallbackId !== undefined) {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [timeoutMs]);

  return isReady;
}
