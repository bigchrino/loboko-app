import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getMediaUrl, uploadMedia } from '@/lib/storage-helpers';
import {
  Camera,
  Edit2,
  Mail,
  Save,
  X,
  Star,
  Image as ImageIcon,
  MapPin,
  LocateFixed,
  BadgeCheck,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import PostCard, { PostItem } from '@/components/PostCard';
import { fetchRatingSummary, RatingSummary } from '@/lib/ratings';
import ServiceCategorySelect from '@/components/ServiceCategorySelect';
import {
  fetchServiceById,
  Service,
} from '@/lib/service-categories';
import PortfolioEditor from '@/components/PortfolioEditor';
import PremiumBadge from '@/components/PremiumBadge';
import { isPremium, describePremiumExpiry } from '@/lib/subscription';
import { getCurrentPosition } from '@/lib/geo';
import {
  getProvinceNames,
  getCitiesByProvince,
  getCommunesByCity,
} from '@/data/rdcLocations';

export default function Profile() {
  const navigate = useNavigate();
  const { profile, user, updateLobokoProfile } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [metier, setMetier] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [commune, setCommune] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [availability, setAvailability] =
  useState<'available' | 'busy' | 'unavailable'>('available');
  const [myPosts, setMyPosts] = useState<PostItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState(false);
  const [postsOwner, setPostsOwner] = useState('');
  const [postsReload, setPostsReload] = useState(0);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary>({ average: 0, count: 0 });
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const provinces = getProvinceNames();
  const cities = getCitiesByProvince(province);
  const communes = getCommunesByCity(province, city);

  const userId = user?.id || '';

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setMetier(profile.metier || '');
      setServiceId(profile.service_id || null);
      setCity(profile.city || '');
      setProvince(profile.province || '');
      setCommune(profile.commune || '');
      setLatitude(profile.latitude ?? null);
      setLongitude(profile.longitude ?? null);
      setAvailability(profile.availability_status || 'available');
      if (profile.avatar_key) getMediaUrl(profile.avatar_key).then(setAvatarUrl);
      else setAvatarUrl(null);
    }
  }, [profile]);

  /**
   * Capture la position GPS actuelle du prestataire, pour permettre au
   * client de voir la distance qui le sépare de lui. Ne l'enregistre pas
   * tout de suite en base : comme les autres champs de ce formulaire, elle
   * n'est sauvegardée que quand on clique sur "Enregistrer".
   */
  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const { coords, error, accuracyMeters } = await getCurrentPosition();
      if (!coords) {
        if (error === 'denied') {
          toast.error(
            "Localisation refusée. Autorisez l'accès à la position dans les réglages de votre navigateur pour l'utiliser.",
          );
        } else if (error === 'unsupported') {
          toast.error("La géolocalisation n'est pas disponible sur cet appareil.");
        } else {
          toast.error('Impossible de récupérer votre position pour le moment.');
        }
        return;
      }
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
      toast.success(accuracyMeters != null ? `Position capturée (précision ≈ ${Math.round(accuracyMeters)} m) — pensez à Enregistrer.` : 'Position capturée — pensez à Enregistrer pour la sauvegarder.');
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
  
    (async () => {
      if (!profile?.service_id) {
        setService(null);
        return;
      }
  
      const foundService = await fetchServiceById(profile.service_id);
  
      if (!cancelled) setService(foundService);
    })();
  
    return () => {
      cancelled = true;
    };
  }, [profile?.service_id]);

  useEffect(() => {
    let cancelled = false;
    setPostsOwner(userId);
    setMyPosts([]);
    setPostsError(false);
    setPostsLoading(!!userId);
    if (!userId) return;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        if (!cancelled) setMyPosts((data as PostItem[]) || []);
      } catch (error) {
        if (!cancelled) { setPostsError(true); console.error(error); }
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, profile?.id, postsReload]);

  useEffect(() => {
    if (!userId || profile?.role !== 'prestataire') {
      setRatingSummary({ average: 0, count: 0 });
      return;
    }
    fetchRatingSummary(userId).then(setRatingSummary);
  }, [userId, profile?.role]);

  const handleAvatar = async (file: File) => {
    if (!profile) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Seules les images sont acceptées pour la photo de profil.');
      return;
    }
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
    if (profile.role === 'prestataire' && !serviceId) {
      toast.error('Veuillez choisir un service officiel dans la liste');
      return;
    }
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        display_name: displayName,
        bio,
      };
      if (profile.role === 'prestataire') {
        patch.service_id = serviceId;
        patch.service_category_id = null;
        // Keep legacy metier in sync with the selected category name for
        // backward compatibility with existing UI that reads profile.metier.
        patch.metier = metier;
        patch.city = city.trim() || null;
        patch.province = province.trim() || null;
        patch.commune = commune.trim() || null;
        patch.latitude = latitude;
        patch.longitude = longitude;
        patch.availability_status = availability;
      }
      await updateLobokoProfile(patch as Partial<typeof profile>);
      toast.success('Profil mis à jour');
      setEditing(false);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      toast.error(msg);
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
  const premiumExpiry = describePremiumExpiry(profile);

  return (
    <Layout title="Profil">
      <section className="mb-6">
        <div className="flex flex-col items-center gap-4 pt-4 pb-6 text-center">
          <div className="relative shrink-0">
            <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-3xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <button
              type="button"
              onClick={() => setAvatarMenuOpen((v) => !v)}
              aria-expanded={avatarMenuOpen}
              className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center border-2 border-[var(--loboko-bg)]"
              aria-label="Modifier la photo"
            >
              <Camera size={18} />
            </button>
            {avatarMenuOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-20 bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-xl shadow-lg py-1 min-w-[180px]">
                <button
                  type="button"
                  onClick={() => {
                    setAvatarMenuOpen(false);
                    if (fileRef.current) fileRef.current.value = '';
                    fileRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--loboko-surface-hover)]"
                >
                  <ImageIcon size={14} /> Depuis la galerie
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAvatarMenuOpen(false);
                    if (cameraRef.current) cameraRef.current.value = '';
                    cameraRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--loboko-surface-hover)]"
                >
                  <Camera size={14} /> Prendre une photo
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatar(f);
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatar(f);
              }}
            />
          </div>
          <div className="w-full min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight break-words">{profile.display_name || profile.username}</h1>
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              {profile.is_admin ? (
                <span className="text-xs px-3 py-1 rounded-full bg-[rgba(147,51,234,0.18)] text-[#c084fc] font-semibold">💎 Admin</span>
              ) : (
                <span className="text-xs px-3 py-1 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold capitalize">{profile.role}</span>
              )}
              {profile.role === 'prestataire' && isPremium(profile) && <PremiumBadge variant="full" />}
            </div>
            <p className="mt-2 text-base text-[var(--loboko-text-muted)] break-words">@{profile.username}</p>
            {profile.role === 'prestataire' && premiumExpiry && <p className="text-xs text-[#f59e0b] font-semibold mt-1">{premiumExpiry}</p>}
          </div>
        </div>
        {user?.email && (
          <div className="mb-3 flex items-center justify-center gap-3 px-4 py-4 rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-elevated)]">
            <Mail size={20} className="shrink-0 text-[var(--loboko-text-muted)]" aria-hidden="true" />
            <span className="text-sm sm:text-base break-all text-[var(--loboko-text-secondary)]">{user.email}</span>
          </div>
        )}
        {profile.role === 'prestataire' && !profile.service_id && !editing && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 mb-4">
            <h2 className="font-semibold text-sm mb-2">Complétez votre service officiel</h2>
            <p className="text-sm text-[var(--loboko-text-secondary)] mb-3">
              Votre ancien métier est conservé. Choisissez le service qui correspond à votre activité pour apparaître dans les recherches de services et les suggestions.
            </p>
            <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-[#2563eb]">Choisir mon service</button>
          </div>
        )}
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="w-full flex items-center justify-center gap-3 px-4 py-4 mb-5 rounded-2xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold hover:brightness-110 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">
            <Edit2 size={20} aria-hidden="true" />Modifier mon profil
          </button>
        )}

        {editing ? (
          <div className="space-y-4 p-4 sm:p-5 rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)]">
            <div>
              <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">Nom complet</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-base focus:outline-none focus:border-[#2563eb]"
              />
            </div>
            {profile.role === 'prestataire' && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">Service *</label>
                <ServiceCategorySelect
                  value={serviceId}
                  onChange={(id, selectedService) => {
                    setServiceId(id);
                    setMetier(selectedService?.name || '');
                  }}
                  required
                  placeholder="Choisissez un service officiel…"
                  legacyMetier={profile.metier}
                />
              </div>
            )}
            {profile.role === 'prestataire' && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">
                  Province
                </label>
            
                <select
                  value={province}
                  onChange={(e) => {
                    setProvince(e.target.value);
                    setCity('');
                    setCommune('');
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-base focus:outline-none focus:border-[#2563eb]"
                >
                  <option value="">Choisir une province</option>
            
                  {provinces.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {profile.role === 'prestataire' && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">
                  Ville
                </label>
              
                <select
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setCommune('');
                  }}
                  disabled={!province}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-base focus:outline-none focus:border-[#2563eb]"
                >
                  <option value="">Choisir une ville</option>
              
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {profile.role === 'prestataire' && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">
                  Commune
                </label>
              
                <select
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  disabled={!city}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-base focus:outline-none focus:border-[#2563eb]"
                >
                  <option value="">Choisir une commune</option>
              
                  {communes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {profile.role === 'prestataire' && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">
                  Position GPS
                </label>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm font-semibold text-[var(--loboko-text)] hover:border-[#2563eb] disabled:opacity-50"
                >
                  <LocateFixed size={16} className={locating ? 'animate-pulse' : ''} />
                  {locating ? 'Localisation en cours…' : 'Utiliser ma position actuelle'}
                </button>
                <p className="mt-1.5 text-[11px] text-[var(--loboko-text-muted)]">
                  {latitude != null && longitude != null
                    ? '📍 Position enregistrée — les clients pourront voir leur distance jusqu\'à vous.'
                    : "Aucune position enregistrée pour l'instant. Sans elle, vous resterez visible mais sans distance affichée."}
                </p>
              </div>
            )}
            {profile.role === 'prestataire' && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">Disponibilité</label>
                <select
                  value={availability}
                  onChange={(e) =>
                    setAvailability(
                      e.target.value as 'available' | 'busy' | 'unavailable'
                    )
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)]"
                >
                  <option value="available">
                    🟢 Disponible
                  </option>
                
                  <option value="busy">
                    🟠 Occupé
                  </option>
                
                  <option value="unavailable">
                    🔴 Indisponible
                  </option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-base focus:outline-none focus:border-[#2563eb] resize-none"
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
            {profile.role === 'prestataire' && (service?.name || profile.metier) && (
              <div className="text-sm text-[#2563eb] font-medium mb-2 text-center">
                {service?.name || profile.metier}
                {!service && profile.metier && (
                  <span className="ml-2 text-[10px] text-[var(--loboko-text-muted)] font-normal">
                    (ancien service — à mettre à jour)
                  </span>
                )}
              </div>
            )}
            {profile.bio && (
              <p className="text-sm text-[var(--loboko-text-secondary)] whitespace-pre-wrap mb-3 text-center break-words">
                {profile.bio}
              </p>
            )}
            {profile.role === 'prestataire' && (
              <div className="flex flex-wrap items-center justify-center gap-2 mb-1">
                <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)]">
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
                <div
                  className={`flex items-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold ${
                    (profile.availability_status || 'available') === 'available'
                      ? 'bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.45)] text-[#22c55e]'
                      : (profile.availability_status || 'available') === 'busy'
                      ? 'bg-[rgba(245,158,11,0.12)] border-[rgba(245,158,11,0.45)] text-[#f59e0b]'
                      : 'bg-[rgba(239,68,68,0.12)] border-[rgba(239,68,68,0.45)] text-[#ef4444]'
                  }`}
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      (profile.availability_status || 'available') === 'available'
                        ? 'bg-[#22c55e]'
                        : (profile.availability_status || 'available') === 'busy'
                        ? 'bg-[#f59e0b]'
                        : 'bg-[#ef4444]'
                    }`}
                  />
                
                  {(profile.availability_status || 'available') === 'available'
                    ? 'Disponible'
                    : (profile.availability_status || 'available') === 'busy'
                    ? 'Occupé'
                    : 'Indisponible'}
                </div>
                {(profile.commune || profile.city || profile.province) && (
                  <div className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-xs">
                    <MapPin size={13} className="text-[var(--loboko-text-muted)]" />
                    {[profile.commune, profile.city, profile.province]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                )}
                <div className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-xs">
                  <Briefcase size={13} className="text-[var(--loboko-text-muted)]" />
                  {profile.completed_jobs_count || 0} mission
                  {(profile.completed_jobs_count || 0) !== 1 ? 's' : ''}
                </div>
                {profile.is_verified && profile.verification_status === 'approved' && (
                  <div className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-[rgba(37,99,235,0.15)] border border-[rgba(37,99,235,0.45)] text-[#60a5fa] text-xs font-semibold">
                    <BadgeCheck size={14} />
                    Vérifié
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {profile.role === 'prestataire' && userId && (
        <>
          <PortfolioEditor userId={userId} />

          <button
            type="button"
            onClick={() => navigate('/works?publish=1')}
            className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-dashed border-[#2563eb] text-sm font-semibold text-[#2563eb] hover:bg-[rgba(37,99,235,0.08)]"
          >
            <Briefcase size={16} />
            Publier une réalisation
          </button>
        </>
      )}

      <section className="border-t border-[var(--loboko-border)] pt-5" aria-labelledby="profile-posts-title">
        <h2 id="profile-posts-title" className="text-2xl font-bold mb-4">Mes publications</h2>
        {postsLoading || postsOwner !== userId ? (
          <div role="status" aria-label="Chargement de vos publications" className="space-y-3">
            {[0, 1].map((row) => <div key={row} aria-hidden="true" className="h-40 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] motion-safe:animate-pulse" />)}
          </div>
        ) : postsError ? (
          <div className="text-center py-10 px-4" role="alert">
            <p className="mb-3 text-sm text-[var(--loboko-text-muted)]">Impossible de charger vos publications.</p>
            <button type="button" onClick={() => setPostsReload((value) => value + 1)} className="rounded-full bg-[#2563eb] text-white px-5 py-2.5 text-sm font-semibold">Réessayer</button>
          </div>
        ) : myPosts.length === 0 ? (
          <div className="text-center py-10 sm:py-14 px-4">
            <ImageIcon size={44} className="mx-auto mb-5 text-[#2563eb]" aria-hidden="true" />
            <h3 className="font-semibold text-lg">Aucune publication pour l’instant</h3>
            <p className="mt-2 text-sm text-[var(--loboko-text-muted)]">Vos publications apparaîtront ici.</p>
          </div>
        ) : (
          myPosts.map((post) => <PostCard key={post.id} post={post} currentUserId={userId} />)
        )}
      </section>
    </Layout>
  );
}
