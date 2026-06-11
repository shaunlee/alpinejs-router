import { Router } from '../src/router.js'
import { RouterURL } from '../src/url.js'

describe('router', () => {
  test('match', () => {
    const r = new Router()
    r.add('/hello')
    r.add('/users/add')
    r.add('/users/:id(\\d+)')
    expect(r.match(new RouterURL('http:/localhost/hello'))).toStrictEqual({})
    expect(r.match(new RouterURL('http:/localhost/users/add'))).toStrictEqual({})
    expect(r.match(new RouterURL('http:/localhost/users/123'))).toStrictEqual({id: '123'})
    expect(r.match(new RouterURL('http:/localhost/xyz'))).toBe(false)
  })

  test('match prefers more specific routes', () => {
    const r = new Router()
    r.add('/users/:id')
    r.add('/users/add')
    r.add('/:slug')
    r.add('/:id(\\d+)')

    expect(r.match(new RouterURL('http:/localhost/users/add'))).toStrictEqual({})
    expect(r.match(new RouterURL('http:/localhost/123'))).toStrictEqual({id: '123'})
    expect(r.match(new RouterURL('http:/localhost/hello'))).toStrictEqual({slug: 'hello'})
  })

  test('re-adding a route does not duplicate it or change priority', () => {
    const r = new Router()
    r.add('/users/:id')
    r.add('/users/:id(\\d+)')
    r.add('/users/:id')

    expect(r.match(new RouterURL('http:/localhost/users/123'))).toStrictEqual({id: '123'})
    expect(r.match(new RouterURL('http:/localhost/users/abc'))).toStrictEqual({id: 'abc'})
  })

  test('keeps priority order across many mixed routes', () => {
    const r = new Router()
    r.add('/:section/:page')
    r.add('/docs/:page')
    r.add('/:section(blog|news)/:page')
    r.add('/docs/intro')

    expect(r.match(new RouterURL('http:/localhost/docs/intro'))).toStrictEqual({})
    expect(r.match(new RouterURL('http:/localhost/docs/setup'))).toStrictEqual({page: 'setup'})
    expect(r.match(new RouterURL('http:/localhost/blog/hello'))).toStrictEqual({section: 'blog', page: 'hello'})
    expect(r.match(new RouterURL('http:/localhost/shop/cart'))).toStrictEqual({section: 'shop', page: 'cart'})
  })

  test('equal-score routes are ordered by length', () => {
    const r = new Router()
    r.add('/:a')
    r.add('/:longer')

    expect(r.match(new RouterURL('http:/localhost/hello'))).toStrictEqual({longer: 'hello'})
  })

  test('is, not, notfound', () => {
    const r = new Router()
    r.add('/hello')
    r.add('/users/add')
    r.add('/users/:id')
    r.add('/users/:id/edit')
    let url = new RouterURL('http:/localhost/hello')
    expect(r.is(url, '/hello')).toBe(true)
    expect(r.is(url, '/xyz')).toBe(false)
    expect(r.is(url, '/xyz', '/hello')).toBe(true)
    expect(r.not(url, '/hello')).toBe(false)
    expect(r.not(url, '/xyz')).toBe(true)
    expect(r.not(url, '/xyz', '/hello')).toBe(false)
    url = new RouterURL('http:/localhost/users/add')
    expect(r.is(url, '/users/add')).toBe(true)
    expect(r.not(url, '/users/:id(\\d+)')).toBe(true)
    url = new RouterURL('http:/localhost/users/123')
    expect(r.not(url, '/users/add')).toBe(true)
    expect(r.is(url, '/users/:id(\\d+)')).toBe(true)
    expect(r.notfound(new RouterURL('http:/localhost/hello/world'))).toBe(true)
    expect(r.notfound(new RouterURL('http:/localhost/hello'))).toBe(false)
    url = new RouterURL('http:/localhost/users/123/edit')
    expect(r.is(url, '/users/:id(\\d+)/edit')).toBe(true)
  })
})
