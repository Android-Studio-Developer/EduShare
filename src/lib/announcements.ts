import { addDoc, collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";
import type { ServerAnnouncement } from "../types";
export function subscribeToAnnouncements(serverId:string,callback:(items:ServerAnnouncement[])=>void){return onSnapshot(query(collection(db,"servers",serverId,"announcements"),orderBy("createdAt","desc")),s=>callback(s.docs.map(d=>({id:d.id,...d.data()} as ServerAnnouncement))));}
export function postAnnouncement(serverId:string,text:string){return addDoc(collection(db,"servers",serverId,"announcements"),{text,createdAt:Date.now()});}
