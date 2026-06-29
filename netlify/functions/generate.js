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

  // 2. Validate API Key injection at runtime (Security+ constraint)
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
    
    // 3. Proxy request to Gemini API securely from the backend
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
