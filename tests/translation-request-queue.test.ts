import assert from "node:assert/strict"
import test from "node:test"
import {
  QueueOverflowError,
  TranslationRequestQueue,
  type QueueEvent
} from "../lib/translation-request-queue"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test("queue dedupes inflight requests with same key", async () => {
  const queue = new TranslationRequestQueue<string>()
  let calls = 0
  const executor = async () => {
    calls += 1
    await delay(20)
    return "ok"
  }

  const p1 = queue.run("word|zh", executor)
  const p2 = queue.run("word|zh", executor)
  const [v1, v2] = await Promise.all([p1, p2])

  assert.equal(v1, "ok")
  assert.equal(v2, "ok")
  assert.equal(calls, 1)
})

test("queue serves cached value before TTL expires", async () => {
  const queue = new TranslationRequestQueue<string>({ ttlMs: 1_000 })
  let calls = 0
  const executor = async () => {
    calls += 1
    return "cached-value"
  }

  const first = await queue.run("same|key", executor)
  const second = await queue.run("same|key", executor)

  assert.equal(first, "cached-value")
  assert.equal(second, "cached-value")
  assert.equal(calls, 1)
})

test("queue expires cached value after TTL", async () => {
  const queue = new TranslationRequestQueue<string>({ ttlMs: 10 })
  let calls = 0
  const executor = async () => {
    calls += 1
    return `value-${calls}`
  }

  const first = await queue.run("expire|key", executor)
  await delay(30)
  const second = await queue.run("expire|key", executor)

  assert.equal(first, "value-1")
  assert.equal(second, "value-2")
  assert.equal(calls, 2)
})

test("queue evicts least-recently-used cache entry when maxEntries is exceeded", async () => {
  const queue = new TranslationRequestQueue<string>({ maxEntries: 2, ttlMs: 10_000 })
  const calls = new Map<string, number>()
  const makeExecutor = (key: string) => async () => {
    const next = (calls.get(key) ?? 0) + 1
    calls.set(key, next)
    return `${key}-${next}`
  }

  await queue.run("a", makeExecutor("a"))
  await queue.run("b", makeExecutor("b"))
  await queue.run("a", makeExecutor("a")) // touch a to keep it hot
  await queue.run("c", makeExecutor("c")) // should evict b
  await queue.run("b", makeExecutor("b")) // re-run because b was evicted

  assert.equal(calls.get("a"), 1)
  assert.equal(calls.get("b"), 2)
  assert.equal(calls.get("c"), 1)
})

test("queue drops oldest pending request when queue capacity is exceeded", async () => {
  const events: QueueEvent[] = []
  const queue = new TranslationRequestQueue<string>({
    concurrency: 1,
    maxQueue: 1,
    onEvent: (event) => events.push(event)
  })

  let releaseFirst: (() => void) | null = null
  const first = queue.run("k1", async () => {
    await new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    return "first"
  })

  const dropped = queue.run("k2", async () => "second")
  const third = queue.run("k3", async () => "third")

  const droppedResult = await dropped.then(
    () => "resolved",
    (error) => error
  )
  assert.ok(droppedResult instanceof QueueOverflowError)
  assert.equal(droppedResult.code, "QUEUE_OVERFLOW")

  releaseFirst?.()
  const [firstValue, thirdValue] = await Promise.all([first, third])
  assert.equal(firstValue, "first")
  assert.equal(thirdValue, "third")

  const dropEvent = events.find((event) => event.type === "queue_drop_oldest")
  assert.ok(dropEvent)
  if (dropEvent && dropEvent.type === "queue_drop_oldest") {
    assert.equal(dropEvent.droppedKey, "k2")
    assert.equal(dropEvent.key, "k3")
  }
})

test("queue does not cache failure-shaped results when shouldCacheValue rejects them", async () => {
  const queue = new TranslationRequestQueue<{ ok: boolean; value: string }>({
    shouldCacheValue: (result) => result.ok
  })
  let calls = 0
  const executor = async () => {
    calls += 1
    return { ok: false, value: "failed" }
  }

  const first = await queue.run("failure-key", executor)
  const second = await queue.run("failure-key", executor)

  assert.equal(first.ok, false)
  assert.equal(second.ok, false)
  assert.equal(calls, 2)
})

test("queue runs independent keys in parallel when concurrency is greater than one", async () => {
  const queue = new TranslationRequestQueue<string>({ concurrency: 2 })
  const started: string[] = []
  let release: (() => void) | null = null
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  const runTask = (key: string) =>
    queue.run(key, async () => {
      started.push(key)
      await gate
      return `${key}-done`
    })

  const p1 = runTask("model-a")
  const p2 = runTask("model-b")

  await delay(10)
  assert.deepEqual(started.sort(), ["model-a", "model-b"])

  release?.()
  const [r1, r2] = await Promise.all([p1, p2])
  assert.equal(r1, "model-a-done")
  assert.equal(r2, "model-b-done")
})
