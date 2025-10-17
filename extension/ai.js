const DEFAULT_MODEL = 'gpt-4o-mini';

export async function callLLM(prompt, options = {}) {
  if (!chrome?.storage) {
    throw new Error('Chrome storage API unavailable');
  }
  const settings = await new Promise(resolve => {
    chrome.storage.sync.get(['apiEndpoint', 'apiKey', 'model'], resolve);
  });
  const endpoint = options.endpoint || settings.apiEndpoint;
  const apiKey = options.apiKey || settings.apiKey;
  const model = options.model || settings.model || DEFAULT_MODEL;
  if (!endpoint || !apiKey) {
    throw new Error('LLM API endpoint or key missing. Configure in extension options.');
  }
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1024,
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM response missing content');
  }
  return content;
}

export async function minimizeCss(html, css) {
  const prompt = `You are a CSS refactorer. Given the HTML and CSS below, return a minimal CSS that preserves the visuals.\n\nHTML:\n${html}\n\nCSS:\n${css}`;
  return callLLM(prompt, { maxTokens: 1500, temperature: 0.1 });
}

export async function restoreBehavior(html, listenersJson) {
  const prompt = `You are a UI behavior restorer. Given the HTML and listeners below, produce vanilla JS to mimic interactions.\n\nHTML:\n${html}\n\nListeners:\n${listenersJson}`;
  return callLLM(prompt, { maxTokens: 1500, temperature: 0.2 });
}
