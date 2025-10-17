export type CssMode = 'raw' | 'minimal';

export interface SerializeOptions {
  cssMode: CssMode;
  baseUrl?: string;
}

export interface SerializedHtml {
  html: string;
  nodeCount: number;
}

const FALLBACK_PROPERTIES = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'flex',
  'flex-direction',
  'flex-wrap',
  'align-items',
  'justify-content',
  'gap',
  'grid',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border',
  'border-radius',
  'box-shadow',
  'background',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'color',
  'font',
  'font-family',
  'font-weight',
  'font-size',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-decoration',
  'text-align',
  'white-space',
  'overflow',
  'overflow-x',
  'overflow-y',
  'opacity',
  'transform',
  'transition',
  'animation',
];

function absoluteURL(url: string | null, baseUrl?: string): string | null {
  if (!url) return url;
  try {
    return new URL(url, baseUrl ?? (typeof location !== 'undefined' ? location.href : undefined)).href;
  } catch (error) {
    return url;
  }
}

function annotateClone(root: Element, clone: Element, cssMode: CssMode) {
  const originals: Element[] = [root, ...root.querySelectorAll('*')];
  const clones: Element[] = [clone, ...clone.querySelectorAll('*')];
  originals.forEach((node, index) => {
    const cloned = clones[index];
    if (!cloned) return;
    cloned.setAttribute('data-clip-index', String(index));
    if (cssMode !== 'minimal') {
      return;
    }
    const computed = getComputedStyle(node);
    FALLBACK_PROPERTIES.forEach(prop => {
      if (cloned.style.getPropertyValue(prop)) return;
      const value = computed.getPropertyValue(prop);
      if (!value || value === 'initial' || value === 'auto') return;
      cloned.style.setProperty(prop, value, computed.getPropertyPriority(prop));
    });
  });
}

export function serializeSubtree(root: Element, options: SerializeOptions): SerializedHtml {
  const clone = root.cloneNode(true) as Element;
  annotateClone(root, clone, options.cssMode);
  const container = root.ownerDocument.createElement('div');
  container.appendChild(clone);

  container.querySelectorAll('[src], [href]').forEach(node => {
    const attr = node.hasAttribute('src') ? 'src' : 'href';
    const resolved = absoluteURL(node.getAttribute(attr), options.baseUrl);
    if (resolved) {
      node.setAttribute(attr, resolved);
    }
  });

  const shadowHosts: Array<{ original: Element; cloneNode: Element }> = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const cloneWalker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
  while (true) {
    const original = walker.currentNode as Element | null;
    const mirrored = cloneWalker.currentNode as Element | null;
    if (!original || !mirrored) break;
    if (original.shadowRoot) {
      shadowHosts.push({ original, cloneNode: mirrored });
    }
    if (!walker.nextNode()) break;
    cloneWalker.nextNode();
  }

  shadowHosts.forEach(({ original, cloneNode }) => {
    const shadow = original.shadowRoot;
    if (!shadow) return;
    const shadowClone = shadow.cloneNode(true);
    const start = document.createComment('shadow-root-start');
    const end = document.createComment('shadow-root-end');
    cloneNode.appendChild(start);
    Array.from(shadowClone.childNodes).forEach(node => cloneNode.appendChild(node));
    cloneNode.appendChild(end);
  });

  return {
    html: container.innerHTML,
    nodeCount: clonesLength(clone),
  };
}

function clonesLength(root: Element): number {
  return 1 + root.querySelectorAll('*').length;
}
