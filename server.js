import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

// 1. Generate Access Token Route (Local Dev mirror)
app.post('/api/admin', (req, res) => {
  const accessSecret = process.env.ACCESS_SECRET;
  const masterKey = process.env.MASTER_KEY;

  if (!accessSecret || !masterKey) {
    return res.status(500).json({ error: 'Server authentication is not configured locally in .env' });
  }

  try {
    const { key, durationHours } = req.body;

    if (key !== masterKey) {
      return res.status(401).json({ error: 'Invalid Master Key' });
    }

    const hours = parseFloat(durationHours) || 24;
    const expiresAt = Date.now() + Math.floor(hours * 60 * 60 * 1000);
    const role = 'emp';

    const signature = crypto
      .createHmac('sha256', accessSecret)
      .update(`${role}-${expiresAt}`)
      .digest('hex')
      .slice(0, 12);

    const accessCode = `${role}-${expiresAt}-${signature}`;

    res.json({ code: accessCode, expiresAt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

// 1.5 Verify Access Token Route (Local Dev mirror)
app.post('/api/verify', (req, res) => {
  const accessSecret = process.env.ACCESS_SECRET;
  const masterKey = process.env.MASTER_KEY;

  if (!accessSecret) {
    return res.json({ valid: true, message: 'Local development bypass: No Auth configured' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  const isValidToken = verifyToken(token, accessSecret);
  const isMasterKey = masterKey && token === masterKey;

  if (isValidToken || isMasterKey) {
    res.json({ 
      valid: true, 
      role: isMasterKey ? 'admin' : 'emp',
      expiresAt: isValidToken ? parseInt(token.split('-')[1]) : null
    });
  } else {
    res.status(401).json({ error: 'Invalid or expired passcode' });
  }
});

// 2. Main Generation Route with Auth check
app.post('/api/generate', async (req, res) => {
  const accessSecret = process.env.ACCESS_SECRET;
  const masterKey = process.env.MASTER_KEY;
  
  // Enforce auth if local ACCESS_SECRET is configured
  if (accessSecret) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }
    
    const token = authHeader.split(' ')[1];
    const isValidToken = verifyToken(token, accessSecret);
    const isMasterKey = masterKey && token === masterKey;

    if (!isValidToken && !isMasterKey) {
      return res.status(401).json({ error: 'Unauthorized: Expired or invalid passcode' });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Failed to communicate with Gemini API' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
