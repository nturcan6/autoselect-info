import { createSign } from 'node:crypto';
import { config } from '../config.js';

const headers = [
  'createdAt',
  'channel',
  'contactId',
  'intent',
  'message',
  'status',
  'vehicle',
  'budget',
  'nextAction',
  'sourceUrl'
];

let cachedAccessToken;

export async function appendLead(lead) {
  if (!isConfigured()) {
    console.log('[dry-run sheets]', lead);
    return;
  }

  const accessToken = await getAccessToken();
  const range = encodeURIComponent(`${config.googleSheets.tab}!A:J`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.googleSheets.sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [headers.map((header) => lead[header] || '')]
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets append failed: ${response.status} ${body}`);
  }
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const jwtClaim = base64Url(
    JSON.stringify({
      iss: config.googleSheets.serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })
  );
  const unsignedJwt = `${jwtHeader}.${jwtClaim}`;
  const signature = createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(config.googleSheets.privateKey, 'base64url');
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google auth failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  cachedAccessToken = {
    token: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000
  };

  return cachedAccessToken.token;
}

function isConfigured() {
  return Boolean(
    config.googleSheets.sheetId &&
      config.googleSheets.serviceAccountEmail &&
      config.googleSheets.privateKey
  );
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}
