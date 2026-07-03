import { getRedisClient } from './_redis.js';
const CATALOG_URL = 'https://xg6snmqaui2yqczf.public.blob.vercel-storage.com/data/catalog.json';

export default async function handler(request, response) {
  try {
    // 1. Fetch from Vercel Blob with cache-busting timestamp and explicit headers
    const currentFileResponse = await fetch(`${CATALOG_URL}?t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (currentFileResponse.status === 404) {
      return response.status(200).json([]);
    }
    
    // 2. Safe JSON Parsing safeguard (handles empty strings or interrupted writes gracefully)
    let catalogData;
    try {
      catalogData = await currentFileResponse.json();
    } catch (parseError) {
      console.warn("Warning: Catalog JSON is empty or malformed. Defaulting to empty array.");
      return response.status(200).json([]);
    }
    
    // Ensure catalogData is an array before proceeding
    if (!Array.isArray(catalogData)) {
      return response.status(200).json([]);
    }

    const redis = getRedisClient();
    // SAFEGUARD: Ensure Redis client was successfully initialized
    if (!redis) {
      throw new Error("Redis client failed to initialize. Check environment variables.");
    }

    // 3. Gather all variant keys safely
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

    // If there are no keys to look up, bypass Redis entirely
    if (keysToFetch.length === 0) {
      return response.status(200).json(catalogData);
    }

    // 4. Fetch from Redis safely (Fallback to empty array if mget returns something unexpected)
    const stockValues = (await redis.mget(keysToFetch)) || [];

    // 5. Rehydrate values cleanly (FIXED INDEX LOGIC)
    let keyIndex = 0;
    const hydratedCatalog = catalogData.map(product => {
      const updatedVariants = (product.variants || []).map(v => {
        // ONLY read from stockValues if this variant actually matches the key criteria
        if (v.color && v.size) {
          // Safeguard: make sure we don't read out of bounds if arrays mismatch
          const redisValue = Array.isArray(stockValues) ? stockValues[keyIndex++] : null;
          
          return { 
            ...v, 
            stock: redisValue !== null && redisValue !== undefined ? parseInt(redisValue, 10) : 0 
          };
        }
        
        // Default fallback for variants without color/size criteria
        return { ...v, stock: 0 };
      });
      return { ...product, variants: updatedVariants };
    });

    return response.status(200).json(hydratedCatalog);

  } catch (error) {
    console.error("Backend Error in get-catalog:", error);
    // Returns the actual error message to your browser console to help you debug live
    return response.status(500).json({ error: error.message || "Internal Server Error" });
  }
}