let loadedCatalogData = [];
let recentSalesLogs = [];

export async function initSalesTabEngine() {
    const gridContainer = document.getElementById('salesGridContainer');
    const actionPanel = document.getElementById('salesActionPanel');

    actionPanel.innerHTML = `<div class="sales-action-placeholder">Selecciona un artículo de la cuadrícula para ver variaciones de stock disponibles.</div>`;

    try {
        const catalogRes = await fetch('/api/get-catalog');
        console.log('catalogRes', catalogRes);
        loadedCatalogData = await catalogRes.json();
        console.log('loadedCatalogData', loadedCatalogData);
    } catch (catErr) {
        console.error('CATALOG ERROR:', catErr);
        gridContainer.innerHTML = `<p style="color:red; padding:20px;">Error cargando catálogo de ventas.</p>`;
        return;
    }

    try {
        const salesRes = await fetch('/api/get-sales-history');
        recentSalesLogs = salesRes.ok ? await salesRes.json() : [];
    } catch {
        recentSalesLogs = [];
    }

    // 1. Render the history logs visually
    renderSalesLedgerHistoryTable();

    // 🌟 FIX 1: RUN THE CALCULATIONS SO THE DASHBOARD CARDS UPDATE ON LOAD!
    updateSalesDashboard();

    // 🌟 FIX 2: BIND THE EVENT LISTENER SO THE CALENDAR SELECTION ACCURATELY UPDATES METRICS
    const dateFilterInput = document.getElementById('salesDateFilter');
    if (dateFilterInput) {
        // Remove existing listener if any, then re-bind safely
        dateFilterInput.removeEventListener('change', updateSalesDashboard);
        dateFilterInput.addEventListener('change', updateSalesDashboard);
    }

    if (loadedCatalogData.length === 0) {
        gridContainer.innerHTML = `<p style="color:#999; padding:20px;">No hay productos disponibles para venta.</p>`;
        return;
    }

    gridContainer.innerHTML = loadedCatalogData.map(product => {
        const sampleImage = product.image || (product.images && product.images.length > 0 ? product.images[0] : '');
        return `
            <div class="sales-product-card" data-id="${product.id}">
                <img src="${sampleImage}" alt="${product.name}">
                <div class="sales-product-name">${product.name}</div>
                <div class="sales-product-price">$ ${product.price.toLocaleString('es-CO')}</div>
            </div>
        `;
    }).join('');

    gridContainer.querySelectorAll('.sales-product-card').forEach(card => {
        card.addEventListener('click', () => {
            gridContainer.querySelectorAll('.sales-product-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const selectedProduct = loadedCatalogData.find(p => p.id === card.dataset.id);
            if (selectedProduct) renderProductSalesPickerRow(selectedProduct);
        });
    });
}

export function renderProductSalesPickerRow(product) {
    const actionPanel = document.getElementById('salesActionPanel');

    if (!product.variants || product.variants.length === 0) {
        actionPanel.innerHTML = `
            <h4 style="font-size:14px; margin-bottom:10px;">${product.name}</h4>
            <p style="font-size:13px; color:var(--danger-color);">Este producto no posee variantes registradas.</p>
        `;
        return;
    }

    actionPanel.innerHTML = `
        <h4 style="font-size:15px; font-weight:800; margin-bottom:4px; text-transform:uppercase;">${product.name}</h4>
        <p style="font-size:12px; color:#666; margin-bottom:15px;">Precio base: $ ${product.price.toLocaleString('es-CO')}</p>
        <div style="max-height:280px; overflow-y:auto; padding-right:4px;">
            ${product.variants.map((variant) => {
        const isOutOfStock = variant.stock <= 0;
        return `
                    <div class="sales-variant-row">
                        <div class="sales-variant-info">
                            <span class="color-preview" style="background-color:${variant.color};"></span>
                            <span>Talla <strong>${variant.size}</strong></span>
                            <span style="color:#888;">(${variant.stock} uds)</span>
                        </div>
                        <button type="button" class="btn-sale-trigger"
                            data-pid="${product.id}"
                            data-color="${variant.color}"
                            data-size="${variant.size}"
                            data-price="${product.price}"
                            data-pname="${product.name}"
                            ${isOutOfStock ? 'disabled style="background:#ddd; color:#999;"' : ''}>
                            ${isOutOfStock ? 'Sin Stock' : '⚡ Vender'}
                        </button>
                    </div>
                `;
    }).join('')}
        </div>
    `;

    actionPanel.querySelectorAll('.btn-sale-trigger').forEach(btn => {
        btn.addEventListener('click', async () => {
            const { pid, color, size, price, pname } = btn.dataset;
            btn.disabled = true;
            btn.innerText = 'Procesando...';

            try {
                const response = await fetch('/api/register-sale', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: pid, color, size, price, productName: pname })
                });

                if (response.ok) {
                    const freshDate = new Date();
                    recentSalesLogs.unshift({
                        date: freshDate.toISOString().split('T')[0], 
                        timestamp: freshDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        name: pname,
                        variantStr: `Talla ${size} - Color ${color}`,
                        finalPrice: parseFloat(price)
                    });
                    updateSalesDashboard();

                    const updatedResponse = await fetch('/api/get-catalog');
                    loadedCatalogData = await updatedResponse.json();
                    const matchedFreshProduct = loadedCatalogData.find(p => p.id === pid);
                    if (matchedFreshProduct) renderProductSalesPickerRow(matchedFreshProduct);
                    renderSalesLedgerHistoryTable();
                } else {
                    const errorData = await response.json();
                    alert(`Error de inventario: ${errorData.error || 'No se pudo procesar la reducción.'}`);
                    initSalesTabEngine();
                }
            } catch (err) {
                alert('Error fatal de red intentando asentar la venta.');
                initSalesTabEngine();
            }
        });
    });
}

