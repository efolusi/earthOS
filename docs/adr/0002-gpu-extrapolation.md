# ADR 0002: GPU extrapolation for moving objects

**Status:** accepted

## Decision

Workers deliver (position, velocity) batches every ~15 sim-seconds; the vertex shader computes `p + v·dt - 0.5·mu·p/|p|^3·dt^2` per frame. One `THREE.Points` draw per layer. Rejected: per-frame CPU propagation (100k x 10 us = 1 s), `InstancedMesh.instanceMatrix` updates (~15 ms CPU + 6.4 MB/frame upload), and GPGPU/data textures (warranted only when the GPU writes positions; ours are CPU-originated and sparse).

## Consequences

Main-thread per-frame cost is one uniform write regardless of object count. The gravity term keeps extrapolation error sub-pixel between refreshes; time scrubbing stays smooth because the GPU keeps extrapolating from the last batch while workers catch up. Picking must mirror the same formula on the CPU (`pickExtrapolated`) so hits match pixels. The float32 relative-seconds attribute rebases every 2 h of sim time.
