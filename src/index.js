import { RouterURL } from './url.js'
import { Router } from './router.js'

export function isActivePath (targetPath, currentPath) {
  if (targetPath === '/') {
    return currentPath === '/'
  }

  return currentPath === targetPath || currentPath.startsWith(targetPath + '/')
}

export function shouldHandleLinkClick (event, el, origin = location.origin) {
  let href

  try {
    href = new URL(el.href, origin)
  } catch {
    return false
  }

  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey ||
    (el.target && el.target !== '_self') ||
    el.hasAttribute('download') ||
    href.origin !== origin
  )
}

export function getTemplateRenderMode ({ hasInlineTemplate, templateUrl, hasCachedTemplate, preloadFailed }) {
  if (!templateUrl) {
    return hasInlineTemplate ? 'inline' : 'missing'
  }

  if (hasCachedTemplate) {
    return 'external'
  }

  if (preloadFailed && hasInlineTemplate) {
    return 'inline'
  }

  return 'load'
}

export function getRouteTemplateRoot (el, expression, reportError = console.error) {
  const root = el.content.firstElementChild

  if (!root) {
    return null
  }

  if (root.nextElementSibling) {
    reportError(`Route '${expression}' must render exactly one root element`)
    return null
  }

  return root
}

export default function (Alpine) {
  const router = new Router()
  let loadingCount = 0

  const state = Alpine.reactive({
    mode: 'web',
    base: '',
    href: location.href,
    path: '',
    query: {},
    params: {},
    loading: false
  })

  const route = {
    get path () {
      return state.path
    },
    get query () {
      return state.query
    },
    get params () {
      return state.params || {}
    },
    get loading () {
      return state.loading
    },
    config (config = {}) {
      if (config.mode !== 'hash' && config.base && config.base.endsWith('/')) config.base = config.base.slice(0, -1)
      state.mode = config.mode ?? 'web'
      state.base = config.base ?? ''
    },
    push (...args) {
      return push(...args)
    },
    replace (...args) {
      return replace(...args)
    },

    resolve (query = {}) {
      return getTargetURL(state.href).resolve(state.path, query).url
    },

    is (...paths) {
      return router.is(getTargetURL(state.href), ...paths)
    },
    not (...paths) {
      return router.not(getTargetURL(state.href), ...paths)
    },
    get notfound () {
      return router.notfound(getTargetURL(state.href))
    }
  }

  Alpine.$router = route
  Alpine.magic('router', () => route)

  function getTargetURL (href) {
    return new RouterURL(href, { mode: state.mode, base: state.base })
  }

  function parse () {
    const url = getTargetURL(state.href)
    state.path = url.path
    state.query = url.query
    state.params = router.match(url)
  }

  Alpine.effect(() => parse())

  Alpine.nextTick(() => {
    if (state.mode === 'web' && !state.base) parse()
  })
  window.addEventListener('popstate', () => state.href = location.href)

  function push (path, options = {}) {
    if (!path.startsWith(location.origin)) {
      if (state.mode === 'hash') {
        path = location.origin + (state.base || '/') + '#' + path
      } else {
        path = location.origin + state.base + path
      }
    }
    if (location.href !== path) {
      history[options.replace ? 'replaceState' : 'pushState']({}, '', path)
      state.href = path
    }
  }

  function replace (path) {
    push(path, { replace: true })
  }

  function trackLoading (promise) {
    loadingCount += 1
    state.loading = true

    return promise.finally(() => {
      loadingCount = Math.max(loadingCount - 1, 0)
      state.loading = loadingCount > 0
    })
  }

  function reportTemplateError (route, tpl, error) {
    console.error(`Failed to load template '${tpl}' for route '${route}'`, error)
  }

  const templateCaches = {}
  const inLoadProgress = {}
  const inMakeProgress = new WeakSet()

  Alpine.directive('route', (el, { modifiers, expression }, { effect, cleanup }) => {
    if (!modifiers.includes('notfound')) {
      router.add(expression)
    }

    const load = url => {
      const render = html => {
        el.innerHTML = html
        return html
      }

      if (inLoadProgress[url]) {
        return inLoadProgress[url].then(render)
      }

      inLoadProgress[url] = fetch(url)
        .then(r => {
          if (!r.ok) {
            throw new Error(`Failed to fetch template: ${r.status} ${r.statusText}`)
          }
          return r.text()
        })
        .then(html => {
          templateCaches[url] = html
          return html
        })
        .finally(() => delete inLoadProgress[url])

      return inLoadProgress[url].then(render)
    }

    const tpl = RouterURL.resolveTemplatePath(
      location.pathname,
      el.getAttribute('template') ?? el.getAttribute('template.preload')
    )

    let loading
    let preloadFailed = false
    if (el.hasAttribute('template.preload')) {
      loading = trackLoading(load(tpl))
        .then(() => true)
        .catch(error => {
          preloadFailed = true
          reportTemplateError(expression, tpl, error)
          return false
        })
        .finally(() => { loading = false })
    }

    function show () {
      if (el._x_currentIfEl) return el._x_currentIfEl

      const make = () => {
        if (inMakeProgress.has(el)) return

        const root = getRouteTemplateRoot(el, expression)
        if (!root) {
          return
        }

        inMakeProgress.add(el)

        const clone = root.cloneNode(true)

        Alpine.addScopeToNode(clone, {}, el)

        Alpine.mutateDom(() => {
          el.after(clone)
          Alpine.initTree(clone)
        })

        el._x_currentIfEl = clone

        el._x_undoIf = () => {
          clone.remove()

          delete el._x_currentIfEl
        }

        Alpine.nextTick(() => inMakeProgress.delete(el))
      }

      const renderInline = () => {
        if (el.content.firstElementChild) {
          make()
          return true
        }
        return false
      }

      const mode = getTemplateRenderMode({
        hasInlineTemplate: Boolean(el.content.firstElementChild),
        templateUrl: tpl,
        hasCachedTemplate: Boolean(tpl && templateCaches[tpl]),
        preloadFailed
      })

      if (mode === 'inline') {
        renderInline()
      } else if (mode === 'external') {
        if (templateCaches[tpl]) {
          el.innerHTML = templateCaches[tpl]
          make()
        }
      } else if (mode === 'load') {
        if (loading) {
          loading.then(loaded => loaded ? make() : renderInline())
        } else {
          trackLoading(load(tpl))
            .then(() => make())
            .catch(error => {
              reportTemplateError(expression, tpl, error)
              if (!renderInline()) {
                console.error(`Template for '${expression}' is missing`)
              }
            })
        }
      } else {
        console.error(`Template for '${expression}' is missing`)
      }
    }

    function hide () {
      if (el._x_undoIf) {
        el._x_undoIf()
        delete el._x_undoIf
      }
    }

    Alpine.nextTick(() => {
      effect(() => {
        const target = getTargetURL(state.href)
        const found = modifiers.includes('notfound') ? router.notfound(target) : router.is(target, expression)
        found ? show() : hide()
      })
    })

    cleanup(() => el._x_undoIf && el._x_undoIf())
  })

  Alpine.directive('link', (el, { modifiers, expression }, { evaluate, effect, cleanup }) => {
    const url = getTargetURL(el.href)
    el.href = url.resolve(url.path, url.query, true).url

    function go (e) {
      if (!shouldHandleLinkClick(e, el, location.origin)) {
        return
      }

      e.preventDefault()
      push(el.href, { replace: modifiers.includes('replace') })
    }
    el.addEventListener('click', go)

    if (modifiers.includes('activity')) {
      const classes = expression ? evaluate(expression) : {}
      classes.active ??= 'active'
      classes.exactActive ??= 'exact-active'

      effect(() => {
        const [l, r] = [getTargetURL(el.href), getTargetURL(state.href)]

        el.classList.toggle(classes.active, isActivePath(l.path, r.path))
        el.classList.toggle(classes.exactActive, l.path === r.path)
      })
    }

    cleanup(() => {
      el.removeEventListener('click', go)
    })
  })
}
