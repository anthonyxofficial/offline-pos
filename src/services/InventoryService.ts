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
        // Import supabase OUTSIDE the transaction to avoid locking/timeouts
        let supabase: any = null;
        try {
            const module = await import('../db/supabase');
            supabase = module.supabase;
        } catch (e) {
            console.warn('Could not load Supabase client');
        }

        console.log(`[INVENTORY] Adjusting stock for product ${productId}. Qty: ${quantity}. Type: ${type}`);

        await db.transaction('rw', db.products, db.stock_movements, async () => {
            const product = await db.products.get(productId);
            if (!product) {
                console.error(`[INVENTORY] Product ${productId} not found during adjustment!`);
                throw new Error(`Product ${productId} not found`);
            }

            const previousStock = Number(product.stock) || 0;
            const newStock = Math.max(0, previousStock + quantity);

            console.log(`[INVENTORY] Product ${product.name} (ID: ${productId}). Old: ${previousStock}, New: ${newStock}`);

            // 1. Update Product Stock (and mark unsynced for cloud)
            await db.products.update(productId, { stock: newStock, synced: false });

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
            console.log(`[INVENTORY] Movement recorded. Transaction committing...`);
        });

        // 4. Fire-and-forget Cloud Sync (After local commit)
        if (supabase) {
            try {
                // Fetch fresh product data to act as source of truth? No, use calculated values.
                // But we need the ID.
                const updatedProduct = await db.products.get(productId);
                if (updatedProduct) {
                    supabase.from('products').upsert({ ...updatedProduct }).then(({ error }: any) => {
                        if (error) console.error("Cloud sync error:", error);
                    });
                }
            } catch (err) {
                console.warn('Background sync failed', err);
            }
        }
    }

    static async getHistory(productId: number): Promise<StockMovement[]> {
        return await db.stock_movements
            .where('productId')
            .equals(productId)
            .reverse() // Newest first
            .sortBy('timestamp');
    }
}
