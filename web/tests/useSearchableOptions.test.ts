import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearchableOptions } from '@/hooks/useSearchableOptions';

describe('useSearchableOptions', () => {
    it('loads options and filters them', async () => {
        const mockData = [
            { id: '1', label: 'Alpha' },
            { id: '2', label: 'Beta' },
            { id: '3', label: 'Gamma' },
        ];
        const loadAll = jest.fn().mockResolvedValue(mockData);

        const { result } = renderHook(() => useSearchableOptions({ loadAll }));

        // Initial state
        expect(result.current.loading).toBe(true);
        expect(result.current.options).toEqual([]);

        // Wait for load
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.options).toEqual(mockData);
        expect(result.current.filtered).toEqual(mockData);

        // Filtering
        act(() => {
            result.current.setQuery('al');
        });

        expect(result.current.filtered).toHaveLength(1);
        expect(result.current.filtered[0].label).toBe('Alpha');

        // Load should be called once
        expect(loadAll).toHaveBeenCalledTimes(1);
    });

    it('handles load error', async () => {
        const loadAll = jest.fn().mockRejectedValue(new Error('Fail'));
        const { result } = renderHook(() => useSearchableOptions({ loadAll }));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBeTruthy();
        expect(result.current.options).toEqual([]);
    });
});