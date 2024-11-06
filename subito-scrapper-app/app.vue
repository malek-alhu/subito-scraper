<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup>
// Disable Vercel analytics
if (typeof window !== 'undefined') {
  window.va = function() {}
}
</script>
