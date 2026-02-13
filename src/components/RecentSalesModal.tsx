import { X, Calendar, Clock, Banknote, CreditCard, Smartphone } from 'lucide-react';
import type { Sale } from '../db/db';
import { formatDate, formatTime } from '../utils/dateUtils';

interface RecentSalesModalProps {
    isOpen: boolean;
    onClose: () => void;
    sales: Sale[];
    onRepaintReceipt: (sale: any) => void;
}

export const RecentSalesModal = ({ isOpen, onClose, sales, onRepaintReceipt }: RecentSalesModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-zinc-900 w-full max-w-lg max-h-[80dvh] flex flex-col rounded-3xl shadow-2xl border border-zinc-800">
                {/* Header */}
                <div className="px-6 py-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900 rounded-t-3xl">
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight">Mis Ventas Recientes</h2>
                        <p className="text-zinc-500 text-xs font-medium mt-1">Últimas transacciones realizadas por ti</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                    {sales.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-zinc-500 space-y-2">
                            <Clock size={32} />
                            <p className="text-sm font-medium">No hay ventas registradas hoy</p>
                        </div>
                    ) : (
                        sales.map((sale) => (
                            <div key={sale.id} className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 flex justify-between items-center hover:bg-zinc-800/30 transition-colors group">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-bold text-sm">#{sale.id}</span>
                                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-md flex items-center gap-1 uppercase font-bold">
                                            {sale.paymentMethod === 'cash' && <Banknote size={10} />}
                                            {sale.paymentMethod === 'card' && <CreditCard size={10} />}
                                            {sale.paymentMethod === 'qr' && <Smartphone size={10} />}
                                            {sale.paymentMethod === 'cash' ? 'Efectivo' : sale.paymentMethod === 'card' ? 'Tarjeta' : 'QR'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-zinc-500 text-xs">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={10} />
                                            {formatDate(sale.timestamp)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={10} />
                                            {formatTime(sale.timestamp)}
                                        </span>
                                        <span className="font-medium text-zinc-400">
                                            {sale.items.length} items
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="text-emerald-400 font-black text-lg">L {sale.total.toFixed(2)}</span>
                                    <button
                                        onClick={() => onRepaintReceipt(sale)}
                                        className="text-[10px] text-zinc-400 hover:text-white underline decoration-zinc-700 hover:decoration-white transition-all uppercase font-bold"
                                    >
                                        Ver Recibo
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
