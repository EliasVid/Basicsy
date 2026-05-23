import { getRedisClient } from './_redis.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = getRedisClient();
    // Fetch the last 50 sales from the Redis list
    const sales = await redis.lrange('sales:history', 0, 49);
    
    // Parse the JSON strings stored in the list
    const parsedSales = sales.map(item => typeof item === 'string' ? JSON.parse(item) : item);

    return response.status(200).json(parsedSales);
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}