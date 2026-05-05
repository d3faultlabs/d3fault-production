import React, { useEffect, useRef, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

interface TextScrambleProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
}

export function TextScramble({ text, className, delay = 0, duration = 1200 }: TextScrambleProps) {
  const [display, setDisplay] = useState(text.replace(/./g, "█"));
  const frameRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startRef.current) startRef.current = timestamp;
        const elapsed = timestamp - startRef.current;
        const progress = Math.min(elapsed / duration, 1);

        const chars = text.split("").map((char, i) => {
          const charProgress = Math.max(0, (progress - (i / text.length) * 0.5) * 2);
          if (charProgress >= 1 || char === " ") return char;
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        });

        setDisplay(chars.join(""));

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate);
        }
      };

      frameRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [text, delay, duration]);

  return <span className={className}>{display}</span>;
}
