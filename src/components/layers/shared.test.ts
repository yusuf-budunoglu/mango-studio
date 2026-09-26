import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import { applyOpacity } from './shared'

describe('opaklık', () => {
  it('opak çizilmiş malzeme saydamlaşınca yeniden derlenir (sönme animasyonu görünür)', () => {
    const material = new MeshBasicMaterial()
    const group = new Group()
    group.add(new Mesh(new PlaneGeometry(), material))
    applyOpacity(group, 1)
    expect(material.transparent).toBe(false)
    const version = material.version
    applyOpacity(group, 0.4)
    expect(material.transparent).toBe(true)
    expect(material.opacity).toBeCloseTo(0.4)
    expect(material.version).toBeGreaterThan(version)
    // değişmeyen durumda gereksiz yeniden derleme yok
    const v2 = material.version
    applyOpacity(group, 0.3)
    expect(material.version).toBe(v2)
    applyOpacity(group, 1)
    expect(material.transparent).toBe(false)
  })
})
