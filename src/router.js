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
    this.#patterns = {
      ...this.#patterns,
      [route]: pattern
    }
    this.#indexRoute(route, pattern)
  }

  match (target) {
    console.assert(target instanceof RouterURL)
    const path = target.path
    if (this.#staticRoutes.has(path)) {
      return {}
    }

    for (const [, pattern] of this.#getDynamicRoutes(path)) {
      const found = URLPattern.match(path, pattern)
      if (found) {
        return found === true ? {} : found
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

    return this.#getDynamicRoutes(path).findIndex(
      ([, pattern]) => URLPattern.is(path, pattern)
    ) === -1
  }

  #indexRoute (route, pattern) {
    if (!(pattern instanceof RegExp)) {
      this.#staticRoutes.add(route)
      return
    }

    const depth = Router.#segmentCount(route)
    const routes = this.#dynamicRoutes[depth] ?? []
    const entry = [route, pattern]

    let index = routes.findIndex(([current]) => Router.#compareRoutes(route, current) < 0)
    if (index === -1) {
      index = routes.length
    }

    const existingIndex = routes.findIndex(([current]) => current === route)
    if (existingIndex > -1) {
      routes.splice(existingIndex, 1)
      if (existingIndex < index) {
        index -= 1
      }
    }

    routes.splice(index, 0, entry)
    this.#dynamicRoutes[depth] = routes
  }

  #getDynamicRoutes (path) {
    return this.#dynamicRoutes[Router.#segmentCount(path)] ?? []
  }

  static #compareRoutes (left, right) {
    const leftScores = Router.#scoreRoute(left)
    const rightScores = Router.#scoreRoute(right)
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

  static #segmentCount (path) {
    return path.split('/').filter(Boolean).length
  }
}
