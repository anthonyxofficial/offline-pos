import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, LayoutGrid, TrendingUp, LogOut } from 'lucide-react';
import { usePOS } from '../context/POSContext';

export const Layout = ({ children }: { children: React.ReactNode }) => {
    const { currentUser, setCurrentUser } = usePOS();
    const location = useLocation();

    return (
        <div className="flex flex-col md:flex-row h-[100dvh] bg-zinc-950 text-zinc-100 overflow-hidden font-sans selection:bg-zinc-800 selection:text-white">
            {/* Nav: Sidebar (Desktop) / Bottom Bar (Mobile) */}
            <nav className="fixed bottom-0 left-0 right-0 h-16 md:relative md:h-full md:w-24 bg-zinc-900 border-t md:border-t-0 md:border-r border-zinc-800 flex md:flex-col items-center justify-around md:justify-start md:py-6 z-50">
                {/* Logo - Hidden on Mobile Bottom Bar */}
                <div className="hidden md:flex w-12 h-12 bg-white rounded-xl items-center justify-center mb-8 shadow-lg shadow-white/10 shrink-0">
                    <span className="font-black text-xl text-black tracking-tighter">POS</span>
                </div>

                <div className="flex md:flex-col gap-1 md:gap-4 w-full md:px-2 h-full md:h-auto items-center justify-around md:justify-start">
                    <NavLink to="/" icon={<LayoutGrid size={24} />} active={location.pathname === '/'} label="Ventas" />
                    <NavLink to="/products" icon={<Package size={24} />} active={location.pathname === '/products'} label="Inventario" />
                    <NavLink to="/balance" icon={<TrendingUp size={24} />} active={location.pathname === '/balance'} label="Balance" />

                    {/* Mobile Only: Logout/User */}
                    <button
                        onClick={() => setCurrentUser(null)}
                        className="md:hidden flex flex-col items-center justify-center gap-1 p-2 text-zinc-500 hover:text-red-400 transition-all font-bold"
                    >
                        <LogOut size={22} />
                        <span className="text-[10px] uppercase tracking-tighter">Salir</span>
                    </button>
                </div>

                {/* Profile/Logout - Desktop Only */}
                <div className="hidden md:flex mt-auto flex-col items-center gap-4">
                    {currentUser && (
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border border-zinc-700">
                            {currentUser.name.substring(0, 2).toUpperCase()}
                        </div>
                    )}
                    <button
                        onClick={() => setCurrentUser(null)}
                        className="p-3 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-xl transition-all"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </nav>

            <main className="flex-1 overflow-hidden relative pb-16 md:pb-0">
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 to-zinc-900 z-0 opacity-50" />
                <div className="relative z-10 w-full h-full p-4 md:p-6 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

const NavLink = ({ icon, active, to, label }: { icon: React.ReactNode, active?: boolean, to?: string, label: string }) => (
    <Link to={to || "#"} className={`
        p-2 md:p-4 rounded-xl md:rounded-2xl transition-all duration-300 flex flex-col md:flex-row justify-center items-center relative group gap-1
        ${active
            ? 'bg-white text-black shadow-xl'
            : 'text-zinc-500 hover:text-white md:hover:bg-zinc-800'}
    `}>
        {icon}
        <span className={`text-[10px] md:hidden uppercase font-black tracking-tighter ${active ? 'text-black' : 'text-zinc-500'}`}>{label}</span>
        {active && <div className="hidden md:block absolute -right-[13px] top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-l-full" />}
    </Link>
);
