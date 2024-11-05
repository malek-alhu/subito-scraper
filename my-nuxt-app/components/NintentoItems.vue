<template>
  <div class="container">
    <h1 class="title">Nintendo Items</h1>
    
    <div v-if="loading" class="loader-container">
      <div class="loader"></div>
    </div>
    
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    
    <div v-else>
      <div class="cards-grid">
        <div v-for="ad in items?.ads" 
             :key="ad.urn" 
             class="card">
          
          <div class="card-content">
            <!-- Title -->
            <h2 class="card-title">
              {{ ad.subject }}
            </h2>
            
            <!-- Body -->
            <p class="card-body">
              {{ ad.body }}
            </p>
            
            <!-- Date -->
            <div class="date-container">
              <span class="date-icon">📅</span>
              {{ formatDate(ad.dates?.display) }}
            </div>
          </div>
          
          <!-- Price Tag -->
          <div v-if="ad.price?.value" class="price-tag">
            {{ ad.price.value }} {{ ad.price.currency }}
          </div>
        </div>
      </div>
      
      <!-- Total Items Counter -->
      <div class="total-counter">
        <span>Total Items: {{ items?.count_all }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
const loading = ref(true)
const error = ref(null)
const items = ref(null)

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

onMounted(async () => {
  try {
    const { data } = await useFetch('/api/nintendo')
    items.value = data.value
    console.log('Data structure:', data.value)
  } catch (e) {
    error.value = 'Error fetching data: ' + e.message
  } finally {
    loading.value = false
  }
})
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
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
</style> 