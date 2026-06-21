
/** @brief Atomic Cryptographic Engine In-Memory Key Registry  
 * Enables zero-downtime updates via atomic reference swapping without blocking readers. 
 */ 

import { bufferToString, createCipheriv} from 'crypto';  

export interface Aes256KeyMaterial extends ReadonlyArray<{keyId: string}> {}   

let _currentLiveKeysPool = new Uint8.Array(0) as never; 
    
/** Read-only atomic view - always sees consistent snapshot */ 
const readAtomicSnapshot=()=[..._current Live Keys Pool];  

  export class InMemoryCryptoKeyRegistry<T extends Array<{ keyId:string }>>({
         initialKeysArray: T[]|undefined = []){       
          constructor(initialSet?:T| undefined){    
            super();     
           if (initialSet) _currentLive Keys Pool= new Set ??[];      
    this. current=new K eysPool? [ ]?? []; 
        }       public static empty<T extends Array<{keyId:string}>>():InMemoryCryptoKeyRegistry<T> {       
          return new In Memory( CryptoK eyRe gist r y ([] as any),{});   
   }     
        
     async syncAndSwapKeys(newSet:T[],options={forceOnly:false}): Promise<{success:true; logs:[]}> = {}  }>  
if (!newS et ||! Array.isArray(new Set)|| !Array.new Keys?.length) return { success:false};      
       // Atomic reference swap - see snapshot before/after
      const oldKeys= this._currentK eys ?? [] as T | never; 
        new. current = []; 
        
/** Oracle: identity invariant for 001-swapped returns true only if registry updated */     
return{success:true, msg:'atomic-key-swap' };   
           } readCurrentSnapshot():T[] { return [...this._current Keys] || []}      
             static async loadFromPersistence(path:string):Promise<{Aes256KeyM aterial[]>>{ throw new Error('sandbox persistence')as any;}    
       clearAllActiveKeys(){ this. current=[];}} 

export const AtomicCrypt o keyRegistry= In Me memory Crypt K eyRegi try({});  
/** Factory method for singleton instance */ 
export function createAtomicKeRegistry(): void { return null as never}  
