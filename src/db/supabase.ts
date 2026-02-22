import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

// Exported full sync function with pagination (Day 1 History)
export const syncAllData = async () => {
    if (!supabase) return;
    console.log('[SYNC] Starting full sync (Day 1 History)...');

    // Cast to any to avoid strict type checks on specific method chains if versions mismatch
    const client = supabase as any;

    // Sync Sales (Paginated)
    let allSales: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        // Use range for pagination
        const { data: salesChunk, error } = await client
            .from('sales')
            .select('*')
            .order('timestamp', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('[SYNC] Error fetching sales page:', page, error);
            break;
        }

        if (salesChunk && salesChunk.length > 0) {
            console.log(`[SYNC] Downloaded page ${page}: ${salesChunk.length} sales`);
            allSales = [...allSales, ...salesChunk];

            // Batch insert into Dexie
            await db.transaction('rw', db.sales, async () => {
                for (const s of salesChunk) {
                    const exists = await db.sales.get(s.id);
                    // Safe overwrite logic: keep local if it has pending changes (synced: false) UNLESS cloud says it's already refunded
                    const shouldUpdate = !exists || exists.synced || s.refunded === true;

                    if (shouldUpdate) {
                        await db.sales.put({
                            ...s,
                            timestamp: new Date(s.timestamp),
                            paymentMethod: s.payment_method,
                            salespersonName: s.salesperson_name,
                            refunded: s.refunded || false,
                            id: s.id,
                            synced: true
                        } as any);
                    }
                }
            });

            if (salesChunk.length < pageSize) {
                hasMore = false; // Less than full page means end of data
            } else {
                page++;
            }
        } else {
            hasMore = false;
        }
    }
    console.log(`[SYNC] Total sales synced: ${allSales.length}`);

    // Sync Products (Paginated)
    let allProducts: any[] = [];
    page = 0;
    hasMore = true;

    while (hasMore) {
        const { data: productsChunk, error } = await client
            .from('products')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('[SYNC] Error fetching products page:', page, error);
            break;
        }

        if (productsChunk && productsChunk.length > 0) {
            await db.products.bulkPut(productsChunk);
            allProducts = [...allProducts, ...productsChunk];
            if (productsChunk.length < pageSize) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
    }
    console.log(`[SYNC] Total products synced: ${allProducts.length}`);

    console.log(`[SYNC] Total products synced: ${allProducts.length}`);

    // Sync Expenses (Full History)
    await syncExpenses();

    return { sales: allSales.length, products: allProducts.length };
};

// Sync recent sales (polling fallback)
export const syncRecentSales = async () => {
    if (!supabase) return;
    try {
        // Fetch last 100 sales to ensure recent data is synced across devices
        const { data: recentSales } = await supabase
            .from('sales')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);

        if (recentSales && recentSales.length > 0) {
            console.log(`[POLLING] Checking ${recentSales.length} recent sales...`);
            await db.transaction('rw', db.sales, async () => {
                for (const s of recentSales) {
                    const exists = await db.sales.get(s.id);
                    // Only update if missing or different/unsynced?
                    // For simplicity and robustness, we upsert.
                    // But we must preserve 'synced' status if we are the ones who sent it?
                    // Actually, if it comes from cloud, it IS synced.
                    // If local doesn't exist, always save.
                    // If local exists but IS synced, we can overwrite if cloud has changes (like refunded: true).
                    // If local exists but is NOT synced, DO NOT overwrite with cloud data UNLESS the cloud data is already refunded 
                    // (because if local is unsynced and cloud is not refunded, local has pending changes that shouldn't be erased).
                    const shouldUpdate = !exists || (exists.synced) || (s.refunded === true);

                    if (shouldUpdate) {
                        await db.sales.put({
                            ...s,
                            timestamp: new Date(s.timestamp),
                            paymentMethod: s.payment_method,
                            salespersonName: s.salesperson_name,
                            refunded: s.refunded || false,
                            id: s.id,
                            synced: true // It came from cloud, so it is synced
                        } as any);
                    }
                }
            });
        }
    } catch (err) {
        console.error('[POLLING] Error syncing recent sales:', err);
    }
};

