import type { PluginContext, ProviderInstance } from '@earthos/core';
import { StaticProvider } from '@earthos/providers';

export interface Capital {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

/** Embedded dataset: a StaticProvider fetches once and caches forever. */
const CAPITALS: Capital[] = [
  { name: 'Abuja', country: 'Nigeria', lat: 9.0765, lon: 7.3986 },
  { name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lon: 106.8456 },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  { name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
  { name: 'Brasilia', country: 'Brazil', lat: -15.8267, lon: -47.9218 },
  { name: 'Canberra', country: 'Australia', lat: -35.2809, lon: 149.13 },
  { name: 'Nairobi', country: 'Kenya', lat: -1.2921, lon: 36.8219 },
  { name: 'Washington, D.C.', country: 'United States', lat: 38.9072, lon: -77.0369 },
  { name: 'New Delhi', country: 'India', lat: 28.6139, lon: 77.209 },
  { name: 'Reykjavik', country: 'Iceland', lat: 64.1283, lon: -21.8277 },
];

export class CapitalsProvider extends StaticProvider<Capital[]> {
  readonly id = 'capitals';

  async fetch(): Promise<Capital[]> {
    return CAPITALS;
  }
}

const createProvider = (_ctx: PluginContext): ProviderInstance<unknown> =>
  new CapitalsProvider() as ProviderInstance<unknown>;

export default createProvider;
