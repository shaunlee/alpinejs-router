export default function (Alpine) {
  const state = Alpine.reactive({
    mode: 'web',
    base: '',
    href: location.href,
    path: '',
    query: {},
    loading: false
  })

  const route = Alpine.reactive({
    patterns: {},
    pathParams: {}
  })

  const router = {
    get path () {
      return state.path
    },
    get query () {
      return state.query
    },
    get params () {
      return route.pathParams[state.path] ?? {}
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
      let r = new URL(state.href).search
      return state.base + (state.mode === 'hash' ? '#' : '') + state.path + '?' + new URLSearchParams({
        ...Object.fromEntries(new URLSearchParams(r || '').entries()),
        ...query
      }).toString()
    },

    is (...paths) {
      const url = new URL(state.href)
      const [pathname,] = (state.mode === 'hash')
        ? url.hash.slice(1).split('?')
        : [url.pathname.replace(state.base, ''),]

      for (const path of paths) {
        if (path === 'notfound') {
          return Object.entries(route.patterns).findIndex(e => e[1] instanceof RegExp ? pathname.match(e[1]) : pathname === e[1]) === -1
        }
        const pattern = route.patterns[path]
        if (pattern === undefined) continue

        if (pattern instanceof RegExp && pattern.test(pathname)) {
          return true
        }
        if (pattern === pathname) {
          return true
        }
      }

      return false
    }
  }

  Alpine.magic('router', () => router)

  Alpine.effect(() => {
    state.query = (state.href.indexOf('?') > -1)
      ? Object.fromEntries(new URLSearchParams(state.href.split('?').pop()).entries())
      : {}
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

  function buildPattern (path) {
    const pattern = path.split('/').map(e => {
      if (e.startsWith(':')) {
        let field = e.substr(1)
        let fieldPattern = '[^/]+'
        const ef = field.match(/\((.+?)\)/)
        if (ef) {
          field = field.substr(0, field.indexOf('('))
          fieldPattern = ef[1]
        }
        return `(?<${field}>${fieldPattern})`
      }
      return e
    }).join('/')
    return pattern.indexOf('(?') > -1 ? new RegExp(`^${pattern}$`) : pattern
  }

  const templateCaches = {}
  const inLoadProgress = {}
  const inMakeProgress = new Set()

  Alpine.directive('route', (el, { modifiers, expression }, { effect, cleanup }) => {
    if (!modifiers.includes('notfound')) {
      route.patterns = { ...route.patterns, [expression]: buildPattern(expression) }
    }

    const load = url => {
      if (inLoadProgress[url]) {
        inLoadProgress[url].then(html => el.innerHTML = html)
      } else {
        inLoadProgress[url] = fetch(url).then(r => r.text()).then(html => {
          templateCaches[url] = html
          el.innerHTML = html
          return html
        })
      }
      return inLoadProgress[url]
    }

    let loading
    if (el.hasAttribute('template.preload')) {
      const url = el.getAttribute('template.preload')
      loading = load(url).finally(() => loading = false)
    }

    function show () {
      if (el._x_currentIfEl) return el._x_currentIfEl

      const make = () => {
        if (inMakeProgress.has(expression)) return
        inMakeProgress.add(expression)

        const clone = el.content.cloneNode(true).firstElementChild

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

        Alpine.nextTick(() => inMakeProgress.delete(expression))
      }

      if (el.content.firstElementChild) {
        make()
      } else if (el.hasAttribute('template') || el.hasAttribute('template.preload')) {
        const url = el.getAttribute('template') || el.getAttribute('template.preload')
        if (templateCaches[url]) {
          el.innerHTML = templateCaches[url]
          make()
        } else {
          if (loading) {
            loading.then(() => make())
          } else {
            state.loading = true
            load(url).then(() => make()).finally(() => state.loading = false)
          }
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

    effect(() => {
      const url = new URL(state.href)
      const [pathname, search] = (state.mode === 'hash')
        ? url.hash.slice(1).split('?')
        : [url.pathname.replace(state.base, ''), url.search]

      if (modifiers.includes('notfound')) {
        // console.time('404')
        Object.entries(route.patterns).findIndex(e => e[1] instanceof RegExp ? pathname.match(e[1]) : pathname === e[1]) > -1
          ? hide()
          : show()
        // console.timeEnd('404')
        return
      }

      // console.time('route')
      const pattern = route.patterns[expression]
      if (pattern instanceof RegExp) {
        const m = pathname.match(pattern)
        if (m) {
          state.path = pathname
          route.pathParams = { ...route.pathParams, [pathname]: { ...m.groups } }
          show()
        } else {
          hide()
        }
      } else if (pattern === pathname) {
        state.path = pathname
        show()
      } else {
        hide()
      }
      // console.timeEnd('route')
    })

    cleanup(() => el._x_undoIf && el._x_undoIf())
  })

  Alpine.directive('link', (el, { modifiers, expression }, { evaluate, effect, cleanup }) => {
    const url = new URL(el.href)
    let expected
    if (state.mode === 'hash') {
      expected = url.origin + state.base + (url.hash || ('#' + url.pathname.replace(state.base, '') + url.search))
    } else {
      expected = url.origin + (url.pathname.startsWith(state.base) ? url.pathname : state.base + url.pathname) + url.search
    }
    if (expected !== url.href) el.href = expected

    function go (e) {
      e.preventDefault()
      push(el.href, { replace: modifiers.includes('replace') })
    }
    el.addEventListener('click', go)

    if (modifiers.includes('activity')) {
      const classes = expression ? evaluate(expression) : {}
      classes.active ??= 'active'
      classes.exactActive ??= 'exact-active'

      effect(() => {
        const [elUrl, stateUrl] = [new URL(el.href), new URL(state.href)]
        const [l, r] = (state.mode === 'hash')
          ? [elUrl.hash.slice(1).split('?').shift(), stateUrl.hash.slice(1).split('?').shift()]
          : [elUrl.pathname, stateUrl.pathname]

        el.classList.toggle(classes.active, l !== (state.mode !== 'hash' ? state.base : '') + '/' && r.startsWith(l))
        el.classList.toggle(classes.exactActive, l === r)
      })
    }

    cleanup(() => {
      el.removeEventListener('click', go)
    })
  })
}
