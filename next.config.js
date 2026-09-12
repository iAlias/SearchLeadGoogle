/** @type {import('next').NextConfig} */
const nextConfig = {
  // whatsapp-web.js + puppeteer are heavy native deps loaded lazily at runtime.
  // Keep them external so Next doesn't try to bundle them.
  serverExternalPackages: ["whatsapp-web.js", "puppeteer", "qrcode"],
  // Le demo sono HTML generato a mano con <img> normali, non next/image: qui
  // servono solo gli host delle foto raccolte dallo scraper. Il vecchio
  // "**" autorizzava qualunque dominio del mondo senza che servisse a nulla.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
      { protocol: "https", hostname: "lh5.googleusercontent.com" },
      { protocol: "https", hostname: "streetviewpixels-pa.googleapis.com" },
    ],
  },
};

module.exports = nextConfig;
