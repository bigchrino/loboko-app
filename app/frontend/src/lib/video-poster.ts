// Small inline JPEGs travel with the existing post/message JSON. A private
// chat thumbnail therefore keeps exactly the same access as its message.
const MAX_POSTER_LENGTH = 32000;
export function validVideoPoster(value?: string): string | undefined {
  return typeof value === 'string' && value.length <= MAX_POSTER_LENGTH && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value) ? value : undefined;
}

export function captureVideoPoster(video: HTMLVideoElement): string | undefined {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return undefined;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    for (const quality of [.7, .5, .3]) {
      const poster = validVideoPoster(canvas.toDataURL('image/jpeg', quality));
      if (poster) return poster;
    }
  } catch { /* Cross-origin or unsupported frame: keep normal playback. */ }
  return undefined;
}

// Extract from the final file, including any video edits. Never reject an
// otherwise valid upload when the browser cannot decode a thumbnail.
export async function createFileVideoPoster(file: File): Promise<string | undefined> {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  return new Promise(resolve => {
    let finished = false;
    const timer = window.setTimeout(() => finish(), 8000);
    const finish = (poster?: string) => {
      if (finished) return; finished = true;
      window.clearTimeout(timer); video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); resolve(poster);
    };
    let target = .1;
    video.onloadedmetadata = () => {
      target = Math.min(.1, Number.isFinite(video.duration) ? video.duration / 2 : .1);
      try { video.currentTime = target; } catch { finish(); }
    };
    const capture = () => { if (!video.seeking && video.currentTime >= target - .01) { const poster = captureVideoPoster(video); if (poster) finish(poster); } };
    video.onseeked = capture; video.onloadeddata = capture; video.onerror = () => finish();
    video.src = url; video.load();
  });
}
