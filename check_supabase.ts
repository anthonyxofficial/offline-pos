import { createClient } from '@supabase/supabase-js';

const url = 'https://idpiiinztgxrnqpezvnx.supabase.co';
const key = 'sb_publishable_ZCsj4KwHZSAIgE8rLzaVsQ_8qzu5HkD';
const supabase = createClient(url, key);

async function check() {
    console.log("Checking sales table schema...");

    // First let's fetch an existing ID
    const { data: sales } = await supabase.from('sales').select('id, refunded').limit(1);
    if (!sales || sales.length === 0) return console.log("no sales");

    const targetId = sales[0].id;
    console.log("Updating sale ID:", targetId);

    // Now try to UPSERT it the way syncPendingSales does
    const { data, error } = await supabase.from('sales').upsert([{
        id: targetId,
        refunded: true
    }]);
    if (error) {
        console.error("Error UPSERTING:", error);
    } else {
        console.log("Upsert success!");
        // Revert it
        await supabase.from('sales').update({ refunded: sales[0].refunded }).eq('id', targetId);
    }
}

check();
