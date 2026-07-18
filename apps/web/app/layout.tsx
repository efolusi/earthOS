import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

const SITE = 'https://earthos.efolusi.com';
const TITLE = 'EarthOS — real-time 3D digital twin of Earth';
const DESCRIPTION =
  'Open-source interactive globe with live satellites (SGP4), aircraft, earthquakes, hurricanes, solar eclipses, day/night, and streamed satellite imagery. Scrub time, follow the ISS, embed it, or build your own layers with the earthos React SDK.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: '%s · EarthOS' },
  description: DESCRIPTION,
  keywords: [
    'earth 3d globe',
    'satellite tracker',
    'flight tracker',
    'ISS tracker',
    'starlink map',
    'digital twin earth',
    'open source globe',
    'react three fiber globe',
    'earthos',
  ],
  applicationName: 'EarthOS',
  authors: [{ name: 'Efolusi', url: 'https://efolusi.com' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE,
    siteName: 'EarthOS',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1600, height: 900, alt: 'EarthOS live globe' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
  robots: { index: true, follow: true },
  other: { 'github:repo': 'https://github.com/efolusi/earthOS' },
};

export const viewport: Viewport = {
  themeColor: '#191512',
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'EarthOS',
  applicationCategory: 'Map',
  operatingSystem: 'Web browser',
  url: SITE,
  image: `${SITE}/og.png`,
  description: DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  license: 'https://opensource.org/licenses/MIT',
  codeRepository: 'https://github.com/efolusi/earthOS',
  author: { '@type': 'Organization', name: 'Efolusi', url: 'https://efolusi.com' },
  featureList:
    'Live satellite tracking (SGP4), live aircraft (ADS-B), earthquakes, hurricanes, solar eclipse shadow, day/night terminator, streamed satellite imagery, time scrubbing, React SDK, plugin system',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="h-full overflow-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
