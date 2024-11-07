export const SCRAPER_CONFIG = {
  baseUrl: 'https://hades.subito.it/v1/search/items',
  searchParams: {
    q: 'nintendo',
    t: 's',
    qso: 'false',
    shp: 'false',
    urg: 'false',
    sort: 'datedesc'
  },
  pagination: {
    itemsPerPage: 100,
    maxConcurrentRequests: 10,
    requestDelay: 1000,
    batchDelay: 1000
  },
  schedule: {
    interval: '0 */6 * * *'
  }
}