type MiniAppLinkParams = Record<string, string | null | undefined>;

export function buildMiniAppShareLink(params: MiniAppLinkParams = {}) {
  const shareBase = process.env.MINIAPP_SHARE_BASE;
  const serviceId = process.env.MPOWER_SERVICE_UUID ?? process.env.OIDC_CLIENT_ID;

  if (!shareBase || !serviceId) return null;

  const url = new URL(`${shareBase}${encodeURIComponent(serviceId)}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return url.toString();
}
