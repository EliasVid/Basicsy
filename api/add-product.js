import { put } from '@vercel/blob';
import { getRedisClient } from './_redis.js';

const CATALOG_URL = 'https://xg6snmqaui2yqczf.public.blob.vercel-storage.com/data/catalog.json';
const CATALOG_BLOB_PATH = 'data/catalog.json';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, price, description, imageUrl, category, sizes, colors, variants, images } = request.body;

    let catalog = [];
    const currentFileResponse = await fetch(CATALOG_URL);
    if (currentFileResponse.ok) {
      catalog = await currentFileResponse.json();
    }

    const newProductId = Date.now().toString();
    const redis = getRedisClient();

    // ioredis pipelines are created with .pipeline()
    const pipeline = redis.pipeline();
    variants.forEach(v => {
      const redisKey = `stock:${newProductId}:${v.color.toLowerCase()}:${v.size}`;
      pipeline.set(redisKey, parseInt(v.stock, 10));
    });
    await pipeline.exec();

    const cleanVariantsForBlob = variants.map(v => ({ color: v.color, size: v.size }));

    const newProduct = {
      id: newProductId,
      name,
      price: parseFloat(price),
      description: description || "",
      image: imageUrl,
      images: images || (imageUrl ? [imageUrl] : []),
      category,
      sizes: sizes || [],
      colors: colors || [],
      variants: cleanVariantsForBlob
    };

    catalog.push(newProduct);

    await put(CATALOG_BLOB_PATH, JSON.stringify(catalog, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    });

    return response.status(200).json({ success: true, product: newProduct });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}