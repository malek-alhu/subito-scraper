import { supabase } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    // Example query
    const { data, error } = await supabase
      .from('your_table')
      .select('*')

    if (error) throw error

    return { data }
  } catch (error) {
    console.error('Error:', error)
    return { error: error.message }
  }
}) 