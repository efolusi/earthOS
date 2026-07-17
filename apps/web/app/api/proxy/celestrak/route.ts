import { NextResponse, type NextRequest } from 'next/server';

/**
 * Optional CelesTrak proxy: point the satellites plugin's `endpoint`
 * setting at /api/proxy/celestrak to route catalog fetches through the
 * server (shared caching across visitors, no client rate pressure).
 * CelesTrak itself sends permissive CORS headers, so direct fetch also
 * works; this exists as the pattern for keyed providers.
 */
const ALLOWED_GROUPS = new Set([
  'starlink',
  'active',
  'stations',
  'gps-ops',
  'oneweb',
  'geo',
  'weather',
  'science',
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const group = request.nextUrl.searchParams.get('GROUP') ?? 'starlink';
  if (!ALLOWED_GROUPS.has(group)) {
    return NextResponse.json({ error: 'unknown group' }, { status: 400 });
  }
  const upstream = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`;
  const res = await fetch(upstream, {
    // Shared server-side cache: one CelesTrak hit per group per hour.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
  }
  const data = await res.json();
  return NextResponse.json(data, {
    headers: { 'cache-control': 'public, max-age=1800' },
  });
}
