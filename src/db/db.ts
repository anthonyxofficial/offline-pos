import Dexie, { type Table } from 'dexie';

export interface Product {
    id?: number;
    name: string;
    price: number;
    image?: string;
    category?: string;
    size?: string | number;
    brand?: string;
    stock?: number;
}

export interface User {
    id?: number;
    name: string;
    pin?: string;
}

export interface CartItem extends Product {
    quantity: number;
}

export interface Sale {
    id?: number;
    timestamp: Date;
    total: number;
    salespersonId: number;
    salespersonName?: string; // Denormalized for easier display
    items: CartItem[];
    paymentMethod?: 'cash' | 'card' | 'qr';
}

export interface Expense {
    id?: number;
    timestamp: Date;
    amount: number;
    description: string;
    salespersonId: number;
}

export class POSDatabase extends Dexie {
    products!: Table<Product>;
    users!: Table<User>;
    sales!: Table<Sale>;
    expenses!: Table<Expense>;

    constructor() {
        super('POSDatabase');
        this.version(2).stores({
            products: '++id, name',
            users: '++id, name',
            sales: '++id, timestamp, salespersonId',
            expenses: '++id, timestamp, salespersonId',
            settings: 'key'
        });
    }
}

export const db = new POSDatabase();
