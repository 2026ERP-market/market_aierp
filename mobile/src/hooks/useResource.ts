import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { errorMessage } from '../services/errors';
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, queryKey = '') {
  const [snapshot, setSnapshot] = useState<{ key: string; value: T }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const controller = useRef<AbortController | null>(null);
  const loader = useRef(load);
  useLayoutEffect(() => { loader.current = load }, [load]);
  const reload = useCallback(async () => {
    controller.current?.abort();
    const next = new AbortController(); controller.current = next;
    setLoading(true); setError(undefined);
    try { const result = await loader.current(next.signal); if (!next.signal.aborted) setSnapshot({ key: queryKey, value: result }) }
    catch (e) { if (!next.signal.aborted) setError(errorMessage(e)) }
    finally { if (!next.signal.aborted) setLoading(false) }
  }, [queryKey]);
  useFocusEffect(useCallback(() => { void reload(); return () => controller.current?.abort() }, [reload]));
  useEffect(() => () => controller.current?.abort(), []);
  return { data: snapshot?.key === queryKey ? snapshot.value : undefined, loading, error, reload };
}
