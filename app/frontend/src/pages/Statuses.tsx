import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { Plus, Loader2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import StatusCircle from '@/components/StatusCircle';
import CreateStatusModal from '@/components/CreateStatusModal';
import StatusViewer from '@/components/StatusViewer';
import StatusViewsModal from '@/components/StatusViewsModal';
import {
  groupStatusesByAuthor,
  loadActiveStatuses,
  loadSeenStatusIds,
  StatusGroup,
  StatusWithAuthor,
} from '@/lib/status-helpers';

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

/**
 * LOBOKO Statuses / Stories page. Layout:
 *  - Top: "Mon statut" tile (always present)
 *  - Recent updates: groups with at least one unseen status
 *  - Seen updates: groups where everything has been viewed
 */
export default function StatusesPage() {
  const { user } = useAuth();
  const currentUserId = user?.id || null;
  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState<StatusWithAuthor[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  // Viewer state: groups to play, and which group to open first.
  const [viewer, setViewer] = useState<{
    groups: StatusGroup[];
    startIndex: number;
  } | null>(null);

  // Status views modal (owner-only).
  const [viewsFor, setViewsFor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadActiveStatuses();
      setAll(list);
      const ids = list.map((s) => s.id);
      const seen = await loadSeenStatusIds(ids);
      setSeenIds(seen);
    } catch (err) {
      console.error(err);
      toast.error(
        (err as Error).message ||
          "Impossible de charger les statuts. Vérifiez STATUS_SETUP.md.",
      );
      setAll([]);
      setSeenIds(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const { mine, others } = useMemo(
    () => groupStatusesByAuthor(all, seenIds, currentUserId),
    [all, seenIds, currentUserId],
  );

  const unseenOthers = others.filter((g) => !g.all_seen);
  const seenOthers = others.filter((g) => g.all_seen);

  const openGroupsFromMine = () => {
    if (!mine || mine.statuses.length === 0) {
      setCreateOpen(true);
      return;
    }
    // My statuses open alone so the user is immediately in owner-mode.
    setViewer({ groups: [mine], startIndex: 0 });
  };

  const openGroupsFromOther = (group: StatusGroup) => {
    // Build the play-list: all "others" in the current order. This keeps
    // auto-advance natural when statuses end.
    const groups = others;
    const idx = groups.findIndex((g) => g.author.user_id === group.author.user_id);
    setViewer({ groups, startIndex: Math.max(0, idx) });
  };

  const onStatusViewed = useCallback((statusId: string) => {
    setSeenIds((prev) => {
      if (prev.has(statusId)) return prev;
      const next = new Set(prev);
      next.add(statusId);
      return next;
    });
  }, []);

  const onStatusDeleted = useCallback((statusId: string) => {
    setAll((prev) => prev.filter((s) => s.id !== statusId));
  }, []);

  return (
    <Layout title="Statuts">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Statuts</h1>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold"
          >
            <Plus size={16} />
            Nouveau
          </button>
        </div>

        {/* Mon statut */}
        <button
          type="button"
          onClick={openGroupsFromMine}
          className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] hover:bg-[var(--loboko-surface-hover)] transition-all text-left"
        >
          <StatusCircle
            avatarKey={mine?.author.avatar_key || null}
            fallbackLabel={
              mine?.author.display_name || mine?.author.username || 'Moi'
            }
            hasUnseen={false}
            plus={!mine || mine.statuses.length === 0}
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Mon statut</div>
            <div className="text-xs text-[var(--loboko-text-muted)] truncate">
              {mine && mine.statuses.length > 0
                ? `${mine.statuses.length} publication${
                    mine.statuses.length > 1 ? 's' : ''
                  } • ${formatRelative(mine.last_created_at)}`
                : 'Touchez pour publier un statut'}
            </div>
          </div>
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-[var(--loboko-text-muted)]">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <>
            {unseenOthers.length > 0 && (
              <Section title="Mises à jour récentes">
                {unseenOthers.map((g) => (
                  <StatusRow
                    key={g.author.user_id}
                    group={g}
                    onClick={() => openGroupsFromOther(g)}
                  />
                ))}
              </Section>
            )}

            {seenOthers.length > 0 && (
              <Section title="Mises à jour vues">
                {seenOthers.map((g) => (
                  <StatusRow
                    key={g.author.user_id}
                    group={g}
                    onClick={() => openGroupsFromOther(g)}
                  />
                ))}
              </Section>
            )}

            {unseenOthers.length === 0 && seenOthers.length === 0 && (
              <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
                Aucun statut pour le moment.
                <br />
                Soyez le premier à en publier un !
              </div>
            )}
          </>
        )}
      </div>

      <CreateStatusModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          refresh();
        }}
      />

      {viewer && (
        <StatusViewer
          groups={viewer.groups}
          startGroupIndex={viewer.startIndex}
          currentUserId={currentUserId}
          onClose={() => setViewer(null)}
          onViewed={onStatusViewed}
          onShowViewers={(sid) => setViewsFor(sid)}
          onDeleted={onStatusDeleted}
        />
      )}

      <StatusViewsModal
        statusId={viewsFor}
        open={!!viewsFor}
        onClose={() => setViewsFor(null)}
      />
    </Layout>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--loboko-text-muted)] px-1">
        {title}
      </h2>
      <div className="rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function StatusRow({
  group,
  onClick,
}: {
  group: StatusGroup;
  onClick: () => void;
}) {
  const label =
    group.author.display_name || group.author.username || 'utilisateur';
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 hover:bg-[var(--loboko-surface-hover)] transition-all text-left"
    >
      <StatusCircle
        avatarKey={group.author.avatar_key}
        fallbackLabel={label}
        hasUnseen={!group.all_seen}
      />
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{label}</div>
        <div className="text-xs text-[var(--loboko-text-muted)] truncate flex items-center gap-1">
          <Circle size={6} className="fill-current opacity-60" />
          {group.statuses.length} • {formatRelative(group.last_created_at)}
        </div>
      </div>
    </button>
  );
}