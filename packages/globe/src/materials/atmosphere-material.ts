import { AdditiveBlending, Color, FrontSide, ShaderMaterial, Vector3 } from 'three';

/**
 * Analytic atmosphere: an additive fresnel rim on a slightly larger shell,
 * tinted blue on the day side and warm at the terminator. A precomputed
 * scattering LUT (Bruneton) is the documented upgrade path, not a launch
 * requirement.
 */

const VERT = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uDayColor;
uniform vec3 uSunsetColor;
uniform float uIntensity;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float rim = pow(1.0 - abs(dot(viewDir, n)), 3.0);
  float sun = dot(n, uSunDir);
  // Blue on the lit limb, warm near the terminator, fading into night.
  vec3 tint = mix(uSunsetColor, uDayColor, smoothstep(-0.05, 0.35, sun));
  float dayFade = 0.06 + 0.94 * smoothstep(-0.35, 0.15, sun);
  gl_FragColor = vec4(tint * rim * dayFade * uIntensity, 1.0);
  #include <colorspace_fragment>
}
`;

export function createAtmosphereMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uSunDir: { value: new Vector3(1, 0, 0) },
      uDayColor: { value: new Color('#4a90d9') },
      uSunsetColor: { value: new Color('#e08a4a') },
      uIntensity: { value: 1.15 },
    },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
  });
}

export function setAtmosphereSunDir(
  material: ShaderMaterial,
  dir: readonly [number, number, number],
): void {
  (material.uniforms.uSunDir!.value as Vector3).set(dir[0], dir[1], dir[2]);
}
