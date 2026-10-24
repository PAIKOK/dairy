import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import type {Profile} from '../shared/types';
import {api,errorMessage} from './api';
type Auth={profile:Profile|null;loading:boolean;error:string;setProfile:(p:Profile|null)=>void;refresh:()=>Promise<void>};
const Context=createContext<Auth>(null!);
export function AuthProvider({children}:{children:ReactNode}){const [profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');async function refresh(){setLoading(true);setError('');try{setProfile((await api<{profile:Profile|null}>('/session')).profile)}catch(e){setError(errorMessage(e))}finally{setLoading(false)}}useEffect(()=>{void refresh()},[]);return <Context.Provider value={{profile,setProfile,loading,error,refresh}}>{children}</Context.Provider>}
export const useAuth=()=>useContext(Context);
