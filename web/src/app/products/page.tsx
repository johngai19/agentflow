"use client";

import { ProductList } from "@/components/products/ProductList";
import { Suspense } from "react";

export default function ProductsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<div>Loading page content...</div>}>
        <ProductList />
      </Suspense>
    </div>
  );
}

