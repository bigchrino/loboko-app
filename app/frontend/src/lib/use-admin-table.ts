import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
/** Bounded pages; a failed request is never presented as an empty database. */
export function useAdminTable<T>(table: string, columns: string, filterColumn?: string) {
  const [rows,setRows]=useState<T[]>([]),[page,setPage]=useState(0),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[tick,setTick]=useState(0),[filter,setFilterValue]=useState('all');
  useEffect(()=>{let cancelled=false;setLoading(true);void(async()=>{try{let request=supabase.from(table).select(columns,{count:'exact'});if(filterColumn&&filter!=='all')request=request.eq(filterColumn,filter);const result=await request.order('created_at',{ascending:false}).order('id').range(page*50,page*50+49);if(result.error)throw result.error;if(cancelled)return;setRows((result.data??[]) as unknown as T[]);setTotal(result.count??0);setFailed(false);}catch{if(!cancelled)setFailed(true);}finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true;};},[table,columns,filterColumn,filter,page,tick]);
  const setFilter=(value:string)=>{setFilterValue(value);setPage(0);};
  return {rows,page,setPage,total,loading,failed,filter,setFilter,refresh:()=>setTick(value=>value+1)};
}
