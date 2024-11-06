export const SCRAPER_CONFIG = {
  baseUrl: 'https://hades.subito.it/v1/search/items',
  searchParams: {
    q: 'moneta rara',
    t: 's',
    qso: 'false',
    shp: 'false',
    urg: 'false',
    sort: 'datedesc'
  },
  pagination: {
    itemsPerPage: 30,
    maxConcurrentRequests: 3
  },
  schedule: {
    interval: '0 */6 * * *' // Every 6 hours
  }
} 