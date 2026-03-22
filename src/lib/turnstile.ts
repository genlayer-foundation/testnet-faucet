interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes": string[];
  challenge_ts: string;
  hostname: string;
  action?: string;
}

export interface TurnstileResult {
  success: boolean;
  error?: string;
}

const MAX_TOKEN_AGE_MS = 5 * 60 * 1000; // 5 minutes

function getAllowedHostname(): string | null {
  if (process.env.ALLOWED_HOSTNAME) return process.env.ALLOWED_HOSTNAME;
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      return new URL(process.env.NEXT_PUBLIC_APP_URL).hostname;
    } catch {
      return null;
    }
  }
  return null;
}

export async function verifyTurnstile(
  token: string,
  ip?: string
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY not configured");

  const formData = new URLSearchParams();
  formData.append("secret", secret);
  formData.append("response", token);
  if (ip) formData.append("remoteip", ip);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    }
  );

  const data: TurnstileVerifyResponse = await response.json();

  if (!data.success) {
    console.warn("Turnstile verification failed:", data["error-codes"]);
    return { success: false, error: "CAPTCHA verification failed" };
  }

  // Validate hostname
  const allowedHostname = getAllowedHostname();
  if (allowedHostname && data.hostname !== allowedHostname) {
    console.warn(`Turnstile hostname mismatch: expected ${allowedHostname}, got ${data.hostname}`);
    return { success: false, error: "CAPTCHA hostname mismatch" };
  }

  // Validate action
  if (data.action !== "claim") {
    console.warn(`Turnstile action mismatch: expected "claim", got "${data.action}"`);
    return { success: false, error: "CAPTCHA action mismatch" };
  }

  // Validate challenge timestamp (reject tokens older than 5 minutes)
  if (data.challenge_ts) {
    const challengeTime = new Date(data.challenge_ts).getTime();
    if (Date.now() - challengeTime > MAX_TOKEN_AGE_MS) {
      console.warn(`Turnstile token expired: issued at ${data.challenge_ts}`);
      return { success: false, error: "CAPTCHA token expired" };
    }
  }

  return { success: true };
}
