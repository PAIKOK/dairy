import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import type {Profile} from '../shared/types';
import {api,errorMessage} from './api';
type Auth={storage:'mongodb'|'local-sqlite'|'unavailable';profile:Profile|null;loading:boolean;error:string;setProfile:(p:Profile|null)=>void;refresh:()=>Promise<void>};
const Context=createContext<Auth>(null!);
export function AuthProvider({children}:{children:ReactNode}){const [profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[storage,setStorage]=useState<Auth['storage']>('unavailable');async function refresh(){setLoading(true);setError('');try{const result=await api<{profile:Profile|null;storage:Auth['storage']}>('/session');setProfile(result.profile);setStorage(result.storage||'unavailable')}catch(e){setError(errorMessage(e))}finally{setLoading(false)}}useEffect(()=>{void refresh()},[]);return <Context.Provider value={{storage,profile,setProfile,loading,error,refresh}}>{children}</Context.Provider>}
export const useAuth=()=>useContext(Context);
