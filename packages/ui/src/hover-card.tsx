'use client';

import { useEffect, useRef, useState } from 'react';
import { useEarth, useEarthState } from '@earthos/core/react';

/**
 * Cursor-following label for the hovered entity (callsign, satellite name,
 * quake headline). Position updates mutate the element directly: no React
 * work per pointer move.
 */
export function HoverCard() {
  const engine = useEarth();
  const hovered = useEarthState((s) => s.selection.hovered);
  const [label, setLabel] = useState<string | null>(null);
  const chipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const chip = chipRef.current;
      if (chip) chip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    if (!hovered) {
      setLabel(null);
      return;
    }
    let live = true;
    void engine
      .getEntityInfo(hovered)
      .then((info) => {
        if (live) setLabel(info?.label ?? hovered.entityId);
      })
      .catch(() => {
        if (live) setLabel(hovered.entityId);
      });
    return () => {
      live = false;
    };
  }, [engine, hovered]);

  if (!hovered || !label) return null;
  return (
    <div
      ref={chipRef}
      role="status"
      className="pointer-events-none fixed top-0 left-0 z-40 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-card)_96%,transparent)] px-2 py-1 text-[12px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-md)]"
      data-testid="hover-card"
    >
      {label}
    </div>
  );
}
