// src/hooks/useClickOutside.ts
import { useEffect, useCallback, RefObject } from 'react';

/**
 * Hook to detect clicks outside of specified elements
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null>[],
  handlers: (() => void)[],
  enabled: boolean = true
): void {
  const handleClickOutside = useCallback((event: MouseEvent) => {
    refs.forEach((ref, index) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handlers[index]?.();
      }
    });
  }, [refs, handlers]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside, enabled]);
}

/**
 * Simplified version for single ref
 */
export function useSingleClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, handler, enabled]);
}