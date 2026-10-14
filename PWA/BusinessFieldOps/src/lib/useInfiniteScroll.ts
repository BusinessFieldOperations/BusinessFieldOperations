import {useEffect, useRef} from 'preact/hooks';

/**
 * Calls `onReach` when the returned sentinel gets near the viewport.
 *
 * Attach the ref to an element placed after the list. Pass `enabled = false`
 * while a request is in flight or there is nothing more to load: turning it
 * back on recreates the observer, which reports the current visibility right
 * away, so pages keep chaining if the sentinel is still visible.
 */
export function useInfiniteScroll(
  onReach: () => void,
  enabled: boolean,
  rootMargin = '200px',
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!enabled || !sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          onReach();
        }
      },
      {rootMargin},
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [enabled, onReach, rootMargin]);

  return sentinelRef;
}
