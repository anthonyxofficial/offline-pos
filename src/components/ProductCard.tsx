import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '../db/db';

interface ProductCardProps {
    product: Product;
    onAdd: (product: Product) => void;
}

export const ProductCard = ({ product, onAdd }: ProductCardProps) => {
    const [imgError, setImgError] = useState(false);

    return (
        <div
            onClick={() => onAdd(product)}
            className="bg-zinc-900 rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-lg shadow-black/20 border border-zinc-800 hover:border-zinc-700 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group h-full flex flex-col active:scale-95 md:active:scale-100"
        >
            <div className="w-full aspect-square mb-3 overflow-hidden rounded-xl bg-zinc-800 flex items-center justify-center relative">
                {!imgError && product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-700">
                        <span className="text-2xl md:text-4xl font-bold">POS</span>
                    </div>
                )}
                <div className="absolute bottom-2 right-2 bg-white text-black p-1.5 md:p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <Plus size={16} className="md:w-5 md:h-5" />
                </div>
            </div>

            <div className="mt-auto">
                <div className="mb-1">
                    <h3 className="font-bold text-zinc-100 text-sm md:text-base leading-tight group-hover:text-white transition-colors line-clamp-2">{product.name}</h3>
                    <p className="text-xs text-zinc-500">{product.brand}</p>
                </div>
                <div className="flex justify-between items-end flex-wrap gap-1">
                    <span className="text-base md:text-xl font-black text-white tracking-tight">L {product.price.toFixed(2)}</span>
                    <div className="flex gap-1">
                        {product.size && (
                            <span className="text-[10px] uppercase font-bold text-black bg-white border border-zinc-200 px-1.5 py-0.5 rounded md:px-2 md:py-1">
                                {product.size}
                            </span>
                        )}
                        {product.stock !== undefined && (
                            <span className={`text-[10px] uppercase font-bold border px-1.5 py-0.5 rounded md:px-2 md:py-1 transition-all ${product.stock <= 2
                                ? 'bg-red-500/10 text-red-500 border-red-500/50 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                }`}>
                                {product.stock} {product.stock === 1 ? 'Par' : 'Pares'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
