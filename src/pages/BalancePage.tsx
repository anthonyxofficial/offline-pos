
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Download, Upload, History, CreditCard, Banknote, QrCode, Settings, Calendar as CalendarIcon } from 'lucide-react';
import { usePOS } from '../context/POSContext';

export const BalancePage = () => {
    const { currentUser } = usePOS();
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);

    if (currentUser?.role !== 'admin') {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-zinc-950">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6">
                    <Settings size={40} />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Acceso Denegado</h2>
                <p className="text-zinc-400 max-w-sm">
                    Lo sentimos, solo el administrador (Anthony) tiene permiso para ver las finanzas y el balance del negocio.
                </p>
            </div>
        );
    }
    const [showSettings, setShowSettings] = useState(false);
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseKey, setSupabaseKey] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDesc, setExpenseDesc] = useState('');

    useLiveQuery(async () => {
        const wa = await db.table('settings').get('whatsapp_number');
        if (wa) setWhatsappNumber(wa.value);

        const url = await db.table('settings').get('supabase_url');
        if (url) setSupabaseUrl(url.value);

        const key = await db.table('settings').get('supabase_key');
        if (key) setSupabaseKey(key.value);
    }, []);

    const saveWhatsappNumber = async () => {
        await db.table('settings').put({ key: 'whatsapp_number', value: whatsappNumber });
        alert('✅ Número de WhatsApp guardado');
    };

    const saveSupabaseConfig = async () => {
        await db.table('settings').put({ key: 'supabase_url', value: supabaseUrl });
        await db.table('settings').put({ key: 'supabase_key', value: supabaseKey });
        alert('✅ Configuración de Supabase guardada. Reiniciando para conectar...');
        window.location.reload();
    };

    const sales = useLiveQuery(async () => {
        if (!customDate) return [];
        const [y, m, d] = customDate.split('-').map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0);
        const end = new Date(y, m - 1, d, 23, 59, 59);
        return await db.sales.where('timestamp').between(start, end).reverse().toArray();
    }, [customDate]);

    const expenses = useLiveQuery(async () => {
        if (!customDate) return [];
        const [y, m, d] = customDate.split('-').map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0);
        const end = new Date(y, m - 1, d, 23, 59, 59);
        return await db.expenses.where('timestamp').between(start, end).reverse().toArray();
    }, [customDate]);

    const totalSales = sales?.reduce((sum, sale) => sum + sale.total, 0) || 0;
    const totalExpenses = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
    const netProfit = totalSales - totalExpenses;

    // Analytics
    const brandSales: Record<string, number> = {};
    const sizeSales: Record<string, number> = {};

    sales?.forEach(sale => {
        sale.items.forEach(item => {
            const brand = item.brand || 'Otras';
            const size = item.size ? item.size.toString() : 'N/A';
            brandSales[brand] = (brandSales[brand] || 0) + item.quantity;
            sizeSales[size] = (sizeSales[size] || 0) + item.quantity;
        });
    });

    const topBrands = Object.entries(brandSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topSizes = Object.entries(sizeSales).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const handleAddExpense = async () => {
        if (!expenseAmount || !expenseDesc) return;
        await db.expenses.add({
            amount: parseFloat(expenseAmount),
            description: expenseDesc,
            timestamp: new Date(),
            salespersonId: 0
        });
        setExpenseAmount('');
        setExpenseDesc('');
    };

    // Breakdown
    const cashTotal = sales?.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0) || 0;
    const cardTotal = sales?.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0) || 0;
    const qrTotal = sales?.filter(s => s.paymentMethod === 'qr').reduce((sum, s) => sum + s.total, 0) || 0;

    const handleExport = async () => {
        const products = await db.products.toArray();
        const salesData = await db.sales.toArray();
        const users = await db.users.toArray();
        const expensesData = await db.expenses.toArray();

        const data = { products, sales: salesData, users, expenses: expensesData, version: '1.0', timestamp: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pos-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportCSV = () => {
        if (!sales || !expenses) return;

        let csvContent = "\uFEFFFecha,Tipo,Descripcion/Producto,Vendedor,Metodo,Total\n";

        // Add Sales
        sales.forEach(sale => {
            const date = sale.timestamp.toLocaleString();
            const items = sale.items.map(i => `${i.name} (${i.size}) x${i.quantity}`).join(' | ');
            csvContent += `"${date}","Venta","${items}","${sale.salespersonName || 'N/A'}","${sale.paymentMethod || 'cash'}","${sale.total}"\n`;
        });

        // Add Expenses
        expenses.forEach(exp => {
            const date = exp.timestamp.toLocaleString();
            csvContent += `"${date}","Gasto","${exp.description}","N/A","N/A","-${exp.amount}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte-${customDate}.csv`);
        link.click();
    };

    const handlePrint = () => {
        window.print();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm('Esta acción reemplazará todos los datos actuales. ¿Deseas continuar?')) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data.products) {
                    await db.products.clear();
                    await db.products.bulkAdd(data.products);
                }
                if (data.sales) {
                    await db.sales.clear();
                    const formattedSales = data.sales.map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) }));
                    await db.sales.bulkAdd(formattedSales);
                }
                if (data.users) {
                    await db.users.clear();
                    await db.users.bulkAdd(data.users);
                }
                if (data.expenses) {
                    await db.expenses.clear();
                    const formattedExp = data.expenses.map((e: any) => ({ ...e, timestamp: new Date(e.timestamp) }));
                    await db.expenses.bulkAdd(formattedExp);
                }
                alert('✅ Datos importados correctamente');
                window.location.reload();
            } catch (err) {
                console.error(err);
                alert('❌ Error al importar el archivo. Formato no válido.');
            }
        };
        reader.readAsText(file);
    };

    const setToday = () => {
        setCustomDate(new Date().toISOString().split('T')[0]);
    };

    return (
        <div className="pb-20">
            {/* VISTA WEB / MÓVIL (NO-PRINT) */}
            <div className="no-print space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center sticky top-0 bg-zinc-950/80 backdrop-blur-sm z-10 py-4">
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight">Balance</h2>
                        <p className="text-zinc-400 text-sm italic">Control de ventas y gastos diarios</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportCSV}
                            className="bg-zinc-900 text-zinc-300 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-zinc-800 border border-zinc-800 transition-all font-bold text-sm"
                        >
                            <Download size={18} />
                            Excel
                        </button>
                        <button
                            onClick={handlePrint}
                            className="bg-zinc-900 text-zinc-300 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-zinc-800 border border-zinc-800 transition-all font-bold text-sm"
                        >
                            <History size={18} />
                            Imprimir
                        </button>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="p-3 bg-zinc-900 text-zinc-400 rounded-xl hover:bg-zinc-800 border border-zinc-800 transition-all"
                        >
                            <Settings size={20} />
                        </button>
                    </div>
                </div>

                {/* Settings / Backup Section */}
                {showSettings && (
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl animate-fade-in space-y-4 shadow-2xl">
                        <div className="flex items-center gap-2 mb-2">
                            <History size={18} className="text-zinc-500" />
                            <h3 className="font-bold text-white uppercase text-xs tracking-widest">Sincronización Manual</h3>
                        </div>
                        <p className="text-zinc-400 text-sm mb-4">Como esta es una App Offline, para pasar tus datos de la PC al Celular debes exportar el archivo aquí e importarlo en el otro dispositivo.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handleExport}
                                className="flex flex-col items-center justify-center p-6 bg-zinc-950 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all gap-2 group"
                            >
                                <Download size={24} className="text-white group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-bold text-zinc-300 uppercase">Exportar Datos</span>
                            </button>
                            <label className="flex flex-col items-center justify-center p-6 bg-zinc-950 border border-zinc-800 rounded-2xl hover:bg-zinc-800 cursor-pointer transition-all gap-2 group">
                                <Upload size={24} className="text-white group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-bold text-zinc-300 uppercase">Importar Datos</span>
                                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                            </label>
                        </div>

                        <div className="pt-4 border-t border-zinc-800 mt-4">
                            <div className="flex items-center gap-2 mb-4">
                                <QrCode size={18} className="text-green-500" />
                                <h3 className="font-bold text-white uppercase text-xs tracking-widest">Notificaciones WhatsApp</h3>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Número (ej. 50499887766)"
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-500 text-sm"
                                    value={whatsappNumber}
                                    onChange={(e) => setWhatsappNumber(e.target.value)}
                                />
                                <button
                                    onClick={saveWhatsappNumber}
                                    className="px-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all active:scale-95"
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-zinc-800 mt-4 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <History size={18} className="text-blue-500" />
                                <h3 className="font-bold text-white uppercase text-xs tracking-widest">Sincronización en la Nube (Supabase)</h3>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Supabase URL</label>
                                    <input
                                        type="text"
                                        placeholder="https://xyz.supabase.co"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-500 text-sm"
                                        value={supabaseUrl}
                                        onChange={(e) => setSupabaseUrl(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Anon Key</label>
                                    <input
                                        type="password"
                                        placeholder="Tu clave anon public"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-500 text-sm"
                                        value={supabaseKey}
                                        onChange={(e) => setSupabaseKey(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={saveSupabaseConfig}
                                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-500 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <History size={18} />
                                    Conectar y Sincronizar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Net Utility Card */}
                    <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-100 rounded-full -mr-16 -mt-16 opacity-50 transition-transform hover:scale-110"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">Utilidad Neta</span>
                                <button
                                    onClick={setToday}
                                    className="px-2 py-1 bg-zinc-100 text-zinc-900 rounded-lg text-[10px] font-black uppercase hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
                                >
                                    Hoy
                                </button>
                            </div>
                            <h3 className={`text-4xl font-black tracking-tight ${netProfit >= 0 ? 'text-black' : 'text-red-500'}`}>
                                L {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </h3>
                            <p className="text-zinc-400 text-[10px] font-bold mt-2 uppercase">Ventas - Gastos</p>
                        </div>
                        <div className="mt-8 flex flex-col gap-2">
                            <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Seleccionar Fecha</span>
                            <div className="relative group">
                                <CalendarIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-hover:text-black transition-colors pointer-events-none" />
                                <input
                                    type="date"
                                    value={customDate}
                                    onChange={(e) => setCustomDate(e.target.value)}
                                    className="w-full bg-zinc-50 text-zinc-900 text-sm font-black uppercase pl-10 pr-4 py-3 rounded-xl border border-zinc-100 focus:ring-4 focus:ring-zinc-200 transition-all cursor-pointer shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Gross Sales */}
                        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl flex flex-col justify-between">
                            <div>
                                <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] block mb-4">Ventas Totales</span>
                                <h4 className="text-3xl font-black text-white">L {totalSales.toLocaleString()}</h4>
                            </div>
                            <div className="mt-6 flex gap-4 border-t border-zinc-800 pt-6">
                                <div className="flex-1">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1 flex items-center gap-1">
                                        <Banknote size={10} className="text-green-500" /> Efec
                                    </p>
                                    <p className="text-sm font-black text-zinc-300">L {cashTotal.toLocaleString()}</p>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1 flex items-center gap-1">
                                        <CreditCard size={10} className="text-blue-400" /> Tarj
                                    </p>
                                    <p className="text-sm font-black text-zinc-300">L {cardTotal.toLocaleString()}</p>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1 flex items-center gap-1">
                                        <QrCode size={10} className="text-purple-400" /> QR
                                    </p>
                                    <p className="text-sm font-black text-zinc-300">L {qrTotal.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Expense Registration & Summary */}
                        <div className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-3xl flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Gastos Operativos</span>
                                <span className="text-red-400 font-black text-sm">- L {totalExpenses.toLocaleString()}</span>
                            </div>

                            <div className="space-y-2 mt-2">
                                <input
                                    type="number"
                                    placeholder="Monto (L)"
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-xl text-white text-sm focus:outline-none focus:border-zinc-500"
                                />
                                <input
                                    type="text"
                                    placeholder="¿En qué se gastó?"
                                    value={expenseDesc}
                                    onChange={(e) => setExpenseDesc(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-xl text-white text-sm focus:outline-none focus:border-zinc-500"
                                />
                                <button
                                    onClick={handleAddExpense}
                                    className="w-full bg-zinc-100 text-black py-2 rounded-xl text-xs font-black uppercase hover:bg-white active:scale-95 transition-all shadow-lg"
                                >
                                    Registrar Gasto
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analytics Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                        <div className="flex items-center gap-2 mb-4">
                            <History size={18} className="text-zinc-500" />
                            <h3 className="font-bold text-white uppercase text-xs tracking-widest">Lo más vendido (Marcas)</h3>
                        </div>
                        <div className="space-y-3">
                            {topBrands.length === 0 ? (
                                <p className="text-zinc-600 text-sm italic">Sin datos de ventas</p>
                            ) : (
                                topBrands.map(([brand, count]) => (
                                    <div key={brand} className="flex items-center justify-between">
                                        <span className="text-zinc-300 text-sm font-medium">{brand}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-32 bg-zinc-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-white transition-all duration-1000"
                                                    style={{ width: `${(count / (topBrands[0][1] || 1)) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-white text-xs font-black">{count}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                        <div className="flex items-center gap-2 mb-4">
                            <History size={18} className="text-zinc-500" />
                            <h3 className="font-bold text-white uppercase text-xs tracking-widest">Tallas más buscadas</h3>
                        </div>
                        <div className="space-y-3">
                            {topSizes.length === 0 ? (
                                <p className="text-zinc-600 text-sm italic">Sin datos de ventas</p>
                            ) : (
                                topSizes.map(([size, count]) => (
                                    <div key={size} className="flex items-center justify-between">
                                        <span className="text-zinc-300 text-sm font-medium">Talla {size}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-32 bg-zinc-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 transition-all duration-1000"
                                                    style={{ width: `${(count / (topSizes[0][1] || 1)) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-white text-xs font-black">{count}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Data History Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sales History */}
                    <div className="bg-zinc-900/50 rounded-3xl border border-zinc-800 flex flex-col h-[500px]">
                        <div className="p-5 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 rounded-t-3xl">
                            <div className="flex items-center gap-2">
                                <History size={18} className="text-zinc-500" />
                                <h3 className="font-bold text-zinc-400 text-xs uppercase tracking-widest">Ventas</h3>
                            </div>
                            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full uppercase">
                                {sales?.length || 0} Registros
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                            {sales?.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-zinc-600 text-sm italic">No hay ventas registradas</div>
                            ) : (
                                sales?.map(sale => (
                                    <div key={sale.id} className="bg-zinc-900 border border-zinc-800/50 p-4 rounded-2xl flex justify-between items-center group hover:bg-zinc-800 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-zinc-950 rounded-xl flex items-center justify-center border border-zinc-800 group-hover:border-zinc-700 transition-colors">
                                                {sale.paymentMethod === 'cash' ? <Banknote size={20} className="text-green-500" /> :
                                                    sale.paymentMethod === 'card' ? <CreditCard size={20} className="text-blue-400" /> :
                                                        <QrCode size={20} className="text-purple-400" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-white text-sm">Venta No. {sale.id}</p>
                                                    <span className="text-[10px] font-black uppercase text-zinc-600 tracking-tighter">
                                                        {sale.paymentMethod}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-zinc-500 font-medium">
                                                    {sale.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • <span className="italic">Por {sale.salespersonName}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-base font-black text-white">L {sale.total.toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Expense History */}
                    <div className="bg-zinc-900/50 rounded-3xl border border-zinc-800 flex flex-col h-[500px]">
                        <div className="p-5 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 rounded-t-3xl">
                            <div className="flex items-center gap-2">
                                <Download size={18} className="text-red-500 rotate-180" />
                                <h3 className="font-bold text-red-400 text-xs uppercase tracking-widest">Gastos / Egresos</h3>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                            {expenses?.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-zinc-600 text-sm italic">No hay gastos registrados</div>
                            ) : (
                                expenses?.map(exp => (
                                    <div key={exp.id} className="bg-zinc-950/50 border border-red-900/20 p-4 rounded-2xl flex justify-between items-center group shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-red-500/5 rounded-xl flex items-center justify-center border border-red-500/10">
                                                <Download size={20} className="text-red-500 rotate-180" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-zinc-200 text-sm">{exp.description}</p>
                                                <p className="text-[10px] text-zinc-500 font-medium lowercase">
                                                    {exp.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-base font-black text-red-400">- L {exp.amount.toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* VISTA DE IMPRESIÓN EMPRESARIAL (PURA TABLA) */}
            <div className="print-only">
                <div className="mb-10 text-center border-b-4 border-black pb-6">
                    <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">PA LOS PIES - Sneakers POS</h1>
                    <p className="text-sm font-bold uppercase tracking-[0.3em]">Reporte Consolidado de Balance</p>
                    <div className="flex justify-between mt-6 text-xs font-bold font-mono">
                        <p>FECHA DEL REPORTE: {customDate}</p>
                        <p>GENERADO: {new Date().toLocaleString()}</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-10">
                    <div className="border border-black p-4 text-center">
                        <p className="text-[10px] uppercase font-black mb-1">Ventas Totales</p>
                        <p className="text-2xl font-black">L {totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="border border-black p-4 text-center">
                        <p className="text-[10px] uppercase font-black mb-1">Gastos Totales</p>
                        <p className="text-2xl font-black">L {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="border border-black p-4 text-center">
                        <p className="text-[10px] uppercase font-black mb-1">Utilidad Neta</p>
                        <p className="text-2xl font-black">L {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className="space-y-10">
                    <section>
                        <h2 className="text-xl font-black uppercase mb-4 border-b-2 border-black">Detalle de Ventas</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Hora</th>
                                    <th>Vendedor</th>
                                    <th>Método</th>
                                    <th>Artículos</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales?.map(sale => (
                                    <tr key={sale.id}>
                                        <td className="font-bold">#{sale.id}</td>
                                        <td>{sale.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td>{sale.salespersonName}</td>
                                        <td className="uppercase">{sale.paymentMethod}</td>
                                        <td>{sale.items.map(i => `${i.name} (${i.size})`).join(', ')}</td>
                                        <td className="font-bold text-right">L {sale.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {sales?.length === 0 && <tr><td colSpan={6} className="text-center italic text-gray-400">Sin registros</td></tr>}
                            </tbody>
                        </table>
                    </section>

                    <section>
                        <h2 className="text-xl font-black uppercase mb-4 border-b-2 border-black">Detalle de Gastos</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Descripción</th>
                                    <th>Hora</th>
                                    <th>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses?.map(exp => (
                                    <tr key={exp.id}>
                                        <td className="font-bold">{exp.description}</td>
                                        <td>{exp.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="font-bold text-right text-red-600">L {exp.amount.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {expenses?.length === 0 && <tr><td colSpan={3} className="text-center italic text-gray-400">Sin registros</td></tr>}
                            </tbody>
                        </table>
                    </section>
                </div>

                <div className="mt-20 pt-10 border-t border-black grid grid-cols-2 gap-20">
                    <div className="text-center">
                        <div className="border-b border-black mb-2"></div>
                        <p className="text-[10px] font-black uppercase">Firma de Anthony (Administrador)</p>
                    </div>
                    <div className="text-center">
                        <div className="border-b border-black mb-2"></div>
                        <p className="text-[10px] font-black uppercase">Sello de Empresa</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
