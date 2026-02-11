import { useState, useEffect } from 'react';
import { X, CheckCircle, Smartphone, CreditCard, Banknote } from 'lucide-react';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (method: string, shippingCost: number) => void;
    total: number;
}

export const PaymentModal = ({ isOpen, onClose, onConfirm, total }: PaymentModalProps) => {
    const [method, setMethod] = useState<'cash' | 'card' | 'qr'>('cash');
    const [amountPaid, setAmountPaid] = useState('');
    const [shippingCost, setShippingCost] = useState('');
    const [change, setChange] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setAmountPaid('');
            setShippingCost('');
            setChange(0);
            setMethod('cash');
        }
    }, [isOpen]);

    const paidAmount = parseFloat(amountPaid) || 0;
    const shipping = parseFloat(shippingCost) || 0;
    const finalTotal = total + shipping; // Calculate total including shipping

    const canPay = method === 'cash' ? paidAmount >= finalTotal : true;

    useEffect(() => {
        if (method === 'cash') {
            setChange(Math.max(0, paidAmount - finalTotal));
        } else {
            setChange(0);
        }
    }, [amountPaid, total, shippingCost, method, paidAmount]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-zinc-900 w-full max-w-sm max-h-[95dvh] flex flex-col rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center shrink-0 bg-zinc-900 z-10">
                    <div>
                        <h2 className="text-lg font-black text-white leading-none">Pagar</h2>
                        <p className="text-zinc-500 font-medium text-xs">Subtotal: <span className="text-zinc-300 font-bold">L {total.toFixed(2)}</span></p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                    {/* Shipping & Total Row */}
                    <div className="flex gap-3 mb-4">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Envío (L)</label>
                            <input
                                type="number"
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-bold text-sm focus:outline-none focus:border-white transition-all placeholder:text-zinc-800"
                                placeholder="0"
                                value={shippingCost}
                                onChange={e => setShippingCost(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 bg-zinc-800/50 rounded-lg border border-zinc-700/50 flex flex-col items-center justify-center">
                            <span className="text-zinc-500 font-bold uppercase text-[9px]">Total Final</span>
                            <span className="text-xl font-black text-white">L {finalTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Methods */}
                    <div className="flex gap-2 mb-4">
                        {['cash', 'card', 'qr'].map(m => (
                            <button
                                key={m}
                                onClick={() => setMethod(m as any)}
                                className={`
                                    flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border transition-all
                                    ${method === m
                                        ? 'border-white bg-zinc-700 text-white'
                                        : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'}
                                `}
                            >
                                {m === 'cash' && <Banknote size={18} />}
                                {m === 'card' && <CreditCard size={18} />}
                                {m === 'qr' && <Smartphone size={18} />}
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                    {m === 'cash' ? 'Efec.' : m === 'card' ? 'Tarjeta' : 'QR'}
                                </span>
                            </button>
                        ))}
                    </div>

                    {method === 'cash' && (
                        <div className="space-y-3 animate-fade-in p-2 bg-black/20 rounded-xl mb-2">
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Recibido</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">L</span>
                                    <input
                                        type="number"
                                        autoFocus
                                        className="w-full pl-7 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-lg font-bold text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-zinc-800"
                                        placeholder="0.00"
                                        value={amountPaid}
                                        onChange={e => setAmountPaid(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                {[100, 200, 500, 1000].map(amt => (
                                    <button
                                        key={amt}
                                        onClick={() => setAmountPaid(amt.toString())}
                                        className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 font-bold hover:bg-zinc-700 hover:text-white transition-all whitespace-nowrap text-xs"
                                    >
                                        {amt}
                                    </button>
                                ))}
                            </div>

                            <div className={`p-2 rounded-lg border flex justify-between items-center ${canPay ? 'bg-green-950/20 border-green-900/30' : 'bg-transparent border-transparent'}`}>
                                <span className="text-zinc-500 font-bold text-xs uppercase">Cambio</span>
                                <span className={`text-lg font-black ${canPay ? 'text-green-400' : 'text-zinc-600'}`}>
                                    L {change.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Fixed Button */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/90 backdrop-blur shrink-0">
                    <button
                        disabled={!canPay}
                        onClick={() => onConfirm(method, shipping)}
                        className={`
                            w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg
                            ${canPay
                                ? 'bg-white text-black hover:bg-zinc-200 active:scale-95'
                                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}
                        `}
                    >
                        <CheckCircle size={18} />
                        <span>CONFIRMAR PAGO</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
