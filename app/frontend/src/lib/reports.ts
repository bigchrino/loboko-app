import { supabase } from '@/lib/supabase';

/**
 * Reports helpers.
 *
 * A report can target:
 *  - another user (reported_user_id)
 *  - a message (reported_message_id)
 *  - a post / status (reported_post_id)
 *
 * RLS enforces:
 *  - any authenticated user can INSERT when `reporter_id = auth.uid()`
 *  - users SELECT only their own reports
 *  - admins (profiles.is_admin = true) SELECT / UPDATE all
 *
 * Reports survive the deletion of their target on purpose — moderators
 * still need to be able to review historical signals.
 */

export type ReportReason =
  | 'inappropriate'
  | 'scam'
  | 'spam'
  | 'harassment'
  | 'other';

export type ReportStatus = 'pending' | 'reviewed' | 'resolved';

export interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_message_id: string | null;
  reported_post_id: string | null;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  created_at: string;
  reviewed_at: string | null;
}

export interface CreateReportInput {
  reason: ReportReason;
  description?: string;
  reportedUserId?: string;
  reportedMessageId?: string;
  reportedPostId?: string;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  inappropriate: 'Contenu inapproprié',
  scam: 'Arnaque / fraude',
  spam: 'Spam',
  harassment: 'Harcèlement',
  other: 'Autre',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'En attente',
  reviewed: 'En cours',
  resolved: 'Résolu',
};

/** Submit a new report. Returns `{ ok: true }` on success.
 *
 * Spam prevention is enforced at the DB level by a unique index on
 * `(reporter_id, target_type, target_id)`. A second call for the same
 * target returns Postgres duplicate-key error `23505`, which we map to
 * a friendly "déjà signalé" message so the UI can stay idempotent.
 */
export async function createReport(
  reporterId: string,
  input: CreateReportInput,
): Promise<{ ok: boolean; error?: string; alreadyReported?: boolean }> {
  if (!reporterId) return { ok: false, error: 'Utilisateur non connecté' };

  const targets = [
    input.reportedUserId,
    input.reportedMessageId,
    input.reportedPostId,
  ].filter(Boolean);
  if (targets.length === 0) {
    return { ok: false, error: 'Cible du signalement manquante' };
  }
  if (targets.length > 1) {
    return {
      ok: false,
      error: 'Un signalement ne peut cibler qu’un seul élément à la fois',
    };
  }

  try {
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_user_id: input.reportedUserId ?? null,
      reported_message_id: input.reportedMessageId ?? null,
      reported_post_id: input.reportedPostId ?? null,
      reason: input.reason,
      description: input.description?.trim() || null,
    });
    if (error) {
      // 23505 = unique_violation => already reported by this user.
      const code = (error as { code?: string }).code;
      if (code === '23505') {
        return {
          ok: false,
          alreadyReported: true,
          error: 'Vous avez déjà signalé cet élément',
        };
      }
      console.error('createReport error', error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error('createReport exception', e);
    return { ok: false, error: 'Erreur réseau' };
  }
}

/** Admin — fetch every report, newest first. */
export async function fetchAllReports(
  status?: ReportStatus,
): Promise<ReportRow[]> {
  try {
    let q = supabase.from('reports').select('*');
    if (status) q = q.eq('status', status);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) {
      console.error('fetchAllReports error', error);
      return [];
    }
    return (data as ReportRow[]) || [];
  } catch (e) {
    console.error('fetchAllReports exception', e);
    return [];
  }
}

/** Admin — update a report's status. */
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('reports')
      .update({
        status,
        reviewed_at: status === 'pending' ? null : new Date().toISOString(),
      })
      .eq('id', reportId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    console.error('updateReportStatus exception', e);
    return { ok: false, error: 'Erreur réseau' };
  }
}

export async function suspendUser(
  targetUserId: string,
  adminId: string,
  days: number,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const until = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await supabase
      .from('profiles')
      .update({
        suspended: true,
        suspended_until: until,
        suspended_reason: reason,
      })
      .eq('user_id', targetUserId);

    if (error) return { ok: false, error: error.message };

    await supabase.from('admin_actions').insert({
      admin_id: adminId,
      target_user_id: targetUserId,
      action_type: `suspend_${days}_days`,
      reason,
    });

    return { ok: true };
  } catch (e) {
    console.error('suspendUser error', e);
    return { ok: false, error: 'Erreur réseau' };
  }
}

export async function unsuspendUser(
  targetUserId: string,
  adminId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        suspended: false,
        suspended_until: null,
        suspended_reason: null,
      })
      .eq('user_id', targetUserId);

    if (error) return { ok: false, error: error.message };

    await supabase.from('admin_actions').insert({
      admin_id: adminId,
      target_user_id: targetUserId,
      action_type: 'unsuspend',
      reason: 'Suspension annulée',
    });

    return { ok: true };
  } catch (e) {
    console.error('unsuspendUser error', e);
    return { ok: false, error: 'Erreur réseau' };
  }
}

export async function banUser(
  targetUserId: string,
  adminId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        banned: true,
        banned_reason: reason,
      })
      .eq('user_id', targetUserId);

    if (error) return { ok: false, error: error.message };

    await supabase.from('admin_actions').insert({
      admin_id: adminId,
      target_user_id: targetUserId,
      action_type: 'ban',
      reason,
    });

    return { ok: true };
  } catch (e) {
    console.error('banUser error', e);
    return { ok: false, error: 'Erreur réseau' };
  }
}
