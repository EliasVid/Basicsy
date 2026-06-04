import { put } from '@vercel/blob';
import { getRedisClient } from './_redis.js';
import { verifyAdmin } from './_auth.js';

const CATALOG_URL = 'https://xg6snmqaui2yqczf.public.blob.vercel-storage.com/data/catalog.json';
const CATALOG_BLOB_PATH = 'data/catalog.json';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // ADMIN CHECK
  try {
    verifyAdmin(request);
  } catch {
    return response.status(401).json({ error: "Unauthorized" });
  }

  // ... (Keep your admin validation checks exactly as they are)

  try {
    const { name, price, description, imageUrl, category, sizes, colors, variants, images } = request.body;

    // STRICT BACKEND VALIDATION ENGINE
    if (!name || typeof name !== 'string' || name.trim() === "") {
      return response.status(400).json({ error: "El nombre del producto es requerido y debe ser un texto válido." });
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return response.status(400).json({ error: "El precio debe ser un número válido mayor que cero." });
    }

    if (!category || typeof category !== 'string' || category.trim() === "") {
      return response.status(400).json({ error: "La categoría es requerida." });
    }

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return response.status(400).json({ error: "El producto debe tener al menos una variante configurada." });
    }

    if (!imageUrl || !images || images.length === 0) {
      return response.status(400).json({ error: "El producto requiere al menos una imagen de catálogo válida." });
    }

    // 1. Fetch current catalog with cache-busting
    let catalog = [];
    const currentFileResponse = await fetch(`${CATALOG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (currentFileResponse.ok) {
      catalog = await currentFileResponse.json();
    }

    const newProductId = Date.now().toString();
    const redis = getRedisClient();

    // 2. Write Variant Stocks to Redis Safely
    const pipeline = redis.pipeline();
    variants.forEach(v => {
      if (v.color && v.size) {
        const redisKey = `stock:${newProductId}:${v.color.toLowerCase()}:${v.size}`;
        const parsedStock = parseInt(v.stock, 10);

        pipeline.set(redisKey, isNaN(parsedStock) ? 0 : parsedStock);
      }
    });
    await pipeline.exec();

    // 3. Prepare Clean Blob Data
    const cleanVariantsForBlob = variants.map(v => ({
      color: v.color,
      size: v.size
    }));

    const newProduct = {
      id: newProductId,
      name: name.trim(),
      price: parsedPrice,
      description: description ? description.trim() : "",
      image: imageUrl,
      images: Array.isArray(images) ? images : [imageUrl],
      category: category.trim(),
      sizes: Array.isArray(sizes) ? sizes : [],
      colors: Array.isArray(colors) ? colors : [],
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
    console.error("Backend Error in add-product:", error);
    return response.status(500).json({ error: error.message });
  }
}