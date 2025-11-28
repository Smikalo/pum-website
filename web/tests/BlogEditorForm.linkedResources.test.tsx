import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BlogEditorForm from '../components/BlogEditorForm';

// Mock fetch
global.fetch = jest.fn();

// Mock Auth
jest.mock('../context/AuthProvider', () => ({
    useAuth: () => ({ user: { id: 'u1' }, accessToken: 'token' }),
}));

// Mock Next Router
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}));

// Mocks for react-markdown and remark-gfm are handled by Jest config/manual mocks now.

describe('BlogEditorForm Linked Resources', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
    });

    it('loads and allows selecting projects', async () => {
        (global.fetch as jest.Mock).mockImplementation((url) => {
            if (url.includes('/api/projects')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ items: [{ slug: 'p1', title: 'Project One' }] }),
                });
            }
            if (url.includes('/api/events')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ items: [] }),
                });
            }
            if (url.includes('/api/members')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ items: [] }),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        render(
            <BlogEditorForm mode="create" onSubmit={jest.fn()} />
        );

        // Wait for projects to load
        await waitFor(() => expect(screen.getByText('Project One')).toBeInTheDocument());

        // Check checkbox
        // The label text "Project One" is inside the label element which also contains the input.
        // getByRole('checkbox', { name: ... }) uses the accessible name, which comes from the label content.
        const checkbox = screen.getByRole('checkbox', { name: /Project One/i });

        fireEvent.click(checkbox);
        expect(checkbox).toBeChecked();
    });
});