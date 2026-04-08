import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const emptyResult = { data: [], error: null }
const emptyOne = { data: null, error: null }

// Chainable mock that always resolves to empty data
function chain(): any {
  const obj: any = { ...emptyResult, ...emptyOne, then: (fn: any) => Promise.resolve(emptyResult).then(fn) }
  const methods = ['select','eq','neq','gt','gte','lt','lte','like','ilike','in','order','limit','range','single','insert','update','delete','upsert','match','filter']
  for (const m of methods) obj[m] = () => chain()
  return obj
}

const dummy: any = {
  from: () => chain(),
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    signInWithPassword: () => Promise.resolve({ error: { message: 'No Supabase config' } }),
    signOut: () => Promise.resolve({}),
  },
  storage: {
    from: () => ({
      getPublicUrl: (p: string) => ({ data: { publicUrl: p } }),
      upload: () => Promise.resolve({ error: { message: 'No config' } }),
    }),
  },
}

export const supabase = (url && key) ? createClient(url, key) : dummy

export function getSopPdfUrl(path: string): string {
  const { data } = supabase.storage.from('sop-pdfs').getPublicUrl(path)
  return data.publicUrl
}