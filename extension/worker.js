function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inlineAssetsInText(text, assets) {
  return assets.reduce((acc, asset) => {
    if (!asset.dataUri) return acc;
    const pattern = new RegExp(escapeRegExp(asset.url), 'g');
    return acc.replace(pattern, asset.dataUri);
  }, text);
}

function buildInlineHandlerScript(capture) {
  if (!capture.inlineHandlers || !capture.inlineHandlers.length) {
    return '';
  }
  const lines = [];
  lines.push('(function(){');
  lines.push("  const nodes = new Map();");
  lines.push(
    "  document.querySelectorAll('[data-clip-index]').forEach(node => nodes.set(Number(node.getAttribute('data-clip-index')), node));"
  );
  capture.inlineHandlers.forEach(entry => {
    lines.push(
      `  { const node = nodes.get(${entry.index}); if (!node) return; node.setAttribute('on${entry.type}', ${JSON.stringify(entry.handler)}); }`
    );
  });
  lines.push('})();');
  return lines.join('\n');
}

function buildListenerScript(capture) {
  if (!capture.listeners || !capture.listeners.length) {
    return '';
  }
  const lines = [];
  lines.push('(function(){');
  lines.push("  const nodes = new Map();");
  lines.push(
    "  document.querySelectorAll('[data-clip-index]').forEach(node => nodes.set(Number(node.getAttribute('data-clip-index')), node));"
  );
  lines.push('  const add = (index, type, options, source) => {');
  lines.push('    const node = nodes.get(index);');
  lines.push("    if (!node) return;");
  lines.push("    const handler = typeof source === 'function' ? source : (0, eval)(source);");
  lines.push('    try {');
  lines.push('      node.addEventListener(type, handler, options);');
  lines.push('    } catch (error) {');
  lines.push('      console.warn("Clip2Demo: unable to reattach listener", { type, error });');
  lines.push('    }');
  lines.push('  };');
  capture.listeners.forEach(listener => {
    const fallback = `() => console.warn('Clip2Demo: missing listener body for ${listener.type}')`;
    const source = listener.handler ? `(${listener.handler})` : fallback;
    lines.push(
      `  add(${listener.index}, '${listener.type}', { capture: ${listener.useCapture}, passive: ${listener.passive}, once: ${listener.once} }, ${JSON.stringify(source)});`
    );
  });
  lines.push('})();');
  return lines.join('\n');
}

function buildScript(capture) {
  const blocks = [];
  const inlineHandlers = buildInlineHandlerScript(capture);
  if (inlineHandlers) {
    blocks.push(inlineHandlers);
  }
  const listeners = buildListenerScript(capture);
  if (listeners) {
    blocks.push(listeners);
  }
  return blocks.join('\n\n');
}

function assembleSingleFile(capture) {
  const assets = capture.assets || [];
  const html = inlineAssetsInText(capture.html, assets);
  const css = inlineAssetsInText(capture.css?.cssText || '', assets);
  const script = buildScript(capture);
  const doc = `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>Clip2Demo export</title>\n<style>\n${css}\n</style>\n</head>\n<body>\n${html}\n${script ? `<script>\n${script}\n</script>` : ''}\n</body>\n</html>`;
  return doc;
}

function buildCodePenPayload(capture) {
  const assets = capture.assets || [];
  const html = inlineAssetsInText(capture.html, assets);
  const css = inlineAssetsInText(capture.css?.cssText || '', assets);
  const js = buildScript(capture);
  return { html, css, js, title: 'Clip2Demo export', editors: '101' };
}

function openCodePen(payload) {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const form = `<!doctype html>\n<html><body><form id="pen" action="https://codepen.io/pen/define" method="post" target="_blank">\n<input type="hidden" name="data" value='${encoded}' />\n</form><script>document.getElementById('pen').submit();</script></body></html>`;
  const url = 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(form)));
  chrome.tabs.create({ url }, () => {
    if (chrome.runtime.lastError) {
      console.error('Clip2Demo CodePen open failed', chrome.runtime.lastError.message);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'clip2demo.assemble') {
    return;
  }
  (async () => {
    try {
      const capture = message.payload;
      if (!capture) throw new Error('Missing payload');
      if (message.outputMode === 'codepen') {
        const payload = buildCodePenPayload(capture);
        openCodePen(payload);
        sendResponse({ message: 'Opened CodePen preview', package: capture });
        return;
      }
      const html = assembleSingleFile(capture);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      await chrome.downloads.download({ url, filename: 'clip2demo.html', saveAs: true });
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      sendResponse({ html, message: 'Downloaded clip2demo.html' });
    } catch (error) {
      console.error('Clip2Demo assemble failed', error);
      sendResponse({ error: error.message });
    }
  })();
  return true;
});
