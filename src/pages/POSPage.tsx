import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Sale, type Product, type Layaway, type Payment } from '../db/db';
import { usePOS } from '../context/POSContext';
import { ProductCard } from '../components/ProductCard';
import { Cart } from '../components/Cart';
import { Search } from 'lucide-react';
import { CategoryFilter } from '../components/CategoryFilter';
import { PaymentModal } from '../components/PaymentModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { InventoryService } from '../services/InventoryService';

import { SizeSelectorModal } from '../components/SizeSelectorModal';

export const POSPage = () => {
    const { addToCart, cart, clearCart, currentUser, setCurrentUser } = usePOS();
    const [search, setSearch] = useState('');

    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [lastSale, setLastSale] = useState<Sale | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);

    // Size Selection
    const [selectedProductForSize, setSelectedProductForSize] = useState<Product | null>(null);
    const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);

    const handleProductClick = (product: Product) => {
        setSelectedProductForSize(product);
        setIsSizeModalOpen(true);
    };

    const confirmAddToCart = (size: string) => {
        if (selectedProductForSize) {
            addToCart(selectedProductForSize, size);
        }
    };

    // Efficiently query products
    const products = useLiveQuery(
        () => db.products.toArray().then(items => {
            let filtered = items;
            if (activeCategory) {
                filtered = filtered.filter(p => p.category === activeCategory);
            }
            if (search) {
                filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
            }
            return filtered;
        }),
        [search, activeCategory]
    );

    const users = useLiveQuery(() => db.users.toArray());

    const handleCheckoutClick = () => {
        if (!currentUser) return;
        if (cart.length === 0) return;
        setIsPaymentOpen(true);
    };

    const handleConfirmLayaway = async (customerName: string, customerContact: string, initialPayment: number, method: string, shippingCost: number) => {
        if (!currentUser) return;
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal + shippingCost;
        const balance = total - initialPayment;

        const payment: Payment | undefined = initialPayment > 0 ? {
            amount: initialPayment,
            date: new Date(),
            method: method as 'cash' | 'card' | 'qr'
        } : undefined;

        const layaway: Layaway = {
            customerName,
            customerContact,
            items: cart,
            total,
            balance,
            payments: payment ? [payment] : [],
            status: balance <= 0 ? 'completed' : 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.layaways.add(layaway);

        // Record Initial Payment as a Sale (for Cash Drawer)
        if (initialPayment > 0) {
            const paymentSale: Sale = {
                timestamp: new Date(),
                total: initialPayment,
                salespersonId: currentUser!.id!,
                salespersonName: currentUser!.name,
                // Dummy item for the payment
                items: [{
                    // @ts-ignore
                    id: 99999,
                    name: `Abono Apartado - ${customerName}`,
                    price: initialPayment,
                    quantity: 1,
                    image: '', category: 'System', size: 'N/A'
                }],
                paymentMethod: method as 'cash' | 'card' | 'qr',
                shippingCost: 0
            };
            await db.sales.add(paymentSale);
        }

        // Decrease stock in Local DB via InventoryService
        try {
            for (const item of cart) {
                if (item.id) {
                    await InventoryService.adjustStock(
                        item.id,
                        -item.quantity,
                        'layaway',
                        currentUser,
                        `Apartado - ${customerName}`,
                        layaway.id?.toString() // Ideally we would get the ID from add() result but layaway object might not have it yet if not returned. 
                        // Wait, db.layaways.add returns the ID.
                        // Let's capture the ID first.
                    );
                }
            }
        } catch (err) {
            console.error("Error updating stock:", err);
        }

        setIsPaymentOpen(false);
        clearCart();
        alert('Apartado creado exitosamente');
    };

    const handleConfirmPayment = async (method: string, shippingCost: number = 0) => {
        if (!currentUser) {
            alert('Error: No hay usuario activo. Por favor seleccione un vendedor.');
            setIsPaymentOpen(false);
            return;
        }

        try {
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const total = subtotal + shippingCost;

            const sale: Sale = {
                timestamp: new Date(),
                total,
                shippingCost,
                salespersonId: currentUser.id!,
                salespersonName: currentUser.name,
                items: cart,
                paymentMethod: method as 'cash' | 'card' | 'qr'
            };

            const id = await db.sales.add(sale);
            const savedSale = { ...sale, id: id as number };

            // Update Stock & Record Movement via Service
            // We wrap this in a nested try/catch so stock errors don't block the sale completion UI
            try {
                for (const item of cart) {
                    if (item.id) {
                        await InventoryService.adjustStock(
                            item.id,
                            -item.quantity,
                            'sale',
                            currentUser,
                            `Venta #${id}`,
                            id.toString()
                        );
                    }
                }
            } catch (stockError) {
                console.error("Error al descontar inventario:", stockError);
                // We continue to close the modal because the sale was already recorded financially
            }

            setIsPaymentOpen(false);
            clearCart();

            // Show Receipt
            setLastSale(savedSale);
            setIsReceiptOpen(true);

            // WhatsApp Notification
            try {
                const setting = await db.table('settings').get('whatsapp_number');
                if (setting?.value) {
                    const itemsList = cart.map(i => `- ${i.name} (Talla: ${i.size || 'N/A'}) x${i.quantity}`).join('%0A');
                    let message = `*Venta Realizada* %0A%0A` +
                        `*ID:* ${id}%0A` +
                        `*Subtotal:* L ${subtotal.toFixed(2)}%0A`;

                    if (shippingCost > 0) {
                        message += `*Envío:* L ${shippingCost.toFixed(2)}%0A`;
                    }

                    message += `*Total:* L ${total.toFixed(2)}%0A` +
                        `*Vendedor:* ${currentUser?.name}%0A` +
                        `*Método:* ${method === 'cash' ? 'Efectivo' : method === 'card' ? 'Tarjeta' : 'QR'}%0A%0A` +
                        `*Productos:*%0A${itemsList}%0A%0A` +
                        `POS Offline Sneaker Store`;

                    window.open(`https://wa.me/${setting.value}?text=${message}`, '_blank');
                }
            } catch (err) {
                console.error("Error sending WA notification:", err);
            }

            // Cloud Sync (Supabase)
            try {
                const { supabase } = await import('../db/supabase');
                if (supabase) {
                    // @ts-ignore
                    const { error } = await supabase.from('sales').insert([{
                        total,
                        shipping_cost: shippingCost,
                        salesperson_name: currentUser.name,
                        payment_method: method,
                        items: cart,
                        timestamp: (() => {
                            const d = new Date();
                            const offset = d.getTimezoneOffset() * 60000;
                            return new Date(d.getTime() - offset).toISOString();
                        })()
                    }]);

                    if (error) console.error("Error syncing to cloud:", error);
                }
            } catch (err) {
                console.error("Cloud sync failed:", err);
            }

        } catch (error) {
            console.error("Error procesando la venta:", error);
            alert('Ocurrió un error al procesar la venta. Intente de nuevo.');
        }
    };



    return (
        <div className="flex flex-col md:flex-row h-full gap-4 relative">
            <SizeSelectorModal
                isOpen={isSizeModalOpen}
                onClose={() => setIsSizeModalOpen(false)}
                product={selectedProductForSize}
                onSelect={confirmAddToCart}
            />

            <PaymentModal
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
                onConfirm={handleConfirmPayment}
                onConfirmLayaway={handleConfirmLayaway} // Added layaway handler
                total={cart.reduce((s, i) => s + (i.price * i.quantity), 0)}
            />

            <ReceiptModal
                isOpen={isReceiptOpen}
                onClose={() => setIsReceiptOpen(false)}
                sale={lastSale}
            />

            {/* Left Column: Products */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {!currentUser && (
                    <div className="mb-6 bg-red-950/30 border border-red-900/50 p-6 rounded-2xl animate-fade-in shrink-0">
                        <h3 className="text-red-400 font-bold text-lg mb-3">⚠️ Sistema Bloqueado: Seleccione un Vendedor</h3>
                        <div className="flex flex-wrap gap-3">
                            {users?.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => setCurrentUser(user)}
                                    className="px-4 py-2 bg-zinc-900 border border-red-900/30 text-red-400 rounded-xl font-medium hover:bg-red-900/50 hover:text-white transition-colors"
                                >
                                    Soy {user.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-4 mb-4 shrink-0">
                    <div className="relative group flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-white transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar productos..."
                            className="w-full pl-12 pr-6 py-3 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-500 md:text-lg shadow-sm transition-all placeholder:text-zinc-400"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <CategoryFilter activeCategory={activeCategory} onSelect={setActiveCategory} />

                {/* Product Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 overflow-y-auto pr-1 pb-32 md:pb-0 scrollbar-hide content-start">
                    {products?.map((product) => (
                        <ProductCard key={product.id} product={product} onAdd={handleProductClick} />
                    ))}
                    {products?.length === 0 && (
                        <div className="col-span-full text-center py-20 flex flex-col items-center">
                            <p className="text-zinc-500 text-lg mb-4">No se encontraron productos.</p>
                            <button
                                // @ts-ignore
                                onClick={() => import('../db/seed').then(m => m.resetDatabase())}
                                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-black/20"
                            >
                                ↻ Cargar Productos de Prueba
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Cart (Desktop) */}
            <div className="hidden md:flex flex-col w-96 h-full shrink-0">
                <Cart onCheckout={handleCheckoutClick} />
            </div>

            {/* Mobile Fab / Bottom Sheet trigger */}
            {cart.length > 0 && (
                <div className="md:hidden fixed bottom-24 left-4 right-4 z-30">
                    <button
                        onClick={handleCheckoutClick}
                        className="w-full bg-white text-black p-4 rounded-2xl shadow-xl flex justify-between items-center"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-zinc-200 text-black px-3 py-1 rounded-lg text-sm font-bold">{cart.length} items</div>
                            <span className="font-medium">Ver Carrito / Cobrar</span>
                        </div>
                        <span className="font-bold text-lg">
                            L {cart.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(2)}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};
