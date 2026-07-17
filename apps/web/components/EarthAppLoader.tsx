'use client';

import dynamic from 'next/dynamic';

/** WebGL can only mount client-side: the whole app is behind ssr:false. */
const EarthApp = dynamic(() => import('./EarthApp').then((m) => m.EarthApp), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center">
      <p className="animate-pulse font-[family-name:var(--font-display)] text-[16px] tracking-[var(--tracking-display)] text-[var(--text-muted)]">
        Loading EarthOS
      </p>
    </div>
  ),
});

export function EarthAppLoader() {
  return <EarthApp />;
}
