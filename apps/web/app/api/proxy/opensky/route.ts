import { NextResponse } from 'next/server';

/**
 * OpenSky proxy. Required in browsers: OpenSky's CORS policy only allows its
 * own origin, so clients cannot fetch it directly. Server-side we also share
 * one upstream snapshot across all visitors for a full minute, which keeps
 * anonymous credit usage minimal. Set OPENSKY_CLIENT_ID/SECRET to raise the
 * upstream rate limits (OAuth client-credentials flow).
 */

let tokenCache: { token: string; expiresAt: number } | null = null;

async function authHeader(): Promise<Record<string, string>> {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return {};
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return { authorization: `Bearer ${tokenCache.token}` };
  }
  const res = await fetch(
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: id,
        client_secret: secret,
      }),
    },
  );
  if (!res.ok) return {};
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return { authorization: `Bearer ${tokenCache.token}` };
}

export async function GET(): Promise<NextResponse> {
  const res = await fetch('https://opensky-network.org/api/states/all', {
    headers: await authHeader(),
    // One upstream snapshot per minute serves every visitor.
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
  }
  const data = await res.json();
  return NextResponse.json(data, {
    headers: { 'cache-control': 'public, max-age=30' },
  });
}
