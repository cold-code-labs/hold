/** @type {import('next').NextConfig} */
const nextConfig = {
  // `pg` is a server-only native-ish dep; keep it external to the bundle.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
