import { useState, useCallback } from 'react';

export function useAsyncAction() {
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [isError, setIsError] = useState(false);

  const runAction = useCallback(async <T>(
    loadingText: string,
    action: () => Promise<T>,
    successText?: string
  ): Promise<T | undefined> => {
    setIsLoading(true);
    setStatusText(loadingText);
    setIsError(false);

    try {
      const result = await action();
      if (successText) {
        setStatusText(successText);
      } else {
        setStatusText('');
      }
      return result;
    } catch (error: any) {
      setIsError(true);
      setStatusText(`Error: ${error.message || String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, statusText, isError, runAction };
}
