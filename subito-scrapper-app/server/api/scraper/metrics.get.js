import { getScraperMetrics } from '../../services/scheduler'

export default defineEventHandler(async (event) => {
  return getScraperMetrics()
}) 