/** @type {import('next').NextConfig} */
const nextConfig = {
  // smaller runtime image (needed for the Dockerfile I gave you)
  output: "standalone",

  images: {
    remotePatterns: [
      // Firebase Storage (v0 API)
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
      },
      // Alternate public GCS URL (some libs/console share this form)
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
      // Optional: Google avatars (if you show user photos)
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
    // If you plan to serve images via an external CDN (and don’t want server-side optimization),
    // un-comment the next line:
    // unoptimized: true,
  },
};

export default nextConfig;
