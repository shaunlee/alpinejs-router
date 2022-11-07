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
    r.match(new RouterURL('http:/localhost/hello'))
    expect(r.is('/hello')).toBe(true)
    expect(r.is('/xyz')).toBe(false)
    expect(r.is('/xyz', '/hello')).toBe(true)
    expect(r.not('/hello')).toBe(false)
    expect(r.not('/xyz')).toBe(true)
    expect(r.not('/xyz', '/hello')).toBe(false)
    r.match(new RouterURL('http:/localhost/users/add'))
    expect(r.is('/users/add')).toBe(true)
    expect(r.not('/users/:id')).toBe(true)
    r.match(new RouterURL('http:/localhost/users/123'))
    expect(r.not('/users/add')).toBe(true)
    expect(r.is('/users/:id')).toBe(true)
    expect(r.notfound(new RouterURL('http:/localhost/hello/world'))).toBe(true)
    expect(r.notfound(new RouterURL('http:/localhost/hello'))).toBe(false)
  })
})
