import { config } from '../../src/config.js';
import { readRecentLeads } from '../../src/services/googleSheets.js';

export async function handler(event) {
  const token = event.queryStringParameters?.token || '';

  if (!config.metaVerifyToken || token !== config.metaVerifyToken) {
    return json(403, { ok: false, error: 'Forbidden' });
  }

  try {
    const limit = event.queryStringParameters?.limit || 30;
    const rows = await readRecentLeads(limit);

    return json(200, {
      ok: true,
      count: rows.length,
      rows
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message
    });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
