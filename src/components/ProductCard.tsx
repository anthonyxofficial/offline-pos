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
            className="group relative bg-[#09090b] rounded-3xl p-3 shadow-2xl shadow-black/50 border border-white/5 force-gpu transition-all duration-300 hover:-translate-y-2 hover:shadow-purple-900/20 hover:border-purple-500/30 cursor-pointer overflow-hidden"
        >
            {/* Image Container with Glow */}
            <div className="w-full aspect-square mb-4 overflow-hidden rounded-2xl bg-zinc-900/50 flex items-center justify-center relative z-10">
                {!imgError && product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-800">
                        <span className="text-4xl font-black opacity-20 transform -rotate-12">POS</span>
                    </div>
                )}

                {/* Floating Add Button */}
                <div className="absolute bottom-3 right-3 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-75">
                    <div className="bg-purple-600 text-white p-2.5 rounded-full shadow-[0_0_15px_rgba(147,51,234,0.5)] flex items-center justify-center">
                        <Plus size={20} strokeWidth={3} />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                    <div>
                        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-0.5">{product.brand}</p>
                        <h3 className="font-bold text-zinc-100 text-sm md:text-base leading-tight line-clamp-2 group-hover:text-purple-200 transition-colors">
                            {product.name}
                        </h3>
                    </div>
                </div>

                <div className="mt-2 flex items-end justify-between">
                    <span className="text-lg md:text-xl font-black text-white tracking-tight flex items-baseline gap-0.5">
                        <span className="text-xs text-zinc-500 font-normal">L</span>
                        {product.price.toFixed(2)}
                    </span>

                    {product.stock !== undefined && (
                        <span className={`text-[9px] uppercase font-black px-2 py-1 rounded-lg border backdrop-blur-md ${product.stock <= 2
                                ? 'bg-red-500/10 text-red-500 border-red-500/30 animate-pulse'
                                : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50'
                            }`}>
                            {product.stock} {product.stock === 1 ? 'Par' : 'Pares'}
                        </span>
                    )}
                </div>
            </div>

            {/* Background Gradient Effect on Hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>
    );
};
