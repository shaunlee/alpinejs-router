/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"http://localhost/examples/"}
 */

import { jest } from '@jest/globals'
import registerRouterPlugin from '../src/index.js'

function stableEqual (left, right) {
  if (Object.is(left, right)) {
    return true
  }

  if (
    left &&
    right &&
    typeof left === 'object' &&
    typeof right === 'object'
  ) {
    return JSON.stringify(left) === JSON.stringify(right)
  }

  return false
}

function createAlpineHarness () {
  const directives = {}
  const effects = []
  let dirty = false

  const Alpine = {
    reactive (state) {
      return new Proxy(state, {
        get (target, key) {
          return target[key]
        },
        set (target, key, value) {
          const changed = !stableEqual(target[key], value)
          target[key] = value
          dirty ||= changed
          return true
        }
      })
    },
    effect (fn) {
      effects.push(fn)
      dirty = true
    },
    nextTick (fn) {
      fn()
    },
    directive (name, fn) {
      directives[name] = fn
    },
    magic: jest.fn(),
    addScopeToNode: jest.fn(),
    mutateDom (fn) {
      fn()
    },
    initTree: jest.fn(),
    data: jest.fn()
  }

  async function flush (limit = 20) {
    for (let i = 0; i < limit; i += 1) {
      if (!dirty) {
        await Promise.resolve()
        if (!dirty) {
          return
        }
      }

      dirty = false
      for (const effect of effects) {
        effect()
      }
      await Promise.resolve()
    }

    throw new Error('Reactive effects did not settle')
  }

  return { Alpine, directives, flush }
}

function mountDirective (harness, name, el, binding = {}) {
  const cleanups = []

  harness.directives[name](el, binding, {
    evaluate: expression => expression,
    effect: fn => harness.Alpine.effect(fn),
    cleanup: fn => cleanups.push(fn)
  })

  return () => cleanups.forEach(fn => fn())
}

function createFetchResponse (html) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => html
  }
}

function deferred () {
  let resolve
  let reject

  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

async function settle (harness, cycles = 3) {
  for (let i = 0; i < cycles; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 0))
    await Promise.resolve()
  }
  await harness.flush()
}

describe('router plugin integration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    jest.restoreAllMocks()
    global.fetch = jest.fn()
    window.history.replaceState({}, '', 'http://localhost/examples/')
  })

  test('x-route falls back to inline content when template.preload fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    const template = document.createElement('template')
    template.setAttribute('template.preload', '/examples/users.html')
    template.innerHTML = '<div>Inline fallback</div>'
    document.body.appendChild(template)

    global.fetch.mockRejectedValueOnce(new Error('network error'))

    mountDirective(harness, 'route', template, { modifiers: [], expression: '/users' })
    await settle(harness)

    harness.Alpine.$router.push('/users')
    await harness.flush()

    expect(document.body.textContent).toContain('Inline fallback')
    expect(global.fetch).toHaveBeenCalledWith('/examples/users.html')
    expect(consoleError).toHaveBeenCalled()
  })

  test('x-link.replace uses history.replaceState', async () => {
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    const replaceState = jest.spyOn(window.history, 'replaceState')
    const pushState = jest.spyOn(window.history, 'pushState')
    const link = document.createElement('a')
    link.href = '/target'
    document.body.appendChild(link)

    mountDirective(harness, 'link', link, { modifiers: ['replace'] })
    await harness.flush()

    link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0, cancelable: true }))
    await harness.flush()

    expect(replaceState).toHaveBeenCalled()
    expect(pushState).not.toHaveBeenCalled()
  })

  test('$router.loading stays true until all template.preload requests settle', async () => {
    const requests = {
      '/examples/one.html': deferred(),
      '/examples/two.html': deferred()
    }

    global.fetch.mockImplementation(url => requests[url].promise)

    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    const first = document.createElement('template')
    first.setAttribute('template.preload', '/examples/one.html')
    const second = document.createElement('template')
    second.setAttribute('template.preload', '/examples/two.html')
    document.body.append(first, second)

    mountDirective(harness, 'route', first, { modifiers: [], expression: '/one' })
    mountDirective(harness, 'route', second, { modifiers: [], expression: '/two' })
    await harness.flush()

    expect(harness.Alpine.$router.loading).toBe(true)

    requests['/examples/one.html'].resolve(createFetchResponse('<div>One</div>'))
    await settle(harness)
    expect(harness.Alpine.$router.loading).toBe(true)

    requests['/examples/two.html'].resolve(createFetchResponse('<div>Two</div>'))
    await settle(harness)
    expect(harness.Alpine.$router.loading).toBe(false)
  })

  test('x-link.activity updates active classes from current route state', async () => {
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    const link = document.createElement('a')
    link.href = '/users'
    document.body.appendChild(link)

    mountDirective(harness, 'link', link, { modifiers: ['activity'] })
    await harness.flush()

    harness.Alpine.$router.push('/users/1')
    await harness.flush()
    expect(link.classList.contains('active')).toBe(true)
    expect(link.classList.contains('exact-active')).toBe(false)

    harness.Alpine.$router.push('/users2')
    await harness.flush()
    expect(link.classList.contains('active')).toBe(false)
  })

  test('x-route logs an error and does not render when inline template has multiple roots', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    const template = document.createElement('template')
    template.innerHTML = '<div>One</div><div>Two</div>'
    document.body.appendChild(template)

    mountDirective(harness, 'route', template, { modifiers: [], expression: '/bad' })
    await harness.flush()

    harness.Alpine.$router.push('/bad')
    await harness.flush()

    expect(document.body.textContent).not.toContain('One')
    expect(consoleError).toHaveBeenCalledWith("Route '/bad' must render exactly one root element")
  })
})
