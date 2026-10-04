import { describe, expect, it } from 'vitest'
import type { ProjectSummary } from '../persistence/repository'
import { inStudioView } from './studioViews'

const p = (extra: Partial<ProjectSummary>): ProjectSummary => ({ id: 'p', name: 'x', duration: 5, updatedAt: 0, ...extra })

describe('Studio bölümleri', () => {
  const video = p({})
  const image = p({ mode: 'design' })
  const template = p({ isTemplate: true })
  const imageTemplate = p({ mode: 'design', isTemplate: true })

  it('Tümü şablon olmayan her projeyi gösterir', () => {
    expect([video, image, template].map((x) => inStudioView(x, undefined))).toEqual([true, true, false])
  })
  it('videolar ve görseller ayrılır, şablonlar karışmaz', () => {
    expect([video, image, template].map((x) => inStudioView(x, 'videos'))).toEqual([true, false, false])
    expect([video, image, imageTemplate].map((x) => inStudioView(x, 'images'))).toEqual([false, true, false])
  })
  it('Şablonlarım yalnızca kullanıcının şablonlarını, Sesler hiçbir projeyi göstermez', () => {
    expect([video, image, template, imageTemplate].map((x) => inStudioView(x, 'templates'))).toEqual([false, false, true, true])
    expect([video, template].map((x) => inStudioView(x, 'sounds'))).toEqual([false, false])
  })
})
