<template>
  <div class="deals-component">
    <div class="header">
      <h1>🔥 Good Deals</h1>
      <p class="subtitle">Find the best deals on Subito.it with price tracking and alerts</p>
    </div>

    <!-- Deal Stats -->
    <div v-if="stats?.stats" class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.stats.deals?.total_deals || 0 }}</div>
          <div class="stat-label">Total Deals (7 days)</div>
        </div>
      </div>

      <div class="stat-card great-deals">
        <div class="stat-icon">⭐</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.stats.deals?.great_deals || 0 }}</div>
          <div class="stat-label">Great Deals</div>
        </div>
      </div>

      <div class="stat-card price-drops">
        <div class="stat-icon">📉</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.stats.deals?.price_drops || 0 }}</div>
          <div class="stat-label">Price Drops</div>
        </div>
      </div>

      <div class="stat-card savings">
        <div class="stat-icon">💰</div>
        <div class="stat-content">
          <div class="stat-value">{{ formatCurrency(stats.stats.priceDrops?.total_savings) }}</div>
          <div class="stat-label">Total Savings</div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select v-model="selectedType" @change="loadDeals" class="filter-select">
        <option value="">All Deal Types</option>
        <option value="great_deal">Great Deals</option>
        <option value="price_drop">Price Drops</option>
        <option value="below_average">Below Average</option>
      </select>

      <input
        v-model.number="minScore"
        type="number"
        min="0"
        max="100"
        placeholder="Min Score (0-100)"
        @change="loadDeals"
        class="filter-input"
      />

      <button @click="loadDeals" class="refresh-button">🔄 Refresh</button>
    </div>

    <!-- Deals Grid -->
    <div v-if="pending" class="loading">
      <div class="spinner"></div>
      <p>Loading deals...</p>
    </div>

    <div v-else-if="error" class="error-message">
      <p>❌ Error loading deals: {{ error.message }}</p>
    </div>

    <div v-else-if="deals?.deals?.length === 0" class="no-deals">
      <p>No deals found matching your criteria.</p>
      <p class="hint">Try adjusting the filters or wait for the next scrape.</p>
    </div>

    <div v-else class="deals-grid">
      <div
        v-for="deal in deals?.deals"
        :key="deal.id"
        class="deal-card"
        :class="getDealClass(deal.alert_type)"
      >
        <!-- Deal Badge -->
        <div class="deal-badge" :class="deal.alert_type">
          {{ formatDealType(deal.alert_type) }}
        </div>

        <!-- Deal Score -->
        <div class="deal-score">
          <div class="score-circle" :class="getScoreClass(deal.deal_score)">
            {{ Math.round(deal.deal_score) }}
          </div>
        </div>

        <!-- Image -->
        <div class="deal-image">
          <img
            v-if="deal.image_url"
            :src="deal.image_url"
            :alt="deal.title"
            @error="handleImageError"
          />
          <div v-else class="no-image">No Image</div>
        </div>

        <!-- Content -->
        <div class="deal-content">
          <h3 class="deal-title">{{ deal.title }}</h3>

          <div class="price-info">
            <div class="current-price">€{{ formatPrice(deal.price) }}</div>
            <div v-if="deal.average_price" class="avg-price">
              Avg: €{{ formatPrice(deal.average_price) }}
            </div>
          </div>

          <div v-if="deal.price_difference" class="savings">
            <span class="savings-amount">
              Save €{{ formatPrice(Math.abs(deal.price_difference)) }}
              ({{ Math.abs(deal.price_difference_percentage).toFixed(1) }}%)
            </span>
          </div>

          <div class="deal-meta">
            <span v-if="deal.category" class="meta-item">📁 {{ deal.category }}</span>
            <span v-if="deal.location" class="meta-item">📍 {{ deal.location }}</span>
          </div>

          <div class="deal-actions">
            <a
              v-if="deal.listing_url"
              :href="deal.listing_url"
              target="_blank"
              rel="noopener noreferrer"
              class="view-button"
            >
              👁️ View Listing
            </a>
            <button @click="dismissDeal(deal.id)" class="dismiss-button">
              ✕ Dismiss
            </button>
          </div>

          <div class="deal-footer">
            <small>Listed {{ formatTimeAgo(deal.created_at) }}</small>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="deals?.pagination" class="pagination">
      <button
        @click="previousPage"
        :disabled="currentPage === 0"
        class="page-button"
      >
        ← Previous
      </button>

      <span class="page-info">
        Showing {{ currentPage * pageLimit + 1 }}-{{ Math.min((currentPage + 1) * pageLimit, deals.pagination.total) }}
        of {{ deals.pagination.total }}
      </span>

      <button
        @click="nextPage"
        :disabled="!deals.pagination.hasMore"
        class="page-button"
      >
        Next →
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const selectedType = ref('');
const minScore = ref(20);
const currentPage = ref(0);
const pageLimit = ref(20);

