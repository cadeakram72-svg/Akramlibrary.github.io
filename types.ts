export interface Book {id:string;title:string;author:string;translator?:string;category:string;language:string;languages?:string[];description:string;cover:string;price:number;paid:boolean;listPrice?:number;pdf?:string|null;text?:string|null;download:boolean;privatePath?:string;fileUnavailable?:boolean;pageCount?:number;year?:number;isbn?:string;publicationDate?:string;license?:string;source?:string;short?:boolean}
export interface Review {book_id:string;rating:number;body:string;display_name:string;created_at:string}
export interface User {id:string;email?:string;user_metadata?:{full_name?:string;name?:string}}
export type Lang='en'|'so';
export interface Filters {query:string;category:string;language:string;author:string;price:string;sort:string}
export const initialFilters:Filters={query:'',category:'',language:'',author:'',price:'all',sort:'featured'};
declare global {interface Window {AkramReading?:{open:(id:string,format:string,fallback?:number)=>Promise<any>};Akram:{catalog:()=>Promise<Book[]>;client:()=>Promise<any>;file:(b:Book)=>Promise<string>;check:(r:any)=>any;user:()=>Promise<User|null>;access:(id:string)=>Promise<boolean>;enabled:boolean};showBookOffer:(id:string)=>Promise<void>;applyLocale?:()=>void;AKRAM_AUTH_CONFIG:{supabaseUrl:string;supabasePublishableKey:string;backendEnabled?:boolean}}}
