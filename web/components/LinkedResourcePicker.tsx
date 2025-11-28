import React from "react";
import Image from "next/image";

export interface LinkedResourcePickerOption {
    id: string;
    label: string;
    description?: string;
    cover?: string | null;
}

interface LinkedResourcePickerProps {
    label: string;
    options: LinkedResourcePickerOption[];
    selectedIds: string[];
    onChangeSelected: (ids: string[]) => void;
    query: string;
    onQueryChange: (value: string) => void;
    loading?: boolean;
    error?: React.ReactNode;
    emptyStateText?: string;
    className?: string;
    searchPlaceholder?: string;
}

export default function LinkedResourcePicker({
                                                 label,
                                                 options,
                                                 selectedIds,
                                                 onChangeSelected,
                                                 query,
                                                 onQueryChange,
                                                 loading,
                                                 error,
                                                 emptyStateText,
                                                 className = "",
                                                 searchPlaceholder,
                                             }: LinkedResourcePickerProps) {

    const handleCheck = (id: string, checked: boolean) => {
        if (checked) {
            if (!selectedIds.includes(id)) {
                onChangeSelected([...selectedIds, id]);
            }
        } else {
            onChangeSelected(selectedIds.filter((sid) => sid !== id));
        }
    };

    return (
        <div className={`space-y-2 ${className}`}>
            <label className="block text-xs font-semibold uppercase tracking-widest text-white/60">
                {label}
            </label>

            <input
                type="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder={searchPlaceholder || "Search..."}
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                disabled={loading}
            />

            <div className="mt-2 rounded-md bg-black/20 border border-white/10 max-h-52 overflow-y-auto p-1 space-y-0.5">
                {loading && (
                    <p className="text-xs text-white/50 p-2">Loading...</p>
                )}
                {error && !loading && (
                    <div className="text-xs text-red-300 p-2">{error}</div>
                )}
                {!loading && !error && options.length === 0 && (
                    <p className="text-xs text-white/50 p-2">{emptyStateText || "No options found"}</p>
                )}

                {!loading && options.map(opt => {
                    const isSelected = selectedIds.includes(opt.id);
                    return (
                        <label key={opt.id} className="flex items-start gap-3 p-2 hover:bg-white/5 rounded cursor-pointer group select-none">
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleCheck(opt.id, e.target.checked)}
                                className="mt-1 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50 accent-cyan-500"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-white/90 group-hover:text-white flex items-center gap-2">
                                    {opt.cover && (
                                        <Image src={opt.cover} alt="" width={16} height={16} className="w-4 h-4 rounded object-cover bg-white/10" />
                                    )}
                                    {opt.label}
                                </div>
                                {opt.description && (
                                    <div className="text-[11px] text-white/50 truncate">{opt.description}</div>
                                )}
                            </div>
                        </label>
                    );
                })}
            </div>

            <div className="flex items-center justify-between text-[11px] text-white/40 px-1">
                <span>
                    {selectedIds.length} selected
                </span>
            </div>
        </div>
    );
}