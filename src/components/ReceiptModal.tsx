import { X, Printer, CheckCircle } from 'lucide-react';
import type { Sale } from '../db/db';

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: Sale | null;
}

export const ReceiptModal = ({ isOpen, onClose, sale }: ReceiptModalProps) => {
    if (!isOpen || !sale) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in print:p-0 print:bg-white print:static">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none print:rounded-none">

                {/* Header Actions (Hidden in Print) */}
                <div className="p-4 flex justify-between items-center border-b border-gray-100 bg-gray-50 print:hidden">
                    <h3 className="font-bold text-gray-900">Ticket de Venta</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Receipt Content */}
                <div className="p-6 text-black print:p-0 font-mono text-sm leading-relaxed" id="receipt-content">

                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="flex justify-center mb-2 text-green-600 print:hidden">
                            <CheckCircle size={48} />
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-tight mb-1">POS Offline</h1>
                        <p className="text-gray-500 text-xs">Comprobante de Pago</p>
                        <p className="text-gray-400 text-[10px] mt-1">{sale.timestamp.toLocaleString()}</p>
                        <p className="text-gray-400 text-[10px]">Ticket #{sale.id}</p>
                    </div>

                    {/* Divider */}
                    <div className="border-b-2 border-dashed border-gray-300 my-4"></div>

                    {/* Items */}
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

                    {/* Divider */}
                    <div className="border-b-2 border-dashed border-gray-300 my-4"></div>

                    {/* Totals */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-lg font-black">
                            <span>TOTAL</span>
                            <span>L {sale.total.toFixed(2)}</span>
                        </div>
                        {sale.paymentMethod && (
                            <div className="flex justify-between text-xs text-gray-500 uppercase font-medium mt-2">
                                <span>Método de Pago</span>
                                <span>
                                    {sale.paymentMethod === 'cash' ? 'Efectivo' :
                                        sale.paymentMethod === 'card' ? 'Tarjeta' : 'QR / App'}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between text-xs text-gray-500 uppercase font-medium">
                            <span>Atendido por</span>
                            <span>{sale.salespersonName || 'Cajero'}</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 text-center text-xs text-gray-400">
                        <p>¡Gracias por su compra!</p>
                        <p className="mt-1">Vuelva pronto</p>
                    </div>

                </div>

                {/* Footer Actions (Hidden in Print) */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 print:hidden">
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
        </div>
    );
};
