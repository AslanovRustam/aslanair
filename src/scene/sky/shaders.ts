// Cloud raymarch ported from the v4 cloud spike (.superpowers/brainstorm/.../spike-plane-v4.html), relit for a night
// flight: moonlight, a starry navy sky, a dark sea with the moon's path on it.

/** Night sky above the horizon (navy gradient, moon with its halo, stars), dark sea below; shared by the clouds and
 * the environment map. */
export const SKY_GLSL = /* glsl */ `
  uniform vec3 uMoon;
  const vec3 NIGHT_HORIZON = vec3(0.030, 0.045, 0.090);
  const vec3 NIGHT_ZENITH = vec3(0.004, 0.008, 0.024);
  const vec3 MOONLIGHT = vec3(0.80, 0.86, 1.00);
  float starHash(vec3 p){ p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
  vec3 stars(vec3 rd){
    vec3 p = rd * 220.;
    vec3 cell = floor(p);
    float h = starHash(cell);
    if (h < 0.988) return vec3(0.);
    vec3 star = cell + 0.5 + 0.35 * (vec3(starHash(cell + 1.3), starHash(cell + 2.7), starHash(cell + 4.1)) - 0.5);
    // small and bright: the cloud pass is drawn at a fraction of the screen and blurred, which spreads them
    return vec3(0.9, 0.93, 1.0) * smoothstep(0.24, 0.0, length(p - star)) * (h - 0.988) / 0.012 * 5.;
  }
  vec3 skyCol(vec3 rd){
    float y = max(rd.y, 0.);
    vec3 c = mix(NIGHT_HORIZON, NIGHT_ZENITH, pow(y, 0.45));
    float m = max(dot(rd, uMoon), 0.);
    c += MOONLIGHT * (smoothstep(0.99975, 0.99985, m) * 8. + pow(m, 600.) * 0.6 + pow(m, 24.) * 0.06);
    return c + stars(rd) * smoothstep(0.02, 0.25, rd.y);
  }
  vec3 belowCol(vec3 rd, float camY){
    float t = (-2600. - camY) / min(rd.y, -1e-4);
    vec3 mirrored = vec3(rd.x, -rd.y, rd.z);
    vec3 sea = vec3(0.004, 0.008, 0.016) + MOONLIGHT * pow(max(dot(mirrored, uMoon), 0.), 90.) * 0.6;
    return mix(sea, NIGHT_HORIZON, 1. - exp(-t * 0.00006));
  }
  vec3 bgCol(vec3 rd, float camY){ return rd.y > 0. ? skyCol(rd) : belowCol(rd, camY); }
`;

export const FULLSCREEN_VERTEX = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

export const ENV_VERTEX = /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;

export const ENV_FRAGMENT = SKY_GLSL + /* glsl */ `varying vec3 vD; void main(){ gl_FragColor = vec4(bgCol(normalize(vD), 0.), 1.); }`;

/** Raymarched cloud layer between y = -1150 and -380, wind-driven and lit by the moon, written as linear HDR colour. */
export const CLOUD_FRAGMENT = /* glsl */ `
    precision highp float; precision highp sampler3D;
    uniform sampler3D uNoise; uniform vec3 uCam; uniform mat4 uInvProj, uInvView; uniform float uTime;
    varying vec2 vUv;
    ${SKY_GLSL}
    const float B = -1150., T = -380.;
    float n3(vec3 p){ return texture(uNoise, p).r; }
    vec3 wind(){ return vec3(-uTime * 55., 0., uTime * 6.); }
    float coverageAt(vec2 xz){ return smoothstep(0.30, 0.62, n3(vec3(xz * 0.00005, 0.37))); }
    float shape(vec3 p, vec3 w, float cov, bool hq){
      float h = (p.y - B) / (T - B);
      if (h <= 0. || h >= 1.) return 0.;
      vec3 q = (p + w) * 0.00045 + vec3(0., uTime * 0.0015, 0.);
      float prof = smoothstep(0., 0.12, h) * (1. - smoothstep(0.3, 1.0, h));
      float c = max(cov * prof, 0.001);
      float base = hq ? n3(q) * 0.62 + n3(q * 2.03 + 0.17) * 0.38 : n3(q);
      float d = (base - (1. - c)) / c;
      if (hq && d > 0. && d < 0.6) d -= (1. - d) * 0.3 * n3(q * 7.3 + 0.71);
      return clamp(d * 1.25, 0., 1.);
    }
    float hg(float c, float g){ float g2 = g * g; return (1. - g2) / pow(1. + g2 - 2. * g * c, 1.5); }
    void main(){
      vec4 v = uInvProj * vec4(vUv * 2. - 1., 1., 1.); v /= v.w;
      vec3 rd = normalize((uInvView * vec4(v.xyz, 0.)).xyz), ro = uCam;
      vec3 bg = bgCol(rd, ro.y);
      if (abs(rd.y) < 1e-4) { gl_FragColor = vec4(bg, 1.); return; }
      float tb = (B - ro.y) / rd.y, tt = (T - ro.y) / rd.y;
      float t0 = max(min(tb, tt), 0.), t1 = min(max(tb, tt), 45000.);
      if (t1 <= t0) { gl_FragColor = vec4(bg, 1.); return; }
      float dt = clamp((t1 - t0) / 26., 15., 600.);
      float t = t0 + dt * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      float mu = dot(rd, uMoon);
      float phase = mix(hg(mu, 0.6), hg(mu, -0.2), 0.4) * 0.6 + 0.4;
      vec3 w = wind();
      vec3 acc = vec3(0.); float Tr = 1., hit = 0., wsum = 0.;
      for (int i = 0; i < 40; i++){
        if (t > t1) break;
        vec3 p = ro + rd * t;
        float cov = coverageAt(p.xz + w.xz);
        if (cov < 0.02) { t += dt * 3.; continue; }
        float d = shape(p, w, cov, true);
        if (d > 0.003){
          float ld = shape(p + uMoon * 45., w, cov, false) + shape(p + uMoon * 160., w, cov, false);
          float lightT = exp(-ld * 1.4);
          float powder = 1. - exp(-d * 6.);
          float h = (p.y - B) / (T - B);
          vec3 amb = mix(vec3(0.010, 0.014, 0.028), vec3(0.030, 0.040, 0.075), h);
          vec3 S = MOONLIGHT * 0.55 * lightT * phase * mix(0.6, 1.0, powder) + amb;
          float a = 1. - exp(-d * dt * 0.06);
          acc += Tr * a * S; hit += Tr * a * t; wsum += Tr * a;
          Tr *= 1. - a;
          if (Tr < 0.03) break;
          t += dt;
        } else t += dt * 1.7;
      }
      float dist = wsum > 0. ? hit / wsum : 0.;
      acc = mix(acc, NIGHT_HORIZON * (1. - Tr), 1. - exp(-dist * 0.00006));
      gl_FragColor = vec4(acc + Tr * bg, 1.);
    }`;

/** Separable 9-tap Gaussian (linear-sampling trick); uDir is one texel along x or y. */
export const BLUR_FRAGMENT = /* glsl */ `uniform sampler2D uTex; uniform vec2 uDir; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(uTex, vUv) * 0.2270270270;
      c += (texture2D(uTex, vUv + uDir * 1.3846153846) + texture2D(uTex, vUv - uDir * 1.3846153846)) * 0.3162162162;
      c += (texture2D(uTex, vUv + uDir * 3.2307692308) + texture2D(uTex, vUv - uDir * 3.2307692308)) * 0.0702702703;
      gl_FragColor = c;
    }`;
