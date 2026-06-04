import { put } from '@vercel/blob';

const CATALOG_URL = 'https://xg6snmqaui2yqczf.public.blob.vercel-storage.com/data/catalog.json';
const CATALOG_BLOB_PATH = 'data/catalog.json';
const TARGET_ID = "1780548445603"; // The broken product ID

export default async function handler(request, response) {
  try {
    // 1. Fetch the latest live catalog data (bypassing Vercel edge cache)
    const currentFileResponse = await fetch(`${CATALOG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!currentFileResponse.ok) {
      return response.status(500).json({ error: "Could not fetch catalog file from Blob storage." });
    }
    
    const catalogData = await currentFileResponse.json();
    
    // 2. Count how many products we have before filtering
    const originalLength = catalogData.length;

    // 3. Filter out the corrupt product ID
    const cleanedCatalog = catalogData.filter(product => product.id !== TARGET_ID);

    // Check if the product was actually found and removed
    if (cleanedCatalog.length === originalLength) {
      return response.status(404).json({ 
        success: false, 
        message: `Product with ID ${TARGET_ID} was not found in the catalog.` 
      });
    }

    // 4. Save the cleaned catalog back to Vercel Blob
    await put(CATALOG_BLOB_PATH, JSON.stringify(cleanedCatalog, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    });

    return response.status(200).json({ 
      success: true, 
      message: `Successfully deleted product ID ${TARGET_ID}. Catalog size reduced from ${originalLength} to ${cleanedCatalog.length}.` 
    });

  } catch (error) {
    console.error("Deletion Endpoint Error:", error);
    return response.status(500).json({ error: error.message });
  }
}