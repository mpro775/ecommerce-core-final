import { useCallback, useEffect, useRef } from 'react';

export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    const el = new Audio('/sounds/notification.wav');
    el.volume = 0.45;
    el.addEventListener(
      'error',
      () => {
        audioElementRef.current = null;
      },
      { once: true },
    );
    audioElementRef.current = el;

    function handleUnlock() {
      unlockedRef.current = true;
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new AudioContext();
        } catch {
          // AudioContext not supported
        }
      }
    }

    document.addEventListener('click', handleUnlock, { once: true });
    document.addEventListener('keydown', handleUnlock, { once: true });

    return () => {
      document.removeEventListener('click', handleUnlock);
      document.removeEventListener('keydown', handleUnlock);
      audioElementRef.current = null;
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, []);

  const play = useCallback(() => {
    if (!unlockedRef.current) return;

    if (audioElementRef.current) {
      const audio = audioElementRef.current;
      audio.currentTime = 0;
      audio.play().catch(() => {
        playBeep(audioContextRef.current);
      });
    } else {
      playBeep(audioContextRef.current);
    }
  }, []);

  return { play };
}

function playBeep(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 830;
    oscillator.type = 'sine';
    gain.gain.value = 0.25;
    const now = ctx.currentTime;
    oscillator.start(now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    oscillator.stop(now + 0.3);
  } catch {
    // silently ignore
  }
}
