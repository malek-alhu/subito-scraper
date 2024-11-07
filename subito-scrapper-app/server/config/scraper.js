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
    itemsPerPage: 100,
    maxConcurrentRequests: 10,
    requestDelay: 100,
    batchDelay: 100
  },
  schedule: {
    interval: '0 */6 * * *'
  }
}