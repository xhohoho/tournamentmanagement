import type { Metadata } from 'next';
import './globals.css';
import { TourneyProvider } from '@/lib/context';

export const metadata: Metadata = {
  title: '⚔ TOURNEY',
  description: 'Real-time tournament manager',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Syne:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen overflow-x-hidden">
        <TourneyProvider>
          {children}
        </TourneyProvider>
      </body>
    </html>
  );
}
