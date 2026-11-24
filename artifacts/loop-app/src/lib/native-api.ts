import { Capacitor } from "@capacitor/core";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

const SESSION_KEY = "loop-api-session";

export async function configureNativeApi(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "https://10.225.73.95:3000";

  const apiUrl = new URL(configuredApiUrl);
  const apiHost = apiUrl.hostname.split(".");
  const isPrivateIpv4 = apiHost.length === 4
    && apiHost.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
    && (
      Number(apiHost[0]) === 10
      || (Number(apiHost[0]) === 172 && Number(apiHost[1]) >= 16 && Number(apiHost[1]) <= 31)
      || (Number(apiHost[0]) === 192 && Number(apiHost[1]) === 168)
    );
  if (
    (apiUrl.protocol !== "https:" && !(apiUrl.protocol === "http:" && isPrivateIpv4))
    || apiUrl.pathname !== "/"
    || apiUrl.search
    || apiUrl.hash
  ) {
    throw new Error("VITE_API_BASE_URL must be HTTPS, except HTTP is allowed for a private IPv4 development server.");
  }

  const apiOrigin = apiUrl.origin;
  setBaseUrl(apiOrigin);

  let sessionToken: string | null = null;
  const tokenReady = SecureStorage.getItem(SESSION_KEY).then(token => {
    sessionToken = token;
  }).catch(error => {
    console.error("Could not restore the saved Loop session", error);
  });
  setAuthTokenGetter(async () => {
    await tokenReady;
    return sessionToken;
  });

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const requestUrl = new URL(request.url);
    const isApiRequest = requestUrl.pathname === "/api"
      || requestUrl.pathname.startsWith("/api/")
      || requestUrl.pathname === "/uploads"
      || requestUrl.pathname.startsWith("/uploads/");
    if (!isApiRequest) return nativeFetch(request);

    const targetUrl = requestUrl.origin === window.location.origin
      ? new URL(`${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`, apiOrigin)
      : requestUrl;
    const forwardedRequest = new Request(targetUrl, request);
    const headers = new Headers(forwardedRequest.headers);
    if (sessionToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${sessionToken}`);
    }

    let response = await nativeFetch(new Request(forwardedRequest, {
      headers,
      credentials: "include",
    }));

    if (response.headers.get("content-type")?.includes("application/json")) {
      const payload: unknown = await response.clone().json();
      const resolveUploadUrls = (value: unknown): unknown => {
        if (typeof value === "string") {
          const uploadPath = value.startsWith("/uploads/")
            ? `/api${value}`
            : value.startsWith("/api/uploads/")
              ? value
              : null;
          if (uploadPath) return new URL(uploadPath, apiOrigin).toString();
          if (value.trimStart().startsWith("[")) {
            try {
              const mediaUrls: unknown = JSON.parse(value);
              if (Array.isArray(mediaUrls)) {
                return JSON.stringify(mediaUrls.map(resolveUploadUrls));
              }
            } catch {
              return value;
            }
          }
        }
        if (Array.isArray(value)) return value.map(resolveUploadUrls);
        if (value && typeof value === "object") {
          return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, resolveUploadUrls(entry)]),
          );
        }
        return value;
      };
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");
      headers.delete("etag");
      response = new Response(JSON.stringify(resolveUploadUrls(payload)), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    if (response.ok && (requestUrl.pathname === "/api/auth/login" || requestUrl.pathname === "/api/auth/register")) {
      const result = await response.clone().json() as { sessionId?: unknown };
      if (typeof result.sessionId === "string" && result.sessionId.length > 0) {
        sessionToken = result.sessionId;
        try {
          await SecureStorage.setItem(SESSION_KEY, result.sessionId);
        } catch (error) {
          console.error("Could not persist the Loop session securely", error);
        }
      }
    } else if (response.ok && requestUrl.pathname === "/api/auth/logout") {
      sessionToken = null;
      try {
        await SecureStorage.remove(SESSION_KEY);
      } catch (error) {
        console.error("Could not remove the saved Loop session", error);
      }
    }

    return response;
  };
}
