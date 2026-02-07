import { createClient } from '@supabase/supabase-js';
import { db } from './db';

// These will be loaded from the local database 'settings' table or env variables
// Hardcoded defaults provided by user
const DEFAULT_URL = 'https://idpiiinztgxrnqpezvnx.supabase.co';
const DEFAULT_KEY = 'sb_publishable_ZCsj4KwHZSAIgE8rLzaVsQ_8qzu5HkD';

export const getSupabaseConfig = async () => {
    const url = await db.table('settings').get('supabase_url');
    const key = await db.table('settings').get('supabase_key');
    return {
        url: url?.value || DEFAULT_URL,
        key: key?.value || DEFAULT_KEY
    };
};

export const createSupabase = (url: string, key: string) => {
    return createClient(url, key);
};

export let supabase: any = null;

// Force sync function - can be called from other components
export const forceSyncProducts = async () => {
    if (!supabase) return;
    try {
        const { data: products } = await supabase.from('products').select('*');
        if (products && products.length > 0) {
            // Clear and replace all products to ensure consistency
            await db.products.clear();
            await db.products.bulkAdd(products);
            console.log('[SYNC] Products forcefully synced:', products.length);
        }
    } catch (err) {
        console.error('[SYNC] Force sync failed:', err);
    }
};

export const initSupabase = async () => {
    const config = await getSupabaseConfig();
    if (config.url && config.key) {
        supabase = createSupabase(config.url, config.key);

        // Setup Realtime Subscriptions for Sales
        supabase.channel('public:sales')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, async (payload: any) => {
                const newSale = payload.new;
                // Check if already exists in Dexie to avoid duplicates
                const exists = await db.sales.get(newSale.id as number);
                if (!exists) {
                    await db.sales.put({
                        ...newSale,
                        timestamp: new Date(newSale.timestamp),
                        paymentMethod: newSale.payment_method,
                        salespersonName: newSale.salesperson_name,
                        id: newSale.id as number
                    } as any);
                }
            })
            .subscribe();

        // Setup Realtime Subscriptions for Products (including size, stock, etc.)
        supabase.channel('public:products')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async (payload: any) => {
                console.log('[REALTIME] Product change:', payload.eventType, payload.new?.id || payload.old?.id);
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const product = payload.new;
                    // Ensure all fields are synced including size
                    await db.products.put({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        category: product.category,
                        brand: product.brand,
                        size: product.size,
                        stock: product.stock,
                        image: product.image
                    });
                } else if (payload.eventType === 'DELETE') {
                    await db.products.delete(payload.old.id);
                }
            })
            .subscribe();

        // Initial Sync (Bring local up to date)
        const syncInitial = async () => {
            console.log('[SYNC] Starting initial sync...');

            // Sync Sales
            const { data: sales } = await supabase!.from('sales').select('*').order('timestamp', { ascending: false });
            if (sales) {
                for (const s of sales) {
                    await db.sales.put({
                        ...s,
                        timestamp: new Date(s.timestamp),
                        paymentMethod: s.payment_method,
                        salespersonName: s.salesperson_name,
                        id: s.id
                    } as any);
                }
                console.log('[SYNC] Sales synced:', sales.length);
            }

            // Sync Products - Clear and replace for consistency
            const { data: products } = await supabase!.from('products').select('*');
            if (products && products.length > 0) {
                await db.products.clear();
                await db.products.bulkAdd(products);
                console.log('[SYNC] Products synced:', products.length);
            }
        };
        await syncInitial();

        // Periodic sync every 30 seconds to catch any missed updates
        setInterval(async () => {
            try {
                const { data: products } = await supabase!.from('products').select('*');
                if (products && products.length > 0) {
                    await db.products.clear();
                    await db.products.bulkAdd(products);
                }
            } catch (err) {
                console.error('[SYNC] Periodic sync error:', err);
            }
        }, 30000);

        return true;
    }
    return false;
};
