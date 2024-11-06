import { defineEventHandler } from 'h3'
import { getTimerState } from '../../services/timer'

export default defineEventHandler(() => {
  return getTimerState()
}) 