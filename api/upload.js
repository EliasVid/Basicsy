// api/upload.js
import { handleUpload } from '@vercel/blob/client';

export default async function handler(request, response) {
  try {
    const jsonResponse = await handleUpload({
      body: request.body,
      request: request,
      onBeforeGenerateToken: async (pathname) => {
        // Pathname will come from frontend looking like: "catalog/Mechanical Keyboard-89.99.jpg"
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          tokenPayload: JSON.stringify({}),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('Stored:', blob.url);
      },
    });

    return response.status(200).json(jsonResponse);
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }
}