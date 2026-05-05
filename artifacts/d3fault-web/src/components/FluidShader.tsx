import React, { useEffect, useRef } from "react";

const VERT = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/* Orthogonal time vectors prevent directional drift —
   each axis moves in opposing directions so they cancel. */
const FRAG = `
precision highp float;

uniform float u_time;
uniform vec2  u_resolution;
uniform vec2  u_mouse;
uniform float u_strength;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i + vec2(0,0)), f - vec2(0,0)),
        dot(hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
    mix(dot(hash2(i + vec2(0,1)), f - vec2(0,1)),
        dot(hash2(i + vec2(1,1)), f - vec2(1,1)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 6; i++) {
    v += a * gnoise(p);
    p  = rot * p * 2.0 + vec2(100.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 st = uv;
  st.x *= u_resolution.x / u_resolution.y;

  float t = u_time * 0.12;

  /* Mouse influence */
  vec2 mouse = u_mouse;
  mouse.x *= u_resolution.x / u_resolution.y;
  float mDist = length(st - mouse);
  float mPull = smoothstep(0.6, 0.0, mDist) * 0.18;

  /* Orthogonal time offsets — no net directional drift */
  vec2 q = vec2(
    fbm(st + vec2( t * 0.22, -t * 0.17)),
    fbm(st + vec2(5.2, 1.3) + vec2(-t * 0.19,  t * 0.14))
  );

  q += (mouse - st) * mPull;

  vec2 r = vec2(
    fbm(st + 2.0 * q + vec2( 1.7,  9.2) + vec2( t * 0.13, -t * 0.10)),
    fbm(st + 2.0 * q + vec2( 8.3,  2.8) + vec2(-t * 0.11,  t * 0.09))
  );

  float f = fbm(st + 2.5 * r);
  f = (f + 1.0) * 0.5;

  /* Luminance — controlled by u_strength */
  float lum = pow(f, 1.85) * (0.78 * u_strength);

  /* Bright veins at peaks */
  float vein = smoothstep(0.56, 0.74, f) * (0.45 * u_strength);
  lum += vein;

  lum += mPull * 0.14;
  lum = clamp(lum, 0.0, 1.0);

  /* Alpha: dark areas transparent so black bg shows through */
  float alpha = smoothstep(0.0, 0.45, lum) * min(u_strength * 1.1, 1.0);
  gl_FragColor = vec4(vec3(lum), alpha);
}
`;

function initGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: false });
  if (!gl) return null;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("[FluidShader] compile:", gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  };

  const vert = compile(gl.VERTEX_SHADER, VERT);
  const frag = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vert || !frag) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("[FluidShader] link:", gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  const pos = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  return {
    gl,
    uTime:       gl.getUniformLocation(prog, "u_time"),
    uResolution: gl.getUniformLocation(prog, "u_resolution"),
    uMouse:      gl.getUniformLocation(prog, "u_mouse"),
    uStrength:   gl.getUniformLocation(prog, "u_strength"),
  };
}

interface Props {
  style?: React.CSSProperties;
  /** 0–1 brightness/visibility of the effect. Default 1.0 */
  strength?: number;
  /** whether to track mouse */
  interactive?: boolean;
}

export function FluidShader({ style, strength = 1.0, interactive = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef<[number, number]>([0.5, 0.5]);
  const targetRef = useRef<[number, number]>([0.5, 0.5]);
  const rafRef    = useRef<number>(0);
  const strRef    = useRef(strength);
  strRef.current  = strength;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = initGL(canvas);
    if (!ctx) return;
    const { gl, uTime, uResolution, uMouse, uStrength } = ctx;

    const resize = () => {
      // Use the canvas's own CSS-computed size (width:100%, height:100% fills parent)
      const w = canvas.offsetWidth  || canvas.parentElement?.offsetWidth  || window.innerWidth;
      const h = canvas.offsetHeight || canvas.parentElement?.offsetHeight || window.innerHeight;
      if (w === 0 || h === 0) return;
      canvas.width  = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    resize();
    // Fallback in case layout hasn't fully settled on first paint
    const resizeTimer = setTimeout(resize, 50);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      targetRef.current = [
        (e.clientX - rect.left)  / rect.width,
        1.0 - (e.clientY - rect.top) / rect.height,
      ];
    };
    window.addEventListener("mousemove", onMove);

    const start = performance.now();
    const tick = () => {
      mouseRef.current[0] += (targetRef.current[0] - mouseRef.current[0]) * 0.05;
      mouseRef.current[1] += (targetRef.current[1] - mouseRef.current[1]) * 0.05;

      const t = (performance.now() - start) * 0.001;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouseRef.current[0], mouseRef.current[1]);
      gl.uniform1f(uStrength, strRef.current);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(resizeTimer);
      window.removeEventListener("mousemove", onMove);
      ro.disconnect();
    };
  }, [interactive]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0, left: 0,
        width: "100%", height: "100%",
        display: "block",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}
