import { getScraperMetrics } from '../../services/scheduler'

export default defineEventHandler(async (event) => {
  const metrics = getScraperMetrics()
  return metrics
}) 