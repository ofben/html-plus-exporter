export interface InlineHandler {
  index: number;
  type: string;
  handler: string;
}

export interface EventListenerRecord {
  index: number;
  type: string;
  useCapture: boolean;
  passive: boolean;
  once: boolean;
  handler: string | null;
}

export function collectInlineHandlers(root: Element): InlineHandler[] {
  const nodes = [root, ...root.querySelectorAll('*')];
  const results: InlineHandler[] = [];
  nodes.forEach((node, index) => {
    Array.from(node.attributes || []).forEach(attr => {
      if (attr.name.startsWith('on')) {
        results.push({ index, type: attr.name.slice(2), handler: attr.value });
      }
    });
  });
  return results;
}

export function collectEventListeners(root: Element): EventListenerRecord[] {
  const collector: EventListenerRecord[] = [];
  const nodes = [root, ...root.querySelectorAll('*')];
  nodes.forEach((node, index) => {
    const anyWindow = window as any;
    if (typeof anyWindow.getEventListeners !== 'function') {
      return;
    }
    const map = anyWindow.getEventListeners(node);
    Object.entries(map || {}).forEach(([type, listeners]: any) => {
      listeners.forEach((listener: any) => {
        collector.push({
          index,
          type,
          useCapture: Boolean(listener.useCapture),
          passive: Boolean(listener.passive),
          once: Boolean(listener.once),
          handler: listener.listener ? String(listener.listener) : null,
        });
      });
    });
  });
  return collector;
}
