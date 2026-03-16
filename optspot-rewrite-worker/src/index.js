export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders()
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST required' }, 405);
    }

    try {
      const body = await request.json();
      const { currentText, type, dayLabel, purpose, title, strategy, washName, voice, charLimit } = body;

      if (!currentText || !type) {
        return json({ error: 'Missing required fields' }, 400);
      }

      if (!env.CLAUDE_API_KEY) {
        return json({ error: 'API key not configured' }, 500);
      }

      const limit = charLimit || (type === 'sms' ? 160 : 500);

      const systemPrompt = 'You are an expert SMS/MMS copywriter for car wash businesses. You write messages that feel human, lead with value, and never feel salesy. You understand the car wash industry and membership conversion psychology.';

      const userPrompt = `Rewrite this ${type.toUpperCase()} message for a car wash text club campaign. Keep the same intent and purpose but make it feel fresh and different.

CURRENT MESSAGE:
${currentText}

CONTEXT:
- Car wash name: ${washName || '[Wash Name]'}
- Day in sequence: ${dayLabel || ''}
- Purpose: ${purpose || ''}
- Message title: ${title || ''}
- Brand voice: ${voice || 'friendly'}
- Strategy: ${strategy || ''}

RULES:
- MUST be under ${limit} characters (this is critical)
- Keep all merge tags exactly as they appear (like ~redeem~, ~share~, ~date14~, ~mycoupon~)
- Keep any compliance text (Rply Stop2Stop, etc.) exactly as-is at the end
- Keep the membership link placeholder if present
- Lead with value, not pressure
- Sound human, not corporate
- Match the ${voice || 'friendly'} brand voice

Return ONLY the rewritten message text. No quotes, no explanation, no preamble.`;

      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        return json({ error: 'Claude API error (' + claudeRes.status + '): ' + errText }, claudeRes.status);
      }

      const data = await claudeRes.json();
      let text = data.content[0].text.trim();

      // Strip wrapping quotes if present
      if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
        text = text.slice(1, -1);
      }

      return json({ text });

    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
