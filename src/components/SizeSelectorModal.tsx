import { X } from 'lucide-react';
import type { Product } from '../db/db';

interface SizeSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onSelect: (size: string) => void;
}

const SIZES = ['4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12', '13'];

export const SizeSelectorModal = ({ isOpen, onClose, product, onSelect }: SizeSelectorModalProps) => {
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
                        {SIZES.map(size => (
                            <button
                                key={size}
                                onClick={() => {
                                    onSelect(size);
                                    onClose();
                                }}
                                className="py-3 bg-zinc-950 text-white border border-zinc-800 rounded-xl font-bold text-sm hover:bg-white hover:text-black hover:border-white transition-all active:scale-90"
                            >
                                {size}
                            </button>
                        ))}
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
