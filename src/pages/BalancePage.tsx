import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { syncAllData, forcePushAllData, syncNow, supabase } from '../db/supabase';
import {
    Download,
    Trash2,
    Shield,
    UserPlus,
    Activity as ActivityIcon,
    Lock,
    RefreshCw,
    MapPin,
    Settings,
    Upload,
    QrCode,
    Banknote,
    CreditCard,
    History as HistoryIcon,
    Calendar as CalendarIcon,
    Cloud,
    Database,
    Plus,
    AlertTriangle
} from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { ReportService } from '../services/ReportService';
import { formatTime } from '../utils/dateUtils';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { PDFPreviewModal } from '../components/PDFPreviewModal';

export const BalancePage = () => {
    const { currentUser } = usePOS();
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
    const [showUserAuth, setShowUserAuth] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', pin: '', role: 'sales' as 'admin' | 'sales' });
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncLog, setSyncLog] = useState<string>('');
    const [localCount, setLocalCount] = useState<number>(0);
    const [debugMode, setDebugMode] = useState(false);
    const [debugSales, setDebugSales] = useState<any[]>([]);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    useEffect(() => {
        db.sales.count().then(setLocalCount);
        // Load settings
        db.table('settings').get('supabase_url').then(r => r && setSupabaseUrl(r.value));
        db.table('settings').get('supabase_key').then(r => r && setSupabaseKey(r.value));
    }, []);

    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseKey, setSupabaseKey] = useState('');

    const handleSaveSupabaseConfig = async () => {
        if (!supabaseUrl || !supabaseKey) {
            alert('Por favor ingresa ambos campos');
            return;
        }
        await db.table('settings').put({ key: 'supabase_url', value: supabaseUrl });
        await db.table('settings').put({ key: 'supabase_key', value: supabaseKey });
        alert('Configuración guardada. Recargando para aplicar...');
        window.location.reload();
    };

    // Debug fetcher
    useEffect(() => {
        if (debugMode) {
            db.sales.toArray().then(all => {
                // Show last 5 sales raw
                setDebugSales(all.reverse().slice(0, 5));
            });
        }
    }, [debugMode]);

    const handleForceSync = async () => {
        if (!confirm('¿Estás seguro de forzar la sincronización (Descarga)? Esto descargará datos de la nube.')) return;

        setIsSyncing(true);
        setSyncLog('⏳ Iniciando descarga forzada...');
        try {
            await syncAllData();
            const newCount = await db.sales.count();
            setLocalCount(newCount);
            setSyncLog('✅ Descarga Completada. Recargando...');
            setTimeout(() => window.location.reload(), 1000);
        } catch (error: any) {
            console.error('Sync Error:', error);
            setSyncLog(`❌ Error: ${error.message || 'Desconocido'}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleForcePush = async () => {
        if (!confirm('⚠️ ¿Estás seguro de forzar la SUBIDA? Esto enviará todos tus datos locales a la nube, sobrescribiendo lo que falte.')) return;

        setIsSyncing(true);
        setSyncLog('🚀 Iniciando subida masiva (Force Push)...');
        try {
            const result = await forcePushAllData();
            if (result.success) {
                setSyncLog(`✅ ÉXITO: ${result.message}`);
                // Refresh local count just in case
                const newCount = await db.sales.count();
                setLocalCount(newCount);
            } else {
                setSyncLog(`❌ ERROR: ${result.message}`);
            }
        } catch (error: any) {
            setSyncLog(`❌ Error Crítico: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleQuickSync = async () => {
        setIsSyncing(true);
        try {
            const result = await syncNow();
            if (result.success) {
                setSyncLog('✅ Sincronización Rápida Exitosa');
                const newCount = await db.sales.count();
                setLocalCount(newCount);
            } else {
                setSyncLog('❌ Error Sync: ' + result.error);
                alert('Error al sincronizar: ' + result.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
    };

    // Calculate start and end of selected day (local time)
    useEffect(() => {
        if (customDate) {
            const [year, month, day] = customDate.split('-').map(Number);
            const start = new Date(year, month - 1, day, 0, 0, 0, 0);
            const end = new Date(year, month - 1, day, 23, 59, 59, 999);
            setStartDate(start);
            setEndDate(end);
            setActiveFilter('day');
        }
    }, [customDate]);

    const [activeFilter, setActiveFilter] = useState<'day' | 'week' | 'fortnight' | 'month'>('day');

    const setToday = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        setCustomDate(`${year}-${month}-${day}`);
        setActiveFilter('day');
    };

    const setWeek = () => {
        const today = new Date();
        const day = today.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday

        const start = new Date(today.setDate(diff));
        start.setHours(0, 0, 0, 0);

        const end = new Date(today.setDate(diff + 6));
        end.setHours(23, 59, 59, 999);

        setCustomDate(''); // Disable custom date effect
        setStartDate(start);
        setEndDate(end);
        setActiveFilter('week');
    };

    const setFortnight = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = today.getDate();

        let start, end;

        if (day <= 15) {
            start = new Date(year, month, 1, 0, 0, 0, 0);
            end = new Date(year, month, 15, 23, 59, 59, 999);
        } else {
            start = new Date(year, month, 16, 0, 0, 0, 0);
            end = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last day of month
        }

        setCustomDate('');
        setStartDate(start);
        setEndDate(end);
        setActiveFilter('fortnight');
    };

    const setMonth = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        const start = new Date(year, month, 1, 0, 0, 0, 0);
        const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

        setCustomDate('');
        setStartDate(start);
        setEndDate(end);
        setActiveFilter('month');
    };

    const users = useLiveQuery(() => db.users.toArray());

    const sales = useLiveQuery(async () => {
        if (!startDate || !endDate) return [];
        const allSales = await db.sales.toArray();
        return allSales.filter(sale => {
            const saleDate = new Date(sale.timestamp);
            if (isNaN(saleDate.getTime())) return false;
            return saleDate >= startDate && saleDate <= endDate;
        }).sort((a, b) => b.id! - a.id!);
    }, [startDate, endDate]);

    const expenses = useLiveQuery(async () => {
        if (!startDate || !endDate) return [];
        const allExpenses = await db.expenses.toArray();
        return allExpenses.filter(expense => {
            const expenseDate = new Date(expense.timestamp);
            if (isNaN(expenseDate.getTime())) return false;
            return expenseDate >= startDate && expenseDate <= endDate;
        }).sort((a, b) => b.id! - a.id!);
    }, [startDate, endDate]);

    const totalSales = sales?.reduce((sum, sale) => sum + (sale.refunded ? 0 : sale.total), 0) || 0;
    const totalExpenses = expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;
    const netProfit = totalSales - totalExpenses;

    const handleAddUser = async () => {
        if (!newUser.name || !newUser.pin || newUser.pin.length !== 4) {
            alert('Por favor complete todos los campos correctamente. El PIN debe ser de 4 dígitos.');
            return;
        }
        await db.users.add({
            name: newUser.name,
            pin: newUser.pin,
            role: newUser.role,
            lastActive: new Date()
        });
        setNewUser({ name: '', pin: '', role: 'sales' });
        alert('Usuario creado exitosamente');
    };

    const handleDeleteUser = async (id: number) => {
        if (id === currentUser?.id) {
            alert('No puedes eliminar tu propio usuario mientras estás conectado.');
            return;
        }
        if (confirm('¿Estás seguro de eliminar este usuario?')) {
            await db.users.delete(id);
        }
    };

    const handleDownloadPDF = async () => {
        if (!sales || !expenses) return;

        try {
            const reportData = {
                startDate,
                endDate,
                sales,
                expenses,
                totalSales,
                totalExpenses,
                netProfit
            };
            const doc = await ReportService.generateBalancePDF(reportData);
            const pdfBlob = doc.output('blob');
            const url = URL.createObjectURL(pdfBlob);
            setPreviewPdfUrl(url);
            setIsPreviewOpen(true);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Error al generar PDF");
        }
    };

    const handleExportExcel = () => {
        if (!sales || !expenses) return;
        ReportService.generateBalanceExcel({
            startDate,
            endDate,
            sales,
            expenses,
            totalSales,
            totalExpenses,
            netProfit
        });
    };

    // Analytics: Dormant Products
    const dormantProducts = useLiveQuery(async () => {
        const allProducts = await db.products.toArray();
        const soldProductIds = new Set<number>();

        if (sales) {
            sales.forEach(sale => {
                sale.items.forEach(item => soldProductIds.add(item.id!));
            });
        }

        return allProducts.filter(p => !soldProductIds.has(p.id!));
    }, [sales]);

    // Analytics: Top Products
    const topProducts = useLiveQuery(async () => {
        const productMap = new Map<string, number>();
        if (sales) {
            sales.forEach(sale => {
                if (!sale.refunded) {
                    sale.items.forEach(item => {
                        const current = productMap.get(item.name) || 0;
                        productMap.set(item.name, current + item.quantity);
                    });
                }
            });
        }
        return Array.from(productMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    }, [sales]);

    if (currentUser?.role !== 'admin') {
        return (
            <div className="h-screen flex items-center justify-center text-white">
                <div className="text-center">
                    <Lock size={64} className="mx-auto text-zinc-600 mb-4" />
                    <h2 className="text-2xl font-bold">Acceso Restringido</h2>
                    <p className="text-zinc-400">Solo administradores pueden ver el balance.</p>
                </div>
            </div>
        )
    }

    if (!dormantProducts || !topProducts) return null;

    return (
        <div className="pb-20 pt-6"> {/* Added top padding for better mobile view */}
            {/* Header / Date Selector */}
            <div className="max-w-7xl mx-auto px-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <span className="text-zinc-500 font-bold text-xs uppercase tracking-wider mb-1 block">
                        Estados Financieros
                    </span>
                    <h1 className="text-3xl font-black text-white tracking-tighter">
                        BALANCE
                        <span className="ml-2 text-xs font-mono bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full border border-purple-500/30 align-middle">
                            v1.3.2
                        </span>
                    </h1>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4">
                    {/* Quick Filters */}
                    <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                        {(['day', 'week', 'fortnight', 'month'] as const).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => {
                                    if (filter === 'day') setToday();
                                    if (filter === 'week') setWeek();
                                    if (filter === 'fortnight') setFortnight();
                                    if (filter === 'month') setMonth();
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${activeFilter === filter
                                    ? 'bg-zinc-700 text-white shadow-lg'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                                    }`}
                            >
                                {filter === 'day' && 'Día'}
                                {filter === 'week' && 'Semana'}
                                {filter === 'fortnight' && 'Quincena'}
                                {filter === 'month' && 'Mes'}
                            </button>
                        ))}
                    </div>



                    <div className="flex items-center gap-2 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800">
                        {/* Status Indicator */}
                        <div className={`w-3 h-3 rounded-full ${supabase ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'} animate-pulse`} title={supabase ? "Conectado a Nube" : "Sin Conexión"} />

                        <button
                            onClick={handleQuickSync}
                            disabled={isSyncing}
                            className={`p-3 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all ${isSyncing ? 'animate-spin' : ''}`}
                            title="Sincronizar Ahora"
                        >
                            <RefreshCw size={20} />
                        </button>
                        <button
                            onClick={setToday}
                            className="p-3 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all"
                            title="Hoy"
                        >
                            <CalendarIcon size={20} />
                        </button>
                        <input
                            type="date"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="bg-transparent text-white font-bold text-lg outline-none px-2"
                        />
                    </div>

                    <button
                        onClick={() => {
                            setShowUserAuth(true); // Open section
                            // Scroll to section
                            document.getElementById('access-section')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                        title="Configuración"
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 backdrop-blur-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                        <Banknote size={80} className="text-emerald-500" />
                    </div>
                    <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Ingresos por Ventas</p>
                    <p className="text-4xl font-black text-white tracking-tight">L {totalSales.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</p>
                    <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-500/10 w-fit px-3 py-1.5 rounded-full">
                        <ActivityIcon size={14} />
                        <span>{sales?.length} transacciones</span>
                    </div>
                </div>


                <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 backdrop-blur-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                        <Download size={80} className="text-red-500 rotate-180" />
                    </div>
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Gastos Operativos</p>
                        <button
                            onClick={() => setIsExpenseModalOpen(true)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-2 rounded-lg transition-colors"
                            title="Agregar Gasto"
                        >
                            <Plus size={16} strokeWidth={3} />
                        </button>
                    </div>
                    <p className="text-4xl font-black text-white tracking-tight">L {totalExpenses.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</p>
                    <div className="mt-4 flex items-center gap-2 text-red-400 text-xs font-bold bg-red-500/10 w-fit px-3 py-1.5 rounded-full">
                        <span>{expenses?.length} registros</span>
                    </div>
                </div>

                <div className={`p-6 rounded-3xl border backdrop-blur-sm relative overflow-hidden transition-all ${netProfit >= 0 ? 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${netProfit >= 0 ? 'text-indigo-300' : 'text-red-300'}`}>Utilidad Neta</p>
                    <p className={`text-4xl font-black tracking-tight ${netProfit >= 0 ? 'text-white' : 'text-red-400'}`}>
                        L {netProfit.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                    </p>
                    <div className="flex gap-2 mt-4">
                        <button onClick={handleDownloadPDF} className="bg-white text-black px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors flex items-center gap-2">
                            <Download size={14} /> PDF
                        </button>
                        <button onClick={handleExportExcel} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-500 transition-colors flex items-center gap-2">
                            <Download size={14} /> Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Sales by Salesperson Grid */}
            <div className="max-w-7xl mx-auto px-6 mb-10">
                <h3 className="font-bold text-zinc-400 uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
                    <UserPlus size={16} className="text-indigo-400" /> Rendimiento por Vendedor
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from(
                        (sales || []).reduce((acc, sale) => {
                            if (sale.refunded) return acc; // Ignore refunded sales for performance metrics
                            const id = sale.salespersonId;
                            if (!acc.has(id)) {
                                acc.set(id, { name: sale.salespersonName || 'Desconocido', total: 0, count: 0 });
                            }
                            const stats = acc.get(id)!;
                            stats.total += sale.total;
                            stats.count += 1;
                            return acc;
                        }, new Map<number, { name: string; total: number; count: number }>())
                            .values()
                    )
                        .sort((a, b) => b.total - a.total)
                        .map((seller, i) => (
                            <div key={i} className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-800 flex items-center justify-between group hover:border-zinc-600 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-black overflow-hidden border border-indigo-500/20">
                                        {seller.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-sm">{seller.name}</p>
                                        <p className="text-xs text-zinc-500 font-medium">{seller.count} {seller.count === 1 ? 'venta' : 'ventas'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-black text-emerald-400 border-b border-emerald-900/50 pb-0.5 mb-0.5">L {seller.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        ))}
                    {(sales || []).length === 0 && (
                        <div className="col-span-full bg-zinc-900/20 p-6 rounded-3xl border border-zinc-800 text-center text-zinc-600 italic text-sm">
                            No hay datos de ventas para mostrar en este período.
                        </div>
                    )}
                </div>
            </div>

            {/* Analytics & History Section */}
            <div className="max-w-7xl mx-auto px-6 space-y-6 mb-10">
                {/* Analytics Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-zinc-900/30 rounded-3xl p-6 border border-zinc-800">
                        <h3 className="font-bold text-zinc-400 uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
                            <ActivityIcon size={16} className="text-yellow-500" /> Top Productos
                        </h3>
                        <div className="space-y-3">
                            {topProducts.map(([name, qty], i) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                    <span className="text-zinc-300 font-medium">#{i + 1} {name}</span>
                                    <span className="font-bold text-white bg-zinc-800 px-2 py-1 rounded-lg">{qty} und.</span>
                                </div>
                            ))}
                            {topProducts.length === 0 && <p className="text-zinc-600 text-sm italic">Sin datos hoy</p>}
                        </div>
                    </div>

                    {/* Dormant Products Alert */}
                    {dormantProducts.length > 0 && (
                        <div className="bg-zinc-900/30 rounded-3xl p-6 border border-zinc-800">
                            <div className="flex justify-between items-center mb-4">
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
                </div>


                {/* Data History Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sales History */}
                    <div className="bg-zinc-900/50 rounded-3xl border border-zinc-800 flex flex-col h-[500px]">
                        <div className="p-5 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 rounded-t-3xl">
                            <div className="flex items-center gap-2">
                                <HistoryIcon size={18} className="text-zinc-500" />
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
                                    <div
                                        key={sale.id}
                                        className={`p-4 rounded-2xl flex justify-between items-center group transition-colors border ${sale.refunded
                                            ? 'bg-red-950/20 border-red-900/30 hover:bg-red-950/40 opacity-75'
                                            : 'bg-zinc-900 border-zinc-800/50 hover:bg-zinc-800'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${sale.refunded ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-zinc-950 border-zinc-800 group-hover:border-zinc-700'
                                                }`}>
                                                {sale.refunded ? <AlertTriangle size={20} /> :
                                                    sale.paymentMethod === 'cash' ? <Banknote size={20} className="text-green-500" /> :
                                                        sale.paymentMethod === 'card' ? <CreditCard size={20} className="text-blue-400" /> :
                                                            <QrCode size={20} className="text-purple-400" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className={`font-bold text-sm ${sale.refunded ? 'text-red-400 line-through decoration-red-900/50' : 'text-white'}`}>
                                                        Venta No. {sale.id}
                                                    </p>
                                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${sale.refunded ? 'text-red-500/50' : 'text-zinc-600'}`}>
                                                        {sale.refunded ? 'ANULADA' : sale.paymentMethod}
                                                    </span>
                                                </div>
                                                <p className={`text-[10px] font-medium flex items-center gap-2 ${sale.refunded ? 'text-red-900/60' : 'text-zinc-500'}`}>
                                                    <span>{sale.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • <span className="italic">Por {sale.salespersonName}</span></span>
                                                    {sale.location && !sale.refunded && (
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
                                            <p className={`text-base font-black ${sale.refunded ? 'text-red-500/50 line-through' : 'text-white'}`}>
                                                L {sale.total.toFixed(2)}
                                            </p>
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
            <div id="access-section" className="max-w-7xl mx-auto px-6 pb-20">
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
                            {/* Configuración de Supabase */}
                            <div className="p-6 bg-zinc-900/30 border-r border-zinc-800">
                                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Cloud size={16} className="text-indigo-400" />
                                    Conexión a Supabase <span className="text-[10px] text-zinc-600 ml-auto">v1.3.2</span>
                                </h4>
                                <div className="space-y-4 mb-6">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 mb-1">Project URL</label>
                                        <input
                                            type="text"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500 transition-all"
                                            placeholder="https://..."
                                            value={supabaseUrl}
                                            onChange={(e) => setSupabaseUrl(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 mb-1">API Key</label>
                                        <input
                                            type="password"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500 transition-all"
                                            placeholder="sbp_..."
                                            value={supabaseKey}
                                            onChange={(e) => setSupabaseKey(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSaveSupabaseConfig}
                                        className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded-xl text-xs font-bold transition-all border border-indigo-600/30"
                                    >
                                        Guardar Conexión
                                    </button>
                                </div>

                                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <RefreshCw size={16} className="text-emerald-400" />
                                    Sincronización Manual
                                </h4>
                                <div className="space-y-2">
                                    <button
                                        onClick={handleForcePush}
                                        disabled={isSyncing}
                                        className="w-full flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 hover:border-indigo-500 rounded-xl group transition-all"
                                    >
                                        <span className="text-xs font-bold text-zinc-400 group-hover:text-white">Forzar SUBIDA (Push)</span>
                                        <Upload size={16} className="text-zinc-600 group-hover:text-indigo-500" />
                                    </button>
                                    <button
                                        onClick={handleForceSync}
                                        disabled={isSyncing}
                                        className="w-full flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 hover:border-emerald-500 rounded-xl group transition-all"
                                    >
                                        <span className="text-xs font-bold text-zinc-400 group-hover:text-white">Forzar DESCARGA (Pull)</span>
                                        <Download size={16} className="text-zinc-600 group-hover:text-emerald-500" />
                                    </button>
                                </div>

                                {syncLog && (
                                    <div className="mt-4 p-3 bg-black/50 rounded-xl border border-zinc-800">
                                        <p className="text-[10px] font-mono text-zinc-400 break-words">{syncLog}</p>
                                    </div>
                                )}
                            </div>

                            {/* Lista de Usuarios */}
                            <div className="p-6">
                                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <ActivityIcon size={16} />
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
                                <HistoryIcon size={18} className="text-zinc-500" />
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
                                <ActivityIcon size={18} className="text-red-500" />
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
                                <p className="text-blue-200 text-xs">
                                    Diagnóstico y Descarga | <span className="text-white font-bold">BD Local: {localCount} ventas</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDebugMode(!debugMode)}
                                className={`px-3 py-2 rounded-xl font-bold text-xs border transition-all ${debugMode ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                            >
                                {debugMode ? 'Ocultar Debug' : 'Debug'}
                            </button>
                            <button
                                onClick={handleForceSync}
                                disabled={isSyncing}
                                className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${isSyncing ? 'bg-zinc-700 text-zinc-500' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'}`}
                            >
                                {isSyncing ? <RefreshCw className="animate-spin" size={18} /> : <Database size={18} />}
                                {isSyncing ? 'Sincronizando...' : 'Forzar Descarga'}
                            </button>
                            <button
                                onClick={handleForcePush}
                                disabled={isSyncing}
                                className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${isSyncing ? 'bg-zinc-700 text-zinc-500' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'}`}
                            >
                                <Upload size={18} />
                                Forzar Subida Nube
                            </button>
                        </div>
                    </div>
                    {syncLog && (
                        <div className={`p-3 rounded-xl text-xs font-mono font-bold break-all whitespace-pre-wrap ${syncLog.includes('Error') ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-green-500/20 text-green-300 border border-green-500/30'}`}>
                            {syncLog}
                        </div>
                    )}

                    {debugMode && (
                        <div className="mt-4 p-4 bg-black/50 rounded-xl border border-yellow-500/30 font-mono text-[10px] text-zinc-400 overflow-x-auto">
                            <h4 className="text-yellow-400 font-bold mb-2">🔍 INSPECTOR DE FECHAS (Últimas 5)</h4>
                            <p className="mb-2">Filtro Actual: {startDate.toISOString()} - {endDate.toISOString()}</p>
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-yellow-600 border-b border-yellow-900/30">
                                        <th className="p-1">ID</th>
                                        <th className="p-1">Timestamp (Raw)</th>
                                        <th className="p-1">Local String</th>
                                        <th className="p-1">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {debugSales.map(s => {
                                        const d = new Date(s.timestamp);
                                        return (
                                            <tr key={s.id} className="border-b border-zinc-800/50">
                                                <td className="p-1 text-white">#{s.id}</td>
                                                <td className="p-1 text-cyan-400">{s.timestamp}</td>
                                                <td className="p-1">{isNaN(d.getTime()) ? 'INVALID' : d.toLocaleString()}</td>
                                                <td className="p-1 text-green-400">L {s.total}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            {/* Modals */}
            {isExpenseModalOpen && (
                <AddExpenseModal isOpen={true} onClose={() => setIsExpenseModalOpen(false)} />
            )}

            <PDFPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                pdfUrl={previewPdfUrl}
                title="Vista Previa de Reporte"
                fileName={`Reporte_${startDate.toISOString().split('T')[0]}.pdf`}
            />
        </div>
    );
};
