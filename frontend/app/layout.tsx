import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Transa — Move Smarter. Deliver Better.',
  description: 'Transa TMS — the modern Transportation Management System for freight brokers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
