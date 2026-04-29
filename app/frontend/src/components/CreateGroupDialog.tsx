import { useEffect, useMemo, useState } from 'react';
import { X, Search, Camera, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/contexts/AuthContext';
import { getMediaUrl, uploadMediaEx } from '@/lib/storage-helpers';
import { createGroup } from '@/lib/group-helpers';
import { decodePayload } from '@/lib/message-format';

interface Props {
  open: boolean;
  currentUserId: string;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

interface ContactOption {
  profile: Profile;
}

function ContactRow({
  option,
  selected,
  onToggle,
}: {
  option: ContactOption;
  selected: boolean;
  onToggle: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (option.profile.avatar_key) getMediaUrl(option.profile.avatar_key).then(setUrl);
  }, [option.profile.avatar_key]);
  const name =
    option.profile.display_name || option.profile.username || 'Utilisateur';
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left ${
        selected
          ? 'bg-[rgba(37,99,235,0.2)] border border-[#2563eb]'
          : 'hover:bg-[var(--loboko-surface-hover)] border border-transparent'
      }`}
    >
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-sm shrink-0">
        {url ? (
          <img src={url} alt={name} className="w-full h-full object-cover" />
        ) : (
          name.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{name}</div>
        {option.profile.username && (
          <div className="text-xs text-[var(--loboko-text-muted)] truncate">
            @{option.profile.username}
          </div>
        )}
      </div>
      <div
        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
          selected
            ? 'bg-[#2563eb] border-[#2563eb] text-white'
            : 'border-[var(--loboko-border)]'
        }`}
      >
        {selected && <span className="text-[10px]">✓</span>}
      </div>
    </button>
  );
}

/**
 * CreateGroupDialog : nom + photo (optionnelle) + membres.
 * Les membres proposés sont ceux avec qui l'utilisateur a déjà échangé au moins
 * un message privé (condition "seulement des utilisateurs déjà en conversation"
 * du cahier des charges Phase 3 étape 1).
 */
export default function CreateGroupDialog({
  open,
  currentUserId,
  onClose,
  onCreated,
}: Props) {
  const [name, setName] = useState('');
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setQuery('');
    setSelected(new Set());
    setAvatarFile(null);
    setAvatarPreview(null);
    (async () => {
      // Load profiles I've exchanged messages with
      const { data: msgs } = await supabase
        .from('messages')
        .select('user_id, receiver_id, content')
        .or(`user_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .limit(500);
      const peerIds = new Set<string>();
      ((msgs as {
        user_id: string;
        receiver_id: string;
        content: string;
      }[]) || []).forEach((m) => {
        // Skip WebRTC signaling messages (they don't count as a real conversation).
        const p = decodePayload(m.content);
        if (p.kind === 'signal') return;
        const other = m.user_id === currentUserId ? m.receiver_id : m.user_id;
        if (other && other !== currentUserId) peerIds.add(other);
      });
      if (peerIds.size === 0) {
        setContacts([]);
        return;
      }
      const { data: profs } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', Array.from(peerIds));
      const list = ((profs as Profile[]) || []).map((p) => ({ profile: p }));
      setContacts(list);
    })();
  }, [open, currentUserId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const name = (c.profile.display_name || '').toLowerCase();
      const user = (c.profile.username || '').toLowerCase();
      return name.includes(q) || user.includes(q);
    });
  }, [contacts, query]);

  const pickAvatar = (file: File | null) => {
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Entrez un nom de groupe');
      return;
    }
    if (selected.size === 0) {
      toast.error('Sélectionnez au moins un membre');
      return;
    }
    setBusy(true);
    try {
      let avatarKey: string | null = null;
      if (avatarFile) {
        const { key, error } = await uploadMediaEx(avatarFile, 'group-avatars');
        if (error || !key) {
          toast.error(error || "Échec de l'upload de la photo");
          setBusy(false);
          return;
        }
        avatarKey = key;
      }
      const group = await createGroup({
        name: name.trim(),
        avatarKey,
        memberIds: Array.from(selected),
        creatorId: currentUserId,
      });
      toast.success('Groupe créé');
      onCreated(group.id);
      onClose();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Création impossible');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--loboko-surface)] w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-[var(--loboko-border)] p-4 shadow-xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Users size={16} /> Nouveau groupe
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <label className="relative w-16 h-16 rounded-full overflow-hidden bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] flex items-center justify-center cursor-pointer shrink-0">
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera size={20} className="text-[var(--loboko-text-muted)]" />
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickAvatar(e.target.files?.[0] || null)}
            />
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du groupe"
            maxLength={60}
            className="flex-1 px-4 py-2.5 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
          />
        </div>

        <div className="relative mb-2">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un contact"
            className="w-full pl-8 pr-3 py-2 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
          {contacts.length === 0 ? (
            <div className="text-center py-6 text-sm text-[var(--loboko-text-muted)]">
              Vous n'avez encore aucune conversation. Démarrez-en une pour pouvoir
              créer un groupe.
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-6 text-sm text-[var(--loboko-text-muted)]">
              Aucun contact
            </div>
          ) : (
            filtered.map((c) => (
              <ContactRow
                key={c.profile.user_id}
                option={c}
                selected={selected.has(c.profile.user_id)}
                onToggle={() => toggle(c.profile.user_id)}
              />
            ))
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-xs text-[var(--loboko-text-muted)]">
            {selected.size} membre{selected.size > 1 ? 's' : ''} sélectionné
            {selected.size > 1 ? 's' : ''}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim() || selected.size === 0}
            className="px-4 py-2 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50"
          >
            {busy ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}