import { put } from '@vercel/blob';

const CATALOG_URL = 'https://xg6snmqaui2yqczf.public.blob.vercel-storage.com/data/catalog.json';
const CATALOG_BLOB_PATH = 'data/catalog.json';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, price, description, imageUrl, category, sizes, colors, variants, images } = request.body;

    // 1. DOWNLOAD DIRECTLY: No list() required
    let catalog = [];
    const currentFileResponse = await fetch(CATALOG_URL);
    
    if (currentFileResponse.ok) {
      catalog = await currentFileResponse.json();
    } else if (currentFileResponse.status !== 404) {
      // If it's a 500 or network error, fail safely so we don't accidentally overwrite data with an empty array
      throw new Error('Failed to reach storage locker');
    }

    // 2. MODIFY
    const newProduct = {
      id: Date.now().toString(),
      name,
      price: parseFloat(price),
      description: description || "",
      image: imageUrl,
      images: images || (imageUrl ? [imageUrl] : []),
      category,
      sizes: sizes || [],
      colors: colors || [],
      variants: variants || [] 
    };
    catalog.push(newProduct);

    // 3. OVERWRITE (put() is mandatory to save changes)
    await put(CATALOG_BLOB_PATH, JSON.stringify(catalog, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false // Crucial to keep the link permanent!
    });

    return response.status(200).json({ success: true, product: newProduct });

  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}