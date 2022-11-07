import { RouterURL } from '../src/url'

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
  })
})
