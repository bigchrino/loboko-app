import { useRef, useState } from 'react';
import { Image as ImageIcon, Send, X } from 'lucide-react';
import { client } from '@/lib/atoms-client';
import { uploadMedia } from '@/lib/storage-helpers';
import { toast } from 'sonner';

interface Props {
  onPosted: () => void;
}

export default function ComposePost({ onPosted }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const resetImage = () => {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    if (!content.trim() && !file) {
      toast.error('Ajoutez du texte ou une image');
      return;
    }
    setLoading(true);
    try {
      let image_key: string | undefined;
      if (file) {
        const key = await uploadMedia(file, 'posts');
        if (key) image_key = key;
      }
      await client.entities.posts.create({
        data: {
          content: content.trim(),
          image_key: image_key || '',
          likes_count: 0,
          comments_count: 0,
          shares_count: 0,
        },
      });
      setContent('');
      resetImage();
      toast.success('Publication partagée !');
      onPosted();
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de la publication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 mb-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Quoi de neuf, LOBOKO ?"
        rows={3}
        className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-[var(--loboko-text-muted)]"
      />
      {preview && (
        <div className="relative mt-2 rounded-xl overflow-hidden border border-[var(--loboko-border)]">
          <img src={preview} alt="preview" className="w-full max-h-80 object-cover" />
          <button
            onClick={resetImage}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--loboko-border)]">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 rounded-full text-[#2563eb] hover:bg-[rgba(37,99,235,0.15)] transition text-sm font-medium"
        >
          <ImageIcon size={18} />
          Image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <button
          onClick={submit}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition"
        >
          <Send size={16} />
          {loading ? 'Envoi...' : 'Publier'}
        </button>
      </div>
    </div>
  );
}