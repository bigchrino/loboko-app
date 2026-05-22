import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface Props {
  items: MediaItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export default function MediaViewer({
  items,
  index,
  onIndexChange,
  onClose,
}: Props) {
  const item = items[index];

  if (!item) return null;

  const canPrev = index > 0;
  const canNext = index < items.length - 1;

  const goPrev = () => {
    if (canPrev) onIndexChange(index - 1);
  };

  const goNext = () => {
    if (canNext) onIndexChange(index + 1);
  };

  const downloadMedia = async () => {
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
  
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
  
      a.href = blobUrl;
      a.download = item.type === 'image' ? 'loboko-image.jpg' : 'loboko-video.mp4';
      document.body.appendChild(a);
      a.click();
  
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error(e);
      window.open(item.url, '_blank');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        aria-label="Fermer"
      >
        <X size={22} />
      </button>

      {item.type === 'image' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            downloadMedia();
          }}
          className="absolute top-4 left-4 z-10 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm flex items-center gap-2"
        >
          <Download size={16} />
          Enregistrer
        </button>
      )}

      {canPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          aria-label="Précédent"
        >
          <ChevronLeft size={26} />
        </button>
      )}

      {canNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          aria-label="Suivant"
        >
          <ChevronRight size={26} />
        </button>
      )}

      <div
        className="w-full h-full flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {item.type === 'image' ? (
          <img
            src={item.url}
            alt=""
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <video
            src={item.url}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full bg-black"
          />
        )}
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white text-xs bg-white/10 px-3 py-1 rounded-full">
          {index + 1} / {items.length}
        </div>
      )}
    </div>
  );
}
