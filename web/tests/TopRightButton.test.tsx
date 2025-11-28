import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopRightButton from '../components/TopRightButton';

describe('TopRightButton', () => {
    it('renders as a link when href is provided', () => {
        render(
            <TopRightButton href="/projects/new" className="test-class">
                New Project
            </TopRightButton>
        );

        const link = screen.getByRole('link', { name: /new project/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/projects/new');
        expect(link).toHaveClass('test-class');
    });

    it('renders as a button when href is missing', () => {
        render(
            <TopRightButton className="btn-test" title="Click me">
                Edit Item
            </TopRightButton>
        );

        const button = screen.getByRole('button', { name: /edit item/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('btn-test');
        expect(button).toHaveAttribute('type', 'button');
        expect(button).toHaveAttribute('title', 'Click me');
    });

    it('calls onClick handler for buttons', () => {
        const handleClick = jest.fn();
        render(
            <TopRightButton onClick={handleClick}>
                Action
            </TopRightButton>
        );

        fireEvent.click(screen.getByRole('button', { name: /action/i }));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});