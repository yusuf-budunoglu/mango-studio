import { describe, expect, it } from 'vitest'
import { internalLinkPath, legacyHashPath, parsePath, routeToPath, type Route } from './router'

describe('yönlendirme', () => {
  it.each<Route>([
    { screen: 'home' },
    { screen: 'welcome' },
    { screen: 'studio' },
    { screen: 'studio', folderId: 'f-abc12' },
    { screen: 'studio', view: 'videos' },
    { screen: 'studio', view: 'images' },
    { screen: 'studio', view: 'sounds' },
    { screen: 'studio', view: 'templates' },
    { screen: 'shared', shareId: 'Ab3_x-Yz09Ab3_x-Yz09Ab' },
    { screen: 'new' },
    { screen: 'new', folderId: 'f-abc12' },
    { screen: 'templates' },
    { screen: 'template', templateId: 'wallet-promo' },
    { screen: 'editor', projectId: 'p-xyz' },
    { screen: 'soon', feature: 'auto-video' },
    { screen: 'soon', feature: 'text-to-video' },
    { screen: 'profile' },
    { screen: 'members' },
    { screen: 'signup' },
    { screen: 'oauth' },
    { screen: 'reset' },
    { screen: 'privacy' },
    { screen: 'terms' },
  ])('%o adrese çevrilip geri okunur', (route) => {
    expect(parsePath(routeToPath(route))).toEqual(route)
  })

  it('adreslerde # yok', () => {
    expect(routeToPath({ screen: 'home' })).toBe('/')
    expect(routeToPath({ screen: 'templates' })).toBe('/templates')
    expect(routeToPath({ screen: 'template', templateId: 'crystal' })).toBe('/t/crystal')
  })

  it('eski Videolar adresi Studio’yu açar', () => {
    expect(parsePath('/videos')).toEqual({ screen: 'studio' })
  })

  it('sondaki eğik çizgi yok sayılır', () => {
    expect(parsePath('/templates/')).toEqual({ screen: 'templates' })
    expect(parsePath('/')).toEqual({ screen: 'home' })
  })

  it('eski #/ adresleri yeni yola çevrilir', () => {
    expect(legacyHashPath('#/t/crystal')).toBe('/t/crystal')
    expect(legacyHashPath('#/')).toBe('/')
    // sayfa içi bölüm bağlantısı ve boş adres eski biçim değildir
    expect(legacyHashPath('#x-edit')).toBeUndefined()
    expect(legacyHashPath('')).toBeUndefined()
  })

  it('yalnızca site içi sayfa bağlantıları yönlendiriciye gider', () => {
    const current = { origin: 'https://mangostudio.design', pathname: '/', href: 'https://mangostudio.design/' } as Location
    const link = (href: string, attrs: { target?: string; download?: boolean } = {}) =>
      ({ href, target: attrs.target ?? '', hasAttribute: (name: string) => name === 'download' && !!attrs.download }) as unknown as HTMLAnchorElement
    expect(internalLinkPath(link('https://mangostudio.design/templates'), current)).toBe('/templates')
    expect(internalLinkPath(link('https://mangostudio.design/t/crystal'), current)).toBe('/t/crystal')
    expect(internalLinkPath(link('https://openfontlicense.org/'), current)).toBeUndefined()
    expect(internalLinkPath(link('https://mangostudio.design/templates', { target: '_blank' }), current)).toBeUndefined()
    expect(internalLinkPath(link('https://mangostudio.design/templates/crystal.jpg'), current)).toBeUndefined()
    expect(internalLinkPath(link('https://mangostudio.design/video', { download: true }), current)).toBeUndefined()
    expect(internalLinkPath(link('https://mangostudio.design/#x-edit'), current)).toBeUndefined()
  })
})
