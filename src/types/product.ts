
export interface Product{
id: number;
title: string;
description: string;
category: string; //TODO update with an enum
discountPercentage?: number;
rating?: number;
stock: number;
tags: string[]; //TODO update with an enum
brand: string;
sku: string;
weight: number;
dimensions: Dimentions;
warrantyInformation: string;
shippingInformation: string;
availabilityStatus: AvailabilityStatus;
reviews: Review[];
meta: Meta;
images: string[];
thumbnail: string;
price: number;//TODO update with a decimal type

}

export enum Category {
  fragrances = "fragrances",
  beauty = "beauty",
  groceries = "groceries",
}

export const allCategories = Object.keys(Category);

export enum AvailabilityStatus {
  IN_STOCK = "In Stock",
  OUT_OF_STOCK = "Out of Stock", 
}

export enum ReturnPolicy {
  NO_RETURN = "No Return Policy",
  DAYS_14 = "14 Days Return Policy",
  DAYS_7 = "7 Days Return Policy",
   DAYS_30 = "30 Days Return Policy",
  DAYS_90 = "90 Days Return Policy",
   
}

export interface Dimentions {
width: number;
height: number;
depth: number;
}

export interface Review {
  rating: number;
  comment: string;
  date: string;
  reviewerName: string;
  reviewerEmail: string;
}

export interface Meta {
  createdAt: string;
  updatedAt: string;
  barcode: string;
  qrCode: string;
}




