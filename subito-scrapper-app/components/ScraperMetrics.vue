<template>
  <div class="scraper-metrics">
    <h2>Scraper Status Dashboard</h2>
    
    <div v-if="pending">Loading metrics...</div>
    <div v-else-if="error">Error loading metrics</div>
    <div v-else class="metrics-grid">
      <!-- Status Card -->
      <div class="metric-card">
        <h3>Current Status</h3>
        <div class="status-indicator" :class="metrics?.status">
          {{ metrics?.status.charAt(0).toUpperCase() + metrics?.status.slice(1) }}
        </div>
        <p v-if="metrics?.error" class="error-message">
          {{ metrics.error }}
        </p>
        <div class="search-info">
          <p><strong>Search Query:</strong> {{ SCRAPER_CONFIG.searchParams.q }}</p>
          <p><strong>Last Run:</strong> {{ formatTimeAgo(metrics?.lastRun) }}</p>
        </div>
      </div>

      <!-- Latest Run Stats -->
      <div class="metric-card">
        <h3>Latest Run Statistics</h3>
        <template v-if="metrics?.lastSessionStats">
          <div class="stat-grid">
            <div class="stat-item">
              <span class="stat-label">Items Found</span>
              <span class="stat-value">{{ metrics.lastSessionStats.totalItems }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Pages Processed</span>
              <span class="stat-value">{{ metrics.lastSessionStats.totalPages }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Session ID</span>
              <span class="stat-value">#{{ metrics.lastSessionStats.sessionId }}</span>
            </div>
          </div>
        </template>
        <p v-else>No session data available</p>
      </div>

      <!-- Next Run Info -->
      <div class="metric-card">
        <h3>Next Scheduled Run</h3>
        <div class="next-run-info">
          <p class="time-left">{{ getNextRunTime() }}</p>
          <div class="progress-bar">
            <div 
              class="progress" 
              :style="{ width: calculateProgress() + '%' }"
              :class="{ 'almost-due': calculateProgress() > 80 }"
            ></div>
          </div>
          <p class="schedule-info">Runs every 6 hours</p>
        </div>
      </div>
    </div>

    <div class="view-details">
      <button @click="navigateToDetails" class="details-button">
        View Detailed Metrics
      </button>
    </div>
  </div>
</template>

<script setup>
import { SCRAPER_CONFIG } from '../server/config/scraper'

const { data: metrics, pending, error } = useFetch('/api/scraper/metrics', {
  refresh: true,
  refreshInterval: 30000,
})

const router = useRouter()

function formatDate(dateString) {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleString()
}

function getNextRunTime() {
  if (!metrics.value?.lastRun) return 'Calculating...'
  
  const lastRun = new Date(metrics.value.lastRun)
  const nextRun = new Date(lastRun.getTime() + (6 * 60 * 60 * 1000)) // 6 hours
  const now = new Date()
  const timeLeft = nextRun - now

  if (timeLeft < 0) return 'Due now'
  
  const hours = Math.floor(timeLeft / (60 * 60 * 1000))
  const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000))
  
  return `${hours}h ${minutes}m`
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Never'
  const now = new Date()
  const diff = now - new Date(dateString)
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  if (seconds > 0) return `${seconds}s ago`
  return 'Just now'
}

function calculateProgress() {
  if (!metrics.value?.lastRun) return 0
  const now = new Date()
  const lastRun = new Date(metrics.value.lastRun)
  const diff = now - lastRun
  const totalTime = 6 * 60 * 60 * 1000 // 6 hours in milliseconds
  const progress = (diff / totalTime) * 100
  return Math.min(100, Math.max(0, progress))
}

function navigateToDetails() {
  router.push('/metrics')
}
</script>

<style scoped>
.scraper-metrics {
  padding: 1rem;
  margin: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.metric-card {
  background: white;
  padding: 1rem;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.metric-card h3 {
  margin-top: 0;
  color: #2c3e50;
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.status-indicator {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: 500;
  text-align: center;
  width: 100%;
  margin-bottom: 0.5rem;
}

.status-indicator.idle {
  background-color: #93c5fd;
  color: #1e40af;
}

.status-indicator.running {
  background-color: #4ade80;
  color: #064e3b;
}

.status-indicator.error {
  background-color: #f87171;
  color: #7f1d1d;
}

.error-message {
  color: #dc2626;
  background-color: #fee2e2;
  padding: 0.5rem;
  border-radius: 4px;
  margin-top: 0.5rem;
}

.schedule-info {
  color: #666;
  font-size: 0.9rem;
}

p {
  margin: 0.5rem 0;
}

.search-info {
  background-color: #f8fafc;
  padding: 0.75rem;
  border-radius: 6px;
  margin-top: 0.5rem;
}

.search-info p {
  margin: 0.25rem 0;
}

.view-details {
  margin-top: 1.5rem;
  text-align: center;
}

.details-button {
  padding: 0.75rem 1.5rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.details-button:hover {
  background-color: #2563eb;
}

.next-run-info {
  text-align: center;
}

.time-left {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 1rem;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.stat-item {
  text-align: center;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 6px;
}

.stat-label {
  display: block;
  font-size: 0.875rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e40af;
}
</style> 