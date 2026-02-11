import { useEffect, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Package, User, Calendar } from 'lucide-react';
import { db, type StockMovement, type Product } from '../db/db';

interface KardexModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
}

export const KardexModal = ({ isOpen, onClose, product }: KardexModalProps) => {
    const [movements, setMovements] = useState<StockMovement[]>([]);

    useEffect(() => {
        if (isOpen && product?.id) {
            db.stock_movements
                .where('productId')
                .equals(product.id)
                .reverse()
                .sortBy('timestamp')
                .then(setMovements);
        }
    }, [isOpen, product]);

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-zinc-900 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900 z-10">
                    <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            <Package className="text-indigo-500" size={24} />
                            Historial de Movimientos
                        </h2>
                        <p className="text-zinc-500 text-sm mt-1 font-medium">
                            Producto: <span className="text-white font-bold">{product.name}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="space-y-3">
                        {movements.map((move) => {
                            const isPositive = move.quantity > 0;
                            const isSale = move.type === 'sale';
                            const isReturn = move.type === 'return';

                            return (
                                <div key={move.id} className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-zinc-700 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold ${isSale ? 'bg-red-500/10 text-red-500' :
                                            isReturn ? 'bg-yellow-500/10 text-yellow-500' :
                                                isPositive ? 'bg-emerald-500/10 text-emerald-500' :
                                                    'bg-zinc-800 text-zinc-400'
                                            }`}>
                                            {isPositive ? <ArrowRight className="rotate-[-45deg]" size={18} /> : <ArrowLeft className="rotate-[-45deg]" size={18} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-md ${isSale ? 'bg-red-900/30 text-red-400' :
                                                    isReturn ? 'bg-yellow-900/30 text-yellow-400' :
                                                        move.type === 'restock' ? 'bg-emerald-900/30 text-emerald-400' :
                                                            'bg-zinc-800 text-zinc-400'
                                                    }`}>
                                                    {move.type === 'sale' ? 'Venta' :
                                                        move.type === 'restock' ? 'Entrada' :
                                                            move.type === 'return' ? 'Devolución' :
                                                                move.type === 'layaway' ? 'Apartado' :
                                                                    'Ajuste'}
                                                </span>
                                                <span className="text-xs text-zinc-500 flex items-center gap-1">
                                                    <Calendar size={10} />
                                                    {new Date(move.timestamp).toLocaleDateString()} {new Date(move.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-zinc-600 text-xs flex items-center gap-1">
                                                <User size={10} /> Por: {move.userName}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase font-bold text-zinc-500">Cambio</p>
                                            <p className={`font-black text-lg ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {isPositive ? '+' : ''}{move.quantity}
                                            </p>
                                        </div>
                                        <div className="text-right pl-6 border-l border-zinc-800">
                                            <p className="text-[10px] uppercase font-bold text-zinc-500">Stock Final</p>
                                            <p className="font-bold text-white text-lg">{move.newStock}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {movements.length === 0 && (
                            <div className="text-center py-12">
                                <Package size={48} className="mx-auto text-zinc-800 mb-4" />
                                <p className="text-zinc-500">No hay movimientos registrados para este producto.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
