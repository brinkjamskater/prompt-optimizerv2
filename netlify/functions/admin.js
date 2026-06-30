const crypto = require('crypto');

const attemptsByIp = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_DURATION_HOURS = 168;

function getClientIp(event) {
  return (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['client-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function pruneAttempts(now) {
  for (const [ip, entry] of attemptsByIp.entries()) {
    if (now > entry.resetAt) {
      attemptsByIp.delete(ip);
    }
  }
}

function recordFailedAttempt(ip, now) {
  const entry = attemptsByIp.get(ip);
  if (!entry || now > entry.resetAt) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count += 1;
}

function isRateLimited(ip, now) {
  const entry = attemptsByIp.get(ip);
  return Boolean(entry && now <= entry.resetAt && entry.count >= MAX_ATTEMPTS);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

exports.handler = async (event, context) => {
  // Enforce POST method
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST' },
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  const accessSecret = process.env.ACCESS_SECRET;
  const masterKey = process.env.MASTER_KEY;
  const clientIp = getClientIp(event);
  const now = Date.now();
  pruneAttempts(now);

  // Verify server configuration
  if (!accessSecret || !masterKey) {
    return { 
      statusCode: 500, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication is not configured on the server. Please set ACCESS_SECRET and MASTER_KEY.' }) 
    };
  }

  if (isRateLimited(clientIp, now)) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Too many invalid attempts. Please try again later.' })
    };
  }

  try {
    const { key, durationHours } = JSON.parse(event.body);

    // Verify Master Key
    if (!safeEqual(key, masterKey)) {
      recordFailedAttempt(clientIp, now);
      return { 
        statusCode: 401, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid Master Key' }) 
      };
    }

    // Generate Expiration Timestamp
    const requestedHours = Number.parseFloat(durationHours);
    const hours = Number.isFinite(requestedHours)
      ? Math.min(Math.max(requestedHours, 0.25), MAX_DURATION_HOURS)
      : 24;
    const expiresAt = Date.now() + Math.floor(hours * 60 * 60 * 1000);
    const role = 'emp'; // Employer role

    // Sign the token: hmac(role-expiresAt, accessSecret)
    const signature = crypto
      .createHmac('sha256', accessSecret)
      .update(`${role}-${expiresAt}`)
      .digest('hex')
      .slice(0, 12);

    const accessCode = `${role}-${expiresAt}-${signature}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: accessCode, expiresAt })
    };
  } catch (err) {
    console.error('Code Generation Error:', err);
    return { 
      statusCode: 500, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to generate access code' }) 
    };
  }
};
