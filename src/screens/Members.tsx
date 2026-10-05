import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MemberDialog } from '../components/MemberDialog'
import { AppShell } from '../layout/AppShell'
import { useMembersStore } from '../store/membersStore'
import { useProfileStore } from '../store/profileStore'

const KNOWN_PROVIDERS = ['email', 'google', 'github']

/** Yönetici ekranı (`/members`): üyeler, en yeni üstte. Sayfa açılınca yeni üyeler görüldü sayılır; satıra tıklayınca ayrıntı. */
export function Members() {
  const { t, i18n } = useTranslation()
  const isAdmin = useProfileStore((s) => s.isAdmin)
  const { members, total, status } = useMembersStore()
  const open = useMembersStore((s) => s.open)
  const [selected, setSelected] = useState<string | null>(null)
  const selectedMember = members.find((m) => m.userId === selected)

  useEffect(() => {
    if (isAdmin) void open()
  }, [isAdmin, open])

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const fresh = members.filter((m) => m.isNew).length

  return (
    <AppShell current={{ screen: 'members' }} title={t('members.title')}>
      <div className="members">
        <h2>{t('members.title')}</h2>
        {!isAdmin ? (
          <p className="hint">{t('members.adminOnly')}</p>
        ) : (
          <>
            <p className="hint">
              {t('members.summary', { count: total })}
              {fresh > 0 && ` · ${t('members.newSummary', { count: fresh })}`}
            </p>
            {status === 'error' && <p className="members-error">{t('members.error')}</p>}
            {status === 'ready' && members.length === 0 && <p className="hint">{t('members.empty')}</p>}
            {members.length > 0 && (
              <div className="members-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t('members.email')}</th>
                      <th>{t('members.method')}</th>
                      <th>{t('members.plan')}</th>
                      <th>{t('members.joined')}</th>
                      <th>{t('members.lastSignIn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.userId} className={m.isNew ? 'is-new' : undefined} onClick={() => setSelected(m.userId)}>
                        <td>
                          <button type="button" className="members-open" title={t('members.openDetail')}>
                            {m.email || '—'}
                          </button>
                          {m.isNew && <span className="members-new">{t('nav.new')}</span>}
                          {m.banned && <span className="members-banned">{t('members.banned')}</span>}
                        </td>
                        <td>{KNOWN_PROVIDERS.includes(m.provider) ? t(`members.providers.${m.provider}`) : m.provider}</td>
                        <td>{t(`pricing.plans.${m.plan}`, { defaultValue: m.plan })}</td>
                        <td>{dateFormat.format(m.createdAt)}</td>
                        <td>{m.lastSignInAt ? dateFormat.format(m.lastSignInAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {members.length < total && <p className="hint">{t('members.truncated', { count: members.length })}</p>}
            {selectedMember && <MemberDialog key={selectedMember.userId} member={selectedMember} onClose={() => setSelected(null)} />}
          </>
        )}
      </div>
    </AppShell>
  )
}