const { data: deals, pending, error, refresh } = useFetch('/api/deals/list', {
  query: {
    type: selectedType,
    minScore,
    limit: pageLimit,
    offset: () => currentPage.value * pageLimit.value
  }
});

const { data: stats } = useFetch('/api/deals/stats', {
  refresh: true,
  refreshInterval: 60000 // Refresh every minute
});

async function loadDeals() {
  currentPage.value = 0;
  await refresh();
}

function nextPage() {
  currentPage.value++;
  refresh();
}

function previousPage() {
  if (currentPage.value > 0) {
    currentPage.value--;
    refresh();
  }
}

async function dismissDeal(dealId) {
  try {
    await $fetch('/api/deals/dismiss', {
      method: 'POST',
      body: { dealId }
    });
    await refresh();
  } catch (err) {
    console.error('Error dismissing deal:', err);
  }
}

function formatDealType(type) {
  const types = {
    great_deal: '⭐ Great Deal',
    price_drop: '📉 Price Drop',
    below_average: '💰 Below Average',
    new_listing: '🆕 New Listing'
  };
  return types[type] || type;
}

function getDealClass(type) {
  return `deal-type-${type}`;
}

function getScoreClass(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'very-good';
  if (score >= 40) return 'good';
  return 'fair';
}

function formatPrice(price) {
  if (!price) return '0.00';
  return parseFloat(price).toFixed(2);
}

function formatCurrency(amount) {
  if (!amount) return '€0';
  return `€${parseFloat(amount).toFixed(0)}`;
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Unknown';

  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function handleImageError(e) {
  e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23ddd" width="400" height="300"/><text x="50%" y="50%" font-size="18" fill="%23999" text-anchor="middle" dy=".3em">No Image</text></svg>';
}
</script>

<style scoped>
.deals-component {
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  font-size: 2.5em;
  margin-bottom: 10px;
  color: #333;
}

.subtitle {
  color: #666;
  font-size: 1.1em;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 15px;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-card.great-deals {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-card.price-drops {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-card.savings {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.stat-icon {
  font-size: 2.5em;
}

.stat-value {
  font-size: 2em;
  font-weight: bold;
}

.stat-label {
  font-size: 0.9em;
  opacity: 0.8;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.filter-select,
.filter-input {
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1em;
  background: white;
}

.filter-input {
  width: 200px;
}

.refresh-button {
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1em;
  transition: background 0.3s;
}

.refresh-button:hover {
  background: #45a049;
}

.loading {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 20px;
  border-radius: 5px;
  text-align: center;
}

.no-deals {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.hint {
  margin-top: 10px;
  font-size: 0.9em;
  color: #999;
}

.deals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 25px;
  margin-bottom: 30px;
}

.deal-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
  position: relative;
}

.deal-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.deal-card.deal-type-great_deal {
  border-top: 4px solid #667eea;
}

.deal-card.deal-type-price_drop {
  border-top: 4px solid #f5576c;
}

.deal-card.deal-type-below_average {
  border-top: 4px solid #4facfe;
}

.deal-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 0.85em;
  font-weight: bold;
  z-index: 2;
}

.deal-score {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
}

.score-circle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.2em;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.score-circle.excellent {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.score-circle.very-good {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.score-circle.good {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.score-circle.fair {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
  color: #333;
}

.deal-image {
  width: 100%;
  height: 200px;
  overflow: hidden;
  background: #f5f5f5;
}

.deal-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  background: #f0f0f0;
}

.deal-content {
  padding: 15px;
}

.deal-title {
  font-size: 1.1em;
  margin-bottom: 10px;
  color: #333;
  height: 2.4em;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.price-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.current-price {
  font-size: 1.8em;
  font-weight: bold;
  color: #4CAF50;
}

.avg-price {
  font-size: 0.9em;
  color: #999;
  text-decoration: line-through;
}

.savings {
  background: #e8f5e9;
  color: #2e7d32;
  padding: 8px 12px;
  border-radius: 5px;
  margin-bottom: 10px;
  font-weight: 500;
}

.savings-amount {
  display: flex;
  align-items: center;
  gap: 5px;
}

.deal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
  font-size: 0.9em;
  color: #666;
}

.meta-item {
  display: inline-block;
}

.deal-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.view-button,
.dismiss-button {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.95em;
  transition: all 0.3s;
  text-decoration: none;
  text-align: center;
  font-weight: 500;
}

.view-button {
  background: #4CAF50;
  color: white;
}

.view-button:hover {
  background: #45a049;
}

.dismiss-button {
  background: #f5f5f5;
  color: #666;
}

.dismiss-button:hover {
  background: #e0e0e0;
}

.deal-footer {
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
  color: #999;
  font-size: 0.85em;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  padding: 20px;
}

.page-button {
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1em;
  transition: background 0.3s;
}

.page-button:hover:not(:disabled) {
  background: #45a049;
}

.page-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.page-info {
  font-weight: 500;
  color: #666;
}
</style>
