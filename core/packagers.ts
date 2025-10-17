import type { CssCollectionResult } from './cssCollector';
import type { InlineHandler, EventListenerRecord } from './jsCollector';
import type { AssetRecord } from './assetFetcher';

export interface CapturePackage {
  html: string;
  css: CssCollectionResult;
  inlineHandlers: InlineHandler[];
  listeners: EventListenerRecord[];
  assets: AssetRecord[];
}

export interface SingleFileResult {
  html: string;
}

export interface CodePenPayload {
  html: string;
  css: string;
  js: string;
  title: string;
  editors: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inlineAssets(text: string, assets: AssetRecord[]): string {
  return assets.reduce((acc, asset) => {
    if (!asset.dataUri) return acc;
    const pattern = new RegExp(escapeRegExp(asset.url), 'g');
    return acc.replace(pattern, asset.dataUri);
  }, text);
}

function buildInlineHandlerScript(handlers: InlineHandler[]): string {
  if (!handlers.length) return '';
  const lines = [];
  lines.push('(function(){');
  lines.push("  const nodes = new Map();");
  lines.push(
    "  document.querySelectorAll('[data-clip-index]').forEach(node => nodes.set(Number(node.getAttribute('data-clip-index')), node));"
  );
  handlers.forEach(handler => {
    lines.push(
      `  { const node = nodes.get(${handler.index}); if (!node) return; node.setAttribute('on${handler.type}', ${JSON.stringify(handler.handler)}); }`
    );
  });
  lines.push('})();');
  return lines.join('\n');
}

function buildListenerScript(listeners: EventListenerRecord[]): string {
  if (!listeners.length) return '';
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
  listeners.forEach(listener => {
    const fallback = `() => console.warn('Clip2Demo: missing listener body for ${listener.type}')`;
    const source = listener.handler ? `(${listener.handler})` : fallback;
    lines.push(
      `  add(${listener.index}, '${listener.type}', { capture: ${listener.useCapture}, passive: ${listener.passive}, once: ${listener.once} }, ${JSON.stringify(source)});`
    );
  });
  lines.push('})();');
  return lines.join('\n');
}

function buildScript(handlers: InlineHandler[], listeners: EventListenerRecord[]): string {
  const blocks = [];
  const inlineHandlers = buildInlineHandlerScript(handlers);
  if (inlineHandlers) blocks.push(inlineHandlers);
  const listenersScript = buildListenerScript(listeners);
  if (listenersScript) blocks.push(listenersScript);
  return blocks.join('\n\n');
}

export function toSingleFile(pkg: CapturePackage): SingleFileResult {
  const html = inlineAssets(pkg.html, pkg.assets);
  const css = inlineAssets(pkg.css.cssText, pkg.assets);
  const script = buildScript(pkg.inlineHandlers, pkg.listeners);
  const documentHtml = `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8" />\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n<title>Clip2Demo export</title>\n<style>\n${css}\n</style>\n</head>\n<body>\n${html}\n${script ? `<script>\n${script}\n</script>` : ''}\n</body>\n</html>`;
  return { html: documentHtml };
}

export function toCodePenPayload(pkg: CapturePackage): CodePenPayload {
  const html = inlineAssets(pkg.html, pkg.assets);
  const css = inlineAssets(pkg.css.cssText, pkg.assets);
  const js = buildScript(pkg.inlineHandlers, pkg.listeners);
  return { html, css, js, title: 'Clip2Demo export', editors: '101' };
}
