import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import { useAuth, Profile } from '@/contexts/AuthContext';
import { Star, MessageCircle, ArrowLeft, MapPin, BadgeCheck, Briefcase } from 'lucide-react';
import StarRating from '@/components/StarRating';
import RatingModal from '@/components/RatingModal';
import PortfolioGallery from '@/components/PortfolioGallery';
import {
  fetchRatingSummary,
  fetchRatingsList,
  fetchMyRating,
  RatingRow,
  RatingSummary,
} from '@/lib/ratings';

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { profile: myProfile, user } = useAuth();

  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState<RatingSummary>({ average: 0, count: 0 });
  const [reviews, setReviews] = useState<RatingRow[]>([]);
  const [reviewers, setReviewers] = useState<Record<string, Profile>>({});
  const [myExistingRating, setMyExistingRating] = useState<RatingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: p, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      const prof = (p as Profile) || null;
      setTargetProfile(prof);
      if (prof?.avatar_key) {
        getMediaUrl(prof.avatar_key).then(setAvatarUrl);
      } else {
        setAvatarUrl(null);
      }

      const [sum, list] = await Promise.all([
        fetchRatingSummary(userId),
        fetchRatingsList(userId, 30),
      ]);
      setSummary(sum);
      setReviews(list);

      const ids = Array.from(new Set(list.map((r) => r.from_user_id)));
      if (ids.length) {
        const { data: rp } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', ids);
        const map: Record<string, Profile> = {};
        ((rp as Profile[]) || []).forEach((r) => {
          map[r.user_id] = r;
        });
        setReviewers(map);
      } else {
        setReviewers({});
      }

      if (user?.id && user.id !== userId) {
        const mine = await fetchMyRating(user.id, userId);
        setMyExistingRating(mine);
      } else {
        setMyExistingRating(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId, user?.id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <Layout title="Profil">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      </Layout>
    );
  }

  if (!targetProfile) {
    return (
      <Layout title="Profil">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Profil introuvable
        </div>
      </Layout>
    );
  }

  const name = targetProfile.display_name || targetProfile.username;
  const initials = name.slice(0, 2).toUpperCase();
  const isPrestataire = targetProfile.role === 'prestataire';
  const isSelf = user?.id === targetProfile.user_id;
  const canRate =
    isPrestataire && !isSelf && myProfile?.role === 'client' && !!user?.id;

  return (
    <Layout title="Profil">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-[var(--loboko-text-secondary)] mb-3 hover:text-[var(--loboko-text)] !bg-transparent !hover:bg-transparent"
      >
        <ArrowLeft size={16} />
        Retour
      </button>

      <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-6 mb-4">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-xl shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold truncate">{name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold capitalize">
                {targetProfile.role}
              </span>
            </div>
            <div className="text-sm text-[var(--loboko-text-muted)]">
              @{targetProfile.username}
            </div>
            {targetProfile.metier && (
              <div className="text-sm text-[#2563eb] font-medium mt-1">
                {targetProfile.metier}
              </div>
            )}
          </div>
        </div>

        {isPrestataire && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div
              className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl border text-xs font-semibold ${
                (targetProfile.availability_status || 'available') === 'available'
                  ? 'bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.45)] text-[#22c55e]'
                  : 'bg-[rgba(239,68,68,0.12)] border-[rgba(239,68,68,0.45)] text-[#ef4444]'
              }`}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  (targetProfile.availability_status || 'available') === 'available'
                    ? 'bg-[#22c55e]'
                    : 'bg-[#ef4444]'
                }`}
              />
              {(targetProfile.availability_status || 'available') === 'available'
                ? 'Disponible'
                : 'Indisponible'}
            </div>
            {targetProfile.city && (
              <div className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-xs">
                <MapPin size={12} className="text-[var(--loboko-text-muted)]" />
                {targetProfile.city}
              </div>
            )}
            <div className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-xs">
              <Briefcase size={12} className="text-[var(--loboko-text-muted)]" />
              {targetProfile.completed_jobs_count || 0} mission
              {(targetProfile.completed_jobs_count || 0) !== 1 ? 's' : ''}
            </div>
            {targetProfile.is_verified && (
              <div className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-[rgba(37,99,235,0.15)] border border-[rgba(37,99,235,0.45)] text-[#60a5fa] text-xs font-semibold">
                <BadgeCheck size={13} />
                Vérifié
              </div>
            )}
          </div>
        )}

        {targetProfile.bio && (
          <p className="text-sm text-[var(--loboko-text-secondary)] whitespace-pre-wrap mb-4">
            {targetProfile.bio}
          </p>
        )}

        {isPrestataire && (
          <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)]">
            <Star size={22} fill="#f59e0b" color="#f59e0b" />
            <div className="flex-1">
              {summary.count > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold">
                    {summary.average.toFixed(1)}
                  </span>
                  <span className="text-xs text-[var(--loboko-text-muted)]">/ 5</span>
                  <span className="text-xs text-[var(--loboko-text-muted)]">·</span>
                  <span className="text-xs text-[var(--loboko-text-secondary)]">
                    {summary.count} avis
                  </span>
                </div>
              ) : (
                <span className="text-sm text-[var(--loboko-text-muted)]">
                  Aucun avis pour le moment
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {!isSelf && (
            <button
              onClick={() =>
                navigate(`/messages?to=${encodeURIComponent(targetProfile.user_id)}`)
              }
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold text-sm hover:bg-[#2563eb] hover:text-white transition"
            >
              <MessageCircle size={16} />
              Message
            </button>
          )}
          {canRate && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex-1 min-w-[160px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white font-semibold text-sm"
            >
              <Star size={16} fill="white" />
              {myExistingRating ? 'Modifier ma note' : 'Noter ce prestataire'}
            </button>
          )}
        </div>
      </div>

      {isPrestataire && targetProfile.user_id && (
        <PortfolioGallery userId={targetProfile.user_id} />
      )}

      {isPrestataire && (
        <>
          <h3 className="text-lg font-bold mb-3">Avis ({summary.count})</h3>
          {reviews.length === 0 ? (
            <div className="text-center py-8 text-sm text-[var(--loboko-text-muted)] bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
              Aucun avis pour le moment
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => {
                const rp = reviewers[r.from_user_id];
                const rname = rp?.display_name || rp?.username || 'Utilisateur';
                const rinit = rname.slice(0, 2).toUpperCase();
                return (
                  <div
                    key={r.id}
                    className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {rinit}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{rname}</div>
                        <div className="flex items-center gap-2">
                          <StarRating value={r.rating} size={12} />
                          <span className="text-[10px] text-[var(--loboko-text-muted)]">
                            {new Date(r.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    {r.comment && (
                      <p className="text-sm text-[var(--loboko-text-secondary)] whitespace-pre-wrap">
                        {r.comment}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {canRate && user?.id && (
        <RatingModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          fromUserId={user.id}
          toUserId={targetProfile.user_id}
          toUserName={name}
          onSubmitted={loadAll}
        />
      )}
    </Layout>
  );
}