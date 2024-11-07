<template>
  <div class="detailed-metrics">
    <div class="header">
      <h2>Detailed Scraping Analysis</h2>
      <button @click="navigateBack" class="back-button">
        Back to Dashboard
      </button>
    </div>

          <!-- Database Statistics -->
          <div class="metric-section">
        <h3>Database Statistics</h3>
        <p>Total Sessions: {{ metrics.dbStats.totalSessions }}</p>
        <p>Total Items: {{ metrics.dbStats.totalItems }}</p>
        <p>Active Items: {{ metrics.dbStats.activeItems }}</p>
        <p>Sold Items: {{ metrics.dbStats.soldItems }}</p>
      <p>Estimated Storage Size: {{ metrics.dbStats.storageSize }} KB</p>
    </div>

    <div v-if="pending">Loading detailed metrics...</div>
    <div v-else-if="error" class="error-card">{{ error }}</div>
    <div v-else class="metrics-container">
      <!-- Recent Sessions -->
      <div class="metric-section">
        <h3>Recent Scraping Sessions</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Items</th>
                <th>Pages</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="session in sessionStatuses" :key="session.id">
                <td>{{ formatDate(session.created_at) }}</td>
                <td>{{ session.total_items }}</td>
                <td>{{ session.total_pages }}</td>
                <td>{{ calculateDuration(session) }}</td>
                <td>
                  <span :class="['status-badge', session.displayStatus]">
                    {{ session.displayStatus }}
                    <span v-if="session.statusReason" class="status-reason">
                      ({{ session.statusReason }})
                    </span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Performance Stats -->
      <div class="metric-section">
        <h3>Performance Metrics</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <h4>Success Rate</h4>
            <p class="stat-value">{{ performanceStats.successRate }}%</p>
            <p class="stat-desc">Last 10 sessions</p>
          </div>
          <div class="stat-card">
            <h4>Average Items/Session</h4>
            <p class="stat-value">{{ performanceStats.avgItemsPerSession }}</p>
            <p class="stat-desc">Successfully completed sessions</p>
          </div>
          <div class="stat-card">
            <h4>Total Items Scraped</h4>
            <p class="stat-value">{{ dbStats.totalItems }}</p>
            <p class="stat-desc">All time</p>
          </div>
        </div>
      </div>

      <!-- Endpoint Configuration -->
      <div class="metric-section">
        <h3>Endpoint Configuration</h3>
        <div class="endpoint-details">
          <div class="detail-item">
            <span class="detail-label">API Endpoint:</span>
            <span class="detail-value">{{ metrics?.endpointStats?.url }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Search Query:</span>
            <span class="detail-value">{{ metrics?.endpointStats?.searchQuery }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Items Per Page:</span>
            <span class="detail-value">{{ metrics?.endpointStats?.itemsPerPage }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Request Delay:</span>
            <span class="detail-value">{{ metrics?.endpointStats?.requestDelay }}ms</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Batch Delay:</span>
            <span class="detail-value">{{ metrics?.endpointStats?.batchDelay }}ms</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Schedule:</span>
            <span class="detail-value">{{ metrics?.endpointStats?.schedule }}</span>
          </div>
        </div>
      </div>

      <!-- Error Analysis -->
      <div class="metric-section" v-if="recentErrors.length > 0">
        <h3>Recent Errors</h3>
        <div class="error-list">
          <div v-for="error in recentErrors" :key="error.id" class="error-item">
            <p class="error-time">{{ formatDate(error.created_at) }}</p>
            <p class="error-message">{{ error.error }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const router = useRouter()
const { data: metrics, pending, error } = useFetch('/api/scraper/detailed-metrics')

const MAX_SESSION_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds

const dbStats = computed(() => metrics.value?.dbStats || {
  totalSessions: 0,
  totalItems: 0,
  storageSize: 0
})

const recentSessions = computed(() => metrics.value?.recentSessions || [])

const performanceStats = computed(() => metrics.value?.performanceStats || {
  avgItemsPerSession: 0,
  successRate: 0,
  totalRuntime: 0
})

function navigateBack() {
  router.push('/')
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString()
}

function formatStorageSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function calculateDuration(session) {
  // For completed sessions with duration
  if (session.status === 'completed' && session.duration_ms) {
    const minutes = Math.floor(session.duration_ms / 60000)
    const seconds = Math.floor((session.duration_ms % 60000) / 1000)
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
  }
  
  // For in-progress sessions
  if (session.status === 'in_progress') {
    const start = new Date(session.created_at)
    const now = new Date()
    const diff = now - start
    
    // Check if session is stale (older than MAX_SESSION_DURATION)
    if (diff > MAX_SESSION_DURATION) {
      return 'Failed (timeout)'
    }
    
    // For active sessions, show running time
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}m ${seconds}s (running)`
  }
  
  // For failed sessions with duration
  if (session.status === 'failed' && session.duration_ms) {
    const minutes = Math.floor(session.duration_ms / 60000)
    const seconds = Math.floor((session.duration_ms % 60000) / 1000)
    return `${minutes}m ${seconds}s (failed)`
  }
  
  // For failed sessions without duration but with start time
  if (session.status === 'failed' && session.created_at) {
    const start = new Date(session.created_at)
    const end = session.completed_at ? new Date(session.completed_at) : new Date()
    const diff = end - start
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}m ${seconds}s (failed)`
  }
  
  return 'N/A'
}

const recentErrors = computed(() => {
  return recentSessions.value
    ?.filter(s => s.status === 'failed' && s.error)
    .slice(0, 5) || []
})

// Add computed property for session status
const sessionStatuses = computed(() => {
  return recentSessions.value?.map(session => {
    const start = new Date(session.created_at)
    const now = new Date()
    const diff = now - start
    
    if (session.status === 'in_progress' && diff > MAX_SESSION_DURATION) {
      return {
        ...session,
        displayStatus: 'failed',
        statusReason: 'timeout'
      }
    }
    
    return {
      ...session,
      displayStatus: session.status,
      statusReason: session.error || null
    }
  }) || []
})
</script>

<style scoped>
.detailed-metrics {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.back-button {
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.back-button:hover {
  background-color: #2563eb;
}

.metrics-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.metric-section {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.stat-card {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 0.5rem;
  text-align: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e40af;
  margin: 0.5rem 0;
}

.stat-label {
  color: #64748b;
  font-size: 0.875rem;
}

.table-container {
  overflow-x: auto;
  margin-top: 1rem;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th, td {
  padding: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
}

th {
  background-color: #f8fafc;
  font-weight: 600;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-badge.completed {
  background-color: #dcfce7;
  color: #166534;
}

.status-badge.in_progress {
  background-color: #dbeafe;
  color: #1e40af;
}

.status-badge.error {
  background-color: #fee2e2;
  color: #991b1b;
}

.error-card {
  background-color: #fee2e2;
  color: #991b1b;
  padding: 1rem;
  border-radius: 0.5rem;
  text-align: center;
}

.error-list {
  display: grid;
  gap: 1rem;
}

.error-item {
  background: #fee2e2;
  padding: 1rem;
  border-radius: 6px;
}

.error-time {
  color: #991b1b;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.error-message {
  color: #7f1d1d;
}

.stat-desc {
  color: #64748b;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.endpoint-details {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 0.5rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-label {
  font-weight: 500;
  color: #64748b;
}

.detail-value {
  font-family: monospace;
  color: #1e40af;
}

.status-reason {
  font-size: 0.75rem;
  opacity: 0.8;
}

.status-badge.failed {
  background-color: #fee2e2;
  color: #991b1b;
}
</style> 