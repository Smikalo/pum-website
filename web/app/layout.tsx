// at the top of web/app/layout.tsx
import './globals.css';
export const metadata = {
    title: 'PUM',
    description: 'Project of United Minds',
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
        {/* You can keep simple inline styles for now, or import a global CSS file */}
        <body style={{ fontFamily: 'system-ui', padding: 24 }}>{children}</body>
        </html>
    );
}
