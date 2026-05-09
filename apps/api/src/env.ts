import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string(),
  /** Supabase project URL，例如：https://xxxx.supabase.co */
  SUPABASE_URL: z.string().optional(),
  /** service_role key（只能放後端） */
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional()
})

export type Env = z.infer<typeof EnvSchema>

export function getEnv(): Env {
  return EnvSchema.parse(process.env)
}

