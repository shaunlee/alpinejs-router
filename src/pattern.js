export class URLPattern {
  static build (path) {
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
