import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ProviderProfile {
  user_id: string;
  username?: string;
  display_name?: string;
  metier?: string;
}

export default function ServiceOrder() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProvider = async () => {
      if (!userId) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, metier')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error(error);
        return;
      }

      setProvider(data as ProviderProfile | null);
    };

    loadProvider();
  }, [userId]);

  const submitOrder = async () => {
    if (!user?.id) {
      toast.error('Vous devez être connecté');
      return;
    }

    if (!userId) {
      toast.error('Prestataire introuvable');
      return;
    }

    if (!description.trim()) {
      toast.error('Ajoutez une description');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('service_orders').insert({
        client_id: user.id,
        prestataire_id: userId,
        provider_id: userId,
        title: description.trim().slice(0, 80),
        description: description.trim(),
        proposed_budget: budget ? Number(budget) : null,
        status: 'requested',
        payment_status: 'pending',
      });

      if (error) throw error;

      toast.success('Commande envoyée');
      navigate('/my-orders');
    } catch (e: any) {
      console.error(e);
    
      toast.error(
        e?.message ||
        e?.error_description ||
        "Impossible d'envoyer la commande"
      );
    } finally {
      setLoading(false);
    }
  };

  const providerName =
    provider?.display_name || provider?.username || 'Prestataire';

  return (
    <Layout title="Commander un service">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm mb-4"
      >
        <ArrowLeft size={16} />
        Retour
      </button>

      <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4">
        <h2 className="text-xl font-bold mb-2">Nouvelle commande</h2>

        <p className="text-sm text-[var(--loboko-text-muted)] mb-4">
          Prestataire : {providerName}
          {provider?.metier ? ` · ${provider.metier}` : ''}
        </p >

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">
              Description du besoin
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 p-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] min-h-[120px] outline-none"
              placeholder="Expliquez votre besoin..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Budget proposé
            </label>

            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full mt-1 p-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] outline-none"
              placeholder="Ex: 50"
            />
          </div>

          <button
            onClick={submitOrder}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold disabled:opacity-50"
          >
            {loading ? 'Envoi...' : 'Envoyer la commande'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
