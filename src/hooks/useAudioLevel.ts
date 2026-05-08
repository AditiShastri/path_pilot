import { useRef, useCallback, useEffect } from 'react';

export function useAudioLevel() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);
  const levelFrameRef = useRef<number | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const stopAnalysis = useCallback(() => {
    if (levelFrameRef.current !== null) {
      cancelAnimationFrame(levelFrameRef.current);
      levelFrameRef.current = null;
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    if (analyserRef.current) {
      try { analyserRef.current.disconnect(); } catch (e) {}
      analyserRef.current = null;
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => track.stop());
      activeStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const startAnalysis = useCallback(async (
    source: HTMLAudioElement | MediaStream,
    onLevelUpdate: (level: number) => void
  ) => {
    stopAnalysis();
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    audioContextRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    analyserRef.current = analyser;

    if (source instanceof MediaStream) {
      sourceNodeRef.current = ctx.createMediaStreamSource(source);
      activeStreamRef.current = source;
    } else {
      sourceNodeRef.current = ctx.createMediaElementSource(source);
    }

    try {
      sourceNodeRef.current.connect(analyser);
      if (!(source instanceof MediaStream)) {
        analyser.connect(ctx.destination);
      }
    } catch (err) {
      console.error("Audio Routing Error", err);
    }

    const waveform = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!analyserRef.current) return;
      if (source instanceof HTMLAudioElement && (source.paused || source.ended)) {
        onLevelUpdate(0);
        levelFrameRef.current = null;
        return;
      }

      analyserRef.current.getByteTimeDomainData(waveform);
      let sumSquares = 0;
      for (let i = 0; i < waveform.length; i++) {
        const normalized = (waveform[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / waveform.length);
      const baseLevel = 0.12;
      const level = Math.min(1, Math.max(baseLevel, baseLevel + rms * 6));
      
      onLevelUpdate(level);
      levelFrameRef.current = requestAnimationFrame(tick);
    };

    levelFrameRef.current = requestAnimationFrame(tick);
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
  }, [stopAnalysis]);

  useEffect(() => {
    return () => {
      stopAnalysis();
    };
  }, [stopAnalysis]);

  return { startAnalysis, stopAnalysis };
}
