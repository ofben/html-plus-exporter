export type AssetKind = 'resource' | 'image' | 'font';

export interface AssetContext {
  index: number;
  attribute?: string;
  property?: string;
}

export interface AssetRecord {
  type: AssetKind;
  url: string;
  contexts: AssetContext[];
  dataUri?: string | null;
}

async function fetchDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    return null;
  }
}

export async function collectAssets(root: Element, inline: boolean, cssText?: string): Promise<AssetRecord[]> {
  const assets = new Map<string, AssetRecord>();
  const add = (type: AssetKind, url: string | null, context: AssetContext) => {
    if (!url) return;
    try {
      url = new URL(url, location.href).href;
    } catch (error) {
      // ignore resolution errors
    }
    if (!url) return;
    const key = `${type}:${url}`;
    const existing = assets.get(key);
    if (existing) {
      existing.contexts.push(context);
    } else {
      assets.set(key, { type, url, contexts: [context], dataUri: null });
    }
  };

  const nodes = [root, ...root.querySelectorAll('*')];
  nodes.forEach((node, index) => {
    if (node.hasAttribute('src')) {
      add('resource', node.getAttribute('src'), { index, attribute: 'src' });
    }
    if (node.hasAttribute('href')) {
      add('resource', node.getAttribute('href'), { index, attribute: 'href' });
    }
    const computed = getComputedStyle(node);
    const background = computed.getPropertyValue('background-image');
    if (background && background.includes('url(')) {
      const urls = Array.from(background.matchAll(/url\(("|'|)([^"')]+)\1\)/g)).map(match => match[2]);
      urls.forEach(url => add('image', url, { index, property: 'background-image' }));
    }
  });

  if (cssText && cssText.includes('url(')) {
    const urls = Array.from(cssText.matchAll(/url\(("|'|)([^"')]+)\1\)/g)).map(match => match[2]);
    urls.forEach(url => add('font', url, { index: -1 }));
  }

  if (inline) {
    await Promise.all(
      Array.from(assets.values()).map(async asset => {
        asset.dataUri = await fetchDataUri(asset.url);
      })
    );
  }

  return Array.from(assets.values());
}
