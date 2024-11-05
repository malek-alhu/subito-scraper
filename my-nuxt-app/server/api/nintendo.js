export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'origin': 'https://www.subito.it',
    'pragma': 'no-cache',
    'referer': 'https://www.subito.it/',
    'x-subito-channel': 'web',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  }

  try {
    const itemsPerPage = 100
    const totalItemsToFetch = parseInt(query.totalItems) || 100
    const delay = 100 // 0.1 second delay
    const concurrentLimit = 10

    // Calculate how many requests we need
    const totalRequests = Math.ceil(totalItemsToFetch / itemsPerPage)
    const batches = []

    // Create batches of requests
    for (let i = 0; i < totalRequests; i += concurrentLimit) {
      const batchRequests = []
      const batchSize = Math.min(concurrentLimit, totalRequests - i)

      for (let j = 0; j < batchSize; j++) {
        const currentStart = (i + j) * itemsPerPage
        const fetchPromise = fetch(
          `https://hades.subito.it/v1/search/items?q=${query.q || 'nintendo'}&t=s&sort=${query.sort || 'datedesc'}&lim=${itemsPerPage}&start=${currentStart}`,
          {
            headers: headers,
            method: 'GET'
          }
        ).then(response => {
          if (!response.ok) throw new Error('Failed to fetch data')
          return response.json()
        })

        batchRequests.push(fetchPromise)
      }

      // Execute batch and wait for delay
      const batchResults = await Promise.all(batchRequests)
      batches.push(...batchResults)

      // Only delay if there are more batches to come
      if (i + concurrentLimit < totalRequests) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // Process results
    const allItems = batches.map((data, index) => {
      if (index === 0) {
        return {
          count_all: data.count_all,
          ads: data.ads
        }
      }
      return {
        ads: data.ads
      }
    }).filter(item => item.ads && item.ads.length > 0)

    return allItems

  } catch (error) {
    console.error('Error details:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Error fetching items: ' + error.message
    })
  }
}) 