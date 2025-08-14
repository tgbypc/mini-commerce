// src/lib/products.ts
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Product } from "@/types/product";

// (İstersen converter kullanmaya devam edebiliriz; şimdilik sade okuyalım)

export async function getAllProducts(): Promise<Product[]> {
  const snap = await getDocs(collection(db, "products"));
  return snap.docs.map(d => ({ id: Number(d.id), ...(d.data() as Omit<Product, "id">) }));
}

export async function getProductById(id: string): Promise<Product | null> {
  const ref = doc(db, "products", id); // doc id = "1" gibi string
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  // doc id string olduğu için tipte id:number kullanıyorsan Number()’la dönüştürelim:
  return { id: Number(snap.id), ...(snap.data() as Omit<Product, "id">) };
}