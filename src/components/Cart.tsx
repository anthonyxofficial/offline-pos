import { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { Trash2 } from 'lucide-react';
import { Numpad } from './Numpad';

interface CartProps {
    onCheckout: () => void;
}

export const Cart = ({ onCheckout }: CartProps) => {
    const { cart, updateQuantity, updatePrice, clearCart, selectedCartKey, setSelectedCartKey } = usePOS();
    const [activeMode, setActiveMode] = useState<'qty' | 'price' | 'disc'>('qty');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <div className="flex flex-col h-full bg-zinc-900/50 backdrop-blur-md rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex justify-between items-center shrink-0">
                <h2 className="font-bold text-white text-lg">Ticket</h2>
                <button
                    onClick={clearCart}
                    className="text-xs text-zinc-500 hover:text-red-400 font-medium px-3 py-1 bg-zinc-800 rounded-full transition-colors uppercase tracking-wider hover:bg-zinc-700"
                >
                    Limpiar
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-zinc-700 hover:scrollbar-thumb-zinc-600">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                        <div className="p-4 bg-zinc-800/50 rounded-full"><Trash2 size={24} /></div>
                        <p className="font-medium">Carrito Vacío</p>
                    </div>
                ) : (
                    cart.map((item) => {
                        const key = `${item.id}-${item.size}`;
                        const isSelected = selectedCartKey === key;
                        return (
                            <div
                                key={key}
                                onClick={() => setSelectedCartKey(key)}
                                className={`flex justify-between items-center p-3 rounded-2xl border cursor-pointer transition-all active:scale-[0.98] ${isSelected
                                    ? 'bg-white text-black border-white shadow-lg shadow-white/10 scale-[1.02] z-10'
                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                                    }`}
                            >
                                <div className="flex-1 min-w-0 mr-2">
                                    <h4 className={`text-sm font-bold truncate ${isSelected ? 'text-black' : 'text-zinc-200'}`}>
                                        {item.name}
                                    </h4>
                                    <div className="flex gap-2 text-xs">
                                        <span className={isSelected ? 'text-zinc-500' : 'text-zinc-500'}>{item.brand}</span>
                                        {item.size && (
                                            <span className={`px-1 rounded font-bold uppercase ${isSelected ? 'bg-zinc-200 text-black' : 'bg-zinc-800 text-zinc-300'}`}>
                                                Talla {item.size}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-black ${isSelected ? 'text-black' : 'text-white'}`}>
                                        L {(item.price * item.quantity).toFixed(2)}
                                    </p>
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                                        {item.quantity} x {item.price.toFixed(0)}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Numpad Section */}
            <div className="shrink-0 p-2 bg-zinc-900 border-t border-zinc-800">
                <div className="flex justify-center gap-2 mb-2">
                    <button onClick={() => setActiveMode('qty')} className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${activeMode === 'qty' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-300'}`}>
                        Cant.
                    </button>
                    <button onClick={() => setActiveMode('price')} className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${activeMode === 'price' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-300'}`}>
                        Precio
                    </button>
                </div>
                <Numpad
                    onInput={(v) => {
                        if (!selectedCartKey) return;
                        const item = cart.find(i => `${i.id}-${i.size}` === selectedCartKey);
                        if (!item) return;

                        if (v === 'Qty') { setActiveMode('qty'); return; }
                        if (v === 'Price') { setActiveMode('price'); return; }
                        if (['Disc', '+/-'].includes(v)) return; // Not impl

                        if (v === '.') return;

                        const num = parseInt(v);
                        if (isNaN(num)) return;

                        if (activeMode === 'qty') {
                            let newQStr = item.quantity.toString();
                            if (item.quantity === 1) newQStr = '';
                            let newQ = parseInt(`${newQStr}${num}`);
                            if (isNaN(newQ)) newQ = num;
                            if (newQ > 999) newQ = 999;
                            if (newQ === 0) newQ = 1;
                            updateQuantity(item.id!, item.size, newQ);
                        } else if (activeMode === 'price') {
                            let newP = parseInt(`${Math.floor(item.price)}${num}`);
                            updatePrice(item.id!, item.size, newP);
                        }
                    }}
                    onDelete={() => {
                        if (selectedCartKey) {
                            const item = cart.find(i => `${i.id}-${i.size}` === selectedCartKey);
                            if (item) {
                                if (activeMode === 'qty') updateQuantity(item.id!, item.size, 0); // Remove
                                if (activeMode === 'price') updatePrice(item.id!, item.size, 0);
                            }
                        }
                    }}
                />
            </div>

            <div className="p-5 bg-zinc-900 border-t border-zinc-800">
                <div className="flex justify-between items-end mb-4">
                    <span className="text-zinc-400 text-sm font-bold uppercase tracking-wider">Total</span>
                    <span className="text-3xl font-black text-white tracking-tight">L {total.toFixed(2)}</span>
                </div>
                <button
                    onClick={onCheckout}
                    className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg shadow-xl shadow-white/10 hover:bg-zinc-200 hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center group"
                >
                    <span>Pagar</span>
                </button>
            </div>
        </div >
    );
};
