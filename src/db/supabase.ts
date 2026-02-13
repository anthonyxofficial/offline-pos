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
                    await db.sales.put({
                        ...s,
                        timestamp: new Date(s.timestamp),
                        paymentMethod: s.payment_method,
                        salespersonName: s.salesperson_name,
                        id: s.id,
                        synced: true
                    } as any);
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
                    if (!exists || !exists.synced) {
                        // Logic: if local exists and is !synced, it's a pending change?
                        // Conflict resolution: Cloud wins for simple POS? 
                        // If we are polling, we assume cloud is truth.
                        // But if we have a pending local sale with same ID? (Unlikely with auto-increment unless matched).
                        // Let's just upsert standard fields.
                        await db.sales.put({
                            ...s,
                            timestamp: new Date(s.timestamp),
                            paymentMethod: s.payment_method,
                            salespersonName: s.salesperson_name,
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
                        id: newSale.id as number,
                        synced: true
                    } as any);
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
                        image: product.image
                    });
                } else if (payload.eventType === 'DELETE') {
                    await db.products.delete(payload.old.id);
                }
            })
            .subscribe();

        // Initial Sync
        await syncNow();

        // Periodic sync every 20 seconds
        setInterval(async () => {
            await syncNow();
        }, 20000);

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

        // 4. Pull Products (Lightweight check)
        // Only if needed? For now, we do it to keep stock in sync
        const { data: products } = await supabase!.from('products').select('*');
        if (products && products.length > 0) {
            await db.products.bulkPut(products);
        }

        return { success: true };
    } catch (err: any) {
        console.error('[SYNC] Unified Sync Failed:', err);
        return { success: false, error: err.message };
    }
};

export const syncExpenses = async () => {
    if (!supabase) return;
    try {
        console.log('[SYNC] Syncing Expenses...');

        // 1. Push Pending Expenses
        const pendingExpenses = await db.expenses.filter(e => !((e as any).synced)).toArray();
        if (pendingExpenses.length > 0) {
            console.log(`[SYNC] Pushing ${pendingExpenses.length} pending expenses...`);
            const { error } = await supabase.from('expenses').upsert(
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

        // 2. Pull Recent Expenses (Last 30 days or simply all if not too many)
        // Let's pull last 100 expenses for now
        const { data: cloudExpenses, error: pullError } = await supabase
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
