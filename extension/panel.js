const statusEl = () => document.getElementById('status');
const previewEl = () => document.getElementById('preview');
let injected = false;

async function ensureInjected() {
  if (injected) return;
  const url = chrome.runtime.getURL('inspected.js');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load inspected script: ${response.status}`);
  }
  const source = await response.text();
  await new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(
      source + '\n;window.__clip2demoInjected = true;',
      { useContentScriptContext: true },
      (result, exceptionInfo) => {
        if (exceptionInfo && exceptionInfo.isException) {
          reject(new Error(exceptionInfo.value));
        } else {
          injected = true;
          resolve(result);
        }
      }
    );
  });
}

async function capture(options) {
  await ensureInjected();
  const expression = `window.__clip2demoCapture(${JSON.stringify(options)})`;
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(
      expression,
      { useContentScriptContext: true },
      (result, exceptionInfo) => {
        if (exceptionInfo && exceptionInfo.isException) {
          reject(new Error(exceptionInfo.value));
        } else if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!result || result.error) {
          reject(new Error(result?.error || 'Unknown capture error'));
        } else {
          resolve(result);
        }
      }
    );
  });
}

async function assemble(packagePayload, outputMode) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'clip2demo.assemble',
        payload: packagePayload,
        outputMode,
      },
      response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error('No response from service worker'));
          return;
        }
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response);
      }
    );
  });
}

function formToOptions(form) {
  const data = new FormData(form);
  return {
    scope: data.get('scope'),
    selector: data.get('selector'),
    cssMode: data.get('cssMode'),
    inlineAssets: data.get('inlineAssets') === 'on',
    includeJS: data.get('includeJS') === 'on',
    output: data.get('output'),
  };
}

export function initializePanel() {
  const form = document.getElementById('captureForm');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    statusEl().textContent = 'Capturing…';
    previewEl().value = '';
    const options = formToOptions(form);

    try {
      const captureResult = await capture(options);
      statusEl().textContent = 'Packaging…';
      const packaged = await assemble(captureResult, options.output);
      if (packaged.html) {
        previewEl().value = packaged.html;
      } else if (packaged.package) {
        previewEl().value = JSON.stringify(packaged.package, null, 2);
      }
      statusEl().textContent = packaged.message || 'Ready';
    } catch (error) {
      console.error(error);
      statusEl().textContent = error.message;
    }
  });
}

window.initializePanel = initializePanel;
