import { useState, useEffect } from 'react';

import type { Config } from '@/types/config';
import { loadAppConfig } from '@/utils/app-config';

export function useAppConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const appConfig = await loadAppConfig();
        
        if (mounted) {
          setConfig(appConfig);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load config'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchConfig();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    config,
    isLoading,
    error
  };
}