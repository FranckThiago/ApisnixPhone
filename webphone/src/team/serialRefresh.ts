type Refresh = (fetchOnce: () => Promise<void>, isActive: () => boolean) => Promise<void>;

/**
 * One request at a time. A refresh asked during another one (an action just saved,
 * a new access) runs right after it with the latest loader, and its caller waits for
 * that fresh result.
 */
export function createSerialRefresh(): Refresh {
  let running: Promise<void> | null = null;
  let again = false;
  let latest: Parameters<Refresh> | null = null;
  return (fetchOnce, isActive) => {
    latest = [fetchOnce, isActive];
    if (!isActive()) return Promise.resolve();
    if (running) { again = true; return running; }
    const loop = async () => {
      do { again = false; await latest![0](); } while (again && latest![1]());
    };
    running = loop().finally(() => { running = null; });
    return running;
  };
}
