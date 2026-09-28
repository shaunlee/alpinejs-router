import { URLPattern } from '../src/pattern.js'

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

  describe('invalid parameter names', () => {
    const cases = [
      ['/:user-id', ':user-id'],
      ['/:id?', ':id?'],
      ['/:user.id', ':user.id'],
      ['/:1id', ':1id'],
      ['/:a b', ':a b'],
      ['/:', ':']
    ]

    test.each(cases)('rejects %s with a clear Error', (route, name) => {
      let caught
      try {
        URLPattern.build(route)
      } catch (error) {
        caught = error
      }

      expect(caught).toBeInstanceOf(Error)
      expect(caught).not.toBeInstanceOf(SyntaxError)
      expect(caught.message).toBe(`Invalid route parameter name '${name}' in route '${route}'`)
    })

    test('names a parameter inside a longer route', () => {
      expect(() => URLPattern.build('/users/:user-id/posts'))
        .toThrow("Invalid route parameter name ':user-id' in route '/users/:user-id/posts'")
    })
  })

  describe('valid parameter names still build and match', () => {
    test('plain name', () => {
      expect(URLPattern.build('/:id')).toStrictEqual(/^\/(?<id>[^/]+)$/)
      expect(URLPattern.match('/123', URLPattern.build('/:id'))).toStrictEqual({ id: '123' })
    })

    test('name with a custom pattern', () => {
      expect(URLPattern.build('/:id(\\d+)')).toStrictEqual(/^\/(?<id>\d+)$/)
      expect(URLPattern.match('/123', URLPattern.build('/:id(\\d+)'))).toStrictEqual({ id: '123' })
      expect(URLPattern.match('/abc', URLPattern.build('/:id(\\d+)'))).toBe(false)
    })

    test('multiple named segments', () => {
      expect(URLPattern.build('/users/:id/posts/:postId')).toStrictEqual(/^\/users\/(?<id>[^/]+)\/posts\/(?<postId>[^/]+)$/)
      expect(URLPattern.match('/users/1/posts/2', URLPattern.build('/users/:id/posts/:postId')))
        .toStrictEqual({ id: '1', postId: '2' })
    })

    test('leading underscore name', () => {
      expect(URLPattern.build('/:_private')).toStrictEqual(/^\/(?<_private>[^/]+)$/)
      expect(URLPattern.match('/secret', URLPattern.build('/:_private'))).toStrictEqual({ _private: 'secret' })
    })

    test('leading dollar name', () => {
      expect(URLPattern.build('/:$dollar')).toStrictEqual(/^\/(?<$dollar>[^/]+)$/)
      expect(URLPattern.match('/cash', URLPattern.build('/:$dollar'))).toStrictEqual({ $dollar: 'cash' })
    })

    test('fully static route', () => {
      expect(URLPattern.build('/users/list')).toBe('/users/list')
      expect(URLPattern.match('/users/list', URLPattern.build('/users/list'))).toBe(true)
      expect(URLPattern.is('/users/list', URLPattern.build('/users/list'))).toBe(true)
      expect(URLPattern.match('/users/other', URLPattern.build('/users/list'))).toBe(false)
    })
  })

  describe('custom patterns containing groups', () => {
    test('nested group is not truncated', () => {
      const pattern = URLPattern.build('/:id(\\d{2}(a|b))')

      expect(pattern).toStrictEqual(/^\/(?<id>\d{2}(a|b))$/)
      expect(URLPattern.match('/12a', pattern)).toStrictEqual({ id: '12a' })
      expect(URLPattern.match('/12c', pattern)).toBe(false)
    })

    test('unnamed groups do not leak into the params', () => {
      const found = URLPattern.match('/12a', URLPattern.build('/:id(\\d{2}(a|b))'))

      expect(Object.keys(found)).toStrictEqual(['id'])
    })

    test('two adjacent nested groups', () => {
      const pattern = URLPattern.build('/:id((a|b)(c|d))')

      expect(URLPattern.match('/ac', pattern)).toStrictEqual({ id: 'ac' })
      expect(URLPattern.match('/bd', pattern)).toStrictEqual({ id: 'bd' })
      expect(URLPattern.match('/ae', pattern)).toBe(false)
    })

    test('custom pattern alongside other segments', () => {
      const pattern = URLPattern.build('/posts/:year(\\d{4})/:slug')

      expect(URLPattern.match('/posts/2024/hello', pattern))
        .toStrictEqual({ year: '2024', slug: 'hello' })
      expect(URLPattern.match('/posts/24/hello', pattern)).toBe(false)
    })
  })

  describe('malformed routes report a clear Error', () => {
    const cases = [
      ['/:id(', "Malformed route parameter ':id(' in route '/:id('"],
      ['/:id(\\d+', "Malformed route parameter ':id(\\d+' in route '/:id(\\d+'"]
    ]

    test.each(cases)('rejects %s', (route, message) => {
      let caught
      try {
        URLPattern.build(route)
      } catch (error) {
        caught = error
      }

      expect(caught).toBeInstanceOf(Error)
      expect(caught.constructor.name).toBe('Error')
      expect(caught.message).toBe(message)
    })

    test('an uncompilable pattern body is wrapped, not raw', () => {
      let caught
      try {
        URLPattern.build('/:id([)')
      } catch (error) {
        caught = error
      }

      expect(caught).toBeInstanceOf(Error)
      expect(caught.constructor.name).toBe('Error')
      expect(caught.message).toMatch(/^Invalid route pattern '\/:id\(\[\)': /)
    })

    test('duplicate parameter names', () => {
      let caught
      try {
        URLPattern.build('/:a/:a')
      } catch (error) {
        caught = error
      }

      expect(caught).toBeInstanceOf(Error)
      expect(caught.constructor.name).toBe('Error')
      expect(caught.message).toBe("Duplicate route parameter name ':a' in route '/:a/:a'")
    })

    test('duplicate names across differing custom patterns', () => {
      expect(() => URLPattern.build('/:id(\\d+)/:id([a-z]+)'))
        .toThrow("Duplicate route parameter name ':id' in route '/:id(\\d+)/:id([a-z]+)'")
    })

    test('distinct names in one route are fine', () => {
      expect(URLPattern.match('/1/2', URLPattern.build('/:a/:b')))
        .toStrictEqual({ a: '1', b: '2' })
    })
  })
})
