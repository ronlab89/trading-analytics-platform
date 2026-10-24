/** A repeating task that can be stopped. */
export interface ScheduledTask {
  stop: () => void;
}

/**
 * How the simulator asks for a repeating call, so tests drive the ticks by hand
 * and wait for each one instead of waiting for real seconds. The task never
 * rejects.
 */
export interface Scheduler {
  every: (intervalMs: number, task: () => Promise<void>) => ScheduledTask;
}

/** The scheduler of the process: a timer that fires `task` every `intervalMs`. */
export const intervalScheduler: Scheduler = {
  every(intervalMs, task) {
    const handle = setInterval(() => {
      void task();
    }, intervalMs);
    return {
      stop: () => {
        clearInterval(handle);
      },
    };
  },
};
