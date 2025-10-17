chrome.devtools.panels.create(
  'Clip2Demo',
  '',
  'panel.html',
  panel => {
    panel.onShown.addListener(window => {
      window?.initializePanel?.();
    });
  }
);
