
import { createClient } from '@supabase/supabase-js';

const url = 'https://idpiiinztgxrnqpezvnx.supabase.co';
const key = 'sb_publishable_ZCsj4KwHZSAIgE8rLzaVsQ_8qzu5HkD';

const supabase = createClient(url, key);

async function injectProduct() {
    console.log("Injecting 'Producto Prueba Robot' directly into Cloud...");

    // 1. Create dummy product
    const newProduct = {
        name: `Producto Prueba Robot ${new Date().toLocaleTimeString()}`,
        price: 150.00,
        category: 'Test',
        stock: 99,
        image: '',
        brand: 'AI Support',
        size: 'N/A'
    };

    const { data, error } = await supabase.from('products').insert(newProduct).select();

    if (error) {
        console.error("❌ CLOUD INSERT FAILED:", error.message);
        console.error("This means the Admin PC cannot write to the cloud (RLS or Key issue).");
    } else {
        console.log("✅ CLOUD INSERT SUCCESSFUL:", data);
        console.log("Now check your MOBILE DEVICE. Does this product appear?");
    }
}

injectProduct();
