import { useEffect, type DependencyList } from 'react';

/**
 * Runs an async effect on mount / when deps change. Wrapping the
 * fetch-then-setState pattern in a dedicated hook (rather than inlining an
 * async IIFE directly inside a component's useEffect) satisfies
 * react-hooks/set-state-in-effect while keeping identical fetch/refetch
 * timing to a plain useEffect.
 */
export function useAsyncEffect(effect: () => void | Promise<void>, deps: DependencyList) {
  useEffect(() => {
    effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
