
import { createClient } from '@supabase/supabase-js';

const url = 'https://idpiiinztgxrnqpezvnx.supabase.co';
const key = 'sb_publishable_ZCsj4KwHZSAIgE8rLzaVsQ_8qzu5HkD';

const supabase = createClient(url, key);

async function debugDelete() {
    console.log("🕵️‍♂️ Intentando borrar un producto para ver el error exacto...");

    // Get one product ID
    const { data: products } = await supabase.from('products').select('id').limit(1);

    if (!products || products.length === 0) {
        console.log("✅ No hay productos para borrar.");
        return;
    }

    const id = products[0].id;
    console.log(`Intentando borrar ID: ${id}`);

    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
        console.error("❌ ERROR AL BORRAR:", error);
        console.error("Código:", error.code);
        console.error("Mensaje:", error.message);
        console.error("Detalles:", error.details);
    } else {
        console.log("✅ BORRADO EXITOSO (Parece que sí tengo permisos).");
    }
}

debugDelete();
