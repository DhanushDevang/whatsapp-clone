if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required but was not set. " +
    "Add it as a secret in Replit Secrets (Tools → Secrets)."
  );
}

export const JWT_SECRET = process.env.JWT_SECRET as string;
export const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY as string;
export const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY as string;
