const crypto = require('crypto');

function verifyToken(token, secret) {
  try {
    const parts = token.split('-');
    if (parts.length !== 3) return false;
    const [role, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${role}-${expiresAtStr}`)
      .digest('hex')
      .slice(0, 12);
      
    return signature === expectedSignature;
  } catch (e) {
    return false;
  }
}

exports.handler = async (event, context) => {
  // 1. Enforce HTTPS/POST method (Security+ constraint)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Allow': 'POST'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // 2. Enforce Access Secret verification (If configured on Netlify)
  const accessSecret = process.env.ACCESS_SECRET;
  const masterKey = process.env.MASTER_KEY;
  if (accessSecret) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized: Missing or invalid access token' })
      };
    }

    const token = authHeader.split(' ')[1];
    const isValidToken = verifyToken(token, accessSecret);
    const isMasterKey = masterKey && token === masterKey;

    if (!isValidToken && !isMasterKey) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized: Access code expired or invalid' })
      };
    }
  }

  // 3. Validate API Key injection at runtime (Security+ constraint)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[SECURITY ERROR] GEMINI_API_KEY is not configured on Netlify environment variables.');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error (Service misconfigured)' })
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;

  try {
    const body = JSON.parse(event.body);
    
    // 4. Proxy request to Gemini API securely from the backend
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Serverless Proxy Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to communicate with Gemini API' })
    };
  }
};
