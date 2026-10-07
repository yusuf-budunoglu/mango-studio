import { aspectLabel, type PublishedTemplate } from '../project/publishedTemplates'
import { templateName, type Template } from '../project/templates'

/** Kartın gösterdiği bilgiler: kodla yazılan şablonlarımız ve yöneticinin yayınladıkları aynı kartla görünür. */
export interface CardInfo {
  id: string
  name: string
  /** oran etiketi ("16:9") ve kartın en/boy oranı */
  format: string
  ratio: [number, number]
  seconds: number
  /** tek karelik görsel şablon: süre gösterilmez, döngü videosu yoktur */
  image: boolean
  posterUrl?: string
  loopUrl?: string
  accent: string
  /** döngü videosu sesli: önizleme sayfasında ses düğmesi gösterilir */
  sound?: boolean
}

export function cardInfo(template: Template | PublishedTemplate): CardInfo {
  const base = import.meta.env.BASE_URL
  if ('build' in template) {
    const [w, h] = template.format.split(':').map(Number)
    return {
      id: template.id,
      name: templateName(template.id),
      format: template.format,
      ratio: [w, h],
      seconds: template.seconds,
      image: template.mode === 'design',
      posterUrl: `${base}templates/posters/${template.id}.jpg`,
      loopUrl: template.mode === 'design' ? undefined : `${base}templates/loops/${template.id}.mp4`,
      accent: template.accent,
      sound: template.sound,
    }
  }
  return {
    id: template.id,
    name: template.name,
    format: aspectLabel(template.width, template.height),
    ratio: [template.width, template.height],
    seconds: Math.round(template.duration * 10) / 10,
    image: template.mode === 'design',
    posterUrl: template.posterUrl,
    loopUrl: template.loopUrl,
    accent: '#FF7A00',
  }
}
