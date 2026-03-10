function toBase64Url(bytes: Uint8Array) {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const b64 = btoa(bin);
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(str: string) {
  const b64 = str.replaceAll("-", "+").replaceAll("_", "/");
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(padLen);
  const bin = atob(padded);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}

async function sha256Base64Url(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return toBase64Url(digest);
}

export async function createSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = toBase64Url(bytes);
  const tokenHash = await sha256Base64Url(token);
  return { token, tokenHash };
}

export async function tokenHash(token: string) {
  return sha256Base64Url(token);
}

export async function hashPassword(password: string) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = toBase64Url(saltBytes);
  const iterations = 150_000;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", iterations, salt: saltBytes },
    keyMaterial,
    256,
  );
  const hash = toBase64Url(new Uint8Array(bits));
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const [kind, iterStr, saltStr, hashStr] = parts;
  if (kind !== "pbkdf2") return false;
  const iterations = Number(iterStr);
  if (!Number.isFinite(iterations) || iterations < 50_000) return false;
  const saltBytes = fromBase64Url(saltStr);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", iterations, salt: saltBytes },
    keyMaterial,
    256,
  );
  const computed = toBase64Url(new Uint8Array(bits));
  return computed === hashStr;
}

