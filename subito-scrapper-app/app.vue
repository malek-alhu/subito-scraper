<template>
  <div class="app-container">
    <nav class="main-nav">
      <div class="nav-content">
        <div class="nav-brand">
          <h1>🛍️ Subito Scraper</h1>
        </div>
        <div class="nav-links">
          <NuxtLink to="/" class="nav-link">Dashboard</NuxtLink>
          <NuxtLink to="/deals" class="nav-link">Good Deals</NuxtLink>
          <NuxtLink to="/metrics" class="nav-link">Metrics</NuxtLink>
        </div>
      </div>
    </nav>

    <main class="main-content">
      <NuxtPage />
    </main>

    <footer class="app-footer">
      <p>Subito Scraper - Real-time deal tracking for Subito.it</p>
    </footer>
  </div>
</template>

<script setup>
// Disable Vercel analytics
if (typeof window !== 'undefined') {
  window.va = function() {}
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background-color: #f5f7fa;
  color: #333;
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-nav {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 70px;
}

.nav-brand h1 {
  font-size: 1.5em;
  font-weight: 600;
}

.nav-links {
  display: flex;
  gap: 30px;
}

.nav-link {
  color: white;
  text-decoration: none;
  font-weight: 500;
  font-size: 1.05em;
  padding: 8px 16px;
  border-radius: 5px;
  transition: all 0.3s;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.2);
}

.nav-link.router-link-active {
  background: rgba(255, 255, 255, 0.25);
  font-weight: 600;
}

.main-content {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 20px;
}

.app-footer {
  background: #2d3748;
  color: white;
  text-align: center;
  padding: 20px;
  margin-top: 50px;
}

.app-footer p {
  opacity: 0.8;
}

@media (max-width: 768px) {
  .nav-content {
    flex-direction: column;
    height: auto;
    padding: 15px 20px;
    gap: 15px;
  }

  .nav-links {
    gap: 15px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .nav-brand h1 {
    font-size: 1.2em;
  }

  .nav-link {
    font-size: 0.95em;
    padding: 6px 12px;
  }
}
</style>
