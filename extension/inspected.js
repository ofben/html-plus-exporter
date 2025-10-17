(function () {
  if (window.__clip2demoCapture) {
    return;
  }

  const VERSION = '0.1.0';
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
    'animation-name',
    'animation-duration',
    'animation-timing-function'
  ];

  function resolveTarget(scope, selector) {
    if (scope === 'selector' && selector) {
      return document.querySelector(selector);
    }
    if (typeof $0 !== 'undefined' && $0) {
      return $0;
    }
    return document.body;
  }

  function absoluteURL(url) {
    if (!url) return url;
    try {
      return new URL(url, location.href).href;
    } catch (error) {
      return url;
    }
  }

  function cloneWithComputed(root, mode) {
    const clone = root.cloneNode(true);
    const originals = [root, ...root.querySelectorAll('*')];
    const clones = [clone, ...clone.querySelectorAll('*')];
    originals.forEach((node, index) => {
      const cloneNode = clones[index];
      if (!(node instanceof Element) || !(cloneNode instanceof Element)) {
        return;
      }
      cloneNode.setAttribute('data-clip-index', String(index));
      if (mode !== 'minimal') {
        return;
      }
      const computed = getComputedStyle(node);
      FALLBACK_PROPERTIES.forEach(prop => {
        if (cloneNode.style.getPropertyValue(prop)) {
          return;
        }
        const value = computed.getPropertyValue(prop);
        if (!value || value === 'initial' || value === 'auto') {
          return;
        }
        try {
          cloneNode.style.setProperty(prop, value, computed.getPropertyPriority(prop));
        } catch (error) {
          // ignore unsupported properties
        }
      });
    });

    return clone;
  }

  function serializeHTML(root, options) {
    const workingClone = cloneWithComputed(root, options.cssMode);
    const container = document.createElement('div');
    container.appendChild(workingClone);

    container.querySelectorAll('[src], [href]').forEach(node => {
      const attr = node.hasAttribute('src') ? 'src' : 'href';
      node.setAttribute(attr, absoluteURL(node.getAttribute(attr)));
    });

    const shadowHosts = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    const cloneWalker = document.createTreeWalker(workingClone, NodeFilter.SHOW_ELEMENT);
    while (true) {
      const original = walker.currentNode;
      const cloneNode = cloneWalker.currentNode;
      if (!original || !cloneNode) break;
      if (original.shadowRoot) {
        shadowHosts.push({ original, cloneNode });
      }
      if (!walker.nextNode()) break;
      cloneWalker.nextNode();
    }

    shadowHosts.forEach(({ original, cloneNode }) => {
      const shadow = original.shadowRoot;
      if (!shadow) return;
      const shadowClone = shadow.cloneNode(true);
      const placeholder = document.createComment('shadow-root-start');
      const endPlaceholder = document.createComment('shadow-root-end');
      cloneNode.appendChild(placeholder);
      Array.from(shadowClone.childNodes).forEach(node => cloneNode.appendChild(node));
      cloneNode.appendChild(endPlaceholder);
    });

    return {
      html: container.innerHTML,
    };
  }

  function fontFamilyTokens(value) {
    if (!value) return [];
    return value
      .split(',')
      .map(token => token.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  function animationTokens(value) {
    if (!value) return [];
    return value
      .split(',')
      .map(token => token.trim().split(' ')[0])
      .filter(name => name && name !== 'none');
  }

  function collectCSS(root) {
    const doc = root.ownerDocument;
    const container = doc.createElement('div');
    container.style.all = 'initial';
    container.style.display = 'contents';
    container.appendChild(root.cloneNode(true));
    doc.documentElement.appendChild(container);

    const usedRules = new Map();
    const usedFonts = new Set();
    const usedKeyframes = new Set();

    const remember = (key, cssText) => {
      if (!usedRules.has(key)) {
        usedRules.set(key, cssText);
      }
      return usedRules.get(key);
    };

    const visitRule = (rule, sheetId) => {
      if (rule.type === CSSRule.STYLE_RULE) {
        let matches = false;
        try {
          matches = Boolean(container.querySelector(rule.selectorText));
        } catch (error) {
          matches = false;
        }
        if (matches) {
          const cssText = rule.cssText;
          remember(`${sheetId}|${rule.selectorText}|${cssText}`, cssText);
          fontFamilyTokens(rule.style.fontFamily).forEach(family => usedFonts.add(family));
          animationTokens(rule.style.animationName).forEach(name => usedKeyframes.add(name));
          return cssText;
        }
        return null;
      }
      if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE) {
        const fragments = [];
        for (const child of Array.from(rule.cssRules)) {
          const childText = visitRule(child, `${sheetId}@${rule.conditionText}`);
          if (childText) {
            fragments.push(childText);
          }
        }
        if (fragments.length) {
          const header = rule.type === CSSRule.MEDIA_RULE ? '@media' : '@supports';
          const cssText = `${header} ${rule.conditionText} {\n${fragments.join('\n')}\n}`;
          remember(`${sheetId}|${header}|${rule.conditionText}`, cssText);
          return cssText;
        }
        return null;
      }
      if (rule.type === CSSRule.FONT_FACE_RULE) {
        const family = rule.style.getPropertyValue('font-family').replace(/^['"]|['"]$/g, '');
        if (usedFonts.has(family)) {
          return remember(`${sheetId}|font-face|${family}`, rule.cssText);
        }
        return null;
      }
      if (rule.type === CSSRule.KEYFRAMES_RULE) {
        if (usedKeyframes.has(rule.name)) {
          return remember(`${sheetId}|keyframes|${rule.name}`, rule.cssText);
        }
        return null;
      }
      return null;
    };

    for (const sheet of Array.from(doc.styleSheets)) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (error) {
        continue;
      }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        visitRule(rule, sheet.href || 'inline');
      }
    }

    container.remove();

    return {
      cssText: Array.from(usedRules.values()).join('\n'),
      fonts: Array.from(usedFonts.values()),
      keyframes: Array.from(usedKeyframes.values()),
    };
  }
  async function assetToDataURL(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch asset');
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      return null;
    }
  }

  async function collectAssets(root, options, cssText) {
    const assets = new Map();
    const addAsset = (type, url, context) => {
      if (!url) return;
      const key = `${type}:${url}`;
      if (!assets.has(key)) {
        assets.set(key, { type, url: absoluteURL(url), contexts: [context], dataUri: null });
      } else {
        assets.get(key).contexts.push(context);
      }
    };

    const elements = [root, ...root.querySelectorAll('*')];
    elements.forEach((el, index) => {
      if (!(el instanceof Element)) return;
      if (el.hasAttribute('src')) {
        addAsset('resource', el.getAttribute('src'), { index, attribute: 'src' });
      }
      if (el.hasAttribute('href')) {
        addAsset('resource', el.getAttribute('href'), { index, attribute: 'href' });
      }
      const computed = getComputedStyle(el);
      const bg = computed.getPropertyValue('background-image');
      if (bg && bg.includes('url(')) {
        const urls = Array.from(bg.matchAll(/url\(("|'|)([^"')]+)\1\)/g)).map(match => match[2]);
        urls.forEach(url => addAsset('image', url, { index, property: 'background-image' }));
      }
    });

    if (typeof cssText === 'string' && cssText.includes('url(')) {
      const urls = Array.from(cssText.matchAll(/url\(("|'|)([^"')]+)\1\)/g)).map(match => match[2]);
      urls.forEach(url => addAsset('font', url, { index: -1 }));
    }

    if (options.inlineAssets) {
      for (const asset of assets.values()) {
        asset.dataUri = await assetToDataURL(asset.url);
      }
    }

    return Array.from(assets.values());
  }

  function collectInlineHandlers(root) {
    const entries = [];
    const elements = [root, ...root.querySelectorAll('*')];
    elements.forEach((el, index) => {
      if (!(el instanceof Element)) return;
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          entries.push({
            index,
            type: attr.name.substring(2),
            handler: attr.value,
          });
        }
      });
    });
    return entries;
  }

  function collectEventListeners(root) {
    if (typeof getEventListeners !== 'function') {
      return [];
    }
    const results = [];
    const elements = [root, ...root.querySelectorAll('*')];
    elements.forEach((el, index) => {
      const map = getEventListeners(el);
      for (const [type, listeners] of Object.entries(map)) {
        listeners.forEach(listener => {
          results.push({
            index,
            type,
            useCapture: Boolean(listener.useCapture),
            passive: Boolean(listener.passive),
            once: Boolean(listener.once),
            handler: listener.listener ? String(listener.listener) : null,
          });
        });
      }
    });
    return results;
  }

  window.__clip2demoCapture = async function (options) {
    try {
      const target = resolveTarget(options.scope, options.selector);
      if (!target) {
        return { error: 'Unable to resolve target element' };
      }

      const { html } = serializeHTML(target, options);
      const css = collectCSS(target);
      const assets = await collectAssets(target, options, css.cssText);
      const inlineHandlers = collectInlineHandlers(target);
      const listeners = options.includeJS ? collectEventListeners(target) : [];

      return {
        version: VERSION,
        capturedAt: new Date().toISOString(),
        html,
        css,
        assets,
        inlineHandlers,
        listeners,
        options,
      };
    } catch (error) {
      return { error: error.message, stack: error.stack };
    }
  };
})();
