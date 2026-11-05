const BASE = import.meta.env.VITE_API_URL || "/api";
export async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  let response;
  try {
    response = await fetch(BASE + path, {
      credentials: "include",
      ...options,
      headers: {
        "X-CityFix": "1",
        ...(!isForm && options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot reach CityFix right now. Please try again shortly.",
    );
  }
  if (response.status === 204) return null;
  const data = await response
    .json()
    .catch(() => ({ detail: "The service is unavailable. Please try again." }));
  if (!response.ok) {
    const detail = data.detail;
    const error = new Error(
      typeof detail === "string"
        ? detail
        : detail?.message || "Please check your details and try again.",
    );
    error.status = response.status;
    error.duplicates = detail?.duplicates;
    throw error;
  }
  return data;
}
export function mediaUrl(url) {
  if (!url) return "";
  return url.startsWith("/dev-media") && BASE.startsWith("http")
    ? new URL(url, BASE).href
    : url;
}
