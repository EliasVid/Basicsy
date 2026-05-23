import { put } from '@vercel/blob';
import { getRedisClient } from './_redis.js'; // Ensure your Redis connector helper path is correct

const CATALOG_URL = 'https://xg6snmqaui2yqczf.public.blob.vercel-storage.com/data/catalog.json';
const CATALOG_BLOB_PATH = 'data/catalog.json';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = request.body;
    if (!id) {
      return response.status(400).json({ error: 'Missing product ID parameters' });
    }

    // 1. DOWNLOAD SYSTEM FILE LINK DIRECTLY
    const currentFileResponse = await fetch(CATALOG_URL);
    if (!currentFileResponse.ok) {
      return response.status(404).json({ error: 'Catalog data archive empty' });
    }
    
    let catalog = await currentFileResponse.json();
    
    // Find the product match first so we can read its variations before deletion
    const targetProduct = catalog.find(product => product.id === id);

    if (!targetProduct) {
      return response.status(404).json({ error: 'Product not found in current inventory dataset' });
    }

    // 2. WIPE MATCHING VARIANT KEYS FROM VERCEL KV (REDIS)
    if (targetProduct.variants && Array.isArray(targetProduct.variants)) {
      const redis = getRedisClient();
      const pipeline = redis.multi();

      targetProduct.variants.forEach(variant => {
        if (variant.color && variant.size) {
          const redisKey = `stock:${id}:${variant.color.toLowerCase()}:${variant.size}`;
          pipeline.del(redisKey);
        }
      });

      await pipeline.exec();
    }

    // 3. FILTER OUT PRODUCT FROM BLOB CATALOG
    catalog = catalog.filter(product => product.id !== id);

    // 4. OVERWRITE ARCHIVE STATE IN VERCEL BLOB
    await put(CATALOG_BLOB_PATH, JSON.stringify(catalog, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    });

    return response.status(200).json({ success: true, message: 'Product and associated stock keys removed successfully' });

  } catch (error) {
    console.error("Error running delete-product sync pipeline:", error);
    return response.status(500).json({ error: error.message });
  }
}