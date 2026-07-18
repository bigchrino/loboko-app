import { supabase } from './supabase';

export type EmploymentType = 'long_terme' | 'court_terme' | 'stage';

export interface JobOffer {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  employment_type: EmploymentType;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobOfferWithCompany extends JobOffer {
  company: {
    id: string;
    name: string;
    slug: string;
    color_key: string;
  };
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  long_terme: "Emploi long terme",
  court_terme: "Emploi court terme",
  stage: "Stage professionnel",
};

export async function fetchCompanyJobOffers(companyId: string): Promise<JobOffer[]> {
  try {
    const { data, error } = await supabase
      .from('job_offers')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as JobOffer[]) || [];
  } catch (e) {
    console.error('fetchCompanyJobOffers', e);
    return [];
  }
}

export async function fetchAllJobOffers(filter?: {
  employmentType?: EmploymentType | null;
  query?: string;
}): Promise<JobOfferWithCompany[]> {
  try {
    let q = supabase
      .from('job_offers')
      .select('*, companies!inner(id, name, slug, color_key)')
      .eq('is_active', true);

    if (filter?.employmentType) {
      q = q.eq('employment_type', filter.employmentType);
    }
    if (filter?.query && filter.query.trim()) {
      q = q.ilike('title', `%${filter.query.trim()}%`);
    }

    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return ((data || []) as any[]).map((row) => ({ ...row, company: row.companies }));
  } catch (e) {
    console.error('fetchAllJobOffers', e);
    return [];
  }
}

export async function createJobOffer(input: {
  company_id: string;
  title: string;
  description?: string | null;
  employment_type: EmploymentType;
  location?: string | null;
}): Promise<{ data: JobOffer | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('job_offers')
      .insert({
        company_id: input.company_id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        employment_type: input.employment_type,
        location: input.location?.trim() || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return { data: data as JobOffer, error: null };
  } catch (e) {
    const err = e as { message?: string };
    console.error('createJobOffer', e);
    return { data: null, error: err?.message || 'Erreur inconnue' };
  }
}

export async function updateJobOffer(
  offerId: string,
  patch: Partial<Pick<JobOffer, 'title' | 'description' | 'employment_type' | 'location' | 'is_active'>>,
): Promise<{ data: JobOffer | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('job_offers')
      .update(patch)
      .eq('id', offerId)
      .select('*')
      .single();
    if (error) throw error;
    return { data: data as JobOffer, error: null };
  } catch (e) {
    const err = e as { message?: string };
    console.error('updateJobOffer', e);
    return { data: null, error: err?.message || 'Erreur inconnue' };
  }
}

export async function deleteJobOffer(offerId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('job_offers').delete().eq('id', offerId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('deleteJobOffer', e);
    return false;
  }
}
