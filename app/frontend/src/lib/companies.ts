import { supabase } from './supabase';

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  color_key: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyColorOption {
  key: string;
  label: string;
  hex: string;
  premium: boolean;
}

export const COMPANY_COLORS: CompanyColorOption[] = [
  { key: 'blue', label: 'Bleu', hex: '#2563eb', premium: false },
  { key: 'green', label: 'Vert', hex: '#16a34a', premium: false },
  { key: 'orange', label: 'Orange', hex: '#f59e0b', premium: false },
  { key: 'red', label: 'Rouge', hex: '#dc2626', premium: false },
  { key: 'purple', label: 'Violet', hex: '#9333ea', premium: true },
  { key: 'pink', label: 'Rose', hex: '#ec4899', premium: true },
  { key: 'teal', label: 'Turquoise', hex: '#0d9488', premium: true },
  { key: 'gold', label: 'Or', hex: '#ca8a04', premium: true },
  { key: 'black', label: 'Noir', hex: '#18181b', premium: true },
];

export function getCompanyColor(key: string): CompanyColorOption {
  return COMPANY_COLORS.find((c) => c.key === key) || COMPANY_COLORS[0];
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'entreprise'
  );
}

export async function fetchMyCompany(userId: string): Promise<Company | null> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as Company) || null;
  } catch (e) {
    console.error('fetchMyCompany', e);
    return null;
  }
}

export async function fetchCompanyBySlug(slug: string): Promise<Company | null> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return (data as Company) || null;
  } catch (e) {
    console.error('fetchCompanyBySlug', e);
    return null;
  }
}

export async function fetchActiveCompanies(query?: string): Promise<Company[]> {
  try {
    let q = supabase.from('companies').select('*').eq('is_active', true);
    if (query && query.trim()) {
      q = q.ilike('name', `%${query.trim()}%`);
    }
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Company[]) || [];
  } catch (e) {
    console.error('fetchActiveCompanies', e);
    return [];
  }
}

export async function createCompany(input: {
  owner_id: string;
  name: string;
  color_key: string;
  description?: string | null;
}): Promise<{ data: Company | null; error: string | null }> {
  const base = slugify(input.name);
  let slug = base;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from('companies')
      .insert({
        owner_id: input.owner_id,
        name: input.name.trim(),
        slug,
        color_key: input.color_key,
        description: input.description || null,
      })
      .select('*')
      .single();

    if (!error) return { data: data as Company, error: null };

    if (error.code === '23505') {
      if (error.message.includes('owner_id')) {
        return { data: null, error: 'Vous avez déjà une entreprise.' };
      }
      slug = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
      continue;
    }

    console.error('createCompany', error);
    return { data: null, error: error.message };
  }

  return {
    data: null,
    error: 'Impossible de créer l\u2019entreprise pour le moment, réessayez.',
  };
}

export async function updateCompany(
  companyId: string,
  patch: Partial<Pick<Company, 'name' | 'color_key' | 'description'>>,
): Promise<{ data: Company | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .update(patch)
      .eq('id', companyId)
      .select('*')
      .single();
    if (error) throw error;
    return { data: data as Company, error: null };
  } catch (e) {
    const err = e as { message?: string };
    console.error('updateCompany', e);
    return { data: null, error: err?.message || 'Erreur inconnue' };
  }
}
