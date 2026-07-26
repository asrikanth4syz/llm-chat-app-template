/* ============================================================
   VENDORS
   ============================================================ */
async function renderVendors(el) {
  const allVendors = await api('/vendors');
  if (!allVendors) return;

  // State for filtering
  if (!APP._vendorSearch) APP._vendorSearch = '';
  if (!APP._vendorCat) APP._vendorCat = '';
  if (!APP._vendorLoc) APP._vendorLoc = '';
  if (!APP._vendorShowInactive) APP._vendorShowInactive = false;

  function applyFilters(list) {
    const q = (APP._vendorSearch||'').toLowerCase();
    const cat = APP._vendorCat||'';
    const loc = (APP._vendorLoc||'').toLowerCase();
    return list.filter(v => {
      if (!APP._vendorShowInactive && v.active===0) return false;
      if (q && !v.name.toLowerCase().includes(q) && !(v.category||'').toLowerCase().includes(q)) return false;
      if (cat && !(v.category||'').split(',').map(s=>s.trim()).includes(cat)) return false;
      if (loc && !(v.location||'').toLowerCase().includes(loc)) return false;
      return true;
    });
  }

  const vendors = applyFilters(allVendors);
  const activeVendors = allVendors.filter(v=>v.active!==0);
  const avgOnTime  = activeVendors.length ? Math.round(activeVendors.reduce((s,v)=>s+(v.on_time_rate||0),0)/activeVendors.length) : 0;
  const avgFill    = activeVendors.length ? Math.round(activeVendors.reduce((s,v)=>s+(v.fill_rate||0),0)/activeVendors.length) : 0;
  const atRisk     = activeVendors.filter(v=>(v.on_time_rate||0)<75||(v.fill_rate||0)<85).length;
  const allCategories = [...new Set([...VENDOR_CATS, ...allVendors.flatMap(v=>(v.category||'').split(',').map(s=>s.trim())).filter(Boolean)])].sort();

  function scoreColor(val) {
    return val >= 90 ? 'var(--success)' : val >= 75 ? '#d97706' : 'var(--danger)';
  }

  function starRating(rating) {
    const r = Math.round(+rating * 2) / 2;
    return Array.from({length:5}, (_,i) =>
      `<span style="color:${i < r ? 'var(--amber)' : 'var(--gray-light)'};font-size:.8rem">★</span>`
    ).join('');
  }

  function vendorCard(v) {
    const onTimeColor = scoreColor(v.on_time_rate||0);
    const fillColor   = scoreColor(v.fill_rate||0);
    const isAtRisk    = (v.on_time_rate||0)<75 || (v.fill_rate||0)<85;
    const initials    = v.name.split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().slice(0,2);
    return `
    <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:18px 20px;border-top:3px solid ${isAtRisk?'var(--danger)':'var(--success)'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:42px;height:42px;border-radius:10px;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:700;flex-shrink:0">${initials}</div>
          <div>
            <div style="font-weight:800;font-size:.95rem;color:var(--navy)">${h(v.name)}</div>
            ${v.vendor_code?`<div style="font-family:ui-monospace,monospace;font-size:.68rem;font-weight:700;letter-spacing:.03em;color:var(--text-muted);margin-top:1px">${v.vendor_code}</div>`:''}
            <div style="display:flex;align-items:center;gap:4px;margin-top:3px;flex-wrap:wrap">
              ${(v.category||'—').split(',').filter(Boolean).map(c=>`<span style="font-size:.65rem;font-weight:600;background:#e6f1fb;color:var(--blue);border-radius:4px;padding:1px 6px">${c.trim()}</span>`).join('')}
              ${isAtRisk?`<span style="font-size:.66rem;font-weight:700;background:var(--danger-bg);color:var(--danger);border-radius:4px;padding:1px 6px">⚠ At Risk</span>`:''}
            </div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:.76rem">${starRating(v.rating||0)}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">${(+v.rating||0).toFixed(1)} / 5.0</div>
        </div>
      </div>

      <!-- Performance metrics -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-bottom:3px">
            <span>On-time Rate</span>
            <span style="font-weight:700;color:${onTimeColor}">${pct(v.on_time_rate||0)}</span>
          </div>
          <div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${v.on_time_rate||0}%;background:${onTimeColor};border-radius:3px"></div>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-bottom:3px">
            <span>Fill Rate</span>
            <span style="font-weight:700;color:${fillColor}">${pct(v.fill_rate||0)}</span>
          </div>
          <div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${v.fill_rate||0}%;background:${fillColor};border-radius:3px"></div>
          </div>
        </div>
      </div>

      <!-- Meta row -->
      <div style="display:flex;align-items:center;gap:12px;font-size:.74rem;color:var(--text-muted);margin-bottom:${v.address?'6px':'14px'};flex-wrap:wrap">
        <span>⏱ ${v.avg_lead_days||'—'}d lead time</span>
        ${v.location?`<span>🏙 ${v.location}</span>`:''}
        ${v.contact_email?`<span>✉ <a href="mailto:${h(v.contact_email)}" style="color:var(--blue)">${h(v.contact_email)}</a></span>`:''}
        ${v.contact_phone?`<span>📞 ${v.contact_phone}</span>`:''}
      </div>
      ${v.address||v.map_pin?`<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:14px;display:flex;align-items:flex-start;gap:6px">
        <span style="flex-shrink:0">📍</span>
        <span>${v.address||''}${(v.address&&v.map_pin)?' · ':''}${v.map_pin?`<a href="${mapsLink(v.map_pin,v.address)}" target="_blank" rel="noopener" style="color:var(--blue)">Map</a>`:''}</span>
      </div>`:''}

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" ${dataAct('viewVendorById', _regVendor(v))}>View</button>
        <button class="btn btn-gold btn-sm" ${dataAct('editVendorById', _regVendor(v))}>Edit</button>
        <button class="btn btn-sm" style="background:${v.active===0?'var(--success)':'var(--danger-soft-bg)'};color:${v.active===0?'#fff':'var(--danger)'};border:none" ${dataAct('toggleVendorActive', v.id, v.name, v.active===0?0:1)}>${v.active===0?'Enable':'Disable'}</button>
        <button class="btn btn-gold btn-sm" ${dataAct('newPOForVendor', v.id, v.name)}>New PO</button>
        <button class="btn btn-secondary btn-sm" ${dataAct('openVendorFeedbackModal', v.id, v.name)}>Rate</button>
      </div>
    </div>`;
  }

  // FSSAI licence alert — food vendors whose licence has expired or lapses within 30 days.
  const _today = new Date().toISOString().slice(0,10);
  const _soon  = new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const fssaiFlagged = (allVendors||[]).filter(v => v.active!==0 && v.vendor_type==='food' && v.fssai_expiry && v.fssai_expiry <= _soon)
    .sort((a,b) => (a.fssai_expiry||'').localeCompare(b.fssai_expiry||''));
  const fssaiExpired = fssaiFlagged.filter(v => v.fssai_expiry < _today);
  const fssaiSoon    = fssaiFlagged.filter(v => v.fssai_expiry >= _today);
  const anyExpired = fssaiExpired.length > 0;
  const fssaiChip = v => {
    const btn = `<button class="btn btn-sm" style="background:#fff;border:1px solid var(--border);font-size:.72rem" ${dataAct('editVendorById', _regVendor(v))}>Renew</button>`;
    const expd = v.fssai_expiry < _today;
    return `<span style="display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid ${expd?'#fca5a5':'#fde68a'};border-radius:8px;padding:5px 8px 5px 11px;font-size:.78rem">
      <span><b>${h(v.name)}</b> · <span style="color:${expd?'var(--danger)':'#b45309'};font-weight:700">${expd?'expired':'expires'} ${fmtDate(v.fssai_expiry)}</span></span>${btn}</span>`;
  };
  const fssaiBanner = fssaiFlagged.length ? `
    <div style="background:${anyExpired?'var(--danger-bg)':'var(--warning-bg)'};border:1.5px solid ${anyExpired?'#fca5a5':'#fde68a'};border-radius:12px;padding:13px 16px;margin-bottom:16px">
      <div style="font-weight:800;color:${anyExpired?'var(--danger)':'#b45309'};font-size:.9rem;margin-bottom:8px">🍽 FSSAI licence attention — ${fssaiFlagged.length} food vendor${fssaiFlagged.length>1?'s':''}${anyExpired?` · ${fssaiExpired.length} expired`:''}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${[...fssaiExpired, ...fssaiSoon].map(fssaiChip).join('')}</div>
    </div>` : '';

  el.innerHTML = `
  ${fssaiBanner}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Vendor Directory</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${activeVendors.length} active vendors · avg on-time ${avgOnTime}% · avg fill ${avgFill}%</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary" ${dataAct('navigate', 'procurement')}>View POs</button>
      ${!['client_admin','client_user','client_approver','vendor_admin','vendor_user','delivery_exec'].includes(APP.user?.role) ? '<button class="btn btn-secondary" '+dataAct('goImportVendors')+'>⬆ Import CSV</button>' : ''}
      <button class="btn btn-gold" ${dataAct('addVendorModal')}>${iconPlus(14)} Add Vendor</button>
    </div>
  </div>

  <!-- Search & Filter bar -->
  <div style="background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <input type="text" id="vendor-search-q" placeholder="Search by name or brand…" value="${APP._vendorSearch||''}"
      style="flex:1;min-width:180px;border:1.5px solid var(--border);border-radius:8px;padding:7px 12px;font-size:.84rem"
      ${dataInput('filterVendorCards')}>
    <select id="vendor-search-cat" style="border:1.5px solid var(--border);border-radius:8px;padding:7px 10px;font-size:.84rem;background:#fff"
      ${dataChangeEl('vendorSetCat')}>
      <option value="">All Categories</option>
      ${allCategories.map(c=>`<option value="${c}"${APP._vendorCat===c?' selected':''}>${c}</option>`).join('')}
    </select>
    <input type="text" id="vendor-search-loc" placeholder="Filter by location…" value="${APP._vendorLoc||''}"
      style="width:160px;border:1.5px solid var(--border);border-radius:8px;padding:7px 12px;font-size:.84rem"
      ${dataInput('filterVendorCards')}>
    <label style="display:flex;align-items:center;gap:6px;font-size:.82rem;color:var(--text-muted);cursor:pointer">
      <input type="checkbox" ${APP._vendorShowInactive?'checked':''} ${dataChangeEl('vendorToggleInactive')}> Show inactive
    </label>
    <button class="btn btn-secondary btn-sm" id="vendor-clear-btn" style="display:none" ${dataAct('clearVendorSearch')}>Clear</button>
  </div>

  <!-- Summary tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div class="u-label2">Total Vendors</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${activeVendors.length}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${scoreColor(avgOnTime)}">
      <div class="u-label2">Avg On-time Rate</div>
      <div style="font-size:2rem;font-weight:800;color:${scoreColor(avgOnTime)};margin-top:6px">${avgOnTime}%</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${scoreColor(avgFill)}">
      <div class="u-label2">Avg Fill Rate</div>
      <div style="font-size:2rem;font-weight:800;color:${scoreColor(avgFill)};margin-top:6px">${avgFill}%</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${atRisk?'var(--danger)':'var(--gray-light)'}">
      <div class="u-label2">At Risk</div>
      <div style="font-size:2rem;font-weight:800;color:${atRisk?'var(--danger)':'var(--navy)'};margin-top:6px">${atRisk}</div>
      <div class="u-subtiny">below performance threshold</div>
    </div>
  </div>

  <!-- Vendor cards -->
  <div id="vendor-no-match" style="text-align:center;padding:40px;color:var(--text-muted);display:${vendors.length===0?'block':'none'}">No vendors match your search.</div>
  <div id="vendor-cards-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
    ${allVendors.sort((a,b)=>{
      const aRisk = ((a.on_time_rate||0)<75||(a.fill_rate||0)<85)?1:0;
      const bRisk = ((b.on_time_rate||0)<75||(b.fill_rate||0)<85)?1:0;
      return bRisk - aRisk || (b.rating||0)-(a.rating||0);
    }).map(v=>`<div data-vname="${(v.name||'').toLowerCase()}" data-vcat="${(v.category||'').toLowerCase()}" data-vloc="${(v.location||'').toLowerCase()}" data-vactive="${v.active===0?'0':'1'}">${vendorCard(v)}</div>`).join('')}
  </div>
  `;
  APP._allVendors = allVendors;
  filterVendorCards();
}

