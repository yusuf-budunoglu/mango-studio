import { describe, expect, it } from 'vitest'
import quotaSql from '../../supabase/migrations/20261002000001_studio_share_publish.sql?raw'
import perksSql from '../../supabase/migrations/20261014000002_plan_perks.sql?raw'
import { addMonths, cheapestPlanFor, clampExport, creditPeriod, creditsLeft, exportAllowed, formatBytes, getPlan, LAUNCH_DISCOUNT, PLANS } from './plans'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime()

describe('planlar', () => {
  it('fiyatlar: 4.99 / 9.99 / 19.99, çıkış fiyatı normalin yarısı', () => {
    expect(PLANS.map((p) => p.launchPrice)).toEqual([0, 4.99, 9.99, 19.99])
    for (const p of PLANS) expect(p.launchPrice).toBeCloseTo(p.price * LAUNCH_DISCOUNT, 1)
  })

  it('çıktı sınırları: ücretsiz yalnızca 1080p 30, Starter 2K 60, Pro ve Sınırsız 4K 60', () => {
    const free = getPlan('free')
    expect(exportAllowed(free, { resolution: 1080, fps: 30 })).toBe(true)
    expect(exportAllowed(free, { resolution: 1080, fps: 60 })).toBe(false)
    expect(exportAllowed(free, { resolution: 720, fps: 30 })).toBe(false)
    expect(exportAllowed(getPlan('starter'), { resolution: 1440, fps: 60 })).toBe(true)
    expect(exportAllowed(getPlan('starter'), { resolution: 2160, fps: 30 })).toBe(false)
    expect(exportAllowed(getPlan('pro'), { resolution: 2160, fps: 60 })).toBe(true)
    expect(exportAllowed(getPlan('unlimited'), { resolution: 2160, fps: 60 })).toBe(true)
  })

  it('izin verilmeyen tercih plana indirilir', () => {
    expect(clampExport(getPlan('free'), { resolution: 2160, fps: 60, container: 'mp4' })).toEqual({ resolution: 1080, fps: 30, container: 'mp4' })
    expect(clampExport(getPlan('free'), { resolution: 720, fps: 30 })).toMatchObject({ resolution: 1080 })
    expect(clampExport(getPlan('starter'), { resolution: 2160, fps: 60 })).toMatchObject({ resolution: 1440, fps: 60 })
    expect(clampExport(getPlan('pro'), { resolution: 720, fps: 60 })).toMatchObject({ resolution: 720, fps: 60 })
  })

  it('kilitli seçeneği açan en ucuz plan', () => {
    expect(cheapestPlanFor({ fps: 60 }).id).toBe('starter')
    expect(cheapestPlanFor({ resolution: 1440 }).id).toBe('starter')
    expect(cheapestPlanFor({ resolution: 2160 }).id).toBe('pro')
  })

  it('ücretsiz planda kredi yok, ücretli planlarda artar, en üst plan sınırsız', () => {
    expect(getPlan('free').aiCredits).toBe(0)
    expect(creditsLeft(getPlan('free'), 0)).toBe(0)
    expect(creditsLeft(getPlan('starter'), 5)).toBe(145)
    expect(creditsLeft(getPlan('starter'), 999)).toBe(0)
    expect(creditsLeft(getPlan('unlimited'), 1e9)).toBe(Infinity)
    const limits = PLANS.map((p) => p.aiCredits ?? Infinity)
    expect(limits).toEqual([...limits].sort((a, b) => a - b))
  })

  it('krediler her ay abonelik gününde yenilenir, kısa aylarda gün kaymaz', () => {
    const jan31 = at(2026, 1, 31)
    expect(new Date(addMonths(jan31, 1)).getDate()).toBe(28)
    expect(new Date(addMonths(jan31, 2)).getDate()).toBe(31)
    expect(creditPeriod(jan31, at(2026, 2, 27))).toEqual({ start: jan31, end: addMonths(jan31, 1) })
    expect(creditPeriod(jan31, at(2026, 3, 5)).start).toBe(addMonths(jan31, 1))
    expect(creditPeriod(jan31, at(2026, 7, 31)).start).toBe(addMonths(jan31, 6))
  })

  it('aylık çıktı: ücretsiz planda 5, ücretli planlarda sınırsız; sunucudaki export_limit ile aynı', () => {
    expect(PLANS.map((p) => p.exportsPerMonth)).toEqual([5, null, null, null])
    const fn = perksSql.slice(perksSql.indexOf('function public.export_limit'), perksSql.indexOf('function public.export_status'))
    const unlimited = fn.match(/p_plan in \(([^)]*)\) then null/)?.[1].replace(/['\s]/g, '').split(',')
    expect(unlimited).toEqual(PLANS.filter((p) => p.exportsPerMonth === null).map((p) => p.id))
    expect(Number(fn.match(/else (\d+) end/)?.[1])).toBe(getPlan('free').exportsPerMonth)
  })

  it('Claude projeleri: ücretsiz planda ayda 3, ücretli planlarda sınırsız; sunucudaki mcp_project_limit ile aynı', () => {
    expect(PLANS.map((p) => p.mcpProjects)).toEqual([3, null, null, null])
    const fn = perksSql.slice(perksSql.indexOf('function public.mcp_project_limit'), perksSql.indexOf('function public.enforce_mcp_project_limit'))
    const unlimited = fn.match(/p_plan in \(([^)]*)\) then null/)?.[1].replace(/['\s]/g, '').split(',')
    expect(unlimited).toEqual(PLANS.filter((p) => p.mcpProjects === null).map((p) => p.id))
    expect(Number(fn.match(/else (\d+) end/)?.[1])).toBe(getPlan('free').mcpProjects)
  })

  it('filigran yalnızca ücretsiz planda; premium şablonlar ücretli planlarda; marka kiti Pro ve Unlimited (sunucudaki can_use_brand_kit ile aynı)', () => {
    expect(PLANS.filter((p) => p.watermark).map((p) => p.id)).toEqual(['free'])
    expect(PLANS.filter((p) => p.premiumTemplates).map((p) => p.id)).toEqual(['starter', 'pro', 'unlimited'])
    const fn = perksSql.slice(perksSql.indexOf('function public.can_use_brand_kit'), perksSql.indexOf('create table public.brand_kits'))
    const allowed = fn.match(/'free'\) in \(([^)]*)\)/)?.[1].replace(/['\s]/g, '').split(',')
    expect(allowed).toEqual(PLANS.filter((p) => p.brandKit).map((p) => p.id))
  })

  it('depolama kotası: 500 MB / 5 GB / 20 GB / 100 GB, sunucudaki storage_quota ile aynı', () => {
    expect(PLANS.map((p) => formatBytes(p.storageBytes, 'en'))).toEqual(['500 MB', '5 GB', '20 GB', '100 GB'])
    const fn = quotaSql.slice(quotaSql.indexOf('function public.storage_quota'), quotaSql.indexOf('function public.storage_used'))
    for (const p of PLANS) {
      const pattern = p.id === 'free' ? /else (\d+)::bigint/ : new RegExp(`when '${p.id}' then (\\d+)::bigint`)
      expect(Number(fn.match(pattern)?.[1]), p.id).toBe(p.storageBytes)
    }
  })
})
