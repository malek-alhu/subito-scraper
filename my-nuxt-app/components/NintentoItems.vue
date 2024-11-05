<template>
  <div class="container">
    <h1 class="title">Subito API Scraper</h1>
    
    <!-- Current Endpoint Display -->
    <div class="endpoint-display">
      <p>Current Endpoint:</p>
      <code>{{ currentEndpoint }}</code>
    </div>

    <!-- Search Form -->
    <div class="search-form">
      <div class="form-group">
        <label>Search Query:</label>
        <input 
          v-model="searchParams.query" 
          type="text" 
          placeholder="e.g., nintendo switch"
        >
      </div>
      <div class="form-group">
        <label>Sort By:</label>
        <select v-model="searchParams.sort">
          <option value="datedesc">Date (Newest First)</option>
          <option value="dateasc">Date (Oldest First)</option>
          <option value="pricedesc">Price (Highest First)</option>
          <option value="priceasc">Price (Lowest First)</option>
          <option value="relevance">Relevance</option>
        </select>
      </div>
      <div class="form-group">
        <label>Items per Page:</label>
        <input 
          v-model.number="searchParams.limit" 
          type="number" 
          min="1" 
          max="100"
        >
      </div>
      <div class="form-group">
        <label>Total Items to Fetch:</label>
        <input 
          v-model.number="searchParams.totalItems" 
          type="number" 
          min="1"
        >
      </div>
      <button @click="fetchAllItems" :disabled="loading" class="search-button">
        {{ loading ? 'Fetching...' : 'Search' }}
      </button>
    </div>
    
    <div v-if="loading" class="loader-container">
      <div class="loader"></div>
    </div>
    
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    
    <div v-else>
      <!-- Progress Bar -->
      <div v-if="isLoadingMore" class="progress-bar">
        <div class="progress" :style="{ width: `${progressPercentage}%` }"></div>
        <span class="progress-text">
          Fetched {{ allItems.length }} of {{ searchParams.totalItems }} items
        </span>
      </div>

      <div class="cards-grid">
        <div v-for="ad in allItems" 
             :key="ad.urn" 
             class="card">
          <div class="card-content">
            <h2 class="card-title">
              {{ ad.subject }}
              <span v-if="getPrice(ad)" class="card-price">
                {{ getPrice(ad) }}
              </span>
            </h2>
            <p class="card-body">
              {{ ad.body }}
            </p>
            <div class="date-container">
              <span class="date-icon">📅</span>
              {{ formatDate(ad.dates?.display) }}
            </div>
          </div>
        </div>
      </div>
      
      <div class="total-counter">
        <span>Showing {{ allItems.length }} Items</span>
      </div>
    </div>
  </div>
</template>

<script setup>
const loading = ref(false)
const error = ref(null)
const allItems = ref([])
const isLoadingMore = ref(false)
const progressPercentage = ref(0)

const searchParams = ref({
  query: 'nintendo',
  limit: 30,
  totalItems: 100,
  start: 0,
  sort: 'datedesc'
})

// Computed property for displaying current endpoint
const currentEndpoint = computed(() => {
  return `https://hades.subito.it/v1/search/items?q=${searchParams.value.query}&t=s&sort=${searchParams.value.sort}&lim=${searchParams.value.limit}&start=${searchParams.value.start}`
})

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchItems(start) {
  const response = await useFetch('/api/nintendo', {
    params: {
      q: searchParams.value.query,
      lim: searchParams.value.limit,
      start: start,
      sort: searchParams.value.sort
    }
  })
  
  if (response.error.value) {
    throw new Error('Failed to fetch items')
  }
  
  return response.data.value
}

async function fetchAllItems() {
  try {
    loading.value = true
    error.value = null
    allItems.value = []
    isLoadingMore.value = true
    
    let currentStart = 0
    
    while (allItems.value.length < searchParams.value.totalItems) {
      const data = await fetchItems(currentStart)
      
      if (!data?.ads?.length) {
        break // No more items available
      }
      
      allItems.value.push(...data.ads)
      currentStart += searchParams.value.limit
      
      // Calculate progress
      progressPercentage.value = (allItems.value.length / searchParams.value.totalItems) * 100
      
      // Add a small delay to prevent rate limiting
      await sleep(1000)
    }
    
  } catch (e) {
    error.value = 'Error fetching data: ' + e.message
  } finally {
    loading.value = false
    isLoadingMore.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('it-IT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Add this function to extract price from features
const getPrice = (ad) => {
  const priceFeature = ad.features?.find(feature => feature.uri === '/price')
  return priceFeature?.values?.[0]?.value || null
}

// Initial fetch
onMounted(fetchAllItems)
</script>

<style scoped>
.container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.title {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
  color: #4f46e5;
}

.loader-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.loader {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4f46e5;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background-color: #fee2e2;
  border-left: 4px solid #ef4444;
  color: #991b1b;
  padding: 1rem;
  border-radius: 4px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.card {
  position: relative;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
  overflow: hidden;
}

.card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.card-content {
  padding: 1.5rem;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.card-price {
  color: #4f46e5;
  font-size: 1.1rem;
  white-space: nowrap;
}

.card-body {
  color: #4b5563;
  margin-bottom: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card:hover .card-title,
.card:hover .card-body {
  -webkit-line-clamp: unset;
}

.date-container {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: #6b7280;
}

.date-icon {
  margin-right: 0.5rem;
}

.price-tag {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background-color: #4f46e5;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
}

.total-counter {
  text-align: center;
  margin-top: 2rem;
}

.total-counter span {
  background-color: #e0e7ff;
  color: #4f46e5;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 1.125rem;
  font-weight: 500;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }
  
  .cards-grid {
    grid-template-columns: 1fr;
  }
}

/* New styles for search form */
.search-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background-color: #f9fafb;
  border-radius: 8px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #374151;
}

.form-group input {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 1rem;
}

.search-button {
  padding: 0.5rem 1rem;
  background-color: #4f46e5;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
  align-self: flex-end;
}

.search-button:hover {
  background-color: #4338ca;
}

.search-button:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

/* Progress bar styles */
.progress-bar {
  margin: 1rem 0;
  background-color: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
  height: 20px;
  position: relative;
}

.progress {
  height: 100%;
  background-color: #4f46e5;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #1f2937;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Add these new styles */
.endpoint-display {
  background-color: #1f2937;
  color: #e5e7eb;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  overflow-x: auto;
}

.endpoint-display p {
  color: #9ca3af;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.endpoint-display code {
  font-family: monospace;
  word-break: break-all;
}

select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 1rem;
  background-color: white;
  width: 100%;
}
</style> 