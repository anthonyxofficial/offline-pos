import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product } from '../db/db';
import { Search, Plus, Trash2, X, Image as ImageIcon, RefreshCw, Save, History, Pencil } from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { InventoryService } from '../services/InventoryService';
import { KardexModal } from '../components/KardexModal';

export const ProductsPage = () => {
    const { isAdmin, currentUser } = usePOS();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');

    const products = useLiveQuery(async () => {
        let collection = db.products.orderBy('name');

        // Filter by category
        if (selectedCategory !== 'Todos') {
            collection = collection.filter(p => p.category === selectedCategory);
        }

        let results = await collection.toArray();

        // Search text
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            results = results.filter(p =>
                p.name.toLowerCase().includes(lower) ||
                p.brand?.toLowerCase().includes(lower)
            );
        }

        return results;
    }, [searchTerm, selectedCategory]) || [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isKardexOpen, setIsKardexOpen] = useState(false);
    const [selectedProductForKardex, setSelectedProductForKardex] = useState<Product | null>(null);

    const [formData, setFormData] = useState<Product>({
        name: '',
        price: 0,
        category: '',
        image: ''
    });

    const openModal = (product?: Product) => {
        if (product) {
            setEditingId(product.id!);
            setFormData({ ...product });
        } else {
            setEditingId(null);
            setFormData({ name: '', price: 0, category: '', image: '', brand: '', size: '', stock: 0 });
        }
        setIsModalOpen(true);
    };

    const handleOpenKardex = (product: Product, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedProductForKardex(product);
        setIsKardexOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const p = formData; // Use formData for the product to be saved

        if (!p.name || p.price <= 0) return;

        try {
            let id: number | undefined = editingId || undefined;

            // Check if stock changed to record movement
            if (id) {
                const existing = await db.products.get(id);
                if (existing && existing.stock !== p.stock) {
                    const diff = (p.stock || 0) - (existing.stock || 0);
                    if (diff !== 0 && currentUser) {
                        await InventoryService.adjustStock(
                            id,
                            diff,
                            'adjustment',
                            currentUser,
                            "Edición manual desde inventario"
                        );
                    }
                    // We don't update stock directly here because ajustStock does it,
                    // BUT adjustStock updates the DB. We still need to update other fields (name, price, etc.)
                    // So we update the product *after* or *with* the other fields, but we must be careful not to double update.
                    // Actually, adjustStock updates the stock in DB. 
                    // If we call db.products.update(id, p) afterwards, it might overwrite or be redundant.
                    // Let's rely on adjustStock for stock, and update other fields here.
                }

                // Exclude stock from direct update if we handled it via service? 
                // To be safe and simple: Update everything here, but rely on the diff check above to log the movement.
                // However, `InventoryService.adjustStock` UPDATES the product stock in DB.
                // So if we run adjustStock, the DB has new stock. 
                // Then if we run `db.products.update(id, p)`, we just confirm it.
                // The critical part is LOGGING the movement.
                await db.products.update(id, { ...p, synced: false });
            } else {
                id = await db.products.add({ ...p, synced: false }) as number;
                // Initial stock movement
                if (p.stock && p.stock > 0 && currentUser) {
                    await InventoryService.adjustStock(
                        id,
                        p.stock,
                        'initial',
                        currentUser,
                        "Inventario Inicial"
                    );
                }
            }

            // Sync to Supabase
            try {
                // Check if supabase is initialized (imported at top level now)
                // We'll use a dynamic import for now to avoid breaking changes if not needed, 
                // BUT we should handle the null case explicitly or retry.
                // Actually, let's switch to direct import at the top of the file to be safe.
                // Reverting to dynamic import for this tool call to match the plan 'import supabase directly' means I need to add the import at the top too.
                // Since I can only replace a chunk, I will use dynamic import but adding a specific check and log.

                const { supabase } = await import('../db/supabase');

                if (supabase) {
                    const productData = {
                        name: p.name,
                        price: p.price,
                        category: p.category,
                        brand: p.brand,
                        size: p.size,
                        image: p.image,
                        stock: p.stock
                    };

                    // @ts-ignore
                    const { error } = await supabase.from('products').upsert({ ...productData, id: id });

                    if (error) throw error;
                    // If success, mark as synced
                    await db.products.update(id!, { synced: true });
                    console.log("[SYNC] Product synced successfully");
                } else {
                    console.warn("[SYNC] Supabase client is null. Data saved locally only (marked as unsynced).");
                }
            } catch (err: any) {
                console.error("Product cloud sync failed:", err);
            }

            setIsModalOpen(false);
            setEditingId(null);
        } catch (error) {
            console.error("Error saving product:", error);
            alert("Error al guardar el producto");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar este producto?')) return;
        await db.products.delete(id);

        // Sync to Supabase
        try {
            const { supabase } = await import('../db/supabase');
            if (supabase) {
                await supabase.from('products').delete().eq('id', id);
            }
        } catch (err) {
            console.error("Product delete sync failed:", err);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <KardexModal
                isOpen={isKardexOpen}
                onClose={() => setIsKardexOpen(false)}
                product={selectedProductForKardex}
            />

            <div className="flex justify-between items-center sticky top-0 bg-zinc-950/80 backdrop-blur-sm z-10 py-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Inventario</h2>
                    <p className="text-zinc-400 text-sm">Gestiona tus productos y precios</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                        <Plus size={24} />
                        <span className="font-bold text-sm hidden md:inline">Nuevo Producto</span>
                    </button>
                )}
            </div>

            {/* Sync Controls Toolbar */}
            <div className="max-w-7xl mx-auto px-4 mb-4">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${navigator.onLine ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'} transition-all`} />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            {navigator.onLine ? 'Online' : 'Offline'}
                        </span>
                    </div>

                    <button
                        onClick={async () => {
                            const btn = document.getElementById('refresh-btn');
                            if (btn) btn.classList.add('animate-spin');
                            try {
                                const { syncNow } = await import('../db/supabase');
                                await syncNow();
                                console.log('Manual sync complete');
                                window.location.reload();
                            } catch (e) {
                                console.error(e);
                            } finally {
                                if (btn) btn.classList.remove('animate-spin');
                            }
                        }}
                        className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-all"
                    >
                        <RefreshCw size={14} id="refresh-btn" />
                        <span>Recargar</span>
                    </button>
                    <button
                        onClick={async () => {
                            const { supabase } = await import('../db/supabase');
                            if (!supabase) {
                                alert("Supabase no está inicializado. Revisa tu conexión.");
                                return;
                            }
                            const status = await supabase.from('products').select('count', { count: 'exact', head: true });
                            if (status.error) {
                                alert(`ERROR DE CONEXIÓN:\n${status.error.message}\n\nPosible causa: RLS Policies o Clave Inválida.`);
                            } else {
                                await (supabase as any)
                                    .from('products')
                                    .select('name, id')
                                    .order('id', { ascending: false })
                                    .limit(3);
                                alert(`✅ CONEXIÓN EXITOSA\nProductos en Nube: ${status.count}\n(Si ves productos aquí pero NO en la nube, es tu caché local)`);
                            }
                        }}
                        className="flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-all"
                    >
                        <span>🔍 Diagnosticar</span>
                    </button>

                    <button
                        onClick={async () => {
                            if (!confirm("⚠️ ¿ESTÁS SEGURO?\n\nEsto borrará TODOS los datos de ESTE dispositivo (PC/Celular) para resincronizar desde cero.\n\nÚsalo si ves productos 'fantasmas'.")) return;

                            try {
                                console.log("🧹 Borrando base de datos local...");
                                await db.delete();
                                await db.open();
                                localStorage.clear();
                                alert("✅ Limpieza Completada.\nRecargando sistema...");
                                window.location.reload();
                            } catch (e) {
                                alert("Error al limpiar: " + e);
                            }
                        }}
                        className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-all"
                    >
                        <Trash2 size={14} />
                        <span>Reset Local</span>
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="sticky top-20 z-10 bg-black/80 backdrop-blur-md p-4 -mx-4 mb-6 border-b border-zinc-800 space-y-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input
                        placeholder="Buscar producto..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {['Todos', 'Bebidas', 'Snacks', 'Limpieza', 'General'].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${selectedCategory === cat
                                ? 'bg-white text-black shadow-lg shadow-white/10'
                                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {products.map(p => (
                    <div key={p.id} className="bg-zinc-900 p-3 sm:p-4 rounded-2xl flex items-center gap-2 sm:gap-4 border border-zinc-800 hover:border-zinc-700 transition-all group">
                        {/* Thumbnail */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-800 rounded-xl shrink-0 overflow-hidden flex items-center justify-center border border-zinc-700 relative">
                            {p.image ? (
                                <img src={p.image} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon size={20} className="text-zinc-600 sm:w-6 sm:h-6" />
                            )}
                            {/* Stock Indicator overlay if low */}
                            {p.stock !== undefined && p.stock <= 2 && (
                                <div className="absolute inset-0 bg-red-500/20 ring-1 ring-inset ring-red-500/50 rounded-xl flex items-center justify-center">
                                    <span className="text-[10px] bg-red-600 text-white px-1 rounded font-bold">BAJO</span>
                                </div>
                            )}
                        </div>

                        {/* Info - Stacked for mobile */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white text-sm sm:text-lg truncate leading-tight">{p.name}</h3>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                                {p.category && (
                                    <span className="text-[9px] sm:text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                        {p.category}
                                    </span>
                                )}
                                <p className="font-bold text-zinc-400 text-xs sm:text-sm">L {p.price.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Quick Stock Controls (Admin Only) - Compact on mobile */}
                        {isAdmin && (
                            <div className="flex items-center bg-zinc-950 rounded-lg sm:rounded-xl border border-zinc-800 p-0.5 sm:p-1">
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (currentUser) {
                                            await InventoryService.adjustStock(
                                                p.id!,
                                                -1,
                                                'adjustment',
                                                currentUser,
                                                "Ajuste rápido (-1)"
                                            );
                                        }
                                    }}
                                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md sm:rounded-lg transition-colors font-bold text-sm"
                                >
                                    -
                                </button>
                                <div className="w-6 sm:w-8 text-center text-[10px] sm:text-xs font-black text-white">
                                    {p.stock || 0}
                                </div>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (currentUser) {
                                            await InventoryService.adjustStock(
                                                p.id!,
                                                1,
                                                'restock',
                                                currentUser,
                                                "Ajuste rápido (+1)"
                                            );
                                        }
                                    }}
                                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md sm:rounded-lg transition-colors font-bold text-sm"
                                >
                                    +
                                </button>
                            </div>
                        )}

                        {/* Actions (Admin Only) - Smaller on mobile */}
                        {isAdmin && (
                            <div className="flex gap-1 sm:gap-2">
                                <button
                                    onClick={(e) => handleOpenKardex(p, e)}
                                    className="p-2 sm:p-3 bg-indigo-900/20 text-indigo-400 rounded-lg sm:rounded-xl hover:bg-indigo-900/40 hover:text-indigo-300 transition-colors border border-indigo-900/30"
                                    title="Ver Historial"
                                >
                                    <History size={14} className="sm:w-[18px] sm:h-[18px]" />
                                </button>
                                <button
                                    onClick={() => openModal(p)}
                                    className="p-2 sm:p-3 bg-zinc-800 text-zinc-300 rounded-lg sm:rounded-xl hover:bg-zinc-700 hover:text-white transition-colors border border-zinc-700"
                                >
                                    <Pencil size={14} className="sm:w-[18px] sm:h-[18px]" />
                                </button>
                                <button
                                    onClick={() => handleDelete(p.id!)}
                                    className="p-2 sm:p-3 bg-red-900/10 text-red-400 rounded-lg sm:rounded-xl hover:bg-red-900/30 hover:text-red-300 transition-colors border border-red-900/20"
                                >
                                    <Trash2 size={16} className="sm:w-[20px] sm:h-[20px]" />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-zinc-900 w-full max-w-lg rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                                <h3 className="text-xl font-black text-white">
                                    {editingId ? 'Editar Producto' : 'Nuevo Producto'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                                {/* Image Preview */}
                                <div className="flex justify-center mb-6">
                                    <div className="w-32 h-32 bg-zinc-800 rounded-2xl border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-hidden relative group">
                                        {formData.image ? (
                                            <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center p-4">
                                                <ImageIcon className="mx-auto text-zinc-600 mb-2" size={32} />
                                                <span className="text-xs text-zinc-500 font-medium">Sin imagen</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Nombre</label>
                                        <input
                                            required
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-500 transition-all font-medium"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Ej. Coca Cola"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Precio (L)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-500 transition-all font-bold text-lg"
                                                value={formData.price || ''}
                                                onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Talla (Size)</label>
                                            <input
                                                type="text"
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-500 transition-all font-bold"
                                                value={formData.size || ''}
                                                onChange={e => setFormData({ ...formData, size: e.target.value })}
                                                placeholder="ej. 9.5"
                                            />
                                        </div>
                                    </div>

                                    {/* Quick Sizing Chips */}
                                    <div>
                                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Tallas Rápidas</label>
                                        <div className="grid grid-cols-6 gap-2">
                                            {['36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5', '40', '40.5', '41', '41.5', '42', '42.5', '43', '43.5', '44', '44.5', '45', '45.5', '46'].map(s => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, size: s })}
                                                    className={`py - 2 rounded - lg text - xs font - bold border transition - all ${formData.size === s
                                                        ? 'bg-white text-black border-white shadow-lg shadow-white/5'
                                                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                                                        } `}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Categoría</label>
                                            <input
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-500 transition-all"
                                                value={formData.category || ''}
                                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                placeholder="Ej. Bebidas"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Marca</label>
                                            <input
                                                type="text"
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-500 transition-all"
                                                value={formData.brand || ''}
                                                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                                placeholder="ej. Nike"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Inventario (Stock)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-500 transition-all font-bold text-lg"
                                            value={formData.stock || 0}
                                            onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                                            placeholder="0"
                                        />
                                        <p className="text-[10px] text-zinc-500 mt-2 font-medium italic">
                                            ℹ️ Al guardar, se registrará un ajuste de inventario en el historial.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Imagen del Producto</label>

                                        {/* Upload Button */}
                                        <div className="flex flex-col gap-3">
                                            <button
                                                type="button"
                                                onClick={() => document.getElementById('imageInput')?.click()}
                                                className="w-full bg-zinc-800 text-zinc-300 py-3 rounded-xl border border-dashed border-zinc-600 hover:bg-zinc-700 hover:text-white hover:border-zinc-500 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                                            >
                                                <ImageIcon size={18} />
                                                {formData.image ? 'Cambiar Imagen' : 'Subir Imagen'}
                                            </button>
                                            <input
                                                id="imageInput"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (event) => {
                                                            const img = new Image();
                                                            img.onload = () => {
                                                                const canvas = document.createElement('canvas');
                                                                let width = img.width;
                                                                let height = img.height;

                                                                // Resize if too big (max 800px)
                                                                const MAX_SIZE = 800;
                                                                if (width > height) {
                                                                    if (width > MAX_SIZE) {
                                                                        height *= MAX_SIZE / width;
                                                                        width = MAX_SIZE;
                                                                    }
                                                                } else {
                                                                    if (height > MAX_SIZE) {
                                                                        width *= MAX_SIZE / height;
                                                                        height = MAX_SIZE;
                                                                    }
                                                                }

                                                                canvas.width = width;
                                                                canvas.height = height;
                                                                const ctx = canvas.getContext('2d');
                                                                ctx?.drawImage(img, 0, 0, width, height);

                                                                // Compress to JPEG 70%
                                                                const base64 = canvas.toDataURL('image/jpeg', 0.7);
                                                                setFormData({ ...formData, image: base64 });
                                                            };
                                                            img.src = event.target?.result as string;
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />

                                            {/* URL Fallback */}
                                            <div className="relative">
                                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                                    <div className="w-full border-t border-zinc-800"></div>
                                                </div>
                                                <div className="relative flex justify-center">
                                                    <span className="bg-zinc-900 px-2 text-xs text-zinc-500">O usa una URL</span>
                                                </div>
                                            </div>

                                            <input
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-500 transition-all text-sm"
                                                value={formData.image || ''}
                                                onChange={e => setFormData({ ...formData, image: e.target.value })}
                                                placeholder="https://ejemplo.com/imagen.jpg"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-white/5 active:scale-[0.98]"
                                    >
                                        <Save size={20} />
                                        <span>Guardar Producto</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
