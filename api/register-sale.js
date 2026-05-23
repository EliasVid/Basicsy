import { getRedisClient } from './_redis.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productId, color, size } = request.body;

    if (!productId || !color || !size) {
      return response.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }

    const redis = getRedisClient();
    // Reconstruct the explicit storage tracking key format matching your storage engine template
    const redisKey = `stock:${productId}:${color.toLowerCase()}:${size}`;

    // Read the current record straight from Upstash memory
    const currentStockStr = await redis.get(redisKey);

    if (currentStockStr === null) {
      return response.status(404).json({ error: 'La variante no está registrada en Redis.' });
    }

    const currentStock = parseInt(currentStockStr, 10);

    if (currentStock <= 0) {
      return response.status(400).json({ error: 'No hay stock disponible para esta variante.' });
    }

    // Atomically decrement stock count score by exactly 1 unit
    const newStock = await redis.decr(redisKey);

    // ---   SAVE THE SALE LOG PERMANENTLY ---
    const saleRecord = {
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: new Date().toLocaleDateString('es-CO'),
      productId,
      // You can pass the product name from the frontend request if you add it to request.body
      name: request.body.productName || 'Prenda Básica', 
      variantStr: `Talla ${size} - Color ${color}`,
      price: parseFloat(request.body.price) || 0
    };
    
    // Push into the front of the list, keeping history intact
    await redis.lpush('sales:history', JSON.stringify(saleRecord));
    // --------------------------------------------------------

    return response.status(200).json({ success: true, newStock });

  } catch (error) {
    console.error("Error running register-sale:", error);
    return response.status(500).json({ error: error.message });
  }
}