<template>
  <div class="deals-page">
    <DealsComponent />
  </div>
</template>

<script setup>
useHead({
  title: 'Good Deals - Subito Scraper',
  meta: [
    { name: 'description', content: 'Find the best deals on Subito.it' }
  ]
})
</script>

<style scoped>
.deals-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}
</style>
