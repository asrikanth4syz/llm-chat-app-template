/* ============================================================
   DELIVERY EXECUTIVE — Personal dashboard
   ============================================================ */
async function renderDeliveryExecDashboard(el) {
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading your deliveries…</p></div>';
  const dcs = await api('/delivery-challans');
  if (!dcs) { el.innerHTML = '<div class="card" style="padding:24px;text-align:center;color:var(--danger)">Failed to load.</div>'; return; }

  const today = new Date().toISOString().slice(0, 10);
  // Backend already scopes delivery_exec to only their assigned DCs
  const pool = dcs;

  const inTransit    = pool.filter(d => d.status === 'IN_TRANSIT');
  const scheduled    = pool.filter(d => d.status === 'SCHEDULED');
  const delivToday   = pool.filter(d => d.status === 'DELIVERED' && (d.delivered_at || '').startsWith(today));
  // scan counts as POD — only show as pending if dc_scan_uploaded is also missing
  const pendingPOD   = pool.filter(d => d.status === 'DELIVERED' && !d.dc_scan_uploaded);
  const totalItems  = inTransit.reduce((s, d) => s + (d.total_qty || 0), 0);
  const overdue     = inTransit.filter(d => d.expected_delivery_date && d.expected_delivery_date < today);

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.3rem;font-weight:800;color:var(--navy)">Good ${new Date().getHours()<12?'morning':'afternoon'}, ${(APP.user?.name||'').split(' ')[0]} 👋</div>
      <div style="font-size:.85rem;color:var(--text-muted);margin-top:2px">Delivery Executive · ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
    </div>
    <button class="btn btn-secondary" ${dataAct('navigate', 'delivery')}>View All DCs</button>
  </div>

  <!-- KPI row -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--primary)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">In Transit</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);line-height:1.2;margin-top:6px">${inTransit.length}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${totalItems} items to deliver</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${overdue.length?'var(--danger)':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">Overdue</div>
      <div style="font-size:2rem;font-weight:800;color:${overdue.length?'var(--danger)':'var(--navy)'};line-height:1.2;margin-top:6px">${overdue.length}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${overdue.length?'requires attention':'on track'}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">Delivered Today</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);line-height:1.2;margin-top:6px">${delivToday.length}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">completed runs</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--warning)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">Scheduled</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);line-height:1.2;margin-top:6px">${scheduled.length}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">pending dispatch</div>
    </div>
  </div>

  <!-- In-transit delivery cards -->
  <div style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
    <div style="font-weight:700;font-size:.95rem;color:var(--navy)">Active Deliveries${inTransit.length?' ('+inTransit.length+')':''}</div>
    ${overdue.length ? '<span style="background:var(--danger-bg);color:var(--danger);font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:20px">'+overdue.length+' overdue</span>' : ''}
  </div>

  ${inTransit.length === 0 ? `
    <div style="background:#fff;border-radius:12px;padding:40px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:16px">
      <div style="font-size:2.5rem;margin-bottom:8px">✅</div>
      <div style="font-weight:700;color:var(--navy);font-size:1rem">All deliveries complete!</div>
      <div style="color:var(--text-muted);font-size:.85rem;margin-top:4px">No active in-transit challans assigned to you.</div>
    </div>
  ` : `
    <div id="exec-dc-cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;margin-bottom:20px">
      ${inTransit.map(dc => execDCCard(dc, today)).join('')}
    </div>
  `}

  <!-- Delivered DCs pending POD / scan -->
  ${pendingPOD.length > 0 ? `
  <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px">
    <div style="font-weight:700;font-size:.95rem;color:var(--navy)">Pending POD / Scan (${pendingPOD.length})</div>
    <span style="background:#fef9c3;color:var(--amber-text);font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:10px">Action needed</span>
  </div>
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden;margin-bottom:16px">
    ${pendingPOD.map(dc => `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:#d1fae5;display:flex;align-items:center;justify-content:center;font-size:1rem">✅</div>
          <div>
            <div style="font-weight:700;font-size:.88rem;color:var(--navy)">DC #${dc.id}</div>
            <div style="font-size:.78rem;color:var(--text-muted)">${dc.client_name||'—'} · Order ${dc.order_id} · ${fmtDate(dc.delivered_at)}</div>
          </div>
        </div>
        <div style="text-align:right;font-size:.75rem;color:var(--text-muted)">
          ${!dc.pod_uploaded ? '<span style="color:var(--warning);font-weight:600">POD pending</span>' : ''}
          ${!dc.dc_scan_uploaded ? '<span style="color:var(--warning);font-weight:600;display:block">Scan pending</span>' : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm ${dc.pod_uploaded ? 'btn-secondary' : 'btn-primary'}" ${dataAct('markPOD', dc.id)} ${dc.pod_uploaded ? 'disabled style="opacity:.6;cursor:default"' : ''}>
          ${dc.pod_uploaded ? '✓ POD Uploaded' : '📄 Upload POD'}
        </button>
        <button class="btn btn-sm ${dc.dc_scan_uploaded ? 'btn-secondary' : 'btn-primary'}" ${dataAct('markScan', dc.id)} ${dc.dc_scan_uploaded ? 'disabled style="opacity:.6;cursor:default"' : ''}>
          ${dc.dc_scan_uploaded ? '✓ DC Scanned' : '🔍 Scan POD'}
        </button>
      </div>
    </div>`).join('')}
  </div>` : `
  ${delivToday.length > 0 ? `
  <div style="background:var(--success-bg);border-radius:12px;padding:16px 20px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
    <span style="font-size:1.5rem">🎉</span>
    <div><div style="font-weight:700;color:var(--success)">All POD &amp; scans complete!</div><div style="font-size:.82rem;color:var(--text-muted)">${delivToday.length} delivery(ies) fully processed today.</div></div>
  </div>` : ''}`}`;
}

function execDCCard(dc, today) {
  const overdue = dc.expected_delivery_date && dc.expected_delivery_date < today;
  const eta = dc.expected_delivery_date ? new Date(dc.expected_delivery_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '—';
  return `<div style="background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);border:1px solid ${overdue?'var(--danger)':'var(--border)'};overflow:hidden">
    <!-- Card header -->
    <div style="padding:14px 16px;background:${overdue?'#fef2f2':'#f8fafc'};border-bottom:1px solid ${overdue?'#fecaca':'var(--border)'};display:flex;justify-content:space-between;align-items:center">
      <div>
        <span style="font-weight:800;font-size:.92rem;color:var(--navy)">DC #${dc.id}</span>
        ${overdue ? '<span style="margin-left:8px;background:var(--danger);color:#fff;font-size:.65rem;font-weight:700;padding:2px 7px;border-radius:10px;text-transform:uppercase">Overdue</span>' : ''}
      </div>
      <span style="font-size:.8rem;font-weight:600;color:#0369a1;background:#e0f2fe;padding:3px 10px;border-radius:20px">In Transit</span>
    </div>
    <!-- Card body -->
    <div style="padding:14px 16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:.82rem">
        <div><span style="color:var(--text-muted)">Client</span><br><b>${dc.client_name||'—'}</b></div>
        <div><span style="color:var(--text-muted)">Order</span><br><b>${dc.order_id}</b></div>
        <div><span style="color:var(--text-muted)">Vehicle</span><br><b>${dc.vehicle_no||'—'}</b></div>
        <div><span style="color:var(--text-muted)">ETA</span><br><b style="color:${overdue?'var(--danger)':'inherit'}">${eta}</b></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--border-light,#f1f5f9);border-radius:8px;margin-bottom:12px;font-size:.82rem">
        <span style="color:var(--text-muted)">Items to deliver</span>
        <span style="font-weight:700;font-size:1rem;color:var(--navy)">${dc.total_qty||'?'}</span>
      </div>
      <!-- Action buttons -->
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" style="flex:1;min-width:140px" ${dataAct('execMarkDelivered', dc.id)}>✓ Mark Delivered</button>
        <button class="btn btn-secondary" style="flex:0 0 auto" ${dataAct('viewDCItems', dc.id)} title="View items">📋</button>
        <button class="btn btn-secondary" style="flex:0 0 auto;color:var(--danger)" ${dataAct('returnDCModal', dc.id)} title="Return DC">↩</button>
      </div>
    </div>
  </div>`;
}

async function execMarkDelivered(dcId) {
  const items = await api('/delivery-challans/' + dcId + '/items');
  if (!items) return;
  if (!items.length) {
    const res = await api('/delivery-challans/' + dcId + '/deliver', { method:'POST', body: JSON.stringify({}) });
    if (res) { showToast('DC ' + dcId + ' marked as delivered'); navigate('dashboard'); }
    return;
  }
  APP._voiceNote = null;
  const capped = items.some(it => it.order_remaining != null && it.order_remaining < it.qty_ordered);
  openModal('Confirm Delivery — ' + dcId, `
    <p style="color:var(--text-muted);margin-bottom:12px">Enter actual qty delivered. You cannot deliver more than what is still outstanding on the order — if less, a follow-up DC is created for the balance.</p>
    <table class="table" style="margin-bottom:16px">
      <thead><tr><th>Item</th><th style="text-align:center">Dispatched</th><th style="text-align:center">Outstanding</th><th style="text-align:center">Delivered</th></tr></thead>
      <tbody>${items.map(it => {
        const maxDeliver = it.order_remaining != null ? it.order_remaining : it.qty_ordered;
        return `<tr>
        <td>${it.item_name||it.sku}</td>
        <td style="text-align:center;color:var(--text-muted)">${it.qty_ordered}</td>
        <td style="text-align:center;font-weight:600${maxDeliver<it.qty_ordered?';color:var(--warning)':''}">${maxDeliver}</td>
        <td style="text-align:center"><input type="number" data-sku="${it.sku}" value="${maxDeliver}" min="0" max="${maxDeliver}" ${dataInputEl('clampMax', maxDeliver)} style="width:70px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;text-align:center"></td>
      </tr>`;}).join('')}
      </tbody>
    </table>
    ${capped?'<div style="font-size:.76rem;color:var(--amber-text);background:var(--warning-bg);border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:12px">⚠️ Some items already had quantity delivered on earlier DCs — the deliverable amount is capped to the order balance.</div>':''}
    <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:12px 14px">
      <div style="font-weight:700;font-size:.82rem;color:var(--navy);margin-bottom:8px">🎙 Voice Message <span style="font-weight:400;color:var(--text-muted)">(optional — delivery note for the office)</span></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button type="button" id="voice-rec-btn" class="btn btn-secondary btn-sm" ${dataAct('toggleVoiceRecording')}>● Record</button>
        <span id="voice-rec-status" style="font-size:.76rem;color:var(--text-muted)">Not recorded</span>
        <audio id="voice-preview" controls style="display:none;height:32px;max-width:220px"></audio>
        <button type="button" id="voice-del-btn" class="btn btn-secondary btn-sm" style="display:none;color:var(--danger)" ${dataAct('discardVoiceNote')}>✕</button>
      </div>
    </div>`,
    `<button class="btn btn-secondary" ${dataAct('stopVoiceAndClose')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('confirmExecDelivery', dcId)}>Confirm Delivery</button>`
  );
}

/* ── Voice note recording (MediaRecorder) ── */
async function toggleVoiceRecording() {
  const btn = document.getElementById('voice-rec-btn');
  const status = document.getElementById('voice-rec-status');
  if (APP._voiceRecorder && APP._voiceRecorder.state === 'recording') { APP._voiceRecorder.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      if (blob.size > 2 * 1024 * 1024) { showToast('Voice note too long — keep it under ~60 seconds', 'error'); discardVoiceNote(); return; }
      const reader = new FileReader();
      reader.onload = () => {
        APP._voiceNote = { content_b64: String(reader.result).split(',')[1], mime_type: blob.type, file_size: blob.size };
        const audio = document.getElementById('voice-preview');
        if (audio) { audio.src = URL.createObjectURL(blob); audio.style.display = ''; }
        const del = document.getElementById('voice-del-btn'); if (del) del.style.display = '';
        if (status) status.textContent = `Recorded (${Math.round(blob.size/1024)} KB)`;
        if (btn) { btn.textContent = '● Re-record'; btn.style.color = ''; }
      };
      reader.readAsDataURL(blob);
    };
    rec.start();
    APP._voiceRecorder = rec;
    if (btn) { btn.textContent = '⏹ Stop'; btn.style.color = 'var(--danger)'; }
    if (status) status.textContent = 'Recording… tap Stop when done';
  } catch (e) {
    showToast('Microphone access denied or unavailable', 'error');
  }
}

function stopVoiceIfRecording() {
  if (APP._voiceRecorder && APP._voiceRecorder.state === 'recording') { try { APP._voiceRecorder.stop(); } catch(_){} }
}

function discardVoiceNote() {
  APP._voiceNote = null;
  const audio = document.getElementById('voice-preview'); if (audio) { audio.src=''; audio.style.display='none'; }
  const del = document.getElementById('voice-del-btn'); if (del) del.style.display='none';
  const status = document.getElementById('voice-rec-status'); if (status) status.textContent = 'Not recorded';
  const btn = document.getElementById('voice-rec-btn'); if (btn) btn.textContent = '● Record';
}

async function confirmExecDelivery(dcId) {
  stopVoiceIfRecording();
  const inputs = document.querySelectorAll('#modal-body input[data-sku]');
  const items = Array.from(inputs).map(inp => ({ sku: inp.dataset.sku, qty_delivered: parseInt(inp.value)||0 }));
  const res = await api('/delivery-challans/' + dcId + '/deliver', { method:'POST', body: JSON.stringify({ items }) });
  if (res) {
    if (APP._voiceNote) {
      await api(`/delivery-challans/${dcId}/voice/upload`, { method:'POST', body: JSON.stringify({
        filename: `voice-note-${dcId}.webm`, ...APP._voiceNote,
      })}).catch(()=>null);
      APP._voiceNote = null;
    }
    closeModal();
    const msg = res.partial ? 'Partial delivery recorded — follow-up DC created' : 'DC ' + dcId + ' fully delivered' + (res.order_closed ? ' — order closed' : '');
    showToast(msg);
    navigate('dashboard');
  }
}

/* ============================================================
   CLIENTS
   ============================================================ */
async function renderClients(el) {
  const clients = await api('/clients');
  if (!clients) return;

  const totalBudget  = clients.reduce((s,c)=>s+(c.monthly_budget||0),0);
  const totalSpent   = clients.reduce((s,c)=>s+(c.spent_this_month||0),0);
  const atRisk       = clients.filter(c=>c.health_score<70).length;
  const overBudget   = clients.filter(c=>c.spent_this_month/c.monthly_budget>0.9).length;

  function clientCard(c) {
    const budgetPct  = Math.min(100, Math.round((c.spent_this_month/(c.monthly_budget||1))*100));
    const creditPct  = c.credit_limit > 0 ? Math.min(100, Math.round(((c.credit_used||0)/c.credit_limit)*100)) : 0;
    const hColor     = c.health_score>=85?'var(--success)':c.health_score>=70?'#d97706':'var(--danger)';
    const budColor   = budgetPct>90?'var(--danger)':budgetPct>75?'#f59e0b':'var(--success)';
    const initials   = c.name.split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().slice(0,2);
    return `
    <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:18px 20px;border-top:3px solid ${hColor}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:700;flex-shrink:0">${initials}</div>
          <div>
            <div style="font-weight:800;font-size:.95rem;color:var(--navy)">${h(c.name)}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
              ${c.zone?`<span style="font-size:.68rem;font-weight:600;background:#e6f1fb;color:var(--blue);border-radius:4px;padding:1px 6px">${c.zone}</span>`:''}
              <span style="font-size:.72rem;color:${hColor};font-weight:700">★ ${c.health_score||0}/100</span>
            </div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:.72rem;color:var(--text-muted)">Monthly Budget</div>
          <div style="font-weight:700;font-size:.9rem">${fmt(c.monthly_budget)}</div>
        </div>
      </div>

      <!-- Budget bar -->
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted);margin-bottom:4px">
          <span>Budget Used</span>
          <span style="font-weight:600;color:${budColor}">${budgetPct}% · ${fmt(c.spent_this_month)}</span>
        </div>
        <div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${budgetPct}%;background:${budColor};border-radius:3px;transition:width .4s"></div>
        </div>
      </div>

      ${c.credit_limit > 0 ? `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted);margin-bottom:4px">
          <span>Credit Used</span>
          <span style="font-weight:600;color:${creditPct>80?'var(--danger)':creditPct>60?'#d97706':'var(--text-muted)'}">${creditPct}% · ${fmt(c.credit_used||0)} / ${fmt(c.credit_limit)}</span>
        </div>
        <div style="background:var(--border);height:4px;border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${creditPct}%;background:${creditPct>80?'var(--danger)':creditPct>60?'#f59e0b':'#94a3b8'};border-radius:2px"></div>
        </div>
      </div>` : ''}

      <!-- Contact -->
      ${c.contact_name ? `<div style="font-size:.74rem;color:var(--text-muted);margin-bottom:8px">
        👤 ${c.contact_name}${c.contact_email?` · <a href="mailto:${h(c.contact_email)}" style="color:var(--blue)">${h(c.contact_email)}</a>`:''}${c.contact_phone?` · <a href="tel:${h(c.contact_phone)}" style="color:var(--blue)">${h(c.contact_phone)}</a>`:''}
      </div>` : ''}
      ${(c.address||c.map_pin) ? `<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:flex-start;gap:5px">
        <span>📍</span><span>${c.address||''}${(c.address&&c.map_pin)?' · ':''}${c.map_pin?`<a href="${mapsLink(c.map_pin,c.address)}" target="_blank" rel="noopener" style="color:var(--blue)">Map</a>`:''}</span>
      </div>` : ''}

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" ${dataAct('viewClientById', _regClient(c))}>View</button>
        <button class="btn btn-gold btn-sm" ${dataAct('editClientById', _regClient(c))}>Edit</button>
        <button class="btn btn-sm" style="background:#e0f2fe;color:#0369a1;border:none;font-weight:600" ${dataAct('manageClientCatalog', c.id, c.name)}>📦 Products</button>
        <button class="btn btn-sm" style="background:${c.active===0?'var(--success)':'#fee2e2'};color:${c.active===0?'#fff':'var(--danger)'};border:none" ${dataAct('toggleClientActive', c.id, c.name, c.active===0?0:1)}>${c.active===0?'Enable':'Disable'}</button>
      </div>
    </div>`;
  }

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Client Directory</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${clients.length} clients · ${fmt(totalSpent)} spent of ${fmt(totalBudget)} total budget</div>
    </div>
    <button class="btn btn-gold" ${dataAct('addClientModal')}>${iconPlus(14)} Add Client</button>
  </div>

  <!-- Summary tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Total Clients</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${clients.length}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Total Budget</div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--navy);margin-top:6px">${fmt(totalBudget)}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmt(totalSpent)} spent this month</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${overBudget?'var(--warning)':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Near Budget Limit</div>
      <div style="font-size:2rem;font-weight:800;color:${overBudget?'#d97706':'var(--navy)'};margin-top:6px">${overBudget}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">&gt;90% budget used</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${atRisk?'var(--danger)':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">At Risk</div>
      <div style="font-size:2rem;font-weight:800;color:${atRisk?'var(--danger)':'var(--navy)'};margin-top:6px">${atRisk}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">health score &lt;70</div>
    </div>
  </div>

  <!-- Client cards grid -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
    ${clients.sort((a,b)=>(a.health_score||0)-(b.health_score||0)).map(c=>clientCard(c)).join('')}
  </div>
  `;
}

