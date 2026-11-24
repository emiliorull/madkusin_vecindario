const key = process.env.GEMINI_API_KEY || '';
const ttsModels = [
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts'
];

for (const model of ttsModels) {
  const start = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hola, soy Kusin del taller de Emil.' }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Aoede' }
              }
            }
          }
        }),
        signal: AbortSignal.timeout(6000)
      }
    );
    const body = await res.json();
    const ms = Date.now() - start;
    if (res.ok) {
      const mime = body.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType;
      const len = body.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data?.length;
      console.log(`✅ TTS ${model} (${ms}ms): mime=${mime}, base64Len=${len}`);
    } else {
      console.log(`❌ TTS ${model} (${res.status} - ${ms}ms):`, body.error?.message?.slice(0, 100));
    }
  } catch (e) {
    console.log(`⏱️ TTS ${model}:`, e.message);
  }
}
