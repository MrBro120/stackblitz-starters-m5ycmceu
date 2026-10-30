import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

// When you connect your .com domain, change this address to it,
// for example: https://www.yourdomain.com
const siteUrl = 'https://www.houseconnect.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'House Connect',
  description:
    'Find a place you can trust. Discover verified properties on House Connect and request viewings directly.',
  openGraph: {
    title: 'House Connect',
    description:
      'Discover verified properties on House Connect and request viewings directly.',
    siteName: 'House Connect',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'House Connect',
    description:
      'Discover verified properties on House Connect and request viewings directly.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
