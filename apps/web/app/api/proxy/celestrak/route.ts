import { NextResponse, type NextRequest } from 'next/server';

/**
 * CelesTrak proxy with stale-while-error: one upstream hit per group per
 * hour serves every visitor, and the last good catalog keeps serving for up
 * to a week when CelesTrak rate-limits or blocks (their GP endpoint
 * aggressively 403s IPs it considers noisy). TLEs stay propagatable for
 * days, so stale here is far better than empty.
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

const STALE_MAX_AGE_MS = 7 * 24 * 3_600_000;
const lastGood = new Map<string, { body: string; at: number }>();

export async function GET(request: NextRequest): Promise<NextResponse> {
  const group = request.nextUrl.searchParams.get('GROUP') ?? 'starlink';
  if (!ALLOWED_GROUPS.has(group)) {
    return NextResponse.json({ error: 'unknown group' }, { status: 400 });
  }
  const upstream = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`;

  let failure = 'unreachable';
  try {
    const res = await fetch(upstream, { next: { revalidate: 3600 } });
    if (res.ok) {
      const body = await res.text();
      lastGood.set(group, { body, at: Date.now() });
      return new NextResponse(body, {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=1800',
        },
      });
    }
    failure = `upstream ${res.status}`;
  } catch {
    // fall through to stale
  }

  const cached = lastGood.get(group);
  if (cached && Date.now() - cached.at < STALE_MAX_AGE_MS) {
    return new NextResponse(cached.body, {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=300',
        'x-earthos-stale': String(Math.round((Date.now() - cached.at) / 60000)),
      },
    });
  }
  return NextResponse.json({ error: failure }, { status: 502 });
}
