const supabaseUrl = 'https://mnaysxvhrcubewtqlsnn.supabase.co';
const publishableKey = 'sb_publishable_prB3f-6vi4fxQmbE7N-XzQ_ApIW-xEI';
const siteUrl = 'https://autoselect.info/';
const columns = [
  'id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link'
];

export async function handler({ httpMethod }) {
  const headers = { 'Cache-Control': 'no-store' };
  if (httpMethod !== 'GET' && httpMethod !== 'HEAD') {
    return { statusCode: 405, headers: { ...headers, Allow: 'GET, HEAD' }, body: '' };
  }

  try {
    const cars = await fetchCars();
    const rows = cars.map(toFeedRow).filter(Boolean);
    if (cars.some(car => isListed(car.status)) && rows.length === 0) {
      throw new Error('No listed vehicles have sufficient data for a catalog entry.');
    }
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' },
      body: httpMethod === 'HEAD' ? '' : [columns.join(','), ...rows.map(csvRow)].join('\r\n') + '\r\n'
    };
  } catch (error) {
    console.error('Could not build the AutoSelect catalog:', error.message);
    return { statusCode: 503, headers, body: httpMethod === 'HEAD' ? '' : 'Catalog temporarily unavailable.' };
  }
}

async function fetchCars() {
  const url = new URL('/rest/v1/cars', supabaseUrl);
  url.search = new URLSearchParams({
    select: 'id,title,description,status,price,images,year,km,fuel,gear',
    order: 'id.asc',
    limit: '200'
  });
  const cars = [];
  const signal = AbortSignal.timeout(7000);
  while (true) {
    const response = await fetch(url, { headers: { apikey: publishableKey }, signal });
    if (!response.ok) throw new Error(`Stock request returned ${response.status}.`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Unexpected stock response.');
    if (!page.length) return cars;
    const lastId = page.at(-1)?.id;
    if (!lastId || url.searchParams.get('id') === `gt.${lastId}`) {
      throw new Error('Stock pagination did not advance.');
    }
    cars.push(...page);
    url.searchParams.set('id', `gt.${lastId}`);
  }
}

function isListed(status) {
  return ['', 'disponible', 'nuevo stock', 'reservado'].includes(String(status ?? '').trim().toLowerCase());
}

function toFeedRow(car) {
  const title = String(car.title ?? '').trim();
  const price = Number(car.price);
  const image = Array.isArray(car.images) && car.images.find(isHttpsImage);
  if (!isListed(car.status) || !car.id || !title || !Number.isFinite(price) || price <= 0 || !image) {
    return null;
  }

  const description = String(car.description ?? '').trim() || [
    title, car.year, car.km ? `${car.km} km` : '', car.fuel, car.gear
  ].filter(Boolean).join(' | ');
  const link = new URL(siteUrl);
  link.searchParams.set('car', car.id);
  const availability = String(car.status ?? '').trim().toLowerCase() === 'reservado' ? 'out of stock' : 'in stock';
  return [car.id, title.slice(0, 200), description.slice(0, 5000), availability, 'used', `${price.toFixed(2)} EUR`, link.href, image.trim()];
}

function isHttpsImage(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function csvRow(fields) {
  return fields.map(field => `"${String(field).replaceAll('"', '""')}"`).join(',');
}
