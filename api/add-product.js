import { put, list } from '@vercel/blob';

const CATALOG_BLOB_PATH = 'data/catalog.json';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, price, description, imageUrl, category, sizes, colors, stock} = request.body;

    // 1. DOWNLOAD: Look inside your cloud storage locker to see if catalog.json exists
    let catalog = [];
    const { blobs } = await list({ prefix: CATALOG_BLOB_PATH });
    
    if (blobs.length > 0) {
      // If it exists, fetch the text data directly from its public cloud URL link
      const currentFileResponse = await fetch(blobs[0].url);
      catalog = await currentFileResponse.json();
    }

    // 2. MODIFY: Build your new item package and push it into the array list
    const newProduct = {
      id: Date.now().toString(),
      name,
      price,
      description: description || "",
      image: imageUrl,
      category,
      sizes: sizes || [],
      colors: colors || [],
      stock: stock || 0
    };
    catalog.push(newProduct);

    // 3. OVERWRITE: Send the updated array string right back up to Vercel Blob storage
    // This safely overwrites the old JSON file with your brand new list!
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