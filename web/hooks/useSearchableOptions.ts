import { useState, useEffect, useMemo } from "react";

export interface SearchableOption {
    id: string;
    label: string;
    description?: string;
    cover?: string | null;
    [key: string]: any;
}

interface UseSearchableOptionsParams<TOption extends SearchableOption> {
    loadAll: () => Promise<TOption[]>;
    initialOptions?: TOption[];
    initialQuery?: string;
}

export interface UseSearchableOptionsResult<TOption extends SearchableOption> {
    options: TOption[];
    filtered: TOption[];
    query: string;
    setQuery: (value: string) => void;
    loading: boolean;
    error: unknown | null;
    reload: () => Promise<void>;
}

export function useSearchableOptions<TOption extends SearchableOption>({
                                                                           loadAll,
                                                                           initialOptions,
                                                                           initialQuery = "",
                                                                       }: UseSearchableOptionsParams<TOption>): UseSearchableOptionsResult<TOption> {
    const [options, setOptions] = useState<TOption[]>(initialOptions || []);
    const [loading, setLoading] = useState<boolean>(!initialOptions);
    const [error, setError] = useState<unknown | null>(null);
    const [query, setQuery] = useState<string>(initialQuery);

    const fetchOptions = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await loadAll();
            setOptions(data);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!initialOptions) {
            void fetchOptions();
        }
        // We intentionally run this once on mount (or if initialOptions changes from undefined to defined, which shouldn't happen in typical usage)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((opt) => opt.label.toLowerCase().includes(q));
    }, [options, query]);

    return {
        options,
        filtered,
        query,
        setQuery,
        loading,
        error,
        reload: fetchOptions,
    };
}