import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Product } from '../db/db';
import { db } from '../db/db';

interface SizeSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onSelect: (size: string) => void;
}

const SIZES = ['36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5', '40', '40.5', '41', '41.5', '42', '42.5', '43', '43.5', '44', '44.5', '45', '45.5', '46'];

export const SizeSelectorModal = ({ isOpen, onClose, product, onSelect }: SizeSelectorModalProps) => {
    const [stockMap, setStockMap] = useState<Record<string, number>>({});

    useEffect(() => {
        if (isOpen && product) {
            // Fetch all products with same name to find size variants
            db.products.where('name').equals(product.name).toArray().then(variants => {
                const map: Record<string, number> = {};
                variants.forEach(v => {
                    if (v.size) {
                        map[v.size.toString()] = v.stock || 0;
                    }
                });
                setStockMap(map);
            });
        }
    }, [isOpen, product]);

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-zinc-900 w-full max-w-sm rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-white leading-tight">Seleccionar Talla</h3>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-4 gap-2">
                        {SIZES.map(size => {
                            const stock = stockMap[size];
                            const hasStock = stock !== undefined && stock > 0;

                            return (
                                <button
                                    key={size}
                                    onClick={() => {
                                        onSelect(size);
                                        onClose();
                                    }}
                                    className={`py-2 flex flex-col items-center justify-center border rounded-xl transition-all active:scale-95 ${hasStock
                                            ? 'bg-zinc-950 text-white border-zinc-700 hover:border-white hover:bg-zinc-800'
                                            : 'bg-zinc-950/50 text-zinc-600 border-zinc-900 hover:border-zinc-800'
                                        }`}
                                >
                                    <span className={`font-bold text-sm ${hasStock ? 'text-white' : 'text-zinc-600'}`}>{size}</span>
                                    <span className={`text-[10px] font-mono ${hasStock ? 'text-emerald-400' : 'text-zinc-700'}`}>
                                        {stock !== undefined ? `${stock} ud.` : '-'}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    <button
                        onClick={() => {
                            onSelect(product.size?.toString() || 'N/A');
                            onClose();
                        }}
                        className="w-full mt-4 py-3 bg-zinc-800 text-zinc-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:text-white transition-colors"
                    >
                        Usar Predeterminada ({product.size || 'N/A'})
                    </button>
                </div>
            </div>
        </div>
    );
};
