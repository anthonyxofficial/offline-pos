import { useEffect, useState } from 'react';
import { formatDateTime, formatDate } from '../utils/dateUtils';
import type { Sale, Expense } from '../db/db';
import logo from '../assets/logo.png';
import {
    Printer,
    TrendingUp,
    TrendingDown,
    DollarSign,
    CreditCard
} from 'lucide-react';

interface ReportData {
    startDate: string; // ISO strings via JSON
    endDate: string;
    sales: Sale[];
    expenses: Expense[];
    totalSales: number;
    totalExpenses: number;
    netProfit: number;
}

export const BalanceReportPrint = () => {
    const [data, setData] = useState<ReportData | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('print_report_data');
        if (stored) {
            try {
                setData(JSON.parse(stored));
            } catch (e) {
                console.error("Error parsing report data", e);
            }
        }
    }, []);

    if (!data) {
        return <div className="p-10 text-center text-gray-500">Cargando datos del reporte...</div>;
    }

    const { startDate, endDate, sales, expenses, totalSales, totalExpenses, netProfit } = data;
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);

    const cashSales = sales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
    const cardSales = sales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0);

    return (
        <div className="bg-white min-h-screen text-slate-900 font-sans p-8 md:p-12 print:p-0">
            {/* Print Controls */}
            <div className="fixed top-6 right-6 print:hidden flex gap-4">
                <button
                    onClick={() => window.print()}
                    className="bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-slate-800 flex items-center gap-2 transition-all"
                >
                    <Printer size={20} />
                    Imprimir / Guardar PDF
                </button>
            </div>

            {/* HEADER */}
            <header className="mb-12 border-b border-slate-200 pb-8 flex justify-between items-start">
                <div className="flex items-center gap-6">
                    <img src={logo} alt="Logo" className="w-24 h-24 object-contain rounded-xl" />
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">REPORTE FINANCIERO</h1>
                        <p className="text-slate-500 font-medium text-lg mt-1">POS Offline System | Sneaker Store</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="bg-slate-100 px-4 py-2 rounded-lg inline-block mb-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">PERIODO</p>
                        <p className="text-lg font-bold text-slate-900">
                            {formatDate(sDate)} — {formatDate(eDate)}
                        </p>
                    </div>
                    <p className="text-sm text-slate-400 mt-2">
                        Generado: {formatDateTime(new Date())}
                    </p>
                </div>
            </header>

            {/* KPI CARDS */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {/* Sales */}
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-1">Ingresos Totales</p>
                            <h2 className="text-3xl font-black text-slate-900">L {totalSales.toFixed(2)}</h2>
                        </div>
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <div className="flex gap-4 text-xs font-medium text-slate-500 mt-4 pt-4 border-t border-slate-200/50">
                        <span>Efec: L {cashSales.toFixed(2)}</span>
                        <span>Tarj: L {cardSales.toFixed(2)}</span>
                    </div>
                </div>

                {/* Expenses */}
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-red-500"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-bold text-red-600 uppercase tracking-wider mb-1">Gastos Operativos</p>
                            <h2 className="text-3xl font-black text-slate-900">L {totalExpenses.toFixed(2)}</h2>
                        </div>
                        <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                            <TrendingDown size={24} />
                        </div>
                    </div>
                    <p className="text-xs font-medium text-slate-400 mt-4 pt-4 border-t border-slate-200/50">
                        {expenses.length} registros contabilizados
                    </p>
                </div>

                {/* Profit */}
                <div className="bg-slate-900 text-white p-6 rounded-2xl relative overflow-hidden shadow-xl">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Utilidad Neta</p>
                            <h2 className="text-4xl font-black text-white">L {netProfit.toFixed(2)}</h2>
                        </div>
                        <div className="p-3 bg-white/10 text-white rounded-xl">
                            <DollarSign size={24} />
                        </div>
                    </div>
                    <p className="text-xs font-medium text-slate-400 mt-4 pt-4 border-t border-white/10">
                        Margen: {totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : 0}%
                    </p>
                </div>
            </section>

            {/* SALES TABLE */}
            <section className="mb-12 break-inside-avoid">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                        <CreditCard size={20} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Detalle de Ventas</h3>
                </div>

                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b-2 border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-3 px-4">Fecha / Hora</th>
                            <th className="py-3 px-4">ID</th>
                            <th className="py-3 px-4">Vendedor</th>
                            <th className="py-3 px-4">Método</th>
                            <th className="py-3 px-4 text-right">Monto</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {sales.map((sale, i) => (
                            <tr key={sale.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-3 px-4 font-mono text-slate-600">
                                    {formatDateTime(new Date(sale.timestamp))}
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-400">#{sale.id}</td>
                                <td className="py-3 px-4 font-medium text-slate-700">{sale.salespersonName}</td>
                                <td className="py-3 px-4">
                                    <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase ${sale.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' :
                                        sale.paymentMethod === 'card' ? 'bg-blue-100 text-blue-700' :
                                            'bg-purple-100 text-purple-700'
                                        }`}>
                                        {sale.paymentMethod}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-slate-900">
                                    L {sale.total.toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {/* EXPENSES TABLE */}
            {expenses.length > 0 && (
                <section className="break-inside-avoid">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-red-50 text-red-500 rounded-lg">
                            <TrendingDown size={20} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Detalle de Gastos</h3>
                    </div>

                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-red-100 text-xs font-bold text-red-400 uppercase tracking-wider">
                                <th className="py-3 px-4">Fecha</th>
                                <th className="py-3 px-4">Descripción</th>
                                <th className="py-3 px-4 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {expenses.map((exp, i) => (
                                <tr key={exp.id || i} className="border-b border-slate-100 hover:bg-red-50/30">
                                    <td className="py-3 px-4 font-mono text-slate-600">
                                        {formatDateTime(new Date(exp.timestamp))}
                                    </td>
                                    <td className="py-3 px-4 font-medium text-slate-700">{exp.description}</td>
                                    <td className="py-3 px-4 text-right font-bold text-red-600">
                                        - L {exp.amount.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {/* FOOTER */}
            <footer className="mt-16 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs">
                <p>Este documento es un comprobante interno generado por el sistema POS Offline.</p>
                <p className="mt-1">Página 1 de 1</p>
            </footer>
        </div>
    );
};
