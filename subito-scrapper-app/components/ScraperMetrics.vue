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

    <!-- Action Buttons -->
    <div class="action-buttons">
      <button
        @click="triggerScraping"
        class="action-button scrape-button"
        :disabled="isScrapingNow || metrics?.status === 'running'"
      >
        <span v-if="isScrapingNow">🔄 Starting Scrape...</span>
        <span v-else-if="metrics?.status === 'running'">⏳ Scraping in Progress...</span>
        <span v-else>🚀 Start Scraping Now</span>
      </button>

      <button @click="navigateToDetails" class="action-button details-button">
        📊 View Detailed Metrics
      </button>

      <button @click="navigateToDeals" class="action-button deals-button">
        💰 View Deals
      </button>
    </div>

    <!-- Feedback Messages -->
    <div v-if="scraperMessage" :class="['feedback-message', scraperMessage.type]">
      {{ scraperMessage.text }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { SCRAPER_CONFIG } from '../server/config/scraper'

const { data: metrics, pending, error, refresh } = useFetch('/api/scraper/metrics', {
  refresh: true,
  refreshInterval: 30000,
})

const router = useRouter()
const isScrapingNow = ref(false)
const scraperMessage = ref(null)

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

async function triggerScraping() {
  if (isScrapingNow.value || metrics.value?.status === 'running') {
    return
  }

  isScrapingNow.value = true
  scraperMessage.value = {
    type: 'info',
    text: '🔄 Starting scraper... This will take 2-5 minutes. Database will auto-initialize if needed.'
  }

  try {
    const result = await $fetch('/api/scraper/run', {
      method: 'POST'
    })

    if (result.success) {
      scraperMessage.value = {
        type: 'success',
        text: `✅ Scraper started successfully! Session ID: ${result.sessionId}. Scraping ${result.totalItems} items across ${result.totalPages} pages.`
      }
      // Refresh metrics to show updated status
      await refresh()
    } else {
      scraperMessage.value = {
        type: 'error',
        text: `❌ Failed to start scraper: ${result.message || result.error}`
      }
    }
  } catch (error) {
    scraperMessage.value = {
      type: 'error',
      text: `❌ Error: ${error.message || 'Failed to start scraper'}`
    }
  } finally {
    isScrapingNow.value = false

    // Clear message after 10 seconds
    setTimeout(() => {
      scraperMessage.value = null
    }, 10000)
  }
}

function navigateToDetails() {
  router.push('/metrics')
}

function navigateToDeals() {
  router.push('/deals')
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

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.action-button {
  flex: 1;
  min-width: 200px;
  padding: 1rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.scrape-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.scrape-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
}

.scrape-button:active:not(:disabled) {
  transform: translateY(0);
}

.details-button {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.details-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(79, 172, 254, 0.4);
}

.deals-button {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: #333;
}

.deals-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(250, 112, 154, 0.4);
}

.feedback-message {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.feedback-message.success {
  background-color: #d1fae5;
  color: #065f46;
  border-left: 4px solid #10b981;
}

.feedback-message.error {
  background-color: #fee2e2;
  color: #991b1b;
  border-left: 4px solid #ef4444;
}

.feedback-message.info {
  background-color: #dbeafe;
  color: #1e40af;
  border-left: 4px solid #3b82f6;
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