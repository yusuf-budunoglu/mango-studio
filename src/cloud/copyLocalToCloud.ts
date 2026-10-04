import type { SupabaseClient } from '@supabase/supabase-js'
import { localAssets } from '../persistence/assets'
import { localRepository } from '../persistence/repository'

const doneKey = (userId: string) => `mango-studio.local-copied.${userId}`

export const isLocalCopyDone = (userId: string) => {
  try {
    return localStorage.getItem(doneKey(userId)) === '1'
  } catch {
    return false
  }
}

const markDone = (userId: string) => {
  try {
    localStorage.setItem(doneKey(userId), '1')
  } catch {
    // işaret kaydedilemezse bir sonraki girişte yeniden sorulur
  }
}

/** Bu tarayıcıda kayıtlı proje ve dosya sayısı (kopyalama penceresi için). */
export async function countLocal() {
  const [projects, assets] = await Promise.all([localRepository.list(), localAssets.list()])
  return { projects: projects.length, assets: assets.length }
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

/**
 * Bu tarayıcıdaki klasör, dosya ve projeleri hesaba kopyalar. Yerel kopyalara dokunmaz.
 * Aynı kimlikler yeniden yazılır, bu yüzden yarıda kesilirse güvenle tekrar denenebilir.
 */
export async function copyLocalToCloud(client: SupabaseClient, userId: string, onProgress?: (done: number, total: number) => void) {
  const [projects, folders, assetMetas] = await Promise.all([localRepository.list(), localRepository.listFolders(), localAssets.list()])
  const total = folders.length + assetMetas.length + projects.length
  let done = 0
  const step = () => onProgress?.(++done, total)

  for (const f of folders) {
    fail((await client.from('folders').upsert({ user_id: userId, id: f.id, name: f.name, created_at: new Date(f.createdAt).toISOString() }, { onConflict: 'user_id,id' })).error)
    step()
  }

  for (const meta of assetMetas) {
    const blob = await localAssets.getBlob(meta.id)
    if (blob) {
      const up = await client.storage.from('assets').upload(`${userId}/${meta.id}`, blob, { upsert: true, contentType: meta.type || undefined })
      fail(up.error)
    }
    fail(
      (
        await client
          .from('assets')
          .upsert(
            { user_id: userId, id: meta.id, name: meta.name, kind: meta.kind, type: meta.type, size: meta.size, duration: meta.duration ?? null, created_at: new Date(meta.createdAt).toISOString() },
            { onConflict: 'user_id,id' },
          )
      ).error,
    )
    step()
  }

  for (const summary of projects) {
    const project = await localRepository.load(summary.id)
    if (project) {
      fail(
        (
          await client.from('projects').upsert(
            {
              user_id: userId,
              id: project.id,
              name: project.name,
              duration: project.duration,
              width: project.width,
              height: project.height,
              mode: project.mode ?? null,
              folder_id: summary.folderId ?? null,
              thumbnail: summary.thumbnail ?? null,
              data: project,
              updated_at: new Date(summary.updatedAt).toISOString(),
            },
            { onConflict: 'user_id,id' },
          )
        ).error,
      )
    }
    step()
  }
  markDone(userId)
}

/** "Bir daha sorma" için işaretler (kopyalama yapılmadan). */
export const dismissLocalCopy = markDone
