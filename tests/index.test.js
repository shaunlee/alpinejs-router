import { jest } from '@jest/globals'
import { getRouteTemplateRoot, getTemplateRenderMode, isActivePath, shouldHandleLinkClick } from '../src/index.js'

describe('router plugin helpers', () => {
  test('isActivePath only matches the same segment boundary', () => {
    expect(isActivePath('/', '/')).toBe(true)
    expect(isActivePath('/', '/users')).toBe(false)
    expect(isActivePath('/users', '/users')).toBe(true)
    expect(isActivePath('/users', '/users/123')).toBe(true)
    expect(isActivePath('/users', '/users2')).toBe(false)
  })

  test('shouldHandleLinkClick keeps browser-native behaviors intact', () => {
    const makeEvent = overrides => ({
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      altKey: false,
      ctrlKey: false,
      shiftKey: false,
      ...overrides
    })

    const makeLink = overrides => ({
      href: 'http://localhost/users',
      target: '',
      hasAttribute: () => false,
      ...overrides
    })

    expect(shouldHandleLinkClick(makeEvent({}), makeLink(), 'http://localhost')).toBe(true)
    expect(shouldHandleLinkClick(makeEvent({ ctrlKey: true }), makeLink(), 'http://localhost')).toBe(false)
    expect(shouldHandleLinkClick(makeEvent({ button: 1 }), makeLink(), 'http://localhost')).toBe(false)
    expect(shouldHandleLinkClick(makeEvent({}), makeLink({ target: '_blank' }), 'http://localhost')).toBe(false)
    expect(shouldHandleLinkClick(makeEvent({}), makeLink({ href: 'https://example.com/users' }), 'http://localhost')).toBe(false)
    expect(shouldHandleLinkClick(makeEvent({}), makeLink({ href: 'http://localhost.evil.test/users' }), 'http://localhost')).toBe(false)
    expect(shouldHandleLinkClick(makeEvent({}), makeLink({ hasAttribute: name => name === 'download' }), 'http://localhost')).toBe(false)
  })

  test('getTemplateRenderMode prefers external templates and falls back to inline when preload failed', () => {
    expect(getTemplateRenderMode({
      hasInlineTemplate: true,
      templateUrl: '/users.html',
      hasCachedTemplate: false,
      preloadFailed: false
    })).toBe('load')

    expect(getTemplateRenderMode({
      hasInlineTemplate: true,
      templateUrl: '/users.html',
      hasCachedTemplate: true,
      preloadFailed: false
    })).toBe('external')

    expect(getTemplateRenderMode({
      hasInlineTemplate: true,
      templateUrl: '/users.html',
      hasCachedTemplate: false,
      preloadFailed: true
    })).toBe('inline')

    expect(getTemplateRenderMode({
      hasInlineTemplate: false,
      templateUrl: '/users.html',
      hasCachedTemplate: false,
      preloadFailed: true
    })).toBe('load')

    expect(getTemplateRenderMode({
      hasInlineTemplate: true,
      templateUrl: '',
      hasCachedTemplate: false,
      preloadFailed: false
    })).toBe('inline')

    expect(getTemplateRenderMode({
      hasInlineTemplate: false,
      templateUrl: '',
      hasCachedTemplate: false,
      preloadFailed: false
    })).toBe('missing')
  })

  test('getRouteTemplateRoot rejects templates with multiple root elements', () => {
    const reportError = jest.fn()
    const template = {
      content: {
        firstElementChild: {
          nextElementSibling: {}
        }
      }
    }

    expect(getRouteTemplateRoot(template, '/users', reportError)).toBeNull()
    expect(reportError).toHaveBeenCalledWith("Route '/users' must render exactly one root element")
  })
})
