'use client';

import { useEffect, useState } from 'react';
import type { Texture } from 'three';
import { SRGBColorSpace, TextureLoader } from 'three';

export interface GlobeTextureUrls {
  day?: string;
  night?: string;
  specular?: string;
  clouds?: string;
}

const loader = typeof window !== 'undefined' ? new TextureLoader() : null;
const cache = new Map<string, Promise<Texture>>();

export function loadTexture(url: string, srgb = true): Promise<Texture> {
  if (!loader) return Promise.reject(new Error('textures load in the browser only'));
  let promise = cache.get(url);
  if (!promise) {
    promise = loader.loadAsync(url).then((tex) => {
      if (srgb) tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = 8;
      return tex;
    });
    cache.set(url, promise);
  }
  return promise;
}

/**
 * Non-suspending optional texture: null until loaded, stays null on failure
 * (the globe shader falls back to its procedural look).
 */
export function useOptionalTexture(url: string | undefined, srgb = true): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }
    let cancelled = false;
    loadTexture(url, srgb)
      .then((tex) => {
        if (!cancelled) setTexture(tex);
      })
      .catch(() => {
        if (!cancelled) setTexture(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, srgb]);
  return texture;
}