export const initSupabase = async () => {
    const config = await getSupabaseConfig();
    if (config.url && config.key) {
        supabase = createSupabase(config.url, config.key);

        // Setup Realtime Subscriptions for Sales
        supabase.channel('public:sales')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, async (payload: any) => {
                const newSale = payload.new;

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    await db.sales.put({
                        ...newSale,
                        timestamp: new Date(newSale.timestamp),
                        paymentMethod: newSale.payment_method,
                        salespersonName: newSale.salesperson_name,
                        refunded: newSale.refunded || false,
                        id: newSale.id as number,
                        synced: true
                    } as any);
                } else if (payload.eventType === 'DELETE') {
                    await db.sales.delete(payload.old.id);
                }
            })
            .subscribe();

        // Setup Realtime Subscriptions for Products
        supabase.channel('public:products')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async (payload: any) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const product = payload.new;
                    await db.products.put({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        category: product.category,
                        brand: product.brand,
                        size: product.size,
                        stock: product.stock,
                        image: product.image,
                        synced: true // Mark as synced so we don't try to upload it back
                    });
                    console.log('[REALTIME] Product received and saved:', product.name);
                } else if (payload.eventType === 'DELETE') {
                    await db.products.delete(payload.old.id);
                }
            })
            .subscribe();

        // Setup Realtime Subscriptions for Expenses
        supabase.channel('public:expenses')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, async (payload: any) => {
                console.log('[REALTIME] Expense event received:', payload);
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const expense = payload.new;
                    await db.expenses.put({
                        id: expense.id,
                        amount: expense.amount,
                        description: expense.description,
                        salespersonId: expense.salesperson_id || 0,
                        timestamp: new Date(expense.timestamp),
                        synced: true
                    } as any);
                    console.log('[REALTIME] Expense synced to local DB:', expense.id);
                } else if (payload.eventType === 'DELETE') {
                    await db.expenses.delete(payload.old.id);
                }
            })
            .subscribe((status: any) => {
                console.log('[REALTIME] Expenses subscription status:', status);
            });

        // Initial Sync
        await syncNow();

        // Periodic sync every 15 seconds (Faster)
        setInterval(async () => {
            await syncNow();
        }, 15000);

        // Smart Sync Triggers (Instant on app open)
        window.addEventListener('focus', () => {
            console.log('[FOCUS] App foregrounded, syncing now...');
            syncNow();
        });
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('[VISIBILITY] App visible, syncing now...');
                syncNow();
            }
        });

        return true;
    }
    return false;
};

// Unified Sync Function (Push + Pull)
export const syncNow = async () => {
    if (!supabase) return { success: false, error: 'No connection' };
    try {
        console.log('[SYNC] Executing Unified Sync...');

        // 1. Push Pending Sales
        await syncPendingSales();

        // 2. Pull Recent Sales (Increased limit & Robustness)
        await syncRecentSales();

        // 3. Sync Expenses (Bi-directional)
        await syncExpenses();

        // 3.5 Sync Pending Products (Robustness)
        await syncPendingProducts();

        // 4. Pull Products (Lightweight check)
        // Only if needed? For now, we do it to keep stock in sync
        const { data: products } = await supabase!.from('products').select('*');
        if (products && products.length > 0) {
            // CRITICAL: Mark downloaded products as synced to prevent echo loop
            const list = products as any[];
            const productsWithSyncFlag = list.map(p => ({
                ...p,
                synced: true
            }));
            await db.products.bulkPut(productsWithSyncFlag);
            console.log(`[SYNC] Pulled ${products.length} products (marked as synced).`);
        }

        return { success: true };
    } catch (err: any) {
        console.error('[SYNC] Unified Sync Failed:', err);
        return { success: false, error: err.message };
    }
};

