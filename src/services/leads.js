const buyingWords = [
  'comprar',
  'busco',
  'quiero un',
  'precio',
  'financiacion',
  'financiación',
  'catalogo',
  'catálogo',
  'stock'
];

const sellingWords = [
  'vender',
  'vendo',
  'tasar',
  'tasacion',
  'tasación',
  'compran mi',
  'compráis',
  'compran'
];

export function classifyLead(event) {
  const normalizedText = event.text.toLowerCase();
  const intent = sellingWords.some((word) => normalizedText.includes(word))
    ? 'sell_vehicle'
    : buyingWords.some((word) => normalizedText.includes(word))
      ? 'buy_vehicle'
      : 'general_question';

  return {
    createdAt: new Date().toISOString(),
    channel: event.channel,
    contactId: event.from,
    intent,
    message: event.text,
    status: intent === 'general_question' ? 'needs_more_info' : 'new',
    vehicle: extractPossibleVehicle(event.text),
    budget: extractBudget(event.text),
    nextAction: getNextAction(intent)
  };
}

function extractPossibleVehicle(text) {
  const match = text.match(
    /\b(audi|bmw|citroen|citroën|fiat|ford|honda|hyundai|kia|mazda|mercedes|nissan|opel|peugeot|renault|seat|toyota|volkswagen|vw)\b[^\n,.]*/i
  );

  return match?.[0]?.trim() || '';
}

function extractBudget(text) {
  const moneyMatch = text.match(/(?:€|eur|euros?)\s?(\d{4,6})|(\d{4,6})\s?(?:€|eur|euros?)/i);
  if (moneyMatch) return moneyMatch[0].trim();

  const budgetWords = /(presupuesto|hasta|maximo|máximo|busco|precio)/i;
  if (!budgetWords.test(text)) return '';

  const match = text.match(/\b(?!19\d{2}\b|20\d{2}\b)\d{4,6}\b/i);
  return match?.[0]?.trim() || '';
}

function getNextAction(intent) {
  if (intent === 'sell_vehicle') {
    return 'Ask for brand, model, year, km, condition, photos and location.';
  }

  if (intent === 'buy_vehicle') {
    return 'Ask for budget, desired vehicle type, cash or financing, and preferred date.';
  }

  return 'Ask whether the client wants to buy or sell a vehicle.';
}
