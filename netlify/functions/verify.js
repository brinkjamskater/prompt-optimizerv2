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
  
  // If authentication is not set up on the server, we allow verify to pass (for local dev convenience)
  if (!accessSecret) {
    return { 
      statusCode: 200, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: true, message: 'Local development bypass: No Auth configured on server' }) 
    };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { 
      statusCode: 401, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }) 
    };
  }

  const token = authHeader.split(' ')[1];
  const isValidToken = verifyToken(token, accessSecret);
  const isMasterKey = masterKey && token === masterKey;

  if (isValidToken || isMasterKey) {
    return { 
      statusCode: 200, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        valid: true, 
        role: isMasterKey ? 'admin' : 'emp',
        expiresAt: isValidToken ? parseInt(token.split('-')[1]) : null
      }) 
    };
  } else {
    return { 
      statusCode: 401, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid or expired passcode' }) 
    };
  }
};
