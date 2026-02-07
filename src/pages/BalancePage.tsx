
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Download, Upload, History, CreditCard, Banknote, QrCode, Settings, Calendar as CalendarIcon } from 'lucide-react';

export const BalancePage = () => {
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
    const [showSettings, setShowSettings] = useState(false);
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseKey, setSupabaseKey] = useState('');

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

    const totalSales = sales?.reduce((sum, sale) => sum + sale.total, 0) || 0;

    // Breakdown
    const cashTotal = sales?.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0) || 0;
    const cardTotal = sales?.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0) || 0;
    const qrTotal = sales?.filter(s => s.paymentMethod === 'qr').reduce((sum, s) => sum + s.total, 0) || 0;

    const handleExport = async () => {
        const products = await db.products.toArray();
        const salesData = await db.sales.toArray();
        const users = await db.users.toArray();
        const expenses = await db.expenses.toArray();

        const data = { products, sales: salesData, users, expenses, version: '1.0', timestamp: new Date().toISOString() };
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
                    // Fix timestamps (they come back as strings)
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
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex justify-between items-center sticky top-0 bg-zinc-950/80 backdrop-blur-sm z-10 py-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Balance</h2>
                    <p className="text-zinc-400 text-sm">Resumen de ventas y transacciones</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-3 rounded-xl transition-all ${showSettings ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}
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
                        <p className="text-[10px] text-zinc-500 mt-2">Introduce el número con código de área, sin espacios ni el signo +.</p>
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
                        <p className="text-[10px] text-zinc-500">Al conectar Supabase, tus ventas se guardarán automáticamente en la nube y se verán en todos tus dispositivos.</p>
                    </div>
                </div>
            )}

            {/* Simple Card for Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-white/5 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Resumen</span>
                            <button
                                onClick={setToday}
                                className="text-[10px] font-black uppercase px-2 py-1 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-900 hover:text-white transition-all"
                            >
                                Hoy
                            </button>
                        </div>
                        <div className="flex flex-col gap-2 mb-6">
                            <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Seleccionar Fecha</span>
                            <div className="relative group">
                                <CalendarIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-hover:text-black transition-colors pointer-events-none" />
                                <input
                                    type="date"
                                    value={customDate}
                                    onChange={(e) => setCustomDate(e.target.value)}
                                    onClick={(e) => (e.target as any).showPicker?.()}
                                    className="w-full bg-zinc-50 text-zinc-900 text-sm font-black uppercase pl-10 pr-4 py-3 rounded-xl border border-zinc-100 focus:ring-4 focus:ring-zinc-300 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                                />
                            </div>
                        </div>
                        <h3 className="text-4xl font-black text-black tracking-tight">L {totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl col-span-1 md:col-span-2 grid grid-cols-3 gap-4">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Banknote size={14} className="text-green-500" />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Efectivo</span>
                        </div>
                        <p className="text-xl font-black text-white leading-tight">L {cashTotal.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1">
                            <CreditCard size={14} className="text-blue-400" />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tarjeta</span>
                        </div>
                        <p className="text-xl font-black text-white leading-tight">L {cardTotal.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1">
                            <QrCode size={14} className="text-purple-400" />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">QR / Transf</span>
                        </div>
                        <p className="text-xl font-black text-white leading-tight">L {qrTotal.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Sales History List */}
            <div className="bg-zinc-900/50 rounded-3xl border border-zinc-800 p-2">
                <div className="p-4 flex items-center gap-2 border-b border-zinc-800">
                    <History size={18} className="text-zinc-500" />
                    <h3 className="font-bold text-zinc-400 text-xs uppercase tracking-widest">Historial de Ventas</h3>
                </div>
                <div className="max-h-[500px] overflow-y-auto space-y-2 p-2 scrollbar-thin scrollbar-thumb-zinc-800">
                    {sales?.length === 0 ? (
                        <div className="py-12 text-center text-zinc-600">
                            <p className="text-sm font-medium">No hay ventas registradas para este periodo</p>
                        </div>
                    ) : (
                        sales?.map(sale => (
                            <div key={sale.id} className="bg-zinc-900 border border-zinc-800/50 p-4 rounded-2xl flex justify-between items-center hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 border border-zinc-700">
                                        {sale.paymentMethod === 'cash' ? <Banknote size={20} className="text-green-500" /> :
                                            sale.paymentMethod === 'card' ? <CreditCard size={20} className="text-blue-400" /> :
                                                <QrCode size={20} className="text-purple-400" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-white text-sm">Sale #{sale.id}</p>
                                            <span className="text-[10px] font-bold uppercase py-0.5 px-2 bg-zinc-800 text-zinc-500 rounded-full border border-zinc-700">
                                                {sale.paymentMethod === 'cash' ? 'Efectivo' : sale.paymentMethod === 'card' ? 'Tarjeta' : 'QR'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-400 font-medium">
                                            {sale.timestamp.toLocaleDateString()} {sale.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • <span className="text-zinc-500 italic">Vendido por {sale.salespersonName || 'N/A'}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-black text-white tracking-tight">L {sale.total.toFixed(2)}</p>
                                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{sale.items.length} Artículos</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
