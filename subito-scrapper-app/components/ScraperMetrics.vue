<template>
  <div class="scraper-metrics">
    <h2>Subito Coin Scraper Dashboard</h2>
    
    <div v-if="pending">Loading metrics...</div>
    <div v-else-if="error">Error loading metrics</div>
    <div v-else class="metrics-grid">
      <!-- Current Search Card -->
      <div class="metric-card">
        <h3>Current Search</h3>
        <div class="search-info">
          <p><strong>Query:</strong> {{ SCRAPER_CONFIG.searchParams.q }}</p>
          <p><strong>Items Per Page:</strong> {{ SCRAPER_CONFIG.pagination.itemsPerPage }}</p>
        </div>
      </div>

      <!-- Status Card -->
      <div class="metric-card">
        <h3>Current Status</h3>
        <div class="status-indicator" :class="metrics?.status">
          {{ metrics?.status.charAt(0).toUpperCase() + metrics?.status.slice(1) }}
        </div>
        <p v-if="metrics?.error" class="error-message">
          {{ metrics.error }}
        </p>
      </div>

      <!-- Stats Card -->
      <div class="metric-card">
        <h3>Statistics</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Total Sessions</span>
            <span class="stat-value">{{ metrics?.totalSessions || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Items Scraped</span>
            <span class="stat-value">{{ metrics?.totalItemsScraped || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Last Run</span>
            <span class="stat-value">{{ formatTimeAgo(metrics?.lastRun) }}</span>
          </div>
        </div>
      </div>

      <!-- Last Session Card -->
      <div class="metric-card">
        <h3>Last Session</h3>
        <template v-if="metrics?.lastSessionStats">
          <p>Session ID: {{ metrics.lastSessionStats.sessionId }}</p>
          <p>Items Found: {{ metrics.lastSessionStats.totalItems }}</p>
          <p>Pages: {{ metrics.lastSessionStats.totalPages }}</p>
          <p>Time: {{ formatDate(metrics.lastSessionStats.timestamp) }}</p>
        </template>
        <p v-else>No session data available</p>
      </div>

      <!-- Schedule Card -->
      <div class="metric-card">
        <h3>Schedule</h3>
        <p>Next Run: {{ getNextRunTime() }}</p>
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
</style> 