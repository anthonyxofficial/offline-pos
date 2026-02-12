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

// Exported full sync function
export const syncAllData = async () => {
    if (!supabase) return;
    console.log('[SYNC] Starting full sync...');

    // Sync Sales
    const { data: sales } = await supabase.from('sales').select('*').order('timestamp', { ascending: false });
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

    // Sync Products
    const { data: products } = await supabase.from('products').select('*');
    if (products && products.length > 0) {
        await db.products.bulkPut(products);
        console.log('[SYNC] Products merged:', products.length);
    }

    return { sales: sales?.length || 0, products: products?.length || 0 };
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
        await syncAllData();

        // Periodic sync every 30 seconds
        setInterval(async () => {
            try {
                // 1. Pull Products
                const { data: products } = await supabase!.from('products').select('*');
                if (products && products.length > 0) {
                    await db.products.bulkPut(products);
                }

                // 2. Push Pending Sales (Offline Sync)
                await syncPendingSales();

            } catch (err) {
                console.error('[SYNC] Periodic sync error:', err);
            }
        }, 30000);

        // Run one sync immediately
        await syncPendingSales();

        return true;
    }
    return false;
};

// New function to sync pending sales
export const syncPendingSales = async () => {
    if (!supabase) return;
    try {
        // Find sales that haven't been synced yet
        // We filter manually because boolean indexing in Dexie can be tricky with undefined
        const pendingSales = await db.sales.filter(s => !s.synced).toArray();

        if (pendingSales.length === 0) return;

        console.log(`[SYNC] Found ${pendingSales.length} pending sales to sync...`);

        for (const sale of pendingSales) {
            const { error } = await supabase.from('sales').insert([{
                id: sale.id, // Try to preserve ID if possible, or let Supabase generate one? 
                // If we send ID, we might conflict if Supabase uses auto-increment.
                // Better to NOT send ID and let Supabase generate it, OR use UUIDs.
                // However, if we don't send ID, we can't easily link back.
                // Current POSPage sends: total, shipping_cost, salesperson_name, payment_method, items, timestamp
                // It DOES NOT send ID in the original code. 
                total: sale.total,
                shipping_cost: sale.shippingCost,
                salesperson_name: sale.salespersonName,
                payment_method: sale.paymentMethod,
                items: sale.items,
                timestamp: sale.timestamp.toISOString() // Use ORIGINAL timestamp
            }]);

            if (!error) {
                await db.sales.update(sale.id!, { synced: true });
                console.log(`[SYNC] Sale #${sale.id} synced successfully.`);
            } else {
                console.error(`[SYNC] Failed to sync sale #${sale.id}:`, error.message);
            }
        }
    } catch (err) {
        console.error('[SYNC] processPendingSales error:', err);
    }
};
