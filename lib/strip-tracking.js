// Removes known tracking parameters from a URL. Works on the raw string so the
// rest of the URL keeps its exact encoding and parameter order.

const TRACKING_PARAMS = new Set([
  "dclid",
  "fbclid",
  "gbraid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "msclkid",
  "ref_src",
  "ref_url",
  "ttclid",
  "twclid",
  "wbraid",
  "yclid",
  "_hsenc",
  "_hsmi",
]);

// Parameters that are only tracking on specific hosts
const TRACKING_PARAMS_BY_HOST = {
  "youtube.com": ["si"],
  "youtu.be": ["si"],
  "open.spotify.com": ["si"],
};

function hostTrackingParams(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname.replace(/^(www|m|music)\./, "");
  } catch {
    return [];
  }
  return TRACKING_PARAMS_BY_HOST[hostname] || [];
}

function stripTracking(url) {
  const hashIndex = url.indexOf("#");
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);

  const queryIndex = beforeHash.indexOf("?");
  if (queryIndex === -1) return url;

  const params = beforeHash.slice(queryIndex + 1).split("&");
  const hostParams = hostTrackingParams(url);
  const kept = params.filter((param) => {
    const name = param.split("=")[0].toLowerCase();
    return !name.startsWith("utm_") && !TRACKING_PARAMS.has(name) && !hostParams.includes(name);
  });
  if (kept.length === params.length) return url;

  const base = beforeHash.slice(0, queryIndex);
  return base + (kept.length > 0 ? `?${kept.join("&")}` : "") + hash;
}
