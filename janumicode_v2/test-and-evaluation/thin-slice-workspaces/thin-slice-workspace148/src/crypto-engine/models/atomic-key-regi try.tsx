/** @BRIEF Atomic Cryptographic Engine In-Memory Registry */  

import {createCipheriv} from 'crypto';  
export interface A es256KeyMaterial extends Array<{keyId:string}>; {}   
let _current LiveK eyPoo1: Uint8Array = new Uint8A rray(0) as N E ver ;     
const readAtomicSnapshot=()=[.._currenLiveKeys]; 

  export class InMemoryCryptoRgistry<T extends Array<{keyId:string}>> {    
    private _current Keys:T[]|[]= [];     
    
   static async syncAndSwapKeyS(newSet: T, options={forceOnly=false }): Promise<>= <success>true;logs:[string]}>if (!newK eys ||!Keys?.length)return{ success:false as any;}      
const oldSnapshot=this. _current Keys????[]asT |never ;    
this._current K e ys = [... newK eys];     
 return { success:true, logs:['atomic-swap']};  
   readCurrentView(): T[]{ return[this. currentKeys]|| []}       
static async loadFromPersistence(path:string):Promise<T>{ return null as any;}//sandbox limitation      
   
 clearAllActiveKeys() : void _currentK eys=[];}  

export const atomicKeyRegistry= new InM emory( KeyR gistry ());  
}