export function renderSalesLedgerHistoryTable() {
    const ledgerBody = document.getElementById('salesLedgerTableBody');

    if (!recentSalesLogs || recentSalesLogs.length === 0) {
        // Updated colspan to 5 to account for the new column
        ledgerBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #999; padding: 25px;">No se registran ventas en este periodo.</td></tr>`;
        return;
    }

    ledgerBody.innerHTML = recentSalesLogs.map((log, idx) => {
        const displayPrice = log.finalPrice !== undefined ? log.finalPrice : (log.price !== undefined ? log.price : 0);
        
        // Use an internal unique identifier from your database if available (like log.id), otherwise fallback to the array index
        const saleId = log.id !== undefined ? log.id : idx;

        return `
            <tr data-sale-id="${saleId}">
                <td style="color:#666; font-size:13px;">${log.timestamp || ''}</td>
                <td style="font-weight:bold;">${log.name || 'Prenda Básica'}</td>
                <td><code style="background:#f5f5f5; padding:2px 6px; border-radius:4px; font-size:12px;">${log.variantStr || ''}</code></td>
                <td style="color:var(--success-color); font-weight:bold;">$ ${Number(displayPrice).toLocaleString('es-CO')}</td>
                <td>
                    <button type="button" class="btn-delete-sale" data-id="${saleId}" data-index="${idx}" style="background: none; border: none; color: #e53e3e; cursor: pointer; font-size: 14px; padding: 4px 8px;">
                        ✕
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Bind event handlers to the delete buttons
    ledgerBody.querySelectorAll('.btn-delete-sale').forEach(btn => {
        btn.addEventListener('click', async () => {
            const saleId = btn.dataset.id;
            const arrayIndex = parseInt(btn.dataset.index, 10);

            if (!confirm('¿Estás seguro de que deseas eliminar este registro de venta? (No afectará al inventario)')) {
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '...';

            try {
                // Change this endpoint to match your actual backend setup
                const response = await fetch('/api/delete-sale', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: saleId, index: arrayIndex })
                });

                if (response.ok) {
                    // Remove item locally from the running logs cache array
                    recentSalesLogs.splice(arrayIndex, 1);
                    
                    // Re-render components and refresh calculations
                    renderSalesLedgerHistoryTable();
                    updateSalesDashboard();
                    
                    alert('¡Registro de venta eliminado!');
                } else {
                    const errData = await response.json().catch(() => ({}));
                    alert(`Error del servidor: ${errData.error || 'No se pudo borrar la venta.'}`);
                    renderSalesLedgerHistoryTable(); // Restore view state
                }
            } catch (err) {
                alert('Error de red al intentar eliminar la venta.');
                renderSalesLedgerHistoryTable();
            }
        });
    });
}