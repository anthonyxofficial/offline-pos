import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product } from '../db/db';
import { Plus, Trash2, Pencil, X, Image as ImageIcon, Save } from 'lucide-react';
import { usePOS } from '../context/POSContext';

export const ProductsPage = () => {
    const { isAdmin } = usePOS();
    const products = useLiveQuery(() => db.products.orderBy('name').toArray(), []) || [];
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const p = formData; // Use formData for the product to be saved

        if (!p.name || p.price <= 0) return;

        try {
            let id: number | undefined = editingId || undefined;
            if (id) {
                await db.products.update(id, p);
            } else {
                id = await db.products.add(p) as number;
            }

            // Sync to Supabase
            try {
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
                    await supabase.from('products').upsert({ ...productData, id: id });
                }
            } catch (err) {
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
            <div className="flex justify-between items-center sticky top-0 bg-zinc-950/80 backdrop-blur-sm z-10 py-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Inventario</h2>
                    <p className="text-zinc-400 text-sm">Gestiona tus productos y precios</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => openModal()}
                        className="bg-white text-black px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-zinc-200 hover:shadow-lg shadow-white/10 transition-all active:scale-95 font-bold"
                    >
                        <Plus size={20} strokeWidth={3} />
                        <span className="hidden md:inline">Nuevo Producto</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-3">
                {products.map(p => (
                    <div key={p.id} className="bg-zinc-900 p-3 sm:p-4 rounded-2xl flex items-center gap-2 sm:gap-4 border border-zinc-800 hover:border-zinc-700 transition-all group">
                        {/* Thumbnail */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-800 rounded-xl shrink-0 overflow-hidden flex items-center justify-center border border-zinc-700">
                            {p.image ? (
                                <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon size={20} className="text-zinc-600 sm:w-6 sm:h-6" />
                            )}
                        </div>

                        {/* Info - Stacked for mobile */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white text-sm sm:text-lg truncate leading-tight">{p.name}</h3>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5">
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
                                        const newStock = Math.max(0, (p.stock || 0) - 1);
                                        await db.products.update(p.id!, { stock: newStock });
                                        try {
                                            const { supabase } = await import('../db/supabase');
                                            if (supabase) await supabase.from('products').upsert({ ...p, stock: newStock, id: p.id });
                                        } catch (err) { console.error(err); }
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
                                        const newStock = (p.stock || 0) + 1;
                                        await db.products.update(p.id!, { stock: newStock });
                                        try {
                                            const { supabase } = await import('../db/supabase');
                                            if (supabase) await supabase.from('products').upsert({ ...p, stock: newStock, id: p.id });
                                        } catch (err) { console.error(err); }
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
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-zinc-900 w-full max-w-lg rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-xl font-black text-white">
                                {editingId ? 'Editar Producto' : 'Nuevo Producto'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
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
                                        {['4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12', '13'].map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, size: s })}
                                                className={`py-2 rounded-lg text-xs font-bold border transition-all ${formData.size === s
                                                    ? 'bg-white text-black border-white shadow-lg shadow-white/5'
                                                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                                                    }`}
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
                                    <p className="text-[10px] text-zinc-500 mt-2 font-medium italic">Unidades disponibles actualmente.</p>
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
            )}
        </div>
    );
};
