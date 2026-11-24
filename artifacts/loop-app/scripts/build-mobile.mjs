import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const configuredApiUrl = process.env.VITE_API_BASE_URL?.trim() || "https://10.225.73.95:3000";

const apiUrl = new URL(configuredApiUrl);
const hostParts = apiUrl.hostname.split(".");
const isPrivateIpv4 = hostParts.length === 4
  && hostParts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  && (
    Number(hostParts[0]) === 10
    || (Number(hostParts[0]) === 172 && Number(hostParts[1]) >= 16 && Number(hostParts[1]) <= 31)
    || (Number(hostParts[0]) === 192 && Number(hostParts[1]) === 168)
  );
if (
  (apiUrl.protocol !== "https:" && !(apiUrl.protocol === "http:" && isPrivateIpv4))
  || apiUrl.pathname !== "/"
  || apiUrl.search
  || apiUrl.hash
) {
  throw new Error("VITE_API_BASE_URL must be HTTPS, except HTTP is allowed for a private IPv4 development server.");
}

process.env.PORT ??= "3000";
process.env.BASE_PATH ??= "/";

await build({
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  mode: "production",
});

await rm(new URL("../dist/public/downloads", import.meta.url), {
  recursive: true,
  force: true,
});
