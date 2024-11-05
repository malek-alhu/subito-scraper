export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*'
  })
  
  if (getMethod(event) === 'OPTIONS') {
    return 'OK'
  }
}) 