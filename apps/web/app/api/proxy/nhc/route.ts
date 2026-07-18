import { NextResponse } from 'next/server';

/** NHC CurrentStorms proxy: shared 10-minute cache, CORS-free for clients. */
export async function GET(): Promise<NextResponse> {
  const res = await fetch('https://www.nhc.noaa.gov/CurrentStorms.json', {
    next: { revalidate: 600 },
  });
  if (!res.ok) return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
  return NextResponse.json(await res.json(), {
    headers: { 'cache-control': 'public, max-age=300' },
  });
}
