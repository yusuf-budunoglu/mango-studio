import { getPlan } from '../billing/plans'
import { repository } from '../persistence/repository'
import { navigate } from '../router'
import { usePlanStore } from '../store/planStore'
import { blankProject, TEMPLATES } from './templates'

/**
 * Şablondan yeni proje oluşturur ve kaydeder ("Ücretsiz kullan"). Kullanıcı Studio'ya gider; proje
 * orada şablonun adıyla görünür, tıklayınca editörde açılır.
 */
export async function createFromTemplate(templateId: string, folderId?: string) {
  const template = TEMPLATES.find((t) => t.id === templateId)
  if (!template) return
  // Premium şablon ücretli planlarda; önizleme sayfası düğmeyi zaten yükseltmeye çevirir.
  if (template.premium && !getPlan(usePlanStore.getState().planId).premiumTemplates) {
    navigate({ screen: 'pricing' })
    return
  }
  const project = template.build()
  // editörde açılıp kapanana kadar kartta şablonun kapak görseli görünür
  await repository.save(project, `${import.meta.env.BASE_URL}templates/posters/${template.id}.jpg`)
  if (folderId) await repository.moveToFolder(project.id, folderId)
  navigate({ screen: 'studio', folderId })
}

/** Boş proje oluşturur, kaydeder ve editörde açar. */
export async function createBlank(options: Parameters<typeof blankProject>[0] & { folderId?: string }) {
  const project = blankProject(options)
  await repository.save(project)
  if (options.folderId) await repository.moveToFolder(project.id, options.folderId)
  navigate({ screen: 'editor', projectId: project.id })
}
