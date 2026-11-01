import { create } from 'zustand'
import { creditPeriod, creditsLeft, DEFAULT_PLAN, getPlan, isPlanId, type PlanId } from '../billing/plans'

// Plan ve kredi göstergesi. Girişli üyede tek kaynak sunucu: `profileStore` plan, dönem başı ve harcanan krediyi
// `billing_status` ile okuyup `applyServer` ile buraya yazar (plan Stripe aboneliğinden gelir). Buradaki değer yalnızca
// arayüz içindir (localStorage kullanıcı tarafından değiştirilebilir); yapay zekâ ve depolama sınırı sunucuda uygulanır.
const PLAN_KEY = 'motion-studio.plan'

interface Saved {
  planId: PlanId
  /** abonelik başlangıcı; krediler her ay bu günde yenilenir */
  anchor: number
  /** bu dönemde harcanan kredi */
  used: number
  /** `used`'ın ait olduğu dönemin başı */
  periodStart: number
}

function fresh(planId: PlanId, now = Date.now()): Saved {
  return { planId, anchor: now, used: 0, periodStart: now }
}

/** Dönem değiştiyse harcanan krediyi sıfırlar. */
function renew(saved: Saved, now = Date.now()): Saved {
  const { start } = creditPeriod(saved.anchor, now)
  return start === saved.periodStart ? saved : { ...saved, used: 0, periodStart: start }
}

function read(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAN_KEY) ?? 'null') as Partial<Saved> | null
    if (raw && isPlanId(raw.planId) && Number.isFinite(raw.anchor) && Number.isFinite(raw.used) && Number.isFinite(raw.periodStart)) {
      return renew(raw as Saved)
    }
  } catch {
    // bozuk kayıt: ücretsiz planla başla
  }
  return fresh(DEFAULT_PLAN)
}

function write(saved: Saved) {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(saved))
  } catch {
    // kaydedilemese de bu oturumda geçerli
  }
}

interface PlanStore extends Saved {
  setPlan: (planId: PlanId) => void
  /** Sunucudaki plan, kredi döneminin başı ve o dönemde harcanan kredi. */
  applyServer: (server: { planId: PlanId; anchor: number; used: number }) => void
  /** Yapay zekâ işlemi için kredi düşer; yetmezse hiçbir şey düşmez ve false döner. */
  spendCredits: (amount: number) => boolean
  /** Dönem dolduysa kredileri yeniler (uzun açık kalan sekmeler için). */
  refresh: () => void
}

export const usePlanStore = create<PlanStore>()((set, get) => {
  const commit = (next: Saved) => {
    write(next)
    set(next)
  }
  const current = (): Saved => {
    const { planId, anchor, used, periodStart } = get()
    return renew({ planId, anchor, used, periodStart })
  }
  return {
    ...read(),
    setPlan: (planId) => {
      if (planId !== get().planId) commit(fresh(planId))
    },
    applyServer: ({ planId, anchor, used }) => {
      const next = { planId, anchor, used, periodStart: creditPeriod(anchor, Date.now()).start }
      const now = get()
      if (next.planId !== now.planId || next.anchor !== now.anchor || next.used !== now.used || next.periodStart !== now.periodStart) commit(next)
    },
    spendCredits: (amount) => {
      const saved = current()
      if (creditsLeft(getPlan(saved.planId), saved.used) < amount) {
        commit(saved)
        return false
      }
      commit({ ...saved, used: saved.used + amount })
      return true
    },
    refresh: () => {
      const saved = current()
      if (saved.periodStart !== get().periodStart) commit(saved)
    },
  }
})

/** Seçili plan ve kalan kredi. */
export function usePlan() {
  const planId = usePlanStore((s) => s.planId)
  const used = usePlanStore((s) => s.used)
  const plan = getPlan(planId)
  return { plan, used, left: creditsLeft(plan, used) }
}
