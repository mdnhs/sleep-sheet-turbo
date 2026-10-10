import { Product } from "@/lib/types";

export type Collection = {
    id: string;
    title: string;
    slug: string;
    products: Product[];
  };
  