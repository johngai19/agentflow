"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useAuthStore from "@/stores/authStore";
import { useRouter } from "next/navigation";

// Define the product type according to your backend API
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
}

// Mock product data - replace with API call
const mockProducts: Product[] = [
  {
    id: "1",
    name: "Super Widget",
    description: "An amazing widget that does everything.",
    price: 29.99,
    stock: 150,
  },
  {
    id: "2",
    name: "Mega Gadget",
    description: "The best gadget for all your needs.",
    price: 75.50,
    stock: 75,
  },
  {
    id: "3",
    name: "Ultra Gizmo",
    description: "A futuristic gizmo with advanced features.",
    price: 199.00,
    stock: 30,
  },
  {
    id: "4",
    name: "Basic Thingamajig",
    description: "A simple and reliable thingamajig.",
    price: 9.95,
    stock: 300,
  },
];

export function ProductList() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const token = useAuthStore((state) => state.token);
  const router = useRouter();

  React.useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // TODO: Replace with actual API call to a products endpoint when available in the backend.
        // The Go backend currently has /api/v1/ping (authenticated) but not a specific products API.
        // Using mock data as per user preference for initial development/testing.
        console.log("Using mock data for products. For real data, implement a products API in the backend.");
        console.log("If a products API (e.g., http://localhost:8080/api/v1/products) were available, it would be called here.");
        
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        setProducts(mockProducts);

        // Example of how a real API call would look (currently commented out):
        /*
        const response = await fetch("http://localhost:8080/api/v1/products", { // Ensure this is the correct endpoint
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch products");
        }
        const data = await response.json();
        // Assuming the backend returns { products: Product[] } or similar
        setProducts(data.products || data || []); 
        */
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred while fetching products.");
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [token, router]);

  if (isLoading) {
    return <p className="text-center py-8">Loading products...</p>;
  }

  if (error) {
    return <p className="text-center py-8 text-red-500">Error: {error}</p>;
  }

  if (products.length === 0 && !isLoading) {
    return <p className="text-center py-8">No products found.</p>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Product List</h1>
      <Table>
        <TableCaption>A list of available products. (Currently using mock data)</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.id}</TableCell>
              <TableCell>{product.name}</TableCell>
              <TableCell>{product.description}</TableCell>
              <TableCell className="text-right">${product.price.toFixed(2)}</TableCell>
              <TableCell className="text-right">{product.stock}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

