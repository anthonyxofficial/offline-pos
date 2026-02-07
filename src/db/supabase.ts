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

export const initSupabase = async () => {
    const config = await getSupabaseConfig();
    if (config.url && config.key) {
        supabase = createSupabase(config.url, config.key);

        // Setup Realtime Subscriptions
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

        supabase.channel('public:products')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async (payload: any) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    await db.products.put(payload.new as any);
                } else if (payload.eventType === 'DELETE') {
                    await db.products.delete(payload.old.id);
                }
            })
            .subscribe();

        // Initial Sync (Bring local up to date)
        const syncInitial = async () => {
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
            }
            const { data: products } = await supabase!.from('products').select('*');
            if (products) {
                await db.products.bulkPut(products as any);
            }
        };
        syncInitial();

        return true;
    }
    return false;
};
