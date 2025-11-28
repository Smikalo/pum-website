import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import PageCtaCard from '@/components/PageCtaCard'

describe('PageCtaCard', () => {
    it('renders title and description', () => {
        render(
            <PageCtaCard
                title="My Page Title"
                description="This is a description"
                kicker="Kicker Text"
            />
        )

        expect(screen.getByText('My Page Title')).toBeInTheDocument()
        expect(screen.getByText('This is a description')).toBeInTheDocument()
        expect(screen.getByText('Kicker Text')).toBeInTheDocument()
    })

    it('renders CTA button', () => {
        render(
            <PageCtaCard
                title="Page with CTA"
                cta={<button>Click Me</button>}
            />
        )

        const button = screen.getByRole('button', { name: /click me/i })
        expect(button).toBeInTheDocument()
    })

    it('applies className prop', () => {
        const { container } = render(
            <PageCtaCard
                title="Class Test"
                className="custom-class"
            />
        )

        const header = container.querySelector('header')
        expect(header).toHaveClass('custom-class')
        expect(header).toHaveClass('mb-6') // existing class
    })
})