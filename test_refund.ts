import { test } from '@playwright/test';
import * as fs from 'fs';

test('dump db', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000); // let db load

    // Dump top 5 sales to see if refunded works
    const rows = await page.evaluate(async () => {
        // we have to access the DB somehow, since it's bundled we'll guess the DB name
        const req = indexedDB.open('POSDatabase');
        return new Promise((resolve, reject) => {
            req.onsuccess = (e) => {
                const db = (e.target as IDBOpenDBRequest).result;
                const tx = db.transaction('sales', 'readonly');
                const store = tx.objectStore('sales');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result.slice(-5));
                request.onerror = () => reject(request.error);
            };
            req.onerror = () => reject(req.error);
        });
    });

    fs.writeFileSync('db_dump.json', JSON.stringify(rows, null, 2));
    console.log("Dump written to db_dump.json");
});
