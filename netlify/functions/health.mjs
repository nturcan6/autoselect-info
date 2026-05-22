export async function handler(event) {
  const body = { ok: true, service: 'autoselect-client-bot' };

  if (event.queryStringParameters?.debug === '1') {
    body.env = {
      metaVerifyToken: isSet('META_VERIFY_TOKEN'),
      whatsappPhoneNumberId: isSet('WHATSAPP_PHONE_NUMBER_ID'),
      whatsappAccessToken: isSet('WHATSAPP_ACCESS_TOKEN'),
      ownerWhatsappNumber: isSet('OWNER_WHATSAPP_NUMBER'),
      googleSheetId: isSet('GOOGLE_SHEET_ID'),
      googleSheetTab: isSet('GOOGLE_SHEET_TAB'),
      googleServiceAccountEmail: isSet('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
      googlePrivateKey: isSet('GOOGLE_PRIVATE_KEY'),
      facebookPageId: isSet('FACEBOOK_PAGE_ID'),
      facebookPageAccessToken: isSet('FACEBOOK_PAGE_ACCESS_TOKEN'),
      instagramPageId: isSet('INSTAGRAM_PAGE_ID'),
      instagramAccessToken: isSet('INSTAGRAM_ACCESS_TOKEN')
    };
  }

  return json(200, body);
}

function isSet(name) {
  return Boolean(process.env[name]);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}
