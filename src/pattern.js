export class URLPattern {
  static build (path) {
    if (path.indexOf(':') === -1) {
      return path
    }
    const names = new Set()
    const pattern = path.split('/').map(e => {
      if (!e.startsWith(':')) {
        return e
      }
      let field = e.substr(1)
      let fieldPattern = '[^/]+'
      const open = field.indexOf('(')
      if (open > -1) {
        if (!field.endsWith(')')) {
          throw new Error(`Malformed route parameter '${e}' in route '${path}'`)
        }
        fieldPattern = field.slice(open + 1, -1)
        field = field.slice(0, open)
      }
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(field)) {
        throw new Error(`Invalid route parameter name ':${field}' in route '${path}'`)
      }
      if (names.has(field)) {
        throw new Error(`Duplicate route parameter name ':${field}' in route '${path}'`)
      }
      names.add(field)
      return `(?<${field}>${fieldPattern})`
    }).join('/')
    try {
      return new RegExp(`^${pattern}$`)
    } catch (error) {
      throw new Error(`Invalid route pattern '${path}': ${error.message}`)
    }
  }

  static match (path, pattern) {
    if (pattern instanceof RegExp) {
      const found = path.match(pattern)
      if (!found) return false
      return { ...found.groups }
    }
    return path === pattern
  }

  static is (path, pattern) {
    if (pattern instanceof RegExp) {
      return pattern.test(path)
    }
    return path === pattern
  }
}
