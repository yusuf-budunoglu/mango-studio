import { describe, expect, it } from 'vitest'
import { TEMPLATES } from './templates'

describe('şablon kartı bilgileri', () => {
  it('kartın oranı şablonun proje boyutuyla aynı', () => {
    for (const template of TEMPLATES) {
      const project = template.build()
      const [w, h] = template.format.split(':').map(Number)
      expect(project.width * h, template.id).toBe(project.height * w)
      expect(template.seconds, template.id).toBeCloseTo(project.duration, 1)
    }
  })
})
