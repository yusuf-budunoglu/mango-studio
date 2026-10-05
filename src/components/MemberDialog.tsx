import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatBytes } from '../billing/plans'
import { useMembersStore, type Member, type MemberDetail } from '../store/membersStore'
import { Dialog } from './Dialog'

const KNOWN_PROVIDERS = ['email', 'google', 'github']

type Action = 'ban' | 'unban' | 'delete'

/**
 * Yönetici: bir üyenin ayrıntısı (hesap, plan, depolama, proje ve çıktı sayıları) ile yasaklama ve silme.
 * Yasaklama ve silme ikinci bir onay ister; yöneticinin kendisi ve diğer yöneticiler için sunulmaz.
 */
export function MemberDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const loadDetail = useMembersStore((s) => s.detail)
  const setBanned = useMembersStore((s) => s.setBanned)
  const remove = useMembersStore((s) => s.remove)
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const [confirm, setConfirm] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(false)

  useEffect(() => {
    let alive = true
    loadDetail(member.userId).then(
      (d) => alive && setDetail(d),
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
    }
  }, [loadDetail, member.userId])

  const dateTime = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const when = (ms: number | null) => (ms ? dateTime.format(ms) : '—')
  const provider = (id: string) => (KNOWN_PROVIDERS.includes(id) ? t(`members.providers.${id}`) : id)

  const run = async (action: Action) => {
    setBusy(true)
    setActionError(false)
    try {
      if (action === 'delete') {
        await remove(member.userId)
        onClose()
        return
      }
      await setBanned(member.userId, action === 'ban')
      setDetail((d) => d && { ...d, banned: action === 'ban' })
      setConfirm(null)
    } catch {
      setActionError(true)
    } finally {
      setBusy(false)
    }
  }

  const email = member.email || '—'

  if (confirm) {
    return (
      <Dialog title={t(`members.confirm.${confirm}.title`)} onClose={busy ? () => undefined : () => setConfirm(null)}>
        <div className="member">
          <p className="modal-text">{t(`members.confirm.${confirm}.body`, { email })}</p>
          {actionError && <p className="modal-text modal-error">{t('members.actionError')}</p>}
          <div className="modal-actions">
            <button type="button" data-autofocus disabled={busy} onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </button>
            <button type="button" className={confirm === 'unban' ? 'primary' : 'danger-solid'} disabled={busy} onClick={() => void run(confirm)}>
              {busy ? t('members.working') : t(`members.confirm.${confirm}.action`)}
            </button>
          </div>
        </div>
      </Dialog>
    )
  }

  const stats: [string, string | number][] = detail
    ? [
        [t('members.stats.videos'), detail.projects.videos],
        [t('members.stats.designs'), detail.projects.designs],
        [t('members.stats.templates'), detail.projects.templates],
        [t('members.stats.videoExports'), detail.exports.videos],
        [t('members.stats.imageExports'), detail.exports.images],
        [t('members.stats.byClaude'), detail.projects.byClaude],
        [t('members.stats.shared'), detail.projects.shared],
        [t('members.stats.files'), detail.files],
        [t('members.stats.storage'), `${formatBytes(detail.storageUsed, i18n.language)} / ${formatBytes(detail.storageQuota, i18n.language)}`],
      ]
    : []

  return (
    <Dialog title={email} onClose={onClose}>
      <div className="member">
        {failed && <p className="modal-text modal-error">{t('members.detailError')}</p>}
        {!detail && !failed && <p className="modal-text">{t('members.loading')}</p>}
        {detail && (
          <>
            <div className="member-chips">
              <span className="member-chip">{t('plan.label', { plan: t(`pricing.plans.${detail.plan}`, { defaultValue: detail.plan }) })}</span>
              {detail.banned && <span className="member-chip member-chip--banned">{t('members.banned')}</span>}
              {detail.isAdmin && <span className="member-chip member-chip--admin">{t('members.admin')}</span>}
              {detail.isSelf && <span className="member-chip">{t('members.you')}</span>}
            </div>

            <dl className="member-facts">
              {detail.name && (
                <>
                  <dt>{t('members.name')}</dt>
                  <dd>{detail.name}</dd>
                </>
              )}
              <dt>{t('members.method')}</dt>
              <dd>{detail.providers.map(provider).join(', ')}</dd>
              <dt>{t('members.joined')}</dt>
              <dd>{when(detail.createdAt)}</dd>
              <dt>{t('members.lastSignIn')}</dt>
              <dd>{when(detail.lastSignInAt)}</dd>
              <dt>{t('members.emailConfirmed')}</dt>
              <dd>{t(detail.emailConfirmed ? 'members.yes' : 'members.no')}</dd>
              <dt>{t('members.lastEdit')}</dt>
              <dd>{when(detail.projects.lastEdit)}</dd>
              <dt>{t('members.lastExport')}</dt>
              <dd>{when(detail.exports.last)}</dd>
            </dl>

            <ul className="member-stats">
              {stats.map(([label, value]) => (
                <li key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <p className="hint">{t('members.exportsNote')}</p>

            {detail.recentProjects.length > 0 && (
              <section className="member-list">
                <h3>{t('members.recentProjects')}</h3>
                <ul>
                  {detail.recentProjects.map((p, i) => (
                    <li key={i}>
                      <span className="member-list-name">{p.name}</span>
                      <span className="hint">
                        {t(p.template ? 'members.kind.template' : p.design ? 'members.kind.design' : 'members.kind.video')}
                        {p.byClaude && ' · Claude'}
                        {' · '}
                        {when(p.updatedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {detail.recentExports.length > 0 && (
              <section className="member-list">
                <h3>{t('members.recentExports')}</h3>
                <ul>
                  {detail.recentExports.map((e, i) => (
                    <li key={i}>
                      <span className="member-list-name">
                        {t(e.kind === 'video' ? 'members.kind.video' : 'members.kind.image')} · {e.width}×{e.height}
                        {e.fps ? ` · ${e.fps} fps` : ''}
                        {e.format ? ` · ${e.format.toUpperCase()}` : ''}
                      </span>
                      <span className="hint">{when(e.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {detail.isSelf || detail.isAdmin ? (
              <p className="hint">{t('members.protected')}</p>
            ) : (
              <div className="modal-actions">
                <button type="button" onClick={() => setConfirm(detail.banned ? 'unban' : 'ban')}>
                  {t(detail.banned ? 'members.unban' : 'members.ban')}
                </button>
                <button type="button" className="danger" onClick={() => setConfirm('delete')}>
                  {t('members.delete')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
