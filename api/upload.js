import { handleUpload } from '@vercel/blob/client';
import { verifyAdmin } from './_auth.js';

export default async function handler(request, response) {
  // ADMIN CHECK
  try {
    verifyAdmin(request);
  } catch {
    return response.status(401).json({ error: "Unauthorized" });
  }

  try {
    const jsonResponse = await handleUpload({
      body: request.body,
      request: request,

      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          addRandomSuffix: true,
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