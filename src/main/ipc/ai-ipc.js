'use strict';

// Refactored to use the official OpenAI JS SDK
let OpenAI;
try { OpenAI = require('openai'); } catch {}

function registerAIIPC({ ipcMain }, state) {
  ipcMain.handle('ai:transform-drawing', async (_e, { feature, prompt, apiKey: providedKey }) => {
    try {
      const apiKey = providedKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return { ok: false, error: 'Missing OPENAI_API_KEY in environment.' };
      }
      if (!OpenAI) {
        try { OpenAI = require('openai'); }
        catch { return { ok:false, error:'OpenAI SDK not installed. Add \'openai\' to dependencies and run npm install.' }; }
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

      const client = new OpenAI({ apiKey });
      const completion = await client.chat.completions.create({
        model: 'gpt-5',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
      });
      const text = completion?.choices?.[0]?.message?.content || '';
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
