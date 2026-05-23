import { getRedisClient } from './_redis.js';
const CATALOG_URL = 'https://xg6snmqaui2yqczf.public.blob.vercel-storage.com/data/catalog.json';

export default async function handler(request, response) {
  try {
    const currentFileResponse = await fetch(CATALOG_URL);
    if (currentFileResponse.status === 404) {
      return response.status(200).json([]);
    }
    
    const catalogData = await currentFileResponse.json();
    const redis = getRedisClient();

    // 1. Gather all variant keys safely
    const keysToFetch = [];
    catalogData.forEach(product => {
      if (product.variants && Array.isArray(product.variants)) {
        product.variants.forEach(v => {
          if (v.color && v.size) {
            keysToFetch.push(`stock:${product.id}:${v.color.toLowerCase()}:${v.size}`);
          }
        });
      }
    });

    // SAFEGUARD: If there are no structural variants to lookup, 
    // skip Redis entirely and return the default catalog structure!
    if (keysToFetch.length === 0) {
      return response.status(200).json(catalogData);
    }

    // 2. Fetch from Redis safely now that we know keysToFetch is NOT empty
    const stockValues = await redis.mget(keysToFetch);

    // 3. Rehydrate values cleanly
    let keyIndex = 0;
    const hydratedCatalog = catalogData.map(product => {
      const updatedVariants = (product.variants || []).map(v => {
        const redisValue = stockValues[keyIndex++];
        return { 
          ...v, 
          // If Redis doesn't have it, default to 0 stock instead of crashing
          stock: redisValue !== null ? parseInt(redisValue, 10) : 0 
        };
      });
      return { ...product, variants: updatedVariants };
    });

    // Always send back a structured JSON response
    return response.status(200).json(hydratedCatalog);

  } catch (error) {
    console.error("Backend Error in get-catalog:", error);
    // Explicit JSON fallback structure even during server crashes!
    return response.status(500).json({ error: error.message });
  }
}