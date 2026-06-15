// Vercel Serverless Function — прокси к OpenRouter.
// Путь запроса со страницы: POST /api/chat
// Ключ берётся ТОЛЬКО из переменной окружения OPENROUTER_API_KEY,
// никогда из тела запроса и никогда из кода.

export default async function handler(req, res) {
  // Разрешаем только POST.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Используйте POST.' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // Ключ не настроен в окружении Vercel.
    return res.status(500).json({
      error: 'Серверная ошибка: не задана переменная окружения OPENROUTER_API_KEY.'
    });
  }

  // req.body на Vercel уже распарсен в объект, если Content-Type: application/json.
  // На всякий случай обрабатываем и строку.
  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return res.status(400).json({ error: 'Некорректный JSON в теле запроса.' });
    }
  }

  if (!payload || !Array.isArray(payload.messages)) {
    return res.status(400).json({ error: 'В теле запроса ожидается поле "messages" (массив).' });
  }

  // Пробрасываем параметры запроса как есть, но игнорируем любой ключ,
  // который мог бы прийти из браузера (на случай если фронт что-то прислал).
  const { apiKey: _ignoredKey, ...forwardBody } = payload;

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Необязательные заголовки OpenRouter для атрибуции трафика.
        'HTTP-Referer': req.headers.origin || req.headers.referer || 'https://vercel.app',
        'X-Title': 'RNMM Marketing Assistant'
      },
      body: JSON.stringify(forwardBody)
    });

    // Возвращаем ответ OpenRouter «как есть»: и тело, и статус-код.
    const text = await upstream.text();
    res
      .status(upstream.status)
      .setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
      .send(text);
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(502).json({
      error: 'Не удалось связаться с OpenRouter: ' + (err && err.message ? err.message : 'unknown error')
    });
  }
}
