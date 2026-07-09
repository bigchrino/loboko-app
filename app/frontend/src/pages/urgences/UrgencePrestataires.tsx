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
import { Profile } from '@/contexts/AuthContext';

export default function UrgencePrestataires() {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [commune, setCommune] = useState('');
  const navigate = useNavigate();

  const [providers, setProviders] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const provinces = getProvinceNames();
  const cities = getCitiesByProvince(province);
  const communes = getCommunesByCity(province, city);
  const searchProviders = async () => {
    if (!serviceId || !province || !city || !commune) return;
  
    setLoading(true);
    setSearched(true);
  
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'prestataire')
        .eq('service_id', serviceId)
        .eq('availability_status', 'available')
        .eq('province', province)
        .eq('city', city)
        .eq('commune', commune)
        .eq('banned', false)
        .eq('suspended', false)
        .order('completed_jobs_count', { ascending: false });
  
      if (error) throw error;
  
      setProviders((data as Profile[]) || []);
    } catch (e) {
      console.error(e);
      setProviders([]);
    } finally {
      setLoading(false);
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
              Ville
            </label>

            <select
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setCommune('');
              }}
              disabled={!province}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm"
            >
              <option value="">Choisir une ville</option>

              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">
              Commune
            </label>

            <select
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              disabled={!city}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm"
            >
              <option value="">Choisir une commune</option>

              {communes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={searchProviders}
            disabled={!serviceId || !province || !city || !commune}
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
              Aucun prestataire disponible dans cette commune pour ce service.
            </div>
          )}
          
          {providers.length > 0 && (
            <div className="space-y-3">
              {providers.map((p) => {
                const name = p.display_name || p.username;
          
                return (
                  <div
                    key={p.user_id}
                    className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4"
                  >
                    <div className="font-semibold">
                      {name}
                    </div>
          
                    <div className="text-xs text-[#2563eb] font-medium">
                      {p.metier}
                    </div>
          
                    <div className="text-xs text-[var(--loboko-text-muted)] mt-1">
                      📍 {[p.commune, p.city].filter(Boolean).join(' • ')}
                    </div>
          
                    <button
                      onClick={() => navigate(`/messages?to=${encodeURIComponent(p.user_id)}`)}
                      className="mt-3 w-full py-2.5 rounded-xl bg-red-600 text-white font-semibold"
                    >
                      Contacter maintenant
                    </button>
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
