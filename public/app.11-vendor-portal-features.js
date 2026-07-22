/* ============================================================
   VENDOR PORTAL — POs, Invoices, Payments
   ============================================================ */
async function renderVendorPOs(el) {
  const pos = await api('/purchase-orders');
  if (!pos) return;

  const sentPOs       = pos.filter(p=>p.status==='SENT');
  const acceptedPOs   = pos.filter(p=>p.status==='ACCEPTED');
  const dispatchedPOs = pos.filter(p=>p.status==='DISPATCHED');
  const invoicedPOs   = pos.filter(p=>p.status==='INVOICED');
  const totalValue    = sentPOs.reduce((s,p)=>s+(p.grand_total||0),0);

  const PO_META = {
    SENT:       { label:'Action Required', color:'#d97706', bg:'#fef3c7', border:'#f59e0b', icon:'⚡' },
    ACCEPTED:   { label:'Accepted',        color:'#2563eb', bg:'#dbeafe', border:'#3b82f6', icon:'✓' },
    DISPATCHED: { label:'Dispatched',      color:'#7c3aed', bg:'#ede9fe', border:'#8b5cf6', icon:'🚚' },
    INVOICED:   { label:'Invoiced',        color:'#059669', bg:'#d1fae5', border:'#10b981', icon:'📄' },
  };

  function poCard(po) {
    const m = PO_META[po.status] || { label:po.status, color:'#6b7280', bg:'#f3f4f6', border:'#d1d5db', icon:'•' };
    const steps = ['SENT','ACCEPTED','DISPATCHED','INVOICED'];
    const stepIdx = steps.indexOf(po.status);
    const isOverdue = po.expected_delivery && po.status!=='INVOICED' && new Date(po.expected_delivery)<new Date();
    return `
    <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:20px;margin-bottom:14px;border-left:4px solid ${isOverdue?'var(--danger)':m.border}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:800;font-size:1rem;color:var(--navy)">${po.id}</span>
            <span style="font-size:.68rem;font-weight:700;background:${m.bg};color:${m.color};border-radius:4px;padding:2px 8px">${m.icon} ${m.label}</span>
            ${isOverdue?`<span style="font-size:.68rem;font-weight:700;background:#fef2f2;color:var(--danger);border-radius:4px;padding:2px 8px">⚠ Overdue</span>`:''}
          </div>
          <div style="font-size:.76rem;color:var(--text-muted);margin-top:4px">
            Created ${fmtDate(po.created_at)}${po.expected_delivery?' · Expected '+fmtDate(po.expected_delivery):''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:800;font-size:1.2rem;color:var(--navy)">${fmt(po.grand_total)}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">${(po.items||[]).length} line items</div>
        </div>
      </div>
      <!-- progress bar -->
      <div style="display:flex;align-items:center;gap:0;margin-bottom:14px">
        ${steps.map((s,i)=>{
          const done = stepIdx >= i;
          const active = stepIdx === i;
          return `<div style="display:flex;align-items:center;flex:1">
            <div style="width:20px;height:20px;border-radius:50%;background:${done?m.color:'#e5e7eb'};display:flex;align-items:center;justify-content:center;font-size:.58rem;color:#fff;font-weight:700;flex-shrink:0;${active?'box-shadow:0 0 0 3px '+m.bg:''}">${i+1}</div>
            <div style="font-size:.6rem;color:${done?m.color:'#9ca3af'};margin-left:3px;white-space:nowrap;font-weight:${active?700:400}">${s.replace('_',' ')}</div>
            ${i<steps.length-1?`<div style="flex:1;height:2px;background:${stepIdx>i?m.color:'#e5e7eb'};margin:0 4px;min-width:8px"></div>`:''}
          </div>`;
        }).join('')}
      </div>
      <!-- items preview -->
      ${(po.items||[]).length ? `
      <div style="font-size:.76rem;color:var(--text-muted);margin-bottom:12px;display:flex;flex-wrap:wrap;gap:4px">
        ${(po.items||[]).slice(0,4).map(i=>`<span style="background:#f3f4f6;border-radius:4px;padding:2px 7px">${h(i.name)} ×${i.qty}</span>`).join('')}
        ${(po.items||[]).length>4?`<span style="background:#f3f4f6;border-radius:4px;padding:2px 7px;color:var(--text-muted)">+${(po.items||[]).length-4} more</span>`:''}
      </div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${poActions(po)}</div>
    </div>`;
  }

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Purchase Orders</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${pos.length} total · ${sentPOs.length} need action</div>
    </div>
  </div>

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid #f59e0b;cursor:pointer" ${dataAct('scrollToEl', 'vpo-sent')}>
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Action Required</div>
      <div style="font-size:2rem;font-weight:800;color:${sentPOs.length?'#d97706':'var(--navy)'};margin-top:6px">${sentPOs.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmt(totalValue)} pending</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid #3b82f6">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Accepted</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${acceptedPOs.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">preparing to dispatch</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid #8b5cf6">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Dispatched</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${dispatchedPOs.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">awaiting invoice</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Invoiced</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${invoicedPOs.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">payment pending</div>
    </div>
  </div>

  ${sentPOs.length ? `
  <div id="vpo-sent" style="font-size:.84rem;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">⚡ Action Required</div>
  ${sentPOs.map(po=>poCard(po)).join('')}` : ''}

  ${acceptedPOs.length ? `
  <div style="font-size:.84rem;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;margin-top:${sentPOs.length?20:0}px">✓ Accepted — Prepare Dispatch</div>
  ${acceptedPOs.map(po=>poCard(po)).join('')}` : ''}

  ${dispatchedPOs.length ? `
  <div style="font-size:.84rem;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;margin-top:${sentPOs.length||acceptedPOs.length?20:0}px">🚚 Dispatched — Upload Invoice</div>
  ${dispatchedPOs.map(po=>poCard(po)).join('')}` : ''}

  ${invoicedPOs.length ? `
  <div style="font-size:.84rem;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;margin-top:${sentPOs.length||acceptedPOs.length||dispatchedPOs.length?20:0}px">📄 Invoiced — Awaiting Payment</div>
  ${invoicedPOs.map(po=>poCard(po)).join('')}` : ''}

  ${pos.length===0?`<div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:48px;text-align:center;color:var(--text-muted)">
    <div style="font-size:2.5rem;margin-bottom:12px">📦</div>
    <div style="font-weight:700;font-size:1rem;color:var(--navy)">No purchase orders yet</div>
    <div style="font-size:.84rem;margin-top:6px">POs will appear here when the ops team sends them to you.</div>
  </div>`:''}
  `;
}

async function acceptPO(id, vendorTotal) {
  const amountLabel = vendorTotal ? `<div style="margin-bottom:12px"><b>Amount:</b> ${fmt(vendorTotal)}</div>` : '';
  openModal(`Accept PO & Confirm Delivery`,
    `<div style="margin-bottom:16px">
      <div><b>PO ID:</b> ${id}</div>
      ${amountLabel}
    </div>
    <div class="form-group" style="margin-bottom:12px">
      <label style="font-weight:600;display:block;margin-bottom:6px">Confirm Delivery Date <span style="color:var(--danger)">*</span></label>
      <input type="date" id="po-delivery-date" required style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"
        min="${new Date().toISOString().slice(0,10)}">
    </div>
    <div class="form-group">
      <label style="font-weight:600;display:block;margin-bottom:6px">Notes (optional)</label>
      <textarea id="po-accept-notes" rows="3" placeholder="Any delivery notes or commitments…" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;resize:vertical"></textarea>
    </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('confirmAcceptPO', id)}>Accept PO</button>`);
}

async function confirmAcceptPO(id) {
  const delivery_date = document.getElementById('po-delivery-date')?.value;
  if (!delivery_date) { showToast('Please select a delivery date', 'error'); return; }
  const notes = document.getElementById('po-accept-notes')?.value || '';
  const res = await api(`/purchase-orders/${id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ delivery_date, notes }),
  });
  closeModal();
  if (res) { showToast(`PO ${id} accepted — delivery confirmed for ${delivery_date}`); navigate('vendor_pos'); }
}

async function rejectPO(id) {
  openModal(`Reject PO ${id}`,
    `<div class="form-group">
      <label style="font-weight:600;display:block;margin-bottom:6px">Reason for Rejection <span style="color:var(--danger)">*</span></label>
      <textarea id="rej-reason" rows="4" placeholder="Explain why you are rejecting this PO…" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;resize:vertical"></textarea>
    </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-danger" ${dataAct('confirmRejectPO', id)}>Reject PO</button>`);
}

async function confirmRejectPO(id) {
  const reason = document.getElementById('rej-reason')?.value?.trim();
  if (!reason) { showToast('Please provide a reason for rejection', 'error'); return; }
  const res = await api(`/purchase-orders/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  closeModal();
  if (res) { showToast(`PO ${id} rejected`); navigate('vendor_pos'); }
}

async function dispatchPO(id) {
  openModal(`Mark PO ${id} Dispatched`,
    `<p>Confirm dispatch of goods for PO <b>${id}</b>.</p>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-gold" ${dataAct('confirmPOAction', id, 'DISPATCHED', 'Goods dispatched')}>Confirm Dispatch</button>`);
}

async function uploadInvoice(id) {
  openModal(`Upload Invoice — PO ${id}`,
    `<div class="form-group"><label>Invoice URL / Reference</label><input type="text" id="inv-url" placeholder="https://... or INV-2024-001"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('confirmUploadInvoice', id)}>Upload Invoice</button>`);
}

async function confirmUploadInvoice(id) {
  const url = document.getElementById('inv-url').value;
  const res = await api(`/purchase-orders/${id}`, { method:'PATCH', body: JSON.stringify({ status:'INVOICED', invoice_url: url }) });
  closeModal();
  if (res) { showToast(`Invoice uploaded for PO ${id}`); navigate(APP.page); }
}

async function confirmPOAction(id, status, msg) {
  const res = await api(`/purchase-orders/${id}`, { method:'PATCH', body: JSON.stringify({ status }) });
  closeModal();
  if (res) { showToast(msg); navigate(APP.page); }
}

async function renderVendorInvoices(el) {
  const pos = await api('/purchase-orders');
  if (!pos) return;
  const invoiced  = pos.filter(p => p.status === 'INVOICED' || p.invoice_url);
  const pending   = pos.filter(p => p.status === 'DISPATCHED' && !p.invoice_url);
  const totalInv  = invoiced.reduce((s,p)=>s+(p.grand_total||0),0);

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Invoices</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${invoiced.length} submitted · ${pending.length} pending upload</div>
    </div>
  </div>

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Invoices Submitted</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${invoiced.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmt(totalInv)} total</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${pending.length?'#f59e0b':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Awaiting Upload</div>
      <div style="font-size:2rem;font-weight:800;color:${pending.length?'#d97706':'var(--navy)'};margin-top:6px">${pending.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">dispatched, no invoice yet</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Net-30 Terms</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">30d</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">avg payment cycle</div>
    </div>
  </div>

  ${pending.length ? `
  <div style="font-size:.84rem;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">⚡ Awaiting Invoice Upload</div>
  ${pending.map(po=>`
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:16px 20px;margin-bottom:10px;border-left:4px solid #f59e0b;display:flex;justify-content:space-between;align-items:center;gap:12px">
    <div>
      <div style="font-weight:700;font-size:.92rem;color:var(--navy)">${po.id}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:3px">Dispatched ${fmtDate(po.updated_at)} · ${fmt(po.grand_total)}</div>
    </div>
    <button class="btn btn-primary btn-sm" ${dataAct('uploadInvoice', po.id)}>Upload Invoice</button>
  </div>`).join('')}
  <div style="margin-bottom:18px"></div>` : ''}

  <div style="font-size:.84rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Submitted Invoices</div>
  ${invoiced.length===0 ? `
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:40px;text-align:center;color:var(--text-muted)">
    <div style="font-size:2rem;margin-bottom:10px">📄</div>
    <div style="font-weight:600;color:var(--navy)">No invoices submitted yet</div>
    <div style="font-size:.82rem;margin-top:6px">Invoices appear here once uploaded after dispatch.</div>
  </div>` :
  `<div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    ${invoiced.map((po,i)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;gap:12px;${i<invoiced.length-1?'border-bottom:1px solid var(--border)':''}">
      <div style="min-width:0">
        <div style="font-weight:700;font-size:.88rem;color:var(--navy)">${po.id}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">Uploaded ${fmtDate(po.updated_at)}</div>
      </div>
      <div style="flex:1;min-width:0;text-align:center">
        ${po.invoice_url ? `<a href="${po.invoice_url}" target="_blank" style="font-size:.76rem;color:var(--blue);word-break:break-all">${po.invoice_url.length>40?po.invoice_url.slice(0,40)+'…':po.invoice_url}</a>` : '<span style="font-size:.76rem;color:var(--text-muted)">—</span>'}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-weight:700;font-size:.88rem">${fmt(po.grand_total)}</div>
        ${statusBadge(po.status)}
      </div>
    </div>`).join('')}
  </div>`}
  `;
}

async function renderVendorPayments(el) {
  const pos = await api('/purchase-orders');
  if (!pos) return;
  const invoiced     = pos.filter(p => p.status === 'INVOICED');
  const totalPending = invoiced.reduce((s,p) => s + (p.grand_total||0), 0);
  const today        = new Date();

  function daysUntilDue(po) {
    const due = new Date(new Date(po.updated_at).getTime() + 30*86400000);
    return Math.ceil((due - today) / 86400000);
  }

  const overdue    = invoiced.filter(p => daysUntilDue(p) < 0);
  const dueSoon    = invoiced.filter(p => { const d=daysUntilDue(p); return d>=0 && d<=7; });
  const upcoming   = invoiced.filter(p => daysUntilDue(p) > 7);

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Payments</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">Track receivables and payment schedules</div>
    </div>
  </div>

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${overdue.length?'var(--danger)':'var(--warning)'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Pending Receivable</div>
      <div style="font-size:1.6rem;font-weight:800;color:var(--navy);margin-top:6px">${fmt(totalPending)}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${invoiced.length} invoice${invoiced.length===1?'':'s'}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${overdue.length?'var(--danger)':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Overdue</div>
      <div style="font-size:2rem;font-weight:800;color:${overdue.length?'var(--danger)':'var(--navy)'};margin-top:6px">${overdue.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmt(overdue.reduce((s,p)=>s+(p.grand_total||0),0))}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${dueSoon.length?'#f59e0b':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Due This Week</div>
      <div style="font-size:2rem;font-weight:800;color:${dueSoon.length?'#d97706':'var(--navy)'};margin-top:6px">${dueSoon.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmt(dueSoon.reduce((s,p)=>s+(p.grand_total||0),0))}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Payment Terms</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">Net-30</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">from invoice date</div>
    </div>
  </div>

  ${invoiced.length===0 ? `
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:48px;text-align:center;color:var(--text-muted)">
    <div style="font-size:2.5rem;margin-bottom:12px">💰</div>
    <div style="font-weight:700;font-size:1rem;color:var(--navy)">No pending payments</div>
    <div style="font-size:.84rem;margin-top:6px">Submit invoices after dispatch to start tracking payments.</div>
  </div>` : `

  <!-- Payment tracker cards -->
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:700;font-size:.9rem;color:var(--navy)">Payment Tracker</span>
      <span style="font-size:.76rem;color:var(--text-muted)">All amounts due on Net-30 from invoice date</span>
    </div>
    ${invoiced.map((po,i)=>{
      const d = daysUntilDue(po);
      const dueDate = new Date(new Date(po.updated_at).getTime() + 30*86400000);
      const isOv = d < 0;
      const isSoon = d >= 0 && d <= 7;
      const barColor = isOv ? 'var(--danger)' : isSoon ? '#f59e0b' : 'var(--success)';
      const barPct = Math.min(100, Math.max(0, Math.round(((30+d)/30)*100)));
      return `
      <div style="padding:16px 20px;${i<invoiced.length-1?'border-bottom:1px solid var(--border)':''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px">
          <div>
            <div style="font-weight:700;font-size:.9rem;color:var(--navy)">${po.id}</div>
            <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">Invoice: ${po.invoice_url ? `<a href="${po.invoice_url}" target="_blank" style="color:var(--blue)">${po.invoice_url.length>35?po.invoice_url.slice(0,35)+'…':po.invoice_url}</a>` : '—'}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-weight:800;font-size:1rem;color:var(--navy)">${fmt(po.grand_total)}</div>
            <div style="font-size:.72rem;margin-top:3px;font-weight:600;color:${barColor}">
              ${isOv ? `${Math.abs(d)}d overdue` : d===0 ? 'Due today' : `Due in ${d}d`}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;background:var(--border);height:6px;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${barPct}%;background:${barColor};border-radius:3px;transition:width .5s"></div>
          </div>
          <div style="font-size:.7rem;color:var(--text-muted);white-space:nowrap">Due ${dueDate.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
          <span style="font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:4px;background:${isOv?'#fef2f2':isSoon?'#fef3c7':'#d1fae5'};color:${barColor}">${isOv?'OVERDUE':isSoon?'DUE SOON':'ON TRACK'}</span>
        </div>
      </div>`;
    }).join('')}
  </div>`}
  `;
}

/* ============================================================
   Feature 22: 2FA TOGGLE
   ============================================================ */
async function toggle2FA(userId, enabled) {
  const res = await api('/users/' + userId + '/2fa', {
    method: 'PATCH',
    body: JSON.stringify({ two_fa_enabled: enabled ? 1 : 0 }),
  });
  if (res) showToast('2FA ' + (enabled ? 'enabled' : 'disabled') + ' for user');
}

/* ============================================================
   Feature 20: VENDOR FEEDBACK
   ============================================================ */
function openVendorFeedbackModal(vendorId, vendorName) {
  openModal('Rate Vendor — ' + vendorName,
    `<div class="form-group"><label>Quality (1-5)</label><input type="number" id="fb-quality" value="4" min="1" max="5"></div>
     <div class="form-group"><label>Delivery (1-5)</label><input type="number" id="fb-delivery" value="4" min="1" max="5"></div>
     <div class="form-group"><label>Service (1-5)</label><input type="number" id="fb-service" value="4" min="1" max="5"></div>
     <div class="form-group"><label>Comments</label><textarea id="fb-comments" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></textarea></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('submitVendorFeedback', vendorId)}>Submit Rating</button>`);
}

async function submitVendorFeedback(vendorId) {
  const body = {
    quality_rating: +document.getElementById('fb-quality').value,
    delivery_rating: +document.getElementById('fb-delivery').value,
    service_rating: +document.getElementById('fb-service').value,
    comments: document.getElementById('fb-comments').value,
  };
  const res = await api('/vendors/' + vendorId + '/feedback', { method: 'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Vendor rated — scorecard updated'); navigate('vendors'); }
}

/* ============================================================
   Feature 16: DELIVERY ROUTE OPTIMIZATION
   ============================================================ */
async function renderDeliveryRoutes(el) {
  const [routes, dcs] = await Promise.all([
    api('/delivery-routes'),
    api('/delivery-challans'),
  ]);
  if (!routes) return;

  const undelivered  = (dcs || []).filter(d => d.status !== 'DELIVERED');
  const planned      = routes.filter(r => r.status === 'PLANNED');
  const inProgress   = routes.filter(r => r.status === 'IN_PROGRESS');
  const completed    = routes.filter(r => r.status === 'COMPLETED');

  const kpis = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:22px">
    ${[
      {label:'Total Routes',val:routes.length,sub:'all time',color:'var(--navy)'},
      {label:'Planned',val:planned.length,sub:'ready to start',color:planned.length?'var(--blue)':'var(--success)'},
      {label:'In Progress',val:inProgress.length,sub:'currently active',color:inProgress.length?'var(--warning)':'var(--success)'},
      {label:'Unrouted DCs',val:undelivered.length,sub:'need assignment',color:undelivered.length?'var(--danger)':'var(--success)'},
    ].map(k=>`
      <div class="card" style="padding:16px 18px;border-top:3px solid ${k.color}">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px">${k.label}</div>
        <div style="font-size:1.9rem;font-weight:700;line-height:1">${k.val}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${k.sub}</div>
      </div>
    `).join('')}
  </div>`;

  const dcSelector = undelivered.length ? `
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <span>Unrouted Delivery Challans (${undelivered.length})</span>
      <button class="btn btn-gold btn-sm" ${dataAct('createOptimizedRoute')}>Create Route from Selected</button>
    </div>
    <div style="padding:12px 16px">
      <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:10px">Select challans to bundle into a route:</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px">
        ${undelivered.map(dc=>`
          <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:background .15s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
            <input type="checkbox" class="dc-select" data-id="${dc.id}" value="${dc.id}" style="width:16px;height:16px;flex-shrink:0">
            <div>
              <div style="font-weight:600;font-size:.85rem">DC #${dc.id}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">Order ${dc.order_id||'—'} · ${dc.client_name||'Unknown'} ${dc.dispatched_at?'· Dispatched '+fmtDate(dc.dispatched_at):''}</div>
            </div>
          </label>`).join('')}
      </div>
    </div>
  </div>` : `
  <div class="card" style="padding:16px 20px;margin-bottom:16px;border-left:3px solid var(--success);display:flex;align-items:center;gap:12px">
    <span style="font-size:1.3rem">✓</span>
    <div><div style="font-weight:600;color:var(--success)">All DCs routed</div><div style="font-size:.82rem;color:var(--text-muted)">No unassigned delivery challans</div></div>
  </div>`;

  function routeCard(r) {
    const stops = typeof r.stops === 'string' ? JSON.parse(r.stops) : (r.stops||[]);
    const statusColor = r.status==='COMPLETED'?'var(--success)':r.status==='IN_PROGRESS'?'var(--warning)':'var(--blue)';
    return `
    <div class="card" style="padding:0;overflow:hidden;border-top:3px solid ${statusColor}">
      <div style="padding:14px 16px 10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-weight:700">${h(r.name)}</span>
          ${statusBadge(r.status)}
        </div>
        <div style="font-size:.8rem;color:var(--text-muted)">${fmtDate(r.route_date)} · ${stops.length} stop${stops.length!==1?'s':''}</div>
      </div>
      <div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        ${r.status==='PLANNED'?`<button class="btn btn-primary btn-sm" ${dataAct('updateRouteStatus', r.id, 'IN_PROGRESS')}>Start Route</button>`:''}
        ${r.status==='IN_PROGRESS'?`<button class="btn btn-success btn-sm" ${dataAct('updateRouteStatus', r.id, 'COMPLETED')}>Complete</button>`:''}
      </div>
    </div>`;
  }

  el.innerHTML = `
  ${pageHeader('Route Optimization', 'Plan and track delivery routes',
    `<button class="btn btn-gold" ${dataAct('openNewRouteModal')}>New Route</button>`)}
  ${kpis}
  ${dcSelector}
  ${routes.length ? `
  <div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:600;margin-bottom:10px">All Routes (${routes.length})</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
    ${routes.map(routeCard).join('')}
  </div>` : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">🗺</div>No routes created yet</div>`}`;
}

async function createOptimizedRoute() {
  const selected = [...document.querySelectorAll('.dc-select:checked')].map(el => el.value);
  if (!selected.length) { showToast('Select at least one DC', 'error'); return; }
  const name = 'Route ' + new Date().toISOString().slice(0,10);
  const res = await api('/delivery-routes', {
    method: 'POST',
    body: JSON.stringify({ name, dc_ids: selected, route_date: new Date().toISOString().slice(0,10) }),
  });
  if (res) { showToast('Route created with ' + selected.length + ' stops'); navigate('delivery_routes'); }
}

async function updateRouteStatus(id, status) {
  const res = await api('/delivery-routes/' + id, { method: 'PATCH', body: JSON.stringify({ status }) });
  if (res) { showToast('Route status updated'); navigate('delivery_routes'); }
}

/* ============================================================
   Feature 17: DUNNING / PAYMENT ESCALATION
   ============================================================ */
async function renderDunning(el) {
  const [rules, events] = await Promise.all([
    api('/dunning-rules'),
    api('/dunning-events'),
  ]);
  if (!rules) return;

  const recentEvents = (events||[]).slice(0,10);
  const ACTION_COLOR = { EMAIL:'#2563eb', SMS:'#7c3aed', ESCALATE:'#d97706', SUSPEND:'var(--danger)' };

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Dunning & Payment Escalation</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${rules.length} escalation rule${rules.length===1?'':'s'} · ${recentEvents.length} recent event${recentEvents.length===1?'':'s'}</div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-secondary" ${dataAct('addDunningRuleModal')}>${iconPlus(14)} Add Rule</button>
      <button class="btn btn-gold" ${dataAct('runDunningCheck')}>▶ Run Check</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <!-- Rules -->
    <div>
      <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Escalation Rules</div>
      ${rules.length===0 ? `
      <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:40px;text-align:center;color:var(--text-muted)">
        <div style="font-size:1.8rem;margin-bottom:10px">📋</div>
        <div style="font-weight:600;color:var(--navy)">No rules configured</div>
        <div style="font-size:.82rem;margin-top:6px">Add rules to automate payment escalation.</div>
        <button class="btn btn-primary" style="margin-top:14px" ${dataAct('addDunningRuleModal')}>Add First Rule</button>
      </div>` :
      `<div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
        ${rules.sort((a,b)=>(a.days_overdue||0)-(b.days_overdue||0)).map((r,i)=>{
          const ac = ACTION_COLOR[r.action] || '#6b7280';
          return `<div style="display:flex;align-items:center;gap:14px;padding:14px 18px;${i<rules.length-1?'border-bottom:1px solid var(--border)':''}">
            <div style="width:48px;height:48px;border-radius:10px;background:${ac}1a;color:${ac};display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:800;flex-shrink:0">${r.days_overdue}d</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-size:.68rem;font-weight:700;background:${ac}1a;color:${ac};border-radius:4px;padding:2px 7px">${r.action}</span>
              </div>
              <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.message_template||'No message template'}</div>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    </div>

    <!-- Recent Events -->
    <div>
      <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Recent Events</div>
      ${recentEvents.length===0 ? `
      <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:40px;text-align:center;color:var(--text-muted)">
        <div style="font-size:1.8rem;margin-bottom:10px">📭</div>
        <div style="font-weight:600;color:var(--navy)">No events yet</div>
        <div style="font-size:.82rem;margin-top:6px">Run a dunning check to trigger escalations.</div>
      </div>` :
      `<div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
        ${recentEvents.map((e,i)=>{
          const ac = ACTION_COLOR[e.action_taken] || '#6b7280';
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;gap:12px;${i<recentEvents.length-1?'border-bottom:1px solid var(--border)':''}">
            <div>
              <div style="font-weight:700;font-size:.84rem;color:var(--navy)">${e.client_name||e.client_id}</div>
              <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">Order: ${e.order_id||'—'}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:.68rem;font-weight:700;background:${ac}1a;color:${ac};border-radius:4px;padding:2px 7px;margin-bottom:3px">${e.action_taken}</div>
              <div style="font-size:.68rem;color:var(--text-muted)">${fmtDate(e.created_at)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    </div>
  </div>
  `;
}

async function runDunningCheck() {
  const res = await api('/dunning/run', { method: 'POST', body: '{}' });
  if (res) {
    showToast('Dunning check complete — ' + res.triggered + ' action(s) triggered');
    navigate('dunning');
  }
}

function addDunningRuleModal() {
  openModal('Add Dunning Rule',
    `<div class="form-group"><label>Days Overdue</label><input type="number" id="dr-days" value="30" min="1"></div>
     <div class="form-group"><label>Action</label>
       <select id="dr-action"><option>EMAIL</option><option>SMS</option><option>ESCALATE</option><option>SUSPEND</option></select>
     </div>
     <div class="form-group"><label>Message Template</label><textarea id="dr-msg" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></textarea></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveDunningRule')}>Save Rule</button>`);
}

async function saveDunningRule() {
  const body = {
    days_overdue: +document.getElementById('dr-days').value,
    action: document.getElementById('dr-action').value,
    message_template: document.getElementById('dr-msg').value,
  };
  const res = await api('/dunning-rules', { method: 'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Dunning rule saved'); navigate('dunning'); }
}

/* ============================================================
   Feature 18: CSV IMPORT
   ============================================================ */
async function renderImportData(el) {
  const jobs = await api('/import-jobs') || [];
  window._importJobs = jobs;
  const canImportVendors = APP.user && !['client_admin','client_user','client_approver','vendor_admin','vendor_user','delivery_exec'].includes(APP.user.role);
  const startTab = APP._importDefaultTab || 'inventory';
  APP._importDefaultTab = null;

  el.innerHTML = `
  ${pageHeader('CSV Data Import', 'Import inventory and orders from CSV files')}
  <div class="tab-pills" id="import-tabs" style="margin-bottom:16px">
    <button class="tab-pill${startTab==='inventory'?' active':''}" ${dataActEl('importTab', 'inventory')}>Inventory</button>
    <button class="tab-pill${startTab==='orders'?' active':''}" ${dataActEl('importTab', 'orders')}>Orders</button>
    ${canImportVendors ? '<button class="tab-pill'+(startTab==='vendors'?' active':'')+'" '+dataActEl('importTab','vendors')+'>Vendors</button>' : ''}
    <button class="tab-pill${startTab==='jobs'?' active':''}" ${dataActEl('importTab', 'jobs')}>Import History</button>
  </div>
  <div id="import-content"></div>`;

  showImportTab(startTab, jobs);
}

function importTab(tab, btn) {
  document.querySelectorAll('#import-tabs .tab-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  showImportTab(tab, window._importJobs || []);
}

function showImportTab(tab, jobs) {
  const el = document.getElementById('import-content');
  if (!el) return;
  if (tab === 'jobs') {
    el.innerHTML = `<div class="card"><div class="card-header"><span>Import History</span></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Type</th><th>Total</th><th>Success</th><th>Failed</th><th>Date</th></tr></thead>
      <tbody>${jobs.map(j=>`<tr>
        <td>${j.type}</td><td>${j.total}</td>
        <td><span class="badge badge-success">${j.success_count}</span></td>
        <td>${j.failed_count > 0 ? '<span class="badge badge-danger">'+j.failed_count+'</span>' : '0'}</td>
        <td>${fmtDate(j.created_at)}</td>
      </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No imports yet</td></tr>'}
      </tbody></table></div></div>`;
    return;
  }
  if (tab === 'vendors') {
    el.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700;font-size:.95rem;color:var(--navy)">Import Vendors</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:3px">Upload a CSV file — first row must be column headers. Duplicates detected by vendor name (case-insensitive).</div>
        </div>
        <button class="btn btn-secondary btn-sm" ${dataAct('downloadSampleCSV', 'vendors')}>⬇ Download Sample Template</button>
      </div>
      <div style="padding:16px 20px">
        <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:.8rem">
          <div style="font-weight:700;color:var(--navy);margin-bottom:4px">Columns <span style="font-weight:400;color:var(--text-muted)">(* required)</span></div>
          <code style="color:var(--blue);word-break:break-all">name*, category*, contact_email, contact_phone, location, address, avg_lead_days, rating</code>
        </div>
        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:.8rem;color:#92400e">
          <b>Duplicate handling:</b> If a vendor with the same name already exists, you can choose to skip it or overwrite it with the CSV data.
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label style="font-weight:600">Choose CSV file</label>
          <input type="file" id="csv-file" accept=".csv,.txt" style="margin-top:6px;display:block" onchange="previewVendorCSV(this)">
        </div>
        <div id="csv-preview" style="margin-top:12px"></div>
        <div id="csv-actions" style="display:none;margin-top:12px">
          <div style="margin-bottom:12px;padding:10px 14px;background:#f8fafc;border:1px solid var(--border);border-radius:8px;font-size:.84rem">
            <div style="font-weight:600;color:var(--navy);margin-bottom:8px">For duplicate vendors:</div>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:6px">
              <input type="radio" name="vendor-dup" value="skip" checked> Skip — keep existing vendor data unchanged
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="radio" name="vendor-dup" value="overwrite"> Overwrite — replace existing vendor with CSV data
            </label>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <button class="btn btn-primary" ${dataAct('submitVendorImport')}>Import Vendors</button>
            <span id="csv-row-count" style="font-size:.84rem;color:var(--text-muted)"></span>
          </div>
        </div>
      </div>
    </div>`;
    return;
  }
  const isInventory = tab === 'inventory';
  const cols = isInventory
    ? 'sku, name, category, sub_category, brand, stock, unit_price, mrp, cost_excl_gst, gst_rate, reorder_level, max_stock, uom, pack_size, units_per_case, weight_grams, barcode, vendor_sku, vendor_lead_days, vendor_moq'
    : 'client_id, grand_total, subtotal, gst, notes';

  el.innerHTML = `
  <div class="card" style="margin-bottom:14px">
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-weight:700;font-size:.95rem;color:var(--navy)">Import ${isInventory ? 'Inventory Items' : 'Orders'}</div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:3px">Upload a CSV file — first row must be column headers</div>
      </div>
      <button class="btn btn-secondary btn-sm" ${dataAct('downloadSampleCSV', tab)}>⬇ Download Sample Template</button>
    </div>
    <div style="padding:16px 20px">
      <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:.8rem">
        <div style="font-weight:700;color:var(--navy);margin-bottom:6px">Required columns</div>
        <code style="color:var(--blue);word-break:break-all">${cols}</code>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label style="font-weight:600">Choose CSV file</label>
        <input type="file" id="csv-file" accept=".csv,.txt" style="margin-top:6px;display:block" onchange="previewCSV(this,'${tab}')">
      </div>
      <div id="csv-preview" style="margin-top:12px"></div>
      <div id="csv-actions" style="display:none;margin-top:12px;align-items:center;gap:12px">
        <button class="btn btn-primary" ${dataAct('submitCSVImport', tab)}>Import Data</button>
        <span id="csv-row-count" style="font-size:.84rem;color:var(--text-muted)"></span>
      </div>
    </div>
  </div>`;
}

// Proper RFC-4180 CSV parser — handles quoted fields, embedded commas, CRLF, UTF-8 BOM
function parseCSVText(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i <= text.length; i++) {
    const c = i < text.length ? text[i] : '\n';
    if (inQ) {
      if (c === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQ = true; }
      else if (c === ',') { row.push(field.trim()); field = ''; }
      else if (c === '\n') {
        row.push(field.trim()); field = '';
        if (row.some(v => v !== '')) rows.push(row);
        row = [];
      } else { field += c; }
    }
  }
  return rows;
}

function previewCSV(input, tab) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const parsed = parseCSVText(e.target.result);
    if (parsed.length < 2) { showToast('CSV must have a header row + at least one data row', 'error'); return; }
    const headers = parsed[0].map(function(h){ return h.trim().toLowerCase().replace(/^﻿/, ''); });
    const dataRows = parsed.slice(1).map(function(vals) {
      const obj = {};
      headers.forEach(function(h, i) { obj[h] = vals[i] !== undefined ? vals[i].trim() : ''; });
      return obj;
    });
    window._csvRows = dataRows;
    window._csvTab = tab;

    const preview = document.getElementById('csv-preview');
    const actions = document.getElementById('csv-actions');
    const rowCount = document.getElementById('csv-row-count');

    if (preview) preview.innerHTML =
      '<div style="font-size:.8rem;font-weight:600;color:var(--navy);margin-bottom:6px">Preview (first 5 rows)</div>' +
      '<div class="table-wrap" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">' +
      '<table class="table" style="margin:0"><thead><tr>' +
      headers.map(function(h){return '<th style="font-size:.75rem">'+h+'</th>';}).join('') +
      '</tr></thead><tbody>' +
      dataRows.slice(0,5).map(function(row){
        return '<tr>' + headers.map(function(h){return '<td style="font-size:.78rem">'+(row[h]||'')+'</td>';}).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div>';

    if (actions) actions.style.display = 'flex';
    if (rowCount) rowCount.textContent = dataRows.length + ' rows ready to import';
  };
  reader.readAsText(file);
}

async function submitCSVImport(tab) {
  const rows = window._csvRows;
  if (!rows || !rows.length) { showToast('No data to import', 'error'); return; }
  const btn = document.querySelector('#csv-actions .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }
  showToast('Importing ' + rows.length + ' rows…');

  const endpoint = tab === 'inventory' ? '/import/inventory' : '/import/orders';
  const res = await api(endpoint, { method: 'POST', body: JSON.stringify(rows) });
  if (btn) { btn.disabled = false; btn.textContent = 'Import Data'; }
  if (!res) return;

  const preview = document.getElementById('csv-preview');
  const allFailed = res.success === 0 && res.failed > 0;
  const partialFail = res.success > 0 && res.failed > 0;
  const bg    = allFailed ? '#fef2f2' : partialFail ? '#fef3c7' : '#d1fae5';
  const bdr   = allFailed ? '#fca5a5' : partialFail ? '#fcd34d' : '#6ee7b7';
  const color = allFailed ? '#b91c1c' : partialFail ? '#92400e' : '#065f46';
  const icon  = allFailed ? '✗' : '✓';
  const label = allFailed ? 'Import failed' : 'Import complete';
  const summaryMsg = '<div style="background:'+bg+';border:1px solid '+bdr+';border-radius:8px;padding:12px 16px;margin-bottom:10px;font-size:.85rem;color:'+color+'"><b>'+icon+' '+label+'</b> — ' + res.success + ' row(s) imported' + (res.failed ? ', <b>' + res.failed + ' failed</b>' : '') + '.</div>';
  const errorsHtml = res.errors && res.errors.length
    ? '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;font-size:.8rem;color:#b91c1c"><b>Row errors:</b><ul style="margin:6px 0 0 18px;padding:0">' +
      res.errors.map(function(e){return '<li>'+e+'</li>';}).join('') + '</ul>' +
      (allFailed ? '<div style="margin-top:8px;font-size:.78rem">Tip: run <code>npx wrangler d1 migrations apply smart-pantry-db --local</code> if columns are missing.</div>' : '') +
      '</div>'
    : '';
  if (preview) preview.innerHTML = summaryMsg + errorsHtml;
  window._csvRows = null;
  window._importJobs = null;
}

async function previewVendorCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    const parsed = parseCSVText(e.target.result);
    if (parsed.length < 2) { showToast('CSV must have a header row + at least one data row', 'error'); return; }
    const headers = parsed[0].map(function(hdr){ return hdr.trim().toLowerCase().replace(/^﻿/, ''); });
    if (!headers.includes('name')) { showToast('CSV must have a "name" column', 'error'); return; }
    const dataRows = parsed.slice(1).map(function(vals) {
      const obj = {};
      headers.forEach(function(hdr, i) { obj[hdr] = vals[i] !== undefined ? vals[i].trim() : ''; });
      return obj;
    });

    // Fetch existing vendors to detect duplicates
    const existingVendors = await api('/vendors') || [];
    const existingNames = new Set(existingVendors.map(function(v){ return (v.name||'').trim().toLowerCase(); }));

    let newCount = 0, dupCount = 0, invalidCount = 0;
    const classified = dataRows.map(function(row) {
      if (!row.name || !row.name.trim()) { invalidCount++; return {...row, _status:'invalid'}; }
      const norm = row.name.trim().toLowerCase();
      if (existingNames.has(norm)) { dupCount++; return {...row, _status:'duplicate'}; }
      newCount++;
      return {...row, _status:'new'};
    });

    window._vendorCsvRows = classified;

    const preview = document.getElementById('csv-preview');
    const actions = document.getElementById('csv-actions');
    const rowCount = document.getElementById('csv-row-count');

    const statusBadge = function(s) {
      if (s === 'new') return '<span style="background:#d1fae5;color:#065f46;border-radius:4px;padding:1px 7px;font-size:.72rem;font-weight:700">New</span>';
      if (s === 'duplicate') return '<span style="background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 7px;font-size:.72rem;font-weight:700">Duplicate</span>';
      return '<span style="background:#fee2e2;color:#991b1b;border-radius:4px;padding:1px 7px;font-size:.72rem;font-weight:700">Invalid</span>';
    };

    const dispCols = ['name','category','contact_email','contact_phone','location','avg_lead_days','rating'];
    if (preview) preview.innerHTML =
      '<div style="display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap">' +
        '<span style="background:#d1fae5;color:#065f46;border-radius:6px;padding:4px 12px;font-size:.82rem;font-weight:700">' + newCount + ' New</span>' +
        '<span style="background:#fef3c7;color:#92400e;border-radius:6px;padding:4px 12px;font-size:.82rem;font-weight:700">' + dupCount + ' Duplicate</span>' +
        (invalidCount ? '<span style="background:#fee2e2;color:#991b1b;border-radius:6px;padding:4px 12px;font-size:.82rem;font-weight:700">' + invalidCount + ' Invalid</span>' : '') +
      '</div>' +
      '<div style="font-size:.8rem;font-weight:600;color:var(--navy);margin-bottom:6px">Preview (all ' + classified.length + ' rows)</div>' +
      '<div class="table-wrap" style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">' +
      '<table class="table" style="margin:0"><thead><tr><th style="font-size:.73rem">Status</th>' +
      dispCols.map(function(c){ return '<th style="font-size:.73rem">'+c+'</th>'; }).join('') +
      '</tr></thead><tbody>' +
      classified.map(function(row){
        const bg = row._status === 'invalid' ? 'background:#fef2f2' : row._status === 'duplicate' ? 'background:#fefce8' : '';
        return '<tr style="'+bg+'">' +
          '<td>' + statusBadge(row._status) + '</td>' +
          dispCols.map(function(c){ return '<td style="font-size:.76rem">'+(row[c]||'')+'</td>'; }).join('') +
          '</tr>';
      }).join('') +
      '</tbody></table></div>';

    if (actions) actions.style.display = 'block';
    if (rowCount) rowCount.textContent = newCount + ' new, ' + dupCount + ' duplicate' + (invalidCount ? ', ' + invalidCount + ' invalid' : '');
  };
  reader.readAsText(file);
}

async function submitVendorImport() {
  const rows = window._vendorCsvRows;
  if (!rows || !rows.length) { showToast('No data to import', 'error'); return; }
  const overwrite = document.querySelector('input[name="vendor-dup"]:checked')?.value === 'overwrite';
  const btn = document.querySelector('#csv-actions .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }

  const sendRows = rows
    .filter(function(r){ return r._status !== 'invalid'; })
    .map(function(r){ const c = {...r}; delete c._status; return c; });

  showToast('Importing ' + sendRows.length + ' vendors…');
  const res = await api('/import/vendors', { method: 'POST', body: JSON.stringify({rows: sendRows, overwrite}) });
  if (btn) { btn.disabled = false; btn.textContent = 'Import Vendors'; }
  if (!res) return;

  const preview = document.getElementById('csv-preview');
  const allFailed = res.success === 0 && res.failed > 0;
  const partialFail = res.success > 0 && res.failed > 0;
  const bg    = allFailed ? '#fef2f2' : partialFail ? '#fef3c7' : '#d1fae5';
  const bdr   = allFailed ? '#fca5a5' : partialFail ? '#fcd34d' : '#6ee7b7';
  const color = allFailed ? '#b91c1c' : partialFail ? '#92400e' : '#065f46';
  const icon  = allFailed ? '✗' : '✓';
  const skipMsg = res.skipped ? ', ' + res.skipped + ' duplicate(s) skipped' : '';
  const summaryMsg = '<div style="background:'+bg+';border:1px solid '+bdr+';border-radius:8px;padding:12px 16px;margin-bottom:10px;font-size:.85rem;color:'+color+'"><b>'+icon+(allFailed?' Import failed':' Import complete')+'</b> — ' + res.success + ' vendor(s) imported' + skipMsg + (res.failed ? ', <b>' + res.failed + ' failed</b>' : '') + '.</div>';
  const errorsHtml = res.errors && res.errors.length
    ? '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;font-size:.8rem;color:#b91c1c"><b>Errors:</b><ul style="margin:6px 0 0 18px;padding:0">' +
      res.errors.map(function(err){return '<li>'+err+'</li>';}).join('') + '</ul></div>'
    : '';
  if (preview) preview.innerHTML = summaryMsg + errorsHtml;
  window._vendorCsvRows = null;
  window._importJobs = null;
}

function downloadSampleCSV(tab) {
  const isInventory = tab === 'inventory';
  let csv, filename;
  if (tab === 'vendors') {
    csv = [
      'name,category,contact_email,contact_phone,location,address,avg_lead_days,rating',
      'Fresh Farms Pvt Ltd,Produce,contact@freshfarms.in,9876543210,Mumbai,"123 Agri Park, Navi Mumbai",2,4.5',
      'Dairy Direct Co,Dairy,info@dairydirect.in,9812345678,Pune,"45 Cold Chain Hub, Pune",1,4.8',
      'Clean Supply Corp,Hygiene,sales@cleansupply.in,9900112233,Delhi,"Plot 7, Industrial Area, Delhi",3,4.2',
      'Grain Masters Ltd,Grains & Staples,orders@grainmasters.in,9988776655,Ahmedabad,"Warehouse Block B, Ahmedabad",4,4.0',
    ].join('\n');
    filename = 'vendors_sample.csv';
  } else if (isInventory) {
    csv = [
      'sku,name,category,sub_category,brand,stock,unit_price,mrp,cost_excl_gst,gst_rate,reorder_level,max_stock,uom,pack_size,units_per_case,weight_grams,barcode,vendor_sku,vendor_lead_days,vendor_moq',
      'SKU001,Organic Green Tea,Beverages,Healthy,Tata,50,180,220,140,18,10,200,box,12,24,250,,TV-GT-01,3,6',
      'SKU002,Classic Biscuits,Snacks,Normal,Britannia,80,45,55,35,5,20,300,pack,20,40,150,,BB-CL-02,2,10',
      'SKU003,Hand Sanitizer 500ml,Hygiene,Normal,Dettol,30,120,150,90,18,5,100,bottle,6,12,500,,DT-HS-03,4,5',
    ].join('\n');
    filename = 'inventory_sample.csv';
  } else {
    csv = [
      'client_id,grand_total,subtotal,gst,notes',
      'c1,11800,10000,1800,Monthly office supplies',
      'c2,5900,5000,900,Pantry restock',
    ].join('\n');
    filename = 'orders_sample.csv';
  }
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ============================================================
   Feature 19: TEMPLATES
   ============================================================ */
async function renderTemplates(el) {
  const [orderTpls, poTpls] = await Promise.all([
    api('/order-templates'),
    api('/po-templates'),
  ]);
  const oTpls = orderTpls || [];
  const pTpls = poTpls || [];
  APP._tplTab = APP._tplTab || 'orders';

  const kpis = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:22px">
    ${[
      {label:'Order Templates',val:oTpls.length,sub:'saved order templates',color:'var(--primary)'},
      {label:'PO Templates',val:pTpls.length,sub:'saved PO templates',color:'var(--blue)'},
      {label:'Total Templates',val:oTpls.length+pTpls.length,sub:'combined',color:'var(--navy)'},
    ].map(k=>`
      <div class="card" style="padding:16px 18px;border-top:3px solid ${k.color}">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px">${k.label}</div>
        <div style="font-size:1.9rem;font-weight:700;line-height:1">${k.val}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${k.sub}</div>
      </div>
    `).join('')}
  </div>`;

  function tplCard(t, type, loadFn, deleteFn) {
    const items = typeof t.items === 'string' ? JSON.parse(t.items) : (t.items||[]);
    const typeColor = type === 'order' ? 'var(--primary)' : 'var(--blue)';
    const typeLabel = type === 'order' ? 'Order Template' : 'PO Template';
    return `
    <div class="card" style="padding:0;overflow:hidden;border-top:3px solid ${typeColor}">
      <div style="padding:16px 18px 12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div style="font-weight:700;font-size:.95rem">${h(t.name)}</div>
          <span style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:${typeColor};white-space:nowrap;padding:2px 8px;background:${typeColor}1a;border-radius:10px">${typeLabel}</span>
        </div>
        <div style="display:flex;gap:16px;font-size:.8rem;color:var(--text-muted)">
          <span><b style="color:var(--text)">${items.length}</b> item${items.length!==1?'s':''}</span>
          <span>Created ${fmtDate(t.created_at)}</span>
        </div>
        ${t.notes ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:6px;font-style:italic">${h(t.notes)}</div>` : ''}
      </div>
      ${items.length ? `
      <div style="padding:0 18px 10px">
        <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Items</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${items.slice(0,4).map(i=>`<span style="padding:2px 8px;background:#f1f5f9;border-radius:10px;font-size:.75rem">${i.name||i.sku}</span>`).join('')}
          ${items.length>4?`<span style="padding:2px 8px;background:#f1f5f9;border-radius:10px;font-size:.75rem;color:var(--text-muted)">+${items.length-4} more</span>`:''}
        </div>
      </div>` : ''}
      <div style="padding:10px 18px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-danger btn-sm" ${dataAct(deleteFn, type, t.id)}>Delete</button>
        <button class="btn btn-primary btn-sm" ${dataAct(loadFn, t.id)}>Load Template →</button>
      </div>
    </div>`;
  }

  function tabContent(tab) {
    if (tab === 'orders') {
      return oTpls.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${oTpls.map(t=>tplCard(t,'order','loadOrderTemplate','deleteTemplate')).join('')}</div>`
        : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">📋</div>No order templates saved yet<br><small>Load items in Place Order and save as a template</small></div>`;
    }
    return pTpls.length
      ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${pTpls.map(t=>tplCard(t,'po','loadPOTemplate','deleteTemplate')).join('')}</div>`
      : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">📋</div>No PO templates saved yet<br><small>Save a PO as a template to reuse it</small></div>`;
  }

  el.innerHTML = `
  ${pageHeader('Order & PO Templates', 'Reusable templates for quick order/PO creation',
    `<div style="display:flex;gap:8px">
      <button class="btn btn-secondary" ${dataAct('savePOTemplateModal')}>Save PO Template</button>
      <button class="btn btn-gold" ${dataAct('saveOrderTemplateModal')}>Save Order Template</button>
    </div>`)}
  ${kpis}
  <div class="tabs" id="tpl-tabs" style="margin-bottom:16px">
    <button class="tab-btn${APP._tplTab==='orders'?' active':''}" ${dataActEl('tplTab', 'orders')}>Order Templates <span style="font-size:.72rem;opacity:.7">(${oTpls.length})</span></button>
    <button class="tab-btn${APP._tplTab==='po'?' active':''}" ${dataActEl('tplTab', 'po')}>PO Templates <span style="font-size:.72rem;opacity:.7">(${pTpls.length})</span></button>
  </div>
  <div id="tpl-content">${tabContent(APP._tplTab)}</div>`;
}

function tplTab(tab, btn) {
  APP._tplTab = tab;
  document.querySelectorAll('#tpl-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const el = document.getElementById('tpl-content');
  if (!el) return;

  function tplCard(t, type, loadFn, deleteFn) {
    const items = typeof t.items === 'string' ? JSON.parse(t.items) : (t.items||[]);
    const typeColor = type === 'order' ? 'var(--primary)' : 'var(--blue)';
    const typeLabel = type === 'order' ? 'Order Template' : 'PO Template';
    return `
    <div class="card" style="padding:0;overflow:hidden;border-top:3px solid ${typeColor}">
      <div style="padding:16px 18px 12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div style="font-weight:700;font-size:.95rem">${h(t.name)}</div>
          <span style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:${typeColor};white-space:nowrap;padding:2px 8px;background:${typeColor}1a;border-radius:10px">${typeLabel}</span>
        </div>
        <div style="display:flex;gap:16px;font-size:.8rem;color:var(--text-muted)">
          <span><b style="color:var(--text)">${items.length}</b> item${items.length!==1?'s':''}</span>
          <span>Created ${fmtDate(t.created_at)}</span>
        </div>
        ${t.notes ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:6px;font-style:italic">${h(t.notes)}</div>` : ''}
      </div>
      ${items.length ? `
      <div style="padding:0 18px 10px">
        <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Items</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${items.slice(0,4).map(i=>`<span style="padding:2px 8px;background:#f1f5f9;border-radius:10px;font-size:.75rem">${i.name||i.sku}</span>`).join('')}
          ${items.length>4?`<span style="padding:2px 8px;background:#f1f5f9;border-radius:10px;font-size:.75rem;color:var(--text-muted)">+${items.length-4} more</span>`:''}
        </div>
      </div>` : ''}
      <div style="padding:10px 18px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-danger btn-sm" ${dataAct(deleteFn, type, t.id)}>Delete</button>
        <button class="btn btn-primary btn-sm" ${dataAct(loadFn, t.id)}>Load Template →</button>
      </div>
    </div>`;
  }

  if (tab === 'orders') {
    api('/order-templates').then(d => {
      const list = d || [];
      el.innerHTML = list.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${list.map(t=>tplCard(t,'order','loadOrderTemplate','deleteTemplate')).join('')}</div>`
        : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">📋</div>No order templates saved yet</div>`;
    });
  } else {
    api('/po-templates').then(d => {
      const list = d || [];
      el.innerHTML = list.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${list.map(t=>tplCard(t,'po','loadPOTemplate','deleteTemplate')).join('')}</div>`
        : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">📋</div>No PO templates saved yet</div>`;
    });
  }
}

function renderOrderTemplatesTab(orderTpls, poTpls) { /* legacy — replaced by tplTab */ }
function renderPOTemplatesTab(orderTpls, poTpls) { /* legacy — replaced by tplTab */ }

function saveOrderTemplateModal() {
  openModal('Save Order Template',
    `<div class="form-group"><label>Template Name</label><input type="text" id="tpl-name" placeholder="e.g. Monthly Beverages"></div>
     <div class="form-group"><label>Notes</label><textarea id="tpl-notes" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></textarea></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveOrderTemplate')}>Save</button>`);
}

async function saveOrderTemplate() {
  const name = document.getElementById('tpl-name').value;
  if (!name) { showToast('Template name required', 'error'); return; }
  const items = (APP.cart || []).map(c => ({ sku: c.sku, name: c.name, qty: c.qty, unit_price: c.unit_price }));
  const res = await api('/order-templates', {
    method: 'POST',
    body: JSON.stringify({ name, items, notes: document.getElementById('tpl-notes').value }),
  });
  closeModal();
  if (res) { showToast('Template saved'); navigate('templates'); }
}

function savePOTemplateModal() {
  openModal('Save PO Template',
    `<div class="form-group"><label>Template Name</label><input type="text" id="potpl-name" placeholder="e.g. Weekly Dairy Order"></div>
     <div class="form-group"><label>Notes</label><textarea id="potpl-notes" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></textarea></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('savePOTemplate')}>Save</button>`);
}

async function savePOTemplate() {
  const name = document.getElementById('potpl-name').value;
  if (!name) { showToast('Template name required', 'error'); return; }
  const res = await api('/po-templates', {
    method: 'POST',
    body: JSON.stringify({ name, items: [], notes: document.getElementById('potpl-notes').value }),
  });
  closeModal();
  if (res) { showToast('PO Template saved'); navigate('templates'); }
}

function loadOrderTemplate(id) {
  showToast('Template loaded — redirecting to Place Order');
  navigate('place_order');
}

function loadPOTemplate(id) {
  showToast('PO Template loaded — redirecting to Procurement');
  navigate('procurement');
}

function deleteTemplate(type, id) {
  openModal('Delete Template',
    `<p style="margin:0;color:var(--text-muted)">Are you sure you want to delete this template? This cannot be undone.</p>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-danger" ${dataAct('confirmDeleteTemplate', type, id)}>Delete</button>`);
}

async function confirmDeleteTemplate(type, id) {
  const endpoint = type === 'order' ? '/order-templates/' + id : '/po-templates/' + id;
  const res = await api(endpoint, { method: 'DELETE' });
  closeModal();
  if (res) { showToast('Template deleted'); navigate('templates'); }
}

/* ============================================================
   Feature 21: SLA DASHBOARD
   ============================================================ */
async function renderSLADashboard(el) {
  const [rules, breaches] = await Promise.all([
    api('/sla-rules'),
    api('/sla-breaches'),
  ]);
  if (!rules) return;

  const activeBreaches = breaches || [];
  const criticalBreaches = activeBreaches.filter(b => {
    const hoursAgo = (Date.now() - new Date(b.breached_at).getTime()) / 3600000;
    return hoursAgo > 24;
  });

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">SLA Dashboard</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${rules.length} rules configured · ${activeBreaches.length} active breach${activeBreaches.length===1?'':'es'}</div>
    </div>
    <button class="btn btn-gold" ${dataAct('runSLACheck')}>▶ Run SLA Check</button>
  </div>

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">SLA Rules</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${rules.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">active monitoring rules</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${activeBreaches.length?'var(--danger)':'var(--success)'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Active Breaches</div>
      <div style="font-size:2rem;font-weight:800;color:${activeBreaches.length?'var(--danger)':'var(--success)'};margin-top:6px">${activeBreaches.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${activeBreaches.length?'require action':'all clear'}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${criticalBreaches.length?'#dc2626':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Critical (24h+)</div>
      <div style="font-size:2rem;font-weight:800;color:${criticalBreaches.length?'var(--danger)':'var(--navy)'};margin-top:6px">${criticalBreaches.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">breached over 24h ago</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--navy)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Max SLA Hours</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${rules.length ? Math.max(...rules.map(r=>r.max_hours||0)) : '—'}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">longest configured rule</div>
    </div>
  </div>

  <!-- Breaches alert -->
  ${activeBreaches.length ? `
  <div style="font-size:.82rem;font-weight:700;color:var(--danger);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">⚠ Active Breaches</div>
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden;margin-bottom:18px">
    ${activeBreaches.map((b,i)=>{
      const hoursAgo = Math.round((Date.now()-new Date(b.breached_at).getTime())/3600000);
      const isCrit = hoursAgo > 24;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;gap:12px;${i<activeBreaches.length-1?'border-bottom:1px solid var(--border)':''}${isCrit?';background:#fff5f5':''}">
        <div>
          <div style="font-weight:700;font-size:.88rem;color:var(--navy)">${b.rule_name||b.rule_id}</div>
          <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">Entity: <b>${b.entity_id}</b></div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:.78rem;font-weight:600;color:${isCrit?'var(--danger)':'#d97706'}">${hoursAgo}h ago</div>
          <div style="font-size:.68rem;color:var(--text-muted)">${fmtDate(b.breached_at)}</div>
        </div>
      </div>`;
    }).join('')}
  </div>` : `
  <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:12px;padding:16px 20px;margin-bottom:18px;display:flex;align-items:center;gap:12px">
    <span style="font-size:1.5rem">✅</span>
    <div>
      <div style="font-weight:700;color:#065f46">All SLAs within bounds</div>
      <div style="font-size:.78rem;color:#047857;margin-top:2px">No active breaches detected</div>
    </div>
  </div>`}

  <!-- SLA Rules -->
  <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Configured Rules</div>
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    ${rules.length===0 ? `<div style="padding:40px;text-align:center;color:var(--text-muted)">No SLA rules configured</div>` :
    rules.map((r,i)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;gap:12px;${i<rules.length-1?'border-bottom:1px solid var(--border)':''}">
      <div>
        <div style="font-weight:700;font-size:.88rem;color:var(--navy)">${h(r.name)}</div>
        <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">Trigger: ${r.trigger_status?.replace(/_/g,' ')||'—'} → Action: ${r.action||'—'}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:1.1rem;font-weight:800;color:${r.max_hours<=4?'var(--danger)':r.max_hours<=24?'#d97706':'var(--navy)'}">⏱ ${r.max_hours}h</div>
        <div style="font-size:.68rem;color:var(--text-muted)">max hours</div>
      </div>
    </div>`).join('')}
  </div>
  `;
}

async function runSLACheck() {
  const res = await api('/sla/check', { method: 'POST', body: '{}' });
  if (res) {
    showToast('SLA check complete — ' + res.new_breaches + ' new breach(es) detected');
    navigate('sla_dashboard');
  }
}

/* ============================================================
   Feature 24: APPROVAL CHAINS
   ============================================================ */
async function renderApprovalChains(el) {
  const [chains, instances] = await Promise.all([
    api('/approval-chains'),
    api('/approval-chain-instances'),
  ]);
  if (!chains) return;

  const insts = instances || [];
  const pending = insts.length;
  const avgSteps = chains.length ? Math.round(chains.reduce((s,c)=>s+(c.steps||[]).length,0)/chains.length*10)/10 : 0;

  const kpis = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:22px">
    ${[
      {label:'Configured Chains',val:chains.length,sub:'approval workflows',color:'var(--navy)'},
      {label:'Pending Approvals',val:pending,sub:'awaiting action',color:pending?'var(--warning)':'var(--success)'},
      {label:'Avg Steps per Chain',val:avgSteps||'—',sub:'approval levels',color:'var(--blue)'},
    ].map(k=>`
      <div class="card" style="padding:16px 18px;border-top:3px solid ${k.color}">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px">${k.label}</div>
        <div style="font-size:1.9rem;font-weight:700;line-height:1">${k.val}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${k.sub}</div>
      </div>
    `).join('')}
  </div>`;

  const pendingSection = pending ? `
  <div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--warning);font-weight:600;margin-bottom:10px">⏳ Pending Approvals (${pending})</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:22px">
    ${insts.map(inst=>`
    <div class="card" style="padding:0;overflow:hidden;border-left:3px solid var(--warning)">
      <div style="padding:14px 16px 10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-weight:700">Entity #${inst.entity_id}</span>
          <span style="font-size:.72rem;padding:2px 8px;background:#fff8e6;color:#d97706;border-radius:10px">Step ${inst.current_step}</span>
        </div>
        <div style="font-size:.82rem;color:var(--text-muted)">${inst.chain_name||'Chain #'+inst.chain_id}</div>
      </div>
      <div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-danger btn-sm" ${dataAct('actOnChain', inst.id, 'REJECTED')}>Reject</button>
        <button class="btn btn-success btn-sm" ${dataAct('actOnChain', inst.id, 'APPROVED')}>Approve</button>
      </div>
    </div>
    `).join('')}
  </div>` : `
  <div class="card" style="padding:20px 24px;margin-bottom:22px;border-left:3px solid var(--success);display:flex;align-items:center;gap:12px">
    <span style="font-size:1.4rem">✓</span>
    <div><div style="font-weight:600;color:var(--success)">All caught up</div><div style="font-size:.82rem;color:var(--text-muted)">No pending approvals</div></div>
  </div>`;

  const chainsSection = `
  <div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:600;margin-bottom:10px">Configured Chains (${chains.length})</div>
  ${chains.length ? `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
    ${chains.map(c=>{
      const steps = c.steps||[];
      return `
      <div class="card" style="padding:0;overflow:hidden;border-top:3px solid var(--navy)">
        <div style="padding:14px 16px 10px">
          <div style="font-weight:700;font-size:.95rem;margin-bottom:4px">${h(c.name)}</div>
          <div style="font-size:.78rem;color:var(--text-muted)">
            Min: ${fmt(c.min_amount||0)} · ${steps.length} step${steps.length!==1?'s':''}
            ${c.entity_type?` · ${c.entity_type}`:''}
          </div>
        </div>
        <div style="padding:0 16px 14px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${steps.map((s,i)=>`
            <div style="display:flex;align-items:center;gap:4px">
              ${i>0?'<span style="color:var(--text-muted);font-size:.75rem">→</span>':''}
              <span style="padding:3px 10px;background:var(--navy);color:#fff;border-radius:12px;font-size:.75rem;white-space:nowrap">${i+1}. ${ROLES[s.role]?.label||s.role}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
    }).join('')}
  </div>` : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">No approval chains configured yet</div>`}`;

  el.innerHTML = `
  ${pageHeader('Approval Chains', 'Multi-step approval workflows for orders',
    `<button class="btn btn-gold" ${dataAct('newApprovalChainModal')}>New Chain</button>`)}
  ${kpis}
  ${pendingSection}
  ${chainsSection}`;
}

let _chainStepCount = 1;

function newApprovalChainModal() {
  _chainStepCount = 1;
  const roleOpts = Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
  openModal('New Approval Chain',
    `<div class="form-group"><label>Chain Name</label><input type="text" id="chain-name" placeholder="e.g. Large Order Approval"></div>
     <div class="form-group"><label>Min Amount (₹) to Trigger</label><input type="number" id="chain-amount" value="500000"></div>
     <div id="chain-steps">
       <div class="form-group">
         <label>Step 1 Role</label>
         <select class="chain-step-role" data-step="1">${roleOpts}</select>
       </div>
     </div>
     <button type="button" class="btn btn-secondary btn-sm" ${dataAct('addChainStep')}>+ Add Step</button>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveApprovalChain')}>Create Chain</button>`);
}

function addChainStep() {
  _chainStepCount++;
  const roleOpts = Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
  const div = document.createElement('div');
  div.className = 'form-group';
  div.innerHTML = `<label>Step ${_chainStepCount} Role</label><select class="chain-step-role" data-step="${_chainStepCount}">${roleOpts}</select>`;
  document.getElementById('chain-steps').appendChild(div);
}

async function saveApprovalChain() {
  const name = document.getElementById('chain-name').value;
  const minAmount = +document.getElementById('chain-amount').value;
  if (!name) { showToast('Chain name required', 'error'); return; }
  const stepEls = document.querySelectorAll('.chain-step-role');
  const steps = [...stepEls].map((el, i) => ({ role: el.value, label: 'Step ' + (i+1) }));
  const res = await api('/approval-chains', {
    method: 'POST',
    body: JSON.stringify({ name, min_amount: minAmount, steps }),
  });
  closeModal();
  if (res) { showToast('Approval chain created with ' + steps.length + ' step(s)'); navigate('approval_chains'); }
}

function actOnChain(instanceId, action) {
  if (action === 'REJECTED') {
    openModal('Reject Approval',
      `<div class="form-group">
        <label style="font-weight:600;display:block;margin-bottom:6px">Reason for Rejection (optional)</label>
        <textarea id="chain-reject-reason" rows="3" placeholder="Explain why you are rejecting this step…" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;resize:vertical;box-sizing:border-box"></textarea>
      </div>`,
      `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
       <button class="btn btn-danger" ${dataAct('confirmActOnChain', instanceId, 'REJECTED')}>Reject</button>`);
  } else {
    confirmActOnChain(instanceId, action);
  }
}

async function confirmActOnChain(instanceId, action) {
  const comments = action === 'REJECTED' ? (document.getElementById('chain-reject-reason')?.value || '') : '';
  if (action === 'REJECTED') closeModal();
  const res = await api('/approval-chain-instances/' + instanceId + '/act', {
    method: 'POST',
    body: JSON.stringify({ action, comments }),
  });
  if (res) {
    showToast(action === 'APPROVED' ? (res.all_steps_done ? 'Order fully approved!' : 'Step approved — next step notified') : 'Rejected — order cancelled');
    navigate('approval_chains');
  }
}
