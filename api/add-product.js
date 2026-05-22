import { put, list } from '@vercel/blob';

const CATALOG_BLOB_PATH = 'data/catalog.json';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Added "images" to the destructured body parameters
    const { name, price, description, imageUrl, category, sizes, colors, variants, images } = request.body;

    // 1. DOWNLOAD: Look inside your cloud storage locker to see if catalog.json exists
    let catalog = [];
    const { blobs } = await list({ prefix: CATALOG_BLOB_PATH });
    
    if (blobs.length > 0) {
      // If it exists, fetch the text data directly from its public cloud URL link
      const currentFileResponse = await fetch(blobs[0].url);
      catalog = await currentFileResponse.json();
    }

    // 2. MODIFY: Build your new item package containing the variant inventory matrix
    const newProduct = {
      id: Date.now().toString(),
      name,
      price: parseFloat(price),
      description: description || "",
      image: imageUrl, // Your main grid image
      images: images || (imageUrl ? [imageUrl] : []), // Safely stores the full gallery array, falling back to main image if empty
      category,
      sizes: sizes || [],
      colors: colors || [],
      variants: variants || [] 
    };
    catalog.push(newProduct);

    // 3. OVERWRITE: Send the updated array string right back up to Vercel Blob storage
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