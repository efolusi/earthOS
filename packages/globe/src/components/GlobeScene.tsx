'use client';

import { useMemo, useRef } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  MeshStandardMaterial,
  type DirectionalLight,
  type Group,
  type Mesh,
  type Sprite,
} from 'three';
import { useEarth } from '@earthos/core/react';
import {
  MOON_RADIUS_KM,
  equatorialToSceneDir,
  equatorialToScenePos,
  moonEquatorial,
  sunEquatorial,
} from '@earthos/gis';
import { ATMOSPHERE_RADIUS, CLOUD_RADIUS, GLOBE_RADIUS } from '../constants';
import { createGlobeMaterial, setGlobeSunDir, setGlobeTextures } from '../materials/globe-material';
import { createAtmosphereMaterial, setAtmosphereSunDir } from '../materials/atmosphere-material';
import { useOptionalTexture, type GlobeTextureUrls } from '../textures';
import { useEarthFixed } from './EarthFixedGroup';
import { Stars } from './Stars';

function makeGlowTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 252, 240, 1)');
  grad.addColorStop(0.25, 'rgba(255, 240, 200, 0.9)');
  grad.addColorStop(0.6, 'rgba(255, 220, 160, 0.25)');
  grad.addColorStop(1, 'rgba(255, 210, 140, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

export interface GlobeSceneProps {
  textures?: GlobeTextureUrls;
  stars?: boolean;
  moon?: boolean;
  sunSprite?: boolean;
}

/**
 * The physical globe: shader Earth (day/night/spec), optional cloud shell,
 * additive atmosphere rim, procedural stars, sun light + glow sprite, and
 * the Moon at its true position. All time-driven values PULL from the
 * engine's TimeEngine inside useFrame; nothing rerenders React per frame.
 */
export function GlobeScene({
  textures,
  stars = true,
  moon = true,
  sunSprite = true,
}: GlobeSceneProps) {
  const engine = useEarth();
  const earthFixed = useEarthFixed();

  const dayTex = useOptionalTexture(textures?.day);
  const nightTex = useOptionalTexture(textures?.night);
  const specTex = useOptionalTexture(textures?.specular, false);
  const cloudTex = useOptionalTexture(textures?.clouds, false);

  const globeMaterial = useMemo(() => createGlobeMaterial(), []);
  const atmosphereMaterial = useMemo(() => createAtmosphereMaterial(), []);
  const glowTexture = useMemo(() => makeGlowTexture(), []);

  // Push texture updates without recreating materials.
  useMemo(() => {
    setGlobeTextures(globeMaterial, { day: dayTex, night: nightTex, specular: specTex });
  }, [globeMaterial, dayTex, nightTex, specTex]);

  const cloudMaterial = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
      opacity: 0.85,
    });
    return mat;
  }, []);
  useMemo(() => {
    cloudMaterial.alphaMap = cloudTex;
    cloudMaterial.needsUpdate = true;
  }, [cloudMaterial, cloudTex]);

  const sunLightRef = useRef<DirectionalLight | null>(null);
  const sunSpriteRef = useRef<Sprite | null>(null);
  const moonRef = useRef<Mesh | null>(null);
  const cloudsRef = useRef<Mesh | null>(null);
  const sceneRootRef = useRef<Group | null>(null);
  const lastAstro = useRef(0);
  const sunDir = useRef<[number, number, number]>([1, 0, 0]);

  useFrame(() => {
    const now = engine.time.now();

    // Sun/moon geometry updates are cheap but there is no reason to run the
    // series every frame: refresh when sim time moved by > 10 s.
    if (Math.abs(now - lastAstro.current) > 10_000) {
      lastAstro.current = now;
      const sun = sunEquatorial(now);
      equatorialToSceneDir(sun, sunDir.current);
      if (moonRef.current) {
        const pos = equatorialToScenePos(moonEquatorial(now));
        moonRef.current.position.set(pos[0], pos[1], pos[2]);
      }
    }
    const dir = sunDir.current;
    setGlobeSunDir(globeMaterial, dir);
    setAtmosphereSunDir(atmosphereMaterial, dir);
    if (sunLightRef.current) {
      sunLightRef.current.position.set(dir[0] * 100_000, dir[1] * 100_000, dir[2] * 100_000);
    }
    if (sunSpriteRef.current) {
      sunSpriteRef.current.position.set(dir[0] * 320_000, dir[1] * 320_000, dir[2] * 320_000);
    }
    // Clouds drift slowly relative to the ground.
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = (now / 1000) * 1.2e-6;
    }
  });

  if (!earthFixed) {
    // GlobeScene must render inside <EarthFixedGroup> (EarthCanvas does this).
    return null;
  }

  return (
    <group ref={sceneRootRef}>
      <ambientLight intensity={0.03} />
      <directionalLight ref={sunLightRef} intensity={2.4} position={[100_000, 0, 0]} />

      {createPortal(
        <>
          <mesh material={globeMaterial}>
            <sphereGeometry args={[GLOBE_RADIUS, 128, 96]} />
          </mesh>
          {cloudTex ? (
            <mesh ref={cloudsRef} material={cloudMaterial} renderOrder={1}>
              <sphereGeometry args={[CLOUD_RADIUS, 96, 64]} />
            </mesh>
          ) : null}
        </>,
        earthFixed,
      )}

      <mesh material={atmosphereMaterial} renderOrder={2}>
        <sphereGeometry args={[ATMOSPHERE_RADIUS, 96, 64]} />
      </mesh>

      {stars ? <Stars /> : null}

      {moon ? (
        <mesh ref={moonRef} position={[384_400, 0, 0]}>
          <sphereGeometry args={[MOON_RADIUS_KM * 2.2, 32, 24]} />
          <meshStandardMaterial color="#b9b5ae" roughness={0.95} metalness={0} />
        </mesh>
      ) : null}

      {sunSprite && glowTexture ? (
        <sprite ref={sunSpriteRef} scale={[26_000, 26_000, 1]}>
          <spriteMaterial
            map={glowTexture}
            blending={AdditiveBlending}
            depthWrite={false}
            transparent
          />
        </sprite>
      ) : null}
    </group>
  );
}
