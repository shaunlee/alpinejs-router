import { RouterURL } from '../src/url.js'

describe('URL', () => {
  describe('web mode', () => {
    test('basic', () => {
      const u = new RouterURL('http://localhost/hello/world')
      expect(u.mode).toBe('web')
      expect(u.path).toBe('/hello/world')
    })

    test('with base', () => {
      const u = new RouterURL('http://localhost/base/hello/world', { base: '/base' })
      expect(u.mode).toBe('web')
      expect(u.base).toBe('/base')
      expect(u.path).toBe('/hello/world')
    })

    test('base only strips a leading path prefix', () => {
      expect(new RouterURL('http://localhost/base', { base: '/base' }).path).toBe('/')
      expect(new RouterURL('http://localhost/base/hello/world', { base: '/base' }).path).toBe('/hello/world')
      expect(new RouterURL('http://localhost/foo/base/hello/world', { base: '/base' }).path).toBe('/foo/base/hello/world')
      expect(new RouterURL('http://localhost/basement/hello/world', { base: '/base' }).path).toBe('/basement/hello/world')
    })

    test('parse query', () => {
      const u = new RouterURL('http://localhost/hello/world?a=1&b=c')
      expect(u.query).toStrictEqual({a: '1', b: 'c'})
    })

    test('resolve url', () => {
      const u = new RouterURL('http://localhost/hello/world?a=1&b=c')
      expect(u.resolve('/xyz', {a: '123', d: 1}).url).toBe('http://localhost/xyz?a=123&b=c&d=1')
      expect(u.resolve('/abc', {a: '123', d: 1}, true).url).toBe('http://localhost/abc?a=123&d=1')
      expect(u.resolve('/def', {}, true).url).toBe('http://localhost/def')
      expect(u.resolve('/', {}, true).url).toBe('http://localhost/')
      expect(u.resolve('', {}, true).url).toBe('http://localhost/')
    })

    test('resolve url with bsae', () => {
      const u = new RouterURL('http://localhost/base/hello/world?a=1&b=c', { base: '/base' })
      expect(u.resolve('/xyz', {a: '123', d: 1}).url).toBe('http://localhost/base/xyz?a=123&b=c&d=1')
      expect(u.resolve('/abc', {a: '123', d: 1}, true).url).toBe('http://localhost/base/abc?a=123&d=1')
      expect(u.resolve('/def', {}, true).url).toBe('http://localhost/base/def')
      expect(u.resolve('/', {}, true).url).toBe('http://localhost/base/')
      expect(u.resolve('', {}, true).url).toBe('http://localhost/base')
    })
  })

  describe('hash mode', () => {
    test('basic', () => {
      const u = new RouterURL('http://localhost/#/hello/world', { mode: 'hash' })
      expect(u.mode).toBe('hash')
      expect(u.path).toBe('/hello/world')
    })

    test('empty hash path resolves to root', () => {
      const u = new RouterURL('http://localhost/#', { mode: 'hash' })
      expect(u.path).toBe('/')
    })

    test('with base', () => {
      const u = new RouterURL('http://localhost/base#/hello/world', { mode: 'hash', base: '/base' })
      expect(u.mode).toBe('hash')
      expect(u.base).toBe('/base')
      expect(u.path).toBe('/hello/world')
    })

    test('parse query', () => {
      const u = new RouterURL('http://localhost/#/hello/world?a=1&b=c', { mode: 'hash' })
      expect(u.query).toStrictEqual({a: '1', b: 'c'})
    })

    test('resolve url', () => {
      const u = new RouterURL('http://localhost/#/hello/world?a=1&b=c', { mode: 'hash' })
      expect(u.resolve('/xyz', {a: '123', d: 1}).url).toBe('http://localhost/#/xyz?a=123&b=c&d=1')
      expect(u.resolve('/abc', {a: '123', d: 1}, true).url).toBe('http://localhost/#/abc?a=123&d=1')
      expect(u.resolve('/def', {}, true).url).toBe('http://localhost/#/def')
      expect(u.resolve('/', {}, true).url).toBe('http://localhost/#/')
      expect(u.resolve('', {}, true).url).toBe('http://localhost/#')
    })

    test('resolve url with base', () => {
      const u = new RouterURL('http://localhost/base#/hello/world?a=1&b=c', { mode: 'hash', base: '/base' })
      expect(u.resolve('/xyz', {a: '123', d: 1}).url).toBe('http://localhost/base#/xyz?a=123&b=c&d=1')
      expect(u.resolve('/abc', {a: '123', d: 1}, true).url).toBe('http://localhost/base#/abc?a=123&d=1')
      expect(u.resolve('/def', {}, true).url).toBe('http://localhost/base#/def')
      expect(u.resolve('/', {}, true).url).toBe('http://localhost/base#/')
      expect(u.resolve('', {}, true).url).toBe('http://localhost/base#')
    })

    test('convert web to hash', () => {
      const u = new RouterURL('http://localhost/hello/world?a=1&b=c', { mode: 'hash' })
      expect(u.path).toBe('/hello/world')
      expect(u.resolve('/xyz', {a: '123', d: 1}).url).toBe('http://localhost/#/xyz?a=123&b=c&d=1')
    })

    test('resolve template path', () => {
      let pathname = new URL('http://localhost/hello/world').pathname
      expect(RouterURL.resolveTemplatePath(pathname, '/a.html')).toStrictEqual('/a.html')
      expect(RouterURL.resolveTemplatePath(pathname, './a.html')).toStrictEqual('/hello/a.html')
      expect(RouterURL.resolveTemplatePath(pathname, '../a.html')).toStrictEqual('/a.html')
      expect(RouterURL.resolveTemplatePath(pathname, '../../a.html')).toStrictEqual('/a.html')
      expect(RouterURL.resolveTemplatePath(pathname, '../../../a.html')).toStrictEqual('/a.html')

      pathname = new URL('http://localhost/hello/world/').pathname
      expect(RouterURL.resolveTemplatePath(pathname, '/a.html')).toStrictEqual('/a.html')
      expect(RouterURL.resolveTemplatePath(pathname, './a.html')).toStrictEqual('/hello/world/a.html')
      expect(RouterURL.resolveTemplatePath(pathname, '../a.html')).toStrictEqual('/hello/a.html')
      expect(RouterURL.resolveTemplatePath(pathname, '../../a.html')).toStrictEqual('/a.html')
      expect(RouterURL.resolveTemplatePath(pathname, '../../../a.html')).toStrictEqual('/a.html')

      pathname = new URL('http://localhost/').pathname
      expect(RouterURL.resolveTemplatePath(pathname, '/a.html')).toStrictEqual('/a.html')
      expect(RouterURL.resolveTemplatePath(pathname, './a.html')).toStrictEqual('/a.html')
      expect(RouterURL.resolveTemplatePath(pathname, '../a.html')).toStrictEqual('/a.html')
      expect(RouterURL.resolveTemplatePath(pathname, '../../a.html')).toStrictEqual('/a.html')
      expect(RouterURL.resolveTemplatePath(pathname, '../../../a.html')).toStrictEqual('/a.html')

      expect(RouterURL.resolveTemplatePath(pathname)).toStrictEqual()
    })
  })
})
