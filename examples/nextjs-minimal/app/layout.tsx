import type { ReactNode } from 'react';

export const metadata = { title: 'EarthOS Next.js example' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#020617', height: '100vh' }}>{children}</body>
    </html>
  );
}
