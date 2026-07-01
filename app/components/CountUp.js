'use client';

import { useState, useRef, useEffect } from 'react';

// Animasi angka naik dari 0 ke nilai target, lalu tampilkan format akhir (display)
export default function CountUp({ value, display, duration = 900, delay = 200 }) {
  const [text, setText] = useState('0');
  const rafRef = useRef(null);

  useEffect(() => {
    let start = null;
    const target = Number(value) || 0;

    const timer = setTimeout(() => {
      function step(ts) {
        if (start === null) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        if (p < 1) {
          setText(Math.round(target * eased).toLocaleString('id-ID'));
          rafRef.current = requestAnimationFrame(step);
        } else {
          setText(display); // tampilkan format final (mis. "Rp 8.2 jt")
        }
      }
      rafRef.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, display, duration, delay]);

  return <span>{text}</span>;
}