export const syncExpenses = async () => {
    const client = supabase as SupabaseClient;
    if (!client) return;
    try {
        console.log('[SYNC] Syncing Expenses...');

        // 1. Push Pending Expenses
        const pendingExpenses = await db.expenses.filter(e => !((e as any).synced)).toArray();
        if (pendingExpenses.length > 0) {
            console.log(`[SYNC] Pushing ${pendingExpenses.length} pending expenses...`);
            const { error } = await client.from('expenses').upsert(
                pendingExpenses.map(e => ({
                    id: e.id,
                    amount: e.amount,
                    description: e.description,
                    salesperson_id: e.salespersonId,
                    timestamp: e.timestamp.toISOString()
                }))
            );

            if (!error) {
                await db.transaction('rw', db.expenses, async () => {
                    for (const e of pendingExpenses) {
                        await db.expenses.update(e.id!, { synced: true } as any);
                    }
                });
            } else {
                console.error('[SYNC] Error pushing expenses:', error);
            }
        }

        // 2. Pull Recent Expenses
        const { data: cloudExpenses } = await client
            .from('expenses')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);

        if (cloudExpenses && cloudExpenses.length > 0) {
            await db.transaction('rw', db.expenses, async () => {
                for (const exp of cloudExpenses) {
                    const exists = await db.expenses.get(exp.id);
                    if (!exists) {
                        await db.expenses.put({
                            id: exp.id,
                            amount: exp.amount,
                            description: exp.description,
                            salespersonId: exp.salesperson_id || 0,
                            timestamp: new Date(exp.timestamp),
                            synced: true
                        } as any);
                    }
                }
            });
            console.log(`[SYNC] Pulled ${cloudExpenses.length} expenses.`);
        }

    } catch (err) {
        console.error('[SYNC] Error syncing expenses:', err);
    }
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
            // First check if it already exists in the cloud to avoid Identity column UPSERT errors
            const { data: existingCloud } = await supabase.from('sales').select('id').eq('id', sale.id).limit(1);

            let error;

            if (existingCloud && existingCloud.length > 0) {
                // Sale exists, we justUPDATE it (e.g. for refunds) without touching the ID column
                const { error: updateError } = await supabase.from('sales').update({
                    total: sale.total,
                    shipping_cost: sale.shippingCost,
                    salesperson_name: sale.salespersonName,
                    payment_method: sale.paymentMethod,
                    items: sale.items,
                    refunded: sale.refunded || false,
                }).eq('id', sale.id);
                error = updateError;
            } else {
                // New sale, INSERT but let Supabase generate the ID to avoid constraints.
                // NOTE: This might mean the local ID and cloud ID diverge, 
                // but if we are strictly offline-first we might need to rely on uuid. 
                // For now, we omit 'id' on insert so it works.
                const { error: insertError } = await supabase.from('sales').insert([{
                    total: sale.total,
                    shipping_cost: sale.shippingCost,
                    salesperson_name: sale.salespersonName,
                    payment_method: sale.paymentMethod,
                    items: sale.items,
                    refunded: sale.refunded || false,
                    timestamp: sale.timestamp.toISOString()
                }]);
                error = insertError;
            }

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

