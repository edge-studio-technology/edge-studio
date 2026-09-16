import { env } from "../config/env.js";

export class EgressQueueFullError extends Error {
  constructor(queueLimit: number) {
    super(`Outbound request queue is full (limit ${queueLimit}); try again shortly`);
    this.name = "EgressQueueFullError";
  }
}

type Waiter = () => void;

/**
 * One global semaphore over every outbound request to an operator-supplied URL. The queue is
 * bounded: past its length new callers are rejected immediately rather than accumulating an
 * unbounded backlog of pending workflow runs, which is the failure the queue exists to prevent.
 */
class EgressLimiter {
  private active = 0;
  private readonly waiting: Waiter[] = [];

  constructor(private readonly maxConcurrent: number, private readonly queueLimit: number) {}

  get stats() {
    return { active: this.active, queued: this.waiting.length };
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire() {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }

    if (this.waiting.length >= this.queueLimit) return Promise.reject(new EgressQueueFullError(this.queueLimit));

    return new Promise<void>((resolve) => {
      this.waiting.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release() {
    this.active -= 1;
    this.waiting.shift()?.();
  }
}

export const egressLimiter = new EgressLimiter(env.egressMaxConcurrent, env.egressQueueLimit);
