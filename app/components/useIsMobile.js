'use client';

import { useState, useEffect } from 'react';

/* ─────────────────────────────────────────────────────────────
   useIsMobile — deteksi viewport mobile (≤767px) via matchMedia.
   SSR-safe: render pertama selalu desktop (false), lalu update
   setelah mount — tidak memicu hydration error.
   Fallback addListener/removeListener untuk Safari lama.
   ───────────────────────────────────────────────────────────── */

export default function useIsMobile(maxWidth = 767) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    // Dobel listener (matchMedia change + window resize) supaya deteksi
    // tetap jalan di browser/WebView lama yang change event-nya flaky
    window.addEventListener('resize', update);
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      window.removeEventListener('resize', update);
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, [maxWidth]);

  return isMobile;
}
