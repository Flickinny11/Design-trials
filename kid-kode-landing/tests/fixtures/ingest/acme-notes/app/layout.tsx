import type { ReactNode } from 'react';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';

const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata = {
  title: 'Acme Notes',
  description: 'Capture, organize, and share your notes.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="site-header">
          <a href="/" className="brand">Acme Notes</a>
          <nav>
            <a href="/dashboard">Dashboard</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
