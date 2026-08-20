import { collection, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { ServerReview } from "../types";
export function subscribeToReviews(serverId:string,callback:(reviews:ServerReview[])=>void){return onSnapshot(query(collection(db,"servers",serverId,"reviews"),orderBy("createdAt","desc")),s=>callback(s.docs.map(d=>({id:d.id,...d.data()} as ServerReview))));}
export function saveReview(serverId:string,review:Omit<ServerReview,"id"|"createdAt">){return setDoc(doc(db,"servers",serverId,"reviews",review.authorId),{...review,createdAt:Date.now()});}
