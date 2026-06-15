import { RouterURL } from './url.js'
import { URLPattern } from './pattern.js'

export class Router {
  #patterns = {}
  #staticRoutes = new Set()
  #dynamicRoutes = {}
  #cache = {}

  add (route) {
    const pattern = this.#cache[route] ?? URLPattern.build(route)
    this.#cache[route] = pattern
    this.#patterns[route] = pattern
    this.#indexRoute(route, pattern)
  }

  match (target) {
    console.assert(target instanceof RouterURL)
    const path = target.path
    if (this.#staticRoutes.has(path)) {
      return {}
    }

    for (const routes of this.#getDynamicRoutes(path)) {
      for (const [, pattern] of routes) {
        const found = URLPattern.match(path, pattern)
        if (found) {
          return found === true ? {} : found
        }
      }
    }
    return false
  }

  is (target, ...routes) {
    console.assert(target instanceof RouterURL)
    const path = target.path
    for (const route of routes) {
      const pattern = this.#patterns[route] ?? this.#cache[route] ?? URLPattern.build(route)
      this.#cache[route] = pattern
      if (URLPattern.is(path, pattern)) {
        return true
      }
    }
    return false
  }

  not (target, ...routes) {
    console.assert(target instanceof RouterURL)
    const path = target.path
    for (const route of routes) {
      const pattern = this.#patterns[route] ?? this.#cache[route] ?? URLPattern.build(route)
      this.#cache[route] = pattern
      if (URLPattern.is(path, pattern)) {
        return false
      }
    }
    return true
  }

  notfound (target) {
    console.assert(target instanceof RouterURL)
    const path = target.path
    if (this.#staticRoutes.has(path)) {
      return false
    }

    for (const routes of this.#getDynamicRoutes(path)) {
      for (const [, pattern] of routes) {
        if (URLPattern.is(path, pattern)) {
          return false
        }
      }
    }
    return true
  }

  #indexRoute (route, pattern) {
    if (!(pattern instanceof RegExp)) {
      this.#staticRoutes.add(route)
      return
    }

    const segments = Router.#segments(route)
    const depth = segments.length
    const group = this.#dynamicRoutes[depth] ?? { static: new Map(), wildcard: [] }
    const first = segments[0]
    const routes = first.startsWith(':')
      ? group.wildcard
      : group.static.get(first) ?? []
    const entry = [route, pattern, Router.#scoreRoute(route)]

    const existingIndex = routes.findIndex(([current]) => current === route)
    if (existingIndex > -1) {
      routes.splice(existingIndex, 1)
    }

    let index = routes.findIndex(current => Router.#compareRoutes(entry, current) < 0)
    if (index === -1) {
      index = routes.length
    }

    routes.splice(index, 0, entry)
    if (!first.startsWith(':')) {
      group.static.set(first, routes)
    }
    this.#dynamicRoutes[depth] = group
  }

  #getDynamicRoutes (path) {
    const segments = Router.#segments(path)
    const group = this.#dynamicRoutes[segments.length]
    if (!group) {
      return []
    }

    const routes = []
    const first = segments[0]
    const staticRoutes = group.static.get(first)
    if (staticRoutes) {
      routes.push(staticRoutes)
    }
    if (group.wildcard.length) {
      routes.push(group.wildcard)
    }
    return routes
  }

  static #compareRoutes ([left, , leftScores], [right, , rightScores]) {
    const length = Math.max(leftScores.length, rightScores.length)

    for (let i = 0; i < length; i += 1) {
      const diff = (rightScores[i] ?? 0) - (leftScores[i] ?? 0)
      if (diff !== 0) {
        return diff
      }
    }

    return right.length - left.length
  }

  static #scoreRoute (route) {
    return route
      .split('/')
      .filter(Boolean)
      .map(segment => {
        if (!segment.startsWith(':')) {
          return 3
        }
        return segment.includes('(') ? 2 : 1
      })
  }

  static #segments (path) {
    return path.split('/').filter(Boolean)
  }
}
