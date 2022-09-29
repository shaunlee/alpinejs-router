export default function (Alpine) {
  const state = Alpine.reactive({
    mode: 'web',
    base: '',
    href: location.href,
    path: '',
    query: {},
    pathParams: {},
    loading: false
  })

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

  Alpine.store('router', {
    init () {
      Alpine.effect(() => {
        state.query = (state.href.indexOf('?') > -1)
          ? Object.fromEntries(new URLSearchParams(state.href.split('?').pop()).entries())
          : {}
      })

      window.addEventListener('popstate', () => state.href = location.href)
    },

    get path () {
      return state.path
    },
    get query () {
      return state.query
    },
    get params () {
      return state.pathParams[state.path] ?? {}
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
    }
  })

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

  const routePatterns = {}
  const templateCaches = {}

  Alpine.directive('route', (el, { modifiers, expression }, { effect, cleanup }) => {
    if (!modifiers.includes('notfound')) {
      routePatterns[expression] = buildPattern(expression)
    }

    function show () {
      if (el._x_currentIfEl) return el._x_currentIfEl

      const make = () => {
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
      }

      if (el.content.firstElementChild) {
        make()
      } else if (el.hasAttribute('template')) {
        const url = el.getAttribute('template')
        if (templateCaches[url]) {
          el.innerHTML = templateCaches[url]
          make()
        } else {
          state.loading = true
          fetch(url).then(r => r.text()).then(html => {
            templateCaches[url] = html
            el.innerHTML = html
            make()
          }).finally(() => state.loading = false)
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

      let [pathname, search] = (state.mode === 'hash')
        ? url.hash.slice(1).split('?')
        : [url.pathname.replace(state.base, ''), url.search]

      if (modifiers.includes('notfound')) {
        // console.time('404')
        Object.entries(routePatterns).find(e => e[1] instanceof RegExp ? pathname.match(e[1]) : pathname === e[1])
          ? hide()
          : show()
        // console.timeEnd('404')
        return
      }

      // console.time('route')
      const pattern = routePatterns[expression]
      if (pattern instanceof RegExp) {
        const m = pathname.match(pattern)
        if (m) {
          state.path = pathname
          state.pathParams = { ...state.pathParams, [pathname]: { ...m.groups } }
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

        if (l !== (state.mode !== 'hash' ? state.base : '') + '/' && r.startsWith(l)) {
          el.classList.add(classes.active)
        } else {
          el.classList.remove(classes.active)
        }
        if (l === r) {
          el.classList.add(classes.exactActive)
        } else {
          el.classList.remove(classes.exactActive)
        }
      })
    }

    cleanup(() => {
      el.removeEventListener('click', go)
    })
  })
}
