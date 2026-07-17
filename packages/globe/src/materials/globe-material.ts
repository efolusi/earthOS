import { ShaderMaterial, Vector3, type Texture } from 'three';

/**
 * One custom shader instead of a PBR material: a single sun, day/night blend
 * with a soft terminator band, emissive night lights, and ocean specular is
 * all the globe needs. Textures are optional: with none provided the shader
 * falls back to a stylized procedural globe (graticule on ocean blue), so
 * the repo renders offline before any NASA assets are fetched.
 */

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform sampler2D uDayMap;
uniform sampler2D uNightMap;
uniform sampler2D uSpecMap;
uniform float uHasDay;
uniform float uHasNight;
uniform float uHasSpec;
uniform float uNightBoost;
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

vec3 proceduralDay(vec2 uv) {
  vec3 ocean = vec3(0.024, 0.08, 0.18);
  vec3 shelf = vec3(0.05, 0.16, 0.28);
  float band = smoothstep(0.35, 0.5, abs(uv.y - 0.5));
  vec3 base = mix(ocean, shelf * 0.6, band);
  // 15-degree graticule
  vec2 g = abs(fract(uv * vec2(24.0, 12.0)) - 0.5);
  float line = 1.0 - smoothstep(0.0, 0.02, min(g.x, g.y));
  return mix(base, vec3(0.10, 0.30, 0.45), line * 0.35);
}

void main() {
  vec3 n = normalize(vWorldNormal);
  float ndots = dot(n, uSunDir);
  float dayF = smoothstep(-0.12, 0.12, ndots);

  vec3 dayCol = uHasDay > 0.5 ? texture2D(uDayMap, vUv).rgb : proceduralDay(vUv);
  dayCol *= max(ndots, 0.0) * 1.25 + 0.02;

  vec3 nightCol = uHasNight > 0.5
    ? texture2D(uNightMap, vUv).rgb * uNightBoost
    : vec3(0.012, 0.016, 0.030);
  nightCol *= (1.0 - dayF);

  float specMask = uHasSpec > 0.5 ? texture2D(uSpecMap, vUv).r : 0.35;
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float spec = pow(max(dot(reflect(-uSunDir, n), viewDir), 0.0), 48.0) * specMask;

  vec3 color = mix(nightCol, dayCol, dayF) + spec * dayF * vec3(0.9, 0.85, 0.7) * 0.55;
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

export interface GlobeMaterialTextures {
  day?: Texture | null;
  night?: Texture | null;
  specular?: Texture | null;
}

export function createGlobeMaterial(textures: GlobeMaterialTextures = {}): ShaderMaterial {
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uSunDir: { value: new Vector3(1, 0, 0) },
      uDayMap: { value: textures.day ?? null },
      uNightMap: { value: textures.night ?? null },
      uSpecMap: { value: textures.specular ?? null },
      uHasDay: { value: textures.day ? 1 : 0 },
      uHasNight: { value: textures.night ? 1 : 0 },
      uHasSpec: { value: textures.specular ? 1 : 0 },
      uNightBoost: { value: 1.7 },
    },
  });
  return material;
}

export function setGlobeTextures(material: ShaderMaterial, textures: GlobeMaterialTextures): void {
  const u = material.uniforms;
  if (textures.day !== undefined) {
    u.uDayMap!.value = textures.day;
    u.uHasDay!.value = textures.day ? 1 : 0;
  }
  if (textures.night !== undefined) {
    u.uNightMap!.value = textures.night;
    u.uHasNight!.value = textures.night ? 1 : 0;
  }
  if (textures.specular !== undefined) {
    u.uSpecMap!.value = textures.specular;
    u.uHasSpec!.value = textures.specular ? 1 : 0;
  }
}

export function setGlobeSunDir(
  material: ShaderMaterial,
  dir: readonly [number, number, number],
): void {
  (material.uniforms.uSunDir!.value as Vector3).set(dir[0], dir[1], dir[2]);
}
