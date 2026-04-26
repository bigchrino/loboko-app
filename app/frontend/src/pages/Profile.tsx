import { useEffect, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { client } from '@/lib/atoms-client';
import { getMediaUrl, uploadMedia } from '@/lib/storage-helpers';
import { Camera, Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import PostCard, { PostItem } from '@/components/PostCard';

export default function Profile() {
  const { profile, user, refreshProfile } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [metier, setMetier] = useState('');
  const [myPosts, setMyPosts] = useState<PostItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const userId = (user?.id as string) || (user?.sub as string) || (user?.user_id as string) || '';

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setMetier(profile.metier || '');
      if (profile.avatar_key) getMediaUrl(profile.avatar_key).then(setAvatarUrl);
    }
  }, [profile]);

  useEffect(() => {
    (async () => {
      try {
        const res = await client.entities.posts.query({
          query: {},
          sort: '-created_at',
          limit: 50,
        });
        setMyPosts((res?.data?.items as PostItem[]) || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [profile?.id]);

  const handleAvatar = async (file: File) => {
    if (!profile) return;
    toast.loading('Upload en cours...', { id: 'avatar' });
    const key = await uploadMedia(file, 'avatars');
    if (!key) {
      toast.error('Upload échoué', { id: 'avatar' });
      return;
    }
    try {
      await client.entities.profiles.update({
        id: String(profile.id),
        data: { avatar_key: key },
      });
      await refreshProfile();
      const url = await getMediaUrl(key);
      setAvatarUrl(url);
      toast.success('Photo mise à jour', { id: 'avatar' });
    } catch (e) {
      console.error(e);
      toast.error('Erreur', { id: 'avatar' });
    }
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await client.entities.profiles.update({
        id: String(profile.id),
        data: { display_name: displayName, bio, metier },
      });
      await refreshProfile();
      toast.success('Profil mis à jour');
      setEditing(false);
    } catch (e) {
      console.error(e);
      toast.error('Erreur');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <Layout title="Profil">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">Chargement...</div>
      </Layout>
    );
  }

  const initials = (profile.display_name || profile.username).slice(0, 2).toUpperCase();

  return (
    <Layout title="Profil">
      <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-6 mb-4">
        <div className="flex items-start gap-4 mb-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] flex items-center justify-center text-white font-bold text-xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#8b5cf6] text-white flex items-center justify-center border-2 border-[var(--loboko-surface)]"
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatar(f);
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold truncate">
                {profile.display_name || profile.username}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(139,92,246,0.15)] text-[#8b5cf6] font-semibold capitalize">
                {profile.role}
              </span>
            </div>
            <div className="text-sm text-[var(--loboko-text-muted)]">@{profile.username}</div>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-2 rounded-full text-[var(--loboko-text-secondary)] hover:bg-[var(--loboko-surface-hover)]"
            >
              <Edit2 size={16} />
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">Nom complet</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#8b5cf6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">Métier</label>
              <input
                value={metier}
                onChange={(e) => setMetier(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#8b5cf6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#8b5cf6] resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white font-semibold text-sm disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl !bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-[var(--loboko-text-secondary)] font-semibold text-sm"
              >
                <X size={14} />
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <>
            {profile.metier && (
              <div className="text-sm text-[#8b5cf6] font-medium mb-2">{profile.metier}</div>
            )}
            {profile.bio && (
              <p className="text-sm text-[var(--loboko-text-secondary)] whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}
          </>
        )}
      </div>

      <h3 className="text-lg font-bold mb-3">Mes publications</h3>
      {myPosts.length === 0 ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)] bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
          Aucune publication pour l'instant
        </div>
      ) : (
        myPosts.map((p) => <PostCard key={p.id} post={p} currentUserId={userId} />)
      )}
    </Layout>
  );
}