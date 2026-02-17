
import { createClient } from '@supabase/supabase-js';

const url = 'https://idpiiinztgxrnqpezvnx.supabase.co';
const key = 'sb_publishable_ZCsj4KwHZSAIgE8rLzaVsQ_8qzu5HkD';

const supabase = createClient(url, key);

async function test() {
    try {
        console.log("Testing INSERT with key:", key);
        const { data, error } = await supabase.from('products').insert({
            name: 'TEST_CONNECTION_PROBE',
            price: 1,
            stock: 0
        }).select();

        if (error) {
            console.error("INSERT Failed:", error);
        } else {
            console.log("INSERT Successful!", data);
            // Cleanup
            if (data && data[0]?.id) {
                await supabase.from('products').delete().eq('id', data[0].id);
                console.log("Cleanup Successful");
            }
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

test();
