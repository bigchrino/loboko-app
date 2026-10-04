import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Crop, RotateCw, Type, Smile, Pencil, Undo2, X, Check, Play, Pause, Volume2, VolumeX, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import type { MediaSelection } from './MediaPicker';
import { DEFAULT_EDITS, FILTERS, exportImage, exportVideo, hasVisualEdits, renderMedia, videoExportType, type MediaEdits, type Point } from '@/lib/media-editor';
import { useChatViewport } from '@/lib/use-chat-viewport';
import { formatDuration } from '@/lib/message-format';

interface Props {
  media: MediaSelection;
  initialCaption?: string;
  confirmLabel?: string;
  destination?: string;
  onClose: () => void;
  onConfirm: (file: File, caption: string, duration?: number) => Promise<void>;
}
const COLORS = ['#ffffff', '#111111', '#ef4444', '#facc15', '#22c55e', '#3b82f6'];
const STICKERS = ['❤️', '😂', '🔥', '😍', '👍', '🎉', '🙏', '💯'];
const RATIOS = [{ label: 'Original', value: null }, { label: 'Carré', value: 1 }, { label: 'Portrait', value: 4 / 5 }, { label: 'Paysage', value: 16 / 9 }];
const buttonClass = 'shrink-0 rounded-full bg-white/10 p-3 text-white disabled:opacity-40 hover:bg-white/20';

