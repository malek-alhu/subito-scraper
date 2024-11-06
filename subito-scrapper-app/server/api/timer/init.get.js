import { defineEventHandler } from 'h3'
import { initializeTimer } from '../../services/timer'

export default defineEventHandler(() => {
  initializeTimer()
  return { message: 'Timer initialization attempted' }
}) 