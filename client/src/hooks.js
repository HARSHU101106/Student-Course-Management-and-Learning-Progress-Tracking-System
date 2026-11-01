import { useCallback, useEffect, useRef, useState } from "react";

/** Run an async loader, tracking loading/error state; re-runs when `deps` change. */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const run = useRef(0);

  const load = useCallback(async () => {
    const id = ++run.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await loader();
      if (id === run.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === run.current) setState({ data: null, error, loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
    return () => {
      run.current += 1; // ignore results from stale runs
    };
  }, [load]);

  return { ...state, reload: load, setData: (data) => setState((current) => ({ ...current, data })) };
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · AdaptLearn` : "AdaptLearn";
  }, [title]);
}
