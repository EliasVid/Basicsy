import { getRedisClient } from './_redis.js';

export default async function handler(req, res) {
  try {
    const redis = getRedisClient();

    // Safe alternative to keys('*') using a stream scan
    let keys = [];
    let cursor = '0';
    
    do {
      // Scans up to 100 keys at a time without locking up the database
      const reply = await redis.scan(cursor, 'MATCH', '*', 'COUNT', 100);
      cursor = reply[0];
      keys.push(...reply[1]);
    } while (cursor !== '0' && keys.length < 500); // Guard limit to prevent serverless execution timeouts

    if (keys.length === 0) {
      return res.status(200).json({ message: "Database is completely empty.", data: [] });
    }

    const result = [];
    for (const key of keys) {
      const value = await redis.get(key);
      result.push({ key, value });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Failed to read Redis data:", error);
    // Returning the exact error stack directly helps diagnose connection issues instantly
    return res.status(500).json({ 
      error: "Redis Connection Error", 
      message: error.message,
      stack: error.stack 
    });
  }
}