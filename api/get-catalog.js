export default async function handler(request, response) {
  try {
    // Drop the list() function completely to fetch the permanent file link directly.
    // This turns an Advanced Operation ($5/M) into a basic web request covered by Data Transfer!
    const catalogUrl = 'https://xg6snmqaui2yqczf.public.blob.vercel-storage.com/data/catalog.json';
    
    const currentFileResponse = await fetch(catalogUrl);
    
    if (currentFileResponse.status === 404) {
      return response.status(200).json([]); // Return empty array if file doesn't exist yet
    }
    
    const catalogData = await currentFileResponse.json();
    return response.status(200).json(catalogData);
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}