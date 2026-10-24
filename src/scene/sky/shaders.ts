// The night flight's sky (spec r4 §9): ESO's Milky Way panorama over a navy gradient with the moon's glow, the moon
// and the brightest stars as crisp points, and below it a photographed cloud sea and moonlit sprite clouds.

/** Night sky above the horizon (navy gradient, the moon's glow), dark sea below; shared by the backdrop, the clouds
 * and the environment map. The moon's disc and the stars are points, drawn crisp at full resolution by skyPoints. */
export const SKY_GLSL = /* glsl */ `
  uniform vec3 uMoon;
  const vec3 NIGHT_HORIZON = vec3(0.030, 0.045, 0.090);
  const vec3 NIGHT_ZENITH = vec3(0.004, 0.008, 0.024);
  const vec3 MOONLIGHT = vec3(0.80, 0.86, 1.00);
  float starHash(vec3 p){ p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
  vec3 skyCol(vec3 rd){
    float y = max(rd.y, 0.);
    vec3 c = mix(NIGHT_HORIZON, NIGHT_ZENITH, pow(y, 0.45));
    float m = max(dot(rd, uMoon), 0.);
    return c + MOONLIGHT * (pow(m, 600.) * 0.6 + pow(m, 24.) * 0.06);
  }
  vec3 belowCol(vec3 rd, float camY){
    float t = (-2600. - camY) / min(rd.y, -1e-4);
    vec3 mirrored = vec3(rd.x, -rd.y, rd.z);
    vec3 sea = vec3(0.004, 0.008, 0.016) + MOONLIGHT * pow(max(dot(mirrored, uMoon), 0.), 90.) * 0.6;
    return mix(sea, NIGHT_HORIZON, 1. - exp(-t * 0.00006));
  }
  vec3 bgCol(vec3 rd, float camY){ return rd.y > 0. ? skyCol(rd) : belowCol(rd, camY); }
`;

/**
 * The moon's disc and the stars for direction rd, `pixel` radians across one screen pixel: drawn at full resolution
 * so they stay points. Stars sit on a grid over the faces of a cube around the camera (about 0.01 rad a cell, one
 * in fifty cells lit), each a Gaussian under a pixel wide, searched in the 3×3 cells around rd so none is clipped.
 */
export const SKY_POINTS_GLSL = /* glsl */ `
  vec3 skyPoints(vec3 rd, float pixel, float time){
    if (rd.y <= 0.) return vec3(0.);
    float r = acos(clamp(dot(rd, uMoon), -1., 1.));
    vec3 col = MOONLIGHT * 5. * (1. - smoothstep(0.017 - pixel, 0.017 + pixel, r)) * (0.85 + 0.15 * smoothstep(0.017, 0., r));
    vec3 a = abs(rd);
    vec2 uv; float face; float amax;
    if (a.x >= a.y && a.x >= a.z) { uv = rd.yz / a.x; face = rd.x > 0. ? 0. : 1.; amax = a.x; }
    else if (a.y >= a.z) { uv = rd.xz / a.y; face = rd.y > 0. ? 2. : 3.; amax = a.y; }
    else { uv = rd.xy / a.z; face = rd.z > 0. ? 4. : 5.; amax = a.z; }
    const float K = 100.;
    vec2 g = uv * K;
    vec2 base = floor(g);
    float toAngle = amax * amax / K;
    float sigma = max(pixel * 0.8, 1e-5);
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
      vec2 cell = base + vec2(float(i), float(j));
      vec3 key = vec3(cell, face);
      float h = starHash(key);
      if (h < 0.98) continue;
      vec2 at = cell + 0.5 + 0.8 * (vec2(starHash(key + 1.3), starHash(key + 2.7)) - 0.5);
      float d = length(g - at) * toAngle;
      float rank = (h - 0.98) / 0.02;
      float glow = 0.35 + 3.2 * rank * rank * rank;
      float twinkle = 0.8 + 0.2 * sin(time * (1.3 + 2.4 * starHash(key + 7.7)) + 6.2832 * starHash(key + 9.1));
      vec3 tint = mix(vec3(0.78, 0.85, 1.0), vec3(1.0, 0.9, 0.78), starHash(key + 5.5));
      col += tint * glow * twinkle * exp(-d * d / (sigma * sigma));
    }
    return col * smoothstep(0.02, 0.2, rd.y);
  }
`;

export const ENV_VERTEX = /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;

export const ENV_FRAGMENT = SKY_GLSL + /* glsl */ `varying vec3 vD; void main(){ gl_FragColor = vec4(bgCol(normalize(vD), 0.), 1.); }`;

