import { Router } from '../src/router'
import { RouterURL } from '../src/url'

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

  test('is, not, notfound', () => {
    const r = new Router()
    r.add('/hello')
    r.add('/users/add')
    r.add('/users/:id')
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
  })
})
