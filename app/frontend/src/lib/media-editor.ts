import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '@/utils/mediaCompression';

export type Point = { x: number; y: number };
export type Overlay = { id: number; text: string; color: string; x: number; y: number };
export type Stroke = { color: string; points: Point[] };
export type MediaEdits = {
  rotation: number; ratio: number | null; zoom: number; panX: number; panY: number;
  filter: string; overlays: Overlay[]; strokes: Stroke[]; hd: boolean;
};
export const DEFAULT_EDITS: MediaEdits = {
  rotation: 0, ratio: null, zoom: 1, panX: 0.5, panY: 0.5,
  filter: 'normal', overlays: [], strokes: [], hd: false,
};
export const FILTERS = [
  { id: 'normal', label: 'Original' }, { id: 'warm', label: 'Chaud' },
  { id: 'cool', label: 'Froid' }, { id: 'mono', label: 'Noir et blanc' },
  { id: 'vivid', label: 'Vif' },
];

export function cropGeometry(width: number, height: number, edits: MediaEdits) {
  const rotated = edits.rotation % 180 !== 0;
  const rw = rotated ? height : width, rh = rotated ? width : height;
  const ratio = edits.ratio ?? rw / rh;
  let cw = rw, ch = cw / ratio;
  if (ch > rh) { ch = rh; cw = ch * ratio; }
  cw /= edits.zoom; ch /= edits.zoom;
  return { rw, rh, width: cw, height: ch, x: (rw - cw) * edits.panX, y: (rh - ch) * edits.panY };
}

// Filters use pixel math rather than canvas.filter, which is not available
// in every mobile browser. The same renderer supplies preview and export.
function applyFilter(ctx: CanvasRenderingContext2D, filter: string, w: number, h: number) {
  if (filter === 'normal') return;
  const image = ctx.getImageData(0, 0, w, h), d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (filter === 'mono') d[i] = d[i + 1] = d[i + 2] = .299 * r + .587 * g + .114 * b;
    else if (filter === 'warm') { d[i] = r * 1.08 + 8; d[i + 2] = b * .9; }
    else if (filter === 'cool') { d[i] = r * .92; d[i + 2] = b * 1.08 + 8; }
    else if (filter === 'vivid') {
      const gray = .299 * r + .587 * g + .114 * b;
      d[i] = gray + (r - gray) * 1.35; d[i + 1] = gray + (g - gray) * 1.35; d[i + 2] = gray + (b - gray) * 1.35;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function renderMedia(canvas: HTMLCanvasElement, source: CanvasImageSource, width: number, height: number, edits: MediaEdits, maxDimension: number) {
  const crop = cropGeometry(width, height, edits);
  const scale = Math.min(1, maxDimension / Math.max(crop.width, crop.height));
  const w = Math.max(2, Math.round(crop.width * scale / 2) * 2), h = Math.max(2, Math.round(crop.height * scale / 2) * 2);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('La retouche n’est pas disponible sur ce navigateur.');
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.scale(w / crop.width, h / crop.height);
  ctx.translate(-crop.x, -crop.y);
  ctx.translate(crop.rw / 2, crop.rh / 2);
  ctx.rotate(edits.rotation * Math.PI / 180);
  ctx.drawImage(source, -width / 2, -height / 2, width, height);
  ctx.restore();
  applyFilter(ctx, edits.filter, w, h);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, w * .008);
  for (const stroke of edits.strokes) {
    if (!stroke.points.length) continue;
    ctx.strokeStyle = stroke.color; ctx.beginPath();
    stroke.points.forEach((p, i) => i ? ctx.lineTo(p.x * w, p.y * h) : ctx.moveTo(p.x * w, p.y * h));
    if (stroke.points.length === 1) ctx.lineTo(stroke.points[0].x * w + .01, stroke.points[0].y * h);
    ctx.stroke();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.max(16, w * .065)}px system-ui, sans-serif`;
  for (const overlay of edits.overlays) {
    ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = Math.max(2, w * .004);
    ctx.fillStyle = overlay.color;
    ctx.strokeText(overlay.text, overlay.x * w, overlay.y * h, w * .95);
    ctx.fillText(overlay.text, overlay.x * w, overlay.y * h, w * .95);
  }
}

const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Impossible de préparer la photo.')), type, quality);
});

export async function exportImage(source: HTMLImageElement, file: File, edits: MediaEdits) {
  const canvas = document.createElement('canvas');
  renderMedia(canvas, source, source.naturalWidth, source.naturalHeight, edits, edits.hd ? 2560 : 1280);
  // Preserve transparent PNG/WebP sources, without silently recompressing HD.
  const type = file.type === 'image/png' || file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const blob = await canvasBlob(canvas, type, edits.hd ? .9 : .75);
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('Photo trop volumineuse (5 Mo max). Essayez la qualité Standard.');
  const outputType = blob.type || type;
  const extension = outputType === 'image/png' ? 'png' : outputType === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-loboko.${extension}`, { type: outputType });
}

export function videoExportType() {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream || typeof AudioContext === 'undefined') return null;
  return ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type)) ?? null;
}