function filterVendorCards() {
  const q   = (document.getElementById('vendor-search-q')?.value||'').toLowerCase().trim();
  const loc = (document.getElementById('vendor-search-loc')?.value||'').toLowerCase().trim();
  const cat = APP._vendorCat||'';
  APP._vendorSearch = q;
  APP._vendorLoc    = loc;
  let visible = 0;
  document.querySelectorAll('#vendor-cards-grid > [data-vname]').forEach(el => {
    const nameMatch = !q || el.dataset.vname.includes(q) || el.dataset.vcat.includes(q);
    const locMatch  = !loc || el.dataset.vloc.includes(loc);
    const catMatch  = !cat || el.dataset.vcat.includes(cat.toLowerCase());
    const activeOk  = APP._vendorShowInactive || el.dataset.vactive !== '0';
    const show = nameMatch && locMatch && catMatch && activeOk;
    el.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  const noMatch = document.getElementById('vendor-no-match');
  if (noMatch) noMatch.style.display = visible === 0 ? 'block' : 'none';
  const clearBtn = document.getElementById('vendor-clear-btn');
  if (clearBtn) clearBtn.style.display = (q||loc||cat) ? '' : 'none';
}

const VENDOR_CATS = ['Beverages & Snacks','Office Supplies','Hygiene & Cleaning','Office Furniture','Electronics','Dairy & Fresh','Dry Grocery','IT & Technology','Pantry Equipment','Stationery'];

function vendorCatCheckboxes(prefix, selected) {
  const sel = (selected||'').split(',').map(s=>s.trim()).filter(Boolean);
  return `<div class="form-group">
    <label>Category / Brand <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(select all that apply)</span></label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin-top:6px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;padding:12px">
      ${VENDOR_CATS.map(c=>`
        <label style="display:flex;align-items:center;gap:8px;font-size:.84rem;cursor:pointer;padding:3px 0">
          <input type="checkbox" name="${prefix}-cat" value="${c}" ${sel.includes(c)?'checked':''} style="accent-color:var(--navy);width:15px;height:15px"> ${c}
        </label>`).join('')}
    </div>
  </div>`;
}

function getCheckedCats(prefix) {
  return [...document.querySelectorAll(`input[name="${prefix}-cat"]:checked`)].map(i=>i.value).join(',');
}

function vendorFormFields(prefix, v={}) {
  return `
    <div class="grid-2">
      <div class="form-group"><label>Company Name *</label><input type="text" id="${prefix}-name" value="${v.name||''}"></div>
      <div class="form-group"><label>City / Area</label><input type="text" id="${prefix}-loc" value="${v.location||''}" placeholder="e.g. Bengaluru, BTM Layout"></div>
    </div>
    ${vendorCatCheckboxes(prefix, v.category||'')}
    <div class="form-group"><label>Full Address</label>
      <textarea id="${prefix}-address" rows="2" style="width:100%;border:1.5px solid var(--border);border-radius:8px;padding:8px 12px;font-size:.84rem;resize:vertical">${v.address||''}</textarea>
    </div>
    <div class="form-group">
      <label>Map Location <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(paste Google Maps link, or lat,lng e.g. 12.9716,77.5946)</span></label>
      <input type="text" id="${prefix}-mappin" value="${v.map_pin||''}" placeholder="https://maps.google.com/... or 12.9716,77.5946">
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Contact Email</label><input type="email" id="${prefix}-email" value="${v.contact_email||''}"></div>
      <div class="form-group"><label>Contact Phone</label><input type="tel" id="${prefix}-phone" value="${v.contact_phone||''}"></div>
    </div>

    <div style="border-top:1px solid var(--border);margin:6px 0 12px;padding-top:12px;font-size:.78rem;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.04em">Registration &amp; Compliance</div>
    <div class="grid-2">
      <div class="form-group"><label>Registration</label>
        <select id="${prefix}-regtype" ${dataChange('onVendorRegChange', prefix)}>
          <option value="registered" ${(v.registration_type||'registered')==='registered'?'selected':''}>Registered (GST)</option>
          <option value="unregistered" ${v.registration_type==='unregistered'?'selected':''}>Unregistered</option>
        </select>
      </div>
      <div class="form-group"><label>Vendor Type</label>
        <select id="${prefix}-vtype" ${dataChange('onVendorTypeChange', prefix)}>
          <option value="non_food" ${(v.vendor_type||'non_food')==='non_food'?'selected':''}>Non-food</option>
          <option value="food" ${v.vendor_type==='food'?'selected':''}>Food</option>
        </select>
      </div>
    </div>
    <div id="${prefix}-reg-fields" style="display:${(v.registration_type||'registered')==='registered'?'block':'none'}">
      <div class="grid-2">
        <div class="form-group">
          <label>PAN <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(10 chars, e.g. ABCDE1234F)</span></label>
          <input type="text" id="${prefix}-pan" value="${v.pan||''}" placeholder="ABCDE1234F" maxlength="10" spellcheck="false"
            style="text-transform:uppercase;letter-spacing:.04em" ${dataInputEl('maskUpper', 10)}>
          <div id="${prefix}-pan-msg" style="font-size:.72rem;margin-top:4px;min-height:1em"></div>
        </div>
        <div class="form-group">
          <label>GST Number <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(15-char GSTIN)</span></label>
          <input type="text" id="${prefix}-gstin" value="${v.gstin||''}" placeholder="29ABCDE1234F1ZW" maxlength="15" spellcheck="false"
            style="text-transform:uppercase;letter-spacing:.04em" ${dataInputEl('onGstInput', prefix)}>
          <div id="${prefix}-gstin-msg" style="font-size:.72rem;margin-top:4px;min-height:1em"></div>
        </div>
      </div>
    </div>
    <div id="${prefix}-food-fields" style="display:${v.vendor_type==='food'?'block':'none'}">
      <div class="grid-2">
        <div class="form-group">
          <label>FSSAI Licence No. <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(14 digits)</span></label>
          <input type="text" id="${prefix}-fssai" value="${v.fssai_licence||''}" placeholder="10012345000123" maxlength="14" inputmode="numeric"
            ${dataInputEl('maskDigits', 14)}>
          <div id="${prefix}-fssai-msg" style="font-size:.72rem;margin-top:4px;min-height:1em"></div>
        </div>
        <div class="form-group">
          <label>FSSAI Expiry Date</label>
          <input type="date" id="${prefix}-fssai-exp" value="${v.fssai_expiry||''}">
        </div>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);margin:6px 0 12px;padding-top:12px;font-size:.78rem;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.04em">Delivery & Visit Schedule</div>
    <div class="grid-2">
      <div class="form-group">
        <label>Lead Time for Delivery <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(days)</span></label>
        <input type="number" id="${prefix}-lead" min="0" step="1" value="${v.avg_lead_days!=null?v.avg_lead_days:''}" placeholder="e.g. 3">
      </div>
      <div class="form-group">
        <label>Visit Frequency</label>
        <select id="${prefix}-visitfreq" ${dataChange('onVendorVisitFreqChange', prefix)}>
          ${['','Weekly','Fortnightly','Monthly','On-Demand'].map(f=>`<option value="${f}" ${(v.visit_frequency||'')===f?'selected':''}>${f||'— Not scheduled —'}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group" id="${prefix}-visitday-wrap" style="display:${(v.visit_frequency==='Weekly'||v.visit_frequency==='Fortnightly'||v.visit_frequency==='Monthly')?'block':'none'}">
      <label id="${prefix}-visitday-label">Visit Day</label>
      <div id="${prefix}-visitday-field">${vendorVisitDayField(prefix, v.visit_frequency||'', v.visit_day||'')}</div>
    </div>

    <div class="form-group">
      <label>Comments / Notes <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(product list, packaging, MOQ, payment terms, anything relevant)</span></label>
      <textarea id="${prefix}-notes" rows="3" style="width:100%;border:1.5px solid var(--border);border-radius:8px;padding:8px 12px;font-size:.84rem;resize:vertical" placeholder="e.g. Supplies: Bru Coffee 200g, Tata Tea 1kg… · MOQ 24 units · Delivers Tue & Fri · Payment: 15-day credit">${v.notes||''}</textarea>
    </div>`;
}

const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function vendorVisitDayField(prefix, freq, current) {
  if (freq === 'Monthly') {
    return `<input type="number" id="${prefix}-visitday" min="1" max="31" value="${current||''}" placeholder="Day of month (1–31)" style="max-width:200px">`;
  }
  // Weekly / Fortnightly → weekday picker
  return `<select id="${prefix}-visitday" style="max-width:220px">
    <option value="">— Select day —</option>
    ${WEEKDAYS.map(d=>`<option value="${d}" ${current===d?'selected':''}>${d}</option>`).join('')}
  </select>`;
}

function onVendorRegChange(prefix) {
  const reg = document.getElementById(`${prefix}-regtype`)?.value === 'registered';
  const el = document.getElementById(`${prefix}-reg-fields`);
  if (el) el.style.display = reg ? 'block' : 'none';
}
function onVendorTypeChange(prefix) {
  const food = document.getElementById(`${prefix}-vtype`)?.value === 'food';
  const el = document.getElementById(`${prefix}-food-fields`);
  if (el) el.style.display = food ? 'block' : 'none';
}

// Validate a vendor's compliance client-side and fold the values into `body`.
// registered ⇒ valid GSTIN (+ PAN); food ⇒ 14-digit FSSAI + expiry.
function validateVendorCompliance(prefix, body) {
  if (body.registration_type === 'registered') {
    const gst = (document.getElementById(`${prefix}-gstin`)?.value || '').trim();
    if (!gst) { taxMsg(prefix, 'gstin', 'GST number is required for a registered vendor.'); showToast('Registered vendor needs a GST number', 'error'); return false; }
    const tax = readTaxIds(prefix);
    if (!tax.ok) { showToast('Check the PAN / GST number', 'error'); return false; }
    body.gstin = tax.gstin; body.pan = tax.pan;
  } else { body.gstin = null; body.pan = null; }

  if (body.vendor_type === 'food') {
    const lic = (document.getElementById(`${prefix}-fssai`)?.value || '').trim();
    const exp = document.getElementById(`${prefix}-fssai-exp`)?.value || '';
    const msg = document.getElementById(`${prefix}-fssai-msg`);
    if (!/^\d{14}$/.test(lic)) { if (msg) { msg.textContent = `FSSAI licence must be 14 digits (${lic.length}/14).`; msg.style.color = 'var(--danger)'; } showToast('Enter a valid 14-digit FSSAI licence', 'error'); return false; }
    if (!exp) { showToast('Enter the FSSAI expiry date', 'error'); return false; }
    if (msg) msg.textContent = '';
    body.fssai_licence = lic; body.fssai_expiry = exp;
  } else { body.fssai_licence = null; body.fssai_expiry = null; }
  return true;
}

function onVendorVisitFreqChange(prefix) {
  const freq = document.getElementById(`${prefix}-visitfreq`)?.value || '';
  const wrap = document.getElementById(`${prefix}-visitday-wrap`);
  const label = document.getElementById(`${prefix}-visitday-label`);
  const field = document.getElementById(`${prefix}-visitday-field`);
  const showDay = ['Weekly','Fortnightly','Monthly'].includes(freq);
  if (wrap) wrap.style.display = showDay ? 'block' : 'none';
  if (label) label.textContent = freq === 'Monthly' ? 'Visit Day of Month' : 'Visit Weekday';
  if (field) field.innerHTML = vendorVisitDayField(prefix, freq, '');
}

// ── Vendor onboarding wizard ────────────────────────────────
const VW_STEPS = ['Business & compliance','Bank','Documents','Products','Review'];
const VW_DOCS = [
  { kind:'cancelled_cheque', label:'Cancelled cheque' },
  { kind:'gst_cert',        label:'GST certificate' },
  { kind:'fssai',           label:'FSSAI licence copy' },
  { kind:'pan',             label:'PAN card', opt:true },
  { kind:'agreement',       label:'Supply agreement', opt:true },
];
const _gv = id => (document.getElementById(id)?.value || '').trim();

function addVendorModal() { openVendorWizard(null); }

function openVendorWizard(v) {
  APP._vw = { step:0, editId: v?.id || null, docs:{}, steps: VW_STEPS.length };
  openModal(v ? `Edit vendor: ${v.name}` : 'Vendor onboarding',
    vendorWizardHtml(v || {}),
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>`);
  VW_DOCS.forEach(d => vwRenderDrop(d.kind));
  if (!v || !v.id) vwAddProductRow({});
  else vwLoadExisting(v.id);
  vwGo(0);
}

function vendorWizardHtml(v) {
  const inS = 'width:100%;border:1.5px solid var(--border);border-radius:8px;padding:8px 11px;font-size:.85rem;box-sizing:border-box';
  return `
    <div class="vw-stepper">
      ${VW_STEPS.map((s,i)=>`<button class="vw-step${i===0?' on':''}" id="vwstep-${i}" ${dataAct('vwGo', i)}><span class="n">${i+1}</span><span class="lab">${s}</span></button>`).join('')}
    </div>
    <div class="vw-prog"><i id="vw-prog" style="width:20%"></i></div>

    <div class="vw-panel on" id="vwp-0">${vendorFormFields('vw', v)}</div>

    <div class="vw-panel" id="vwp-1">
      <p class="vw-step-title">Bank &amp; payout</p>
      <p class="vw-step-desc">Where payments go. Upload the cancelled cheque on the next step.</p>
      <div class="grid-2">
        <div class="form-group"><label>Account holder name <span class="u-danger">*</span></label><input id="vw-bank-acname" style="${inS}" value="${h(v.bank_account_name||'')}" placeholder="As per bank records"></div>
        <div class="form-group"><label>Account number <span class="u-danger">*</span></label><input id="vw-bank-acno" style="${inS}" value="${h(v.bank_account_no||'')}" inputmode="numeric" placeholder="Bank account no."></div>
        <div class="form-group"><label>IFSC <span class="u-danger">*</span> <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(11 chars, e.g. HDFC0001234)</span></label>
          <input id="vw-bank-ifsc" style="${inS};text-transform:uppercase;letter-spacing:.04em" value="${h(v.bank_ifsc||'')}" maxlength="11" spellcheck="false"
            ${dataInputEl('maskUpper', 11)}><div id="vw-bank-ifsc-msg" style="font-size:.72rem;margin-top:4px;min-height:1em"></div></div>
        <div class="form-group"><label>Bank name</label><input id="vw-bank-bankname" style="${inS}" value="${h(v.bank_name||'')}" placeholder="e.g. HDFC Bank"></div>
        <div class="form-group"><label>Branch</label><input id="vw-bank-branch" style="${inS}" value="${h(v.bank_branch||'')}" placeholder="e.g. BTM Layout"></div>
        <div class="form-group"><label>UPI ID <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(optional)</span></label><input id="vw-upi" style="${inS}" value="${h(v.upi_id||'')}" placeholder="name@bank"></div>
      </div>
      <div class="form-group"><label>Payment terms</label><input id="vw-terms" style="${inS}" value="${h(v.payment_terms||'')}" placeholder="e.g. Net 15 days"></div>
    </div>

    <div class="vw-panel" id="vwp-2">
      <p class="vw-step-title">Documents</p>
      <p class="vw-step-desc">PDF, JPG or PNG · up to 1 MB each. Required set depends on registration &amp; type.</p>
      ${VW_DOCS.map(d=>`<div class="vw-drop" id="vwdrop-${d.kind}"></div>`).join('')}
    </div>

    <div class="vw-panel" id="vwp-3">
      <p class="vw-step-title">Products supplied</p>
      <p class="vw-step-desc">What they sell us — basis for POs. Link a catalogue SKU or leave blank for a new one.</p>
      <div class="table-wrap" style="border:1px solid var(--border);border-radius:10px">
        <table class="table" style="margin:0">
          <thead><tr><th>Item</th><th>Pack</th><th style="width:66px">MOQ</th><th style="width:86px">Rate ₹</th><th style="width:66px">Lead d</th><th>SKU</th><th style="width:36px"></th></tr></thead>
          <tbody id="vw-products"></tbody>
        </table>
      </div>
      <button class="btn btn-secondary btn-sm" style="margin-top:10px" ${dataAct('vwAddProductRow', {})}>+ Add product</button>
    </div>

    <div class="vw-panel" id="vwp-4">
      <p class="vw-step-title">Review &amp; submit</p>
      <p class="vw-step-desc">Completeness at a glance. You can submit now — ops verifies and activates the vendor.</p>
      <div id="vw-review"></div>
    </div>

    <div class="vw-nav">
      <button class="btn btn-secondary" id="vw-back" ${dataAct('vwStep', -1)}>← Back</button>
      <span style="font-size:.74rem;color:var(--text-muted)">Step <b id="vw-stepno">1</b> of ${VW_STEPS.length}</span>
      <button class="btn btn-primary" id="vw-next" ${dataAct('vwStep', 1)}>Continue →</button>
    </div>`;
}

function vwGo(i) {
  const last = APP._vw.steps - 1;
  APP._vw.step = i;
  VW_STEPS.forEach((_,k)=>{ document.getElementById('vwstep-'+k)?.classList.toggle('on', k===i);
    document.getElementById('vwp-'+k)?.classList.toggle('on', k===i); });
  const prog = document.getElementById('vw-prog'); if (prog) prog.style.width = Math.round((i+1)/VW_STEPS.length*100)+'%';
  const back = document.getElementById('vw-back'); if (back) back.style.visibility = i===0 ? 'hidden' : 'visible';
  const next = document.getElementById('vw-next'); if (next) next.textContent = i===last ? 'Submit for verification' : 'Continue →';
  const sn = document.getElementById('vw-stepno'); if (sn) sn.textContent = i+1;
  if (i===last) vwRenderReview();
  document.getElementById('modal-body')?.scrollTo({ top:0, behavior:'smooth' });
}
function vwStep(d) {
  const ni = APP._vw.step + d;
  if (ni > APP._vw.steps - 1) { saveVendorWizard(); return; }
  vwGo(Math.max(0, ni));
}

function vwRenderDrop(kind) {
  const el = document.getElementById('vwdrop-' + kind); if (!el) return;
  const meta = VW_DOCS.find(x => x.kind === kind) || { label: kind };
  const d = APP._vw.docs[kind];
  if (d) {
    el.className = 'vw-drop done';
    el.innerHTML = `<div class="ic">✓</div><div style="min-width:0"><div class="t">${meta.label}</div>
      <div class="s">${h(d.filename||'file')} · ${Math.max(1,Math.round((d.size||0)/1024))} KB${d.existing?' · on file':''}</div></div>
      <button class="btn btn-secondary btn-sm act" ${dataAct('vwRemoveDoc', kind)}>Remove</button>`;
  } else {
    el.className = 'vw-drop';
    el.innerHTML = `<div class="ic">＋</div><div style="min-width:0"><div class="t">${meta.label}${meta.opt?' <span style="color:var(--text-muted);font-weight:400">(optional)</span>':''}</div>
      <div class="s">Click to upload · PDF/JPG/PNG · max 1 MB</div></div>
      <label class="btn btn-secondary btn-sm act" style="cursor:pointer;margin:0">Upload<input type="file" accept="image/*,application/pdf" style="display:none" ${dataChangeEl('vwPickFile', kind)}></label>`;
  }
}
function vwPickFile(kind, input) {
  const f = input.files && input.files[0]; if (!f) return;
  if (f.size > 1200000) { showToast('File too large — keep uploads under 1 MB', 'error'); input.value=''; return; }
  const r = new FileReader();
  r.onload = () => { APP._vw.docs[kind] = { kind, filename:f.name, mime:f.type, size:f.size, data:r.result }; vwRenderDrop(kind); };
  r.readAsDataURL(f);
}
function vwRemoveDoc(kind) { delete APP._vw.docs[kind]; vwRenderDrop(kind); }

function vwAddProductRow(p) {
  const tb = document.getElementById('vw-products'); if (!tb) return;
  const cs = 'width:100%;border:1px solid var(--border);border-radius:6px;padding:5px 7px;font-size:.8rem;box-sizing:border-box';
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="vwp-name" style="${cs}" value="${h(p.name||'')}" placeholder="Item name"></td>
    <td><input class="vwp-pack" style="${cs}" value="${h(p.pack||'')}" placeholder="Carton·24"></td>
    <td><input class="vwp-moq" type="number" min="1" style="${cs};text-align:right" value="${p.moq||1}"></td>
    <td><input class="vwp-rate" type="number" min="0" style="${cs};text-align:right" value="${p.rate!=null?p.rate:''}"></td>
    <td><input class="vwp-lead" type="number" min="0" style="${cs};text-align:right" value="${p.lead_days!=null?p.lead_days:3}"></td>
    <td><input class="vwp-sku" style="${cs}" value="${h(p.sku||'')}" placeholder="optional"></td>
    <td><button class="btn btn-secondary btn-sm" style="padding:3px 8px" ${dataActEl('removeClosestRow')}>✕</button></td>`;
  tb.appendChild(tr);
}
function vwCollectProducts() {
  return [...document.querySelectorAll('#vw-products tr')].map(tr => ({
    name: tr.querySelector('.vwp-name').value.trim(),
    pack: tr.querySelector('.vwp-pack').value.trim(),
    moq: +tr.querySelector('.vwp-moq').value || 1,
    rate: +tr.querySelector('.vwp-rate').value || 0,
    lead_days: +tr.querySelector('.vwp-lead').value || 3,
    sku: tr.querySelector('.vwp-sku').value.trim() || null,
  })).filter(p => p.name);
}

async function vwLoadExisting(id) {
  const [docs, prods] = await Promise.all([
    api(`/vendors/${id}/documents`).catch(()=>[]),
    api(`/vendors/${id}/products`).catch(()=>[]),
  ]);
  (docs||[]).forEach(d => { APP._vw.docs[d.kind] = { kind:d.kind, filename:d.filename, mime:d.mime, size:d.size, data:d.data, existing:true }; vwRenderDrop(d.kind); });
  const tb = document.getElementById('vw-products');
  if (tb) { tb.innerHTML = ''; (prods||[]).forEach(p => vwAddProductRow(p)); if (!(prods||[]).length) vwAddProductRow({}); }
}

// Single source of truth for what the wizard needs. `required` items block
// submission; the rest are recommended. `show:false` items don't apply to this
// vendor (e.g. GST cert for an unregistered vendor).
function vwRequirements() {
  const regd = _gv('vw-regtype') === 'registered';
  const food = _gv('vw-vtype') === 'food';
  const ifsc = (_gv('vw-bank-ifsc') || '').toUpperCase();
  const ifscValid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
  return [
    { label:'Company name',              step:0, required:true,  ok: !!_gv('vw-name') },
    { label:'GST number',                step:0, required:true,  ok: !!_gv('vw-gstin'),  show: regd },
    { label:'FSSAI licence + expiry',    step:0, required:true,  ok: !!_gv('vw-fssai') && !!_gv('vw-fssai-exp'), show: food },
    { label:'Account holder name',       step:1, required:true,  ok: !!_gv('vw-bank-acname') },
    { label:'Account number',            step:1, required:true,  ok: !!_gv('vw-bank-acno') },
    { label:'Valid IFSC',                step:1, required:true,  ok: ifscValid },
    { label:'Cancelled cheque',          step:2, required:true,  ok: !!APP._vw.docs.cancelled_cheque },
    { label:'GST certificate copy',      step:2, required:true,  ok: !!APP._vw.docs.gst_cert, show: regd },
    { label:'FSSAI licence copy',        step:2, required:true,  ok: !!APP._vw.docs.fssai,    show: food },
    { label:'At least one product',      step:3, required:true,  ok: vwCollectProducts().length > 0 },
    { label:'UPI ID',                    step:1, required:false, ok: !!_gv('vw-upi') },
    { label:'PAN card copy',             step:2, required:false, ok: !!APP._vw.docs.pan },
    { label:'Supply agreement',          step:2, required:false, ok: !!APP._vw.docs.agreement },
  ].filter(x => x.show !== false);
}
function vwMissingRequired() { return vwRequirements().filter(r => r.required && !r.ok); }

function vwRenderReview() {
  const reqs = vwRequirements();
  const required = reqs.filter(r => r.required), optional = reqs.filter(r => !r.required);
  const missing = required.filter(r => !r.ok);
  const done = required.filter(r => r.ok).length, pct = Math.round(done/required.length*100);
  const row = x => `<div class="vw-ci"><span class="b ${x.ok?'y':'n'}">${x.ok?'✓':'!'}</span>
    <span style="cursor:pointer" ${dataAct('vwGo', x.step)}>${x.label}${x.ok?'':` <span class="u-danger">— fill this</span>`}</span></div>`;
  document.getElementById('vw-review').innerHTML = `
    ${missing.length ? `<div style="background:var(--red-wash,var(--danger-bg));border:1.5px solid #fca5a5;border-radius:10px;padding:11px 14px;margin-bottom:14px">
      <div style="font-weight:800;color:var(--danger);font-size:.86rem">${missing.length} required item${missing.length>1?'s':''} still needed to submit</div>
      <div style="font-size:.78rem;color:#991b1b;margin-top:3px">${missing.map(m=>`<b>${m.label}</b>`).join(' · ')} — click any item below to jump to it.</div>
    </div>` : `<div style="background:var(--success-bg);border:1.5px solid #86efac;border-radius:10px;padding:11px 14px;margin-bottom:14px;font-weight:700;color:var(--success);font-size:.86rem">✓ All required information is in — ready to submit for verification.</div>`}
    <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start">
      <div style="flex:1;min-width:220px">
        <div style="font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">Required</div>
        ${required.map(row).join('')}
        <div style="font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin:14px 0 8px">Recommended</div>
        ${optional.map(row).join('')}
      </div>
      <div style="flex:0 0 190px;border:1px solid var(--primary-border,#99f6e4);background:var(--primary-light);border-radius:12px;padding:14px 16px">
        <div style="font-size:1.4rem;font-weight:800;color:var(--primary-hover)">${pct}%</div>
        <div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;font-weight:700">required complete</div>
        <div style="font-size:.8rem;color:var(--text);margin-top:8px">${missing.length?'Finish the required items, then submit — ops verifies &amp; activates.':'Submit for verification; ops will activate the vendor.'}</div>
      </div>
    </div>`;
}

async function saveVendorWizard() {
  const body = collectVendorForm('vw');
  if (!body.name) { showToast('Vendor name required', 'error'); vwGo(0); return; }
  if (!validateVendorCompliance('vw', body)) { vwGo(0); return; }
  const ifsc = (_gv('vw-bank-ifsc') || '').toUpperCase();
  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    const m = document.getElementById('vw-bank-ifsc-msg'); if (m) { m.textContent = 'IFSC must be 4 letters, 0, then 6 letters/digits.'; m.style.color = 'var(--danger)'; }
    showToast('Enter a valid IFSC (e.g. HDFC0001234)', 'error'); vwGo(1); return;
  }
  // Mandatory-info gate: everything marked required must be present to submit.
  const missing = vwMissingRequired();
  if (missing.length) {
    showToast(`Fill ${missing.length} required item${missing.length>1?'s':''} before submitting for verification`, 'error');
    vwGo(missing[0].step);              // jump to the first gap so they can fill it
    return;
  }
  Object.assign(body, {
    bank_account_name: _gv('vw-bank-acname')||null, bank_account_no: _gv('vw-bank-acno')||null, bank_ifsc: ifsc||null,
    bank_name: _gv('vw-bank-bankname')||null, bank_branch: _gv('vw-bank-branch')||null,
    upi_id: _gv('vw-upi')||null, payment_terms: _gv('vw-terms')||null,
    documents: Object.values(APP._vw.docs).map(d => ({ kind:d.kind, filename:d.filename, mime:d.mime, size:d.size, data:d.data,
      expiry_date: d.kind==='fssai' ? (body.fssai_expiry||null) : null })),
    products: vwCollectProducts(),
  });
  if (!APP._vw.editId) body.onboarding_status = 'pending';
  const btn = document.getElementById('vw-next'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  const res = APP._vw.editId
    ? await api('/vendors/' + APP._vw.editId, { method:'PATCH', body: JSON.stringify(body) })
    : await api('/vendors', { method:'POST', body: JSON.stringify(body) });
  if (!res) { if (btn) { btn.disabled = false; btn.textContent = 'Submit for verification'; } return; }
  closeModal();
  showToast(APP._vw.editId ? 'Vendor updated' : 'Vendor submitted for verification');
  APP._vendorSearch=''; APP._vendorCat=''; APP._vendorLoc=''; navigate('vendors');
}

function collectVendorForm(prefix) {
  const freq = document.getElementById(`${prefix}-visitfreq`)?.value || '';
  const leadVal = document.getElementById(`${prefix}-lead`)?.value;
  return {
    name: document.getElementById(`${prefix}-name`).value.trim(),
    category: getCheckedCats(prefix),
    location: document.getElementById(`${prefix}-loc`).value,
    address: document.getElementById(`${prefix}-address`).value,
    map_pin: document.getElementById(`${prefix}-mappin`).value.trim(),
    contact_email: document.getElementById(`${prefix}-email`).value,
    contact_phone: document.getElementById(`${prefix}-phone`).value,
    avg_lead_days: leadVal === '' ? undefined : Number(leadVal),
    visit_frequency: freq || null,
    visit_day: ['Weekly','Fortnightly','Monthly'].includes(freq) ? (document.getElementById(`${prefix}-visitday`)?.value || null) : null,
    notes: document.getElementById(`${prefix}-notes`)?.value?.trim() || null,
    registration_type: document.getElementById(`${prefix}-regtype`)?.value || 'unregistered',
    vendor_type: document.getElementById(`${prefix}-vtype`)?.value || 'non_food',
  };
}

async function saveVendor() {
  const body = collectVendorForm('v');
  if (!body.name) { showToast('Vendor name required','error'); return; }
  if (!validateVendorCompliance('v', body)) return;
  const res = await api('/vendors', { method:'POST', body: JSON.stringify(body) });
  if (!res) return;
  closeModal();
  showToast(`Vendor added — welcome email sent`); navigate('vendors');
}

function catChips(category) {
  if (!category) return '—';
  return category.split(',').map(c=>c.trim()).filter(Boolean)
    .map(c=>`<span style="font-size:.65rem;font-weight:600;background:#e6f1fb;color:var(--blue);border-radius:4px;padding:1px 6px;margin-right:3px">${c}</span>`)
    .join('');
}

async function viewVendorModal(v) {
  const code = v.vendor_code || v.id;
  // Open immediately with a light skeleton, then fill once documents/products load.
  openModal(`Vendor · ${code}`,
    `<div id="vv-body" style="min-height:220px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:.85rem">Loading vendor profile…</div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
  const [docs, products] = await Promise.all([
    api(`/vendors/${v.id}/documents`).catch(()=>[]),
    api(`/vendors/${v.id}/products`).catch(()=>[]),
  ]);
  const body = document.getElementById('vv-body');
  if (body) body.outerHTML = vendorViewHTML(v, docs||[], products||[]);
  const footer = document.getElementById('modal-footer');
  if (footer) footer.innerHTML =
    `${v.onboarding_status==='pending'?`<button class="btn btn-success" ${dataAct('approveVendor', v.id)}>✓ Approve &amp; activate</button>`:''}
     <button class="btn btn-primary" ${dataAct('editVendorById', _regVendor(v))}>Edit vendor</button>
     <button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`;
}

// Data-driven completeness for the read-only view (mirror of the wizard's rules,
// but computed from the saved vendor + its documents rather than live form fields).
function vendorSections(v, docsByKind) {
  const regd = v.registration_type === 'registered';
  const food = v.vendor_type === 'food';
  const ifscOk = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(v.bank_ifsc||'').toUpperCase());
  const has = k => !!docsByKind[k];
  return [
    { label:'Business & compliance', ok: !!v.name && !!v.category && (!regd || (!!v.gstin && !!v.pan)) && (!food || (!!v.fssai_licence && !!v.fssai_expiry)) },
    { label:'Bank & payout',         ok: !!v.bank_account_no && !!v.bank_account_name && ifscOk },
    { label:'Documents',             ok: has('cancelled_cheque') && (!regd || has('gst_cert')) && (!food || has('fssai')) },
    { label:'Products',              ok: (Array.isArray(v._products)? v._products.length : 0) > 0 },
    { label:'Activation',            ok: v.onboarding_status === 'active' },
  ];
}

