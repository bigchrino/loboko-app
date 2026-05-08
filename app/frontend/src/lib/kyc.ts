import { supabase } from '@/lib/supabase';

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export type DocumentType = 'id_card' | 'passport' | 'driver_license' | 'other';

export interface ProviderVerification {
  id: string;
  user_id: string;
  full_name: string;
  document_type: DocumentType;
  document_front_key: string;
  document_back_key?: string | null;
  selfie_key: string;
  status: VerificationStatus;
  admin_note?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at: string;
}

export async function uploadKycFile(userId: string, file: File, label: string) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${label}-${crypto.randomUUID()}.${ext}`;
  const path = `${userId}/${fileName}`;

  const { error } = await supabase.storage
    .from('kyc-documents')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw new Error(error.message);
  }

  return `kyc-documents::${path}`;
}

export async function getKycSignedUrl(key: string, expiresIn = 60) {
  const [bucket, ...rest] = key.split('::');
  const path = rest.join('::');

  if (!bucket || !path) {
    throw new Error('Clé KYC invalide');
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Impossible de générer le lien sécurisé');
  }

  return data.signedUrl;
}

export async function fetchMyVerification(userId: string) {
  const { data, error } = await supabase
    .from('provider_verifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ProviderVerification | null;
}

export async function submitProviderVerification(params: {
  userId: string;
  fullName: string;
  documentType: DocumentType;
  documentFrontKey: string;
  documentBackKey?: string | null;
  selfieKey: string;
}) {
  const { data, error } = await supabase
    .from('provider_verifications')
    .insert({
      user_id: params.userId,
      full_name: params.fullName,
      document_type: params.documentType,
      document_front_key: params.documentFrontKey,
      document_back_key: params.documentBackKey || null,
      selfie_key: params.selfieKey,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from('profiles')
    .update({
      verification_status: 'pending',
      is_verified: false,
      verified_at: null,
    })
    .eq('user_id', params.userId);

  return data as ProviderVerification;
}

export async function fetchPendingVerifications() {
  const { data, error } = await supabase
    .from('provider_verifications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ProviderVerification[];
}

export async function approveVerification(verification: ProviderVerification, adminId: string) {
  const { error: verificationError } = await supabase
    .from('provider_verifications')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      admin_note: null,
    })
    .eq('id', verification.id);

  if (verificationError) {
    throw new Error(verificationError.message);
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      is_verified: true,
      verification_status: 'approved',
      verified_at: new Date().toISOString(),
    })
    .eq('user_id', verification.user_id);

  if (profileError) {
    throw new Error(profileError.message);
  }
}

export async function rejectVerification(
  verification: ProviderVerification,
  adminId: string,
  note: string,
) {
  const { error: verificationError } = await supabase
    .from('provider_verifications')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      admin_note: note || null,
    })
    .eq('id', verification.id);

  if (verificationError) {
    throw new Error(verificationError.message);
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      is_verified: false,
      verification_status: 'rejected',
      verified_at: null,
    })
    .eq('user_id', verification.user_id);

  if (profileError) {
    throw new Error(profileError.message);
  }
}
