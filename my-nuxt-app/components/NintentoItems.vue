<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold mb-4">Nintendo Items</h1>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error">{{ error }}</div>
    <div v-else>
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr class="bg-gray-100">
              <th class="border p-2">Type</th>
              <th class="border p-2">Category</th>
              <th class="border p-2">Title</th>
              <th class="border p-2">Price</th>
              <th class="border p-2">Location</th>
              <th class="border p-2">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ad in items?.ads" :key="ad.urn" class="hover:bg-gray-50">
              <td class="border p-2">{{ ad.type?.value }}</td>
              <td class="border p-2">{{ ad.category?.value }}</td>
              <td class="border p-2">{{ ad.subject }}</td>
              <td class="border p-2">{{ ad.price?.value }} {{ ad.price?.currency }}</td>
              <td class="border p-2">{{ ad.geo?.city }}, {{ ad.geo?.region }}</td>
              <td class="border p-2">{{ formatDate(ad.dates?.display) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-4">
        <p>Total Items: {{ items?.count_all }}</p>
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
  return new Date(dateString).toLocaleDateString()
}

// Testing endpoint accessibility through our proxy
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
table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  text-align: left;
}

tr:nth-child(even) {
  background-color: #f9f9f9;
}
</style> 