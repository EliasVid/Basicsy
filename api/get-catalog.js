// api/get-catalog.js
import { list } from '@vercel/blob';

const CATALOG_BLOB_PATH = 'data/catalog.json';

export default async function handler(request, response) {
  // Guardrail: Only allow GET requests (reading data)
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Look inside your cloud warehouse for catalog.json
    const { blobs } = await list({ prefix: CATALOG_BLOB_PATH });
    
    if (blobs.length === 0) {
      // If no catalog file exists yet, return an empty list
      return response.status(200).json([]);
    }

    // 2. Download the contents of the file from its cloud link
    const currentFileResponse = await fetch(blobs[0].url);
    const catalogData = await currentFileResponse.json();

    // 3. Send the clean product array back to your storefront
    return response.status(200).json(catalogData);

  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}