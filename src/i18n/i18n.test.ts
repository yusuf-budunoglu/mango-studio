import { afterEach, describe, expect, it } from 'vitest'
import { EASINGS } from '../engine/easing'
import { displayText, evaluateLayer } from '../engine/evaluate'
import { PRESETS } from '../engine/presets'
import { SAMPLE_TEMPLATE } from '../project/sampleTemplate'
import { TEMPLATES } from '../project/templates'
import i18n, { DEFAULT_LANGUAGE, LANGUAGES } from '.'
import en from './locales/en'
import tr from './locales/tr'

const RESOURCES: Record<string, object> = { en, tr }

function flatten(obj: object, prefix = ''): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') acc[path] = value
    else Object.assign(acc, flatten(value as object, path))
    return acc
  }, {})
}

afterEach(() => i18n.changeLanguage(DEFAULT_LANGUAGE))

describe('çeviriler', () => {
  it('varsayılan dil İngilizce', () => {
    expect(DEFAULT_LANGUAGE).toBe('en')
    expect(i18n.language).toBe('en')
  })

  it.each(LANGUAGES.map((l) => l.code))('%s: İngilizceyle aynı anahtarlar, boş metin yok, aynı değişkenler', (code) => {
    const base = flatten(en)
    const other = flatten(RESOURCES[code])
    expect(Object.keys(other).sort()).toEqual(Object.keys(base).sort())
    for (const [key, value] of Object.entries(other)) {
      expect(value.trim(), key).not.toBe('')
      const vars = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort()
      expect(vars(value), key).toEqual(vars(base[key]))
    }
  })

  it('her animasyonun, kategorinin ve eğrinin adı var', () => {
    const keys = flatten(en)
    for (const [id, preset] of Object.entries(PRESETS)) {
      expect(keys[`presets.${id}`], id).toBeDefined()
      expect(keys[`categories.${preset.category}`], preset.category).toBeDefined()
    }
    for (const id of Object.keys(EASINGS)) expect(keys[`easings.${id}`], id).toBeDefined()
    for (const t of TEMPLATES) expect(keys[`templates.${t.id}.name`], t.id).toBeDefined()
    for (const p of Object.values(PRESETS)) {
      // Varsayılan eğrinin kaydı da olmalı.
      expect(EASINGS[p.defaultEasing]).toBeDefined()
    }
  })
})

describe('şablonlar dil seçimine uyar', () => {
  it('İngilizce seçiliyken İngilizce içerik ve sayı biçimi', () => {
    const project = TEMPLATES[0].build()
    expect(project.name).toBe('Fintech app')
    expect(project.layers.map((l) => l.text)).toContain('Pay anyone')
    expect(project.numberLocale).toBe('en-US')
  })

  it('Türkçe seçiliyken Türkçe içerik ve sayı biçimi', async () => {
    await i18n.changeLanguage('tr')
    const project = TEMPLATES[0].build()
    expect(project.name).toBe('Fintech uygulaması')
    expect(project.layers.map((l) => l.text)).toContain('Saniyeler içinde')
    expect(project.camera.name).toBe('Kamera')
    expect(project.numberLocale).toBe('tr-TR')
  })

  it('sayaç, projenin sayı biçimini kullanır', () => {
    const layer = { ...SAMPLE_TEMPLATE.build().layers[2] }
    const state = evaluateLayer(layer, 10)
    expect(displayText(layer, state, 'en-US')).toBe('10,000')
    expect(displayText(layer, state, 'tr-TR')).toBe('10.000')
  })
})
