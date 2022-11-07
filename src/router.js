import { RouterURL } from './url'
import { URLPattern } from './pattern'

export class Router {
  #patterns = {}
  #current

  add (route) {
    this.#patterns = {
      ...this.#patterns,
      [route]: URLPattern.build(route)
    }
  }

  match (target) {
    console.assert(target instanceof RouterURL)
    for (const [route, pattern] of Object.entries(this.#patterns)) {
      const found = URLPattern.match(target.path, pattern)
      if (found) {
        this.#current = route
        return found === true ? {} : found
      }
    }
    return false
  }

  is (target, ...routes) {
    for (const route of routes) {
      const pattern = this.#patterns[route] ?? URLPattern.build(route)
      if (URLPattern.is(target.path, pattern)) {
        return true
      }
    }
    return false
  }

  not (target, ...routes) {
    for (const route of routes) {
      const pattern = this.#patterns[route] ?? URLPattern.build(route)
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
