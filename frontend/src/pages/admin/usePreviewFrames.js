import { useEffect } from 'react';

// An iframe load event precedes its React data fetch. Wait for the storefront's
// explicit ready signal so the studio never presents an unexplained blank frame.
export const usePreviewFrames = (preview, path, compare) => {
  useEffect(() => {
    if (!preview) return;
    const cleanups = [];
    const raf = requestAnimationFrame(() => {
      document.querySelectorAll('[data-testid="draft-preview-frame"], [data-testid="live-preview-frame"]').forEach(frame => {
        const layer = document.createElement('div');
        layer.className = 'preview-frame-loading';
        layer.dataset.testid = `${frame.dataset.testid}-loading`;
        layer.setAttribute('role', 'status');
        const wordmark = document.createElement('span');
        wordmark.className = 'wordmark';
        wordmark.textContent = 'ORYNVE';
        const rule = document.createElement('span');
        rule.className = 'loading-rule';
        const message = document.createElement('p');
        message.textContent = 'Preparing your preview…';
        const actions = document.createElement('div');
        actions.className = 'preview-recovery-actions';
        layer.append(wordmark, rule, message, actions);
        frame.parentElement.append(layer);
        let timeout;
        const ready = () => { clearTimeout(timeout); layer.remove(); };
        const slow = () => {
          rule.hidden = true;
          message.textContent = 'This preview is taking a little longer.';
          const retry = document.createElement('button');
          retry.textContent = 'RETRY PREVIEW';
          retry.dataset.testid = `${frame.dataset.testid}-retry`;
          retry.onclick = () => {
            actions.replaceChildren(); rule.hidden = false;
            message.textContent = 'Preparing your preview…';
            frame.src = frame.src;
            timeout = setTimeout(slow, 20000);
          };
          const link = document.createElement('a');
          link.href = frame.src; link.target = '_blank'; link.rel = 'noreferrer';
          link.textContent = 'OPEN IN A NEW TAB ↗';
          link.dataset.testid = `${frame.dataset.testid}-external`;
          actions.replaceChildren(retry, link);
        };
        const receive = event => {
          if (event.source === frame.contentWindow && event.origin === new URL(frame.src).origin && event.data?.type === 'ORYNVE_STOREFRONT_READY') ready();
        };
        const loaded = () => {
          try {
            if (frame.contentDocument?.querySelector('#main-content, [data-testid="maintenance-page"]')) ready();
          } catch { /* The validated ready message handles cross-document access. */ }
        };
        window.addEventListener('message', receive);
        frame.addEventListener('load', loaded);
        timeout = setTimeout(slow, 20000);
        loaded();
        cleanups.push(() => { ready(); window.removeEventListener('message', receive); frame.removeEventListener('load', loaded); });
      });
    });
    return () => { cancelAnimationFrame(raf); cleanups.forEach(cleanup => cleanup()); };
  }, [preview, path, compare]);
};