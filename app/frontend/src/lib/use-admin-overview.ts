import { useEffect, useState } from 'react';
import { loadAdminOverview, type AdminOverview } from './admin-controls';
export function useAdminOverview(){
 const [data,setData]=useState<AdminOverview|null>(null),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[tick,setTick]=useState(0);
 useEffect(()=>{let cancelled=false;setLoading(true);void loadAdminOverview().then(value=>{if(!cancelled){setData(value);setFailed(false);}}).catch(()=>{if(!cancelled)setFailed(true);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[tick]);
 return {data,loading,failed,refresh:()=>setTick(v=>v+1)};
}
