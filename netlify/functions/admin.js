const crypto = require('crypto');

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

  // Verify server configuration
  if (!accessSecret || !masterKey) {
    return { 
      statusCode: 500, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication is not configured on the server. Please set ACCESS_SECRET and MASTER_KEY.' }) 
    };
  }

  try {
    const { key, durationHours } = JSON.parse(event.body);

    // Verify Master Key
    if (key !== masterKey) {
      return { 
        statusCode: 401, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid Master Key' }) 
      };
    }

    // Generate Expiration Timestamp
    const hours = parseFloat(durationHours) || 24;
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