export default function MediaEditor({ media, initialCaption = '', confirmLabel = 'Envoyer', destination, onClose, onConfirm }: Props) {
  const [edits, setEdits] = useState<MediaEdits>(() => ({ ...DEFAULT_EDITS, overlays: [], strokes: [] }));
  const [tool, setTool] = useState<'crop' | 'text' | 'stickers' | 'draw' | 'filters' | null>(null);
  const [caption, setCaption] = useState(initialCaption);
  const [text, setText] = useState('');
  const [color, setColor] = useState('#ffffff');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoQuality, setVideoQuality] = useState<'original' | 'standard' | 'hd'>('original');
  const [captionFocused, setCaptionFocused] = useState(false);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(media.duration ?? 0);
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'sending'>('idle');
  const [progress, setProgress] = useState(0);
  const busy = phase !== 'idle';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const editsRef = useRef(edits);
  const confirmRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const dragRef = useRef<{ pointerId: number; overlayId?: number; strokeIndex?: number } | null>(null);
  const idRef = useRef(0);
  const video = media.kind === 'video';
  const canEdit = !video || !!videoExportType();
  const viewport = useChatViewport(true, true);
  useEffect(() => { editsRef.current = edits; }, [edits]);

  useEffect(() => {
    let cancelled = false;
    if (!video) {
      const image = new Image();
      image.onload = () => { if (!cancelled) { imageRef.current = image; setReady(true); } };
      image.onerror = () => { if (!cancelled) setFailed(true); };
      image.src = media.previewUrl;
    }
    return () => { cancelled = true; abortRef.current?.abort(); imageRef.current = null; };
  }, [media.previewUrl, video]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current; dialog?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    if (!ready || !canvasRef.current) return;
    const source = video ? videoRef.current : imageRef.current;
    if (!source) return;
    try {
      const w = video ? (source as HTMLVideoElement).videoWidth : (source as HTMLImageElement).naturalWidth;
      const h = video ? (source as HTMLVideoElement).videoHeight : (source as HTMLImageElement).naturalHeight;
      renderMedia(canvasRef.current, source, w, h, edits, 960);
    } catch { setFailed(true); }
  }, [ready, edits, video, start]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const draw = () => {
      const source = videoRef.current, canvas = canvasRef.current;
      if (!source || !canvas) return;
      renderMedia(canvas, source, source.videoWidth, source.videoHeight, editsRef.current, 960);
      if (source.currentTime >= end || source.ended) { source.pause(); setPlaying(false); return; }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [playing, end]);

  const pause = () => { videoRef.current?.pause(); setPlaying(false); };
  const changeTool = (next: typeof tool) => { pause(); setTool(tool === next ? null : next); };
  const changeGeometry = (patch: Partial<MediaEdits>) => {
    pause(); setEdits(current => ({ ...current, ...patch, overlays: [], strokes: [] }));
  };
  const addOverlay = (value: string) => {
    if (!value.trim()) return;
    if (edits.overlays.length >= 12) { toast.error('Maximum 12 textes ou stickers.'); return; }
    setEdits(current => ({ ...current, overlays: [...current.overlays, { id: ++idRef.current, text: value.trim().slice(0, 100), color, x: .5, y: .5 }] }));
    setText(''); setTool(null);
  };
  const point = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) };
  };
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!ready || busy || !canEdit) return;
    pause(); const p = point(event);
    if (tool === 'draw') {
      if (edits.strokes.length >= 100) return;
      dragRef.current = { pointerId: event.pointerId, strokeIndex: edits.strokes.length };
      setEdits(current => ({ ...current, strokes: [...current.strokes, { color, points: [p] }] }));
    } else {
      const hit = [...edits.overlays].reverse().find(item => Math.abs(item.x - p.x) < .24 && Math.abs(item.y - p.y) < .08);
      if (!hit) return;
      dragRef.current = { pointerId: event.pointerId, overlayId: hit.id };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    const p = point(event);
    setEdits(current => {
      if (drag.overlayId !== undefined) return { ...current, overlays: current.overlays.map(item => item.id === drag.overlayId ? { ...item, ...p } : item) };
      return { ...current, strokes: current.strokes.map((stroke, i) => i === drag.strokeIndex && stroke.points.length < 1200 ? { ...stroke, points: [...stroke.points, p] } : stroke) };
    });
  };
  const confirm = async () => {
    if (confirmRef.current || !ready || failed) return;
    confirmRef.current = true; pause(); setPhase('preparing'); setProgress(0);
    const abort = new AbortController(); abortRef.current = abort;
    try {
      let file = media.file;
      if (!video) file = await exportImage(imageRef.current!, media.file, edits);
      else if (hasVisualEdits(edits) || muted || start > .01 || end < (media.duration ?? end) - .01 || videoQuality !== 'original') {
        file = await exportVideo(media.file, edits, start, end, muted, abort.signal, setProgress);
      }
      if (abort.signal.aborted) return;
      setPhase('sending');
      await onConfirm(file, caption.trim(), video ? end - start : undefined);
    } catch (error) {
      if (!abort.signal.aborted) toast.error(error instanceof Error ? error.message : 'Impossible de préparer ce média.');
    } finally { confirmRef.current = false; abortRef.current = null; setPhase('idle'); }
  };
  const colors = <div className="flex items-center gap-3">{COLORS.map(value => <button key={value} type="button" aria-label={`Couleur ${value}`} aria-pressed={color === value} onClick={() => setColor(value)} className={`w-7 h-7 rounded-full border-2 ${color === value ? 'border-blue-400 ring-2 ring-blue-400' : 'border-white/30'}`} style={{ backgroundColor: value }} />)}</div>;

  return createPortal(
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Préparer la photo ou la vidéo" tabIndex={-1}
      className="fixed inset-x-0 z-[200] flex flex-col bg-[#080808] text-white overflow-hidden outline-none"
      style={{ top: viewport.panelStyle['--chat-top' as keyof typeof viewport.panelStyle], height: viewport.panelStyle['--chat-height' as keyof typeof viewport.panelStyle] }}
      onKeyDown={event => {
        if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); }
        if (event.key === 'Tab') {
          const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') ?? [])].filter(item => item.getClientRects().length > 0);
          const first = items[0], last = items[items.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <header className="shrink-0 flex items-center gap-2 px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] overflow-x-auto">
        <button type="button" className={buttonClass} aria-label="Annuler" onClick={onClose} disabled={busy}><X size={22} /></button>
        <div className="flex-1" />
        <button type="button" className={`${buttonClass} font-semibold ${edits.hd ? 'ring-2 ring-blue-500' : ''}`} aria-label={video ? 'Qualité vidéo' : 'Qualité HD'} aria-pressed={edits.hd} disabled={busy || !canEdit} onClick={() => {
          if (video) { const next = videoQuality === 'original' ? 'standard' : videoQuality === 'standard' ? 'hd' : 'original'; setVideoQuality(next); setEdits(current => ({ ...current, hd: next === 'hd' })); }
          else setEdits(current => ({ ...current, hd: !current.hd }));
        }}>{video ? (videoQuality === 'original' ? 'Orig.' : videoQuality === 'standard' ? 'SD' : 'HD') : 'HD'}</button>
        <button type="button" className={buttonClass} aria-label="Recadrer" aria-pressed={tool === 'crop'} disabled={busy || !canEdit} onClick={() => changeTool('crop')}><Crop size={21} /></button>
        <button type="button" className={buttonClass} aria-label="Stickers" aria-pressed={tool === 'stickers'} disabled={busy || !canEdit} onClick={() => changeTool('stickers')}><Smile size={21} /></button>
        <button type="button" className={buttonClass} aria-label="Ajouter du texte" aria-pressed={tool === 'text'} disabled={busy || !canEdit} onClick={() => changeTool('text')}><Type size={21} /></button>
        <button type="button" className={buttonClass} aria-label="Dessiner" aria-pressed={tool === 'draw'} disabled={busy || !canEdit} onClick={() => changeTool('draw')}><Pencil size={21} /></button>
      </header>
      <div className="min-h-0 flex-1 relative flex items-center justify-center p-3">
        {!ready && !failed && <p role="status">Chargement de l’aperçu…</p>}
        {failed && <p role="alert" className="p-4 text-center">Impossible de lire ce média. Fermez cet écran et choisissez un autre fichier.</p>}
        <canvas ref={canvasRef} aria-label="Aperçu des retouches" className={`${ready && !failed ? '' : 'hidden'} max-w-full max-h-full block touch-none`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} />
        {video && <video ref={videoRef} src={media.previewUrl} playsInline preload="auto" muted={muted} className="absolute w-px h-px opacity-0 pointer-events-none" onLoadedData={() => setReady(true)} onSeeked={() => {
          const source = videoRef.current; if (source && canvasRef.current) renderMedia(canvasRef.current, source, source.videoWidth, source.videoHeight, editsRef.current, 960);
        }} onError={() => setFailed(true)} />}
      </div>
      <div className={`${captionFocused ? 'hidden' : ''} shrink-0 max-h-[42%] overflow-y-auto px-4 pb-2 space-y-3`}>
        {canEdit && <div className="flex justify-center items-center gap-4 text-sm">
          <button type="button" disabled={busy} className="flex items-center gap-1 py-2" onClick={() => changeTool('filters')}><SlidersHorizontal size={17} /> Filtres</button>
          <span className="text-white/60">{video && videoQuality === 'original' ? 'Original' : edits.hd ? 'HD' : 'Standard'}</span>
          <button type="button" disabled={busy} aria-label="Réinitialiser les retouches" onClick={() => { pause(); setEdits({ ...DEFAULT_EDITS, overlays: [], strokes: [] }); setVideoQuality('original'); setStart(0); setEnd(media.duration ?? 0); setMuted(false); if (videoRef.current) videoRef.current.currentTime = 0; }}><Undo2 size={18} /></button>
        </div>}
        {!canEdit && video && <p className="text-xs text-white/60 text-center">Ce navigateur permet l’aperçu et la légende. Les retouches vidéo ne sont pas disponibles.</p>}
        {tool === 'filters' && <div className="flex gap-2 overflow-x-auto">{FILTERS.map(filter => <button key={filter.id} type="button" disabled={busy} className={`px-3 py-2 rounded-full text-sm whitespace-nowrap ${edits.filter === filter.id ? 'bg-blue-600' : 'bg-white/10'}`} onClick={() => setEdits(current => ({ ...current, filter: filter.id }))}>{filter.label}</button>)}</div>}
        {tool === 'crop' && <div className="space-y-2 text-sm">
          <div className="flex gap-2 flex-wrap">{RATIOS.map(ratio => <button key={ratio.label} type="button" disabled={busy} className={`px-3 py-2 rounded-full ${edits.ratio === ratio.value ? 'bg-blue-600' : 'bg-white/10'}`} onClick={() => changeGeometry({ ratio: ratio.value, zoom: 1, panX: .5, panY: .5 })}>{ratio.label}</button>)}<button type="button" disabled={busy} className={buttonClass} aria-label="Tourner de 90 degrés" onClick={() => changeGeometry({ rotation: (edits.rotation + 90) % 360 })}><RotateCw size={18} /></button></div>
          <label className="flex gap-3 items-center">Zoom<input aria-label="Zoom du recadrage" type="range" min="1" max="3" step="0.05" value={edits.zoom} disabled={busy} onChange={e => changeGeometry({ zoom: +e.target.value })} className="flex-1" /></label>
          <label className="flex gap-3 items-center">Horizontal<input type="range" min="0" max="1" step="0.01" value={edits.panX} disabled={busy} onChange={e => changeGeometry({ panX: +e.target.value })} className="flex-1" /></label>
          <label className="flex gap-3 items-center">Vertical<input type="range" min="0" max="1" step="0.01" value={edits.panY} disabled={busy} onChange={e => changeGeometry({ panY: +e.target.value })} className="flex-1" /></label>
          {(edits.overlays.length > 0 || edits.strokes.length > 0) && <p className="text-xs text-white/60">Changer le cadrage efface les annotations. Recadrez d’abord.</p>}
        </div>}
        {tool === 'text' && <div className="space-y-3">{colors}<form className="flex gap-2" onSubmit={e => { e.preventDefault(); addOverlay(text); }}><input aria-label="Texte sur le média" placeholder="Écrivez votre texte" value={text} maxLength={100} disabled={busy} onChange={e => setText(e.target.value)} className="min-w-0 flex-1 text-base bg-white/10 rounded-xl px-3 py-2" /><button type="submit" aria-label="Ajouter le texte" disabled={busy || !text.trim()} className={buttonClass}><Check size={20} /></button></form></div>}
        {tool === 'stickers' && <div className="flex gap-3 flex-wrap justify-center">{STICKERS.map(sticker => <button type="button" key={sticker} aria-label={`Sticker ${sticker}`} className="text-3xl p-1" disabled={busy} onClick={() => addOverlay(sticker)}>{sticker}</button>)}</div>}
        {tool === 'draw' && <div className="flex items-center justify-between">{colors}<button type="button" className={buttonClass} aria-label="Annuler le dernier trait" disabled={busy || !edits.strokes.length} onClick={() => setEdits(current => ({ ...current, strokes: current.strokes.slice(0, -1) }))}><Undo2 size={18} /></button></div>}
        {edits.overlays.length > 0 && <div className="flex gap-2 overflow-x-auto">{edits.overlays.map(item => <button type="button" key={item.id} disabled={busy} aria-label={`Retirer ${item.text}`} onClick={() => setEdits(current => ({ ...current, overlays: current.overlays.filter(overlay => overlay.id !== item.id) }))} className="text-xs whitespace-nowrap rounded-full bg-white/10 px-2 py-1">{item.text.slice(0, 18)} ×</button>)}<p className="text-xs text-white/60 whitespace-nowrap self-center">Glissez les textes et stickers sur l’image.</p></div>}
        {video && <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3"><button type="button" className={buttonClass} disabled={!ready || busy || failed} aria-label={playing ? 'Pause' : 'Lire l’extrait'} onClick={() => {
            const source = videoRef.current; if (!source) return;
            if (playing) pause(); else { if (source.currentTime < start || source.currentTime >= end) source.currentTime = start; void source.play().then(() => setPlaying(true)).catch(() => toast.error('Impossible de lire cette vidéo.')); }
          }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button><span>{formatDuration(start)} — {formatDuration(end)}</span><button type="button" disabled={busy || !canEdit} className={buttonClass} aria-label={muted ? 'Rétablir le son' : 'Couper le son'} aria-pressed={muted} onClick={() => setMuted(value => !value)}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button></div>
          {canEdit && <><label className="flex items-center gap-3">Début<input type="range" min="0" max={Math.max(0, end - Math.min(.5, media.duration ?? .5))} step="0.1" value={start} disabled={busy} onChange={e => { pause(); setStart(+e.target.value); if (videoRef.current) videoRef.current.currentTime = +e.target.value; }} className="flex-1" /></label><label className="flex items-center gap-3">Fin<input type="range" min={start + Math.min(.5, media.duration ?? .5)} max={media.duration} step="0.1" value={end} disabled={busy} onChange={e => { pause(); setEnd(+e.target.value); }} className="flex-1" /></label></>}
        </div>}
      </div>
      <footer className="shrink-0 px-4 pt-2 space-y-3" style={viewport.composerStyle}>
        <textarea aria-label="Légende" placeholder="Ajouter une légende…" value={caption} maxLength={2000} rows={1} onFocus={() => setCaptionFocused(true)} onBlur={() => setCaptionFocused(false)} disabled={busy} onChange={e => setCaption(e.target.value)} className="w-full text-base rounded-3xl border border-white/25 bg-transparent px-4 py-3 resize-none focus:outline-none focus:border-blue-500" />
        <div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate text-sm text-white/70">{destination ?? 'LOBOKO'}</span><button type="button" onClick={confirm} disabled={busy || !ready || failed} className="flex items-center gap-2 px-5 py-3 rounded-full bg-blue-600 font-semibold disabled:opacity-50"><Check size={20} />{phase === 'preparing' ? (video ? `Préparation ${Math.round(progress * 100)} %` : 'Préparation…') : phase === 'sending' ? 'Envoi…' : confirmLabel}</button></div>
        {phase === 'preparing' && video && <div className="flex justify-between text-xs text-white/60"><span>Gardez cet écran ouvert pendant la préparation.</span><button type="button" onClick={() => abortRef.current?.abort()}>Annuler</button></div>}
      </footer>
    </div>, document.body,
  );
}
