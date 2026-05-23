import { put } from '@vercel/blob';

const CATALOG_URL = 'https://xg6snmqaui2yqczf.public.blob.vercel-storage.com/data/catalog.json';
const CATALOG_BLOB_PATH = 'data/catalog.json';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, name, price, description, imageUrl, category, sizes, colors, variants, images } = request.body;

    // 1. DOWNLOAD DIRECTLY: Direct fetch optimization
    const currentFileResponse = await fetch(CATALOG_URL);
    if (!currentFileResponse.ok) {
      return response.status(404).json({ error: 'Catalog file not found' });
    }
    
    let catalog = await currentFileResponse.json();
    const productIndex = catalog.findIndex(p => p.id === id);

    if (productIndex === -1) {
      return response.status(404).json({ error: 'Product not found' });
    }

    // Retain old images if none were uploaded
    const finalImageUrl = imageUrl || catalog[productIndex].image;
    const finalImagesArray = (images && images.length > 0) ? images : catalog[productIndex].images;

    // 2. MODIFY
    catalog[productIndex] = {
      ...catalog[productIndex],
      name,
      price: parseFloat(price),
      description: description || "",
      image: finalImageUrl,
      images: finalImagesArray || (finalImageUrl ? [finalImageUrl] : []),
      category,
      sizes: sizes || [],
      colors: colors || [],
      variants: variants || []
    };

    // 3. OVERWRITE
    await put(CATALOG_BLOB_PATH, JSON.stringify(catalog, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    });

    return response.status(200).json({ success: true, product: catalog[productIndex] });

  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}