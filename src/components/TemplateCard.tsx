import { useState } from 'react'
import { createFromTemplate } from '../project/actions'
import { templateDescription, templateName, type Template } from '../project/templates'

/** Şablon kartı: `public/templates/<id>.jpg` önizlemesi, yoksa şablon renginde bir degrade. */
export function TemplateCard({ template }: { template: Template }) {
  const [imageFailed, setImageFailed] = useState(false)
  const fallback = { background: `radial-gradient(circle at 30% 30%, ${template.accent}, #0a0a0b 75%)` }

  return (
    <button type="button" className="tile" onClick={() => void createFromTemplate(template.id)}>
      {imageFailed ? (
        <span className="tile-art" style={fallback} />
      ) : (
        <img className="tile-art" src={`templates/${template.id}.jpg`} alt="" loading="lazy" onError={() => setImageFailed(true)} />
      )}
      <span className="tile-title">{templateName(template.id)}</span>
      <span className="tile-sub">{templateDescription(template.id)}</span>
    </button>
  )
}
