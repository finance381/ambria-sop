import { get, set, del, keys } from 'idb-keyval'

interface QueuedSubmission {
  id: string
  checklist_id: string
  station_id: string
  staff_name: string
  responses: { item_index: number; value?: string; photoBlob?: string }[]
  queued_at: string
}

const PREFIX = 'offline-sub-'

export async function queueSubmission(sub: QueuedSubmission): Promise<void> {
  await set(PREFIX + sub.id, sub)
}

export async function getQueuedCount(): Promise<number> {
  const all = await keys()
  return all.filter(k => String(k).startsWith(PREFIX)).length
}

export async function getQueuedSubmissions(): Promise<QueuedSubmission[]> {
  const all = await keys()
  const qKeys = all.filter(k => String(k).startsWith(PREFIX))
  const results: QueuedSubmission[] = []
  for (const k of qKeys) {
    const v = await get<QueuedSubmission>(k)
    if (v) results.push(v)
  }
  return results
}

export async function removeQueued(id: string): Promise<void> {
  await del(PREFIX + id)
}