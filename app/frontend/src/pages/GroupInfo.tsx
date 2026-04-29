import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth, Profile } from '@/contexts/AuthContext';
import { getMediaUrl, uploadMediaEx } from '@/lib/storage-helpers';
import {
  ArrowLeft,
  Phone,
  Video,
  UserPlus,
  Link as LinkIcon,
  Image as ImageIcon,
  Search,
  LogOut,
  Flag,
  Trash2,
  Camera,
  Crown,
  Shield,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  addGroupMembers,
  Group,
  GroupMember,
  leaveGroup,
  loadGroupMessages,
  removeGroupMember,
  softDeleteGroup,
  updateGroup,
} from '@/lib/group-helpers';
import { decodePayload } from '@/lib/message-format';

interface MediaItem {
  kind: 'image' | 'video';
  objectKey: string;
  url?: string | null;
}

function MemberRow({
  profile,
  role,
  canRemove,
  canPromote,
  onRemove,
  onToggleAdmin,
}: {
  profile: Profile;
  role: 'owner' | 'admin' | 'member';
  canRemove: boolean;
  canPromote: boolean;
  onRemove: () => void;
  onToggleAdmin: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (profile.avatar_key) getMediaUrl(profile.avatar_key).then(setUrl);
  }, [profile.avatar_key]);
  const name = profile.display_name || profile.username || 'Utilisateur';
  return (
    <div className="flex items-center gap-3 px-2 py-2">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-sm shrink-0">
        {url ? (
          <img src={url} alt={name} className="w-full h-full object-cover" />
        ) : (
          name.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate flex items-center gap-1">
          {name}
          {role === 'owner' && (
            <Crown size={12} className="text-yellow-400" aria-label="Createur" />
          )}
          {role === 'admin' && (
            <Shield size={12} className="text-[#2563eb]" aria-label="Admin" />
          )}
        </div>
        {profile.username && (
          <div className="text-xs text-[var(--loboko-text-muted)] truncate">
            @{profile.username}
          </div>
        )}
      </div>
      {canPromote && (
        <button
          type="button"
          onClick={onToggleAdmin}
          className="text-xs px-2 py-1 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)]"
        >
          {role === 'admin' ? 'Retirer admin' : 'Nommer admin'}
        </button>
      )}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-full hover:bg-red-500/20 text-red-400"
          aria-label="Retirer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default function GroupInfo() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.id || '';

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberQuery, setMemberQuery] = useState('');

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<Profile[]>([]);
  const [addSelection, setAddSelection] = useState<Set<string>>(new Set());
  const [addingBusy, setAddingBusy] = useState(false);

  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<GroupMember | null>(null);
  const [busy, setBusy] = useState(false);

  const myMember = useMemo(
    () => members.find((m) => m.user_id === myId),
    [members, myId],
  );
  const isOwner = myMember?.role === 'owner';
  const isAdmin = isOwner || myMember?.role === 'admin';

  const loadAll = useCallback(async () => {
    if (!groupId || !myId) return;
    try {
      const { data: g } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();
      if (!g || (g as Group).deleted_at) {
        setGroup(null);
        setLoading(false);
        return;
      }
      const gr = g as Group;
      setGroup(gr);
      setNameDraft(gr.name);
      if (gr.avatar_key) {
        getMediaUrl(gr.avatar_key).then(setGroupAvatarUrl);
      } else {
        setGroupAvatarUrl(null);
      }

      const { data: mems } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId);
      const memberList = (mems as GroupMember[]) || [];
      setMembers(memberList);

      const userIds = Array.from(new Set(memberList.map((m) => m.user_id)));
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', userIds);
        const map: Record<string, Profile> = {};
        ((profs as Profile[]) || []).forEach((p) => (map[p.user_id] = p));
        setProfilesMap(map);
      }

      const msgs = await loadGroupMessages(groupId, 200);
      const items: MediaItem[] = [];
      msgs.forEach((m) => {
        const p = decodePayload(m.content);
        if (p.kind === 'image') {
          items.push({ kind: 'image', objectKey: p.object_key });
        } else if (p.kind === 'video') {
          items.push({ kind: 'video', objectKey: p.object_key });
        }
      });
      const limited = items.slice(0, 12);
      await Promise.all(
        limited.map(async (it) => {
          try {
            it.url = await getMediaUrl(it.objectKey);
          } catch {
            /* ignore */
          }
        }),
      );
      setMedia(limited);
    } catch (e) {
      console.error('[group-info] loadAll', e);
    } finally {
      setLoading(false);
    }
  }, [groupId, myId]);

  useEffect(() => {
    setLoading(true);
    loadAll();
  }, [loadAll]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const p = profilesMap[m.user_id];
      if (!p) return false;
      const name = (p.display_name || '').toLowerCase();
      const user = (p.username || '').toLowerCase();
      return name.includes(q) || user.includes(q);
    });
  }, [memberQuery, members, profilesMap]);

  const saveName = async () => {
    if (!groupId || !nameDraft.trim()) return;
    setSavingName(true);
    try {
      await updateGroup(groupId, { name: nameDraft.trim() });
      toast.success('Nom mis a jour');
      setEditingName(false);
      await loadAll();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    } finally {
      setSavingName(false);
    }
  };

  const changeAvatar = async (file: File | null) => {
    if (!file || !groupId) return;
    try {
      const { key, error } = await uploadMediaEx(file, 'group-avatars');
      if (error || !key) {
        toast.error(error || "Echec de l'upload");
        return;
      }
      await updateGroup(groupId, { avatar_key: key });
      toast.success('Photo mise a jour');
      await loadAll();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    }
  };

  const openAddMembers = async () => {
    if (!myId) return;
    setShowAddMembers(true);
    setAddSelection(new Set());
    const { data: msgs } = await supabase
      .from('messages')
      .select('user_id, receiver_id, content')
      .or(`user_id.eq.${myId},receiver_id.eq.${myId}`)
      .limit(500);
    const peerIds = new Set<string>();
    ((msgs as { user_id: string; receiver_id: string; content: string }[]) || []).forEach(
      (m) => {
        const p = decodePayload(m.content);
        if (p.kind === 'signal') return;
        const other = m.user_id === myId ? m.receiver_id : m.user_id;
        if (other && other !== myId) peerIds.add(other);
      },
    );
    const alreadyIn = new Set(members.map((m) => m.user_id));
    const candidates = Array.from(peerIds).filter((id) => !alreadyIn.has(id));
    if (candidates.length === 0) {
      setAvailableContacts([]);
      return;
    }
    const { data: profs } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', candidates);
    setAvailableContacts((profs as Profile[]) || []);
  };

  const confirmAddMembers = async () => {
    if (!groupId || addSelection.size === 0) return;
    setAddingBusy(true);
    try {
      await addGroupMembers(groupId, Array.from(addSelection));
      toast.success(
        `${addSelection.size} membre${addSelection.size > 1 ? 's' : ''} ajoute${
          addSelection.size > 1 ? 's' : ''
        }`,
      );
      setShowAddMembers(false);
      setAddSelection(new Set());
      await loadAll();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Ajout impossible');
    } finally {
      setAddingBusy(false);
    }
  };

  const copyInviteLink = async () => {
    if (!groupId) return;
    const url = `${window.location.origin}/messages/group/${groupId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien d'invitation copie");
    } catch {
      toast.error('Copie impossible');
    }
  };

  const toggleAdminRole = async (m: GroupMember) => {
    if (!isOwner || m.role === 'owner') return;
    try {
      const newRole = m.role === 'admin' ? 'member' : 'admin';
      const { error } = await supabase
        .from('group_members')
        .update({ role: newRole })
        .eq('id', m.id);
      if (error) throw error;
      toast.success(newRole === 'admin' ? 'Promu admin' : 'Retrograde membre');
      await loadAll();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    }
  };

  const runLeave = async () => {
    if (!groupId || !myId) return;
    setBusy(true);
    try {
      await leaveGroup(groupId, myId);
      toast.success('Vous avez quitte le groupe');
      navigate('/messages');
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    } finally {
      setBusy(false);
      setConfirmLeave(false);
    }
  };

  const runDeleteGroup = async () => {
    if (!groupId) return;
    setBusy(true);
    try {
      await softDeleteGroup(groupId);
      toast.success('Groupe supprime');
      navigate('/messages');
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const runRemoveMember = async () => {
    if (!groupId || !confirmRemove) return;
    setBusy(true);
    try {
      await removeGroupMember(groupId, confirmRemove.user_id);
      toast.success('Membre retire');
      await loadAll();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    } finally {
      setBusy(false);
      setConfirmRemove(null);
    }
  };

  const report = async () => {
    if (!groupId || !myId) return;
    try {
      if (group) {
        const { error } = await supabase.from('user_reports').insert({
          reporter_id: myId,
          reported_id: group.created_by,
          reason: `group_report:${groupId}`,
        });
        if (error) throw error;
      }
      toast.success('Groupe signale');
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    }
  };

  if (loading) {
    return (
      <Layout title="Infos du groupe">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout title="Infos du groupe">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Groupe introuvable.
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Infos du groupe">
      <div className="max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
        >
          <ArrowLeft size={16} />
          Retour
        </button>

        <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-6 flex flex-col items-center text-center">
          <label
            className={`relative w-28 h-28 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-3xl ${
              isAdmin ? 'cursor-pointer' : ''
            }`}
          >
            {groupAvatarUrl ? (
              <img
                src={groupAvatarUrl}
                alt={group.name}
                className="w-full h-full object-cover"
              />
            ) : (
              group.name.slice(0, 2).toUpperCase()
            )}
            {isAdmin && (
              <>
                <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition">
                  <Camera size={22} />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => changeAvatar(e.target.files?.[0] || null)}
                />
              </>
            )}
          </label>
          {editingName ? (
            <div className="mt-3 flex items-center gap-2 w-full max-w-xs">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
              />
              <button
                type="button"
                onClick={saveName}
                disabled={savingName || !nameDraft.trim()}
                className="px-3 py-1.5 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white text-xs font-semibold disabled:opacity-50"
              >
                {savingName ? '...' : 'OK'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingName(false);
                  setNameDraft(group.name);
                }}
                className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setEditingName(true)}
              className={`mt-3 font-semibold text-lg ${
                isAdmin ? 'hover:underline' : ''
              }`}
            >
              {group.name}
            </button>
          )}
          <div className="text-xs text-[var(--loboko-text-muted)] mt-0.5">
            {members.length} membre{members.length > 1 ? 's' : ''}
          </div>

          <div className="flex items-center gap-3 mt-4 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => toast.message('Appel de groupe : bientot disponible')}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)]"
            >
              <Phone size={18} className="text-[#2563eb]" />
              <span className="text-[11px]">Audio</span>
            </button>
            <button
              type="button"
              onClick={() => toast.message('Appel de groupe : bientot disponible')}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)]"
            >
              <Video size={18} className="text-[#2563eb]" />
              <span className="text-[11px]">Video</span>
            </button>
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={openAddMembers}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)]"
                >
                  <UserPlus size={18} className="text-[#2563eb]" />
                  <span className="text-[11px]">Ajouter</span>
                </button>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)]"
                >
                  <LinkIcon size={18} className="text-[#2563eb]" />
                  <span className="text-[11px]">Inviter</span>
                </button>
              </>
            )}
          </div>
        </div>

        <section className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Membres ({members.length})</h3>
          </div>
          <div className="relative mb-2">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]"
            />
            <input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Rechercher un membre"
              className="w-full pl-8 pr-3 py-2 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
            />
          </div>
          <div className="divide-y divide-[var(--loboko-border)]">
            {filteredMembers.map((m) => {
              const p = profilesMap[m.user_id];
              if (!p) return null;
              return (
                <MemberRow
                  key={m.id}
                  profile={p}
                  role={m.role}
                  canRemove={isAdmin && m.role !== 'owner' && m.user_id !== myId}
                  canPromote={isOwner && m.role !== 'owner' && m.user_id !== myId}
                  onRemove={() => setConfirmRemove(m)}
                  onToggleAdmin={() => toggleAdminRole(m)}
                />
              );
            })}
          </div>
        </section>

        <section className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 mt-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <ImageIcon size={14} /> Medias
          </h3>
          {media.length === 0 ? (
            <div className="text-xs text-[var(--loboko-text-muted)] py-3">
              Aucun media partage dans ce groupe.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1">
              {media.map((it, i) => (
                <div
                  key={i}
                  className="aspect-square bg-[var(--loboko-elevated)] rounded-lg overflow-hidden"
                >
                  {it.url ? (
                    it.kind === 'image' ? (
                      <img
                        src={it.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={it.url}
                        className="w-full h-full object-cover"
                        muted
                      />
                    )
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-2 mt-4 overflow-hidden">
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            disabled={isOwner}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--loboko-surface-hover)] text-left disabled:opacity-40 disabled:cursor-not-allowed"
            title={isOwner ? 'Le createur ne peut pas quitter le groupe' : ''}
          >
            <LogOut size={16} className="text-red-400" />
            <span className="text-sm">Quitter le groupe</span>
          </button>
          <button
            type="button"
            onClick={report}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--loboko-surface-hover)] text-left"
          >
            <Flag size={16} className="text-orange-400" />
            <span className="text-sm">Signaler le groupe</span>
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-500/10 text-left"
            >
              <Trash2 size={16} className="text-red-400" />
              <span className="text-sm text-red-400">Supprimer le groupe</span>
            </button>
          )}
        </section>
      </div>

      {showAddMembers && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !addingBusy && setShowAddMembers(false)}
        >
          <div
            className="bg-[var(--loboko-surface)] w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-[var(--loboko-border)] p-4 shadow-xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-base">Ajouter des membres</h3>
              <button
                onClick={() => !addingBusy && setShowAddMembers(false)}
                className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
            {availableContacts.length === 0 ? (
              <div className="text-center py-6 text-sm text-[var(--loboko-text-muted)]">
                Aucun contact disponible. Les contacts doivent deja avoir
                echange des messages avec vous.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1">
                {availableContacts.map((p) => {
                  const selected = addSelection.has(p.user_id);
                  const name = p.display_name || p.username || 'Utilisateur';
                  return (
                    <button
                      key={p.user_id}
                      type="button"
                      onClick={() =>
                        setAddSelection((s) => {
                          const next = new Set(s);
                          if (next.has(p.user_id)) next.delete(p.user_id);
                          else next.add(p.user_id);
                          return next;
                        })
                      }
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left ${
                        selected
                          ? 'bg-[rgba(37,99,235,0.2)] border border-[#2563eb]'
                          : 'hover:bg-[var(--loboko-surface-hover)] border border-transparent'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-xs">
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {name}
                        </div>
                        {p.username && (
                          <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                            @{p.username}
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
                        {selected && <span className="text-[10px]">OK</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-xs text-[var(--loboko-text-muted)]">
                {addSelection.size} selectionne
                {addSelection.size > 1 ? 's' : ''}
              </div>
              <button
                type="button"
                onClick={confirmAddMembers}
                disabled={addingBusy || addSelection.size === 0}
                className="px-4 py-2 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50"
              >
                {addingBusy ? 'Ajout...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmLeave}
        title="Quitter le groupe ?"
        description="Vous ne recevrez plus les messages de ce groupe."
        confirmLabel="Quitter"
        destructive
        loading={busy}
        onConfirm={runLeave}
        onCancel={() => (busy ? undefined : setConfirmLeave(false))}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer le groupe ?"
        description="Le groupe sera supprime pour tous les membres. Action irreversible."
        confirmLabel="Supprimer"
        destructive
        loading={busy}
        onConfirm={runDeleteGroup}
        onCancel={() => (busy ? undefined : setConfirmDelete(false))}
      />

      <ConfirmDialog
        open={!!confirmRemove}
        title="Retirer ce membre ?"
        description="Le membre ne pourra plus lire les nouveaux messages du groupe."
        confirmLabel="Retirer"
        destructive
        loading={busy}
        onConfirm={runRemoveMember}
        onCancel={() => (busy ? undefined : setConfirmRemove(null))}
      />
    </Layout>
  );
}