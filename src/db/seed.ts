import { db } from './db';

const sneakers: any[] = [];

export async function seedDatabase() {
    // Check if we need to re-seed users
    // Check if we need to re-seed users (if roles are missing)
    const anthony = await db.users.where('name').equalsIgnoreCase('Anthony').first();
    const needsUserReseed = !anthony || !anthony.role;

    const firstProduct = await db.products.toCollection().first();
    const needsProductReseed = !firstProduct || firstProduct.size === undefined;

    if (needsProductReseed) {
        console.log('Migrating products to Sneaker Store...');
        await db.products.clear();
        await db.products.bulkAdd(sneakers);
    }

    if (needsUserReseed) {
        console.log('Updating authorized users with roles...');
        await db.users.clear();
        await db.users.bulkAdd([
            { name: 'Anthony', pin: '2234', role: 'admin' },
            { name: 'John', pin: '1234', role: 'sales' },
            { name: 'Carlos', pin: '5504', role: 'sales' },
        ]);
    }
}

export async function resetDatabase() {
    await db.products.clear();
    await db.products.bulkAdd(sneakers);
    window.location.reload();
}
