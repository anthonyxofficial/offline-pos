import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { usePOS } from '../context/POSContext';
import { Delete, Lock } from 'lucide-react';

export const LoginPage = () => {
    const { setCurrentUser } = usePOS();
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    const users = useLiveQuery(() => db.users.toArray());

    const handleNumClick = (num: number) => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
            setError(false);
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
        setError(false);
    };

    const handleLogin = async () => {
        if (!users) return;

        const user = users.find(u => u.pin === pin);
        if (user) {
            setCurrentUser(user);
        } else {
            setError(true);
            setPin('');
            // Shake effect logic could go here
        }
    };

    // Auto-login on 4 digits
    useEffect(() => {
        if (pin.length === 4) {
            handleLogin();
        }
    }, [pin, users]);

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-8 shadow-2xl border border-zinc-800">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-white/10">
                        <Lock size={32} className="text-black" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Sneaker POS</h1>
                    <p className="text-zinc-500 text-sm">Ingrese su PIN de acceso</p>
                </div>

                {/* PIN Display */}
                <div className="flex justify-center gap-4 mb-8">
                    {[0, 1, 2, 3].map(i => (
                        <div
                            key={i}
                            className={`w-4 h-4 rounded-full transition-all duration-300 ${i < pin.length
                                ? error ? 'bg-red-500' : 'bg-white scale-110'
                                : 'bg-zinc-800'
                                }`}
                        />
                    ))}
                </div>

                {error && (
                    <div className="text-red-400 text-center text-sm font-bold mb-6 animate-pulse">
                        PIN Incorrecto
                    </div>
                )}

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handleNumClick(num)}
                            className="h-20 bg-zinc-800 rounded-2xl text-2xl font-bold text-white hover:bg-zinc-700 active:bg-white active:text-black active:scale-95 transition-all shadow-lg shadow-black/20"
                        >
                            {num}
                        </button>
                    ))}
                    <div className="h-20" /> {/* Empty spacer */}
                    <button
                        onClick={() => handleNumClick(0)}
                        className="h-20 bg-zinc-800 rounded-2xl text-2xl font-bold text-white hover:bg-zinc-700 active:bg-white active:text-black active:scale-95 transition-all shadow-lg shadow-black/20"
                    >
                        0
                    </button>
                    <button
                        onClick={handleDelete}
                        className="h-20 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
                    >
                        <Delete size={24} />
                    </button>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-xs text-zinc-600">
                        PIN Anthony: <span className="text-zinc-400 font-mono">2234</span> | John: <span className="text-zinc-400 font-mono">1234</span>
                    </p>
                </div>
            </div>
        </div>
    );
};
