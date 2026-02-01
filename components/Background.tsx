"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const VertexShader = `
  varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  // Noise function
  float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    vec2 st = vUv;

    // Deep Dark Blue Base (#050511)
    vec3 color = vec3(0.02, 0.02, 0.07);

    // Moving Gradient Blobs

    // Cyan Blob (#06b6d4) - Top Right
    vec2 pos1 = vec2(0.8, 0.8) + vec2(sin(uTime * 0.3) * 0.1, cos(uTime * 0.2) * 0.1);
    float dist1 = distance(st, pos1);
    float glow1 = smoothstep(0.8, 0.0, dist1);
  color = mix(color, vec3(0.02, 0.71, 0.83), glow1 * 0.4);

    // Dark Violet Blob (#4c1d95) - Bottom Left
    vec2 pos2 = vec2(0.2, 0.2) + vec2(cos(uTime * 0.25) * 0.1, sin(uTime * 0.35) * 0.1);
    float dist2 = distance(st, pos2);
    float glow2 = smoothstep(0.9, 0.0, dist2);
  color = mix(color, vec3(0.3, 0.11, 0.58), glow2 * 0.5);

    // Accent Blue Blob (#22d3ee) - Center Moving
    vec2 pos3 = vec2(0.5, 0.5) + vec2(sin(uTime * 0.15) * 0.2, cos(uTime * 0.15) * 0.2);
    float dist3 = distance(st, pos3);
    float glow3 = smoothstep(0.7, 0.0, dist3);
  color = mix(color, vec3(0.13, 0.83, 0.93), glow3 * 0.2);

    // Grain Texture
    float noise = random(st); // Static noise
    float grainStrength = 0.08; // Adjust for "dark soft neo brutalism" feel
  color += (noise - 0.5) * grainStrength;

    // Vignette
    float vignette = smoothstep(1.2, 0.5, distance(st, vec2(0.5)));
  color *= vignette;

  gl_FragColor = vec4(color, 1.0);
}
`;

function GradientMesh() {
  const mesh = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(viewport.width, viewport.height) },
    }),
    [viewport]
  );

  useFrame((state) => {
    if (mesh.current) {
      (mesh.current.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={mesh} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        fragmentShader={FragmentShader}
        vertexShader={VertexShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export function Background() {
  return (
    <div className="fixed inset-0 -z-10 bg-[#050511]">
      <Canvas camera={{ position: [0, 0, 1] }}>
        <GradientMesh />
      </Canvas>
    </div>
  );
}
