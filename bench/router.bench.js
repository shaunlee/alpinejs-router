import { performance } from 'node:perf_hooks'
import { Router } from '../src/router.js'
import { RouterURL } from '../src/url.js'

const ROUTE_COUNTS = [10, 100, 1000]
const WARMUP_MS = 75
const SAMPLE_MS = 250
const SAMPLES = 5

function makeRouter (count) {
  const router = new Router()

  for (let i = 0; i < count; i += 1) {
    router.add(`/static-${i}`)
    router.add(`/users/${i}/settings`)
    router.add(`/teams/${i}/projects/:projectId`)
    router.add(`/dynamic-${i}/:id`)
  }

  return router
}

function timeFor (fn, durationMs) {
  const end = performance.now() + durationMs
  let iterations = 0

  while (performance.now() < end) {
    fn()
    iterations += 1
  }

  return iterations
}

function sample (name, fn) {
  timeFor(fn, WARMUP_MS)

  const results = []
  for (let i = 0; i < SAMPLES; i += 1) {
    const startedAt = performance.now()
    const iterations = timeFor(fn, SAMPLE_MS)
    const elapsed = performance.now() - startedAt
    results.push(iterations / elapsed * 1000)
  }

  results.sort((a, b) => a - b)
  const median = results[Math.floor(results.length / 2)]
  const hz = Math.round(median)
  const microseconds = 1000000 / median

  return {
    name,
    hz,
    microseconds: microseconds.toFixed(3)
  }
}

function report (count, benchmarks) {
  console.log(`\nRoutes per type: ${count} (${count * 4} total)`)
  console.log('case'.padEnd(24) + 'ops/sec'.padStart(14) + 'us/op'.padStart(12))
  console.log('-'.repeat(50))

  for (const result of benchmarks) {
    console.log(
      result.name.padEnd(24) +
      result.hz.toLocaleString().padStart(14) +
      result.microseconds.padStart(12)
    )
  }
}

function runLookupBenchmarks (count) {
  const router = makeRouter(count)
  const staticUrl = new RouterURL('http://localhost/static-0')
  const dynamicFirstUrl = new RouterURL('http://localhost/dynamic-0/abc')
  const dynamicLastUrl = new RouterURL(`http://localhost/dynamic-${count - 1}/abc`)
  const missUrl = new RouterURL('http://localhost/missing/abc')

  report(count, [
    sample('match static', () => router.match(staticUrl)),
    sample('match dynamic first', () => router.match(dynamicFirstUrl)),
    sample('match dynamic last', () => router.match(dynamicLastUrl)),
    sample('match miss', () => router.match(missUrl)),
    sample('is cached dynamic', () => router.is(dynamicLastUrl, `/dynamic-${count - 1}/:id`)),
    sample('notfound miss', () => router.notfound(missUrl))
  ])
}

function runBuildBenchmark (count) {
  const result = sample(`build ${count * 4} routes`, () => makeRouter(count))

  report(count, [result])
}

for (const count of ROUTE_COUNTS) {
  runLookupBenchmarks(count)
}

for (const count of ROUTE_COUNTS) {
  runBuildBenchmark(count)
}
