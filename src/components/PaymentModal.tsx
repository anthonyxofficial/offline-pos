import { useState, useEffect } from 'react';
import { X, CheckCircle, Smartphone, CreditCard, Banknote, Calendar } from 'lucide-react';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (method: string, shippingCost: number) => Promise<void>;
    onConfirmLayaway: (customerName: string, customerContact: string, initialPayment: number, method: string, shippingCost: number) => Promise<void>;
    total: number;
}

export const PaymentModal = ({ isOpen, onClose, onConfirm, onConfirmLayaway, total }: PaymentModalProps) => {
    const [method, setMethod] = useState<'cash' | 'card' | 'qr'>('cash');
    const [amountPaid, setAmountPaid] = useState('');
    const [shippingCost, setShippingCost] = useState('');
    const [change, setChange] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    // Layaway State
    const [isLayaway, setIsLayaway] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');

    useEffect(() => {
        if (isOpen) {
            setAmountPaid('');
            setShippingCost('');
            setChange(0);
            setMethod('cash');
            setIsProcessing(false);
            // Keep layaway state reset? Yes.
            setIsLayaway(false);
            setCustomerName('');
            setCustomerContact('');
        }
    }, [isOpen]);

    const paidAmount = parseFloat(amountPaid) || 0;
    const shipping = parseFloat(shippingCost) || 0;
    const finalTotal = total + shipping;

    // For layaway, balance is Total - Initial Payment
    const pendingBalance = Math.max(0, finalTotal - paidAmount);

    const canPay = isLayaway
        ? customerName.length > 0 && paidAmount >= 0
        : (method === 'cash' ? paidAmount >= finalTotal : true);

    useEffect(() => {
        if (!isLayaway && method === 'cash') {
            setChange(Math.max(0, paidAmount - finalTotal));
        } else {
            setChange(0);
        }
    }, [amountPaid, finalTotal, method, isLayaway, paidAmount]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-zinc-900 w-full max-w-sm max-h-[95dvh] flex flex-col rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-zinc-800 flex justify-between items-center shrink-0 bg-zinc-900 z-10">
                    <div>
                        <h2 className="text-xl font-black text-white leading-none tracking-tight">
                            {isLayaway ? 'Crear Apartado' : 'Confirmar Pago'}
                        </h2>
                        <p className="text-zinc-500 font-medium text-xs mt-1">Total a Procesar: <span className="text-zinc-300 font-bold">L {total.toFixed(2)}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-5">
                    {/* Mode Toggle */}
                    <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 relative">
                        <button
                            onClick={() => setIsLayaway(false)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all z-10 ${!isLayaway ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Venta Directa
                        </button>
                        <button
                            onClick={() => setIsLayaway(true)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all z-10 flex items-center justify-center gap-2 ${isLayaway ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/50' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <Calendar size={14} />
                            Apartado
                        </button>
                    </div>

                    {isLayaway && (
                        <div className="space-y-3 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl animate-fade-in">
                            <div>
                                <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Nombre del Cliente *</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-zinc-700 font-medium"
                                    placeholder="Ej. Juan Pérez"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Teléfono / Contacto</label>
                                <input
                                    type="tel"
                                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-zinc-700 font-medium"
                                    placeholder="Ej. 9988-7766"
                                    value={customerContact}
                                    onChange={e => setCustomerContact(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Shipping & Total Row */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Costo Envío (L)</label>
                            <input
                                type="number"
                                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-white transition-all placeholder:text-zinc-800"
                                placeholder="0"
                                value={shippingCost}
                                onChange={e => setShippingCost(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 bg-zinc-800/50 rounded-xl border border-zinc-700/50 flex flex-col items-center justify-center p-2">
                            <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1">
                                {isLayaway ? 'Total Apartado' : 'Total a Pagar'}
                            </span>
                            <span className="text-2xl font-black text-white tracking-tight">L {finalTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Método de Pago</label>
                        <div className="flex gap-2">
                            {['cash', 'card', 'qr'].map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMethod(m as any)}
                                    className={`
                                        flex-1 flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border transition-all
                                        ${method === m
                                            ? 'border-white bg-zinc-800 text-white shadow-lg shadow-white/5 ring-1 ring-white/20'
                                            : 'border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}
                                    `}
                                >
                                    {m === 'cash' && <Banknote size={20} />}
                                    {m === 'card' && <CreditCard size={20} />}
                                    {m === 'qr' && <Smartphone size={20} />}
                                    <span className="text-[10px] font-black uppercase tracking-wider">
                                        {m === 'cash' ? 'Efectivo' : m === 'card' ? 'Tarjeta' : 'QR'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Payment Input Section */}
                    <div className="space-y-3 p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl">
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                                {isLayaway ? 'Abono Inicial (Opcional)' : 'Monto Recibido'}
                            </label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-lg group-focus-within:text-white transition-colors">L</span>
                                <input
                                    type="number"
                                    className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-2xl font-black text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-zinc-800"
                                    placeholder="0.00"
                                    value={amountPaid}
                                    onChange={e => setAmountPaid(e.target.value)}
                                />
                            </div>
                        </div>

                        {method === 'cash' && (
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {[100, 200, 500, 1000].map(amt => (
                                    <button
                                        key={amt}
                                        onClick={() => setAmountPaid(amt.toString())}
                                        className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 font-bold hover:bg-zinc-700 hover:text-white transition-all whitespace-nowrap text-xs shadow-sm"
                                    >
                                        L {amt}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className={`p-3 rounded-xl border flex justify-between items-center transition-all ${isLayaway ? 'bg-indigo-500/10 border-indigo-500/20' : (canPay ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-transparent border-transparent')}`}>
                            <span className={`font-bold text-xs uppercase ${isLayaway ? 'text-indigo-400' : 'text-zinc-500'}`}>
                                {isLayaway ? 'Saldo Pendiente' : 'Cambio'}
                            </span>
                            <span className={`text-xl font-black ${isLayaway ? 'text-indigo-400' : (canPay ? 'text-emerald-400' : 'text-zinc-600')}`}>
                                L {isLayaway ? pendingBalance.toFixed(2) : change.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Fixed Button */}
                <div className="p-5 border-t border-zinc-800 bg-zinc-900/90 backdrop-blur shrink-0">
                    <button
                        disabled={!canPay || isProcessing}
                        onClick={async () => {
                            if (isProcessing) return;
                            setIsProcessing(true);
                            try {
                                if (isLayaway) {
                                    await onConfirmLayaway(customerName, customerContact, paidAmount, method, shipping);
                                } else {
                                    await onConfirm(method, shipping);
                                }
                            } finally {
                                setIsProcessing(false);
                            }
                        }}
                        className={`
                            w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xl
                            ${(canPay && !isProcessing)
                                ? (isLayaway ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-white text-black hover:bg-zinc-200 shadow-white/10') + ' active:scale-95'
                                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}
                        `}
                    >
                        {isProcessing ? (
                            <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                        ) : (
                            isLayaway ? <Calendar size={20} /> : <CheckCircle size={20} />
                        )}
                        <span className="tracking-wide">
                            {isProcessing ? 'PROCESANDO...' : (isLayaway ? 'CONFIRMAR APARTADO' : 'CONFIRMAR VENTA')}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};