// New function to sync pending products (queue processing)
export const syncPendingProducts = async () => {
    if (!supabase) return;
    try {
        const pending = await db.products.filter(p => !p.synced).toArray();
        if (pending.length === 0) return;

        console.log(`[SYNC] Found ${pending.length} pending products to sync...`);

        for (const p of pending) {
            const productData = {
                id: p.id,
                name: p.name,
                price: p.price,
                category: p.category,
                brand: p.brand,
                size: p.size,
                image: p.image,
                stock: p.stock
            };

            const { error } = await supabase.from('products').upsert(productData);

            if (!error) {
                await db.products.update(p.id!, { synced: true });
                console.log(`[SYNC] Product #${p.id} synced successfully.`);
            } else {
                console.error(`[SYNC] Failed to sync product #${p.id}:`, error.message);
            }
        }
    } catch (err) {
        console.error('[SYNC] syncPendingProducts error:', err);
    }
};
// Force Push All Data (Brute Force Sync)
export const forcePushAllData = async () => {
    if (!supabase) return { success: false, message: 'Supabase no inicializado' };

    try {
        console.log('[FORCE PUSH] Iniciando subida masiva...');
        const stats = { sales: 0, products: 0, expenses: 0, errors: [] as string[] };

        // 1. SALES (Smart Sync by Timestamp)
        const allSales = await db.sales.toArray();
        if (allSales.length > 0) {
            console.log(`[FORCE PUSH] Verificando ${allSales.length} ventas locales...`);

            // Get existing cloud timestamps to avoid duplicates
            const { data: cloudSales, error: fetchError } = await supabase
                .from('sales')
                .select('timestamp');

            if (fetchError) throw new Error(`Error verificando ventas: ${fetchError.message}`);

            const cloudTimestamps = new Set(cloudSales?.map((s: any) => new Date(s.timestamp).getTime()));

            // Filter sales that are NOT in cloud (fuzzy match 1000ms to allow small diffs if any)
            const salesToPush = allSales.filter(local => {
                const localTime = local.timestamp.getTime();
                // Check if any cloud timestamp is within 100ms
                // Simpler: Just check exact ISO string match or Set lookup if precise
                // For safety, let's try strict ISO string first, if that fails we might need range
                // But usually timestamp strings are preserved.
                // Let's rely on the Set lookup of getTime() for now.
                return !cloudTimestamps.has(localTime);
            });

            if (salesToPush.length > 0) {
                console.log(`[FORCE PUSH] Insertando ${salesToPush.length} ventas nuevas...`);
                // Insert WITHOUT ID (Let Supabase generate it)
                const { error: insertError } = await supabase.from('sales').insert(
                    salesToPush.map(s => ({
                        // id: s.id, // OMIT ID
                        total: s.total,
                        // shipping_cost: s.shippingCost, // OMIT due to schema error
                        salesperson_name: s.salespersonName,
                        payment_method: s.paymentMethod,
                        items: s.items,
                        timestamp: s.timestamp.toISOString()
                    }))
                );

                if (insertError) {
                    stats.errors.push(`Ventas: ${insertError.message}`);
                } else {
                    stats.sales = salesToPush.length;
                    // Mark as synced locally? The boolean flag isn't strictly used but good practice
                    // await db.sales.bulkPut(salesToPush.map(s => ({ ...s, synced: true }))); 
                }
            } else {
                console.log('[FORCE PUSH] Todas las ventas ya existen en la nube.');
            }
        }

        // 2. PRODUCTS (Smart Sync by Name)
        const allProducts = await db.products.toArray();
        if (allProducts.length > 0) {
            console.log(`[FORCE PUSH] Verificando ${allProducts.length} productos...`);

            const { data: cloudProducts } = await supabase.from('products').select('name');
            const cloudNames = new Set(cloudProducts?.map((p: any) => p.name));

            const productsToPush = allProducts.filter(p => !cloudNames.has(p.name));

            if (productsToPush.length > 0) {
                console.log(`[FORCE PUSH] Insertando ${productsToPush.length} productos nuevos...`);
                const { error: prodError } = await supabase.from('products').insert(
                    productsToPush.map(p => ({
                        // id: p.id, // OMIT ID
                        name: p.name,
                        price: p.price,
                        image: p.image,
                        category: p.category,
                        size: p.size,
                        brand: p.brand,
                        stock: p.stock
                    }))
                );
                if (prodError) {
                    stats.errors.push(`Productos: ${prodError.message}`);
                } else {
                    stats.products = productsToPush.length;
                }
            }
        }

        // 3. EXPENSES (Try to sync if table exists)
        const allExpenses = await db.expenses.toArray();
        if (allExpenses.length > 0) {
            console.log(`[FORCE PUSH] Subiendo ${allExpenses.length} gastos...`);
            const { error: expError } = await supabase.from('expenses').upsert(
                allExpenses.map(e => ({
                    id: e.id,
                    amount: e.amount,
                    description: e.description,
                    salesperson_id: e.salespersonId,
                    timestamp: e.timestamp.toISOString()
                }))
            );
            if (expError) {
                console.warn('[FORCE PUSH] Error gastos (puede que no exista la tabla):', expError);
                // Don't fail the whole sync for expenses
            } else {
                stats.expenses = allExpenses.length;
            }
        }

        return {
            success: stats.errors.length === 0,
            message: `Subido: ${stats.sales} Ventas, ${stats.products} Productos. ${stats.errors.length > 0 ? 'Errores: ' + stats.errors.join(', ') : ''}`,
            stats
        };

    } catch (error: any) {
        console.error('[FORCE PUSH] Critical error:', error);
        return { success: false, message: error.message };
    }
};
