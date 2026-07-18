import { exposeWorker, transferResult } from '@earthos/core';
import { minutesSinceEpoch, parseOmm, parseTle, propagateFast, type SatRec } from '@earthos/gis';
import { isTleRecord, type InitPayload, type InitResult, type PropagatePayload } from './types';

/**
 * One shard of the catalog lives in this worker forever (static sharding: no
 * task-distribution protocol). Propagation runs on request and returns a
 * transferable interleaved pos+vel buffer in SCENE coordinates, ready for
 * ExtrapolatedPointsLayer.writeBatch.
 */

let satrecs: Array<SatRec | null> = [];

exposeWorker({
  init(payload: InitPayload): InitResult {
    satrecs = payload.records.map((record) => {
      try {
        // CelesTrak GP JSON (CCSDS OMM) or raw TLE lines: both become satrecs.
        return isTleRecord(record)
          ? parseTle(record.TLE_LINE1, record.TLE_LINE2)
          : parseOmm(record as never);
      } catch {
        return null;
      }
    });
    return { parsed: satrecs.filter(Boolean).length, total: satrecs.length };
  },

  propagate(payload: PropagatePayload) {
    const n = satrecs.length;
    const buffer = new Float32Array(n * 6);
    const valid = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const rec = satrecs[i];
      if (!rec) continue;
      const state = propagateFast(rec, minutesSinceEpoch(rec, payload.epochMs));
      if (!state) continue;
      const [px, py, pz] = state.position;
      const [vx, vy, vz] = state.velocity;
      const base = i * 6;
      // TEME -> scene swizzle (x, z, -y), same for velocity.
      buffer[base] = px;
      buffer[base + 1] = pz;
      buffer[base + 2] = -py;
      buffer[base + 3] = vx;
      buffer[base + 4] = vz;
      buffer[base + 5] = -vy;
      valid[i] = 1;
    }
    return transferResult({ epochMs: payload.epochMs, buffer, valid }, [
      buffer.buffer,
      valid.buffer,
    ]);
  },
});
