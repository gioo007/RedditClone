import { useEffect, useState } from 'react';
import api from '../api/index.js';

export function useApiHealth() {
  const [state, setState] = useState({
    loading: true,
    health: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    api.health
      .check()
      .then((res) => {
        if (!cancelled) {
          setState({ loading: false, health: res.data, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ loading: false, health: null, error: err.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
