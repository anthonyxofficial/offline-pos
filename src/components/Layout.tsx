import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, LayoutGrid, TrendingUp, LogOut, Calendar } from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { db } from '../db/db';
import { formatTime, formatDate } from '../utils/dateUtils';

export const Layout = ({ children }: { children: React.ReactNode }) => {
    const { currentUser, isAdmin, logout } = usePOS();
    const location = useLocation();

    const [time, setTime] = React.useState(new Date());

    React.useEffect(() => {
        console.log("POS v1.3.8 (Final Stable) Loaded");
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Data Repair: Ensure dates are Dates, not strings (Fixes Balance Page)
    React.useEffect(() => {
        const repairDates = async () => {
            try {
                // Repair Sales
                const sales = await db.sales.toArray();
                let repairedSales = 0;
                for (const sale of sales) {
                    if (typeof sale.timestamp === 'string') {
                        await db.sales.update(sale.id!, { timestamp: new Date(sale.timestamp) });
                        repairedSales++;
                    }
                }

                // Repair Expenses
                const expenses = await db.expenses.toArray();
                let repairedExpenses = 0;
                for (const exp of expenses) {
                    if (typeof exp.timestamp === 'string') {
                        await db.expenses.update(exp.id!, { timestamp: new Date(exp.timestamp) });
                        repairedExpenses++;
                    }
                }

                if (repairedSales > 0 || repairedExpenses > 0) {
                    console.log(`[REPAIR] Repaired ${repairedSales} sales and ${repairedExpenses} expenses.`);
                }
            } catch (err) {
                console.error("Data repair failed:", err);
            }
        };

        repairDates();
    }, []);

    return (
        <div className="flex flex-col md:flex-row h-[100dvh] bg-zinc-950 text-zinc-100 overflow-hidden font-sans selection:bg-purple-500/30 selection:text-purple-200">
            {/* Nav: Sidebar (Desktop) / Bottom Bar (Mobile) - GLASSMORPHISM */}
            <nav className="fixed bottom-0 left-0 right-0 h-16 md:relative md:h-full md:w-24 bg-black/40 backdrop-blur-xl border-t md:border-t-0 md:border-r border-white/5 flex md:flex-col items-center justify-around md:justify-start md:py-6 z-50 transition-all duration-300">
                {/* Logo - Hidden on Mobile Bottom Bar */}
                <div className="hidden md:flex flex-col items-center justify-center mb-8 shrink-0 hover:scale-110 transition-transform duration-300">
                    <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                </div>

                {/* Clock - Desktop Only */}
                <div className="hidden md:flex flex-col items-center mb-8 text-center bg-white/5 px-2 py-3 rounded-2xl w-20 backdrop-blur-sm border border-white/5 shadow-inner">
                    <span className="text-xl font-black text-white tracking-tighter leading-none font-mono">
                        {formatTime(time)}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-bold uppercase mt-1">
                        {formatDate(time)}
                    </span>
                </div>

                {/* Version Indicator */}
                <div className="hidden md:block mb-4 px-2 opacity-30 hover:opacity-60 transition-opacity">
                    <p className="text-[9px] text-center font-mono text-zinc-500">v1.3.2 (Sync Fix)</p>
                </div>

                <div className="flex flex-row md:flex-col gap-2 md:gap-4 w-full md:px-2 h-full md:h-auto items-center justify-around md:justify-start">
                    <NavLink to="/" icon={<LayoutGrid size={24} />} active={location.pathname === '/'} label="Ventas" />

                    <NavLink to="/layaways" icon={<Calendar size={24} />} active={location.pathname === '/layaways'} label="Apartados" />

                    {isAdmin && (
                        <>
                            <NavLink to="/products" icon={<Package size={24} />} active={location.pathname === '/products'} label="Inventario" />
                            <NavLink to="/balance" icon={<TrendingUp size={24} />} active={location.pathname === '/balance'} label="Balance" />
                        </>
                    )}
                    {/* Mobile Only: Logout/User */}
                    <button
                        onClick={logout}
                        className="md:hidden flex flex-col items-center justify-center gap-1 p-2 text-zinc-500 hover:text-red-400 transition-all font-bold"
                    >
                        <LogOut size={22} />
                        <span className="text-[10px] uppercase tracking-tighter">Salir</span>
                    </button>
                </div>

                {/* Profile/Logout - Desktop Only */}
                <div className="hidden md:flex mt-auto flex-col items-center gap-4">
                    {currentUser && (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xs font-black text-white border-2 border-white/10 shadow-lg shadow-purple-500/20">
                            {currentUser.name.substring(0, 2).toUpperCase()}
                        </div>
                    )}
                    <button
                        onClick={logout}
                        className="p-3 text-zinc-500 hover:text-red-400 hover:bg-white/5 rounded-xl transition-all"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </nav>

            <main className="flex-1 overflow-hidden relative pb-16 md:pb-0">
                <div className="absolute top-2 right-2 z-50 pointer-events-none opacity-30 text-[10px] text-white font-mono mix-blend-overlay">v1.3.8 (Final Stable)</div>
                {/* Background Gradient */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-900/20 via-zinc-950 to-zinc-950 z-0 pointer-events-none" />

                <div className="relative z-10 w-full h-full p-4 md:p-8 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

const NavLink = ({ icon, active, to, label }: { icon: React.ReactNode, active?: boolean, to?: string, label: string }) => (
    <Link to={to || "#"} className={`
        p-2 md:p-3.5 rounded-xl md:rounded-2xl transition-all duration-300 flex flex-col md:flex-row justify-center items-center relative group gap-1
        ${active
            ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)] scale-105'
            : 'text-zinc-500 hover:text-purple-300 hover:bg-white/5'}
    `}>
        <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
            {icon}
        </div>
        <span className={`text-[9px] md:hidden uppercase font-black tracking-tighter ${active ? 'text-white' : 'text-zinc-500'}`}>{label}</span>

        {/* Active Indicator Line (Desktop) */}
        {active && <div className="hidden md:block absolute -right-[10px] top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-400 rounded-l-full shadow-[0_0_10px_rgba(168,85,247,0.8)]" />}
    </Link>
);
