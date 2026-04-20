export type QueueKey = string

export type QueueRunOptions = {
  ttlMs?: number
  priority?: "normal"
}

export type QueueEvent =
  | {
      type: "cache_hit"
      key: QueueKey
    }
  | {
      type: "inflight_hit"
      key: QueueKey
    }
  | {
      type: "queue_drop_oldest"
      key: QueueKey
      droppedKey: QueueKey
      maxQueue: number
    }

type QueueTask<T> = {
  key: QueueKey
  executor: () => Promise<T>
  options?: QueueRunOptions
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

export class QueueOverflowError extends Error {
  readonly code = "QUEUE_OVERFLOW"

  constructor(message: string) {
    super(message)
    this.name = "QueueOverflowError"
  }
}

type TranslationRequestQueueOptions = {
  ttlMs?: number
  maxEntries?: number
  maxQueue?: number
  concurrency?: number
  shouldCacheValue?: (value: T) => boolean
  onEvent?: (event: QueueEvent) => void
}

const DEFAULT_TTL_MS = 5 * 60_000
const DEFAULT_MAX_ENTRIES = 200
const DEFAULT_MAX_QUEUE = 50
const DEFAULT_CONCURRENCY = 1

export class TranslationRequestQueue<T> {
  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly maxQueue: number
  private readonly concurrency: number
  private readonly shouldCacheValue: (value: T) => boolean
  private readonly onEvent?: (event: QueueEvent) => void
  private readonly cache = new Map<QueueKey, CacheEntry<T>>()
  private readonly inFlight = new Map<QueueKey, Promise<T>>()
  private readonly pending: Array<QueueTask<T>> = []
  private activeCount = 0

  constructor(options: TranslationRequestQueueOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
    this.maxQueue = options.maxQueue ?? DEFAULT_MAX_QUEUE
    this.concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY)
    this.shouldCacheValue = options.shouldCacheValue ?? (() => true)
    this.onEvent = options.onEvent
  }

  run(key: QueueKey, executor: () => Promise<T>, options?: QueueRunOptions): Promise<T> {
    const cached = this.getFromCache(key)
    if (cached !== undefined) {
      this.onEvent?.({ type: "cache_hit", key })
      return Promise.resolve(cached)
    }

    const inFlight = this.inFlight.get(key)
    if (inFlight) {
      this.onEvent?.({ type: "inflight_hit", key })
      return inFlight
    }

    const queued = new Promise<T>((resolve, reject) => {
      if (this.pending.length >= this.maxQueue) {
        const dropped = this.pending.shift()
        if (dropped) {
          dropped.reject(
            new QueueOverflowError(
              `Queue capacity ${this.maxQueue} exceeded. Dropped oldest request: ${dropped.key}`
            )
          )
          this.onEvent?.({
            type: "queue_drop_oldest",
            key,
            droppedKey: dropped.key,
            maxQueue: this.maxQueue
          })
        }
      }

      this.pending.push({
        key,
        executor,
        options,
        resolve,
        reject
      })
      this.drain()
    })

    return queued
  }

  private drain() {
    while (this.activeCount < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift()
      if (!task) {
        return
      }

      const cached = this.getFromCache(task.key)
      if (cached !== undefined) {
        this.onEvent?.({ type: "cache_hit", key: task.key })
        task.resolve(cached)
        continue
      }

      const inFlight = this.inFlight.get(task.key)
      if (inFlight) {
        this.onEvent?.({ type: "inflight_hit", key: task.key })
        task.resolve(inFlight)
        continue
      }

      this.activeCount += 1
      const promise = task
        .executor()
        .then((value) => {
          if (this.shouldCacheValue(value)) {
            this.setCache(task.key, value, task.options?.ttlMs)
          }
          return value
        })
        .finally(() => {
          this.inFlight.delete(task.key)
          this.activeCount -= 1
          this.drain()
        })

      this.inFlight.set(task.key, promise)
      task.resolve(promise)
    }
  }

  private getFromCache(key: QueueKey): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) {
      return undefined
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key)
      return undefined
    }

    // LRU touch
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value
  }

  private setCache(key: QueueKey, value: T, ttlMs?: number) {
    const expiresAt = Date.now() + Math.max(0, ttlMs ?? this.ttlMs)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    this.cache.set(key, { value, expiresAt })

    while (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next().value
      if (!oldest) {
        break
      }
      this.cache.delete(oldest)
    }
  }
}