function vendorViewHTML(v, docs, products) {
  v._products = products;
  const code = v.vendor_code || v.id;
  const onTimeColor = v.on_time_rate>=90?'var(--success)':v.on_time_rate>=75?'#d97706':'var(--danger)';
  const fillColor   = v.fill_rate>=90?'var(--success)':v.fill_rate>=75?'#d97706':'var(--danger)';
  const mapUrl = mapsLink(v.map_pin, v.address);
  const regd = v.registration_type === 'registered';
  const food = v.vendor_type === 'food';
  const docsByKind = {}; (docs||[]).forEach(d => { docsByKind[d.kind] = d; });

  const sections = vendorSections(v, docsByKind);
  const done = sections.filter(s => s.ok).length;
  const pctDone = Math.round(done / sections.length * 100);
  const missing = sections.filter(s => !s.ok && s.label !== 'Activation');

  const field = (k, val) => `<div><div style="font-size:.68rem;letter-spacing:.02em;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px">${k}</div><div style="font-weight:600;font-size:.86rem">${val}</div></div>`;

  // Required-documents panel (chips reflect what's actually uploaded).
  const docRows = VW_DOCS.map(d => {
    const required = d.kind==='cancelled_cheque' || (d.kind==='gst_cert' && regd) || (d.kind==='fssai' && food);
    if (!required && !docsByKind[d.kind] && d.opt) {
      // optional & not uploaded → show as optional
    }
    const up = docsByKind[d.kind];
    const chip = up
      ? `<span style="font-size:.68rem;font-weight:700;color:var(--success);background:var(--success-bg);border-radius:100px;padding:3px 10px">✓ Uploaded</span>`
      : required
        ? `<span style="font-size:.68rem;font-weight:700;color:#b45309;background:var(--warning-bg);border-radius:100px;padding:3px 10px">⚠ Pending</span>`
        : `<span style="font-size:.68rem;font-weight:700;color:var(--text-muted);background:var(--surface-2);border-radius:100px;padding:3px 10px">Optional</span>`;
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--surface-2)">
      <span style="font-size:1rem">📄</span>
      <div class="u-flex1"><div style="font-weight:600;font-size:.82rem">${d.label}</div>
        <div style="font-size:.7rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${up?h(up.filename||'file'):(required?'Required':'Optional')}</div></div>
      ${chip}</div>`;
  }).join('');

  // Activity — derived from real document upload timestamps (honest empty-state).
  const acts = (docs||[]).filter(d=>d.uploaded_at)
    .sort((a,b)=> String(b.uploaded_at).localeCompare(String(a.uploaded_at)))
    .map(d => {
      const lbl = (VW_DOCS.find(x=>x.kind===d.kind)||{}).label || d.kind;
      return `<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--surface-2)">
        <span style="flex:none;width:9px;height:9px;border-radius:50%;background:var(--success);margin-top:5px"></span>
        <div style="flex:1"><div style="font-weight:600;font-size:.82rem">${lbl} uploaded</div></div>
        <div style="font-size:.7rem;color:var(--text-muted);white-space:nowrap">${fmtDate(d.uploaded_at)}</div></div>`;
    }).join('');
  const activityHtml = acts || `<div style="padding:14px 0;color:var(--text-muted);font-size:.8rem">No document activity recorded yet.</div>`;

  const chkRow = s => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--surface-2)">
    <span style="flex:none;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:.66rem;font-weight:800;${s.ok?'background:var(--success);color:#fff':'background:var(--surface-2);color:var(--text-muted);border:1.5px solid var(--border-mid)'}">${s.ok?'✓':''}</span>
    <span style="flex:1;font-size:.82rem;font-weight:${s.ok?600:500};color:${s.ok?'var(--text)':'var(--text-muted)'}">${s.label}</span>
    <span style="font-size:.68rem;color:var(--text-muted)">${s.ok?'Done':'Pending'}</span></div>`;

  const fssaiExp = v.fssai_expiry; const fssaiExpired = fssaiExp && fssaiExp < new Date().toISOString().slice(0,10);

  return `<div>
    <!-- header strip -->
    <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:1.1rem;font-weight:800;color:var(--navy);line-height:1.2">${h(v.name)}</div>
        <div class="u-subtiny">${catChips(v.category)}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="font-family:ui-monospace,monospace;font-size:.78rem;font-weight:700;letter-spacing:.03em;color:var(--navy);background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:5px 11px">${code}</span>
        ${vendorOnbBadge(v.onboarding_status)}
      </div>
    </div>

    ${missing.length ? `<div style="display:flex;gap:10px;align-items:center;background:var(--warning-bg);border:1px solid #fcd9a5;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:.8rem;color:var(--amber-text)">
      <span style="font-size:1.1rem">🛡️</span><div><b>${missing.length} item${missing.length>1?'s':''} still needed to activate:</b> ${missing.map(m=>m.label).join(' · ')}. Use <b>Edit vendor</b> to fill and submit for verification.</div></div>` : ''}

    <!-- two-column: details + rail -->
    <div style="display:grid;grid-template-columns:1.7fr 1fr;gap:18px;align-items:start" class="vv-grid">
      <div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          ${field('City / Area', v.location||'—')}
          ${field('Registration', regd?'Registered':'Unregistered')}
          ${field('Vendor type', food?'🍽 Food':'Non-food')}
          ${field('Lead time', v.avg_lead_days!=null?v.avg_lead_days+' days':'—')}
          ${field('Contact email', v.contact_email?`<a href="mailto:${h(v.contact_email)}" style="color:var(--blue)">${h(v.contact_email)}</a>`:'—')}
          ${field('Contact phone', v.contact_phone||'—')}
          ${field('On-time rate', `<span style="color:${onTimeColor}">${pct(v.on_time_rate||0)}</span>`)}
          ${field('Fill rate', `<span style="color:${fillColor}">${pct(v.fill_rate||0)}</span>`)}
          ${field('Rating', `${(+v.rating||0).toFixed(1)} / 5.0`)}
          ${field('Status', v.active===0?'<span class="u-danger">Disabled</span>':'<span style="color:var(--success)">Active</span>')}
          ${regd?field('GST number', `<span style="letter-spacing:.03em">${v.gstin||'—'}</span>`):''}
          ${regd?field('PAN', `<span style="letter-spacing:.03em">${v.pan||'—'}</span>`):''}
          ${food?field('FSSAI licence', `<span style="letter-spacing:.03em">${v.fssai_licence||'—'}</span>`):''}
          ${food?field('FSSAI expiry', `<span style="color:${fssaiExpired?'var(--danger)':fssaiExp?'var(--success)':'var(--text-muted)'}">${fssaiExp?fmtDate(fssaiExp)+(fssaiExpired?' ⚠ Expired':''):'—'}</span>`):''}
          ${v.bank_account_no?field('Bank', `${h(v.bank_name||'—')} · ****${String(v.bank_account_no).slice(-4)}${v.bank_ifsc?' · '+h(v.bank_ifsc):''}`):''}
          ${field('Visit schedule', v.visit_frequency?`${v.visit_frequency}${v.visit_day?' · '+(v.visit_frequency==='Monthly'?'day '+v.visit_day:v.visit_day):''}`:'—')}
        </div>
        ${v.notes?`<div style="margin-top:16px"><div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.02em;color:var(--text-muted);margin-bottom:4px">Notes</div><div style="font-size:.82rem;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;white-space:pre-wrap;line-height:1.5">${h(v.notes)}</div></div>`:''}
        ${v.address?`<div style="margin-top:14px"><div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.02em;color:var(--text-muted);margin-bottom:4px">Address</div><div style="font-size:.82rem">📍 ${h(v.address)}${mapUrl?` · <a href="${mapUrl}" target="_blank" rel="noopener" style="color:var(--blue)">Map</a>`:''}</div></div>`:''}
      </div>

      <!-- rail -->
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px 16px">
          <div style="font-size:.66rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px">Onboarding progress</div>
          <div style="display:flex;justify-content:space-between;font-size:.74rem;color:var(--text-muted);margin-bottom:6px"><span>Overall completion</span><b style="color:var(--primary)">${pctDone}%</b></div>
          <div style="height:8px;background:var(--surface-2);border-radius:100px;overflow:hidden;margin-bottom:12px"><i style="display:block;height:100%;width:${pctDone}%;background:linear-gradient(90deg,var(--primary),#14b8a6)"></i></div>
          ${sections.map(chkRow).join('')}
        </div>
      </div>
    </div>

    <!-- bottom row: documents + activity -->
    <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:18px;margin-top:18px" class="vv-grid">
      <div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px 16px">
        <div style="font-size:.66rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">Required documents</div>
        ${docRows}
      </div>
      <div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px 16px">
        <div style="font-size:.66rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">Activity</div>
        ${activityHtml}
      </div>
    </div>
  </div>`;
}

function vendorOnbBadge(s) {
  const m = { active:['Active','var(--success)','#f0fdf4'], pending:['Pending verify','#b45309','#fffbeb'],
    draft:['Draft','var(--text-muted)','var(--surface-2)'], rejected:['Rejected','var(--danger)','#fef2f2'] };
  const [label,color,bg] = m[s||'active'] || m.active;
  return `<span style="display:inline-block;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:${color};background:${bg};border:1px solid ${color}44;border-radius:100px;padding:2px 9px">${label}</span>`;
}

async function approveVendor(id) {
  const res = await api('/vendors/' + id, { method:'PATCH', body: JSON.stringify({ onboarding_status:'active' }) });
  if (res) { closeModal(); showToast('Vendor activated'); navigate('vendors'); }
}

function editVendorModal(v) { openVendorWizard(v); }

async function saveEditVendor(id) {
  const body = collectVendorForm('ev');
  if (!body.name) { showToast('Vendor name required','error'); return; }
  if (!validateVendorCompliance('ev', body)) return;
  const res = await api('/vendors/' + id, { method:'PATCH', body: JSON.stringify(body) });
  if (res) { closeModal(); showToast('Vendor updated'); APP._vendorSearch=''; APP._vendorCat=''; APP._vendorLoc=''; navigate('vendors'); }
}

async function toggleVendorActive(id, name, active) {
  const newState = active ? 0 : 1;
  if (!confirm(`${newState?'Enable':'Disable'} vendor "${name}"?`)) return;
  const res = await api('/vendors/' + id, { method:'PATCH', body: JSON.stringify({ active: newState }) });
  if (res) { showToast(`Vendor ${newState?'enabled':'disabled'}`); navigate('vendors'); }
}

// Multi-line PO builder. Each line's default price comes from the vendor's own
// price list (vendor_products), falling back to the last price paid to this
// vendor, then the catalogue cost — all three surfaced as hints. GST is shown
// and totalled per line from each item's slab (gst_rate); the server recomputes.
let _poVendor = null, _poPriceMap = {}, _poLines = [];
async function newPOForVendor(vendorId, vendorName) {
  const [inv, vprods, vpos] = await Promise.all([
    api('/inventory'),
    api(`/vendors/${vendorId}/products`).catch(() => []),
    api(`/purchase-orders?vendor_id=${vendorId}`).catch(() => []),
  ]);
  if (!inv) return;
  const vrate = {}; (vprods || []).forEach(p => { if (p.sku) vrate[p.sku] = p.rate; });
  const last = {}; (vpos || []).forEach(po => (po.items || []).forEach(it => { if (last[it.sku] == null) last[it.sku] = it.unit_price; }));
  _poVendor = { id: vendorId, name: vendorName };
  _poPriceMap = {};
  inv.forEach(i => { _poPriceMap[i.sku] = { name: i.name, list: i.unit_price || 0, gst: (i.gst_rate != null ? i.gst_rate : 18), vendor: vrate[i.sku], last: last[i.sku] }; });
  _poLines = [];
  const itemOpts = inv.map(i => `<option value="${i.sku}">${h(i.name)}</option>`).join('');
  openModal(`New PO — ${vendorName}`, `
    <div class="form-group"><label>Add item</label>
      <select id="po-add" ${dataChangeEl('addPOLine')}><option value="">Select an item…</option>${itemOpts}</select>
    </div>
    <div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr><th>Item</th><th class="u-center">Qty</th><th class="u-right">Unit ₹</th><th class="u-center">GST</th><th class="u-right">Total</th><th></th></tr></thead>
      <tbody id="po-lines"></tbody>
    </table></div>
    <div id="po-grand" style="text-align:right;font-weight:700;margin-top:10px;color:var(--navy)"></div>
    <div class="form-group" style="margin-top:10px"><label>Expected Delivery</label><input type="date" id="po-del" value="${new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)}"></div>
    <div class="form-group"><label>Notes</label><input type="text" id="po-notes" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-gold" ${dataAct('sendPOToVendor')}>Send PO</button>`);
  renderPOLines();
}

