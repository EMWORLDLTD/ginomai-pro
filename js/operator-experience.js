'use strict';
(() => {
  let prepared = null;
  let workflow = 'instant';
  try { workflow = localStorage.getItem('sf_projection_workflow') || 'instant'; } catch {}
  window.getProjectionWorkflow = () => workflow;
  window.setProjectionWorkflow = value => {
    workflow = value === 'preview' ? 'preview' : 'instant';
    try { localStorage.setItem('sf_projection_workflow', workflow); } catch {}
    window.cancelPreparedSlide();
    const hint = document.querySelector('#bento-prev-idle-hint .empty-desc');
    if (hint) hint.textContent = workflow === 'preview' ? 'Select a slide to preview, then choose Take live.' : 'Click any slide or AI suggestion to project live.';
  };
  window.prepareSlideIfNeeded = (slideId, text, reference, extra) => {
    if (workflow !== 'preview' || extra.takeLive || window.state?.autoProject) return false;
    prepared = { slideId, text, reference, extra };
    document.getElementById('prepared-reference').textContent = reference || 'Prepared slide';
    document.getElementById('prepared-text').textContent = text;
    document.getElementById('prepared-slide').hidden = false;
    return true;
  };
  window.cancelPreparedSlide = () => {
    prepared = null;
    document.getElementById('prepared-slide').hidden = true;
  };
  window.takePreparedSlide = () => {
    if (!prepared) return;
    if (window.state?.isHoldLive) { window.showToast('Live output is held. Release Hold live before taking this slide.', 'warning'); return; }
    const slide = prepared;
    window.cancelPreparedSlide();
    window.projectSlide(slide.slideId, slide.text, slide.reference, { ...slide.extra, takeLive: true });
  };

  function addEmptyActions(root) {
    if (!(root instanceof Element)) return;
    const units = root.matches('.bento-empty-unit') ? [root] : [...root.querySelectorAll('.bento-empty-unit')];
    for (const unit of units) {
      if (unit.querySelector('.sf-empty-actions')) continue;
      const title = unit.querySelector('.empty-title')?.textContent.toLowerCase() || '';
      let actions = [];
      if (title === 'agenda empty') actions = [['Add to agenda', () => window.openOmniSearchPalette('all')]];
      else if (title === 'no songs in library') actions = [
        ['Import songs', () => { window.openImportModal(); window.switchImportSubTab('files'); }],
        ['Create song', () => { window.openImportModal(); window.switchImportSubTab('manual'); }]
      ];
      else if (title === 'no bible books') actions = [['Browse Bibles', () => { window.openImportModal(); window.switchImportSubTab('bibles'); }]];
      else if (title === 'no song selected') actions = [['Search songs', () => window.openOmniSearchPalette('songs')], ['Browse Bible', () => window.switchBentoTab('bible')]];
      else if (title.startsWith('no matching')) actions = [['Clear search', () => window.clearBentoSearch()]];
      if (!actions.length) continue;
      const row = document.createElement('div'); row.className = 'sf-empty-actions';
      for (const [label, run] of actions) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'sf-action'; button.textContent = label; button.onclick = run; row.append(button);
      }
      unit.append(row);
    }
  }

  async function refreshConnections() {
    if (new URLSearchParams(location.search).get('remote') === '1') {
      try {
        const session = await (await fetch('/api/session')).json();
        if (!session.enabled) {
          window.sfOperatorPaired = false;
          window.setRemoteSessionLocked(true);
        } else if (!window.sfOperatorPaired && document.getElementById('operator-join-modal-backdrop').style.display === 'none') {
          window.openOperatorJoinModal(false);
        }
      } catch {}
    }
    try {
      const response = await fetch('/api/output-status');
      if (!response.ok) throw new Error('Offline');
      const { outputs } = await response.json();
      for (const [target, label] of [['sanctuary', 'Sanctuary'], ['livestream', 'Stream']]) {
        const output = outputs.find(item => item.target === target);
        const element = document.getElementById(`${target}-connection`);
        const message = `${label}: ${output?.connected ? (output.received ? 'connected · received' : 'connected · syncing') : 'not connected'}`;
        if (element.textContent !== label) element.textContent = label;
        element.setAttribute('aria-label', message);
        element.dataset.connected = String(Boolean(output?.connected));
        element.title = `${message}. Reports browser receipt only; check the physical screen before the service.`;
      }
      const dynamic = outputs.find(item => item.target === 'dynamic');
      let dynamicEl = document.getElementById('dynamic-connection');
      if (!dynamicEl) { dynamicEl = document.createElement('span'); dynamicEl.id = 'dynamic-connection'; document.querySelector('.sf-output-status').append(dynamicEl); }
      dynamicEl.hidden = !dynamic?.connected;
      const dynamicMessage = `OBS dynamic: ${dynamic?.received ? 'connected · received' : 'connected · syncing'}`;
      if (dynamicEl.textContent !== dynamicMessage) dynamicEl.textContent = dynamicMessage;
    } catch {
      for (const target of ['sanctuary', 'livestream']) {
        const element = document.getElementById(`${target}-connection`);
        element.textContent = target === 'sanctuary' ? 'Sanctuary' : 'Stream';
        element.title = `${element.textContent}: server disconnected`;
        element.setAttribute('aria-label', element.title);
        element.dataset.connected = 'false';
      }
    }
    if (new URLSearchParams(location.search).get('remote') !== '1' && document.getElementById('links-modal-backdrop').classList.contains('open')) {
      try {
        const response = await fetch('/api/session');
        const session = await response.json();
        let code = document.getElementById('host-pairing-code');
        if (!code) { code = document.createElement('p'); code.id = 'host-pairing-code'; code.className = 'sf-output-status'; document.getElementById('hub-remote-row').after(code); }
        code.textContent = session.pairingCode ? `Pair a device with code ${session.pairingCode}. Share it only with your operator; stopping remote control revokes access.` : 'Start remote control to generate a device pairing code.';
      } catch {}
    }
  }

  function setup() {
    document.getElementById('projection-workflow').value = workflow;
    const hint = document.querySelector('#bento-prev-idle-hint .empty-desc');
    if (hint && workflow === 'preview') hint.textContent = 'Select a slide to preview, then choose Take live.';
    window.sessionManager?.updateTopBarUi();
    addEmptyActions(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) record.addedNodes.forEach(addEmptyActions);
    });
    observer.observe(document.getElementById('bento-grid-workspace'), { childList: true, subtree: true });
    // Group secondary setup tools without rebuilding the toolbar or its controls.
    const tools = document.createElement('details'); tools.className = 'sf-tools-menu';
    const summary = document.createElement('summary');
    summary.className = 'bento-icon-btn';
    summary.title = 'More tools';
    summary.setAttribute('aria-label', 'More tools');
    summary.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>';
    const menu = document.createElement('div');
    tools.append(summary, menu);
    const right = document.querySelector('.bento-tb-right');
    right.append(tools);
    for (const button of [...right.querySelectorAll('.bento-icon-btn')]) {
      if (/Library manager|Switch to|Desktop projector/i.test(button.title)) {
        let labelText = button.title.replace(/^Switch to\s+/i, '');
        if (/library manager/i.test(button.title)) {
          button.title = 'Library Manager';
          labelText = 'Library Manager';
        }
        button.setAttribute('aria-label', button.title);
        button.classList.add('sf-tools-menu-item');

        const existingSvg = button.querySelector('svg');
        button.innerHTML = '';

        const iconWrap = document.createElement('span');
        iconWrap.className = 'sf-menu-icon';
        if (existingSvg) iconWrap.appendChild(existingSvg);

        const labelSpan = document.createElement('span');
        labelSpan.className = 'sf-menu-label';
        labelSpan.textContent = labelText;

        button.append(iconWrap, labelSpan);
        menu.append(button);
        button.addEventListener('click', () => { tools.open = false; });
      }
    }
    if (window.themeManager && typeof window.themeManager.updateHeaderThemeButtons === 'function') {
      window.themeManager.updateHeaderThemeButtons();
    }
    tools.addEventListener('toggle', () => {
      if (tools.open) {
        if (typeof window.openDismissShield === 'function') {
          window.openDismissShield(() => { tools.open = false; }, 100099);
        }
      } else {
        if (typeof window.closeDismissShield === 'function') {
          window.closeDismissShield();
        }
      }
    });
    document.addEventListener('click', event => { if (!tools.contains(event.target)) tools.open = false; });
    tools.addEventListener('keydown', event => { if (event.key === 'Escape') { tools.open = false; summary.focus(); } });
    refreshConnections();
    setInterval(refreshConnections, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
