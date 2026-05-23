import { put } from '@vercel/blob';

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
    
    // Check if the targeted item exists
    const initialLength = catalog.length;
    catalog = catalog.filter(product => product.id !== id);

    if (catalog.length === initialLength) {
      return response.status(404).json({ error: 'Product not found in current inventory dataset' });
    }

    // 2. OVERWRITE ARCHIVE STATE
    await put(CATALOG_BLOB_PATH, JSON.stringify(catalog, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    });

    return response.status(200).json({ success: true, message: 'Product removed successfully' });

  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}