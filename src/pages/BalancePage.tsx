
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type User } from '../db/db';
import { supabase, syncAllData } from '../db/supabase';
import { Download, Trash2, Shield, UserPlus, Activity, Lock, RefreshCw, MapPin, Settings, Upload, QrCode, Banknote, CreditCard, History, Calendar as CalendarIcon, Cloud, Database } from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { ReportService } from '../services/ReportService';
import { formatTime } from '../utils/dateUtils';

export const BalancePage = () => {
    const { currentUser } = usePOS();
    // ... existing date state ...

    const users = useLiveQuery(() => db.users.toArray());
    const [newUser, setNewUser] = useState<User>({ name: '', pin: '', role: 'sales' });
    const [showUserAuth, setShowUserAuth] = useState(false);

    const handleAddUser = async () => {
        if (!newUser.name || !newUser.pin) return alert('Nombre y PIN requeridos');
        if (newUser.pin.length < 4) return alert('El PIN debe tener 4 dígitos');

        await db.users.add(newUser);
        setNewUser({ name: '', pin: '', role: 'sales' });
        alert('Usuario agregado exitosamente');
    };

    const handleDeleteUser = async (id: number) => {
        if (id === currentUser?.id) return alert('No puedes eliminar tu propio usuario');
        if (confirm('¿Estás seguro de eliminar este usuario?')) {
            await db.users.delete(id);
        }
    };

    // ... rest of the component ...

    // Insert the User Management Section somewhere appropriate, e.g., after the charts or settings
    // For now, I'll provide a block that can be inserted. 
    // Wait, replace_file_content is for replacing existing content. I need to be careful.
    // I should probably use `view_file` again to find a good insertion point if I want to append.
    // Or I can rewrite the top part to include the imports and state, and then use another call to append the UI.
    // Date & Range Logic
    const [filterType, setFilterType] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('daily');
    const [customDate, setCustomDate] = useState(() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });

    const getRange = (dateStr: string, type: typeof filterType) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const reference = new Date(y, m - 1, d);
        let start = new Date(reference);
        let end = new Date(reference);

        switch (type) {
            case 'daily':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'weekly':
                // Adjust to Monday - Sunday
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                start.setHours(0, 0, 0, 0);

                end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                break;
            case 'biweekly':
                if (reference.getDate() <= 15) {
                    start.setDate(1);
                    end.setDate(15);
                } else {
                    start.setDate(16);
                    end = new Date(y, m, 0); // Last day of month
                }
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'monthly':
                start.setDate(1);
                end = new Date(y, m, 0);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
        }
        return { start, end };
    };

    const { start: startDate, end: endDate } = getRange(customDate, filterType);

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

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncLog, setSyncLog] = useState<string>('');

    const handleForceSync = async () => {
        if (!confirm('¿Estás seguro de forzar la sincronización? Esto descargará datos de la nube.')) return;

        setIsSyncing(true);
        setSyncLog('⏳ Conectando con Supabase...');
        try {
            if (!supabase) {
                setSyncLog('❌ Error: Supabase no inicializado. Revisa la configuración.');
                return;
            }

            // Check connection first
            const { count, error } = await supabase.from('sales').select('*', { count: 'exact', head: true });
            if (error) throw error;

            setSyncLog(`✅ Conexión Exitosa. Ventas en Nube: ${count}. Sincronizando...`);

            await syncAllData();
            setSyncLog('✅ Sincronización Completada. Recargando...');
            setTimeout(() => window.location.reload(), 1000);
        } catch (err: any) {
            console.error(err);
            setSyncLog(`❌ Error: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const sales = useLiveQuery(async () => {
        if (!startDate || !endDate) return [];

        console.log(`[BALANCE QUERY] Rango:`, startDate, endDate);

        // MODO FUERZA BRUTA: Traer todo y filtrar en memoria
        const allSales = await db.sales.toArray();
        console.log(`[BALANCE DEBUG] Total en BD: ${allSales.length}`);

        const result = allSales.filter(sale => {
            const saleDate = new Date(sale.timestamp);
            if (isNaN(saleDate.getTime())) return false;
            return saleDate >= startDate && saleDate <= endDate;
        }).sort((a, b) => b.id! - a.id!);

        console.log(`[BALANCE DEBUG] Filtradas: ${result.length}`);

        if (result.length === 0 && allSales.length > 0) {
            console.log("[DEBUG] Primera venta BD:", new Date(allSales[0].timestamp));
            console.log("[DEBUG] Rango:", startDate, endDate);
        }

        return result;
    }, [startDate, endDate]);

    const expenses = useLiveQuery(async () => {
        if (!startDate || !endDate) return [];

        const allExpenses = await db.expenses.toArray();
        return allExpenses.filter(exp => {
            const expDate = new Date(exp.timestamp);
            if (isNaN(expDate.getTime())) return false;
            return expDate >= startDate && expDate <= endDate;
        }).sort((a, b) => b.id! - a.id!);
    }, [startDate, endDate]);

    const totalSales = sales?.reduce((sum, sale) => {
        const saleTotal = Number(sale.total) || 0;
        console.log(`[BALANCE DEBUG] Sale #${sale.id}: total=${sale.total}, converted=${saleTotal}`);
        return sum + saleTotal;
    }, 0) || 0;
    const totalExpenses = expenses?.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0) || 0;
    const netProfit = totalSales - totalExpenses;

    console.log(`[BALANCE DEBUG] Calculations: Sales=${totalSales}, Expenses=${totalExpenses}, Profit=${netProfit}`);

    // Analytics - Existing
    const brandSales: Record<string, number> = {};
    const sizeSales: Record<string, number> = {};

    // NEW: Advanced Analytics
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    const sellerPerformance: Record<string, { name: string; sales: number; transactions: number }> = {};

    sales?.forEach(sale => {
        // Seller stats
        const sellerName = sale.salespersonName || 'Sin Vendedor';
        if (!sellerPerformance[sellerName]) {
            sellerPerformance[sellerName] = { name: sellerName, sales: 0, transactions: 0 };
        }
        sellerPerformance[sellerName].sales += sale.total;
        sellerPerformance[sellerName].transactions += 1;

        sale.items.forEach(item => {
            const brand = item.brand || 'Otras';
            const size = item.size ? item.size.toString() : 'N/A';
            brandSales[brand] = (brandSales[brand] || 0) + item.quantity;
            sizeSales[size] = (sizeSales[size] || 0) + item.quantity;

            // Product stats
            const productKey = item.name;
            if (!productSales[productKey]) {
                productSales[productKey] = { name: item.name, quantity: 0, revenue: 0 };
            }
            productSales[productKey].quantity += item.quantity;
            productSales[productKey].revenue += item.price * item.quantity;
        });
    });

    const topBrands = Object.entries(brandSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topSizes = Object.entries(sizeSales).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // NEW: Top products by quantity and revenue
    const topProductsByRevenue = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // NEW: Seller ranking
    const sellerRanking = Object.values(sellerPerformance).sort((a, b) => b.sales - a.sales);
    const avgTicket = sales && sales.length > 0 ? totalSales / sales.length : 0;

    // NEW: Low stock products query
    const allProducts = useLiveQuery(() => db.products.toArray(), []);
    const lowStockProducts = allProducts?.filter(p => (p.stock ?? 0) <= 2) || [];

    // NEW: Dormant products (not sold on selected date)
    const soldProductNames = new Set(Object.keys(productSales));
    const dormantProducts = allProducts?.filter(p => !soldProductNames.has(p.name)) || [];

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



    // ... existing imports ...

    const handleExportPDF = async () => {
        if (!sales || !expenses) return;

        await ReportService.generateBalancePDF({
            startDate,
            endDate,
            sales,
            expenses,
            totalSales,
            totalExpenses,
            netProfit
        });
    };

    const handleExportExcel = async () => {
        if (!sales || !expenses) return;

        await ReportService.generateBalanceExcel({
            startDate,
            endDate,
            sales,
            expenses,
            totalSales,
            totalExpenses,
            netProfit
        });
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
                {/* Header - Mobile Optimized */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center sticky top-0 bg-zinc-950/80 backdrop-blur-sm z-10 py-3 gap-3">
                    <div className="flex-shrink-0">
                        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Balance</h2>
                        <p className="text-zinc-400 text-xs sm:text-sm italic hidden sm:block">Control de ventas y gastos diarios</p>
                    </div>
                    <div className="flex gap-1.5 sm:gap-2 w-full sm:w-auto justify-end">
                        <button
                            onClick={handleExportPDF}
                            className="bg-red-900/50 text-red-200 px-2.5 sm:px-4 py-2 rounded-xl flex items-center gap-1 sm:gap-2 hover:bg-red-900/80 border border-red-900/50 transition-all font-bold text-xs sm:text-sm"
                        >
                            <Download size={16} className="sm:w-[18px] sm:h-[18px]" />
                            <span className="hidden sm:inline">PDF</span>
                        </button>
                        <button
                            onClick={handleExportExcel}
                            className="bg-emerald-900/50 text-emerald-200 px-2.5 sm:px-4 py-2 rounded-xl flex items-center gap-1 sm:gap-2 hover:bg-emerald-900/80 border border-emerald-900/50 transition-all font-bold text-xs sm:text-sm"
                        >
                            <Download size={16} className="sm:w-[18px] sm:h-[18px]" />
                            <span className="hidden sm:inline">Excel</span>
                        </button>
                        <button
                            onClick={handlePrint}
                            className="bg-zinc-900 text-zinc-300 px-2.5 sm:px-4 py-2 rounded-xl flex items-center gap-1 sm:gap-2 hover:bg-zinc-800 border border-zinc-800 transition-all font-bold text-xs sm:text-sm"
                        >
                            <History size={16} className="sm:w-[18px] sm:h-[18px]" />
                            <span className="hidden sm:inline">Imprimir</span>
                        </button>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="p-2 sm:p-3 bg-zinc-900 text-zinc-400 rounded-xl hover:bg-zinc-800 border border-zinc-800 transition-all"
                        >
                            <Settings size={18} className="sm:w-[20px] sm:h-[20px]" />
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
                        <div className="mt-6 flex flex-col gap-4">
                            {/* Filter Logic */}
                            <div className="flex bg-zinc-100 p-1 rounded-xl">
                                {(['daily', 'weekly', 'biweekly', 'monthly'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(type)}
                                        className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${filterType === type ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900'}`}
                                    >
                                        {type === 'daily' ? 'Día' : type === 'weekly' ? 'Semana' : type === 'biweekly' ? 'Quincena' : 'Mes'}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                                        Fecha de Referencia
                                    </span>
                                    <span className="text-[10px] font-bold text-zinc-900 bg-zinc-100 px-2 py-1 rounded-md flex items-center gap-1">
                                        {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                                        <span className="text-[8px] text-zinc-400 font-mono ml-1" title="Zona Horaria Local">
                                            ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                                        </span>
                                    </span>
                                </div>
                                <div className="relative group flex gap-2">
                                    <div className="relative flex-1">
                                        <CalendarIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-hover:text-black transition-colors pointer-events-none" />
                                        <input
                                            type="date"
                                            value={customDate}
                                            onChange={(e) => setCustomDate(e.target.value)}
                                            className="w-full bg-zinc-50 text-zinc-900 text-sm font-black uppercase pl-10 pr-4 py-3 rounded-xl border border-zinc-100 focus:ring-4 focus:ring-zinc-200 transition-all cursor-pointer shadow-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="bg-zinc-900 text-white p-3 rounded-xl hover:bg-zinc-700 transition-colors shadow-sm"
                                        title="Recargar Balance"
                                    >
                                        <RefreshCw size={20} />
                                    </button>
                                </div>
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

                {/* NEW: Advanced Analytics Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Top Products by Revenue */}
                    <div className="bg-gradient-to-br from-emerald-900/20 to-zinc-900 border border-emerald-800/30 p-6 rounded-3xl">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-lg">🏆</span>
                            <h3 className="font-bold text-white uppercase text-xs tracking-widest">Top por Ingresos</h3>
                        </div>
                        <div className="space-y-3">
                            {topProductsByRevenue.length === 0 ? (
                                <p className="text-zinc-600 text-sm italic">Sin ventas hoy</p>
                            ) : (
                                topProductsByRevenue.map((product, idx) => (
                                    <div key={product.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-black ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-zinc-400' : idx === 2 ? 'text-amber-600' : 'text-zinc-600'}`}>
                                                #{idx + 1}
                                            </span>
                                            <span className="text-zinc-300 text-sm font-medium truncate max-w-[120px]">{product.name}</span>
                                        </div>
                                        <span className="text-emerald-400 text-xs font-black">L {product.revenue.toLocaleString()}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Seller Performance */}
                    <div className="bg-gradient-to-br from-blue-900/20 to-zinc-900 border border-blue-800/30 p-6 rounded-3xl">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-lg">👤</span>
                            <h3 className="font-bold text-white uppercase text-xs tracking-widest">Rendimiento Vendedor</h3>
                        </div>
                        <div className="space-y-3">
                            {sellerRanking.length === 0 ? (
                                <p className="text-zinc-600 text-sm italic">Sin ventas hoy</p>
                            ) : (
                                sellerRanking.map((seller) => (
                                    <div key={seller.name} className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-white text-sm font-bold">{seller.name}</span>
                                            <span className="text-blue-400 text-xs font-black">L {seller.sales.toLocaleString()}</span>
                                        </div>
                                        <div className="flex gap-4 text-[10px] text-zinc-500 uppercase">
                                            <span>{seller.transactions} ventas</span>
                                            <span>Ticket: L {seller.transactions > 0 ? (seller.sales / seller.transactions).toFixed(0) : 0}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {sales && sales.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-zinc-800">
                                <div className="flex justify-between text-xs">
                                    <span className="text-zinc-500 uppercase">Ticket Promedio</span>
                                    <span className="text-white font-black">L {avgTicket.toFixed(0)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Low Stock Alert */}
                    <div className={`bg-gradient-to-br ${lowStockProducts.length > 0 ? 'from-red-900/30 to-zinc-900 border-red-800/50' : 'from-zinc-900 to-zinc-900 border-zinc-800'} border p-6 rounded-3xl`}>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-lg">{lowStockProducts.length > 0 ? '⚠️' : '✅'}</span>
                            <h3 className="font-bold text-white uppercase text-xs tracking-widest">Stock Crítico</h3>
                            {lowStockProducts.length > 0 && (
                                <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                                    {lowStockProducts.length}
                                </span>
                            )}
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {lowStockProducts.length === 0 ? (
                                <p className="text-emerald-500 text-sm font-medium">¡Todo el inventario está bien!</p>
                            ) : (
                                lowStockProducts.slice(0, 5).map((product) => (
                                    <div key={product.id} className="flex items-center justify-between p-2 bg-red-950/30 rounded-lg border border-red-900/30">
                                        <span className="text-zinc-300 text-sm font-medium truncate max-w-[150px]">{product.name}</span>
                                        <span className={`text-xs font-black ${product.stock === 0 ? 'text-red-400' : 'text-orange-400'}`}>
                                            {product.stock || 0} pares
                                        </span>
                                    </div>
                                ))
                            )}
                            {lowStockProducts.length > 5 && (
                                <p className="text-zinc-500 text-xs text-center pt-2">+ {lowStockProducts.length - 5} productos más</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Dormant Products */}
                {dormantProducts.length > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">😴</span>
                                <h3 className="font-bold text-white uppercase text-xs tracking-widest">Productos Sin Ventas Hoy</h3>
                            </div>
                            <span className="text-zinc-500 text-xs">{dormantProducts.length} productos</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {dormantProducts.slice(0, 10).map((product) => (
                                <span key={product.id} className="text-xs bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg border border-zinc-700">
                                    {product.name}
                                </span>
                            ))}
                            {dormantProducts.length > 10 && (
                                <span className="text-xs bg-zinc-800 text-zinc-500 px-3 py-1.5 rounded-lg">
                                    +{dormantProducts.length - 10} más
                                </span>
                            )}
                        </div>
                    </div>
                )}

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
                                                <p className="text-[10px] text-zinc-500 font-medium flex items-center gap-2">
                                                    <span>{sale.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • <span className="italic">Por {sale.salespersonName}</span></span>
                                                    {sale.location && (
                                                        <a
                                                            href={`https://www.google.com/maps?q=${sale.location.lat},${sale.location.lng}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-indigo-500 hover:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full transition-colors"
                                                            title="Ver ubicación de venta"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <MapPin size={10} />
                                                            <span>Mapa</span>
                                                        </a>
                                                    )}
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

            {/* SECCIÓN DE SEGURIDAD Y USUARIOS */}
            <div className="max-w-7xl mx-auto px-6 pb-20">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden">
                    <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/80">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                                <Shield size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">Gestión de Accesos</h3>
                                <p className="text-zinc-400 text-xs font-medium">Controla quién puede vender y acceder al sistema</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowUserAuth(!showUserAuth)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                        >
                            {showUserAuth ? 'Ocultar' : 'Administrar'}
                        </button>
                    </div>

                    {showUserAuth && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-zinc-800">
                            {/* Lista de Usuarios */}
                            <div className="col-span-2 p-6">
                                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Activity size={16} />
                                    Usuarios Activos
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {users?.map(user => (
                                        <div key={user.id} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between group hover:border-zinc-700 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black ${user.id === currentUser?.id ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                                                    {user.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white flex items-center gap-2">
                                                        {user.name}
                                                        {user.id === currentUser?.id && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">TÚ</span>}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                                                        <span className={`w-2 h-2 rounded-full ${user.role === 'admin' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                                        <span className="uppercase">{user.role}</span>
                                                        <span className="text-zinc-700 mx-1">•</span>
                                                        <span>{user.lastActive ? new Date(user.lastActive).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {user.id !== currentUser?.id && (
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id!)}
                                                        className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                                        title="Eliminar Usuario"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Agregar Usuario */}
                            <div className="p-6 bg-zinc-900/30">
                                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <UserPlus size={16} />
                                    Nuevo Usuario
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 mb-1">Nombre</label>
                                        <input
                                            type="text"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-indigo-500 transition-all"
                                            placeholder="Ej. Juan Pérez"
                                            value={newUser.name}
                                            onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 mb-1">PIN de Acceso (4 dígitos)</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                maxLength={4}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-indigo-500 transition-all tracking-widest"
                                                placeholder="0000"
                                                value={newUser.pin}
                                                onChange={e => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '') })}
                                            />
                                            <Lock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 mb-1">Rol</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setNewUser({ ...newUser, role: 'sales' })}
                                                className={`py-2 rounded-xl text-xs font-bold transition-all border ${newUser.role === 'sales' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                                            >
                                                Vendedor
                                            </button>
                                            <button
                                                onClick={() => setNewUser({ ...newUser, role: 'admin' })}
                                                className={`py-2 rounded-xl text-xs font-bold transition-all border ${newUser.role === 'admin' ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                                            >
                                                Admin
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleAddUser}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 mt-4"
                                    >
                                        Crear Usuario
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
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

                {/* Transaction History & Debug */}
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <History size={18} className="text-zinc-500" />
                                Historial de Ventas ({startDate.toLocaleDateString()} - {endDate.toLocaleDateString()})
                            </h3>
                            <span className="text-xs font-mono text-zinc-500 bg-zinc-950 px-2 py-1 rounded">
                                {sales?.length || 0} registros
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-zinc-400">
                                <thead className="text-xs uppercase bg-zinc-950/50 text-zinc-500">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-xl">ID</th>
                                        <th className="px-4 py-3">Hora</th>
                                        <th className="px-4 py-3">Monto</th>
                                        <th className="px-4 py-3 rounded-r-xl">Método</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {sales?.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-zinc-600 italic">
                                                No hay ventas en este rango.
                                            </td>
                                        </tr>
                                    ) : (
                                        sales?.map(sale => (
                                            <tr key={sale.id} className="hover:bg-zinc-800/30 transition-colors">
                                                <td className="px-4 py-3 font-mono text-xs text-zinc-500">#{sale.id}</td>
                                                <td className="px-4 py-3 text-white font-medium">
                                                    {sale.timestamp instanceof Date
                                                        ? formatTime(sale.timestamp)
                                                        : <span className="text-red-500 text-[10px] font-bold">ERROR FECHA</span>}
                                                </td>
                                                <td className="px-4 py-3 text-emerald-400 font-bold">L {sale.total.toFixed(2)}</td>
                                                <td className="px-4 py-3 capitalize text-xs">{sale.paymentMethod}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Activity size={18} className="text-red-500" />
                                Historial de Gastos
                            </h3>
                            <span className="text-xs font-mono text-zinc-500 bg-zinc-950 px-2 py-1 rounded">
                                {expenses?.length || 0} registros
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-zinc-400">
                                <thead className="text-xs uppercase bg-zinc-950/50 text-zinc-500">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-xl">ID</th>
                                        <th className="px-4 py-3">Hora</th>
                                        <th className="px-4 py-3">Monto</th>
                                        <th className="px-4 py-3 rounded-r-xl">Desc.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {expenses?.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-zinc-600 italic">
                                                No hay gastos en este rango.
                                            </td>
                                        </tr>
                                    ) : (
                                        expenses?.map(expense => (
                                            <tr key={expense.id} className="hover:bg-zinc-800/30 transition-colors">
                                                <td className="px-4 py-3 font-mono text-xs text-zinc-500">#{expense.id}</td>
                                                <td className="px-4 py-3 text-white font-medium">
                                                    {expense.timestamp instanceof Date
                                                        ? formatTime(expense.timestamp)
                                                        : 'Invalid Date'}
                                                </td>
                                                <td className="px-4 py-3 text-red-400 font-bold">L {expense.amount.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-xs truncate max-w-[100px]" title={expense.description}>{expense.description}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* CLOUD DIAGNOSTIC (ADMIN ONLY) */}
            <div className="max-w-7xl mx-auto px-6 pb-20">
                <div className="bg-blue-900/10 border border-blue-900/30 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                                <Cloud size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Sincronización Nube</h3>
                                <p className="text-blue-200 text-xs">Diagnóstico y Descarga de Datos</p>
                            </div>
                        </div>
                        <button
                            onClick={handleForceSync}
                            disabled={isSyncing}
                            className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${isSyncing ? 'bg-zinc-700 text-zinc-500' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'}`}
                        >
                            {isSyncing ? <RefreshCw className="animate-spin" size={18} /> : <Database size={18} />}
                            {isSyncing ? 'Sincronizando...' : 'Forzar Descarga'}
                        </button>
                    </div>
                    {syncLog && (
                        <div className={`p-3 rounded-xl text-xs font-mono font-bold break-all whitespace-pre-wrap ${syncLog.includes('Error') ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-green-500/20 text-green-300 border border-green-500/30'}`}>
                            {syncLog}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
