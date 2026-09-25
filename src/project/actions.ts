import { repository } from '../persistence/repository'
import { navigate } from '../router'
import { TEMPLATES } from './templates'

/** Şablondan yeni proje oluşturur, kaydeder ve editörde açar. */
export async function createFromTemplate(templateId: string) {
  const template = TEMPLATES.find((t) => t.id === templateId)
  if (!template) return
  const project = template.build()
  await repository.save(project)
  navigate({ screen: 'editor', projectId: project.id })
}
