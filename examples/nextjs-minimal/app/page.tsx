import { Globe } from './globe';

// This page is a Server Component; <Earth/> mounts its canvas client-side
// only, so the RSC boundary is just the one 'use client' file below.
export default function Page() {
  return <Globe />;
}
