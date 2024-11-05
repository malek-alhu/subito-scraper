<template>
  <div>
    <h1>Nintendo Items</h1>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error">{{ error }}</div>
    <div v-else>
      <p>Data will be displayed here in a table format</p>
    </div>
  </div>
</template>

<script setup>
const loading = ref(true)
const error = ref(null)
const items = ref([])

// Testing endpoint accessibility through our proxy
onMounted(async () => {
  try {
    const { data } = await useFetch('/api/nintendo')
    items.value = data.value
    console.log('Data structure:', data.value) // This will help us see the data structure
  } catch (e) {
    error.value = 'Error fetching data: ' + e.message
  } finally {
    loading.value = false
  }
})
</script> 