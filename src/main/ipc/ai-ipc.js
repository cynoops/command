'use strict';

// Refactored to use the official OpenAI JS SDK
let OpenAI;
try {
  const openaiModule = require('openai');
  OpenAI = openaiModule?.OpenAI || openaiModule;
} catch {}

function registerAIIPC({ ipcMain }, state) {
  ipcMain.handle('ai:transform-drawing', async (_e, { feature, prompt, apiKey: providedKey }) => {
    try {
      const apiKey = providedKey || process.env.OPENAI_API_KEY;

      if (!apiKey) {
        return { ok: false, error: 'Missing OPENAI_API_KEY in environment.' };
      }
      if (!OpenAI) {
        try {
          const openaiModule = require('openai');
          OpenAI = openaiModule?.OpenAI || openaiModule;
        }
        catch { return { ok:false, error:'OpenAI SDK not installed. Add \'openai\' to dependencies and run npm install.' }; }
      }
      const geomStr = JSON.stringify(feature?.geometry || null);

      const client = new OpenAI({ apiKey });
      const messages = [
        { role: 'system', content: 'You are a mapping assistant. Your task is to transform a given geometry into new geometries as requested.' },
        { role: 'system', content: 'Output strictly a GeoJSON FeatureCollection in JSON with no additional commentary.' },
        { role: 'system', content: 'Use WGS84 lon/lat coordinates. Keep topology valid. Ensure arrays are numeric.' },
        { role: 'user', content: 'Original geometry (GeoJSON):' + geomStr },
        { role: 'user', content: 'Instruction:' + (String(prompt || '').trim() || 'Return the given geometry unchanged.'), },
        { role: 'user', content: 'Return only: {"type":"FeatureCollection","features":[...]}' }
      ];

      let text = '';
      if (client?.chat?.completions?.create) {
        console.log(messages);
        const completion = await client.chat.completions.create({
          model: 'gpt-4.1',
          response_format: { type: 'json_object' },
          messages,
        });
        text = completion?.choices?.[0]?.message?.content || '';
        console.log(text)
      } else if (client?.responses?.create) {
        const response = await client.responses.create({
          model: 'gpt-4.1',
          response_format: { type: 'json_object' },
          input: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        const segments = [];
        const collectText = (node) => {
          if (!node) return;
          if (Array.isArray(node)) { node.forEach(collectText); return; }
          if (typeof node === 'string') { segments.push(node); return; }
          if (typeof node === 'object') {
            if (typeof node.text === 'string') segments.push(node.text);
            if (Array.isArray(node.content)) collectText(node.content);
          }
        };
        collectText(response?.output);
        collectText(response?.content);
        text = segments.join('');
      } else {
        return { ok: false, error: 'OpenAI client does not support chat completions or responses API.' };
      }

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