function addPOLine(sel) {
  const sku = sel.value; if (!sku) return;
  sel.value = '';
  const p = _poPriceMap[sku]; if (!p) return;
  if (_poLines.some(l => l.sku === sku)) { showToast('Item already added', 'info'); return; }
  const unit = p.vendor != null ? p.vendor : (p.last != null ? p.last : p.list);
  _poLines.push({ sku, name: p.name, qty: 50, unit_price: unit, gst: p.gst });
  renderPOLines();
}

function removePOLine(sku) { _poLines = _poLines.filter(l => l.sku !== sku); renderPOLines(); }

function renderPOLines() {
  const tb = document.getElementById('po-lines'); if (!tb) return;
  if (!_poLines.length) {
    tb.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:16px">Add items above to build this PO</td></tr>`;
  } else {
    tb.innerHTML = _poLines.map(l => {
      const p = _poPriceMap[l.sku] || {};
      const hints = [];
      if (p.vendor != null) hints.push(`vendor ${fmt(p.vendor)}`);
      hints.push(`list ${fmt(p.list)}`);
      if (p.last != null) hints.push(`last ${fmt(p.last)}`);
      return `<tr>
        <td style="font-size:.83rem"><b>${h(l.name)}</b><div class="u-subtiny">${hints.join(' · ')}</div></td>
        <td class="u-center"><input type="number" data-po-qty="${l.sku}" value="${l.qty}" min="1" style="width:62px;padding:4px;border:1px solid var(--border);border-radius:6px;text-align:center" ${dataInput('recalcPO')}></td>
        <td class="u-right"><input type="number" data-po-price="${l.sku}" value="${l.unit_price}" min="0" style="width:78px;padding:4px;border:1px solid var(--border);border-radius:6px;text-align:right" ${dataInput('recalcPO')}></td>
        <td class="u-center u-subtiny">${l.gst}%</td>
        <td class="u-right" data-po-total="${l.sku}">${fmt(l.qty * l.unit_price)}</td>
        <td class="u-center"><button class="btn btn-secondary btn-sm" ${dataAct('removePOLine', l.sku)}>✕</button></td>
      </tr>`;
    }).join('');
  }
  recalcPO();
}

