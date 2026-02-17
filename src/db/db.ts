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
    synced?: boolean;
}

export interface User {
    id?: number;
    name: string;
    pin?: string;
    role?: 'admin' | 'sales';
    lastActive?: Date;
}

export interface CartItem extends Product {
    quantity: number;
    discount?: number; // Added for sales discounts
}

export interface Sale {
    id?: number;
    timestamp: Date;
    total: number;
    salespersonId: number;
    salespersonName?: string; // Denormalized for easier display
    items: CartItem[];
    paymentMethod?: 'cash' | 'card' | 'qr';
    shippingCost?: number;
    synced?: boolean;
    location?: {
        lat: number;
        lng: number;
        accuracy: number;
    };
}

export interface Expense {
    id?: number;
    timestamp: Date;
    amount: number;
    description: string;
    salespersonId: number;
}

export interface Payment {
    amount: number;
    date: Date;
    method: 'cash' | 'card' | 'qr';
}

export interface Layaway {
    id?: number;
    customerName: string;
    customerContact?: string;
    items: CartItem[];
    total: number;
    balance: number; // Remaining amount to pay
    payments: Payment[];
    status: 'pending' | 'completed' | 'cancelled';
    createdAt: Date;
    updatedAt: Date;
}

export interface StockMovement {
    id?: number;
    productId: number;
    productName: string;
    type: 'sale' | 'restock' | 'adjustment' | 'return' | 'layaway' | 'initial';
    quantity: number; // +1, -5, etc.
    previousStock: number;
    newStock: number;
    referenceId?: string; // ID de Venta o Nota
    timestamp: Date;
    userId: number;
    userName: string;
    notes?: string;
}

export class POSDatabase extends Dexie {
    products!: Table<Product>;
    users!: Table<User>;
    sales!: Table<Sale>;
    expenses!: Table<Expense>;
    layaways!: Table<Layaway>;
    stock_movements!: Table<StockMovement>;

    constructor() {
        super('POSDatabase');
        this.version(4).stores({
            products: '++id, name',
            users: '++id, name',
            sales: '++id, timestamp, salespersonId',
            expenses: '++id, timestamp, salespersonId',
            layaways: '++id, customerName, status, createdAt',
            stock_movements: '++id, productId, type, timestamp',
            settings: 'key'
        });

        // Version 5: Add synced index to sales
        this.version(5).stores({
            sales: '++id, timestamp, salespersonId, synced'
        });

        // Version 6: Add synced index to products
        this.version(6).stores({
            products: '++id, name, synced'
        });
    }
}

export const db = new POSDatabase();
