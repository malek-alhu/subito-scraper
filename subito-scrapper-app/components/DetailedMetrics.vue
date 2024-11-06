<template>
  <div class="detailed-metrics">
    <div class="header">
      <h2>Detailed Scraping Metrics</h2>
      <button @click="navigateBack" class="back-button">
        Back to Dashboard
      </button>
    </div>

    <div v-if="pending">Loading detailed metrics...</div>
    <div v-else-if="error" class="error-card">{{ error }}</div>
    <div v-else class="metrics-container">
      <!-- Database Stats -->
      <div class="metric-section">
        <h3>Database Statistics</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <h4>Sessions</h4>
            <p class="stat-value">{{ dbStats.totalSessions }}</p>
            <p class="stat-label">Total Scraping Sessions</p>
          </div>
          <div class="stat-card">
            <h4>Items</h4>
            <p class="stat-value">{{ dbStats.totalItems }}</p>
            <p class="stat-label">Total Items Stored</p>
          </div>
          <div class="stat-card">
            <h4>Storage</h4>
            <p class="stat-value">{{ formatStorageSize(dbStats.storageSize) }}</p>
            <p class="stat-label">Database Size</p>
          </div>
        </div>
      </div>

      <!-- Recent Sessions -->
      <div class="metric-section">
        <h3>Recent Sessions</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Date</th>
                <th>Items Found</th>
                <th>Status</th>
                <th>Query</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="session in recentSessions" :key="session.id">
                <td>#{{ session.id }}</td>
                <td>{{ formatDate(session.created_at) }}</td>
                <td>{{ session.total_items }}</td>
                <td>
                  <span :class="['status-badge', session.status]">
                    {{ session.status }}
                  </span>
                </td>
                <td>{{ session.search_query }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Performance Metrics -->
      <div class="metric-section">
        <h3>Performance Analysis</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <h4>Average Items/Session</h4>
            <p class="stat-value">{{ performanceStats.avgItemsPerSession }}</p>
          </div>
          <div class="stat-card">
            <h4>Success Rate</h4>
            <p class="stat-value">{{ performanceStats.successRate }}%</p>
          </div>
          <div class="stat-card">
            <h4>Total Runtime</h4>
            <p class="stat-value">{{ formatDuration(performanceStats.totalRuntime) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const router = useRouter()
const { data: metrics, pending, error } = useFetch('/api/scraper/detailed-metrics')

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
</style> 