function recalcPO() {
  let sub = 0, gst = 0;
  _poLines.forEach(l => {
    const qty = +document.querySelector(`[data-po-qty="${l.sku}"]`)?.value || l.qty;
    const price = +document.querySelector(`[data-po-price="${l.sku}"]`)?.value || 0;
    l.qty = qty; l.unit_price = price;
    const lt = qty * price; sub += lt; gst += Math.round(lt * (l.gst || 18) / 100);
    const tc = document.querySelector(`[data-po-total="${l.sku}"]`); if (tc) tc.textContent = fmt(lt);
  });
  const g = document.getElementById('po-grand');
  if (g) g.textContent = `Subtotal ${fmt(sub)} · GST ${fmt(gst)} · Total ${fmt(sub + gst)}`;
}

async function sendPOToVendor() {
  if (!_poLines.length) { showToast('Add at least one item', 'error'); return; }
  recalcPO();
  const items = _poLines.map(l => ({ sku: l.sku, name: l.name, qty: l.qty, unit_price: l.unit_price })).filter(i => i.qty > 0);
  if (!items.length) { showToast('Enter quantities', 'error'); return; }
  const res = await api('/purchase-orders', { method: 'POST', body: JSON.stringify({
    vendor_id: _poVendor.id, items,
    expected_delivery: document.getElementById('po-del')?.value || null,
    notes: document.getElementById('po-notes')?.value?.trim() || '',
  })});
  closeModal();
  if (res) {
    showToast(res.status === 'PENDING_APPROVAL'
      ? `PO ${res.id} created — awaiting approval (${fmt(res.grand_total)})`
      : `PO ${res.id} sent — ${fmt(res.grand_total)}`);
    navigate('procurement');
  }
}

