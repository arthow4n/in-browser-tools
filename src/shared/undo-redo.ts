export class UndoRedoManager<T> {
  private past: T[] = [];
  private future: T[] = [];
  private current: T;
  private isEqual: (a: T, b: T) => boolean;

  constructor(
    initialState: T,
    isEqual: (a: T, b: T) => boolean = (a, b) => a === b,
  ) {
    this.current = initialState;
    this.isEqual = isEqual;
  }

  public save(state: T) {
    if (this.isEqual(this.current, state)) return;
    this.past.push(this.current);
    this.current = state;
    this.future = [];
  }

  public undo(): T | null {
    if (this.past.length === 0) return null;
    this.future.push(this.current);
    this.current = this.past.pop() as T;
    return this.current;
  }

  public redo(): T | null {
    if (this.future.length === 0) return null;
    this.past.push(this.current);
    this.current = this.future.pop() as T;
    return this.current;
  }

  public get canUndo() {
    return this.past.length > 0;
  }

  public get canRedo() {
    return this.future.length > 0;
  }

  public getCurrent() {
    return this.current;
  }
}
