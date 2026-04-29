import { useEffect, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getMediaUrl, uploadMedia } from '@/lib/storage-helpers';
import { Camera, Edit2, Save, X, Star } from 'lucide-react';
import { toast } from 'sonner';
import PostCard, { PostItem } from '@/components/PostCard';
import { fetchRatingSummary, RatingSummary } from '@/lib/ratings';

export default function Profile() {
  const { profile, user, updateLobokoProfile } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [metier, setMetier] = useState('');
  const [myPosts, setMyPosts] = useState<PostItem[]>([]);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary>({ average: 0, count: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const userId = user?.id || '';

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setMetier(profile.metier || '');
      if (profile.avatar_key) getMediaUrl(profile.avatar_key).then(setAvatarUrl);
      else setAvatarUrl(null);
    }
  }, [profile]);

  useEffect(() => {
    (async () => {
      if (!userId) return;
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setMyPosts((data as PostItem[]) || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [userId, profile?.id]);

  useEffect(() => {
    if (!userId || profile?.role !== 'prestataire') {
      setRatingSummary({ average: 0, count: 0 });
      return;
    }
    fetchRatingSummary(userId).then(setRatingSummary);
  }, [userId, profile?.role]);

  const handleAvatar = async (file: File) => {
    if (!profile) return;
    toast.loading('Upload en cours...', { id: 'avatar' });
    const key = await uploadMedia(file, 'avatars');
    if (!key) {
      toast.error('Upload échoué', { id: 'avatar' });
      return;
    }
    try {
      await updateLobokoProfile({ avatar_key: key });
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
      await updateLobokoProfile({ display_name: displayName, bio, metier });
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
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#2563eb] text-white flex items-center justify-center border-2 border-[var(--loboko-surface)]"
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
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold capitalize">
                {profile.role}
              </span>
            </div>
            <div className="text-sm text-[var(--loboko-text-muted)]">@{profile.username}</div>
            {user?.email && (
              <div className="text-xs text-[var(--loboko-text-muted)] mt-0.5">{user.email}</div>
            )}
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
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">Métier</label>
              <input
                value={metier}
                onChange={(e) => setMetier(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb] resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50"
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
              <div className="text-sm text-[#2563eb] font-medium mb-2">{profile.metier}</div>
            )}
            {profile.bio && (
              <p className="text-sm text-[var(--loboko-text-secondary)] whitespace-pre-wrap mb-3">
                {profile.bio}
              </p>
            )}
            {profile.role === 'prestataire' && (
              <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] w-fit">
                <Star size={16} fill="#f59e0b" color="#f59e0b" />
                {ratingSummary.count > 0 ? (
                  <span className="text-sm">
                    <span className="font-bold">{ratingSummary.average.toFixed(1)}</span>
                    <span className="text-[var(--loboko-text-muted)]">/5 · {ratingSummary.count} avis</span>
                  </span>
                ) : (
                  <span className="text-sm text-[var(--loboko-text-muted)]">Aucun avis</span>
                )}
              </div>
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