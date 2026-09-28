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

  test('$router.resolve does not leak query params into later resolutions', async () => {
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    harness.Alpine.$router.push('/users')
    await harness.flush()

    expect(harness.Alpine.$router.resolve({ page: '2' })).toContain('page=2')
    expect(harness.Alpine.$router.resolve({})).not.toContain('page=2')
    expect(harness.Alpine.$router.path).toBe('/users')
    expect(harness.Alpine.$router.is('/users')).toBe(true)
  })

  test('config changes are reflected immediately in route state', async () => {
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    expect(harness.Alpine.$router.path).toBe('/examples/')

    harness.Alpine.$router.config({ base: '/examples' })
    await harness.flush()

    expect(harness.Alpine.$router.path).toBe('/')
    expect(harness.Alpine.$router.is('/')).toBe(true)
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

  test('$router.push rejects a lookalike cross-origin URL', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    harness.Alpine.$router.push('/users')
    await harness.flush()

    const before = window.location.href
    const pushState = jest.spyOn(window.history, 'pushState')

    expect(() => harness.Alpine.$router.push('http://localhost.evil.io/steal')).not.toThrow()

    expect(consoleError).toHaveBeenCalledWith("Cannot push cross-origin URL 'http://localhost.evil.io/steal'")
    expect(pushState).not.toHaveBeenCalled()
    expect(window.location.href).toBe(before)
    expect(harness.Alpine.$router.path).toBe('/users')
  })

  test('$router.push accepts a genuinely same-origin absolute URL', async () => {
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    harness.Alpine.$router.push('http://localhost/absolute?page=2')
    await harness.flush()

    expect(window.location.href).toBe('http://localhost/absolute?page=2')
    expect(harness.Alpine.$router.path).toBe('/absolute')
    expect(harness.Alpine.$router.query).toEqual({ page: '2' })
  })

  test('$router.push composes relative paths with base in web mode', async () => {
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    harness.Alpine.$router.config({ mode: 'web', base: '/app/' })
    harness.Alpine.$router.push('/users')
    await harness.flush()

    expect(window.location.href).toBe('http://localhost/app/users')
    expect(harness.Alpine.$router.path).toBe('/users')
  })

  test('$router.push composes relative paths in hash mode with and without base', async () => {
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    harness.Alpine.$router.config({ mode: 'hash', base: '/app' })
    harness.Alpine.$router.push('/users')
    await harness.flush()

    expect(window.location.href).toBe('http://localhost/app#/users')
    expect(harness.Alpine.$router.path).toBe('/users')

    harness.Alpine.$router.config({ mode: 'hash' })
    harness.Alpine.$router.push('/posts')
    await harness.flush()

    expect(window.location.href).toBe('http://localhost/#/posts')
    expect(harness.Alpine.$router.path).toBe('/posts')
  })

  test('hashchange updates router state in hash mode', async () => {
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    harness.Alpine.$router.config({ mode: 'hash', base: '/app' })
    window.history.replaceState({}, '', 'http://localhost/app#/old')
    window.dispatchEvent(new window.Event('hashchange'))
    await harness.flush()

    expect(harness.Alpine.$router.path).toBe('/old')

    window.location.hash = '#/new'
    window.dispatchEvent(new window.Event('hashchange'))
    await harness.flush()

    expect(harness.Alpine.$router.path).toBe('/new')
  })

  test('template.preload names colliding with Object.prototype load normally', async () => {
    global.fetch.mockImplementation(() => Promise.resolve(createFetchResponse('<div>Fetched</div>')))

    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    const template = document.createElement('template')
    template.setAttribute('template.preload', 'toString')
    document.body.appendChild(template)

    expect(() => mountDirective(harness, 'route', template, { modifiers: [], expression: '/users' })).not.toThrow()
    await settle(harness)

    expect(global.fetch).toHaveBeenCalledWith('toString')
  })

  test('template names colliding with Object.prototype are not falsely cached', async () => {
    global.fetch.mockImplementation(() => Promise.resolve(createFetchResponse('<div>Fetched</div>')))

    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    const template = document.createElement('template')
    template.setAttribute('template', 'toString')
    document.body.appendChild(template)

    mountDirective(harness, 'route', template, { modifiers: [], expression: '/plain' })
    await settle(harness)

    harness.Alpine.$router.push('/plain')
    await settle(harness)

    expect(global.fetch).toHaveBeenCalledWith('toString')
  })

  test('an external template resolving to an empty body is fetched only once', async () => {
    global.fetch.mockImplementation(() => Promise.resolve(createFetchResponse('')))

    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    const template = document.createElement('template')
    template.setAttribute('template', '/examples/empty.html')
    document.body.appendChild(template)

    mountDirective(harness, 'route', template, { modifiers: [], expression: '/empty' })
    await settle(harness)

    harness.Alpine.$router.push('/empty')
    await settle(harness)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    harness.Alpine.$router.push('/other')
    await settle(harness)
    harness.Alpine.$router.push('/empty')
    await settle(harness)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith('/examples/empty.html')
  })

  test('config does not mutate the caller-supplied object', async () => {
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    const config = { mode: 'web', base: '/app/' }
    harness.Alpine.$router.config(config)
    await harness.flush()

    expect(config.base).toBe('/app/')

    harness.Alpine.$router.push('/users')
    await harness.flush()
    expect(window.location.href).toBe('http://localhost/app/users')

    const frozen = Object.freeze({ mode: 'web', base: '/frozen/' })
    expect(() => harness.Alpine.$router.config(frozen)).not.toThrow()
    await harness.flush()

    harness.Alpine.$router.push('/users')
    await harness.flush()
    expect(window.location.href).toBe('http://localhost/frozen/users')
  })

  test('x-route with an invalid expression logs an error and never matches', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    const invalid = document.createElement('template')
    invalid.innerHTML = '<div>Invalid</div>'
    document.body.appendChild(invalid)

    expect(() => mountDirective(harness, 'route', invalid, {
      modifiers: [],
      expression: '/users/:user-id'
    })).not.toThrow()
    await harness.flush()

    expect(consoleError).toHaveBeenCalledWith("Invalid route parameter name ':user-id' in route '/users/:user-id'")

    harness.Alpine.$router.push('/users/123')
    await harness.flush()

    expect(invalid._x_currentIfEl).toBeUndefined()
    expect(document.body.textContent).not.toContain('Invalid')
  })

  test('a valid x-route keeps working alongside an invalid one', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const harness = createAlpineHarness()
    registerRouterPlugin(harness.Alpine)
    await harness.flush()

    const invalid = document.createElement('template')
    invalid.innerHTML = '<div>Invalid</div>'
    const valid = document.createElement('template')
    valid.innerHTML = '<div>Valid</div>'
    document.body.append(invalid, valid)

    mountDirective(harness, 'route', invalid, { modifiers: [], expression: '/users/:user-id' })
    mountDirective(harness, 'route', valid, { modifiers: [], expression: '/users/:id' })
    await harness.flush()

    expect(valid._x_currentIfEl).toBeUndefined()

    harness.Alpine.$router.push('/users/123')
    await harness.flush()

    expect(valid._x_currentIfEl).toBeDefined()
    expect(document.body.textContent).toContain('Valid')
    expect(document.body.textContent).not.toContain('Invalid')
    expect(invalid._x_currentIfEl).toBeUndefined()

    harness.Alpine.$router.push('/other')
    await harness.flush()

    expect(valid._x_currentIfEl).toBeUndefined()
    expect(document.body.textContent).not.toContain('Valid')
  })
})
