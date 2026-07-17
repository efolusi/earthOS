'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, type Sprite, type SpriteMaterial } from 'three';
import { useEarth } from '@earthos/core/react';
import { trackersOf } from '../trackers';

function makeRingTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const c = size / 2;
  // Soft outer glow.
  ctx.strokeStyle = 'rgba(239, 207, 172, 0.25)'; // Meridian peach
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(c, c, 44, 0, Math.PI * 2);
  ctx.stroke();
  // Crisp ring.
  ctx.strokeStyle = 'rgba(239, 207, 172, 0.95)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(c, c, 44, 0, Math.PI * 2);
  ctx.stroke();
  // Four compass ticks.
  ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 50, c + Math.sin(a) * 50);
    ctx.lineTo(c + Math.cos(a) * 60, c + Math.sin(a) * 60);
    ctx.stroke();
  }
  return new CanvasTexture(canvas);
}

/** Screen-pixel-constant marker size. */
const MARKER_PX = 34;

/**
 * The on-globe selection indicator: a slowly rotating reticle pinned to the
 * selected entity's live position (via the layer tracker registry), scaled
 * for constant screen size. Layers without a tracker simply show no marker.
 * Mounted by EarthCanvas for every app automatically.
 */
export function SelectionMarker() {
  const engine = useEarth();
  const spriteRef = useRef<Sprite | null>(null);
  const texture = useMemo(() => makeRingTexture(), []);
  const scratch = useRef<[number, number, number]>([0, 0, 0]);

  useFrame(({ camera, size }, delta) => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    const picked = engine.store.getState().selection.picked;
    if (!picked) {
      sprite.visible = false;
      return;
    }
    const tracker = trackersOf(engine).get(picked.layerId);
    if (!tracker || !tracker(picked.entityId, engine.time.now(), scratch.current)) {
      sprite.visible = false;
      return;
    }
    const [x, y, z] = scratch.current;
    sprite.position.set(x, y, z);
    const dist = camera.position.distanceTo(sprite.position);
    // world size that spans MARKER_PX on screen at this distance (50 deg fov)
    const scale = (dist * 2 * Math.tan((25 * Math.PI) / 180) * MARKER_PX) / size.height;
    sprite.scale.set(scale, scale, 1);
    (sprite.material as SpriteMaterial).rotation += delta * 0.6;
    sprite.visible = true;
  });

  if (!texture) return null;
  return (
    <sprite ref={spriteRef} visible={false} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthWrite={false} opacity={0.95} />
    </sprite>
  );
}
