<template>
  <div class="timer-status">
    <h2>Server Timer Status</h2>
    <div v-if="pending">Loading...</div>
    <div v-else-if="error">Error loading status</div>
    <div v-else class="status-info">
      <div class="status-card">
        <h3>Timer Info</h3>
        <p>Last Check: {{ new Date(status?.lastCheck).toLocaleString() }}</p>
        <p>Check Count: {{ status?.checkCount }}</p>
        <p>Status: <span class="status-badge" :class="status?.isInitialized ? 'active' : 'inactive'">
          {{ status?.isInitialized ? 'Active' : 'Inactive' }}
        </span></p>
      </div>
      
      <div class="status-card">
        <h3>Next Scheduled Runs</h3>
        <p>Next check in: {{ getNextCheckTime() }}</p>
        <p class="schedule-info">Schedule: Every 30 seconds</p>
      </div>
    </div>

    <div class="status-card">
      <h3>Supabase Connection Test</h3>
      <div v-if="dbError" class="error-message">
        {{ dbError }}
      </div>
      <div v-if="dbData" class="success-message">
        Connection successful!
        <pre>{{ JSON.stringify(dbData, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
const { supabase } = useSupabase()

const { data: status, pending, error } = useFetch('/api/timer/status', {
  refresh: true,
  refreshInterval: 5000,
  keepPreviousData: true
})

function getNextCheckTime() {
  if (!status.value?.lastCheck) return 'Calculating...'
  
  const lastCheck = new Date(status.value.lastCheck)
  const nextCheck = new Date(lastCheck.getTime() + 30000) // 30 seconds
  const now = new Date()
  const timeLeft = nextCheck - now

  if (timeLeft < 0) return 'Due now'
  return `${Math.ceil(timeLeft / 1000)} seconds`
}

// Test Supabase connection
const dbData = ref(null)
const dbError = ref(null)

async function testConnection() {
  try {
    // First try to select from the table
    const { data, error } = await supabase
      .from('connection_test')
      .select('*')
      .limit(1)

    if (error) {
      if (error.code === '42P01') { // Table doesn't exist error
        dbError.value = 'Please create the connection_test table first'
      } else {
        dbError.value = error.message
      }
      return
    }
    
    dbData.value = data
    dbError.value = null
  } catch (err) {
    console.error('Supabase connection error:', err)
    dbError.value = err.message
  }
}

// Run the test when component mounts
onMounted(() => {
  testConnection()
})
</script>

<style scoped>
.timer-status {
  padding: 1rem;
  margin: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.status-info {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.status-card {
  background: white;
  padding: 1rem;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.status-card h3 {
  margin-top: 0;
  color: #2c3e50;
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-badge.active {
  background-color: #4ade80;
  color: #064e3b;
}

.status-badge.inactive {
  background-color: #f87171;
  color: #7f1d1d;
}

.schedule-info {
  color: #666;
  font-size: 0.9rem;
}

p {
  margin: 0.5rem 0;
}

.error-message {
  color: #dc2626;
  padding: 0.5rem;
  background-color: #fee2e2;
  border-radius: 4px;
  margin: 0.5rem 0;
}

.success-message {
  color: #059669;
  padding: 0.5rem;
  background-color: #d1fae5;
  border-radius: 4px;
  margin: 0.5rem 0;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  background: #f8f8f8;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
}
</style> 