export function hasVisualEdits(edits: MediaEdits) {
  return edits.rotation !== 0 || edits.ratio !== null || edits.zoom !== 1 || edits.filter !== 'normal' || !!edits.overlays.length || !!edits.strokes.length;
}

function waitFor(video: HTMLVideoElement, event: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('La préparation de la vidéo a expiré. Réessayez.')), 15000);
    const done = () => finish();
    const fail = () => finish(new Error('Impossible de lire cette vidéo.'));
    const abort = () => finish(new DOMException('Annulé', 'AbortError'));
    function finish(error?: Error) {
      clearTimeout(timer); video.removeEventListener(event, done); video.removeEventListener('error', fail); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    }
    video.addEventListener(event, done, { once: true }); video.addEventListener('error', fail, { once: true }); signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

// Short clips are encoded locally, in real time. No camera/microphone access
// is requested. The AudioContext contains only the selected file's sound.
export async function exportVideo(file: File, edits: MediaEdits, start: number, end: number, mute: boolean, signal: AbortSignal, onProgress: (value: number) => void) {
  const mimeType = videoExportType();
  if (!mimeType) throw new Error('Retouche vidéo indisponible ici. Vous pouvez envoyer la vidéo originale avec sa légende.');
  const video = document.createElement('video'); video.playsInline = true; video.preload = 'auto';
  const url = URL.createObjectURL(file); const canvas = document.createElement('canvas');
  const audio = new AudioContext();
  let stream: MediaStream | undefined, recorder: MediaRecorder | undefined, frame = 0;
  try {
    // Resume within the button gesture, before waiting for file decoding.
    await audio.resume();
    const loaded = waitFor(video, 'loadeddata', signal); video.src = url; video.load(); await loaded;
    if (start > 0) { const sought = waitFor(video, 'seeked', signal); video.currentTime = start; await sought; }
    renderMedia(canvas, video, video.videoWidth, video.videoHeight, edits, edits.hd ? 1920 : 1280);
    stream = canvas.captureStream(30);
    const source = audio.createMediaElementSource(video);
    const destination = audio.createMediaStreamDestination();
    source.connect(destination);
    if (!mute) destination.stream.getAudioTracks().forEach(track => stream!.addTrack(track));
    // Also release the unused audio track for muted exports.
    if (mute) destination.stream.getTracks().forEach(track => track.stop());
    const duration = end - start;
    // Keep the existing 15 Mo upload limit even for a 90-second post.
    const bitrate = Math.min(edits.hd ? 5_000_000 : 2_000_000, Math.floor((MAX_VIDEO_BYTES * .8 * 8 / duration) - 128000));
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: Math.max(200000, bitrate), audioBitsPerSecond: 128000 });
    const output = await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = []; let bytes = 0, settled = false;
      const timer = setTimeout(() => finish(new Error('La préparation vidéo a expiré. Gardez cet écran ouvert puis réessayez.')), (duration + 20) * 1000);
      const abort = () => finish(new DOMException('Annulé', 'AbortError'));
      const hidden = () => { if (document.hidden) finish(new Error('La préparation a été interrompue. Gardez LOBOKO au premier plan.')); };
      const stop = () => { if (recorder?.state === 'recording') recorder.stop(); };
      function finish(error?: Error, blob?: Blob) {
        if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort); document.removeEventListener('visibilitychange', hidden); cancelAnimationFrame(frame); video.pause(); stop();
        if (error) reject(error); else resolve(blob!);
      }
      recorder!.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); bytes += event.data.size; if (bytes > MAX_VIDEO_BYTES) finish(new Error('Vidéo trop volumineuse (15 Mo max). Réduisez l’extrait ou utilisez Standard.')); } };
      recorder!.onerror = () => finish(new Error('Impossible de préparer la vidéo sur cet appareil.'));
      recorder!.onstop = () => {
        const blob = new Blob(chunks, { type: recorder!.mimeType });
        if (!blob.size) finish(new Error('La vidéo préparée est vide. Réessayez.')); else finish(undefined, blob);
      };
      signal.addEventListener('abort', abort, { once: true }); document.addEventListener('visibilitychange', hidden);
      if (signal.aborted) { abort(); return; }
      const draw = () => {
        if (settled) return;
        try { renderMedia(canvas, video, video.videoWidth, video.videoHeight, edits, edits.hd ? 1920 : 1280); }
        catch { finish(new Error('Impossible d’appliquer les retouches vidéo.')); return; }
        onProgress(Math.min(1, (video.currentTime - start) / duration));
        if (video.currentTime >= end || video.ended) { stop(); return; }
        frame = requestAnimationFrame(draw);
      };
      try { recorder!.start(1000); } catch { finish(new Error('Impossible de préparer la vidéo sur cet appareil.')); return; }
      void video.play().then(draw).catch(() => finish(new Error('La lecture de la vidéo a été bloquée. Réessayez.')));
    });
    return new File([output], `${file.name.replace(/\.[^.]+$/, '')}-loboko.${output.type.startsWith('video/mp4') ? 'mp4' : 'webm'}`, { type: output.type.split(';')[0] });
  } finally {
    cancelAnimationFrame(frame); video.pause(); if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach(track => track.stop()); await audio.close().catch(() => {});
    video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
  }
}
