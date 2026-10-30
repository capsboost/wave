"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RouteLoadError } from "@/components/ui/RouteLoadError";
import { RouteLoading } from "@/components/ui/RouteLoading";

const SLOW_NAVIGATION_MS = 20_000;

interface PendingNavigation {
  href: string;
  pathname: string;
}

export function AnimeNavigationLoader() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [isSlow, setIsSlow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingNavigation = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPendingNavigation(null);
    setIsSlow(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(clearPendingNavigation, 0);
    return () => clearTimeout(timeout);
  }, [pathname, clearPendingNavigation]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname === window.location.pathname ||
        !/^\/(?:anime|watch)\//.test(destination.pathname)
      ) {
        return;
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPendingNavigation({
        href: `${destination.pathname}${destination.search}${destination.hash}`,
        pathname: destination.pathname,
      });
      setIsSlow(false);
      timeoutRef.current = setTimeout(() => setIsSlow(true), SLOW_NAVIGATION_MS);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!pendingNavigation || pathname === pendingNavigation.pathname) return null;

  if (isSlow) {
    return (
      <div className="fixed inset-0 z-[100] bg-void-black">
        <RouteLoadError
          message="This page is taking longer than expected to load."
          onRetry={() => {
            setIsSlow(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setIsSlow(true), SLOW_NAVIGATION_MS);
            router.push(pendingNavigation.href);
          }}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] bg-void-black/80">
      <RouteLoading message="Loading anime details..." />
    </div>
  );
}