function mapsLink(pin, address) {
  if (!pin && !address) return null;
  if (pin && (pin.startsWith('http://') || pin.startsWith('https://'))) return pin;
  if (pin && /^-?\d+\.\d+,-?\d+\.\d+$/.test(pin.trim())) return `https://www.google.com/maps?q=${pin.trim()}`;
  const q = address || pin;
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

// ── Client Catalog Management ─────────────────────────────────────
let _ccClientId = null;
let _ccAllInventory = [];

async function manageClientCatalog(clientId, clientName) {
  _ccClientId = clientId;
  const [assigned, allInv] = await Promise.all([
    api(`/clients/${clientId}/catalog`),
    api('/inventory'),
  ]);
  _ccAllInventory = allInv || [];
  const assignedSkus = new Set((assigned||[]).map(i=>i.sku));

  // Build category list from all inventory
  const categories = [...new Set(_ccAllInventory.map(i=>i.category).filter(Boolean))].sort();
  const catOpts = categories.map(c=>`<option value="${c}">${c}</option>`).join('');

  openModal(`📦 Product Catalog — ${clientName}`,
    `<!-- Search + filter bar -->
     <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
       <input id="cc-search" type="search" placeholder="Search by name or SKU…"
         style="flex:1;min-width:140px;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.84rem"
         ${dataInput('renderCCSearchResults')} data-focusact="renderCCSearchResults">
       <select id="cc-cat-filter" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:.82rem;color:var(--navy);background:#fff"
         ${dataChange('renderCCSearchResults')}>
         <option value="">All Categories</option>${catOpts}
       </select>
     </div>

     <!-- Import strip: category OR CSV -->
     <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
       <!-- By category -->
       <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:220px;padding:10px 12px;background:#f0f7ff;border-radius:8px;border:1px solid #bfdbfe;flex-wrap:wrap">
         <span style="font-size:.76rem;font-weight:700;color:#1e40af;white-space:nowrap">By Category:</span>
         <select id="cc-import-cat" style="padding:5px 8px;border:1.5px solid #bfdbfe;border-radius:6px;font-size:.8rem;flex:1;min-width:110px;background:#fff">
           <option value="">— Select —</option>${catOpts}
         </select>
         <button class="btn btn-sm" style="background:#1d4ed8;color:#fff;border:none;padding:5px 12px;font-size:.78rem;white-space:nowrap" ${dataAct('importCCByCategory')}>Import</button>
       </div>
       <!-- By CSV -->
       <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--success-bg);border-radius:8px;border:1px solid #bbf7d0;flex-wrap:wrap">
         <span style="font-size:.76rem;font-weight:700;color:#166534;white-space:nowrap">By CSV:</span>
         <input type="file" id="cc-csv-input" accept=".csv,text/csv" style="display:none" ${dataChangeEl('handleCCCsvUpload')}>
         <button class="btn btn-sm" style="background:var(--success);color:#fff;border:none;padding:5px 12px;font-size:.78rem;white-space:nowrap" ${dataAct('clickEl', 'cc-csv-input')}>Upload CSV</button>
         <a id="cc-csv-template" href="#" style="font-size:.72rem;color:var(--success);text-decoration:underline;white-space:nowrap" ${dataAct('downloadCCTemplate')} data-prevent>Download template</a>
       </div>
     </div>
     <!-- CSV preview panel -->
     <div id="cc-csv-preview" style="display:none;margin-bottom:14px;border:1px solid #bbf7d0;border-radius:8px;background:var(--success-bg);padding:12px"></div>

     <!-- Search results (add) -->
     <div id="cc-search-results" style="display:none;max-height:190px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:14px;background:#fff"></div>

     <!-- Assigned items -->
     <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
       <div style="font-size:.72rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em">
         Assigned Products <span id="cc-count" style="font-weight:400">(${assignedSkus.size})</span>
       </div>
       <div style="display:flex;gap:6px">
         ${assignedSkus.size > 0 ? `<button class="btn btn-sm" style="font-size:.72rem;padding:2px 10px;background:#e0f2fe;color:#0369a1;border:none" ${dataAct('downloadCCAssigned')}>↓ Download CSV</button>` : ''}
         ${assignedSkus.size > 0 ? `<button class="btn btn-sm" style="font-size:.72rem;padding:2px 10px;background:var(--danger-soft-bg);color:var(--danger);border:none" ${dataAct('removeAllCCItems')}>Remove All</button>` : ''}
       </div>
     </div>
     <div id="cc-assigned-list" style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto">
       ${(assigned||[]).length === 0
         ? `<div class="cc-empty" style="color:var(--text-muted);font-size:.82rem;padding:12px;text-align:center">No products assigned yet. Search above or import a category.</div>`
         : (assigned||[]).map(item => ccAssignedRow(item)).join('')}
     </div>`,
    `<div style="font-size:.76rem;color:var(--text-muted);flex:1">Clients see only assigned products when placing orders.</div>
     <button class="btn btn-secondary" ${dataAct('closeModal')}>Done</button>`);
}

function ccAssignedRow(item) {
  const globalPrice = item.unit_price ?? 0;
  const clientPrice = item.client_price != null ? item.client_price : '';
  const hasCustom = item.client_price != null;
  return `<div id="cc-row-${item.sku}" style="background:var(--bg,var(--surface-2));border-radius:8px;border:1px solid var(--border);padding:8px 10px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:1.1rem;flex-shrink:0">${item.emoji||'📦'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(item.name)}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">${item.sku} · ${item.category||''}</div>
      </div>
      <button class="btn btn-sm" style="background:var(--danger-soft-bg);color:var(--danger);border:none;flex-shrink:0;padding:3px 10px" ${dataAct('removeCCItem', item.sku)}>Remove</button>
    </div>
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#fff;border:1px solid var(--border);border-radius:6px">
      <span style="font-size:.72rem;color:var(--text-muted);white-space:nowrap">Global ₹${globalPrice}</span>
      <span style="font-size:.72rem;color:var(--text-muted)">→</span>
      <label style="font-size:.72rem;font-weight:600;color:var(--navy);white-space:nowrap">Client Price ₹</label>
      <input type="number" min="0" step="0.01" placeholder="${globalPrice}"
        value="${clientPrice}"
        style="flex:1;min-width:70px;padding:4px 8px;border:1.5px solid ${hasCustom?'var(--navy)':'var(--border)'};border-radius:6px;font-size:.85rem;background:#fff"
        id="cc-price-${item.sku}"
        ${dataBlur('saveCCPrice', item.sku)} data-el
        ${dataEnterEl('_blurEl')}
        title="Leave blank to use global price ₹${globalPrice}">
      ${hasCustom
        ? `<span id="cc-price-badge-${item.sku}" style="font-size:.68rem;background:var(--blue-light);color:#1d4ed8;padding:2px 7px;border-radius:4px;white-space:nowrap;font-weight:600">Custom</span>`
        : `<span id="cc-price-badge-${item.sku}" style="font-size:.68rem;color:var(--text-muted);white-space:nowrap">Global</span>`}
    </div>
  </div>`;
}

async function saveCCPrice(sku, input) {
  if (!_ccClientId) return;
  const raw = input.value.trim();
  const price = raw === '' ? null : parseFloat(raw);
  if (raw !== '' && (isNaN(price) || price < 0)) { showToast('Invalid price','error'); return; }
  const res = await api(`/clients/${_ccClientId}/catalog/${sku}`, {
    method:'PATCH', body: JSON.stringify({client_price: price})
  });
  if (!res) return;
  const badge = document.getElementById(`cc-price-badge-${sku}`);
  if (badge) {
    if (price != null) {
      badge.textContent = 'Custom'; badge.style.cssText = 'font-size:.68rem;background:var(--blue-light);color:#1d4ed8;padding:1px 6px;border-radius:4px;white-space:nowrap';
      input.style.borderColor = 'var(--navy)';
    } else {
      badge.textContent = 'Global'; badge.style.cssText = 'font-size:.68rem;color:var(--text-muted);white-space:nowrap';
      input.style.borderColor = 'var(--border)';
    }
  }
  showToast(price != null ? `Client price set to ₹${price}` : 'Reverted to global price');
}

function ccGetAssignedSkus() {
  return new Set(
    Array.from(document.querySelectorAll('[id^="cc-row-"]')).map(el => el.id.replace('cc-row-',''))
  );
}

function renderCCSearchResults() {
  const q = (document.getElementById('cc-search')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('cc-cat-filter')?.value || '';
  const container = document.getElementById('cc-search-results');
  if (!container) return;
  const assignedSkus = ccGetAssignedSkus();
  const matches = _ccAllInventory.filter(i =>
    !assignedSkus.has(i.sku) &&
    (!cat || i.category === cat) &&
    (!q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
  ).slice(0, 25);

  if (!q && !cat) { container.style.display='none'; return; }
  container.style.display = '';
  if (!matches.length) {
    container.innerHTML = `<div style="padding:10px 14px;font-size:.82rem;color:var(--text-muted)">No unassigned items found${q?` for "${q}"`:''}${cat?` in ${cat}`:''}.</div>`;
    return;
  }
  container.innerHTML = matches.map(i => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-light,#edf0f4)"
      data-hover
      ${dataAct('addCCItem', i.sku)}>
      <span>${i.emoji||'📦'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.84rem">${h(i.name)}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">${i.sku} · ${i.category||''} · ₹${i.unit_price}</div>
      </div>
      <span style="font-size:.72rem;color:var(--blue);font-weight:700;flex-shrink:0">+ Add</span>
    </div>`).join('');
}

async function addCCItem(sku) {
  const item = _ccAllInventory.find(i => i.sku === sku);
  if (!item || !_ccClientId) return;
  const res = await api(`/clients/${_ccClientId}/catalog`, { method:'POST', body: JSON.stringify({skus:[sku]}) });
  if (!res) return;
  const list = document.getElementById('cc-assigned-list');
  if (list) {
    list.querySelector('.cc-empty')?.remove();
    list.insertAdjacentHTML('afterbegin', ccAssignedRow(item));
  }
  updateCCCount(1);
  renderCCSearchResults();
  showToast(`"${item.name}" added to catalog`);
}

async function importCCByCategory() {
  const cat = document.getElementById('cc-import-cat')?.value;
  if (!cat) { showToast('Please select a category to import', 'error'); return; }
  const assignedSkus = ccGetAssignedSkus();
  const toAdd = _ccAllInventory.filter(i => i.category === cat && !assignedSkus.has(i.sku));
  if (!toAdd.length) { showToast(`All "${cat}" items are already assigned`); return; }
  const btn = document.querySelector('#cc-import-cat + button') ||
    document.querySelector('[data-act="importCCByCategory"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }
  const res = await api(`/clients/${_ccClientId}/catalog`, {
    method:'POST', body: JSON.stringify({skus: toAdd.map(i=>i.sku)})
  });
  if (btn) { btn.disabled = false; btn.textContent = 'Import Category'; }
  if (!res) return;
  const list = document.getElementById('cc-assigned-list');
  if (list) {
    list.querySelector('.cc-empty')?.remove();
    toAdd.forEach(item => list.insertAdjacentHTML('afterbegin', ccAssignedRow(item)));
  }
  updateCCCount(toAdd.length);
  renderCCSearchResults();
  showToast(`${toAdd.length} "${cat}" items added to catalog`);
}

async function removeCCItem(sku) {
  if (!_ccClientId) return;
  const res = await api(`/clients/${_ccClientId}/catalog/${sku}`, { method:'DELETE' });
  if (res === null || res?.removed) {
    document.getElementById(`cc-row-${sku}`)?.remove();
    updateCCCount(-1);
    renderCCSearchResults();
    showToast('Item removed from catalog');
  }
}

async function removeAllCCItems() {
  const assignedSkus = [...ccGetAssignedSkus()];
  if (!assignedSkus.length) return;
  if (!confirm(`Remove all ${assignedSkus.length} assigned products from this client's catalog?`)) return;
  // batch deletions one by one but fire in parallel
  await Promise.all(assignedSkus.map(sku =>
    api(`/clients/${_ccClientId}/catalog/${sku}`, { method:'DELETE' })
  ));
  const list = document.getElementById('cc-assigned-list');
  if (list) {
    list.innerHTML = `<div class="cc-empty" style="color:var(--text-muted);font-size:.82rem;padding:12px;text-align:center">No products assigned yet. Search above or import a category.</div>`;
  }
  const countEl = document.getElementById('cc-count');
  if (countEl) countEl.textContent = '(0)';
  renderCCSearchResults();
  showToast('All products removed from catalog');
}

function updateCCCount(delta) {
  const el = document.getElementById('cc-count');
  if (!el) return;
  const cur = parseInt(el.textContent.replace(/\D/g,'')) || 0;
  const next = Math.max(0, cur + delta);
  el.textContent = `(${next})`;
  const list = document.getElementById('cc-assigned-list');
  if (next === 0 && list && !list.querySelector('.cc-empty')) {
    list.innerHTML = `<div class="cc-empty" style="color:var(--text-muted);font-size:.82rem;padding:12px;text-align:center">No products assigned yet. Search above or import a category.</div>`;
  }
}

function downloadCCTemplate(e) {
  if (e) e.preventDefault();
  const csv = 'sku\n' + _ccAllInventory.slice(0,3).map(i=>i.sku).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'client_catalog_template.csv';
  a.click();
}

function downloadCCAssigned() {
  const assignedSkus = ccGetAssignedSkus();
  const skuMap = new Map(_ccAllInventory.map(i=>[i.sku, i]));
  const rows = [...assignedSkus].map(sku => {
    const i = skuMap.get(sku) || {};
    const esc = v => `"${String(v??'').replace(/"/g,'""')}"`;
    const priceInput = document.getElementById(`cc-price-${sku}`);
    const clientPrice = priceInput?.value?.trim() || '';
    const effectivePrice = clientPrice !== '' ? clientPrice : (i.unit_price ?? '');
    return [esc(sku), esc(i.name), esc(i.category), esc(i.brand), esc(i.unit_price), esc(clientPrice||''), esc(effectivePrice), esc(i.mrp), esc(i.uom), esc(i.stock)].join(',');
  });
  const csv = ['sku,name,category,brand,global_price,client_price,effective_price,mrp,uom,stock', ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `catalog_${_ccClientId}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

function handleCCCsvUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    // Detect header row — skip if first cell is 'sku' (case-insensitive)
    const startIdx = lines[0]?.toLowerCase().startsWith('sku') ? 1 : 0;
    // Support CSV with multiple columns — take first column as SKU
    const parsedSkus = lines.slice(startIdx).map(l => l.split(',')[0].trim().replace(/^"|"$/g,''));
    const assignedSkus = ccGetAssignedSkus();
    const skuMap = new Map(_ccAllInventory.map(i=>[i.sku, i]));
    const matched = [], unmatched = [], alreadyIn = [];
    for (const sku of parsedSkus) {
      if (!sku) continue;
      if (assignedSkus.has(sku)) alreadyIn.push(sku);
      else if (skuMap.has(sku)) matched.push(skuMap.get(sku));
      else unmatched.push(sku);
    }
    showCCCsvPreview(matched, unmatched, alreadyIn);
  };
  reader.readAsText(file);
  input.value = ''; // allow re-upload of same file
}

function showCCCsvPreview(matched, unmatched, alreadyIn) {
  const panel = document.getElementById('cc-csv-preview');
  if (!panel) return;
  panel.style.display = '';
  panel.innerHTML = `
    <div style="font-size:.78rem;font-weight:800;color:#166534;margin-bottom:10px">
      CSV Preview — ${matched.length} to add · ${alreadyIn.length} already assigned · ${unmatched.length} not found
    </div>
    ${matched.length ? `
      <div style="max-height:130px;overflow-y:auto;margin-bottom:10px;display:flex;flex-direction:column;gap:4px">
        ${matched.map(i=>`
          <div style="display:flex;align-items:center;gap:8px;font-size:.8rem;padding:4px 8px;background:#fff;border-radius:6px;border:1px solid #bbf7d0">
            <span>${i.emoji||'📦'}</span>
            <span style="font-weight:600;flex:1">${h(i.name)}</span>
            <span style="color:var(--text-muted)">${i.sku}</span>
            <span style="color:var(--success);font-weight:700">✓</span>
          </div>`).join('')}
      </div>` : ''}
    ${unmatched.length ? `
      <div style="font-size:.74rem;color:var(--danger);margin-bottom:10px">
        SKUs not found in inventory: <strong>${unmatched.join(', ')}</strong>
      </div>` : ''}
    ${alreadyIn.length ? `
      <div style="font-size:.74rem;color:var(--text-muted);margin-bottom:10px">
        Already assigned (skipped): ${alreadyIn.join(', ')}
      </div>` : ''}
    <div style="display:flex;gap:8px">
      ${matched.length ? `<button class="btn btn-sm" style="background:var(--success);color:#fff;border:none;padding:5px 14px;font-size:.8rem"
        ${dataAct('confirmCCCsvImport', matched.map(i=>i.sku))}>
        Add ${matched.length} Item${matched.length!==1?'s':''}</button>` : ''}
      <button class="btn btn-sm btn-secondary" style="font-size:.8rem" ${dataAct('hideEl', 'cc-csv-preview')}>Dismiss</button>
    </div>`;
}

async function confirmCCCsvImport(skus) {
  if (!skus.length || !_ccClientId) return;
  const btn = document.querySelector('#cc-csv-preview .btn-sm');
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
  const res = await api(`/clients/${_ccClientId}/catalog`, {
    method:'POST', body: JSON.stringify({skus})
  });
  if (!res) { if (btn) { btn.disabled=false; btn.textContent=`Add ${skus.length} Items`; } return; }
  const skuMap = new Map(_ccAllInventory.map(i=>[i.sku, i]));
  const list = document.getElementById('cc-assigned-list');
  if (list) {
    list.querySelector('.cc-empty')?.remove();
    skus.forEach(sku => {
      const item = skuMap.get(sku);
      if (item) list.insertAdjacentHTML('afterbegin', ccAssignedRow(item));
    });
  }
  updateCCCount(skus.length);
  document.getElementById('cc-csv-preview').style.display = 'none';
  renderCCSearchResults();
  showToast(`${skus.length} item${skus.length!==1?'s':''} imported from CSV`);
}

const ZONE_OPTIONS = ['EGL','BTP','BTM','PV','FW','Other'];

function clientFormFields(prefix, c={}) {
  return `
    <div class="grid-2">
      <div class="form-group"><label>Company Name *</label><input type="text" id="${prefix}-name" value="${c.name||''}"></div>
      <div class="form-group"><label>Location Zone</label>
        <select id="${prefix}-zone">
          <option value="">— Select Zone —</option>
          ${ZONE_OPTIONS.map(z=>`<option value="${z}"${c.zone===z?' selected':''}>${z}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Contact Name</label><input type="text" id="${prefix}-cname" value="${c.contact_name||''}"></div>
      <div class="form-group"><label>Contact Phone</label><input type="tel" id="${prefix}-phone" value="${c.contact_phone||''}" placeholder="+91 98765 43210"></div>
    </div>
    <div class="form-group"><label>Contact Email</label><input type="email" id="${prefix}-email" value="${c.contact_email||''}"></div>
    <div class="form-group"><label>Full Address</label>
      <textarea id="${prefix}-address" rows="2" style="width:100%;border:1.5px solid var(--border);border-radius:8px;padding:8px 12px;font-size:.84rem;resize:vertical">${c.address||''}</textarea>
    </div>
    <div class="form-group">
      <label>Map Location <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(paste Google Maps link, or lat,lng e.g. 12.9716,77.5946)</span></label>
      <input type="text" id="${prefix}-mappin" value="${c.map_pin||''}" placeholder="https://maps.google.com/... or 12.9716,77.5946">
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label>PAN <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(optional — 10 chars, e.g. ABCDE1234F)</span></label>
        <input type="text" id="${prefix}-pan" value="${c.pan||''}" placeholder="ABCDE1234F"
          maxlength="10" spellcheck="false" style="text-transform:uppercase;letter-spacing:.04em"
          ${dataInputEl('maskUpper', 10)}>
        <div id="${prefix}-pan-msg" style="font-size:.72rem;margin-top:4px;min-height:1em"></div>
      </div>
      <div class="form-group">
        <label>GST Number <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(optional — 15-char GSTIN)</span></label>
        <input type="text" id="${prefix}-gstin" value="${c.gstin||''}" placeholder="29ABCDE1234F1ZW"
          maxlength="15" autocapitalize="characters" spellcheck="false"
          style="text-transform:uppercase;letter-spacing:.04em"
          ${dataInputEl('onGstInput', prefix)}>
        <div id="${prefix}-gstin-msg" style="font-size:.72rem;margin-top:4px;min-height:1em"></div>
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Monthly Budget (₹)</label><input type="number" id="${prefix}-budget" value="${c.monthly_budget||500000}"></div>
      <div class="form-group"><label>Approval Threshold (₹)</label><input type="number" id="${prefix}-threshold" value="${c.approval_threshold||100000}"></div>
    </div>`;
}

// Canonical formats. PAN: 5 letters + 4 digits + 1 letter. GSTIN: 2-digit state
// code + PAN + entity digit + 'Z' + checksum. The GSTIN embeds the PAN at 3–12.
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// GSTIN 15th-character checksum (GSTN mod-36 algorithm) — catches single-char typos.
const GSTIN_CP = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function gstinChecksumOk(g) {
  let factor = 2, sum = 0; const m = GSTIN_CP.length;
  for (let i = 13; i >= 0; i--) {
    let d = factor * GSTIN_CP.indexOf(g[i]);
    factor = factor === 2 ? 1 : 2;
    d = Math.floor(d / m) + (d % m);
    sum += d;
  }
  return GSTIN_CP[(m - (sum % m)) % m] === g[14];
}

function taxMsg(prefix, field, text) {
  const el = document.getElementById(prefix + '-' + field);
  const msg = document.getElementById(prefix + '-' + field + '-msg');
  if (msg) { msg.textContent = text || ''; msg.style.color = text ? 'var(--danger)' : ''; }
  if (el) el.style.borderColor = text ? 'var(--danger)' : 'var(--border)';
}

// Live GST input: sanitise, and auto-fill PAN from the GSTIN when PAN is empty.
function onGstInput(prefix, el) {
  el.value = el.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15);
  if (GSTIN_RE.test(el.value)) {
    const panEl = document.getElementById(prefix + '-pan');
    if (panEl && !panEl.value.trim()) panEl.value = el.value.slice(2, 12);
  }
}

// Read + validate the client's PAN and GSTIN together. Both optional; when
// present each must match its format, and a present pair must agree.
// Returns { ok, gstin, pan } with normalised values.
function readTaxIds(prefix) {
  const pan = (document.getElementById(prefix + '-pan')?.value || '').trim().toUpperCase();
  const gstin = (document.getElementById(prefix + '-gstin')?.value || '').trim().toUpperCase();
  taxMsg(prefix, 'pan', ''); taxMsg(prefix, 'gstin', '');

  if (pan && !PAN_RE.test(pan)) {
    taxMsg(prefix, 'pan', 'PAN must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).');
    return { ok: false };
  }
  if (gstin && !GSTIN_RE.test(gstin)) {
    taxMsg(prefix, 'gstin', 'Enter a valid 15-character GSTIN (e.g. 29ABCDE1234F1ZW).');
    return { ok: false };
  }
  if (gstin && !gstinChecksumOk(gstin)) {
    taxMsg(prefix, 'gstin', 'GST number checksum is invalid — check for a typo.');
    return { ok: false };
  }
  let finalPan = pan;
  if (gstin) {
    const embedded = gstin.slice(2, 12);
    if (pan && pan !== embedded) {
      taxMsg(prefix, 'gstin', 'GST number does not match the PAN (PAN is chars 3–12 of the GSTIN).');
      return { ok: false };
    }
    finalPan = pan || embedded;
  }
  return { ok: true, gstin, pan: finalPan };
}

function addClientModal() {
  openModal('Add Client', clientFormFields('cl'),
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveClient')}>Add Client</button>`);
}

async function saveClient() {
  const body = {
    name: document.getElementById('cl-name').value.trim(),
    contact_name: document.getElementById('cl-cname').value,
    contact_email: document.getElementById('cl-email').value,
    contact_phone: document.getElementById('cl-phone').value,
    zone: document.getElementById('cl-zone').value,
    address: document.getElementById('cl-address').value,
    map_pin: document.getElementById('cl-mappin').value.trim(),
    monthly_budget: +document.getElementById('cl-budget').value,
    approval_threshold: +document.getElementById('cl-threshold').value,
  };
  if (!body.name) { showToast('Company name required','error'); return; }
  const tax = readTaxIds('cl');
  if (!tax.ok) { showToast('Check the PAN / GST number','error'); return; }
  body.gstin = tax.gstin; body.pan = tax.pan;
  const res = await api('/clients', { method:'POST', body: JSON.stringify(body) });
  if (!res) return;
  closeModal();
  showToast('Client added'); navigate('clients');
}

/* Open client detail from anywhere (e.g. dashboard Top Clients) by id */
async function openClientDetail(id) {
  const clients = await api('/clients').catch(()=>null);
  const c = (clients||[]).find(x => x.id === id);
  if (!c) { showToast('Client not found', 'error'); return; }
  viewClientModal(c);
}

function viewClientModal(c) {
  const hColor = c.health_score>=85?'var(--success)':c.health_score>=70?'#d97706':'var(--danger)';
  const mapUrl = mapsLink(c.map_pin, c.address);
  openModal(`Client: ${c.name}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div><div style="font-size:.72rem;color:var(--text-muted)">Company Name</div><div style="font-weight:600">${h(c.name)}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Zone</div><div style="font-weight:600">${c.zone||'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Contact Name</div><div style="font-weight:600">${c.contact_name||'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Contact Email</div><div style="font-weight:600">${c.contact_email?`<a href="mailto:${h(c.contact_email)}" style="color:var(--blue)">${h(c.contact_email)}</a>`:'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Contact Phone</div><div style="font-weight:600">${c.contact_phone||'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">GST Number</div><div style="font-weight:600;letter-spacing:.03em">${c.gstin||'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">PAN</div><div style="font-weight:600;letter-spacing:.03em">${c.pan||'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Health Score</div><div style="font-weight:700;color:${hColor}">★ ${c.health_score||0}/100</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Monthly Budget</div><div style="font-weight:600">${fmt(c.monthly_budget)}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Approval Threshold</div><div style="font-weight:600">${fmt(c.approval_threshold)}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Spent This Month</div><div style="font-weight:600">${fmt(c.spent_this_month)}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Status</div><div style="font-weight:600">${c.active===0?'<span style="color:var(--danger)">Disabled</span>':'<span style="color:var(--success)">Active</span>'}</div></div>
    </div>
    ${c.address?`<div style="margin-top:14px"><div style="font-size:.72rem;color:var(--text-muted);margin-bottom:4px">Address</div><div style="font-size:.85rem">📍 ${c.address}</div></div>`:''}
    ${mapUrl?`<div style="margin-top:12px"><a href="${mapUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">🗺 View on Google Maps</a></div>`:''}`,
    `<button class="btn btn-primary" ${dataAct('editClientById', _regClient(c))}>Edit</button>
     <button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
}

function editClientModal(c) {
  openModal(`Edit Client: ${c.name}`, clientFormFields('ecl', c),
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveEditClient', c.id)}>Save Changes</button>`);
}

async function saveEditClient(id) {
  const body = {
    name: document.getElementById('ecl-name').value.trim(),
    contact_name: document.getElementById('ecl-cname').value,
    contact_email: document.getElementById('ecl-email').value,
    contact_phone: document.getElementById('ecl-phone').value,
    zone: document.getElementById('ecl-zone').value,
    address: document.getElementById('ecl-address').value,
    map_pin: document.getElementById('ecl-mappin').value.trim(),
    monthly_budget: +document.getElementById('ecl-budget').value,
    approval_threshold: +document.getElementById('ecl-threshold').value,
  };
  if (!body.name) { showToast('Company name required','error'); return; }
  const tax = readTaxIds('ecl');
  if (!tax.ok) { showToast('Check the PAN / GST number','error'); return; }
  body.gstin = tax.gstin; body.pan = tax.pan;
  const res = await api('/clients/' + id, { method:'PATCH', body: JSON.stringify(body) });
  if (res) {
    // If the logged-in user belongs to this client, reflect the new name in the
    // chrome (sidebar org, profile menu, "Ordering for") without a re-login.
    if (APP.user && APP.user.client_id === id && body.name) {
      APP.user.org = body.name;
      setText('user-role', body.name);
      setText('pm-role', body.name);
      setText('topbar-profile-org', body.name);
    }
    closeModal(); showToast('Client updated'); navigate('clients');
  }
}

async function toggleClientActive(id, name, active) {
  const newState = active ? 0 : 1;
  const label = newState ? 'enable' : 'disable';
  if (!confirm(`${newState?'Enable':'Disable'} client "${name}"?`)) return;
  const res = await api('/clients/' + id, { method:'PATCH', body: JSON.stringify({ active: newState }) });
  if (res) { showToast(`Client ${label}d`); navigate('clients'); }
}

/* ============================================================
   SERVICE DESK
   ============================================================ */
async function renderServiceDesk(el) {
  const allTickets = await api('/tickets');
  if (!allTickets) return;
  APP._sdTicketsById = Object.fromEntries(allTickets.map(t=>[t.id,t]));

  const isClientRole = ['client_admin','client_user','client_approver'].includes(APP.user?.role);

  // Client filter (platform/admin users only)
  const clientOptions = isClientRole ? [] :
    [...new Map(allTickets.filter(t=>t.client_id).map(t=>[t.client_id,{id:t.client_id,name:t.client_name||t.client_id}])).values()]
      .sort((a,b)=>a.name.localeCompare(b.name));
  const cf = APP._sdClientFilter || '';
  const tickets = cf ? allTickets.filter(t=>t.client_id===cf) : allTickets;

  const openT     = tickets.filter(t=>t.status==='OPEN');
  const inProgT   = tickets.filter(t=>t.status==='IN_PROGRESS');
  const resolvedT = tickets.filter(t=>t.status==='RESOLVED'||t.status==='CLOSED');

  const PRIORITY_META = {
    HIGH:   { color:'var(--danger)',  bg:'#fef2f2', label:'High' },
    MEDIUM: { color:'#d97706',        bg:'#fef3c7', label:'Medium' },
    LOW:    { color:'#2563eb',        bg:'#dbeafe', label:'Low' },
  };
  const STATUS_META = {
    OPEN:        { color:'#d97706', bg:'#fef3c7', dot:'🟡' },
    IN_PROGRESS: { color:'#2563eb', bg:'#dbeafe', dot:'🔵' },
    RESOLVED:    { color:'#059669', bg:'#d1fae5', dot:'🟢' },
    CLOSED:      { color:'#6b7280', bg:'#e5e7eb', dot:'⚫' },
  };

  function ticketCard(t) {
    const pm = PRIORITY_META[t.priority] || PRIORITY_META.MEDIUM;
    const sm = STATUS_META[t.status] || STATUS_META.OPEN;
    const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role);
    const isRaiserRole = isClient || ['vendor_admin','vendor_user'].includes(APP.user?.role);
    return `
    <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:16px 20px;margin-bottom:10px;border-left:4px solid ${pm.color}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="min-width:0;cursor:pointer" ${dataAct('viewTicketModal', t.id)} title="View ticket details">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-weight:700;font-size:.88rem;color:var(--blue)">${t.id}</span>
            <span style="font-size:.68rem;font-weight:700;background:${pm.bg};color:${pm.color};border-radius:4px;padding:1px 7px">${pm.label}</span>
            <span style="font-size:.68rem;font-weight:700;background:${sm.bg};color:${sm.color};border-radius:4px;padding:1px 7px">${sm.dot} ${t.status.replace('_',' ')}</span>
          </div>
          <div style="font-size:.88rem;font-weight:600;color:var(--navy);margin-top:6px">${h(t.subject)}</div>
          <div style="font-size:.74rem;color:var(--text-muted);margin-top:3px">
            ${fmtDate(t.created_at)}${t.client_name&&!isClient?' · '+t.client_name:''}
          </div>
          ${t.description?`<div style="font-size:.76rem;color:var(--text-muted);margin-top:6px;background:#f8f9fa;padding:8px 10px;border-radius:6px;line-height:1.5">${t.description.length>120?t.description.slice(0,120)+'…':t.description}</div>`:''}
        </div>
        ${!isRaiserRole ? `
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          ${t.status==='OPEN'||t.status==='IN_PROGRESS'?`<button class="btn btn-primary btn-sm" ${dataAct('resolveTicket', t.id)}>✓ Resolve</button>`:''}
          ${t.status==='OPEN'?`<button class="btn btn-secondary btn-sm" ${dataAct('startTicket', t.id)}>▶ Start</button>`:''}
          ${t.status!=='CLOSED'?`<button class="btn btn-secondary btn-sm" ${dataAct('editTicketModal', t.id, t.subject||'', t.priority||'MEDIUM', t.status||'OPEN', (t.description||'').replace(/\n/g,' '))}>✎ Edit</button>`:''}
        </div>` : t.status==='RESOLVED' ? `
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          <button class="btn btn-primary btn-sm" ${dataAct('confirmCloseTicket', t.id)}>✓ Confirm &amp; Close</button>
          <button class="btn btn-secondary btn-sm" ${dataAct('reopenTicket', t.id)}>↩ Reopen</button>
        </div>` : `
        <div style="flex-shrink:0;font-size:.72rem;color:var(--text-muted);text-align:right;max-width:120px">
          ${t.status==='CLOSED'?'Closed':'Being handled by support team'}
        </div>`}
      </div>
    </div>`;
  }

  const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role);

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Service Desk</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${openT.length+inProgT.length} open · ${resolvedT.length} resolved${cf?` · filtered by client`:''}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      ${!isClientRole && clientOptions.length ? `
      <select id="sd-client-filter" class="form-control" style="max-width:220px;font-size:.84rem"
        ${dataChangeEl('sdSetClientFilter')}>
        <option value="">All Clients (${allTickets.length})</option>
        ${clientOptions.map(c=>{
          const n = allTickets.filter(t=>t.client_id===c.id).length;
          return `<option value="${c.id}" ${cf===c.id?'selected':''}>${h(c.name)} (${n})</option>`;
        }).join('')}
      </select>
      ${cf?`<button class="btn btn-secondary btn-sm" ${dataAct('sdClearClientFilter')}>✕ Clear</button>`:''}` : ''}
      <button class="btn btn-gold" ${dataAct('newTicketModal')}>${iconPlus(14)} New Ticket</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:20px">
    ${(()=>{
      const openHigh = openT.filter(t=>t.priority==='HIGH').length;
      const activeHigh = tickets.filter(t=>t.priority==='HIGH'&&t.status!=='RESOLVED').length;
      const resolveRate = tickets.length ? Math.round(resolvedT.length/tickets.length*100) : 0;
      return `
      <div class="card" style="padding:16px 18px;border-top:3px solid ${openT.length>0?'#d97706':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Open</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${openT.length}</div>
        <div style="font-size:.75rem;color:${openHigh>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">${openHigh} high priority</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--blue-bright);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">In Progress</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${inProgT.length}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">being handled</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Resolved</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${resolvedT.length}</div>
        <div style="font-size:.75rem;color:var(--success);margin-top:6px">${resolveRate}% resolution rate</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${activeHigh>0?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">High Priority</div>
        <div style="font-size:1.9rem;font-weight:700;color:${activeHigh>0?'var(--danger)':'var(--navy)'};line-height:1">${activeHigh}</div>
        <div style="font-size:.75rem;color:${activeHigh>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">${activeHigh>0?'needs immediate attention':'all clear'}</div>
      </div>`;
    })()}
  </div>

  ${openT.length ? `
  <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Open</div>
  ${openT.sort((a,b)=>{const p={HIGH:0,MEDIUM:1,LOW:2}; return (p[a.priority]||1)-(p[b.priority]||1);}).map(t=>ticketCard(t)).join('')}` : ''}

  ${inProgT.length ? `
  <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;${openT.length?'margin-top:20px':''}">In Progress</div>
  ${inProgT.map(t=>ticketCard(t)).join('')}` : ''}

  ${openT.length===0&&inProgT.length===0?`
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:48px;text-align:center;color:var(--text-muted);margin-bottom:20px">
    <div style="font-size:2.5rem;margin-bottom:12px">✅</div>
    <div style="font-weight:700;font-size:1rem;color:var(--navy)">All tickets resolved!</div>
    <div style="font-size:.84rem;margin-top:6px">No open issues right now.</div>
  </div>`:''}

  ${resolvedT.length ? `
  <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;${openT.length||inProgT.length?'margin-top:20px':''}">Recently Resolved</div>
  ${resolvedT.slice(0,5).map(t=>ticketCard(t)).join('')}
  ${resolvedT.length>5?`<div style="text-align:center;font-size:.76rem;color:var(--text-muted);margin-top:8px">+${resolvedT.length-5} more resolved tickets</div>`:''}`:''}
  `;
}

function newTicketModal() {
  openModal('New Support Ticket',
    `<div class="form-group"><label>Subject</label><input type="text" id="tk-subject" placeholder="Brief summary of issue"></div>
     <div class="form-group"><label>Priority</label>
       <select id="tk-priority"><option value="LOW">Low</option><option value="MEDIUM" selected>Medium</option><option value="HIGH">High</option></select>
     </div>
     <div class="form-group"><label>Description</label>
       <textarea id="tk-desc" rows="4" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px" placeholder="Describe the issue…"></textarea>
     </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveTicket')}>Submit Ticket</button>`);
}

async function saveTicket() {
  const body = {
    subject: document.getElementById('tk-subject').value,
    priority: document.getElementById('tk-priority').value,
    description: document.getElementById('tk-desc').value,
  };
  if (!body.subject) { showToast('Subject required','error'); return; }
  const res = await api('/tickets', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast(`Ticket ${res.id} created`); navigate('service_desk'); }
}

function editTicketModal(id, subject, priority, status, description) {
  openModal(`Edit Ticket ${id}`,
    `<div class="form-group"><label>Subject</label><input type="text" id="etk-subject" value="${subject.replace(/"/g,'&quot;')}" placeholder="Brief summary"></div>
     <div class="form-group"><label>Priority</label>
       <select id="etk-priority">
         <option value="LOW"${priority==='LOW'?' selected':''}>Low</option>
         <option value="MEDIUM"${priority==='MEDIUM'?' selected':''}>Medium</option>
         <option value="HIGH"${priority==='HIGH'?' selected':''}>High</option>
       </select>
     </div>
     <div class="form-group"><label>Status</label>
       <select id="etk-status">
         <option value="OPEN"${status==='OPEN'?' selected':''}>Open</option>
         <option value="IN_PROGRESS"${status==='IN_PROGRESS'?' selected':''}>In Progress</option>
         <option value="RESOLVED"${status==='RESOLVED'?' selected':''}>Resolved</option>
       </select>
     </div>
     <div class="form-group"><label>Description</label>
       <textarea id="etk-desc" rows="4" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px">${description}</textarea>
     </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('updateTicket', id)}>Save Changes</button>`);
}

async function updateTicket(id) {
  const body = {
    subject:     document.getElementById('etk-subject').value,
    priority:    document.getElementById('etk-priority').value,
    status:      document.getElementById('etk-status').value,
    description: document.getElementById('etk-desc').value,
  };
  if (!body.subject) { showToast('Subject required','error'); return; }
  const res = await api(`/tickets/${id}`, { method:'PATCH', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast(`Ticket ${id} updated`); navigate('service_desk'); }
}

async function resolveTicket(id) {
  const res = await api(`/tickets/${id}`, { method:'PATCH', body: JSON.stringify({ status:'RESOLVED' }) });
  if (res) { showToast(`Ticket ${id} resolved`); navigate('service_desk'); }
}

async function startTicket(id) {
  const res = await api(`/tickets/${id}`, { method:'PATCH', body: JSON.stringify({ status:'IN_PROGRESS' }) });
  if (res) { showToast(`Ticket ${id} in progress`); navigate('service_desk'); }
}

/* Full ticket detail with chat-style comment thread — all roles */
async function viewTicketModal(id) {
  const t = APP._sdTicketsById?.[id];
  if (!t) { showToast('Ticket not found', 'error'); return; }
  const isRaiserRole = ['client_admin','client_user','client_approver','vendor_admin','vendor_user'].includes(APP.user?.role);
  const pmColor = t.priority==='HIGH' ? '#dc2626' : t.priority==='MEDIUM' ? '#d97706' : '#2563eb';
  const smColor = t.status==='RESOLVED' ? '#059669' : t.status==='CLOSED' ? '#6b7280' : t.status==='IN_PROGRESS' ? '#2563eb' : '#d97706';
  openModal(`Ticket ${t.id}`, `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <span style="font-size:.72rem;font-weight:700;background:${pmColor}1a;color:${pmColor};border-radius:20px;padding:3px 10px">${t.priority||'MEDIUM'} PRIORITY</span>
      <span style="font-size:.72rem;font-weight:700;background:${smColor}1a;color:${smColor};border-radius:20px;padding:3px 10px">${(t.status||'OPEN').replace('_',' ')}</span>
    </div>
    <div style="font-weight:700;font-size:1rem;color:var(--navy);margin-bottom:10px">${h(t.subject||'')}</div>
    ${t.description?`<div style="font-size:.84rem;color:var(--text);background:#f8f9fa;padding:12px 14px;border-radius:8px;line-height:1.6;margin-bottom:14px;white-space:pre-wrap">${h(t.description)}</div>`:'<div style="font-size:.8rem;color:var(--text-muted);margin-bottom:14px">No description provided.</div>'}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div style="font-size:.7rem;color:var(--text-muted)">Raised By</div><div style="font-weight:600;font-size:.84rem">${h(t.raiser_name||'—')}</div></div>
      ${!isRaiserRole?`<div><div style="font-size:.7rem;color:var(--text-muted)">Client</div><div style="font-weight:600;font-size:.84rem">${h(t.client_name||'—')}</div></div>`:''}
      <div><div style="font-size:.7rem;color:var(--text-muted)">Created</div><div style="font-weight:600;font-size:.84rem">${fmtDate(t.created_at)}</div></div>
      <div><div style="font-size:.7rem;color:var(--text-muted)">${t.status==='RESOLVED'||t.status==='CLOSED'?'Resolved':'Resolution'}</div><div style="font-weight:600;font-size:.84rem">${t.resolved_at?fmtDate(t.resolved_at):'Pending'}</div></div>
    </div>

    <div style="font-weight:700;font-size:.85rem;color:var(--navy);margin-bottom:8px;border-top:1px solid var(--border);padding-top:14px">💬 Conversation</div>
    <div id="ticket-chat" style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 2px;margin-bottom:10px">
      <div style="text-align:center;color:var(--text-muted);font-size:.78rem;padding:12px">Loading…</div>
    </div>
    ${t.status!=='CLOSED'?`
    <div style="display:flex;gap:8px">
      <input type="text" id="ticket-chat-input" maxlength="2000" placeholder="Write a message…"
        style="flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.85rem;outline:none"
        ${dataEnter('postTicketComment', t.id)}>
      <button class="btn btn-primary" ${dataAct('postTicketComment', t.id)}>Send</button>
    </div>`:`<div style="font-size:.76rem;color:var(--text-muted);text-align:center;padding:6px">Ticket closed — conversation is read-only</div>`}`,
    `${isRaiserRole && t.status==='RESOLVED' ? `
      <button class="btn btn-primary" ${dataActClose('confirmCloseTicket', t.id)}>✓ Confirm &amp; Close</button>
      <button class="btn btn-secondary" ${dataActClose('reopenTicket', t.id)}>↩ Reopen</button>` : ''}
     <button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);

  loadTicketChat(id);
}

const RAISER_ROLES_SET = ['client_admin','client_user','client_approver','vendor_admin','vendor_user'];

async function loadTicketChat(ticketId) {
  const wrap = document.getElementById('ticket-chat');
  if (!wrap) return;
  const comments = await api(`/tickets/${ticketId}/comments`).catch(()=>[]) || [];
  const fmtDT = s => { const d = new Date((s||'').replace(' ','T')+'Z'); return isNaN(d) ? (s||'') : d.toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); };
  if (!comments.length) {
    wrap.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:.78rem;padding:12px">No messages yet — start the conversation below.</div>';
    return;
  }
  wrap.innerHTML = comments.map(c => {
    const mine = c.author_id === APP.user?.sub;
    const isSupportAuthor = !RAISER_ROLES_SET.includes(c.author_role);
    const tag = isSupportAuthor ? '🛠 Support' : '🙋 Requester';
    const bubbleBg = mine ? 'var(--primary)' : (isSupportAuthor ? '#eef2ff' : '#f3f4f6');
    const textCol  = mine ? '#fff' : 'var(--text)';
    return `
    <div style="display:flex;flex-direction:column;align-items:${mine?'flex-end':'flex-start'}">
      <div style="font-size:.68rem;color:var(--text-muted);margin-bottom:2px;padding:0 4px">
        <b style="color:${isSupportAuthor?'#4f46e5':'#b45309'}">${h(c.author_name)}</b> · ${tag} · ${fmtDT(c.created_at)}
      </div>
      <div style="max-width:82%;background:${bubbleBg};color:${textCol};border-radius:${mine?'12px 12px 3px 12px':'12px 12px 12px 3px'};padding:8px 12px;font-size:.83rem;line-height:1.5;white-space:pre-wrap;word-break:break-word">${h(c.message)}</div>
    </div>`;
  }).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

async function postTicketComment(ticketId) {
  const input = document.getElementById('ticket-chat-input');
  const message = input?.value?.trim();
  if (!message) return;
  input.disabled = true;
  const res = await api(`/tickets/${ticketId}/comments`, { method:'POST', body: JSON.stringify({ message }) });
  input.disabled = false;
  if (res) { input.value = ''; loadTicketChat(ticketId); }
  input.focus();
}

/* Raiser-only actions on a RESOLVED ticket */
async function confirmCloseTicket(id) {
  const res = await api(`/tickets/${id}`, { method:'PATCH', body: JSON.stringify({ status:'CLOSED' }) });
  if (res) { showToast(`Ticket ${id} closed — thank you for confirming`); navigate('service_desk'); }
}

async function reopenTicket(id) {
  openModal(`Reopen Ticket ${id}`,
    `<p style="margin:0;color:var(--text-muted)">The support team will be notified that the issue is not fully resolved. Reopen this ticket?</p>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('confirmReopenTicket', id)}>↩ Reopen Ticket</button>`);
}

async function confirmReopenTicket(id) {
  const res = await api(`/tickets/${id}`, { method:'PATCH', body: JSON.stringify({ status:'OPEN' }) });
  closeModal();
  if (res) { showToast(`Ticket ${id} reopened — support team notified`); navigate('service_desk'); }
}

/* ============================================================
   APPROVALS
   ============================================================ */
async function renderApprovals(el) {
  const orders = await api('/orders');
  if (!orders) return;
  const pending  = orders.filter(o=>o.status==='PENDING_APPROVAL');
  const approved = orders.filter(o=>['APPROVED','ACKNOWLEDGED','PICKED','IN_SHIPMENT'].includes(o.status));
  const isApprover = APP.user?.role === 'client_approver';

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Approvals</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${pending.length} awaiting your approval</div>
    </div>
  </div>

  <!-- Summary tiles -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${pending.length?'#f59e0b':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Pending Approval</div>
      <div style="font-size:2rem;font-weight:800;color:${pending.length?'#d97706':'var(--navy)'};margin-top:6px">${pending.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">awaiting decision</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--primary)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">In Progress</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${approved.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">approved & processing</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Pending Value</div>
      <div style="font-size:1.4rem;font-weight:800;color:var(--navy);margin-top:6px">${fmt(pending.reduce((s,o)=>s+(o.grand_total||0),0))}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">total value pending</div>
    </div>
  </div>

  <!-- Pending approvals -->
  ${pending.length===0 ?
    `<div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:48px;text-align:center;color:var(--text-muted)">
      <div style="font-size:2.5rem;margin-bottom:12px">✅</div>
      <div style="font-weight:700;font-size:1rem;color:var(--navy)">All caught up!</div>
      <div style="font-size:.84rem;margin-top:6px">No orders are waiting for your approval.</div>
    </div>` :
  pending.map(o=>`
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:20px;margin-bottom:14px;border-left:4px solid var(--amber)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">
      <div>
        <div style="font-weight:800;font-size:1rem;color:var(--navy)">${o.id}</div>
        <div style="font-size:.76rem;color:var(--text-muted);margin-top:3px">
          Submitted ${fmtDate(o.created_at)}
          ${o.creator_name?' · by '+o.creator_name:''}
          ${!isApprover&&o.client_name?' · '+o.client_name:''}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:800;font-size:1.2rem;color:var(--navy)">${fmt(o.grand_total)}</div>
        ${o.grand_total>100000?`<div style="font-size:.72rem;color:var(--warning);background:var(--amber-bg);border-radius:4px;padding:2px 6px;margin-top:4px">⚠️ High value — review carefully</div>`:''}
      </div>
    </div>
    ${o.notes?`<div style="font-size:.78rem;color:var(--text-muted);background:#f8f9fa;padding:10px 12px;border-radius:8px;margin-bottom:14px">📝 ${o.notes}</div>`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" ${dataAct('approveOrder', o.id)}>✓ Approve & Submit</button>
      <button class="btn btn-danger" ${dataAct('rejectOrder', o.id)}>✕ Reject</button>
      <button class="btn btn-secondary" ${dataAct('viewOrder', o.id)}>View Details</button>
    </div>
  </div>`).join('')}

  <!-- Recently approved -->
  ${approved.length?`
  <div style="margin-top:20px">
    <div style="font-size:.84rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Recently Approved — In Progress</div>
    ${approved.slice(0,4).map(o=>`
    <div style="background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);padding:14px 18px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" ${dataAct('viewOrder', o.id)}>
      <div>
        <div style="font-weight:700;font-size:.88rem">${o.id}</div>
        <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmtDate(o.created_at)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-weight:700">${fmt(o.grand_total)}</div>
        ${statusBadge(o.status)}
      </div>
    </div>`).join('')}
  </div>`:''}`
  ;
}

async function approveOrder(id) {
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to:'APPROVED', note:'Approved by approver' }) });
  if (res) { showToast(`Order ${id} approved`); navigate('approvals'); }
}

function rejectOrder(id) {
  openModal(`Reject Order ${id}`,
    `<div style="margin-bottom:16px;color:var(--text-muted);font-size:.88rem">This will cancel the order and notify the requester.</div>
     <div class="form-group">
       <label style="font-weight:600;display:block;margin-bottom:6px">Reason for Rejection <span style="color:var(--danger)">*</span></label>
       <textarea id="reject-reason" rows="4" placeholder="Explain why this order is being rejected…" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;resize:vertical;box-sizing:border-box"></textarea>
     </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-danger" ${dataAct('confirmRejectOrder', id)}>Reject Order</button>`);
}

async function confirmRejectOrder(id) {
  const reason = (document.getElementById('reject-reason')?.value||'').trim();
  if (!reason) { showToast('Please provide a rejection reason','error'); return; }
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to:'CANCELLED', note: reason }) });
  closeModal();
  if (res) { showToast(`Order ${id} rejected`); navigate('approvals'); }
}
