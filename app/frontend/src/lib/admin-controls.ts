import { supabase } from '@/lib/supabase';

export type AdminAction = 'suspend' | 'unsuspend' | 'ban' | 'unban' | 'grant_admin' | 'revoke_admin'
  | 'role_approve' | 'role_reject' | 'kyc_approve' | 'kyc_reject' | 'delete_post' | 'delete_comment'
  | 'report_pending' | 'report_reviewed' | 'report_resolved';
export async function applyAdminAction(action: AdminAction, target: string, reason = '', days = 1) {
  const { error } = await supabase.rpc('admin_apply_action', {
    p_action: action, p_target: target, p_reason: reason, p_days: days,
  });
  if (error) throw error;
}
export interface AdminOverview {
  users: number; prestataires: number; admins: number; verified: number; restricted: number;
  posts: number; requests: number; pending_reports: number; pending_kyc: number; pending_roles: number;
  payments: number; disputed_payments: number;
}
export async function loadAdminOverview(): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc('admin_overview');
  if (error) throw error;
  if (!data) throw new Error('Statistiques indisponibles');
  return data as AdminOverview;
}
export const ADMIN_ACTION_LABELS: Record<string, string> = {
  profile_admin: 'Droits administrateur', profile_moderation: 'Restriction de compte',
  profile_role: 'Rôle du compte', profile_verification: 'Vérification du compte',
  delete_posts: 'Publication supprimée', delete_comments: 'Commentaire supprimé',
  reports_pending: 'Signalement rouvert', reports_reviewed: 'Signalement en cours', reports_resolved: 'Signalement résolu',
  role_change_requests_approved: 'Changement de rôle approuvé', role_change_requests_rejected: 'Changement de rôle refusé',
  provider_verifications_approved: 'KYC approuvé', provider_verifications_rejected: 'KYC refusé',
  post_hidden: 'Publication masquée', post_restored: 'Publication rétablie', comment_hidden: 'Commentaire masqué', comment_restored: 'Commentaire rétabli',
  campaign_create: 'Campagne créée', campaign_update: 'Campagne modifiée',
};
