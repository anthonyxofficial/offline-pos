import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, CartItem, Product } from '../db/db';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface POSContextType {
    currentUser: User | null;
    isAdmin: boolean;
    setCurrentUser: (user: User | null) => void;
    logout: () => void;
    cart: CartItem[];
    addToCart: (product: Product, size?: string | number) => void;
    removeFromCart: (id: number, size?: string | number) => void;
    updateQuantity: (id: number, size: string | number | undefined, quantity: number) => void;
    updatePrice: (id: number, size: string | number | undefined, price: number) => void;
    updateDiscount: (id: number, size: string | number | undefined, discount: number) => void;
    clearCart: () => void;
    selectedCartKey: string | null;
    setSelectedCartKey: (key: string | null) => void;
}

export const POSContext = createContext<POSContextType>({
    cart: [],
    addToCart: () => { },
    removeFromCart: () => { },
    updateQuantity: () => { },
    updatePrice: () => { },
    updateDiscount: () => { },
    clearCart: () => { },
    currentUser: null,
    isAdmin: false,
    setCurrentUser: () => { },
    logout: () => { },
    selectedCartKey: null,
    setSelectedCartKey: () => { },
});

export const POSProvider = ({ children }: { children: ReactNode }) => {
    const [currentUser, setCurrentUserState] = useState<User | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCartKey, setSelectedCartKey] = useState<string | null>(null);

    // Load users from DB
    const users = useLiveQuery(() => db.users.toArray()) || [];

    // Initialize with first user if none selected (dev convenience, in prod force login)
    useEffect(() => {
        if (users.length > 0 && !currentUser) {
            // Optional: auto-select first user or leave null to force selection
            // setCurrentUser(users[0]);
        }
    }, [users, currentUser]);

    const setCurrentUser = async (user: User | null) => {
        setCurrentUserState(user);
        if (user && user.id) {
            await db.users.update(user.id, { lastActive: new Date() });
        }
    };

    const logout = () => {
        setCurrentUserState(null);
    };

    const addToCart = (product: Product, size?: string | number) => {
        setCart(prev => {
            const itemSize = size || product.size;
            const existing = prev.find(item => item.id === product.id && item.size === itemSize);
            const key = `${product.id}-${itemSize}`;

            if (existing) {
                // Select existing item
                setSelectedCartKey(key);
                return prev.map(item =>
                    (item.id === product.id && item.size === itemSize)
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            // Select new item
            setSelectedCartKey(key);
            return [...prev, { ...product, size: itemSize, quantity: 1 } as CartItem];
        });
    };

    const removeFromCart = (id: number, size?: string | number) => {
        setCart(prev => prev.filter(item => !(item.id === id && item.size === size)));
        const key = `${id}-${size}`;
        if (selectedCartKey === key) {
            setSelectedCartKey(null);
        }
    };

    const updateQuantity = (id: number, size: string | number | undefined, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(id, size);
            return;
        }
        setCart(prev => prev.map(item =>
            (item.id === id && item.size === size) ? { ...item, quantity } : item
        ));
    };

    const updatePrice = (id: number, size: string | number | undefined, price: number) => {
        setCart(prev => prev.map(item =>
            (item.id === id && item.size === size) ? { ...item, price } : item
        ));
    };

    const updateDiscount = (id: number, size: string | number | undefined, discount: number) => {
        setCart(prev => prev.map(item =>
            (item.id === id && item.size === size) ? { ...item, discount } : item
        ));
    };

    const clearCart = () => {
        setCart([]);
        setSelectedCartKey(null);
    };

    return (
        <POSContext.Provider value={{
            cart,
            addToCart,
            removeFromCart,
            updateQuantity,
            updatePrice,
            updateDiscount,
            clearCart,
            currentUser,
            isAdmin: currentUser?.role === 'admin',
            setCurrentUser,
            logout,
            selectedCartKey,
            setSelectedCartKey
        }}>
            {children}
        </POSContext.Provider>
    );
};

export const usePOS = () => {
    const context = useContext(POSContext);
    if (context === undefined) {
        throw new Error('usePOS must be used within a POSProvider');
    }
    return context;
};
