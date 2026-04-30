import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  isPushSupported,
  isIosStandaloneRequired,
  permissionStatus,
  isSubscribed as checkSubscribed,
  subscribeCurrentUser,
  unsubscribeCurrentUser,
} from '@/lib/push-notifications';
import {
  DEFAULT_PREFS,
  type PushPreferences,
  loadPushPreferences,
  savePushPreferences,
} from '@/lib/push-preferences';

type Status =
  | 'loading'
  | 'unsupported'
  | 'ios-pwa-required'
  | 'no-vapid'
  | 'idle-off'
  | 'idle-on'
  | 'denied'
  | 'error';

const VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || '';

export default function PushNotificationSettings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<PushPreferences>(DEFAULT_PREFS);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!isPushSupported()) {
      if (isIosStandaloneRequired()) setStatus('ios-pwa-required');
      else setStatus('unsupported');
      return;
    }
    if (!VAPID) {
      setStatus('no-vapid');
      return;
    }
    const perm = permissionStatus();
    if (perm === 'denied') {
      setStatus('denied');
      return;
    }
    const subscribed = await checkSubscribed();
    setStatus(subscribed && perm === 'granted' ? 'idle-on' : 'idle-off');
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const p = await loadPushPreferences(user.id);
      setPrefs(p);
    })();
  }, [user?.id]);

  const handleEnable = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await subscribeCurrentUser();
      if (res.ok) {
        setStatus('idle-on');
      } else {
        if (res.reason === 'denied') setStatus('denied');
        else if (res.reason === 'no-vapid') setStatus('no-vapid');
        else if (res.reason === 'unsupported') setStatus('unsupported');
        else {
          setStatus('error');
          setErrorMsg("Impossible d'activer les notifications pour le moment.");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await unsubscribeCurrentUser();
      setStatus('idle-off');
    } finally {
      setBusy(false);
    }
  };

  const togglePref = async (key: keyof PushPreferences) => {
    if (!user?.id) return;
    const next: PushPreferences = { ...prefs, [key]: !prefs[key] };
    // mutual exclusion: if groups_enabled is off, mentions_only becomes meaningless
    if (key === 'groups_enabled' && !next.groups_enabled) {
      next.mentions_only = false;
    }
    setPrefs(next);
    await savePushPreferences(user.id, next);
  };

  const showToggles = status === 'idle-on';

  return (
    <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden">
      <div className="px-4 py-4 flex items-center gap-3 border-b border-[var(--loboko-border)]">
        {status === 'idle-on' ? (
          <Bell size={18} className="text-[#2563eb]" />
        ) : (
          <BellOff size={18} className="text-[var(--loboko-text-muted)]" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Notifications push</div>
          <div className="text-xs text-[var(--loboko-text-muted)]">
            {statusLabel(status)}
          </div>
        </div>
        {status === 'idle-off' && (
          <button
            onClick={handleEnable}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-full bg-[#2563eb] text-white font-semibold disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : 'Activer'}
          </button>
        )}
        {status === 'idle-on' && (
          <button
            onClick={handleDisable}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-full bg-[var(--loboko-surface-hover)] border border-[var(--loboko-border)] text-[var(--loboko-text)] disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : 'Désactiver'}
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="px-4 py-3 text-xs text-red-400 flex items-center gap-2 border-b border-[var(--loboko-border)]">
          <AlertCircle size={14} /> {errorMsg}
        </div>
      )}

      {showToggles && (
        <div className="divide-y divide-[var(--loboko-border)]">
          <ToggleRow
            label="Messages privés"
            value={prefs.dm_enabled}
            onChange={() => togglePref('dm_enabled')}
          />
          <ToggleRow
            label="Messages de groupe"
            value={prefs.groups_enabled}
            onChange={() => togglePref('groups_enabled')}
          />
          <ToggleRow
            label="Groupes : mentions uniquement"
            value={prefs.mentions_only}
            onChange={() => togglePref('mentions_only')}
            disabled={!prefs.groups_enabled}
          />
        </div>
      )}

      {status === 'ios-pwa-required' && (
        <div className="px-4 py-3 text-xs text-[var(--loboko-text-muted)]">
          Sur iPhone, les notifications nécessitent d'installer LOBOKO sur
          l'écran d'accueil&nbsp;: bouton Partager → <em>Sur l'écran d'accueil</em>.
        </div>
      )}
      {status === 'unsupported' && (
        <div className="px-4 py-3 text-xs text-[var(--loboko-text-muted)]">
          Votre navigateur ne supporte pas les notifications push.
        </div>
      )}
      {status === 'no-vapid' && (
        <div className="px-4 py-3 text-xs text-[var(--loboko-text-muted)]">
          Les notifications ne sont pas encore configurées côté serveur.
        </div>
      )}
      {status === 'denied' && (
        <div className="px-4 py-3 text-xs text-[var(--loboko-text-muted)]">
          Les notifications ont été bloquées dans votre navigateur. Autorisez-les
          depuis les paramètres du site pour activer cette fonctionnalité.
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--loboko-surface-hover)]'
      }`}
    >
      <span className="flex-1 text-sm">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
          value ? 'bg-[#2563eb]' : 'bg-[var(--loboko-border)]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function statusLabel(status: Status): string {
  switch (status) {
    case 'loading':
      return 'Chargement…';
    case 'idle-on':
      return 'Activées sur cet appareil';
    case 'idle-off':
      return 'Désactivées sur cet appareil';
    case 'denied':
      return 'Bloquées par le navigateur';
    case 'unsupported':
      return 'Non supportées par ce navigateur';
    case 'ios-pwa-required':
      return "Nécessite l'installation PWA sur iOS";
    case 'no-vapid':
      return 'Configuration serveur manquante';
    case 'error':
    default:
      return 'Erreur';
  }
}