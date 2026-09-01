import vinext from "vinext";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;
const apiProxyTarget = process.env.VANGO_API_PROXY_TARGET || "http://localhost:9999";

function getSharedGoogleMapsApiKey() {
  if (process.env.VITE_GOOGLE_MAPS_API_KEY) return process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY) return process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (process.env.GOOGLE_PLACES_API_KEY) return process.env.GOOGLE_PLACES_API_KEY;
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;

  try {
    const mobileAppConfig = JSON.parse(readFileSync(resolve("../mobile-app/app.json"), "utf8"));
    const expo = mobileAppConfig?.expo || {};
    return (
      expo.extra?.googlePlacesApiKey ||
      expo.extra?.GOOGLE_PLACES_API_KEY ||
      expo.extra?.googleApiKey ||
      expo.extra?.GOOGLE_API_KEY ||
      expo.android?.config?.googleMaps?.apiKey ||
      expo.ios?.config?.googleMapsApiKey ||
      expo.ios?.infoPlist?.GMSApiKey ||
      ""
    );
  } catch {
    return "";
  }
}

process.env.VITE_GOOGLE_MAPS_API_KEY = getSharedGoogleMapsApiKey();

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        "/uploads": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
