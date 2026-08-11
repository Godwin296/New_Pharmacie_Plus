"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UsePageLoadOptions {
  deps?: unknown[];
  keepPrevious?: boolean; // garde les anciennes données pendant le fetch
}

export function usePageLoad<T>(
  fetcher: () => Promise<T>,
  options: UsePageLoadOptions = {}
) {
  const { deps = [], keepPrevious = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    // Si on garde les données précédentes, on ne montre pas de skeleton
    // sur un re-fetch (changement de page, pull-to-refresh...)
    if (!keepPrevious || !data) setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
      hasFetched.current = true;
    }
  }, [fetcher, keepPrevious, data]);

  useEffect(() => {
    load();
  }, deps);

  return { data, loading, error, reload: load, hasFetched: hasFetched.current };
}