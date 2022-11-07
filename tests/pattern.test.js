import { URLPattern } from '../src/pattern'

describe('patterns', () => {
  test('build static path', () => {
    const path = '/hello/world'
    expect(URLPattern.build(path)).toBe(path)
  })

  test('build dynamic path', () => {
    expect(URLPattern.build('/hello/:name'))
      .toStrictEqual(/^\/hello\/(?<name>[^/]+)$/)
  })

  test('build dynamic path with regex', () => {
    expect(URLPattern.build('/users/:id(\\d+)'))
      .toStrictEqual(/^\/users\/(?<id>\d+)$/)
  })

  describe('matches', () => {
    test('match', () => {
      expect(URLPattern.match('/hello/world', URLPattern.build('/hello/world'))).toBe(true)
      expect(URLPattern.match('/hello/world', URLPattern.build('/hello/:name'))).toStrictEqual({name: 'world'})
      expect(URLPattern.match('/users/123', URLPattern.build('/users/:id(\\d+)'))).toStrictEqual({id: '123'})
      expect(URLPattern.match('/users/someone', URLPattern.build('/users/:id(\\d+)'))).toBe(false)
    })

    test('is', () => {
      expect(URLPattern.is('/hello/world', URLPattern.build('/hello/world'))).toBe(true)
      expect(URLPattern.is('/hello/world', URLPattern.build('/hello/:name'))).toBe(true)
      expect(URLPattern.is('/users/123', URLPattern.build('/users/:id(\\d+)'))).toBe(true)
      expect(URLPattern.is('/users/someone', URLPattern.build('/users/:id(\\d+)'))).toBe(false)
    })
  })
})
