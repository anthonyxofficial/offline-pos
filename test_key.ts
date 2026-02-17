
import { createClient } from '@supabase/supabase-js';

const url = 'https://idpiiinztgxrnqpezvnx.supabase.co';
const key = 'sb_publishable_ZCsj4KwHZSAIgE8rLzaVsQ_8qzu5HkD';

const supabase = createClient(url, key);

async function test() {
    try {
        console.log("Testing connection with key:", key);
        const { data, error } = await supabase.from('products').select('count', { count: 'exact', head: true });
        if (error) {
            console.error("Connection Failed:", error.message);
        } else {
            console.log("Connection Successful! Count:", data);
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

test();
