/**
 * At most `max` tasks run at once; the rest wait in FIFO order. In-process,
 * like lib/rate-limit.ts — the app runs as one container on the VPS.
 */
export function createLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];

  const acquire = (): Promise<void> => {
    if (active < max) {
      active++;
      return Promise.resolve();
    }
    // The releasing task hands its slot straight to the next waiter, so
    // `active` never dips below max while anyone is queued.
    return new Promise<void>((resolve) => waiting.push(resolve));
  };

  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };
}
