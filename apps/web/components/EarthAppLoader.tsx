'use client';

import dynamic from 'next/dynamic';

/** WebGL can only mount client-side: the whole app is behind ssr:false. */
const EarthApp = dynamic(() => import('./EarthApp').then((m) => m.EarthApp), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
      <p className="animate-pulse text-sm tracking-widest text-slate-500">LOADING EARTHOS</p>
    </div>
  ),
});

export function EarthAppLoader() {
  return <EarthApp />;
}