async function approvePO(poId) {
  const res = await api(`/purchase-orders/${poId}`, { method:'PATCH', body: JSON.stringify({ status:'SENT' }) });
  if (res) { showToast(`PO ${poId} approved — sent to vendor`); navigate('procurement'); }
}

async function rejectPO(poId) {
  const res = await api(`/purchase-orders/${poId}`, { method:'PATCH', body: JSON.stringify({ status:'REJECTED' }) });
  if (res) { showToast(`PO ${poId} rejected`); navigate('procurement'); }
}


/* ============================================================
   PROCUREMENT
   ============================================================ */
async function renderProcurement(el) {
  const [pos, vendors] = await Promise.all([api('/purchase-orders'), api('/vendors')]);
  if (!pos) return;

  const byStatus = s => pos.filter(p=>p.status===s);
  const valByStatus = s => byStatus(s).reduce((sum,p)=>sum+(p.grand_total||0),0);
  // Receivable = still inbound or part-received; both can accept a GRN.
  const pendingGRN = [...byStatus('DISPATCHED'), ...byStatus('PARTIALLY_RECEIVED')];
  const totalOpen = ['PENDING_APPROVAL','SENT','ACCEPTED','DISPATCHED','PARTIALLY_RECEIVED','RECEIVED'].reduce((s,st)=>s+byStatus(st).length,0);
  const canApprovePO = ['super_admin','ops_admin','procurement_manager','finance_admin'].includes(APP.user.role);

  const statusTiles = [
    { key:'PENDING_APPROVAL',  label:'Awaiting Approval', icon:'🖋️', color:'#b45309', bg:'#fffbeb', urgent: byStatus('PENDING_APPROVAL').length>0 },
    { key:'SENT',              label:'POs Sent',      icon:'📤', color:'#f59e0b', bg:'#fffbeb', urgent: byStatus('SENT').length>0 },
    { key:'ACCEPTED',          label:'Accepted',      icon:'✅', color:'#3b82f6', bg:'#eff6ff', urgent: false },
    { key:'DISPATCHED',        label:'In Transit',    icon:'🚚', color:'#8b5cf6', bg:'#f5f3ff', urgent: byStatus('DISPATCHED').length>0 },
    { key:'PARTIALLY_RECEIVED',label:'Part-Received', icon:'📥', color:'#0891b2', bg:'#ecfeff', urgent: byStatus('PARTIALLY_RECEIVED').length>0 },
    { key:'RECEIVED',          label:'Received',      icon:'📦', color:'#1f8a5b', bg:'#f0fdf4', urgent: byStatus('RECEIVED').length>0 },
    { key:'INVOICED',          label:'Invoiced',      icon:'🧾', color:'#6b7280', bg:'#f9fafb', urgent: false },
  ];

  el.innerHTML = `
  ${pageHeader('Procurement', `${totalOpen} open POs`,
    `<button class="btn btn-gold" ${dataAct('navigate', 'vendors')}>${iconPlus(14)} New PO</button>`)}

  <!-- Status tiles -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px">
    ${statusTiles.map(t=>`
    <div style="background:${t.bg};border:1px solid ${t.urgent?t.color+'55':'#e5e7eb'};border-radius:12px;padding:16px;cursor:pointer" ${dataAct('filterPO', t.key)}>
      <div style="font-size:1.4rem;margin-bottom:6px">${t.icon}</div>
      <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${t.color};margin-bottom:4px">${t.label}</div>
      <div style="font-size:1.8rem;font-weight:800;color:#1f2937;line-height:1">${byStatus(t.key).length}</div>
      <div style="font-size:.72rem;color:var(--gray);margin-top:4px">${fmt(valByStatus(t.key))}</div>
    </div>`).join('')}
  </div>

  <!-- Charts + GRN alert -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
      <div style="font-weight:700;color:var(--navy);font-size:.9rem;margin-bottom:14px">Vendor Performance</div>
      <div style="position:relative;height:220px;width:100%">
        <canvas id="vendorChart"></canvas>
      </div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-weight:700;color:var(--navy);font-size:.9rem">GRN Pending Receipt</div>
        <span style="background:#f5f3ff;color:var(--violet);border-radius:20px;padding:2px 10px;font-size:.75rem;font-weight:700">${pendingGRN.length} DCs</span>
      </div>
      ${pendingGRN.length === 0
        ? '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:.84rem">No pending GRNs</div>'
        : pendingGRN.map(po=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;background:#f8f9fa;margin-bottom:8px;border:1px solid #e5e7eb">
            <div>
              <div style="font-weight:700;font-size:.84rem">${po.id} <span style="font-weight:400;color:var(--text-muted)">· ${po.vendor_name||'—'}</span></div>
              <div class="u-subtiny">${fmt(po.grand_total)} · Expected ${fmtDate(po.expected_delivery)}</div>
            </div>
            <button class="btn btn-primary btn-sm" ${dataAct('receiveGRN', po.id)}>Receive GRN</button>
          </div>`).join('')
      }
    </div>
  </div>

  <!-- PO table -->
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)">
      <div style="font-weight:700;color:var(--navy);font-size:.9rem">All Purchase Orders</div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="po-status-filter" class="form-control form-control-sm" style="width:140px" ${dataChange('filterPOTable')}>
          <option value="">All Status</option>
          ${['PENDING_APPROVAL','SENT','ACCEPTED','DISPATCHED','PARTIALLY_RECEIVED','RECEIVED','INVOICED'].map(s=>`<option value="${s}">${s.replace(/_/g,' ')}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="table-wrap" id="po-table-wrap">
      <table class="table" style="margin:0">
        <thead><tr><th>PO #</th><th>Vendor</th><th>Amount</th><th>Status</th><th>Expected</th><th>Actions</th></tr></thead>
        <tbody id="po-tbody">${pos.map(po=>`<tr data-status="${po.status}">
          <td><b>${po.id}</b>${po.auto_generated?` <span class="badge badge-gold">Auto</span>`:''}</td>
          <td>${po.vendor_name||'—'}</td>
          <td>${fmt(po.grand_total)}</td>
          <td>${statusBadge(po.status)}</td>
          <td>${fmtDate(po.expected_delivery)||'—'}</td>
          <td>${po.status==='PENDING_APPROVAL'
            ? (canApprovePO
                ? `<button class="btn btn-primary btn-sm" ${dataAct('approvePO', po.id)}>Approve</button> <button class="btn btn-secondary btn-sm" ${dataAct('rejectPO', po.id)}>Reject</button>`
                : '<span style="color:var(--warning);font-size:.8rem">Awaiting approval</span>')
            : ['DISPATCHED','PARTIALLY_RECEIVED'].includes(po.status)
              ? `<button class="btn btn-primary btn-sm" ${dataAct('receiveGRN', po.id)}>Receive GRN</button>`
              : po.status==='RECEIVED'
                ? `<button class="btn btn-secondary btn-sm" ${dataAct('recordInvoice', po.id)}>Record Invoice</button>`
                : '<span style="color:var(--text-muted);font-size:.8rem">—</span>'}</td>
        </tr>`).join('')||'<tr><td colspan="6" class="u-empty">No POs</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;

  // Vendor performance chart
  if (vendors?.length) {
    const ctx = document.getElementById('vendorChart');
    if (ctx) {
      APP.charts.vendor = new Chart(ctx, {
        type:'bar',
        data:{
          labels: vendors.map(v=>v.name.split(' ')[0]),
          datasets:[
            { label:'On-time %', data: vendors.map(v=>v.on_time_rate||0), backgroundColor:'#1f8a5b', borderRadius:4 },
            { label:'Fill Rate %', data: vendors.map(v=>v.fill_rate||0), backgroundColor:'#3b82f6', borderRadius:4 },
          ]
        },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, scales:{y:{beginAtZero:true,max:100,grid:{color:'#f0f0f0'}},x:{grid:{display:false}}} }
      });
    }
  }
}

function filterPO(status) {
  const sel = document.getElementById('po-status-filter');
  if (sel) { sel.value = status; filterPOTable(); }
}

function filterPOTable() {
  const status = document.getElementById('po-status-filter')?.value || '';
  document.querySelectorAll('#po-tbody tr[data-status]').forEach(row => {
    row.style.display = (!status || row.dataset.status === status) ? '' : 'none';
  });
}

// Line-level goods receipt: each outstanding PO line gets its own received /
// rejected / batch / expiry inputs. Only accepted qty reaches stock; the PO
// status is derived server-side (PARTIALLY_RECEIVED / RECEIVED).
let _grnLines = [];
async function receiveGRN(poId) {
  const data = await api(`/purchase-orders/${poId}/receivable`);
  if (!data) return;
  _grnLines = (data.lines || []).filter(l => l.remaining > 0);
  if (!_grnLines.length) { showToast('Nothing left to receive on this PO', 'info'); return; }
  const rows = _grnLines.map((l, i) => `
    <tr>
      <td style="font-size:.82rem"><b>${h(l.name)}</b><div class="u-subtiny">${h(l.sku)}</div></td>
      <td class="u-center">${l.qty} / <b>${l.remaining}</b></td>
      <td class="u-center"><input type="number" data-grn-recv="${i}" value="${l.remaining}" min="0" max="${l.remaining}" style="width:62px;padding:4px;border:1px solid var(--border);border-radius:6px;text-align:center"></td>
      <td class="u-center"><input type="number" data-grn-rej="${i}" value="0" min="0" style="width:54px;padding:4px;border:1px solid var(--border);border-radius:6px;text-align:center"></td>
      <td><input type="text" data-grn-batch="${i}" placeholder="batch" style="width:76px;padding:4px;border:1px solid var(--border);border-radius:6px"></td>
      <td><input type="date" data-grn-exp="${i}" style="padding:4px;border:1px solid var(--border);border-radius:6px"></td>
    </tr>`).join('');
  openModal('Receive GRN — PO ' + poId, `
    <div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr><th>Item</th><th class="u-center">Ord / Rem</th><th class="u-center">Receive</th><th class="u-center">Reject</th><th>Batch</th><th>Expiry</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="u-subtiny" style="color:var(--text-muted);margin-top:8px">Rejected qty is logged for QC and never added to stock. Batch &amp; expiry drive near-expiry alerts.</div>
    <div class="form-group" style="margin-top:10px"><label>Notes</label><input type="text" id="grn-notes" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('confirmGRN', poId)}>Confirm Receipt</button>`);
}

async function confirmGRN(poId) {
  const lines = _grnLines.map((l, i) => ({
    sku: l.sku,
    qty_received: +document.querySelector(`[data-grn-recv="${i}"]`)?.value || 0,
    qty_rejected: +document.querySelector(`[data-grn-rej="${i}"]`)?.value || 0,
    batch_no: document.querySelector(`[data-grn-batch="${i}"]`)?.value?.trim() || undefined,
    expiry_date: document.querySelector(`[data-grn-exp="${i}"]`)?.value || undefined,
  })).filter(l => l.qty_received > 0 || l.qty_rejected > 0);
  if (!lines.length) { showToast('Enter a received or rejected quantity', 'error'); return; }
  const notes = document.getElementById('grn-notes')?.value || '';
  const res = await api('/grn', { method:'POST', body: JSON.stringify({ po_id: poId, lines, notes }) });
  closeModal();
  if (res) { showToast(`GRN posted — PO now ${res.po_status.replace(/_/g,' ')}`); navigate('procurement'); }
}

// Record the vendor invoice and run the 3-way match (ordered/received/invoiced).
async function recordInvoice(poId) {
  const pos = await api('/purchase-orders');
  const po = (pos || []).find(p => p.id === poId);
  openModal('Record Invoice — PO ' + poId, `
    <div class="form-group"><label>Vendor Invoice No.</label><input type="text" id="inv-no" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></div>
    <div class="form-group"><label>Invoice Amount (₹)</label><input type="number" id="inv-amt" value="${po?.grand_total || 0}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></div>
    <div class="form-group"><label>Invoice Date</label><input type="date" id="inv-date" value="${new Date().toISOString().slice(0,10)}" style="padding:8px;border:1px solid var(--border);border-radius:6px"></div>
    <div class="u-subtiny" style="color:var(--text-muted)">Matched against goods received and PO value; any mismatch is flagged for review instead of paying blind.</div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('confirmInvoice', poId)}>Match &amp; Record</button>`);
}

async function confirmInvoice(poId) {
  const res = await api(`/purchase-orders/${poId}/invoice`, { method:'POST', body: JSON.stringify({
    vendor_invoice_no: document.getElementById('inv-no')?.value?.trim() || '',
    invoice_amount: +document.getElementById('inv-amt')?.value || 0,
    invoice_date: document.getElementById('inv-date')?.value || '',
  })});
  closeModal();
  if (!res) return;
  if (res.match_status === 'MATCHED') showToast('Invoice matched — PO marked Invoiced');
  else showToast(`Invoice flagged — qty Δ ${res.qty_variance}, amount Δ ₹${res.amount_variance}`, 'error');
  navigate('procurement');
}
