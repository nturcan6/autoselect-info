import { config } from '../config.js';

export async function buildBotReply({ event, lead }) {
  const ruleReply = buildRuleReply(lead);
  if (shouldUsePriorityRule(lead)) {
    return ruleReply;
  }

  if (config.openai.apiKey) {
    return buildAiReply({ event, lead });
  }

  return ruleReply;
}

async function buildAiReply({ event, lead }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.openai.model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: [
            `Eres el asistente comercial de ${config.business.name}.`,
            'Responde en espanol, claro, cercano y breve.',
            'Tu objetivo es captar datos utiles y derivar a un asesor cuando el cliente este listo.',
            'No inventes precios, disponibilidad, garantias ni financiacion.',
            'Si faltan datos, pide solo la siguiente informacion necesaria.',
            'Al iniciar una conversacion o ante un saludo, responde preguntando si quiere comprar o vender.',
            'Si el cliente quiere comprar, pide presupuesto maximo, modelo deseado, caracteristicas tecnicas y datos importantes a tener en cuenta.',
            'No repitas la misma respuesta. Si el cliente no aporta datos nuevos, indica que un comercial se pondra en contacto con el.',
            'Si el cliente pregunta por financiacion, explica que en la web puede simular cantidad, meses y porcentaje. Indica tambien que suele necesitar nomina, DNI o NIE en vigor, situacion bancaria viable y visitar las instalaciones para documentacion y prueba del vehiculo.',
            'Si el cliente pregunta por coche, catalogo o stock, envia www.autoselect.info y pregunta si necesita hablar con un comercial o si puede acudir a la direccion indicada en la web.',
            config.business.city ? `Ciudad: ${config.business.city}.` : '',
            config.business.phone ? `Telefono comercial: ${config.business.phone}.` : ''
          ]
            .filter(Boolean)
            .join('\n')
        },
        {
          role: 'user',
          content: JSON.stringify({
            canal: event.channel,
            mensajeCliente: event.text,
            intencionDetectada: lead.intent,
            vehiculoDetectado: lead.vehicle,
            presupuestoDetectado: lead.budget
          })
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI reply failed: ${response.status} ${body}`);
  }

  const payload = await response.json();

  return payload.choices[0]?.message?.content?.trim() || buildRuleReply(lead);
}

function buildRuleReply(lead) {
  const text = normalize(lead.message);

  if (isGreetingOrStart(text)) {
    return [
      'Hola, con que puedo ayudarte?',
      'Dime por favor que estas buscando: comprar un vehiculo o vender el tuyo.'
    ].join(' ');
  }

  if (mentionsFinancing(text)) {
    return [
      'Sobre financiacion: en nuestra pagina web puedes simular tu caso particular indicando cantidad, meses y porcentaje.',
      'Para poder hacer la financiacion normalmente necesitas nomina, DNI o NIE en vigor y una situacion bancaria que permita aprobar la operacion.',
      'Si tienes mucho credito, hipotecas, impagos o normalmente te quedas sin saldo a final de mes, es muy poco probable que la financiera acepte.',
      'Tambien es importante acudir a nuestras instalaciones para presentar la documentacion, probar el vehiculo y facilitarnos tus datos personales: telefono, email y situacion familiar, como numero de hijos.'
    ].join(' ');
  }

  if (lead.intent === 'sell_vehicle') {
    return [
      `Gracias por escribir a ${config.business.name}.`,
      'Para valorar tu vehiculo, enviame marca, modelo, ano, kilometros, estado general, ubicacion y 3 o 4 fotos.',
      'Con eso un asesor te prepara una respuesta.'
    ].join(' ');
  }

  if (lead.intent === 'buy_vehicle') {
    return [
      'Perfecto, para poder ayudarte con la compra necesito algunos datos.',
      'Dime por favor tu presupuesto maximo, el modelo o tipo de vehiculo que buscas y las caracteristicas importantes: cambio automatico o manual, combustible, kilometros aproximados, plazas, ano y cualquier detalle que sea importante para ti.'
    ].join(' ');
  }

  if (mentionsCatalogOrCar(text)) {
    return [
      'Puedes ver nuestro catalogo actualizado en www.autoselect.info.',
      'Si estas interesado en algun coche del catalogo, dime cual es.',
      'Tambien dime si necesitas hablar con un comercial o si puedes acudir a la direccion indicada en autoselect.info.'
    ].join(' ');
  }

  if (isLowInformationReply(text)) {
    return 'Gracias, un comercial de AutoSelect se pondra en contacto contigo para continuar.';
  }

  return 'Gracias por la informacion. Un comercial de AutoSelect revisara tu caso y se pondra en contacto contigo.';
}

function shouldUsePriorityRule(lead) {
  const text = normalize(lead.message);

  return (
    isGreetingOrStart(text) ||
    mentionsFinancing(text) ||
    mentionsCatalogOrCar(text) ||
    lead.intent === 'buy_vehicle' ||
    lead.intent === 'sell_vehicle' ||
    isLowInformationReply(text)
  );
}

function normalize(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isGreetingOrStart(text) {
  const cleaned = text.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  return /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hello|hi|ola)$/.test(cleaned);
}

function mentionsFinancing(text) {
  return /\b(financiacion|financiar|financiado|financiera|credito|creditos|cuota|cuotas)\b/.test(text);
}

function mentionsCatalogOrCar(text) {
  return /\b(coche|coches|vehiculo|vehiculos|catalogo|stock|web|pagina)\b/.test(text);
}

function isLowInformationReply(text) {
  const cleaned = text.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  return /^(ok|vale|si|no|gracias|perfecto|de acuerdo|lo veo|me interesa|\?)$/.test(cleaned) || cleaned.length <= 2;
}
