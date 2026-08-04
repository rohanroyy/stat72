/**
 * Service Account Authentication Helper
 * Signs a JWT assertion locally in the browser using Web Crypto API (RS256)
 * and exchanges it for a Google OAuth 2.0 Access Token.
 */

// Helper to convert base64 to base64url format
function base64url(source) {
  let encodedSource = btoa(source);
  encodedSource = encodedSource.replace(/=+$/, '');
  encodedSource = encodedSource.replace(/\+/g, '-');
  encodedSource = encodedSource.replace(/\//g, '_');
  return encodedSource;
}

function arrayBufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64url(binary);
}

// Convert PEM formatted private key to raw ArrayBuffer
function pemToArrayBuffer(pem) {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryString = atob(cleaned);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Exchanges a Service Account JSON config for a Google OAuth access token.
 */
export async function getServiceAccountAccessToken(serviceAccount) {
  if (!serviceAccount || !serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('Invalid Service Account configuration.');
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: serviceAccount.private_key_id,
  };

  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
    aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const headerStr = base64url(JSON.stringify(header));
  const claimSetStr = base64url(JSON.stringify(claimSet));
  const jwtInput = `${headerStr}.${claimSetStr}`;

  // Parse and import RSA key using browser Web Crypto API
  const privateKeyBuffer = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await window.crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    false,
    ['sign']
  );

  // Sign JWT assertion
  const encoder = new TextEncoder();
  const signatureBuffer = await window.crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    cryptoKey,
    encoder.encode(jwtInput)
  );

  const signatureStr = arrayBufferToBase64url(signatureBuffer);
  const assertion = `${jwtInput}.${signatureStr}`;

  // Exchange assertion JWT for Access Token
  const response = await fetch(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Token Exchange failed: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}
