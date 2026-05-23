import { getRedisClient } from './_redis.js';

export default async function handler(req, res) {
  const redis = getRedisClient();

  const keys = await redis.keys('*');

  const result = [];

  for (const key of keys) {
    const value = await redis.get(key);
    result.push({ key, value });
  }

  res.json(result);
}