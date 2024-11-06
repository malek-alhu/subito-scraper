import { useRuntimeConfig } from '#imports'
import { createClient } from '@supabase/supabase-js'

const config = useRuntimeConfig()
const supabaseUrl = config.supabaseUrl
const supabaseKey = config.supabaseKey

if (!supabaseUrl || !supabaseKey) {
  console.error('Environment variables:', {
    supabaseUrl: !!supabaseUrl,
    supabaseKey: !!supabaseKey
  })
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey) 