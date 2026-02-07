import clsx from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

interface CategoryFilterProps {
    activeCategory: string | null;
    onSelect: (category: string | null) => void;
}

export const CategoryFilter = ({ activeCategory, onSelect }: CategoryFilterProps) => {
    // Get unique categories from products
    const categories = useLiveQuery(async () => {
        const products = await db.products.toArray();
        const unique = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
        return unique as string[];
    }) || [];

    if (categories.length === 0) return null;

    return (
        <div className="flex overflow-x-auto pb-4 gap-2 md:flex-wrap md:overflow-visible scrollbar-hide mb-2 snap-x">
            <button
                onClick={() => onSelect(null)}
                className={clsx(
                    "px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border snap-center",
                    activeCategory === null
                        ? "bg-white text-black border-white shadow-lg shadow-white/5 active:scale-95"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white hover:border-zinc-700"
                )}
            >
                Todos
            </button>
            {categories.map(category => (
                <button
                    key={category}
                    onClick={() => onSelect(category)}
                    className={clsx(
                        "px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border snap-center",
                        activeCategory === category
                            ? "bg-white text-black border-white shadow-lg shadow-white/5 active:scale-95"
                            : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white hover:border-zinc-700"
                    )}
                >
                    {category}
                </button>
            ))}
        </div>
    );
};
