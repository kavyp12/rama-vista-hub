import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

// ✅ FIX G8: Never use hardcoded fallback strings — they allow anyone to forge JWT tokens.
// In production, throw if the secret is not configured. In dev, use a random per-process secret.
function getSecret(envVar: string): string {
  const val = process.env[envVar];
  if (val) return val;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`FATAL: Environment variable ${envVar} is required in production`);
  }
  // Development only: generate a random secret per process start
  return crypto.randomBytes(32).toString('hex');
}

const ACCESS_TOKEN_SECRET = getSecret('JWT_ACCESS_SECRET');
const REFRESH_TOKEN_SECRET = getSecret('JWT_REFRESH_SECRET');

export const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '365d' }
  );

  const refreshToken = jwt.sign(
    { userId },
    REFRESH_TOKEN_SECRET,
    { expiresIn: '365d' }
  );

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): { userId: string } | null => {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
};

export const verifyRefreshToken = (token: string): { userId: string } | null => {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
};