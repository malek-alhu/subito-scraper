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
    const response = await fetch(
      `https://hades.subito.it/v1/search/items?q=${query.q || 'nintendo'}&t=s&sort=datedesc&lim=${query.lim || 30}&start=${query.start || 0}`,
      {
        headers: headers,
        method: 'GET'
      }
    )
    
    if (!response.ok) {
      throw new Error('Failed to fetch data')
    }
    
    return await response.json()
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Error fetching Nintendo items',
    })
  }
}) 