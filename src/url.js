export class RouterURL {
  #url

  constructor(url, opts = {}) {
    this.#url = new URL(url)
    this.mode = opts.mode ?? 'web'
    this.base = opts.base ?? ''
  }

  set url (val) {
    this.#url = new URL(val)
  }

  get url () {
    return this.#url.href
  }

  get path () {
    return (this.mode === 'hash')
      ? (
        this.#url.hash
        ? this.#url.hash.slice(1).split("?").shift()
        : this.#url.href.replace(new RegExp('^' + this.#url.origin + this.base), '').split("?").shift()
      )
      : this.#url.pathname.replace(this.base, '')
  }

  get query () {
    return Object.fromEntries(
      new URLSearchParams(
        this.mode === 'web' ? this.#url.search : this.#url.hash.split('?').pop()
      )
    )
  }

  resolve (path, params, replace = false) {
    let [l, r] = this.#url.href.split('?')
    l = (this.mode === 'hash')
      ? l.indexOf('#') > -1 ? l.replace(/#.+$/, '#' + path) : this.#url.origin + this.base + '#' + path
      : l.replace(new RegExp(this.#url.pathname + '$'), this.base + path)
    const q = replace
      ? new URLSearchParams(params).toString()
      : new URLSearchParams({
        ...Object.fromEntries(new URLSearchParams(r ?? '').entries()),
        ...params
      }).toString()
    this.url = l + (q ? '?' + q : '')
    return this
  }
}
