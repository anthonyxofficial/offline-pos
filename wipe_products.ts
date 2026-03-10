import { createClient } from '@supabase/supabase-js';

const url = 'https://idpiiinztgxrnqpezvnx.supabase.co';
const key = 'sb_publishable_ZCsj4KwHZSAIgE8rLzaVsQ_8qzu5HkD';

const supabase = createClient(url, key);

async function wipeProducts() {
    console.log('Borrandolo TODO de Supabase...');
    
    // Obtenemos todos los IDs
    const { data: products } = await supabase.from('products').select('id');
    
    if (!products || products.length === 0) {
        console.log('? No hay productos en la nube.');
        return;
    }

    const ids = products.map((p: any) => p.id);
    console.log('Borrando ' + ids.length + ' productos...');

    const { error } = await supabase.from('products').delete().in('id', ids);

    if (error) {
        console.error('? ERROR AL BORRAR:', error.message);
    } else {
        console.log('? TODOS LOS PRODUCTOS BORRADOS DE LA NUBE EXITOSAMENTE.');
    }
}

wipeProducts();
