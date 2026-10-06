import { describe, expect, it } from 'vitest'
import libraryJson from '../../public/prompts/library.json?raw'
import { DETAILED_LENGTH, isPostUrl, matchesPromptFilter, promptCardRatio, type LibraryPrompt } from './promptLibrary'

const library = JSON.parse(libraryJson) as LibraryPrompt[]
// yalnızca dosya adları gerekli: glob tembel, dosyalar yüklenmez
const media = new Set(Object.keys(import.meta.glob('../../public/prompts/*.{webp,mp4}')).map((path) => path.split('/').pop()))

const sample = (patch: Partial<LibraryPrompt>): LibraryPrompt => ({
  id: 'a-1',
  handle: 'a',
  postUrl: 'https://x.com/a/status/1',
  prompt: 'make a short motion video',
  width: 1920,
  height: 1080,
  date: '2026-09-25',
  ...patch,
})

describe('prompt kütüphanesi', () => {
  it('her kaydın kimliği adrese girer ve tektir', () => {
    expect(library.length).toBeGreaterThan(0)
    expect(new Set(library.map((p) => p.id)).size).toBe(library.length)
    for (const p of library) expect(p.id).toMatch(/^[\w-]+$/)
  })

  it('her kayıt yazarını, X gönderisini ve boş olmayan bir prompt taşır', () => {
    for (const p of library) {
      expect(p.handle, p.id).toMatch(/^\w+$/)
      expect(isPostUrl(p.postUrl), p.id).toBe(true)
      expect(p.prompt.trim().length, p.id).toBeGreaterThan(0)
      expect(p.width > 0 && p.height > 0, p.id).toBe(true)
    }
  })

  it('listede geçen kapak ve önizleme dosyaları yerinde', () => {
    for (const p of library) {
      if (!p.noPoster) expect(media.has(`${p.id}.webp`), `${p.id}.webp`).toBe(true)
      if (!p.noPreview) expect(media.has(`${p.id}.mp4`), `${p.id}.mp4`).toBe(true)
    }
  })

  it('filtreler', () => {
    const long = sample({ prompt: 'x'.repeat(DETAILED_LENGTH) })
    expect(matchesPromptFilter(long, 'detailed')).toBe(true)
    expect(matchesPromptFilter(sample({}), 'detailed')).toBe(false)
    expect(matchesPromptFilter(sample({ rounds: 'one' }), 'oneShot')).toBe(true)
    expect(matchesPromptFilter(sample({ rounds: 'few' }), 'oneShot')).toBe(false)
    expect(matchesPromptFilter(sample({}), 'landscape')).toBe(true)
    expect(matchesPromptFilter(sample({ width: 1080, height: 1920 }), 'vertical')).toBe(true)
    // kare video ne yatay ne dikey
    expect(matchesPromptFilter(sample({ width: 1080, height: 1080 }), 'landscape')).toBe(false)
    expect(matchesPromptFilter(sample({ width: 1080, height: 1080 }), 'vertical')).toBe(false)
  })

  it('kart oranı aşırı uzun ya da yayvan videoda sınırlanır', () => {
    expect(promptCardRatio(sample({}))).toBeCloseTo(16 / 9)
    expect(promptCardRatio(sample({ width: 400, height: 1600 }))).toBeCloseTo(9 / 16)
    expect(promptCardRatio(sample({ width: 3000, height: 1000 }))).toBe(2)
  })

  it('yalnızca X gönderisi adresi bağlantı olur', () => {
    expect(isPostUrl('https://x.com/a/status/123')).toBe(true)
    expect(isPostUrl('javascript:alert(1)')).toBe(false)
    expect(isPostUrl('https://x.com.evil.example/a/status/123')).toBe(false)
  })
})
