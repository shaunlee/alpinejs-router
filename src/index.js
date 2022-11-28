import { RouterURL } from './url'
import { Router } from './router'

export default function (Alpine) {
  const router = new Router()

  const state = Alpine.reactive({
    mode: 'web',
    base: '',
    href: location.origin,
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

  Alpine.effect(() => {
    const url = getTargetURL(state.href)
    state.path = url.path
    state.query = url.query
    state.params = router.match(url)
  })

  Alpine.nextTick(() => {
    if (state.mode === 'web' && !state.base) state.href = location.href
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

  const templateCaches = {}
  const inLoadProgress = {}
  const inMakeProgress = new Set()

  Alpine.directive('route', (el, { modifiers, expression }, { effect, cleanup }) => {
    if (!modifiers.includes('notfound')) {
      router.add(expression)
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

    const tpl = el.getAttribute('template') ?? el.getAttribute('template.preload')

    let loading
    if (el.hasAttribute('template.preload')) {
      loading = load(tpl).finally(() => loading = false)
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
      } else if (tpl) {
        if (templateCaches[tpl]) {
          el.innerHTML = templateCaches[tpl]
          make()
        } else {
          if (loading) {
            loading.then(() => make())
          } else {
            state.loading = true
            load(tpl).then(() => make()).finally(() => state.loading = false)
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

        el.classList.toggle(classes.active, r.path.startsWith(l.path))
        el.classList.toggle(classes.exactActive, l.path === r.path)
      })
    }

    cleanup(() => {
      el.removeEventListener('click', go)
    })
  })
}
