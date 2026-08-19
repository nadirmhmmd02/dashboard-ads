'use client';

/* ─────────────────────────────────────────────────────────────
   Suara "tugas selesai" — disintesis lewat Web Audio (tanpa file mp3):
   dua nada pendek naik (E5 → B5) dengan ekor lembut + sedikit kilau
   harmonik, mirip bunyi centang Microsoft To Do. Volume kecil supaya
   enak didengar berulang. AudioContext dibuat lazy saat klik pertama
   (aturan autoplay browser: harus dari gesture pengguna).
   ───────────────────────────────────────────────────────────── */

let ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(ac, dest, { freq, start, dur, type = 'sine', peak = 0.2 }) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.012);      // attack cepat
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);      // ekor meluruh
  osc.connect(g).connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/* Dipanggil saat tugas DITANDAI selesai (bukan saat dibatalkan) */
export function playDoneSound() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  const master = ac.createGain();
  master.gain.value = 0.55;
  master.connect(ac.destination);
  // nada 1 (E5) & nada 2 (B5) — interval kuint, terdengar "berhasil"
  tone(ac, master, { freq: 659.25, start: t,        dur: 0.32, peak: 0.22 });
  tone(ac, master, { freq: 987.77, start: t + 0.09, dur: 0.48, peak: 0.24 });
  // kilau: oktaf atas sangat pelan, segitiga
  tone(ac, master, { freq: 1975.5, start: t + 0.09, dur: 0.30, type: 'triangle', peak: 0.05 });
}

/* Versi lebih halus untuk langkah (sub-tugas) selesai */
export function playStepSound() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  const master = ac.createGain();
  master.gain.value = 0.4;
  master.connect(ac.destination);
  tone(ac, master, { freq: 880, start: t, dur: 0.22, peak: 0.16 });
}
