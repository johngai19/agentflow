"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/stores/authStore";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  // useEffect(() => {
  //   // Optional: Redirect to products if logged in, or login if not
  //   if (token && user) {
  //     // router.push("/products");
  //   } else {
  //     // router.push("/login");
  //   }
  // }, [token, user, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center px-4">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
        Welcome to Our Application
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
        This is a sample application demonstrating the integration of a Next.js frontend
        with a Go backend, featuring JWT authentication, product listings, and more.
      </p>
      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        {token && user ? (
          <Button asChild size="lg">
            <Link href="/products">View Products</Link>
          </Button>
        ) : (
          <Button asChild size="lg">
            <Link href="/login">Login to Get Started</Link>
          </Button>
        )}
        <Button variant="outline" size="lg" asChild>
          <Link href="/products">Browse Products</Link>
        </Button>
      </div>
      {user && (
        <p className="mt-8 text-md text-muted-foreground">
          Logged in as: <strong>{user.username}</strong>
        </p>
      )}
    </div>
  );
}

