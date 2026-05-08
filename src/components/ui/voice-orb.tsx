"use client";

import React, { memo, useEffect, useRef } from "react";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type VoiceOrbProps = {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  outputAudioElement?: HTMLAudioElement | null;
  transcript?: string;
  sentTranscript?: string;
  onToggleMic: () => void;
  onStop: () => void;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export const VoiceOrb = memo(function VoiceOrb({
  isListening,
  isSpeaking,
  isProcessing,
  outputAudioElement,
  transcript,
  sentTranscript,
  onToggleMic,
  onStop,
}: VoiceOrbProps) {
  const isMobile = useIsMobile();
  const hostRef = useRef<HTMLDivElement | null>(null);

  const frameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const sphereRef = useRef<THREE.Mesh | null>(null);
  const particleRef = useRef<THREE.Points | null>(null);

  const sphereBaseDirRef = useRef<Float32Array | null>(null);
  const particleBaseRef = useRef<Float32Array | null>(null);

  const noise3D = useRef(createNoise3D());
  const smoothBassRef = useRef(0);
  const smoothTreRef = useRef(0);
  const signalRef = useRef(0.05);
  const outputEnergyRef = useRef(0);
  const stateRef = useRef<"idle" | "listening" | "speaking" | "processing">("idle");
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const outputWaveformRef = useRef<Uint8Array | null>(null);

  const state = isProcessing
    ? "processing"
    : isSpeaking
    ? "speaking"
    : isListening
    ? "listening"
    : "idle";

  const active = state !== "idle";

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!outputAudioElement) {
      if (outputSourceNodeRef.current) {
        try {
          outputSourceNodeRef.current.disconnect();
        } catch {
          // Ignore disconnect errors during cleanup.
        }
        outputSourceNodeRef.current = null;
      }
      if (outputAnalyserRef.current) {
        try {
          outputAnalyserRef.current.disconnect();
        } catch {
          // Ignore disconnect errors during cleanup.
        }
        outputAnalyserRef.current = null;
      }
      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close().catch(() => {});
        outputAudioContextRef.current = null;
      }
      outputWaveformRef.current = null;
      outputEnergyRef.current = 0;
      return;
    }

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) {
      outputEnergyRef.current = 0;
      return;
    }

    const context = new AudioContextCtor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;

    let source: MediaElementAudioSourceNode;
    try {
      source = context.createMediaElementSource(outputAudioElement);
    } catch {
      outputEnergyRef.current = 0;
      return;
    }

    source.connect(analyser);
    analyser.connect(context.destination);

    outputAudioContextRef.current = context;
    outputAnalyserRef.current = analyser;
    outputSourceNodeRef.current = source;
    outputWaveformRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    return () => {
      if (outputSourceNodeRef.current) {
        try {
          outputSourceNodeRef.current.disconnect();
        } catch {
          // Ignore disconnect errors during cleanup.
        }
        outputSourceNodeRef.current = null;
      }
      if (outputAnalyserRef.current) {
        try {
          outputAnalyserRef.current.disconnect();
        } catch {
          // Ignore disconnect errors during cleanup.
        }
        outputAnalyserRef.current = null;
      }
      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close().catch(() => {});
        outputAudioContextRef.current = null;
      }
      outputWaveformRef.current = null;
      outputEnergyRef.current = 0;
    };
  }, [outputAudioElement]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1000);
    const baseZ = isMobile ? 75 : 105;
    camera.position.set(0, 0, baseZ);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // ✅ Perfect centering
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    // Sphere
    const sphereGeometry = new THREE.IcosahedronGeometry(20, 1);
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.2,
      metalness: 0.7,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.3,
      wireframe: true,
    });

    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

    const light = new THREE.DirectionalLight("#ffffff", 2);
    light.position.set(0, 50, 100);

    // ✅ ORIGINAL PARTICLES (unchanged)
    const particleCount = isMobile ? 800 : 1200;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleBase = new Float32Array(particleCount * 3);

    const baseParticleRadius = isMobile ? 26 : 31;

    for (let i = 0; i < particleCount; i++) {
      const r = baseParticleRadius;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      const i3 = i * 3;
      particlePositions[i3] = x;
      particlePositions[i3 + 1] = y;
      particlePositions[i3 + 2] = z;

      particleBase[i3] = x;
      particleBase[i3 + 1] = y;
      particleBase[i3 + 2] = z;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );

    const particleMaterial = new THREE.PointsMaterial({
      color: "#ff8800",
      size: 0.65,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);

    scene.add(camera, light, sphere, particles);

    // Sphere base directions
    const posAttr = sphereGeometry.getAttribute("position") as THREE.BufferAttribute;
    const baseDir = new Float32Array(posAttr.array.length);

    for (let i = 0; i < posAttr.count; i++) {
      const i3 = i * 3;
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const len = Math.sqrt(x * x + y * y + z * z) || 1;

      baseDir[i3] = x / len;
      baseDir[i3 + 1] = y / len;
      baseDir[i3 + 2] = z / len;
    }

    host.appendChild(renderer.domElement);

    rendererRef.current = renderer;
    cameraRef.current = camera;
    sphereRef.current = sphere;
    particleRef.current = particles;
    sphereBaseDirRef.current = baseDir;
    particleBaseRef.current = particleBase;

    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const scale = Math.min(width, height) / 320;
      sphere.scale.setScalar(scale);
      particles.scale.setScalar(scale);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resizeObserverRef.current = observer;

    const animate = () => {
      const now = performance.now();
      const time = now * 0.001;

      if (outputAnalyserRef.current && outputWaveformRef.current) {
        const waveform = outputWaveformRef.current as Uint8Array<ArrayBuffer>;
        outputAnalyserRef.current.getByteTimeDomainData(waveform);
        let sumSquares = 0;
        for (let i = 0; i < waveform.length; i += 1) {
          const normalized = (waveform[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / waveform.length);
        const normalizedEnergy = clamp01(rms * 4.5);
        outputEnergyRef.current = lerp(outputEnergyRef.current, normalizedEnergy, 0.22);
      } else {
        outputEnergyRef.current = lerp(outputEnergyRef.current, 0, 0.16);
      }

      let targetSignal = 0.05;
      switch (stateRef.current) {
        case "listening": {
          // Buzzing listening effect for active microphone mode.
          const buzzA = Math.abs(Math.sin(time * 30));
          const buzzB = Math.abs(Math.sin(time * 53));
          const buzzC = (Math.sin(time * 6.5) + 1) * 0.5;
          targetSignal = 0.08 + buzzA * 0.1 + buzzB * 0.05 + buzzC * 0.06;
          break;
        }
        case "speaking": {
          const energy = outputEnergyRef.current;
          if (energy > 0.01) {
            targetSignal = 0.12 + energy * 0.92;
          } else {
            const pulse = Math.max(0, Math.sin(time * 9.5));
            targetSignal = 0.2 + pulse * 0.28;
          }
          break;
        }
        case "processing": {
          const wave = (Math.sin(time * 2.2) + 1) * 0.5;
          targetSignal = 0.2 + wave * 0.16;
          break;
        }
        default: {
          const idleWave = (Math.sin(time * 1.4) + 1) * 0.5;
          targetSignal = 0.04 + idleWave * 0.03;
        }
      }

      signalRef.current = lerp(signalRef.current, clamp01(targetSignal), 0.16);
      const signal = signalRef.current;

      const bass =
        stateRef.current === "speaking"
          ? signal * 1.18
          : stateRef.current === "listening"
          ? signal * 1.02
          : signal * 0.78;

      const treble =
        stateRef.current === "speaking"
          ? signal * 0.88
          : stateRef.current === "listening"
          ? signal * 1.1
          : signal * 0.68;

      smoothBassRef.current = lerp(smoothBassRef.current, clamp01(bass), 0.14);
      smoothTreRef.current = lerp(smoothTreRef.current, clamp01(treble), 0.14);

      const bassFr = smoothBassRef.current * 7;
      const treFr = smoothTreRef.current * 3;

      const sphereMesh = sphereRef.current!;
      const base = sphereBaseDirRef.current!;
      const pos = (sphereMesh.geometry as THREE.BufferGeometry).getAttribute("position") as THREE.BufferAttribute;

      // ✅ IMPROVED SPHERE (your preferred version)
      const radius = 10;
      const amp = isMobile ? 2.5 : 4;
      const noiseSpeed = 0.00015;

      for (let i = 0; i < pos.count; i++) {
        const i3 = i * 3;

        const nx = base[i3];
        const ny = base[i3 + 1];
        const nz = base[i3 + 2];

        const noise =
          noise3D.current(
            nx + now * noiseSpeed * 4,
            ny + now * noiseSpeed * 6,
            nz + now * noiseSpeed * 7
          );

        const d =
          radius +
          bassFr * 0.8 +
          noise * amp * treFr * 1.5;

        pos.setXYZ(i, nx * d, ny * d, nz * d);
      }

      pos.needsUpdate = true;

      sphereMesh.rotation.z += 0.005;
      particles.rotation.y -= 0.01;

      // ✅ ORIGINAL PARTICLE ANIMATION
      const particlePosition = particles.geometry.getAttribute("position") as THREE.BufferAttribute;
      const particleBasePos = particleBaseRef.current!;

      const breath = 1 + bassFr * 0.01 + treFr * 0.005;

      for (let i = 0; i < particlePosition.count; i++) {
        const i3 = i * 3;

        const x = particleBasePos[i3];
        const y = particleBasePos[i3 + 1];
        const z = particleBasePos[i3 + 2];

        const wobble = noise3D.current(
          x * 0.04 + now * 0.00002,
          y * 0.04,
          z * 0.04
        );

        const radiusBoost =
          bassFr * 0.008 + treFr * 0.004 + wobble * 0.14945;

        const scale = breath + radiusBoost;

        particlePosition.setXYZ(i, x * scale, y * scale, z * scale);
      }

      particlePosition.needsUpdate = true;

      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      resizeObserverRef.current?.disconnect();

      renderer.dispose();
      sphereGeometry.dispose();
      particleGeometry.dispose();

      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [isMobile]);

  const handleClick = () => {
    if (isSpeaking || isProcessing) onStop();
    else onToggleMic();
  };

  return (
    <div className="relative mx-auto w-full max-w-[34rem] aspect-square overflow-hidden px-3 py-4">
      {(transcript || sentTranscript) && (
        <div className="absolute top-4 left-0 right-0 z-30 mx-auto w-full max-w-[28rem] px-3">
          {transcript && (
            <div className="self-end rounded-2xl border px-4 py-2 text-sm text-primary">
             {transcript}
            </div>
          )}
          {sentTranscript && (
            <div className="self-end rounded-2xl border px-4 py-2 text-sm text-primary mt-2">
              {sentTranscript}
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <div className="relative w-[80%] max-w-[22rem] aspect-square">
          <div
            ref={hostRef}
            className="absolute inset-0 rounded-full overflow-hidden"
          />

          <button
            onClick={handleClick}
            className={cn(
              "absolute inset-0 rounded-full z-20",
              active && "scale-105",
              "hover:scale-105 active:scale-95 transition"
            )}
          />
        </div>

        <p className="text-sm text-white/80 text-center">
          {isProcessing
            ? "AI is thinking..."
            : isSpeaking
            ? "AI is speaking..."
            : isListening
            ? "Listening..."
            : "Tap to speak"}
        </p>
      </div>
    </div>
  );
});