(() => {
  const q = (sel) => document.querySelector(sel);
  const ce = (tag, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; return el; };

  const serialConnectBtn = q('#serialConnectBtn');
  const serialStatusDot = q('#serialStatusDot');
  const statSerial = q('#statSerial');
  const statRxRate = q('#statRxRate');
  const fullscreenBtn = q('#fullscreenBtn');

  const connectModal = q('#connectModal');
  const portsContainer = q('#portsContainer');
  const connectClose = q('#connectClose');
  const refreshPorts = q('#refreshPorts');
  const connectBtnAction = q('#connectBtnAction');
  const connectBaud = q('#connectBaud');

  const serialFloat = q('#serialFloat');
  const serialFloatBody = q('#serialFloatBody');
  const serialFloatClose = q('#serialFloatClose');

  let selectedPath = null;
  let rxCount = 0;
  let lastTick = Date.now();

  function setStatus(state, path) {
    serialStatusDot.dataset.state = state;
    statSerial.textContent = state === 'connected' ? (path || 'connected') : state;
  }

  async function refreshPortsList() {
    try {
      portsContainer.innerHTML = '<div class="muted">Scanning ports…</div>';
      const ports = await window.serial.listPorts();
      if (!ports || ports.length === 0) {
        portsContainer.innerHTML = '<div class="muted">No ports found</div>';
        selectedPath = null;
        return;
      }
      portsContainer.innerHTML = '';
      ports.forEach((p, idx) => {
        const row = ce('label', 'port-row');
        row.setAttribute('role', 'option');
        const input = ce('input');
        input.type = 'radio';
        input.name = 'port';
        input.value = p.path;
        if (idx === 0) { input.checked = true; selectedPath = p.path; }
        input.addEventListener('change', () => { selectedPath = input.value; });
        const meta = ce('div', 'port-meta');
        const title = ce('div', 'port-title');
        title.textContent = p.path;
        const sub = ce('div', 'port-sub');
        sub.textContent = [p.manufacturer, p.productId && `PID:${p.productId}`, p.vendorId && `VID:${p.vendorId}`].filter(Boolean).join(' • ');
        meta.appendChild(title); meta.appendChild(sub);
        row.appendChild(input); row.appendChild(meta);
        portsContainer.appendChild(row);
      });
    } catch (e) {
      portsContainer.innerHTML = `<div class="muted">Error listing ports: ${String(e)}</div>`;
    }
  }

  function openModal() {
    connectModal.hidden = false;
    connectModal.querySelector('.modal-panel').focus?.();
    refreshPortsList();
  }
  function closeModal() { connectModal.hidden = true; }

  async function connectSelected() {
    if (!selectedPath) return;
    setStatus('connecting');
    connectBtnAction.disabled = true;
    try {
      const baud = Number(connectBaud.value || 115200);
      await window.serial.open(selectedPath, baud);
      setStatus('connected', selectedPath);
      serialFloat.hidden = false;
      closeModal();
    } catch (e) {
      setStatus('disconnected');
      alert(`Failed to open ${selectedPath}: ${String(e)}`);
    } finally {
      connectBtnAction.disabled = false;
    }
  }

  // RX rate ticker
  setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    if (dt >= 1) {
      const rate = Math.round(rxCount / dt);
      statRxRate.textContent = `${rate}/s`;
      rxCount = 0; lastTick = now;
    }
  }, 250);

  // Wire buttons
  serialConnectBtn?.addEventListener('click', openModal);
  connectClose?.addEventListener('click', closeModal);
  connectModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.action === 'close') closeModal();
  });
  refreshPorts?.addEventListener('click', refreshPortsList);
  connectBtnAction?.addEventListener('click', connectSelected);

  serialFloatClose?.addEventListener('click', () => { serialFloat.hidden = true; });

  fullscreenBtn?.addEventListener('click', async () => {
    try { await window.app.toggleFullScreen(); } catch {}
  });

  // Serial event listeners
  window.serial.onStatus((payload) => {
    if (!payload) return;
    if (payload.state === 'connected') {
      setStatus('connected', payload.path);
    } else if (payload.state === 'disconnected') {
      setStatus('disconnected');
    } else if (payload.state === 'error') {
      setStatus('disconnected');
      console.error('Serial error:', payload.message);
    }
  });

  const maxLines = 500;
  window.serial.onData((line) => {
    rxCount += 1;
    const atBottom = Math.abs(serialFloatBody.scrollHeight - serialFloatBody.scrollTop - serialFloatBody.clientHeight) < 8;
    serialFloatBody.append(document.createTextNode(String(line).replace(/\r?\n$/, '')));
    serialFloatBody.append(document.createTextNode('\n'));
    // Trim lines
    const text = serialFloatBody.textContent || '';
    const lines = text.split('\n');
    if (lines.length > maxLines) {
      const trimmed = lines.slice(lines.length - maxLines).join('\n');
      serialFloatBody.textContent = trimmed;
    }
    if (atBottom) serialFloatBody.scrollTop = serialFloatBody.scrollHeight;
  });
})();
