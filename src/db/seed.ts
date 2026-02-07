import { db } from './db';

const sneakers = [
    { name: 'Nike Air Force 1', price: 2800, category: 'Casual', brand: 'Nike', size: 9, stock: 15, image: 'https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/b7d9211c-26e7-431a-ac24-b0540fb3c00f/air-force-1-07-mens-shoes-jBrhBr.png' },
    { name: 'Nike Air Max 90', price: 3200, category: 'Running', brand: 'Nike', size: 10, stock: 2, image: 'https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/wzitsrb4oucx9xm9ouwc/air-max-90-mens-shoes-6n3vKB.png' },
    { name: 'Nike Dunk Low Panda', price: 2900, category: 'Casual', brand: 'Nike', size: 8.5, stock: 1, image: 'https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/0895311e-293e-4638-89c0-9994c96a32d6/dunk-low-retro-mens-shoes-5FQWGR.png' },
    { name: 'Jordan 1 Retro High', price: 4500, category: 'Retro', brand: 'Jordan', size: 11, stock: 5, image: 'https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/5fa16524-7389-4081-8d26-646700c5c365/air-jordan-1-mid-shoes-X5pM09.png' },
    { name: 'Adidas Superstar', price: 2200, category: 'Casual', brand: 'Adidas', size: 9, stock: 20, image: 'https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/7ed0855435194229a525aad6009a0497_9366/Superstar_Shoes_White_EG4958_01_standard.jpg' },
    { name: 'Adidas Ultraboost', price: 4200, category: 'Running', brand: 'Adidas', size: 10.5, stock: 8, image: 'https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/9baf5ba73489437d9fa8af5100ed39e3_9366/Ultraboost_Light_Running_Shoes_White_HQ6351_01_standard.jpg' },
    { name: 'Yeezy Boost 350', price: 6500, category: 'Exclusive', brand: 'Adidas', size: 9.5, stock: 0, image: 'https://images.stockx.com/images/Adidas-Yeezy-Boost-350-V2-Bone-Product.jpg?fit=fill&bg=FFFFFF&w=700&h=500&fm=webp&auto=compress&q=90&dpr=2&trim=color&updated_at=1647444391' },
    { name: 'New Balance 550', price: 3100, category: 'Casual', brand: 'New Balance', size: 9, stock: 12, image: 'https://nb.scene7.com/is/image/NB/bb550www_nb_02_i?$pdpflexf2$' },
];

export async function seedDatabase() {
    // Check if we need to re-seed users
    const anthony = await db.users.where('name').equalsIgnoreCase('Anthony').first();
    const needsUserReseed = !anthony;

    const firstProduct = await db.products.toCollection().first();
    const needsProductReseed = !firstProduct || firstProduct.size === undefined;

    if (needsProductReseed) {
        console.log('Migrating products to Sneaker Store...');
        await db.products.clear();
        await db.products.bulkAdd(sneakers);
    }

    if (needsUserReseed) {
        console.log('Updating authorized users...');
        await db.users.clear();
        await db.users.bulkAdd([
            { name: 'Anthony', pin: '2234' },
            { name: 'John', pin: '1234' },
            { name: 'Carlos', pin: '5504' },
        ]);
    }
}

export async function resetDatabase() {
    await db.products.clear();
    await db.products.bulkAdd(sneakers);
    window.location.reload();
}
