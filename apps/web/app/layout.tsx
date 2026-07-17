import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'EarthOS',
  description:
    'A real-time interactive 3D digital twin of Earth: satellites, earthquakes, day/night, and your own data as plugins.',
};

export const viewport: Viewport = {
  themeColor: '#020617',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
