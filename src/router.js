import { RouterURL } from './url'
import { URLPattern } from './pattern'

export class Router {
  #patterns = {}
  #cache = {}

  add (route) {
    this.#patterns = {
      ...this.#patterns,
      [route]: this.#cache[route] ?? URLPattern.build(route)
    }
  }

  match (target) {
    console.assert(target instanceof RouterURL)
    for (const [route, pattern] of Object.entries(this.#patterns)) {
      const found = URLPattern.match(target.path, pattern)
      if (found) {
        return found === true ? {} : found
      }
    }
    return false
  }

  is (target, ...routes) {
    for (const route of routes) {
      const pattern = this.#patterns[route] ?? this.#cache[route] ?? URLPattern.build(route)
      this.#cache[route] = pattern
      if (URLPattern.is(target.path, pattern)) {
        return true
      }
    }
    return false
  }

  not (target, ...routes) {
    for (const route of routes) {
      const pattern = this.#patterns[route] ?? this.#cache[route] ?? URLPattern.build(route)
      this.#cache[route] = pattern
      if (URLPattern.is(target.path, pattern)) {
        return false
      }
    }
    return true
  }

  notfound (target) {
    console.assert(target instanceof RouterURL)
    return Object.keys(this.#patterns).findIndex(
      e => URLPattern.is(target.path, e)
    ) === -1
  }
}
