import type { Metadata } from 'next';
import { Bebas_Neue, DM_Mono, Syne } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});

const dmMono = DM_Mono({
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
});

const syne = Syne({
  weight: ['400', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '⚔ TOURNEY',
  description: 'Real-time tournament manager',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${dmMono.variable} ${syne.variable}`}>
      <body className="min-h-screen overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
