import { createClient } from '@supabase/supabase-js'
import { getEnv } from './env.js'

/** 後端專用 Supabase admin client（使用 service_role；請勿暴露到瀏覽器） */
export function getSupabaseAdmin() {
  const env = getEnv()
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('missing_SUPABASE_URL_or_SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}