/** The night background, a full-screen quad drawn first behind everything. */
export const BACKDROP_VERTEX = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }`;

/**
 * The gradient sky, the Milky Way panorama added over it (equirectangular in galactic coordinates: `uGalactic` turns
 * a world direction into the panorama's frame, tilting the band across the sky), faded into the horizon haze; the
 * moon and the stars as points on top.
 */
export const BACKDROP_FRAGMENT = /* glsl */ `
  uniform sampler2D uStars; uniform float uStarExposure; uniform mat3 uGalactic;
  uniform float uPixel; uniform float uTime; uniform float uCamY;
  uniform mat4 uInvProj, uInvView;
  varying vec2 vUv;
  ${SKY_GLSL}
  ${SKY_POINTS_GLSL}
  vec3 panorama(vec3 rd){
    vec3 g = uGalactic * rd;
    vec2 uv = vec2(atan(g.z, g.x) * 0.1591549 + 0.5, asin(clamp(g.y, -1., 1.)) * 0.3183099 + 0.5);
    return texture2D(uStars, uv).rgb * uStarExposure;
  }
  void main(){
    vec4 v = uInvProj * vec4(vUv * 2. - 1., 1., 1.); v /= v.w;
    vec3 rd = normalize((uInvView * vec4(v.xyz, 0.)).xyz);
    vec3 col = bgCol(rd, uCamY) + panorama(rd) * smoothstep(0., 0.12, rd.y) + skyPoints(rd, uPixel, uTime);
    gl_FragColor = vec4(col, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export const CLOUD_SEA_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

/**
 * The cloud sea: the photographed deck sampled at two scales (each drifting with the wind, `uDrift` already wrapped
 * by its mirrored period), graded to moonlight — navy-grey hollows, silver tops, a forward-scatter sheen towards the
 * moon's azimuth — and fogged into the horizon haze with distance.
 */
export const CLOUD_SEA_FRAGMENT = /* glsl */ `
  uniform sampler2D uSea; uniform vec4 uDrift; uniform float uTile; uniform vec3 uCam;
  varying vec3 vWorld;
  ${SKY_GLSL}
  void main(){
    float broad = texture2D(uSea, (vWorld.xz - uDrift.xy) / uTile).r;
    float fine = texture2D(uSea, (vWorld.xz - uDrift.zw) / (uTile / 3.) + 0.37).r;
    float deck = clamp(broad * 0.8 + (fine - 0.5) * 0.35, 0., 1.);
    vec3 rd = vWorld - uCam;
    float dist = length(rd);
    rd /= dist;
    vec3 col = mix(vec3(0.012, 0.018, 0.036), vec3(0.20, 0.23, 0.31), smoothstep(0.05, 0.9, deck));
    float toward = max(dot(normalize(rd.xz), normalize(uMoon.xz)), 0.);
    col += MOONLIGHT * pow(toward, 6.) * deck * deck * 0.10;
    col = mix(col, NIGHT_HORIZON, 1. - exp(-dist * 0.00009));
    gl_FragColor = vec4(col, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/**
 * A puff: a camera-facing quad at its centre carried by the wind (`uDrift`), its cluster wrapped round the camera
 * (`uBox`) so the field never runs out and a cluster never splits. Lit by a pseudo-normal from its cluster's centre
 * (domed, so the tops face up) against the moon; faded out near the camera and at the field's edge.
 */
export const PUFF_VERTEX = /* glsl */ `
  attribute vec3 aCentre; attribute vec3 aCluster; attribute float aSize; attribute float aVariant;
  uniform vec3 uDrift; uniform float uBox; uniform vec3 uCam; uniform vec3 uMoon;
  varying vec2 vUv; varying vec2 vCell; varying float vLit; varying float vFade; varying float vDist;
  vec2 wrapAround(vec2 v, vec2 c){ return mod(v - c + uBox * 0.5, uBox) - uBox * 0.5 + c; }
  void main(){
    vec3 cluster = aCluster + uDrift;
    vec3 c = aCentre + uDrift;
    c.xz += wrapAround(cluster.xz, uCam.xz) - cluster.xz;
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 p = c + (right * position.x + up * position.y) * aSize;
    vUv = uv;
    vCell = vec2(mod(aVariant, 2.), floor(aVariant / 2.)) * 0.5;
    vec3 n = normalize(aCentre - aCluster + vec3(0., 60., 0.));
    vLit = dot(n, uMoon) * 0.5 + 0.5;
    vDist = distance(c, uCam);
    vec2 edge = abs(c.xz - uCam.xz);
    vFade = smoothstep(20., 60., vDist) * (1. - smoothstep(uBox * 0.5 - 450., uBox * 0.5 - 100., max(edge.x, edge.y)));
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
  }`;

/** The puff's soft blob from the atlas (2 × 2 sprites), silver on its moonlit side, navy on the far one, its upper
 * edge catching a little more light, fogged into the horizon haze. */
export const PUFF_FRAGMENT = /* glsl */ `
  uniform sampler2D uPuff;
  varying vec2 vUv; varying vec2 vCell; varying float vLit; varying float vFade; varying float vDist;
  ${SKY_GLSL}
  void main(){
    float a = texture2D(uPuff, vCell + vUv * 0.5).a * vFade * 0.85;
    if (a < 0.004) discard;
    float lit = clamp(vLit * (0.8 + 0.4 * vUv.y), 0., 1.);
    vec3 col = mix(vec3(0.030, 0.040, 0.066), vec3(0.17, 0.20, 0.27), lit * lit);
    col = mix(col, NIGHT_HORIZON, 1. - exp(-vDist * 0.0003));
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
