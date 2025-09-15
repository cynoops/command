'use strict';

function registerAIIPC({ ipcMain, fetch }, state) {
  ipcMain.handle('ai:transform-drawing', async (_e, { feature, prompt, apiKey: providedKey }) => {
    try {
      const apiKey = providedKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return { ok: false, error: 'Missing OPENAI_API_KEY in environment.' };
      }
      const geomStr = JSON.stringify(feature?.geometry || null);
      const sys = [
        'You are a mapping assistant. Your task is to transform a given geometry into new geometries as requested.',
        'Output strictly a GeoJSON FeatureCollection in JSON with no additional commentary.',
        'Use WGS84 lon/lat coordinates. Keep topology valid. Ensure arrays are numeric.',
      ].join(' ');
      const user = [
        'Original geometry (GeoJSON):', geomStr,
        'Instruction:', String(prompt || '').trim() || 'Return the given geometry unchanged.',
        'Return only: {"type":"FeatureCollection","features":[...]}',
      ].join('\n');

      const body = JSON.stringify({
        model: 'gpt-5',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
      });

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body
      });
      const data = await resp.json();
      if (!resp.ok) {
        return { ok: false, error: data?.error?.message || String(resp.statusText || 'OpenAI request failed') };
      }
      const text = data?.choices?.[0]?.message?.content || '';
      let jsonStr = text.trim();
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace > 0 || lastBrace >= 0) jsonStr = jsonStr.slice(Math.max(0, firstBrace), lastBrace + 1);
      let fc = null;
      try { fc = JSON.parse(jsonStr); } catch (e) {
        return { ok: false, error: 'Failed to parse model output as JSON FeatureCollection.' };
      }
      if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
        return { ok: false, error: 'Model output is not a valid GeoJSON FeatureCollection.' };
      }
      return { ok: true, featureCollection: fc };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  });
}

module.exports = { registerAIIPC };

