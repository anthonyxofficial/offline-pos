import { db, type StockMovement, type User } from '../db/db';

export type MovementType = 'sale' | 'restock' | 'adjustment' | 'return' | 'layaway' | 'initial';

export class InventoryService {
    /**
     * Adjusts stock for a product and records the movement.
     * @param productId Product ID
     * @param quantity Change in quantity (negative for sales, positive for restock)
     * @param type Type of movement
     * @param user User performing the action
     * @param notes Optional notes or reference ID
     */
    static async adjustStock(
        productId: number,
        quantity: number,
        type: MovementType,
        user: User,
        notes?: string,
        referenceId?: string
    ): Promise<void> {
        await db.transaction('rw', db.products, db.stock_movements, async () => {
            const product = await db.products.get(productId);
            if (!product) throw new Error(`Product ${productId} not found`);

            const previousStock = product.stock || 0;
            const newStock = Math.max(0, previousStock + quantity);

            // 1. Update Product Stock
            await db.products.update(productId, { stock: newStock });

            // 2. Record Movement
            const movement: StockMovement = {
                productId,
                productName: product.name,
                type,
                quantity,
                previousStock,
                newStock,
                timestamp: new Date(),
                userId: user.id!,
                userName: user.name,
                notes,
                referenceId
            };
            await db.stock_movements.add(movement);

            // 3. Sync to Cloud (Fire and forget, handled by separate sync logic usually, 
            // but we can try to push if online)
            try {
                // We'll rely on the existing sync mechanisms or add specific sync here if needed.
                // For now, let's trigger a light sync if possible or just rely on the UI layer 
                // calling the sync. Ideally, this service should handle it.
                // Let's import the supabase client dynamically to avoid issues if offline/not configured
                const { supabase } = await import('../db/supabase');
                if (supabase) {
                    await supabase.from('products').upsert({ ...product, stock: newStock });
                }
            } catch (err) {
                console.warn('Background sync failed for stock adjustment', err);
            }
        });
    }

    static async getHistory(productId: number): Promise<StockMovement[]> {
        return await db.stock_movements
            .where('productId')
            .equals(productId)
            .reverse() // Newest first
            .sortBy('timestamp');
    }
}
