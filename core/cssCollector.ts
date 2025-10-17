export interface CssCollectionResult {
  cssText: string;
  fonts: string[];
  keyframes: string[];
}

function fontFamilyTokens(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(token => token.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function animationTokens(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(token => token.trim().split(' ')[0])
    .filter(name => name && name !== 'none');
}

export function collectCssForSubtree(root: Element): CssCollectionResult {
  const doc = root.ownerDocument;
  const container = doc.createElement('div');
  container.style.all = 'initial';
  container.style.display = 'contents';
  container.appendChild(root.cloneNode(true));
  doc.documentElement.appendChild(container);

  const usedRules = new Map<string, string>();
  const usedFonts = new Set<string>();
  const usedKeyframes = new Set<string>();

  const remember = (key: string, cssText: string) => {
    if (!usedRules.has(key)) {
      usedRules.set(key, cssText);
    }
    return usedRules.get(key)!;
  };

  const visitRule = (rule: CSSRule, sheetId: string): string | null => {
    if (rule.type === CSSRule.STYLE_RULE) {
      const styleRule = rule as CSSStyleRule;
      let matches = false;
      try {
        matches = Boolean(container.querySelector(styleRule.selectorText));
      } catch (error) {
        matches = false;
      }
      if (matches) {
        const cssText = styleRule.cssText;
        remember(`${sheetId}|${styleRule.selectorText}|${cssText}`, cssText);
        fontFamilyTokens(styleRule.style.fontFamily).forEach(family => usedFonts.add(family));
        animationTokens(styleRule.style.animationName).forEach(name => usedKeyframes.add(name));
        return cssText;
      }
      return null;
    }
    if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE) {
      const group = rule as CSSMediaRule | CSSSupportsRule;
      const fragments: string[] = [];
      Array.from(group.cssRules).forEach(child => {
        const childText = visitRule(child, `${sheetId}@${(group as any).conditionText}`);
        if (childText) {
          fragments.push(childText);
        }
      });
      if (fragments.length) {
        const header = rule.type === CSSRule.MEDIA_RULE ? '@media' : '@supports';
        const cssText = `${header} ${(group as any).conditionText} {\n${fragments.join('\n')}\n}`;
        remember(`${sheetId}|${header}|${(group as any).conditionText}`, cssText);
        return cssText;
      }
      return null;
    }
    if (rule.type === CSSRule.FONT_FACE_RULE) {
      const fontFace = rule as CSSFontFaceRule;
      const family = fontFace.style.getPropertyValue('font-family').replace(/^['"]|['"]$/g, '');
      if (usedFonts.has(family)) {
        return remember(`${sheetId}|font-face|${family}`, fontFace.cssText);
      }
      return null;
    }
    if (rule.type === CSSRule.KEYFRAMES_RULE) {
      const keyframes = rule as CSSKeyframesRule;
      if (usedKeyframes.has(keyframes.name)) {
        return remember(`${sheetId}|keyframes|${keyframes.name}`, keyframes.cssText);
      }
      return null;
    }
    return null;
  };

  Array.from(doc.styleSheets).forEach(sheet => {
    let rules: CSSRuleList | undefined;
    try {
      rules = sheet.cssRules;
    } catch (error) {
      rules = undefined;
    }
    if (!rules) return;
    Array.from(rules).forEach(rule => visitRule(rule, sheet.href || 'inline'));
  });

  container.remove();

  return {
    cssText: Array.from(usedRules.values()).join('\n'),
    fonts: Array.from(usedFonts.values()),
    keyframes: Array.from(usedKeyframes.values()),
  };
}
