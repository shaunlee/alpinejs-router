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

  is (...routes) {
    return routes.indexOf(this.#current) > -1
  }

  not (...routes) {
    return routes.indexOf(this.#current) === -1
  }

  notfound (target) {
    console.assert(target instanceof RouterURL)
    return Object.keys(this.#patterns).findIndex(
      e => URLPattern.is(target.path, e)
    ) === -1
  }
}
