// src/lib/productConverter.ts
import type {
  FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions, DocumentData
} from "firebase/firestore";
import type { Product } from "@/types/product";

export const productConverter: FirestoreDataConverter<Product> = {
  toFirestore(product: Product): DocumentData {
    return product as DocumentData;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Product {
    const data = snapshot.data(options) as DocumentData;
    return data as Product;
  },
};