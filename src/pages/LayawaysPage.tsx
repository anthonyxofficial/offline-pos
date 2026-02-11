import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Layaway, type Sale, type Payment } from '../db/db';
import { usePOS } from '../context/POSContext';
import { Search, Plus, DollarSign, Package, ChevronDown, ChevronUp } from 'lucide-react';

export const LayawaysPage = () => {
    const { currentUser } = usePOS();
    const layaways = useLiveQuery(() => db.layaways.orderBy('createdAt').reverse().toArray());
    const [search, setSearch] = useState('');
    const [expandedLayaway, setExpandedLayaway] = useState<number | null>(null);

    // Payment Modal State
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [selectedLayaway, setSelectedLayaway] = useState<Layaway | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'qr'>('cash');

    const filteredLayaways = layaways?.filter(l =>
        l.customerName.toLowerCase().includes(search.toLowerCase()) ||
        l.status.includes(search.toLowerCase())
    );

    const handleAddPaymentClick = (layaway: Layaway) => {
        setSelectedLayaway(layaway);
        setIsPayModalOpen(true);
        setPaymentAmount('');
        setPaymentMethod('cash');
    };

    const confirmPayment = async () => {
        if (!selectedLayaway || !paymentAmount) return;
        const amount = parseFloat(paymentAmount);
        if (amount <= 0) return alert('Monto inválido');
        if (amount > selectedLayaway.balance) return alert('El monto excede el saldo pendiente');

        const newPayment: Payment = {
            amount,
            date: new Date(),
            method: paymentMethod
        };

        const updatedPayments = [...selectedLayaway.payments, newPayment];
        const newBalance = selectedLayaway.balance - amount;
        const newStatus = newBalance <= 0.01 ? 'completed' : 'pending'; // Tolerance for float errors

        // Update Layaway
        await db.layaways.update(selectedLayaway.id!, {
            payments: updatedPayments,
            balance: newBalance,
            status: newStatus,
            updatedAt: new Date()
        });

        // Record Payment as Sale (Cash Flow)
        const paymentSale: Sale = {
            timestamp: new Date(),
            total: amount,
            salespersonId: currentUser!.id!,
            salespersonName: currentUser!.name,
            items: [{
                // @ts-ignore
                id: 99999,
                name: `Abono Apartado - ${selectedLayaway.customerName}`,
                price: amount,
                quantity: 1,
                image: '', category: 'System', size: 'N/A'
            }],
            paymentMethod: paymentMethod,
            shippingCost: 0
        };
        await db.sales.add(paymentSale);

        setIsPayModalOpen(false);
        setSelectedLayaway(null);
        alert('Abono registrado exitosamente');
    };

    const handleCancelLayaway = async (layaway: Layaway) => {
        if (!confirm('¿Seguro que deseas cancelar este apartado? Esto retornará los productos al inventario.')) return;

        // Return stock
        for (const item of layaway.items) {
            if (item.id) {
                const product = await db.products.get(item.id);
                if (product && product.stock !== undefined) {
                    await db.products.update(item.id, { stock: product.stock + item.quantity });
                }
            }
        }

        await db.layaways.update(layaway.id!, { status: 'cancelled', updatedAt: new Date() });
    };

    return (
        <div className="h-full flex flex-col animate-fade-in custom-scrollbar overflow-y-auto pb-20">
            <header className="flex justify-between items-center mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">Apartados</h1>
                    <p className="text-zinc-400 font-medium">Gestiona reservas y abonos de clientes</p>
                </div>
            </header>

            <div className="mb-6 relative shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por cliente..."
                    className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-zinc-600"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="grid gap-4">
                {filteredLayaways?.map(layaway => {
                    const isExpanded = expandedLayaway === layaway.id;
                    const progress = 100 - (layaway.balance / layaway.total * 100);

                    return (
                        <div key={layaway.id} className={`bg-zinc-900/50 border ${layaway.status === 'completed' ? 'border-emerald-900/50' : (layaway.status === 'cancelled' ? 'border-red-900/50' : 'border-zinc-800')} rounded-2xl overflow-hidden transition-all duration-300`}>
                            {/* Summary Row */}
                            <div
                                onClick={() => setExpandedLayaway(isExpanded ? null : layaway.id!)}
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${layaway.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : (layaway.status === 'cancelled' ? 'bg-red-500/10 text-red-400' : 'bg-indigo-500/10 text-indigo-400')}`}>
                                        {layaway.customerName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{layaway.customerName}</h3>
                                        <p className="text-xs text-zinc-500 font-medium">
                                            {new Date(layaway.createdAt).toLocaleDateString()} • {layaway.items.length} items
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden md:block">
                                        <p className="text-[10px] uppercase font-bold text-zinc-500">Saldo Pendiente</p>
                                        <p className={`font-black text-lg ${layaway.balance === 0 ? 'text-emerald-400' : 'text-white'}`}>
                                            L {layaway.balance.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${layaway.status === 'pending' ? 'bg-indigo-500/20 text-indigo-300' :
                                            layaway.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                                                'bg-red-900/50 text-red-400'
                                            }`}>
                                            {layaway.status === 'pending' ? 'Pendiente' : layaway.status === 'completed' ? 'Completado' : 'Cancelado'}
                                        </span>
                                    </div>
                                    {isExpanded ? <ChevronUp size={20} className="text-zinc-500" /> : <ChevronDown size={20} className="text-zinc-500" />}
                                </div>
                            </div>

                            {/* Detailed View */}
                            {isExpanded && (
                                <div className="p-6 border-t border-zinc-800 bg-zinc-950/30 animate-fade-in">
                                    {/* Progress Bar */}
                                    <div className="mb-6">
                                        <div className="flex justify-between text-xs font-bold mb-2 text-zinc-400">
                                            <span>Progreso de Pago</span>
                                            <span>{progress.toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-8">
                                        {/* Items List */}
                                        <div>
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Package size={14} /> Artículos Apartados
                                            </h4>
                                            <div className="space-y-3">
                                                {layaway.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                                                        <div className="flex gap-3 items-center">
                                                            {item.image && <img src={item.image} className="w-10 h-10 rounded-lg object-cover bg-zinc-800" alt="" />}
                                                            <div>
                                                                <p className="font-bold text-zinc-200 text-sm">{item.name}</p>
                                                                <p className="text-[10px] text-zinc-500">Talla: {item.size}</p>
                                                            </div>
                                                        </div>
                                                        <p className="font-bold text-zinc-400">L {item.price.toFixed(2)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Payment History & Actions */}
                                        <div>
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <DollarSign size={14} /> Historial de Pagos
                                            </h4>
                                            <div className="space-y-2 mb-6">
                                                {layaway.payments.map((p, idx) => (
                                                    <div key={idx} className="flex justify-between text-sm p-2 rounded-lg hover:bg-zinc-900 transition-colors">
                                                        <span className="text-zinc-400">{new Date(p.date).toLocaleDateString()}</span>
                                                        <span className="text-zinc-500 uppercase text-xs font-bold px-2 py-0.5 bg-zinc-800 rounded">{p.method}</span>
                                                        <span className="font-bold text-emerald-400">L {p.amount.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                {layaway.payments.length === 0 && <p className="text-zinc-600 italic text-sm">Sin abonos registrados.</p>}
                                                <div className="border-t border-zinc-800 mt-2 pt-2 flex justify-between font-bold">
                                                    <span className="text-zinc-400">Total Apartado:</span>
                                                    <span className="text-white">L {layaway.total.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between font-bold text-lg">
                                                    <span className="text-zinc-400">Saldo Pendiente:</span>
                                                    <span className="text-indigo-400">L {layaway.balance.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            {layaway.status === 'pending' && (
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => handleAddPaymentClick(layaway)}
                                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        <Plus size={18} /> Abonar
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelLayaway(layaway)}
                                                        className="py-3 px-4 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 rounded-xl font-bold transition-all border border-zinc-700 hover:border-red-900"
                                                        title="Cancelar y devolver stock"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {filteredLayaways?.length === 0 && (
                    <div className="text-center py-20 text-zinc-500">
                        <Package size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No hay apartados registrados.</p>
                    </div>
                )}
            </div>

            {/* ABONAR MODAL */}
            {isPayModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-zinc-900 w-full max-w-sm rounded-2xl p-6 border border-zinc-800 shadow-2xl">
                        <h3 className="text-xl font-black text-white mb-1">Nuevo Abono</h3>
                        <p className="text-zinc-500 text-sm mb-6">Para: <span className="text-white font-bold">{selectedLayaway?.customerName}</span></p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Monto a Abonar</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">L</span>
                                    <input
                                        type="number"
                                        autoFocus
                                        className="w-full pl-8 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-bold text-lg focus:outline-none focus:border-indigo-500"
                                        placeholder="0.00"
                                        value={paymentAmount}
                                        onChange={e => setPaymentAmount(e.target.value)}
                                    />
                                </div>
                                <p className="text-right text-[10px] text-zinc-500 mt-1">Máximo: L {selectedLayaway?.balance.toFixed(2)}</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Método</label>
                                <div className="flex gap-2">
                                    {['cash', 'card', 'qr'].map(m => (
                                        <button
                                            key={m}
                                            onClick={() => setPaymentMethod(m as any)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${paymentMethod === m ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-500'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setIsPayModalOpen(false)}
                                className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-bold hover:bg-zinc-700 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmPayment}
                                className="flex-1 py-3 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all shadow-lg active:scale-95"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
