import { useState } from 'react';
import Layout from '@/components/Layout';
import ServiceCategorySelect from '@/components/ServiceCategorySelect';
import {
  getProvinceNames,
  getCitiesByProvince,
  getCommunesByCity,
} from '@/data/rdcLocations';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Profile } from '@/contexts/AuthContext';
import {
  Coordinates,
  distanceInMeters,
  formatDistance,
  getCurrentPosition,
} from '@/lib/geo';
import { LocateFixed, MessageCircle, Send, X } from 'lucide-react';
import { toast } from 'sonner';

interface UrgenceProvider extends Profile {
  distanceMeters?: number | null;
}

export default function UrgencePrestataires() {
  const { user } = useAuth();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [commune, setCommune] = useState('');
  const navigate = useNavigate();

  // Géolocalisation (Phase 3) : quand elle est active, elle remplace la
  // zone manuelle pour la recherche — plus fiable et plus rapide qu'un
  // enchaînement de 3 sélecteurs en situation d'urgence.
  const [clientCoords, setClientCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);

  const [providers, setProviders] = useState<UrgenceProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Formulaire "demande urgente" (Phase 3 point 6) : remplace le simple
  // message par une vraie commande structurée, créée directement depuis
  // cette page — sans repasser par tous les champs déjà connus (service,
  // position) ni perdre les résultats de recherche.
  const [requestFor, setRequestFor] = useState<UrgenceProvider | null>(null);
  const [requestDescription, setRequestDescription] = useState('');
  const [requestBudget, setRequestBudget] = useState('');
  const [requestAddress, setRequestAddress] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const provinces = getProvinceNames();
  const cities = getCitiesByProvince(province);
  const communes = getCommunesByCity(province, city);

  // Il faut un service, et au moins un moyen de savoir où chercher (la
  // position GPS, ou à défaut au moins la province).
  const canSearch = !!serviceId && (!!clientCoords || !!province);

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const { coords, error } = await getCurrentPosition();
      if (!coords) {
        if (error === 'denied') {
          toast.error(
            'Localisation refusée. Choisissez votre zone manuellement ci-dessous.',
          );
        } else if (error === 'unsupported') {
          toast.error("La géolocalisation n'est pas disponible sur cet appareil.");
        } else {
          toast.error('Impossible de récupérer votre position pour le moment.');
        }
        return;
      }
      setClientCoords(coords);
    } finally {
      setLocating(false);
    }
  };

  const searchProviders = async () => {
    if (!canSearch || !serviceId) return;

    setLoading(true);
    setSearched(true);

    try {
      let q = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'prestataire')
        .eq('service_id', serviceId)
        // Les indisponibles ne sont JAMAIS affichés en urgence — on ne
        // récupère que disponibles + occupés directement depuis la base.
        .in('availability_status', ['available', 'busy'])
        .eq('banned', false)
        .eq('suspended', false);

      // Repli zone manuelle : seulement quand on n'a pas de position GPS.
      // Province obligatoire, ville/commune optionnelles pour affiner —
      // avant, les 3 étaient obligatoires, ce qui donnait trop souvent
      // "aucun résultat" en situation d'urgence.
      if (!clientCoords) {
        if (province) q = q.eq('province', province);
        if (city) q = q.eq('city', city);
        if (commune) q = q.eq('commune', commune);
      }

      const { data, error } = await q.order('completed_jobs_count', {
        ascending: false,
      });

      if (error) throw error;

      const list = ((data as Profile[]) || []).map((p) => {
        const hasBoth =
          clientCoords && p.latitude != null && p.longitude != null;
        return {
          ...p,
          distanceMeters: hasBoth
            ? distanceInMeters(clientCoords as Coordinates, {
                latitude: p.latitude as number,
                longitude: p.longitude as number,
              })
            : null,
        } as UrgenceProvider;
      });

      // Tri : disponibles d'abord, occupés ensuite. Au sein de chaque
      // groupe, le plus proche d'abord si on a une position GPS, sinon le
      // plus expérimenté (nombre de missions) comme avant.
      list.sort((a, b) => {
        const tierA = a.availability_status === 'busy' ? 1 : 0;
        const tierB = b.availability_status === 'busy' ? 1 : 0;
        if (tierA !== tierB) return tierA - tierB;

        if (clientCoords) {
          if (a.distanceMeters == null && b.distanceMeters == null) return 0;
          if (a.distanceMeters == null) return 1;
          if (b.distanceMeters == null) return -1;
          return a.distanceMeters - b.distanceMeters;
        }
        return (b.completed_jobs_count || 0) - (a.completed_jobs_count || 0);
      });

      setProviders(list);
    } catch (e) {
      console.error(e);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const openRequestForm = (p: UrgenceProvider) => {
    setRequestFor(p);
    setRequestDescription('');
    setRequestBudget('');
    setRequestAddress('');
  };

  const submitUrgentRequest = async () => {
    if (!requestFor) return;
    if (!user?.id) {
      toast.error('Vous devez être connecté');
      return;
    }
    if (!requestDescription.trim()) {
      toast.error('Décrivez rapidement votre besoin');
      return;
    }

    setSubmittingRequest(true);
    try {
      const { data, error } = await supabase
        .from('service_orders')
        .insert({
          client_id: user.id,
          prestataire_id: requestFor.user_id,
          provider_id: requestFor.user_id,
          service_id: serviceId,
          title: requestDescription.trim().slice(0, 80),
          description: requestDescription.trim(),
          proposed_budget: requestBudget ? Number(requestBudget) : null,
          address_text: requestAddress.trim() || null,
          // Réutilise la position GPS déjà connue pour la recherche —
          // pas besoin de la redemander pour une urgence.
          latitude: clientCoords?.latitude ?? null,
          longitude: clientCoords?.longitude ?? null,
          urgency_level: 'urgent',
          status: 'requested',
          payment_status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Demande urgente envoyée au prestataire');
      navigate(`/my-orders/${data.id}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Impossible d'envoyer la demande");
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <Layout title="Prestataire en urgence">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">
          Prestataire en urgence
        </h1>

        <p className="text-[var(--loboko-text-secondary)]">
          Trouvez rapidement un prestataire disponible dans votre zone.
        </p >

        <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">
              Service recherché
            </label>

            <ServiceCategorySelect
              value={serviceId}
              onChange={(id) => setServiceId(id)}
              placeholder="Choisissez un service urgent..."
            />
          </div>

          {clientCoords ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)]">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#22c55e]">
                <LocateFixed size={14} /> Recherche autour de votre position
              </span>
              <button
                type="button"
                onClick={() => setClientCoords(null)}
                className="text-xs text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] underline flex-shrink-0"
              >
                Modifier
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-semibold disabled:opacity-60"
              >
                <LocateFixed size={16} className={locating ? 'animate-pulse' : ''} />
                {locating ? 'Localisation en cours…' : 'Utiliser ma position actuelle'}
              </button>

              <div className="flex items-center gap-2 text-[11px] text-[var(--loboko-text-muted)]">
                <div className="flex-1 h-px bg-[var(--loboko-border)]" />
                ou choisissez une zone
                <div className="flex-1 h-px bg-[var(--loboko-border)]" />
              </div>

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
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm"
                >
                  <option value="">Choisir une province</option>

                  {provinces.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">
                  Ville (optionnel)
                </label>

                <select
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setCommune('');
                  }}
                  disabled={!province}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm disabled:opacity-50"
                >
                  <option value="">Toute la province</option>

                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">
                  Commune (optionnel)
                </label>

                <select
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  disabled={!city}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm disabled:opacity-50"
                >
                  <option value="">Toute la ville</option>

                  {communes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <button
            onClick={searchProviders}
            disabled={!canSearch}
            className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-50"
          >
            Rechercher maintenant
          </button>

          {loading && (
            <div className="text-center text-sm text-[var(--loboko-text-muted)]">
              Recherche en cours...
            </div>
          )}

          {searched && !loading && providers.length === 0 && (
            <div className="text-center text-sm text-[var(--loboko-text-muted)] bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4">
              Aucun prestataire disponible ou occupé pour ce service dans cette zone pour l'instant.
            </div>
          )}

          {providers.length > 0 && (
            <div className="space-y-3">
              {providers.map((p) => {
                const name = p.display_name || p.username;
                const isBusy = p.availability_status === 'busy';
                const formOpen = requestFor?.user_id === p.user_id;

                return (
                  <div
                    key={p.user_id}
                    className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold">{name}</span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          isBusy
                            ? 'bg-[rgba(249,115,22,0.15)] text-[#f97316]'
                            : 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isBusy ? 'bg-[#f97316]' : 'bg-[#22c55e]'
                          }`}
                        />
                        {isBusy ? 'Occupé' : 'Disponible'}
                      </span>
                    </div>

                    <div className="text-xs text-[#2563eb] font-medium mt-0.5">
                      {p.metier}
                    </div>

                    <div className="text-xs text-[var(--loboko-text-muted)] mt-1 flex items-center gap-2 flex-wrap">
                      {(p.commune || p.city) && (
                        <span>📍 {[p.commune, p.city].filter(Boolean).join(' • ')}</span>
                      )}
                      {p.distanceMeters != null && (
                        <span className="text-[#22c55e] font-semibold inline-flex items-center gap-0.5">
                          <LocateFixed size={10} /> {formatDistance(p.distanceMeters)}
                        </span>
                      )}
                    </div>

                    {formOpen ? (
                      <div className="mt-3 p-3 rounded-xl bg-[var(--loboko-elevated)] border border-red-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-red-500">
                            🔴 Demande urgente
                          </span>
                          <button
                            type="button"
                            onClick={() => setRequestFor(null)}
                            className="text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)]"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <textarea
                          value={requestDescription}
                          onChange={(e) => setRequestDescription(e.target.value)}
                          placeholder="Décrivez rapidement votre besoin..."
                          className="w-full min-h-[70px] p-2.5 rounded-lg bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm outline-none"
                        />

                        {!clientCoords && (
                          <input
                            type="text"
                            value={requestAddress}
                            onChange={(e) => setRequestAddress(e.target.value)}
                            placeholder="Adresse / point de repère (optionnel)"
                            className="w-full p-2.5 rounded-lg bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm outline-none"
                          />
                        )}

                        <input
                          type="number"
                          value={requestBudget}
                          onChange={(e) => setRequestBudget(e.target.value)}
                          placeholder="Budget proposé (optionnel)"
                          className="w-full p-2.5 rounded-lg bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm outline-none"
                        />

                        <button
                          onClick={submitUrgentRequest}
                          disabled={submittingRequest}
                          className="w-full py-2.5 rounded-xl bg-red-600 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Send size={14} />
                          {submittingRequest ? 'Envoi...' : "Envoyer la demande urgente"}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-1.5">
                        <button
                          onClick={() => openRequestForm(p)}
                          className="w-full py-2.5 rounded-xl bg-red-600 text-white font-semibold inline-flex items-center justify-center gap-2"
                        >
                          <Send size={14} />
                          Contacter maintenant
                        </button>
                        <button
                          onClick={() => navigate(`/messages?to=${encodeURIComponent(p.user_id)}`)}
                          className="w-full text-center text-xs text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] inline-flex items-center justify-center gap-1"
                        >
                          <MessageCircle size={12} /> Ou envoyer juste un message
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
