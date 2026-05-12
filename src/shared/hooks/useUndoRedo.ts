import { useState, useCallback } from 'react';

export function useUndoRedo<T>(
  initialState: T,
  isEqual: (a: T, b: T) => boolean = (a, b) => a === b
) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialState);
  const [future, setFuture] = useState<T[]>([]);

  const set = useCallback(
    (newState: T) => {
      if (isEqual(present, newState)) return;
      setPast((prevPast) => [...prevPast, present]);
      setPresent(newState);
      setFuture([]);
    },
    [present, isEqual]
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setPast(newPast);
    setFuture((prevFuture) => [present, ...prevFuture]);
    setPresent(previous);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setFuture(newFuture);
    setPast((prevPast) => [...prevPast, present]);
    setPresent(next);
  }, [future, present]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  return { state: present, set, undo, redo, canUndo, canRedo };
}
