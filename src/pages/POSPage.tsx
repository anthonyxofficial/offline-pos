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
import { RecentSalesModal } from '../components/RecentSalesModal';
import { History } from 'lucide-react';

export const POSPage = () => {
    const { addToCart, cart, clearCart, currentUser, setCurrentUser } = usePOS();
    const [search, setSearch] = useState('');

    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [lastSale, setLastSale] = useState<Sale | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);

    // Recent Sales
    const [isRecentSalesOpen, setIsRecentSalesOpen] = useState(false);
    const recentSales = useLiveQuery(async () => {
        if (!currentUser?.id) return [];
        return await db.sales
            .where('salespersonId')
            .equals(currentUser.id)
            .reverse()
            .limit(20)
            .toArray();
    }, [currentUser?.id, lastSale]);

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
                        layaway.id?.toString()
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

    // Helper to get location
    const getCurrentLocation = async (): Promise<{ lat: number, lng: number, accuracy: number } | undefined> => {
        if (!navigator.geolocation) return undefined;

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    });
                },
                (err) => {
                    console.warn("Geolocation failed:", err);
                    resolve(undefined);
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        });
    };

    const handleConfirmPayment = async (method: string, shippingCost: number = 0) => {
        if (!currentUser) {
            alert('Error: No hay usuario activo. Por favor seleccione un vendedor.');
            setIsPaymentOpen(false);
            return;
        }

        try {
            // Capture Location
            const location = await getCurrentLocation();

            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const total = subtotal + shippingCost;

            const sale: any = {
                timestamp: new Date(),
                total,
                shippingCost,
                salespersonId: currentUser.id!,
                salespersonName: currentUser.name,
                items: cart,
                paymentMethod: method as 'cash' | 'card' | 'qr',
                location: location // Save location
            };

            console.log("Attempting to save sale:", sale);
            const id = await db.sales.add(sale);
            console.log("Sale saved with ID:", id);
            alert("✅ Venta registrada correctamente"); // Temporary explicit confirmation
            const savedSale = { ...sale, id: id as number };

            // Update Stock & Record Movement via Service
            // We wrap this in a nested try/catch so stock errors don't block the sale completion UI
            try {
                for (const item of cart) {
                    console.log(`[CHECKOUT] Processing Item: ${item.name} (ID: ${item.id}), Qty: ${item.quantity}`);
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
            } catch (stockError: any) {
                console.error("Error al descontar inventario:", stockError);
                alert(`⚠️ ERROR DE INVENTARIO: ${stockError.message || stockError}`);
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
                    const fullSaleData = {
                        total,
                        shipping_cost: shippingCost,
                        salesperson_name: currentUser.name,
                        payment_method: method,
                        items: cart,
                        timestamp: sale.timestamp.toISOString() // UTC ISO
                    };

                    console.log('[CLOUD] Intentando subir venta...', fullSaleData);

                    // Attempt 1: Full Insert
                    let { error } = await supabase.from('sales').insert([fullSaleData]);

                    // Attempt 2: Fallback (Minimal) if Schema Mismatch
                    if (error && (error.code === '42703' || error.message.includes('column'))) {
                        console.warn("[CLOUD] Error de columnas. Reintentando con datos mínimos...", error);

                        const minimalData = {
                            total,
                            items: cart,
                            timestamp: sale.timestamp.toISOString()
                        };

                        const retry = await supabase.from('sales').insert([minimalData]);
                        error = retry.error;

                        if (!error) {
                            alert("⚠️ AVISO: Venta sincronizada parcialmente. Faltan columnas en la base de datos (shipping_cost/salesperson). Informe al Admin.");
                        }
                    }

                    if (error) {
                        console.error("[CLOUD] Error final de sincronización:", error);
                        // Alert User Explicitly
                        alert(`⚠️ ALERTA: Venta guardada SOLO EN ESTE DISPOSITIVO.\n\nNo se pudo subir a la nube.\nError: ${error.message}\n\nSe intentará subir automáticamente después.`);
                    } else {
                        // If sync successful, mark as synced in local DB
                        await db.sales.update(id, { synced: true });
                        console.log('[CLOUD] Venta sincronizada EXITOSAMENTE.');
                    }
                }
            } catch (err: any) {
                console.error("Cloud sync network error:", err);
                alert(`⚠️ ERROR DE RED: No se pudo conectar a la nube. La venta se guardó localmente.`);
            }

        } catch (error) {
            console.error("CRITICAL ERROR: Failed to process sale", error);
            alert(`❌ ERROR CRÍTICO: No se pudo registrar la venta.\n\nDetalle: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-full gap-6 relative">
            <SizeSelectorModal
                isOpen={isSizeModalOpen}
                onClose={() => setIsSizeModalOpen(false)}
                product={selectedProductForSize}
                onSelect={confirmAddToCart}
            />

            <RecentSalesModal
                isOpen={isRecentSalesOpen}
                onClose={() => setIsRecentSalesOpen(false)}
                sales={recentSales || []}
                // @ts-ignore
                onRepaintReceipt={(sale) => {
                    setLastSale(sale);
                    setIsReceiptOpen(true);
                }}
            />

            {/* Left Column: Products - Increased gap and padding for "Airy" feel */}
            <div className="flex-1 flex flex-col gap-6 overflow-hidden pb-20 md:pb-0 relative z-10">
                {/* Header: User & Search */}
                <div className="flex items-center gap-4 justify-between bg-black/20 p-4 rounded-3xl backdrop-blur-md border border-white/5 shadow-xl">
                    <div className="flex items-center gap-3 flex-1">
                        {/* User Selector Dropdown (Styled) */}
                        <div className="relative group">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-purple-900/40 cursor-pointer hover:scale-105 transition-transform">
                                {currentUser ? currentUser.name.substring(0, 2).toUpperCase() : '?'}
                            </div>
                            <select
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                value={currentUser?.id || ''}
                                onChange={e => {
                                    const user = users?.find(u => u.id === Number(e.target.value));
                                    if (user) setCurrentUser(user);
                                }}
                            >
                                <option value="">Seleccionar</option>
                                {users?.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Vendedor</span>
                            <span className="text-white font-bold text-lg leading-none">
                                {currentUser ? currentUser.name : 'Seleccionar...'}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsRecentSalesOpen(true)}
                        className="p-3 rounded-2xl bg-zinc-800/50 text-zinc-400 hover:bg-purple-600 hover:text-white transition-all hover:scale-105 hover:shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                    >
                        <History size={20} />
                    </button>
                </div>

                {/* Search Bar Spotlight */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-400 transition-colors" size={20} />
                    <input
                        type="search" // "search" for better mobile keyboard
                        placeholder="Buscar sneakers..."
                        className="w-full pl-12 pr-4 py-4 bg-black/40 border border-white/5 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-inner backdrop-blur-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Categories */}
                <CategoryFilter
                    activeCategory={activeCategory}
                    onSelect={setActiveCategory}
                />

                {/* Products Grid */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-24 md:pb-4">
                        {products?.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onAdd={handleProductClick}
                            />
                        ))}
                        {products?.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center text-zinc-600 py-10">
                                <span className="text-4xl mb-4 opacity-50">👟</span>
                                <p>No se encontraron productos</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column: Floating Cart (Glassmorphism) */}
            {/* Mobile: Full wrapper logic handled by CSS in Layout usually, but here manually toggled or stacked */}
            <div className={`
                fixed md:static inset-0 z-40 bg-black/90 md:bg-transparent transition-transform duration-300
                ${cart.length > 0 ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
                md:w-[380px] md:flex flex-col
            `}>
                <div className="h-full md:h-auto md:bg-black/40 md:backdrop-blur-xl md:border md:border-white/5 md:rounded-3xl md:shadow-2xl overflow-hidden flex flex-col relative md:sticky md:top-4 md:max-h-[calc(100vh-2rem)]">
                    {/* Mobile Close Handle */}
                    <div className="md:hidden w-full flex justify-center py-2" onClick={() => clearCart()}> {/* Just explicit close for mobile for now if needed */}
                        <div className="w-16 h-1.5 bg-zinc-700 rounded-full" />
                    </div>

                    <Cart
                        onCheckout={handleCheckoutClick}
                        onClear={clearCart}
                    />
                </div>
            </div>

            {/* Modals */}
            <PaymentModal
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
                total={cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)}
                onConfirm={handleConfirmPayment}
                onConfirmLayaway={handleConfirmLayaway}
            />

            <ReceiptModal
                isOpen={isReceiptOpen}
                onClose={() => setIsReceiptOpen(false)}
                sale={lastSale}
            />
        </div>
    );
};
