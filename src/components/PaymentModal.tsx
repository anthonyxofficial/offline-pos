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
            <div className="bg-zinc-900 w-full max-w-md max-h-[90dvh] flex flex-col rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden transform transition-all">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight">Pagar</h2>
                        <p className="text-zinc-500 font-medium text-sm">Subtotal: <span className="text-zinc-300 font-bold">L {total.toFixed(2)}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto">
                    {/* Shipping Cost Input */}
                    <div className="mb-4">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Costo de Envío (Opcional)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">L</span>
                            <input
                                type="number"
                                className="w-full pl-8 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-bold focus:outline-none focus:border-white transition-all placeholder:text-zinc-700 sm:text-sm"
                                placeholder="0.00"
                                value={shippingCost}
                                onChange={e => setShippingCost(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="mb-4 p-3 bg-zinc-800/50 rounded-2xl flex justify-between items-center border border-zinc-700/50">
                        <span className="text-zinc-400 font-bold uppercase text-xs">Total Final</span>
                        <span className="text-2xl font-black text-white">L {finalTotal.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {['cash', 'card', 'qr'].map(m => (
                            <button
                                key={m}
                                onClick={() => setMethod(m as any)}
                                className={`
                                    flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all
                                    ${method === m
                                        ? 'border-white bg-zinc-700 text-white'
                                        : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700 hover:text-white'}
                                `}
                            >
                                {m === 'cash' && <Banknote size={20} />}
                                {m === 'card' && <CreditCard size={20} />}
                                {m === 'qr' && <Smartphone size={20} />}
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                    {m === 'cash' ? 'Efectivo' : m === 'card' ? 'Tarjeta' : 'QR/App'}
                                </span>
                            </button>
                        ))}
                    </div>

                    {method === 'cash' && (
                        <div className="space-y-4 animate-fade-in">
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Monto Recibido</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300 font-bold text-lg">L</span>
                                    <input
                                        type="number"
                                        autoFocus
                                        className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-xl font-bold text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-zinc-700"
                                        placeholder="0.00"
                                        value={amountPaid}
                                        onChange={e => setAmountPaid(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {[100, 200, 500, 1000].map(amt => (
                                    <button
                                        key={amt}
                                        onClick={() => setAmountPaid(amt.toString())}
                                        className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 font-bold hover:bg-zinc-700 hover:text-white transition-all whitespace-nowrap text-sm"
                                    >
                                        L {amt}
                                    </button>
                                ))}
                            </div>

                            <div className={`p-3 rounded-xl border ${canPay ? 'bg-green-950/30 border-green-900/50' : 'bg-zinc-800/50 border-zinc-800'} transition-colors`}>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-400 font-medium text-sm">Cambio</span>
                                    <span className={`text-xl font-black ${canPay ? 'text-green-400' : 'text-zinc-500'}`}>
                                        L {change.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        disabled={!canPay}
                        onClick={() => onConfirm(method, shipping)}
                        className={`
                            w-full mt-4 py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all shrink-0
                            ${canPay
                                ? 'bg-white text-black hover:bg-zinc-200 shadow-xl shadow-white/10 active:scale-95'
                                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}
                        `}
                    >
                        <CheckCircle size={20} />
                        <span>Confirmar Pago</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
