import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

export function useFetch(path) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [tick, setTick] = useState(0);
  const retry = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const ctl = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    api(path, { signal: ctl.signal })
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', data: null, error }); });
    return () => ctl.abort();
  }, [path, tick]);

  return { ...state, retry };
}
