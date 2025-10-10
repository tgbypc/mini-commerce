
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : undefined,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "source.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "pixabay.com" }, // kullanıyorsan
      { protocol: "https", hostname: "cdn.pixabay.com" }, // bazı pixabay görselleri
      { protocol: "https", hostname: "blob.vercel-storage.com" }, // ileride upload için
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "**.blob.vercel-storage.com" },
      { protocol: "https", hostname: "img.kwcdn.com" },
    ],
  },
};

export default nextConfig;
