import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LinkedResourcePicker from '../components/LinkedResourcePicker';

describe('LinkedResourcePicker', () => {
    const options = [
        { id: 'p1', label: 'Project Alpha' },
        { id: 'p2', label: 'Project Beta' }
    ];
    const mockChangeSelected = jest.fn();
    const mockQueryChange = jest.fn();

    it('renders search and options', () => {
        render(
            <LinkedResourcePicker
                label="Pick Projects"
                options={options}
                selectedIds={[]}
                onChangeSelected={mockChangeSelected}
                query=""
                onQueryChange={mockQueryChange}
            />
        );

        expect(screen.getByText('Pick Projects')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
        expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });

    it('calls onQueryChange when typing', () => {
        render(
            <LinkedResourcePicker
                label="Pick Projects"
                options={options}
                selectedIds={[]}
                onChangeSelected={mockChangeSelected}
                query=""
                onQueryChange={mockQueryChange}
            />
        );

        const input = screen.getByPlaceholderText('Search...');
        fireEvent.change(input, { target: { value: 'Al' } });
        expect(mockQueryChange).toHaveBeenCalledWith('Al');
    });

    it('calls onChangeSelected when checking', () => {
        render(
            <LinkedResourcePicker
                label="Pick Projects"
                options={options}
                selectedIds={[]}
                onChangeSelected={mockChangeSelected}
                query=""
                onQueryChange={mockQueryChange}
            />
        );

        const checkbox = screen.getAllByRole('checkbox')[0]; // Alpha
        fireEvent.click(checkbox);
        expect(mockChangeSelected).toHaveBeenCalledWith(['p1']);
    });

    it('shows checked state', () => {
        render(
            <LinkedResourcePicker
                label="Pick Projects"
                options={options}
                selectedIds={['p1']}
                onChangeSelected={mockChangeSelected}
                query=""
                onQueryChange={mockQueryChange}
            />
        );

        const checkbox = screen.getAllByRole('checkbox')[0];
        expect(checkbox).toBeChecked();
    });
});