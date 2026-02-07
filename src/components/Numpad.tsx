import { Delete } from 'lucide-react';

interface NumpadProps {
    onInput: (value: string) => void;
    onDelete: () => void;
}

export const Numpad = ({ onInput, onDelete }: NumpadProps) => {
    const keys = ['1', '2', '3', 'Qty', '4', '5', '6', 'Disc', '7', '8', '9', 'Price', '+/-', '0', '.'];

    return (
        <div className="grid grid-cols-4 gap-2 h-full bg-zinc-900/50 p-2 rounded-xl border border-zinc-800/50">
            {keys.map((key) => {
                const isAction = ['Qty', 'Disc', 'Price'].includes(key);
                return (
                    <button
                        key={key}
                        onClick={() => onInput(key)}
                        className={`
                            h-12 md:h-14 rounded-lg font-bold text-lg md:text-xl flex items-center justify-center transition-all active:scale-95 shadow-sm
                            ${isAction
                                ? 'bg-zinc-700 text-white hover:bg-zinc-600 border border-zinc-600'
                                : 'bg-zinc-800 text-white border border-zinc-700 hover:bg-zinc-700'}
                        `}
                    >
                        {key}
                    </button>
                );
            })}
            <button
                onClick={onDelete}
                className="h-12 md:h-14 rounded-lg bg-red-900/20 border border-red-900/30 text-red-400 flex items-center justify-center hover:bg-red-900/40 hover:text-red-200 active:scale-95 shadow-sm"
            >
                <Delete size={20} />
            </button>
        </div>
    );
};
