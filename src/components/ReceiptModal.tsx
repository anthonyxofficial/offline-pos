import { useState } from 'react';
import { X, Printer, CheckCircle, AlertTriangle } from 'lucide-react';
import type { Sale } from '../db/db';
import { formatDateTime } from '../utils/dateUtils';
import { usePOS } from '../context/POSContext';
import { db } from '../db/db';
import { InventoryService } from '../services/InventoryService';

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: Sale | null;
}

export const ReceiptModal = ({ isOpen, onClose, sale }: ReceiptModalProps) => {
    const { isAdmin, currentUser } = usePOS();
    const [isRefunding, setIsRefunding] = useState(false);

    if (!isOpen || !sale) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleRefund = async () => {
        if (!isAdmin) return;
        if (!confirm('¿Estás seguro de anular esta venta? Esta acción regresará el inventario de los artículos y enviará el dinero de vuelta. No se puede deshacer.')) return;

        setIsRefunding(true);
        try {
            // 1. Mark sale as refunded
            await db.sales.update(sale.id!, {
                refunded: true,
                synced: false // Force sync later
            });

            // 2. Return inventory for each item
            for (const item of sale.items) {
                if (item.id) {
                    await InventoryService.adjustStock(
                        item.id,
                        item.quantity, // Add quantity back
                        'return',
                        currentUser!,
                        `Devolución de Venta #${sale.id}`
                    );
                }
            }

            // 3. Optional: Create an automatic expense/negative entry? 
            // In BalancePage, we can just subtract refunded sales from the Total Sales instead so we don't double track it.

            alert('Venta anulada y artículos devueltos al inventario correctamente.');
            onClose(); // Close modal on success

            // Trigger background sync to push the update instantly
            import('../db/supabase').then(module => {
                if (module.syncPendingSales) module.syncPendingSales();
            }).catch(e => console.warn('Could not trigger background sync', e));
        } catch (error) {
            console.error("Error refunding sale:", error);
            alert("Hubo un error al intentar anular la venta.");
        } finally {
            setIsRefunding(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            {/* MODAL UI (HIDDEN IN PRINT) */}
            <div className="no-print bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
                {/* Header Actions */}
                <div className="p-4 flex justify-between items-center border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-900">Ticket de Venta</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Receipt Content */}
                <div className="relative p-6 text-black font-mono text-sm leading-relaxed" id="receipt-content">
                    {sale.refunded && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <span className="text-red-500/20 font-black text-6xl rotate-[-30deg] uppercase border-4 border-red-500/20 px-6 py-2 rounded-xl">
                                Anulado
                            </span>
                        </div>
                    )}
                    <div className="text-center mb-6">
                        <div className="flex justify-center mb-2 text-green-600">
                            <CheckCircle size={48} />
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-tight mb-1">PA LOS PIES</h1>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Comprobante de Venta</p>
                        <p className="text-gray-400 text-[10px] mt-1 font-bold">{formatDateTime(sale.timestamp)}</p>
                        <p className="text-gray-400 text-[10px] font-bold">Ticket No. {sale.id?.toString().padStart(6, '0')}</p>
                    </div>

                    <div className="border-b-2 border-dashed border-gray-300 my-4"></div>

                    <div className="space-y-3 mb-6">
                        {sale.items.map((item, index) => (
                            <div key={index} className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold">{item.name}</p>
                                    <p className="text-xs text-gray-500">
                                        {item.quantity} x L {item.price.toFixed(2)} {item.size && `| Talla: ${item.size}`}
                                    </p>
                                </div>
                                <p className="font-bold">L {(item.quantity * item.price).toFixed(2)}</p>
                            </div>
                        ))}
                    </div>

                    <div className="border-b-2 border-dashed border-gray-300 my-4"></div>

                    <div className="space-y-2">
                        {sale.shippingCost && sale.shippingCost > 0 && (
                            <>
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span>Subtotal</span>
                                    <span>L {(sale.total - sale.shippingCost).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span>Envío</span>
                                    <span>L {sale.shippingCost.toFixed(2)}</span>
                                </div>
                                <div className="border-b border-gray-200 my-1"></div>
                            </>
                        )}
                        <div className="flex justify-between text-lg font-black">
                            <span>TOTAL</span>
                            <span>L {sale.total.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="mt-8 text-center text-[10px] text-gray-500 border-t border-dashed border-gray-300 pt-4">
                        <p className="font-bold">¡Gracias por su preferencia!</p>
                        <p className="mt-4 text-[8px] text-gray-400 uppercase italic">Este documento no tiene validez fiscal</p>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-2">
                    {isAdmin && (
                        <button
                            onClick={handleRefund}
                            disabled={isRefunding || sale.refunded}
                            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${sale.refunded
                                ? 'bg-red-50 text-red-400 cursor-not-allowed border border-red-100'
                                : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'}`}
                        >
                            <AlertTriangle size={20} />
                            <span>{sale.refunded ? 'Venta Anulada' : isRefunding ? 'Anulando y Devolviendo Inventario...' : 'Anular Venta y Devolver Inventario'}</span>
                        </button>
                    )}
                    <button
                        onClick={handlePrint}
                        className="w-full py-3 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors shadow-lg"
                    >
                        <Printer size={20} />
                        <span>Imprimir Ticket</span>
                    </button>
                    <div className="mt-2 text-center text-[10px] text-gray-400">
                        También puedes tomar una captura de pantalla
                    </div>
                </div>
            </div>

            {/* PROFESSIONAL PRINT INVOICE (SHOWN ONLY IN PRINT) */}
            <div className="print-only w-full">
                <div className="border-b-4 border-black pb-6 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-tighter">PA LOS PIES</h1>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-600">Sneakers & Urban Fashion</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-black uppercase">Comprobante de Venta</h2>
                        <p className="font-mono text-sm">NO. FACTURA: {sale.id?.toString().padStart(6, '0')}</p>
                        <p className="font-mono text-xs text-gray-500">{formatDateTime(sale.timestamp)}</p>
                    </div>
                </div>

                <div className="mb-10 grid grid-cols-2 gap-10 text-sm">
                    <div>
                        <p className="font-black uppercase text-[10px] text-gray-500 mb-1">Vendido por:</p>
                        <p className="font-bold">{sale.salespersonName || 'Atención al Cliente'}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-black uppercase text-[10px] text-gray-500 mb-1">Método de Pago:</p>
                        <p className="font-bold uppercase">{sale.paymentMethod || 'Efectivo'}</p>
                    </div>
                </div>

                <table className="mb-10">
                    <thead>
                        <tr>
                            <th>Descripción del Producto</th>
                            <th className="text-center">Talla</th>
                            <th className="text-center">Cant.</th>
                            <th className="text-right">Precio Unit.</th>
                            <th className="text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.items.map((item, index) => (
                            <tr key={index}>
                                <td className="font-bold">{item.name}</td>
                                <td className="text-center">{item.size || '-'}</td>
                                <td className="text-center">{item.quantity}</td>
                                <td className="text-right font-mono">L {item.price.toFixed(2)}</td>
                                <td className="text-right font-bold font-mono">L {(item.quantity * item.price).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        {sale.shippingCost && sale.shippingCost > 0 && (
                            <>
                                <tr>
                                    <td colSpan={4} className="text-right font-bold uppercase text-gray-500 pt-4">Subtotal</td>
                                    <td className="text-right font-bold font-mono pt-4">L {(sale.total - sale.shippingCost).toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="text-right font-bold uppercase text-gray-500">Envío</td>
                                    <td className="text-right font-bold font-mono">L {sale.shippingCost.toFixed(2)}</td>
                                </tr>
                            </>
                        )}
                        <tr>
                            <td colSpan={4} className="text-right font-black uppercase bg-gray-50">Total Final</td>
                            <td className="text-right font-black text-xl font-mono">L {sale.total.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div className="mt-20 flex justify-between items-start gap-20">
                    <div className="flex-1 text-center">
                        <div className="border-b border-black mb-2"></div>
                        <p className="text-[10px] font-black uppercase">Firma de Conformidad</p>
                    </div>
                    <div className="flex-1 text-[9px] text-gray-500 leading-tight">
                        <p className="font-bold uppercase mb-2">Políticas de Garantía:</p>
                        <ul className="list-disc pl-3 mt-1 space-y-1">
                            <li>Cambios válidos únicamente en las primeras 24 horas.</li>
                            <li>El producto debe estar en perfectas condiciones y con su caja original.</li>
                            <li>No se realizan devoluciones de dinero.</li>
                        </ul>
                        <p className="mt-4 font-black uppercase italic">Este documento no tiene validez fiscal bajo el régimen de facturación vigente.</p>
                    </div>
                </div>

                <div className="mt-10 text-center font-bold text-[10px] uppercase tracking-widest text-gray-400">
                    ¡Gracias por elegir PA LOS PIES! - visitanos en instagram @palospies
                </div>
            </div>
        </div>
    );
};
