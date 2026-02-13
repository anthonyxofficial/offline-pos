import React, { useState } from 'react';
import { X, Save, DollarSign, AlignLeft } from 'lucide-react';
import { db } from '../db/db';
import { usePOS } from '../context/POSContext';

interface AddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ isOpen, onClose }) => {

    // Use currentUser for assigning expense ownership
    const { currentUser } = usePOS();
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !description) return;

        setIsSubmitting(true);
        try {
            const expenseData = {
                amount: parseFloat(amount),
                description,
                timestamp: new Date(),
                salespersonId: currentUser?.id || 0, // Fallback to 0 if no user (should not happen in protected route)
                synced: false
            };

            // 1. Save locally
            // @ts-ignore
            const id = await db.expenses.add(expenseData);

            // 2. Sync to Supabase
            try {
                const { supabase } = await import('../db/supabase');
                if (supabase) {
                    await supabase.from('expenses').insert([{
                        ...expenseData,
                        timestamp: expenseData.timestamp.toISOString(), // PG format
                        salesperson_id: expenseData.salespersonId
                    }]);
                    await db.expenses.update(id, { synced: true });
                }
            } catch (err) {
                console.error("Cloud sync failed for expense:", err);
                // Silent fail, offline first
            }

            onClose();
            setAmount('');
            setDescription('');
        } catch (error) {
            console.error("Error saving expense:", error);
            alert("Error al guardar el gasto");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <span className="text-red-500">📉</span> Nuevo Gasto
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Monto (L)</label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                required
                                autoFocus
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white text-2xl font-black focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder-zinc-700"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                            />
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={24} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Descripción / Motivo</label>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder-zinc-700"
                                placeholder="Ej. Pago de Luz, Compra de Bolsas..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                            <AlignLeft className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={24} />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all ${isSubmitting
                                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20 active:scale-[0.98]'
                                }`}
                        >
                            <Save size={20} />
                            <span>{isSubmitting ? 'Guardando...' : 'Registrar Gasto'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
