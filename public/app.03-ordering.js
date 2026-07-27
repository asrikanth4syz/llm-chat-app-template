/* ============================================================
   PLACE ORDER — optimised: search + quick reorder + catalogue + cart
   ============================================================ */
async function renderPlaceOrder(el) {
  const [inventory, recentOrders] = await Promise.all([
    api('/inventory'),
    api('/orders').catch(()=>[])
  ]);
  if (!inventory) return;

  const cats = [...new Set(inventory.map(i => i.category))];
  APP._catalog = inventory;
  APP._catFilter = 'All';
  APP._catalogSearch = '';
  if (!APP._catalogView) APP._catalogView = 'tile';
  if (!APP._orderType) APP._orderType = 'Regular';
  APP._orderStep = 'catalogue';

  const last3 = (recentOrders||[]).slice(0,3);

  el.innerHTML = `
  <!-- STEP 1: BROWSE CATALOGUE -->
  <div id="order-step-catalogue">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Place Order</div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">Browse the catalogue and add items to your cart</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-gold btn-sm" ${dataAct('showAdhocOrderModal')}>⚡ Quick / Ad-hoc Request</button>
        <button class="btn btn-secondary btn-sm" ${dataAct('showCSVUploadModal')}>📋 Order via Spreadsheet</button>
        <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'my_orders')}>My Orders</button>
      </div>
    </div>

    ${last3.length ? `
    <div style="background:#fff;border-radius:12px;padding:14px 18px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:.82rem;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.05em">🔄 Quick Reorder</span>
        <span style="font-size:.75rem;color:var(--text-muted)">from recent history</span>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${last3.map(o=>`
        <div style="flex:1;min-width:200px;border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div style="min-width:0">
            <div style="font-size:.82rem;font-weight:700;color:var(--navy)">${o.id}</div>
            <div class="u-subtiny">${fmtDate(o.created_at)} · ${fmt(o.grand_total)}</div>
            <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(o.items||[]).slice(0,3).map(i=>i.name).join(', ')||'—'}${(o.items||[]).length>3?` +${o.items.length-3} more`:''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
            <button class="btn btn-secondary btn-sm" style="white-space:nowrap" ${dataAct('previewReorder', o.id)}>👁 Preview</button>
            <button class="btn btn-gold btn-sm" style="white-space:nowrap" ${dataAct('reorderFromHistory', o.id)}>Reorder all</button>
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <div style="background:#fff;border-radius:12px;padding:14px 18px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:14px">
      <input type="search" id="catalog-search" placeholder="🔍  Search items by name or SKU…"
        style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:.9rem;outline:none;transition:border .2s;box-sizing:border-box"
        ${dataInputVal('searchCatalog')} data-focus>
      <div class="tab-pills" style="margin-top:12px;margin-bottom:0;flex-wrap:wrap">
        ${['All',...cats].map(c=>`<button class="tab-pill${c==='All'?' active':''}" ${dataActEl('filterCatalog', c)}>${c}</button>`).join('')}
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div id="catalog-results-info" style="font-size:.8rem;color:var(--text-muted)">${inventory.length} items in catalogue</div>
      <div style="display:flex;border:1.5px solid var(--border);border-radius:8px;overflow:hidden">
        <button id="view-tile-btn" ${dataAct('setCatalogView', 'tile')} title="Tile view"
          style="padding:5px 10px;border:none;cursor:pointer;background:${APP._catalogView==='tile'?'var(--navy)':'#fff'};color:${APP._catalogView==='tile'?'#fff':'var(--text-muted)'}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="0" width="6" height="6" rx="1"/><rect x="10" y="0" width="6" height="6" rx="1"/><rect x="0" y="10" width="6" height="6" rx="1"/><rect x="10" y="10" width="6" height="6" rx="1"/></svg>
        </button>
        <button id="view-list-btn" ${dataAct('setCatalogView', 'list')} title="List view"
          style="padding:5px 10px;border:none;cursor:pointer;background:${APP._catalogView==='list'?'var(--navy)':'#fff'};color:${APP._catalogView==='list'?'#fff':'var(--text-muted)'}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="1" width="16" height="2" rx="1"/><rect x="0" y="7" width="16" height="2" rx="1"/><rect x="0" y="13" width="16" height="2" rx="1"/></svg>
        </button>
      </div>
    </div>
    <div id="catalog-grid" class="${APP._catalogView==='list'?'catalog-list':'catalog-grid'}">${renderCatalogItems(inventory)}</div>
    <div style="height:72px"></div>
  </div>

  <!-- STEP 2: REVIEW & PLACE -->
  <div id="order-step-review" style="display:none"></div>

  <!-- FLOATING CART BAR (bottom of viewport) -->
  <div id="cart-bottom-bar" style="display:none;position:fixed;bottom:0;left:var(--sidebar-w);right:0;z-index:90;background:var(--navy);color:#fff;padding:12px 24px;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 -2px 16px rgba(0,0,0,.18)">
    <div style="display:flex;align-items:center;gap:14px">
      <span style="font-size:1.4rem">🛒</span>
      <div>
        <span id="cbb-count" style="font-weight:700;font-size:.95rem">0 items</span>
        <span style="margin:0 10px;opacity:.35">|</span>
        <span id="cbb-total" style="font-weight:800;font-size:1.1rem">₹0</span>
        <span style="font-size:.75rem;opacity:.65;margin-left:4px">incl. GST</span>
      </div>
    </div>
    <button class="btn btn-gold" style="padding:9px 22px;font-size:.9rem;font-weight:700" ${dataAct('switchOrderStep', 'review')}>
      Review Order →
    </button>
  </div>

  <!-- CSV Export / Import Modal -->
  <div id="csv-upload-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;align-items:center;justify-content:center">
    <div style="background:#fff;border-radius:16px;padding:28px;width:520px;max-width:95vw;box-shadow:0 8px 40px rgba(0,0,0,.22)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-weight:800;font-size:1rem;color:var(--navy)">Order via Spreadsheet</div>
          <div style="font-size:.8rem;color:var(--text-muted);margin-top:2px">Export your item list → fill quantities → upload</div>
        </div>
        <button ${dataAct('hideEl', 'csv-upload-modal')} style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text-muted);line-height:1">×</button>
      </div>

      <!-- Steps -->
      <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px">

        <!-- Step 1 -->
        <div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:#eff6ff;border-radius:10px;border:1px solid #bfdbfe">
          <div style="min-width:28px;height:28px;border-radius:50%;background:#1e40af;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.82rem">1</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:.88rem;color:#1e40af;margin-bottom:4px">Export your assigned item list</div>
            <div style="font-size:.78rem;color:#1e3a8a;margin-bottom:10px">Downloads a CSV with all your items (SKU, name, category, price). The <b>Quantity</b> column is blank — fill it in.</div>
            <button class="btn btn-primary btn-sm" ${dataAct('downloadOrderTemplate')}>⬇ Download Item List</button>
          </div>
        </div>

        <!-- Step 2 -->
        <div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:var(--success-bg);border-radius:10px;border:1px solid #bbf7d0">
          <div style="min-width:28px;height:28px;border-radius:50%;background:#15803d;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.82rem">2</div>
          <div>
            <div style="font-weight:700;font-size:.88rem;color:#15803d;margin-bottom:4px">Fill in quantities</div>
            <div style="font-size:.78rem;color:#14532d">Open in Excel / Google Sheets. Enter the quantity you need in the <b>Quantity</b> column for each item. Leave blank or 0 to skip an item. Save as CSV.</div>
          </div>
        </div>

        <!-- Step 3 -->
        <div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:#fefce8;border-radius:10px;border:1px solid #fde68a">
          <div style="min-width:28px;height:28px;border-radius:50%;background:var(--warning);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.82rem">3</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:.88rem;color:var(--amber-text);margin-bottom:4px">Upload the filled CSV</div>
            <div style="font-size:.78rem;color:#78350f;margin-bottom:10px">Items with a quantity will be added to your cart. Review and place the order.</div>
            <input type="file" id="csv-upload-input" accept=".csv" style="display:block;padding:7px 10px;border:1.5px solid #fcd34d;border-radius:6px;width:100%;box-sizing:border-box;font-size:.82rem;background:#fff">
          </div>
        </div>
      </div>

      <div id="csv-import-feedback" style="margin-bottom:14px"></div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" ${dataAct('processCSVUpload')} style="flex:1">Import to Cart</button>
        <button class="btn btn-secondary" ${dataAct('hideEl', 'csv-upload-modal')}>Cancel</button>
      </div>
    </div>
  </div>`;

  refreshCartUI();
  if (APP._postNavStep) {
    const step = APP._postNavStep;
    APP._postNavStep = null;
    setTimeout(() => switchOrderStep(step), 0);
  }
}

function switchOrderStep(step) {
  if (step === 'review' && !APP.cart.length) { showToast('Add items to your cart first', 'error'); return; }
  APP._orderStep = step;
  const cat = document.getElementById('order-step-catalogue');
  const rev = document.getElementById('order-step-review');
  const bar = document.getElementById('cart-bottom-bar');
  if (!cat || !rev) return;
  if (step === 'review') {
    cat.style.display = 'none';
    if (bar) bar.style.display = 'none';
    rev.style.display = '';
    renderCartReview(rev);
  } else {
    rev.style.display = 'none';
    cat.style.display = '';
    refreshCartUI();
  }
}

function renderCartReview(container) {
  const isUrgent = (APP._orderType||'Regular') === 'Urgent';
  const today = new Date().toISOString().slice(0,10);
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <div>
        <button class="btn btn-secondary btn-sm" ${dataAct('switchOrderStep', 'catalogue')}>← Back to Catalogue</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;font-size:.84rem">
        <span class="u-muted">① Browse</span>
        <div style="width:48px;height:2px;background:var(--navy);border-radius:1px"></div>
        <span style="font-weight:700;color:var(--navy)">② Review & Place</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:flex-start">

      <!-- Left: items + options -->
      <div>
        <!-- Items card -->
        <div style="background:#fff;border-radius:12px;border:1px solid var(--border);overflow:hidden;margin-bottom:16px">
          <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <b style="font-size:.95rem;color:var(--navy)">Cart Items</b>
            <button class="btn btn-secondary btn-sm" ${dataAct('switchOrderStep', 'catalogue')}>+ Add More Items</button>
          </div>
          <div id="review-cart-items"></div>
        </div>

        <!-- Order Type -->
        <div style="background:#fff;border-radius:12px;border:1px solid var(--border);padding:16px 18px;margin-bottom:16px">
          <label style="font-weight:700;font-size:.88rem;display:block;margin-bottom:10px;color:var(--navy)">Order Type</label>
          <div style="display:flex;gap:8px">
            ${['Regular','Urgent','Ad-Hoc'].map(t=>{
              const colors = {Regular:'var(--blue)',Urgent:'var(--danger)','Ad-Hoc':'#d97706'};
              const active = (APP._orderType||'Regular')===t;
              return `<button id="ot-btn-${t.replace('-','')}" ${dataActEl('setOrderType', t)}
                style="flex:1;padding:10px 0;border-radius:8px;border:1.5px solid ${colors[t]};
                background:${active?colors[t]:'#fff'};color:${active?'#fff':colors[t]};
                font-size:.82rem;font-weight:700;cursor:pointer;transition:all .15s">${t}</button>`;
            }).join('')}
          </div>
          <div id="need-by-wrap" style="display:${isUrgent?'block':'none'};margin-top:12px;padding:10px 12px;background:#fff8f8;border-radius:8px;border:1px solid var(--red-soft-bg)">
            <label style="font-size:.78rem;font-weight:700;color:var(--danger);display:block;margin-bottom:4px">🚨 Need By Date <span style="color:var(--text-muted);font-weight:400">(required)</span></label>
            <input type="date" id="cart-need-by" min="${today}"
              style="width:100%;padding:7px 10px;border:1.5px solid #fca5a5;border-radius:8px;font-size:.85rem;outline:none;box-sizing:border-box"
              data-focusdanger />
          </div>

          <div style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <label style="font-size:.82rem;font-weight:700;color:var(--navy)">📅 Order for month</label>
            <input type="month" id="cart-order-period" value="${today.slice(0,7)}"
              style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:.85rem;outline:none"
              data-focus />
            <span class="u-muted-xs">Defaults to this month — change only if ordering ahead</span>
          </div>
        </div>

        <!-- Notes -->
        <div style="background:#fff;border-radius:12px;border:1px solid var(--border);padding:16px 18px">
          <label style="font-weight:700;font-size:.88rem;display:block;margin-bottom:8px;color:var(--navy)">Delivery Notes <span style="font-weight:400;color:var(--text-muted)">(optional)</span></label>
          <textarea id="cart-notes" rows="3" placeholder="Special instructions, delivery address, contact person…"
            style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.85rem;resize:vertical;box-sizing:border-box;outline:none;transition:border .2s"
            data-focus></textarea>

          <label style="font-weight:700;font-size:.88rem;display:block;margin:14px 0 6px;color:var(--navy)">📷 Attach Photo <span style="font-weight:400;color:var(--text-muted)">(optional — reference image, handwritten list, product photo)</span></label>
          <input type="file" id="cart-image" accept="image/*" ${dataChangeEl('attachOrderImage')}
            style="display:block;width:100%;padding:8px;border:1.5px dashed var(--border);border-radius:8px;font-size:.8rem;box-sizing:border-box;background:#fafbfc">
          <div id="cart-image-preview" style="margin-top:8px;display:none;align-items:center;gap:10px">
            <img id="cart-image-thumb" style="max-height:70px;border-radius:8px;border:1px solid var(--border)">
            <button class="btn btn-secondary btn-sm" style="color:var(--danger)" ${dataAct('removeOrderImage')}>✕ Remove</button>
          </div>
        </div>
      </div>

      <!-- Right: summary + actions -->
      <div style="position:sticky;top:16px">
        <div style="background:#fff;border-radius:12px;border:1px solid var(--border);overflow:hidden">
          <div style="padding:14px 18px;border-bottom:1px solid var(--border)"><b>Order Summary</b></div>
          <div style="padding:16px 18px" id="review-summary"></div>
          <div style="padding:0 18px 18px;display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-gold" style="width:100%;padding:11px;font-size:.95rem" ${dataAct('submitOrder')}>
              ${iconCheck(14)} Place Order
            </button>
            <button class="btn btn-secondary" style="width:100%;font-size:.83rem" ${dataAct('saveDraft')}>Save as Draft</button>
            <button class="btn btn-secondary" style="width:100%;font-size:.8rem;color:var(--danger);border-color:#fca5a5" ${dataAct('clearCartToCatalogue')}>Clear Cart</button>
          </div>
        </div>
      </div>
    </div>`;

  refreshCartReviewUI();
  loadBudgetBar();
}

function refreshCartReviewUI() {
  // Safety net: repair any cart item whose name is missing or equal to its SKU
  APP.cart.forEach(ci => {
    if (!ci.name || ci.name === ci.sku) {
      const ct = (APP._catalog||[]).find(c => c.sku === ci.sku);
      if (ct?.name) ci.name = ct.name;
    }
  });

  const total = APP.cart.reduce((s,i) => s + i.qty * i.unit_price, 0);
  const gst   = Math.round(total * 0.18);
  const grand = total + gst;
  const count = APP.cart.reduce((s,i) => s + i.qty, 0);

  const itemsEl = document.getElementById('review-cart-items');
  if (itemsEl) {
    itemsEl.innerHTML = APP.cart.length === 0
      ? `<div class="u-empty-lg">Cart is empty — <a href="#" ${dataAct('switchOrderStep', 'catalogue')} data-prevent>browse catalogue</a></div>`
      : APP.cart.map(item => `
        <div style="padding:12px 18px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:38px;height:38px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${item.emoji||'📦'}</div>
            <div class="u-flex1">
              <div style="font-weight:600;font-size:.88rem;color:var(--navy)">${h(item.name)}</div>
              <div style="font-size:.73rem;color:var(--text-muted);margin-top:1px">${item.sku} · ${fmt(item.unit_price)}/unit</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <div class="catalog-qty" style="margin:0">
                <button class="qty-btn" ${dataActEl('changeQty', item.sku, -1, item.unit_price)}>−</button>
                <input type="number" class="qty-input" min="1" step="1" value="${item.qty}" inputmode="numeric"
                  data-name="${item.name.replace(/"/g,'&quot;')}" aria-label="Quantity for ${h(item.name)}"
                  ${dataChangeVal('setQty', item.sku)}
                  ${dataEnterEl('_blurEl')} data-selectall>
                <button class="qty-btn" ${dataActEl('changeQty', item.sku, 1, item.unit_price)}>+</button>
              </div>
              <span style="font-weight:700;min-width:64px;text-align:right;font-size:.9rem">${fmt(item.qty * item.unit_price)}</span>
              <button ${dataAct('removeCartItem', item.sku)}
                style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border);background:#fff;cursor:pointer;color:var(--text-muted);font-size:.78rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s"
                data-hoverdanger>✕</button>
            </div>
          </div>
          <input type="text" maxlength="200" value="${h(item.note||'')}" placeholder="💬 Remark for this item — brand preference, size, urgency… (optional)"
            ${dataInputVal('setCartItemNote', item.sku)}
            style="width:100%;margin-top:8px;padding:6px 10px;border:1px dashed var(--border);border-radius:7px;font-size:.76rem;box-sizing:border-box;outline:none;background:#fafbfc;transition:border .15s"
            data-focussolid data-blurdashed>
        </div>`).join('');
  }

  const summaryEl = document.getElementById('review-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:.88rem"><span class="u-muted">${count} item${count!==1?'s':''}</span><span>${fmt(total)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:14px;font-size:.88rem"><span class="u-muted">GST (18%)</span><span>${fmt(gst)}</span></div>
      <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:2px solid var(--border);font-weight:800;font-size:1.05rem"><span>Total</span><span style="color:var(--navy)">${fmt(grand)}</span></div>
      ${grand > 100000 ? `<div class="alert alert-warning" style="margin-top:12px;font-size:.8rem">⚠️ Amount exceeds ₹1L — approval required</div>` : ''}
      <div id="budget-bar-wrap" style="margin-top:12px;display:none">
        <div style="font-size:.8rem;font-weight:600;margin-bottom:4px;color:var(--text-muted)">Monthly Budget Used</div>
        <div style="background:var(--border);height:8px;border-radius:4px;overflow:hidden"><div id="budget-bar-fill" style="height:100%;border-radius:4px;transition:width .3s"></div></div>
        <div id="budget-bar-label" style="font-size:.73rem;margin-top:3px;color:var(--text-muted)"></div>
      </div>`;
    loadBudgetBar();
  }
}

function removeCartItem(sku) {
  APP.cart = APP.cart.filter(i => i.sku !== sku);
  if (!APP.cart.length) { switchOrderStep('catalogue'); showToast('Cart is empty', 'info'); return; }
  refreshCartReviewUI();
}

function setCartItemNote(sku, note) {
  const item = APP.cart.find(i => i.sku === sku);
  if (item) item.note = note.trim() || undefined;
}

/* ── Order photo attachment: downscale to ≤900px JPEG, keep under ~1MB ── */
function attachOrderImage(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); input.value=''; return; }
  const img = new Image();
  img.onload = () => {
    const maxDim = 900;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    if (dataUrl.length > 1_400_000) dataUrl = canvas.toDataURL('image/jpeg', 0.5);
    if (dataUrl.length > 1_400_000) { showToast('Image too large even after compression — try a smaller photo', 'error'); input.value=''; return; }
    APP._orderImage = dataUrl;
    const prev = document.getElementById('cart-image-preview');
    const thumb = document.getElementById('cart-image-thumb');
    if (thumb) thumb.src = dataUrl;
    if (prev) prev.style.display = 'flex';
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => { showToast('Could not read image', 'error'); input.value=''; };
  img.src = URL.createObjectURL(file);
}

function removeOrderImage() {
  APP._orderImage = null;
  const inp = document.getElementById('cart-image'); if (inp) inp.value = '';
  const prev = document.getElementById('cart-image-preview'); if (prev) prev.style.display = 'none';
}

/* ============================================================
   AD-HOC / QUICK REQUEST — order without catalogue selection.
   The client types free-text lines (description + qty + unit); 4SYZ
   Ops prices them before the order enters the normal approval flow.
   ============================================================ */
function adhocRowInput(cls, ph, val, extra) {
  return `<input type="${cls==='adhoc-qty'?'number':'text'}" class="${cls}"${cls==='adhoc-qty'?' min="1"':''} placeholder="${ph}" value="${h(val==null?'':String(val))}"
    style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:.86rem;box-sizing:border-box;width:100%" ${extra||''}>`;
}

function adhocRowsHTML() {
  return (APP._adhocLines||[]).map((ln,idx)=>`
    <div class="adhoc-row" data-idx="${idx}" style="display:grid;grid-template-columns:1fr 72px 84px 34px;gap:8px;margin-bottom:8px;align-items:center">
      ${adhocRowInput('adhoc-desc','What do you need? e.g. 24 × 1L cold-pressed juice', ln.desc)}
      ${adhocRowInput('adhoc-qty','Qty', ln.qty)}
      ${adhocRowInput('adhoc-uom','unit / box', ln.uom)}
      <button class="btn btn-secondary btn-sm" style="padding:6px 0" ${dataAct('adhocRemoveLine', idx)} ${(APP._adhocLines||[]).length<=1?'disabled':''} title="Remove line">✕</button>
    </div>`).join('');
}

function syncAdhocFromDOM() {
  const rows = [...document.querySelectorAll('.adhoc-row')];
  if (!rows.length) return;
  APP._adhocLines = rows.map(r => ({
    desc: r.querySelector('.adhoc-desc')?.value || '',
    qty:  r.querySelector('.adhoc-qty')?.value || '',
    uom:  r.querySelector('.adhoc-uom')?.value || '',
  }));
}

function redrawAdhocRows() {
  const c = document.getElementById('adhoc-rows');
  if (c) c.innerHTML = adhocRowsHTML();
}

function adhocAddLine() {
  syncAdhocFromDOM();
  (APP._adhocLines = APP._adhocLines || []).push({ desc:'', qty:1, uom:'' });
  redrawAdhocRows();
}

function adhocRemoveLine(idx) {
  syncAdhocFromDOM();
  APP._adhocLines.splice(idx, 1);
  if (!APP._adhocLines.length) APP._adhocLines.push({ desc:'', qty:1, uom:'' });
  redrawAdhocRows();
}

function attachAdhocImage(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); input.value=''; return; }
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 900 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width*scale); canvas.height = Math.round(img.height*scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    if (dataUrl.length > 1_400_000) dataUrl = canvas.toDataURL('image/jpeg', 0.5);
    if (dataUrl.length > 1_400_000) { showToast('Image too large even after compression — try a smaller photo', 'error'); input.value=''; return; }
    APP._adhocImage = dataUrl;
    const prev = document.getElementById('adhoc-image-preview');
    const thumb = document.getElementById('adhoc-image-thumb');
    if (thumb) thumb.src = dataUrl;
    if (prev) prev.style.display = 'flex';
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => { showToast('Could not read image', 'error'); input.value=''; };
  img.src = URL.createObjectURL(file);
}

function removeAdhocImage() {
  APP._adhocImage = null;
  const inp = document.getElementById('adhoc-image'); if (inp) inp.value = '';
  const prev = document.getElementById('adhoc-image-preview'); if (prev) prev.style.display = 'none';
}

async function showAdhocOrderModal() {
  APP._adhocLines = [{ desc:'', qty:1, uom:'' }];
  APP._adhocImage = null;
  const isClientRole = ['client_admin','client_user','client_approver'].includes(APP.user?.role);

  // Ops roles pick which client the request is for; client roles order for themselves.
  let clientPicker = '';
  if (!isClientRole) {
    const clients = await api('/clients');
    const opts = (clients||[]).map(c => `<option value="${c.id}">${h(c.name)}</option>`).join('');
    clientPicker = `
      <div style="margin-bottom:14px">
        <label style="display:block;margin-bottom:6px;font-weight:600;font-size:.85rem">Client</label>
        <select id="adhoc-client" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px">
          <option value="">— Select a client —</option>${opts}
        </select>
      </div>`;
  }

  openModal('⚡ Quick / Ad-hoc Request',
    `<div style="font-size:.84rem;color:var(--text-muted);margin-bottom:14px;line-height:1.5">
       Need something that isn't in the catalogue? Describe it here — no product selection needed.
       4SYZ will confirm pricing, then the request follows the usual approval &amp; delivery flow.
     </div>
     ${clientPicker}
     <div style="display:grid;grid-template-columns:1fr 72px 84px 34px;gap:8px;margin-bottom:6px;font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">
       <div>Item / description</div><div>Qty</div><div>Unit</div><div></div>
     </div>
     <div id="adhoc-rows">${adhocRowsHTML()}</div>
     <button class="btn btn-secondary btn-sm" style="margin-top:2px" ${dataAct('adhocAddLine')}>+ Add another item</button>

     <div style="margin-top:16px">
       <label style="display:block;margin-bottom:6px;font-weight:600;font-size:.85rem">Notes for 4SYZ <span style="color:var(--text-muted);font-weight:400">(optional)</span></label>
       <textarea id="adhoc-notes" rows="2" placeholder="Brand preference, specs, delivery address, contact person…"
         style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:.86rem;box-sizing:border-box;resize:vertical"></textarea>
     </div>

     <div style="margin-top:12px">
       <label class="btn btn-secondary btn-sm" style="cursor:pointer">📷 Attach photo
         <input type="file" id="adhoc-image" accept="image/*" ${dataChangeEl('attachAdhocImage')} style="display:none">
       </label>
       <div id="adhoc-image-preview" style="margin-top:8px;display:none;align-items:center;gap:10px">
         <img id="adhoc-image-thumb" style="max-height:70px;border-radius:8px;border:1px solid var(--border)">
         <button class="btn btn-secondary btn-sm" ${dataAct('removeAdhocImage')}>Remove</button>
       </div>
     </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-gold" ${dataAct('submitAdhocOrder')}>Submit Request</button>`
  );
}

async function submitAdhocOrder() {
  syncAdhocFromDOM();
  const lines = (APP._adhocLines||[]).filter(l => (l.desc||'').trim() && Number(l.qty) > 0);
  if (!lines.length) { showToast('Add at least one item with a description and quantity', 'error'); return; }

  const isClientRole = ['client_admin','client_user','client_approver'].includes(APP.user?.role);
  let clientId = APP.user?.client_id || '__self__';
  if (!isClientRole) {
    clientId = document.getElementById('adhoc-client')?.value || '';
    if (!clientId) { showToast('Select a client', 'error'); return; }
  }

  const notes = document.getElementById('adhoc-notes')?.value?.trim() || '';
  const items = lines.map(l => {
    const desc = l.desc.trim();
    const uom = (l.uom||'').trim();
    return {
      sku: 'ADHOC-' + Math.random().toString(36).slice(2,8).toUpperCase(),
      name: uom ? `${desc} (${uom})` : desc,
      qty: Number(l.qty),
      unit_price: 0,
    };
  });

  const btn = document.querySelector('#modal-footer .btn-gold');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  const result = await api('/orders', {
    method: 'POST',
    body: JSON.stringify({
      client_id: clientId,
      items,
      order_type: 'Ad-Hoc',
      ...(notes ? { notes } : {}),
      ...(APP._adhocImage ? { image: APP._adhocImage } : {}),
    }),
  });

  closeModal();
  if (result) {
    APP._adhocLines = null;
    APP._adhocImage = null;
    showToast(`Ad-hoc request ${result.id} submitted — 4SYZ will confirm pricing`);
    navigate('my_orders');
  }
}

function showCSVUploadModal() {
  const m = document.getElementById('csv-upload-modal');
  if (m) m.style.display = 'flex';
}

function searchCatalog(q) {
  APP._catalogSearch = q.trim().toLowerCase();
  const filtered = getFilteredCatalog();
  const info = document.getElementById('catalog-results-info');
  if (info) info.textContent = `${filtered.length} item${filtered.length!==1?'s':''} found`;
  const grid = document.getElementById('catalog-grid');
  if (grid) { grid.className = APP._catalogView==='list'?'catalog-list':'catalog-grid'; grid.innerHTML = renderCatalogItems(filtered); }
}

function setCatalogView(v) {
  APP._catalogView = v;
  ['tile','list'].forEach(x => {
    const btn = document.getElementById('view-'+x+'-btn');
    if (btn) { btn.style.background = v===x?'var(--navy)':'#fff'; btn.style.color = v===x?'#fff':'var(--text-muted)'; }
  });
  const grid = document.getElementById('catalog-grid');
  if (grid) { grid.className = v==='list'?'catalog-list':'catalog-grid'; grid.innerHTML = renderCatalogItems(getFilteredCatalog()); }
}

function getFilteredCatalog() {
  let items = APP._catalog || [];
  if (APP._catFilter && APP._catFilter !== 'All') items = items.filter(i => i.category === APP._catFilter);
  if (APP._catalogSearch) {
    const q = APP._catalogSearch;
    items = items.filter(i => i.name.toLowerCase().includes(q) || (i.sku||'').toLowerCase().includes(q) || (i.category||'').toLowerCase().includes(q));
  }
  return items;
}

async function switchOrderTab(tab) {
  // legacy stub — no longer used but kept to avoid JS errors if called
  if (tab === 'catalogue') { refreshCartUI(); loadBudgetBar(); }
  if (tab === 'quick_reorder') loadQuickReorder();
  if (tab === 'standing_orders') loadStandingOrders();
}

async function loadBudgetBar() {
  const wrap = document.getElementById('budget-bar-wrap');
  if (!wrap) return;
  try {
    const clientId = APP.user && APP.user.client_id;
    if (!clientId) return;
    const budget = await api('/clients/' + clientId + '/budget');
    if (!budget || budget.monthly_budget == null) return;
    const pct = Math.min(100, Math.round((budget.used / budget.monthly_budget) * 100));
    const color = pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--warning)' : 'var(--success)';
    wrap.style.display = '';
    document.getElementById('budget-bar-fill').style.cssText = `height:100%;border-radius:5px;transition:width .3s;width:${pct}%;background:${color}`;
    document.getElementById('budget-bar-label').textContent = `${pct}% used — ₹${budget.used?.toLocaleString('en-IN')||0} of ₹${budget.monthly_budget?.toLocaleString('en-IN')||0}`;
  } catch(e) { /* hide bar on error */ }
}

function downloadOrderTemplate() {
  const catalog = APP._catalog || [];
  const date = new Date().toISOString().slice(0,10);
  const header = 'SKU,Item Name,Category,UOM,Unit Price,Quantity';
  const body = catalog.map(i => [
    i.sku,
    `"${(i.name||'').replace(/"/g,'""')}"`,
    `"${(i.category||'').replace(/"/g,'""')}"`,
    i.uom || 'unit',
    (i.unit_price != null ? Number(i.unit_price).toFixed(2) : ''),
    ''   // blank — client fills this in
  ].join(',')).join('\n');
  const csv = header + '\n' + body;
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `order-list-${date}.csv`;
  a.click();
  showToast(`Exported ${catalog.length} item${catalog.length!==1?'s':''}`, 'success');
}

async function processCSVUpload() {
  const input = document.getElementById('csv-upload-input');
  const fb = document.getElementById('csv-import-feedback');
  if (!input || !input.files.length) { if(fb) fb.innerHTML = '<div class="alert alert-warning">Please select a CSV file.</div>'; return; }
  const file = input.files[0];
  const text = await file.text();
  const parsed = parseCSVText(text);
  if (parsed.length < 2) { if(fb) fb.innerHTML = '<div class="alert alert-danger">CSV must have a header row and at least one data row.</div>'; return; }
  const headers = parsed[0].map(h => h.toLowerCase().trim());
  const skuIdx = headers.indexOf('sku');
  const qtyIdx = headers.indexOf('quantity') !== -1 ? headers.indexOf('quantity') : headers.indexOf('qty');
  if (skuIdx === -1 || qtyIdx === -1) {
    if(fb) fb.innerHTML = '<div class="alert alert-danger">CSV must have "sku" and "quantity" (or "qty") columns.</div>'; return;
  }
  let imported = 0, skipped = 0, notFound = [];
  for (let i = 1; i < parsed.length; i++) {
    const cols = parsed[i];
    const sku = (cols[skuIdx] || '').trim();
    const qty = parseInt(cols[qtyIdx], 10);
    if (!sku || isNaN(qty) || qty < 1) { skipped++; continue; }
    const item = APP._catalog && APP._catalog.find(it => it.sku === sku);
    if (!item) { notFound.push(sku); skipped++; continue; }
    const existing = APP.cart.find(c => c.sku === sku);
    if (existing) existing.qty += qty;
    else APP.cart.push({ sku, name: item.name, qty, unit_price: item.unit_price });
    imported++;
  }
  const notFoundNote = notFound.length ? `<div style="font-size:.78rem;margin-top:6px">SKUs not found in your catalog: ${notFound.join(', ')}</div>` : '';
  if(fb) fb.innerHTML = `<div style="padding:10px 14px;border-radius:8px;background:${imported?'var(--success-soft-bg)':'var(--amber-bg)'};border:1px solid ${imported?'#6ee7b7':'#fcd34d'};font-size:.84rem;color:${imported?'#065f46':'var(--amber-text)'}">
    <b>${imported} item(s) added to cart</b>${skipped?`, ${skipped} row(s) skipped (blank or 0 qty)`:''}.${notFoundNote}
    ${imported?`<div style="margin-top:10px"><button class="btn btn-primary btn-sm" ${dataAct('hideCSVThenReview')}>Review &amp; Place Order →</button></div>`:''}
  </div>`;
  if (imported) refreshCartUI();
}

async function loadQuickReorder() {
  const orders = await api('/orders');
  const el = document.getElementById('quick-reorder-content');
  if (!el) return;
  const recent = (orders || []).slice(0, 5);
  if (!recent.length) {
    el.innerHTML = `<div class="card"><div class="card-body" style="padding:32px;text-align:center">${emptyState('🛒','No recent orders','Place your first order to see it here.')}</div></div>`;
    return;
  }
  el.innerHTML = recent.map(o=>`
    <div class="card" style="margin-bottom:12px">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <div><b>${o.id}</b> &nbsp;${statusBadge(o.status)} &nbsp;<span style="color:var(--text-muted);font-size:.84rem">${fmtDate(o.created_at)}</span></div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="u-b600">${fmt(o.grand_total)}</span>
          <button class="btn btn-secondary btn-sm" ${dataAct('previewReorder', o.id)}>👁 Preview</button>
          <button class="btn btn-gold btn-sm" ${dataAct('reorderFromHistory', o.id)}>Reorder all</button>
        </div>
      </div>
      <div class="card-body" style="padding:10px 16px;font-size:.84rem;color:var(--text-muted)">
        ${(o.items||[]).map(i=>`${h(i.name)} ×${i.qty}`).join(' · ')||'—'}
      </div>
    </div>`).join('');
}

async function reorderFromHistory(orderId) {
  const order = await api('/orders/' + orderId);
  if (!order || !order.items) return;
  order.items.forEach(i => {
    const item = APP._catalog && APP._catalog.find(it => it.sku === i.sku || it.name === i.name);
    const price = item ? item.unit_price : (i.unit_price || 0);
    const existing = APP.cart.find(c => c.sku === (i.sku || i.name));
    if (existing) existing.qty += i.qty;
    else APP.cart.push({ sku: i.sku || i.name, name: i.name, qty: i.qty, unit_price: price, emoji: item?.emoji || '📦' });
  });
  showToast('Items added to cart');
  refreshCartUI();
}

// Preview a past order's items so the client can pick exactly what to reorder.
async function previewReorder(orderId) {
  const order = await api('/orders/' + orderId);
  if (!order || !order.items || !order.items.length) { showToast('No items found for this order', 'error'); return; }
  // Resolve current catalogue price/emoji for each line; keep the row data for confirm.
  APP._reorderPreview = order.items.map(i => {
    const item = APP._catalog && APP._catalog.find(it => it.sku === i.sku || it.name === i.name);
    return { sku: i.sku || i.name, name: i.name, qty: i.qty || 1,
             price: item ? item.unit_price : (i.unit_price || 0), emoji: item?.emoji || '📦' };
  });
  const rows = APP._reorderPreview.map((r, idx) => `
    <tr>
      <td class="u-center"><input type="checkbox" class="pr-chk" data-idx="${idx}" checked
        ${dataChange('updateReorderPreview')} style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary)"></td>
      <td><span style="font-size:1.05rem">${r.emoji}</span> <b style="font-size:.85rem">${h(r.name)}</b>
        <div class="u-muted-xs">${h(r.sku)} · ${fmt(r.price)}/unit</div></td>
      <td class="u-center">
        <input type="number" class="pr-qty" data-idx="${idx}" value="${r.qty}" min="1" step="1" inputmode="numeric"
          ${dataInputEl('maskDigits', 0)} ${dataChange('updateReorderPreview')}
          style="width:56px;text-align:center;border:1.5px solid var(--border-mid);border-radius:7px;padding:4px 2px;font-weight:700"></td>
      <td class="pr-line" data-idx="${idx}" style="text-align:right;font-weight:700;white-space:nowrap">${fmt(r.price * r.qty)}</td>
    </tr>`).join('');
  openModal(`Reorder from ${order.id}`, `
    <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:10px">Placed ${fmtDate(order.created_at)} · pick the items and quantities to add to your cart.</div>
    <div class="table-wrap" style="max-height:52vh;overflow:auto">
      <table class="table" style="margin:0">
        <thead><tr>
          <th style="width:34px;text-align:center"><input type="checkbox" id="pr-all" checked ${dataChangeEl('toggleReorderAll')} style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary)"></th>
          <th>Item</th><th class="u-center">Qty</th><th class="u-right">Line total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" id="pr-add" ${dataAct('confirmReorderPreview')}>Add to cart</button>`);
  updateReorderPreview();
}

function toggleReorderAll(cb) {
  document.querySelectorAll('.pr-chk').forEach(c => { c.checked = cb.checked; });
  updateReorderPreview();
}

// Recompute per-line totals, the running total and the button label/state.
function updateReorderPreview() {
  const rows = APP._reorderPreview || [];
  let total = 0, count = 0;
  document.querySelectorAll('.pr-chk').forEach(chk => {
    const idx = +chk.dataset.idx;
    const qtyEl = document.querySelector(`.pr-qty[data-idx="${idx}"]`);
    const qty = Math.max(1, parseInt(qtyEl?.value) || 1);
    const line = (rows[idx]?.price || 0) * qty;
    const lineEl = document.querySelector(`.pr-line[data-idx="${idx}"]`);
    if (lineEl) { lineEl.textContent = fmt(line); lineEl.style.opacity = chk.checked ? '1' : '.35'; }
    if (chk.checked) { total += line; count++; }
  });
  const allEl = document.getElementById('pr-all');
  if (allEl) allEl.checked = count > 0 && count === document.querySelectorAll('.pr-chk').length;
  const btn = document.getElementById('pr-add');
  if (btn) { btn.disabled = count === 0; btn.textContent = count ? `Add ${count} item${count>1?'s':''} · ${fmt(total)}` : 'Select items'; }
}

function confirmReorderPreview() {
  const rows = APP._reorderPreview || [];
  let added = 0;
  document.querySelectorAll('.pr-chk').forEach(chk => {
    if (!chk.checked) return;
    const idx = +chk.dataset.idx;
    const r = rows[idx];
    if (!r) return;
    const qty = Math.max(1, parseInt(document.querySelector(`.pr-qty[data-idx="${idx}"]`)?.value) || 1);
    const existing = APP.cart.find(c => c.sku === r.sku);
    if (existing) existing.qty += qty;
    else APP.cart.push({ sku: r.sku, name: r.name, qty, unit_price: r.price, emoji: r.emoji });
    added++;
  });
  if (!added) { showToast('Select at least one item', 'error'); return; }
  closeModal();
  showToast(`${added} item${added>1?'s':''} added to cart`);
  refreshCartUI();
}

async function loadStandingOrders() {
  const el = document.getElementById('standing-orders-content');
  if (!el) return;
  let standing = null;
  try { standing = await api('/standing-orders'); } catch(e) {}
  if (!standing || !standing.length) {
    el.innerHTML = `<div class="card"><div class="card-body" style="padding:32px;text-align:center">${emptyState('🔄','No standing orders','Set up recurring orders to appear here.')}</div></div>`;
    return;
  }
  el.innerHTML = `<div class="card"><div class="table-wrap"><table class="table">
    <thead><tr><th>ID</th><th>Description</th><th>Frequency</th><th>Next Run</th><th>Status</th></tr></thead>
    <tbody>${standing.map(s=>`<tr>
      <td><b>${s.id}</b></td>
      <td>${s.description||'—'}</td>
      <td>${s.frequency||'—'}</td>
      <td>${fmtDate(s.next_run_at||s.next_run)}</td>
      <td>${statusBadge(s.status||'ACTIVE')}</td>
    </tr>`).join('')}
    </tbody></table></div></div>`;
}

function renderCatalogItems(items) {
  if (!items.length) return `<div style="padding:32px;text-align:center;color:var(--text-muted);grid-column:1/-1">No items match your search</div>`;
  const view = APP._catalogView || 'tile';
  const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role);

  if (view === 'list') {
    return `<div style="background:#fff;border-radius:12px;border:1px solid var(--border);overflow:hidden">
      <div style="display:grid;grid-template-columns:${isClient?'2fr 1fr 90px 110px':'2fr 1fr 80px 90px 110px'};gap:0;padding:8px 16px;background:var(--surface-2);border-bottom:1px solid var(--border);font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">
        <div>Item</div><div>Category</div>${isClient?'':'<div>Stock</div>'}<div>Price</div><div class="u-center">Quantity</div>
      </div>
      ${items.map(item => {
        const inCart = APP.cart.find(c => c.sku === item.sku);
        const qty = inCart ? inCart.qty : 0;
        const lowStock = item.stock <= item.reorder_level;
        return `<div style="display:grid;grid-template-columns:${isClient?'2fr 1fr 90px 110px':'2fr 1fr 80px 90px 110px'};gap:0;padding:10px 16px;border-bottom:1px solid var(--border);align-items:center;transition:background .12s" data-hover>
          <div style="display:flex;align-items:center;gap:10px;min-width:0">
            <div style="font-size:1.4rem;flex-shrink:0">${item.emoji||'📦'}</div>
            <div style="min-width:0">
              <div style="font-weight:600;font-size:.88rem;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(item.name)}</div>
              <div class="u-muted-xs">${item.sku}${item.brand?' · '+item.brand:''}</div>
            </div>
          </div>
          <div style="font-size:.8rem;color:var(--text-muted)">${item.category}${item.sub_category&&item.sub_category!=='Normal'?'<br><span style="font-size:.7rem;color:#10b981;font-weight:600">'+item.sub_category+'</span>':''}</div>
          ${isClient?'':`<div style="font-size:.82rem;font-weight:600;color:${lowStock?'var(--danger)':'var(--text-muted)'}">
            ${item.stock}${item.uom?' '+item.uom:''}${lowStock?' ⚠️':''}
          </div>`}
          <div style="font-weight:700;font-size:.9rem;color:var(--navy);display:flex;flex-direction:column;align-items:flex-start;gap:2px">
            <span>${fmt(item.unit_price)}</span>
            ${item.client_price!=null?`<span style="font-size:.6rem;background:var(--blue-light);color:#1d4ed8;padding:1px 6px;border-radius:8px;font-weight:600;white-space:nowrap">Your Price</span>`:''}
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:6px">
            <button class="qty-btn" ${dataActEl('changeQty', item.sku, -1, item.unit_price)} style="width:26px;height:26px;border-radius:50%">−</button>
            <input type="number" class="qty-input" id="qty-${item.sku}" min="0" step="1" value="${qty}" inputmode="numeric"
              data-name="${item.name.replace(/"/g,'&quot;')}" aria-label="Quantity for ${h(item.name)}"
              ${dataChangeVal('setQty', item.sku)} ${dataEnterEl('_blurEl')} data-selectall>
            <button class="qty-btn" ${dataActEl('changeQty', item.sku, 1, item.unit_price)} style="width:26px;height:26px;border-radius:50%">+</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // Tile view (default)
  return items.map(item => {
    const inCart = APP.cart.find(c => c.sku === item.sku);
    const qty = inCart ? inCart.qty : 0;
    const lowStock = item.stock <= item.reorder_level;
    return `<div class="catalog-card" style="${qty>0?'border-color:var(--navy);box-shadow:0 2px 8px rgba(0,0,0,.1)':''}">
      <div style="position:relative">
        <div class="catalog-emoji">${item.emoji||'📦'}</div>
        ${qty>0?`<div style="position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:50%;background:var(--navy);color:#fff;font-size:.7rem;font-weight:800;display:flex;align-items:center;justify-content:center">${qty}</div>`:''}
      </div>
      <div class="catalog-name">${h(item.name)}</div>
      <div class="catalog-cat">${item.category}${item.brand?' · '+item.brand:''}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:4px">
        <div class="catalog-price">${fmt(item.unit_price)}</div>
        ${item.uom?`<span style="font-size:.7rem;color:var(--text-muted)">/${item.uom}</span>`:''}
      </div>
      ${item.client_price!=null?`<div style="font-size:.67rem;background:var(--blue-light);color:#1d4ed8;padding:1px 7px;border-radius:10px;display:inline-block;margin-bottom:6px">Your Price</div>`:'<div style="margin-bottom:6px"></div>'}
      ${isClient?'':`<div class="catalog-stock ${lowStock?'text-danger':''}" style="margin-bottom:10px">
        ${lowStock?'⚠️ ':''}Stock: ${item.stock}
      </div>`}
      <div class="catalog-qty">
        <button class="qty-btn" ${dataActEl('changeQty', item.sku, -1, item.unit_price)}>−</button>
        <input type="number" class="qty-input" id="qty-${item.sku}" min="0" step="1" value="${qty}" inputmode="numeric"
          data-name="${item.name.replace(/"/g,'&quot;')}" aria-label="Quantity for ${h(item.name)}"
          ${dataChangeVal('setQty', item.sku)} ${dataEnterEl('_blurEl')} data-selectall>
        <button class="qty-btn" ${dataActEl('changeQty', item.sku, 1, item.unit_price)}>+</button>
      </div>
    </div>`;
  }).join('');
}

function filterCatalog(cat, btn) {
  APP._catFilter = cat;
  document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = getFilteredCatalog();
  const info = document.getElementById('catalog-results-info');
  if (info) info.textContent = `${filtered.length} item${filtered.length!==1?'s':''} found`;
  const grid = document.getElementById('catalog-grid');
  if (grid) { grid.className = APP._catalogView==='list'?'catalog-list':'catalog-grid'; grid.innerHTML = renderCatalogItems(filtered); }
}

function changeQty(sku, delta, price, btnOrName) {
  const catalogItem = (APP._catalog||[]).find(c => c.sku === sku);
  // Prefer the catalog's real item name; fall back to the qty-val label, never the SKU
  const name = catalogItem?.name
    || (typeof btnOrName === 'string' ? btnOrName : null)
    || (typeof btnOrName === 'object' ? document.getElementById('qty-' + sku)?.dataset.name : null)
    || sku;
  const existing = APP.cart.find(c => c.sku === sku);
  if (existing) {
    existing.qty = Math.max(0, existing.qty + delta);
    if (existing.qty === 0) APP.cart = APP.cart.filter(c => c.sku !== sku);
  } else if (delta > 0) {
    APP.cart.push({ sku, name, qty: 1, unit_price: price, emoji: catalogItem?.emoji || '📦' });
  }
  const qtyEl = document.getElementById('qty-' + sku);
  const newQty = APP.cart.find(c => c.sku === sku)?.qty || 0;
  if (qtyEl) { if (qtyEl.tagName === 'INPUT') qtyEl.value = newQty; else qtyEl.textContent = newQty; }
  refreshCartUI();
}

// Set a line to a manually-typed quantity. Integer ≥ 1; clearing the field or
// entering 0 removes the line, matching the −/+ behaviour. Works from the catalog
// too — typing a quantity for an item not yet in the cart adds it.
function setQty(sku, value) {
  const n = Math.floor(Number(value));
  const existing = APP.cart.find(c => c.sku === sku);
  if (!Number.isFinite(n) || n <= 0) {
    if (existing) APP.cart = APP.cart.filter(c => c.sku !== sku);
  } else if (existing) {
    existing.qty = Math.min(n, 100000); // guard against absurd values
  } else {
    const ci = (APP._catalog || []).find(c => c.sku === sku);
    APP.cart.push({ sku, name: ci?.name || sku, qty: Math.min(n, 100000),
      unit_price: ci?.unit_price ?? ci?.client_price ?? 0, emoji: ci?.emoji || '📦' });
  }
  const el = document.getElementById('qty-' + sku);
  if (el && el.tagName === 'INPUT') el.value = APP.cart.find(c => c.sku === sku)?.qty || 0;
  refreshCartUI();
}

async function orderMoreItem(sku, name) {
  const items = await api('/inventory?q=' + encodeURIComponent(sku));
  const item = Array.isArray(items) ? items.find(i => i.sku === sku) : null;
  const price = item?.unit_price || item?.client_price || 0;
  const emoji = item?.emoji || '📦';
  const existing = APP.cart.find(c => c.sku === sku);
  if (existing) {
    existing.qty += 1;
  } else {
    APP.cart.push({ sku, name: item?.name || name, qty: 1, unit_price: price, emoji });
  }
  showToast(`${item?.name || name} added to cart`);
  APP._postNavStep = 'review';
  navigate('place_order');
}

function refreshCartUI() {
  persistCart();
  const total = APP.cart.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const gst   = Math.round(total * 0.18);
  const grand = total + gst;
  const count = APP.cart.reduce((s, i) => s + i.qty, 0);

  // Update floating bottom bar (step 1 — browse)
  const bar = document.getElementById('cart-bottom-bar');
  if (bar) {
    bar.style.display = APP.cart.length ? 'flex' : 'none';
    const cbbCount = document.getElementById('cbb-count');
    const cbbTotal = document.getElementById('cbb-total');
    if (cbbCount) cbbCount.textContent = count + ' item' + (count !== 1 ? 's' : '');
    if (cbbTotal) cbbTotal.textContent = fmt(grand);
  }

  // If review step is open, refresh it too
  if (APP._orderStep === 'review') refreshCartReviewUI();
}

function setOrderType(type, btn) {
  APP._orderType = type;
  const colors = {Regular:'var(--blue)',Urgent:'var(--danger)','Ad-Hoc':'#d97706'};
  ['Regular','Urgent','Ad-Hoc'].forEach(t => {
    const b = document.getElementById('ot-btn-' + t.replace('-',''));
    if (!b) return;
    const c = colors[t];
    b.style.background = t === type ? c : '#fff';
    b.style.color = t === type ? '#fff' : c;
  });
  const nbw = document.getElementById('need-by-wrap');
  if (nbw) nbw.style.display = type === 'Urgent' ? 'block' : 'none';
  if (type !== 'Urgent') { const nb = document.getElementById('cart-need-by'); if (nb) nb.value = ''; }
}

async function submitOrder() {
  if (!APP.cart.length) { showToast('Cart is empty', 'error'); return; }

  const isClientRole = ['client_admin','client_user','client_approver'].includes(APP.user?.role);
  const grand = APP.cart.reduce((s,i)=>s+i.qty*i.unit_price,0)*1.18;
  const summary = `
    <div class="cart-row cart-total" style="margin-bottom:8px"><span>Grand Total</span><span>${fmt(grand)}</span></div>
    <p style="font-size:.85rem;color:var(--text-muted)">${APP.cart.length} item type(s) · ${APP.cart.reduce((s,i)=>s+i.qty,0)} units</p>`;

  if (isClientRole) {
    // Client users order for their own account — no dropdown needed
    const clientName = APP.user.org || 'your account';
    openModal('Confirm Order',
      `<div style="margin-bottom:16px;padding:12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:2px">Ordering for</div>
        <div style="font-weight:700;font-size:1rem">${h(clientName)}</div>
      </div>
      ${summary}`,
      `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
       <button class="btn btn-gold" ${dataAct('confirmOrder')}>Confirm & Submit</button>`
    );
  } else {
    // Ops / admin roles pick the client from the list
    const clients = await api('/clients');
    const clientOpts = (clients||[]).map(c => `<option value="${c.id}">${h(c.name)}</option>`).join('');
    openModal('Confirm Order',
      `<div style="margin-bottom:16px">
        <label style="display:block;margin-bottom:6px;font-weight:600">Select Client</label>
        <select id="order-client" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"
          ${dataChangeEl('toggleDisabledByValue', 'confirm-order-btn')}>
          <option value="">— Select a client —</option>
          ${clientOpts}
        </select>
      </div>
      ${summary}`,
      `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
       <button id="confirm-order-btn" class="btn btn-gold" ${dataAct('confirmOrder')} disabled>Confirm & Submit</button>`
    );
  }
}

async function confirmOrder(saveAsDraft) {
  const isClientRole = ['client_admin','client_user','client_approver'].includes(APP.user?.role);
  const clientId = isClientRole ? (APP.user.client_id || '__self__') : document.getElementById('order-client')?.value;
  if (!isClientRole && !clientId) { showToast('Select a client', 'error'); return; }

  const btn = document.querySelector('#modal-footer .btn-gold');
  if (btn) { btn.disabled = true; btn.textContent = saveAsDraft ? 'Saving…' : 'Submitting…'; }

  const notes = document.getElementById('cart-notes')?.value?.trim() || '';
  const orderType = APP._orderType || 'Regular';
  const needByDate = document.getElementById('cart-need-by')?.value || '';
  const orderPeriod = document.getElementById('cart-order-period')?.value || '';
  const result = await api('/orders', {
    method: 'POST',
    body: JSON.stringify({
      client_id: clientId,
      items: APP.cart,
      order_type: orderType,
      ...(notes ? { notes } : {}),
      ...(APP._orderImage ? { image: APP._orderImage } : {}),
      ...(needByDate ? { need_by_date: needByDate } : {}),
      ...(orderPeriod ? { order_period: orderPeriod } : {}),
      ...(saveAsDraft ? { save_as_draft: true } : {}),
    }),
  });

  closeModal();
  if (result) {
    APP.cart = [];
    persistCart();
    APP._orderImage = null;
    if (saveAsDraft) {
      showToast(`Draft ${result.id} saved — submit it from My Orders`);
    } else {
      showToast(`Order ${result.id} placed — ${result.status==='PENDING_APPROVAL'?'sent for approval':'submitted to 4SYZ'}`);
    }
    navigate('my_orders');
  }
}

async function saveDraft() {
  if (!APP.cart.length) { showToast('Cart is empty', 'error'); return; }
  const isClientRole = ['client_admin','client_user','client_approver'].includes(APP.user?.role);
  const grand = APP.cart.reduce((s,i)=>s+i.qty*i.unit_price,0)*1.18;
  const summary = `
    <div class="cart-row cart-total" style="margin-bottom:8px"><span>Grand Total</span><span>${fmt(grand)}</span></div>
    <p style="font-size:.85rem;color:var(--text-muted)">${APP.cart.length} item type(s) · ${APP.cart.reduce((s,i)=>s+i.qty,0)} units</p>`;
  if (isClientRole) {
    openModal('Save as Draft',
      `<p style="color:var(--text-muted);margin-bottom:12px">Draft will be saved to My Orders. You can submit it later.</p>${summary}`,
      `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
       <button class="btn btn-gold" ${dataAct('confirmOrder', true)}>Save Draft</button>`);
  } else {
    const clients = await api('/clients');
    const clientOpts = (clients||[]).map(c => `<option value="${c.id}">${h(c.name)}</option>`).join('');
    openModal('Save as Draft',
      `<div style="margin-bottom:16px">
        <label style="display:block;margin-bottom:6px;font-weight:600">Select Client</label>
        <select id="order-client" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"
          ${dataChangeEl('toggleDisabledByValue', 'save-draft-btn')}>
          <option value="">— Select a client —</option>
          ${clientOpts}
        </select>
      </div>${summary}`,
      `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
       <button id="save-draft-btn" class="btn btn-gold" ${dataAct('confirmOrder', true)} disabled>Save Draft</button>`);
  }
}

/* ============================================================
   MY INVENTORY (CLIENT STORE TRACKING)
   ============================================================ */
function h(v) { return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function renderMyInventory(el) {
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:40px"><span class="u-muted">Loading inventory…</span></div>`;
  const [items, consumption] = await Promise.all([
    api('/client-inventory'),
    api('/client-inventory/consumption').catch(()=>[]),
  ]);
  if (!items) { el.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-muted)">Could not load inventory.</div>`; return; }

  const totalItems   = items.length;
  const lowStock     = items.filter(i => i.stock_status === 'low').length;
  const outOfStock   = items.filter(i => i.stock_status === 'out').length;
  const reorderItems = items.filter(i => i.stock_status === 'low' || i.stock_status === 'out');
  const criticalItems= items.filter(i => i.is_critical);
  const criticalNeed = criticalItems.filter(i => i.stock_status === 'low' || i.stock_status === 'out').length;
  const consumedWeek = (consumption||[]).filter(c => c.consumed_at >= new Date(Date.now()-7*86400000).toISOString().slice(0,10));
  const totalUsedWeek= consumedWeek.reduce((s,c) => s + (c.qty||0), 0);
  APP._clientInvItems = items;

  // Nudge: no usage logged in 14 days starves the reorder forecast — encourage it.
  const consumed14 = (consumption||[]).filter(c => c.consumed_at >= new Date(Date.now()-14*86400000).toISOString().slice(0,10)).length;
  const nudgeHtml = (items.length > 0 && consumed14 === 0) ? `
    <div style="background:var(--primary-light);border:1.5px solid var(--primary-border,#99f6e4);border-radius:12px;padding:13px 16px;margin-bottom:16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="font-size:1.5rem;flex-shrink:0">📉</div>
      <div style="flex:1;min-width:200px">
        <div style="font-weight:800;color:var(--primary-hover);font-size:.9rem">Log what you use — get smarter reorder alerts</div>
        <div style="font-size:.8rem;color:var(--text);margin-top:3px">No usage logged in the last 2 weeks. When you record consumption, we can predict run-outs and flag reorders before you run dry.</div>
      </div>
      <button class="btn btn-primary btn-sm" style="flex-shrink:0" ${dataAct('logFirstItemUse')}>Log usage</button>
    </div>` : '';

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">My Store Inventory</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">Track items received, mark what's critical, log consumption, and reorder in one tap</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${reorderItems.length ? `<button class="btn btn-gold btn-sm" ${dataAct('orderAllLowStock')} title="Add every low & out-of-stock item to your order">🛒 Reorder all low/out (${reorderItems.length})</button>` : ''}
      <button class="btn btn-secondary btn-sm" ${dataActEl('syncClientInventory')}>🔄 Sync from Deliveries</button>
    </div>
  </div>
  ${nudgeHtml}

  <!-- KPI Cards -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:14px;margin-bottom:18px">
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
      <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Items Tracked</div>
      <div style="font-size:1.8rem;font-weight:700;color:var(--navy);line-height:1">${totalItems}</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${lowStock?'var(--amber)':'var(--border)'};margin-bottom:0;cursor:pointer" ${dataAct('invFilterStatus', 'low')}>
      <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Low Stock</div>
      <div style="font-size:1.8rem;font-weight:700;color:${lowStock?'var(--warning)':'var(--navy)'};line-height:1">${lowStock}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">at or below reorder level</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${outOfStock?'var(--danger)':'var(--border)'};margin-bottom:0;cursor:pointer" ${dataAct('invFilterStatus', 'out')}>
      <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Out of Stock</div>
      <div style="font-size:1.8rem;font-weight:700;color:${outOfStock?'var(--danger)':'var(--navy)'};line-height:1">${outOfStock}</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${criticalNeed?'var(--danger)':'var(--purple)'};margin-bottom:0;cursor:pointer" ${dataAct('invFilterStatus', 'critical', 'stock')} title="Items you've marked critical">
      <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">★ Critical Items</div>
      <div id="inv-kpi-critical" style="font-size:1.8rem;font-weight:700;color:var(--purple);line-height:1">${criticalItems.length}</div>
      <div id="inv-kpi-critical-sub" style="font-size:.72rem;color:${criticalNeed?'var(--danger)':'var(--text-muted)'};margin-top:4px">${criticalNeed?`${criticalNeed} need restock`:'tracked for availability'}</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
      <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Used This Week</div>
      <div style="font-size:1.8rem;font-weight:700;color:var(--navy);line-height:1">${Math.round(totalUsedWeek)}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">units consumed</div>
    </div>
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px">
    ${['stock','consumption'].map((t,i) => `<button id="inv-tab-${t}" ${dataAct('switchMyInvTab', t)} style="padding:9px 20px;font-size:.85rem;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:${i===0?'2px solid var(--primary)':'2px solid transparent'};margin-bottom:-2px;color:${i===0?'var(--primary)':'var(--text-muted)'}">${['Current Stock','Consumption Log'][i]}</button>`).join('')}
  </div>

  <!-- Current Stock Tab -->
  <div id="inv-panel-stock">
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <input id="inv-search" type="text" placeholder="Search items…" class="form-control" style="max-width:240px" ${dataInput('filterMyInventoryTable')}>
      <select id="inv-filter-status" class="form-control" style="max-width:160px" ${dataChange('filterMyInventoryTable')}>
        <option value="">All Status</option>
        <option value="critical">★ Critical</option>
        <option value="ok">In Stock</option>
        <option value="low">Low Stock</option>
        <option value="out">Out of Stock</option>
      </select>
      <select id="inv-filter-cat" class="form-control" style="max-width:180px" ${dataChange('filterMyInventoryTable')}>
        <option value="">All Categories</option>
        ${[...new Set(items.map(i=>i.category).filter(Boolean))].sort().map(c=>`<option value="${h(c)}">${h(c)}</option>`).join('')}
      </select>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="table table-cards" style="margin:0">
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>UOM</th>
            <th class="u-right">In Store</th>
            <th class="u-right">Reorder At</th>
            <th>Status</th>
            <th>Last Received</th>
            <th>Last Used</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="my-inv-tbody">
          ${items.length === 0 ? `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">No inventory yet — items will appear here after deliveries are confirmed.</td></tr>` :
            items.map(i => myInvRow(i)).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Consumption Log Tab -->
  <div id="inv-panel-consumption" style="display:none">
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <input type="date" id="inv-cons-from" class="form-control" style="max-width:160px" value="${new Date(Date.now()-7*86400000).toISOString().slice(0,10)}" ${dataChange('reloadConsumptionLog')}>
      <span style="color:var(--text-muted);font-size:.85rem">to</span>
      <input type="date" id="inv-cons-to" class="form-control" style="max-width:160px" value="${new Date().toISOString().slice(0,10)}" ${dataChange('reloadConsumptionLog')}>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="table" style="margin:0">
        <thead>
          <tr><th>Date & Time</th><th>Item</th><th class="u-right">Qty Used</th><th>Notes</th><th>Recorded By</th></tr>
        </thead>
        <tbody id="cons-log-tbody">
          ${renderConsumptionRows(consumption||[])}
        </tbody>
      </table>
    </div>
  </div>`;
}

function myInvRow(i) {
  const statusColor = i.stock_status==='out' ? 'var(--danger)' : i.stock_status==='low' ? '#d97706' : 'var(--success)';
  const statusLabel = i.stock_status==='out' ? 'Out of Stock' : i.stock_status==='low' ? 'Low Stock' : 'In Stock';
  const statusBg    = i.stock_status==='out' ? '#fee2e2' : i.stock_status==='low' ? '#fef3c7' : '#d1fae5';
  const rowBg       = i.stock_status==='out' ? 'background:#fff5f5' : i.stock_status==='low' ? 'background:#fffdf0' : '';
  return `<tr data-sku="${h(i.sku)}" data-cat="${h(i.category||'')}" data-status="${i.stock_status}" data-critical="${i.is_critical?1:0}" style="${rowBg}">
    <td class="card-title-cell">
      <div class="inv-name" style="font-weight:600;font-size:.87rem;color:var(--navy)">${i.is_critical?'<span class="inv-star" title="Critical for you" style="color:var(--amber)">★</span> ':''}${h(i.item_name||i.sku)}</div>
      <div class="u-muted-xs">${h(i.sku)}</div>
    </td>
    <td data-label="Category" style="font-size:.82rem;color:var(--text-muted)">${h(i.category||'—')}</td>
    <td data-label="UOM" style="font-size:.82rem;color:var(--text-muted)">${h(i.uom||'unit')}</td>
    <td data-label="Qty on Hand" style="text-align:right;font-weight:700;font-size:.95rem;color:${i.qty_on_hand===0?'var(--danger)':i.qty_on_hand<=i.reorder_level&&i.reorder_level>0?'var(--warning)':'var(--navy)'}">${Math.round(i.qty_on_hand||0)}</td>
    <td data-label="Reorder Level" style="text-align:right;font-size:.82rem;color:var(--text-muted)">${i.reorder_level>0?Math.round(i.reorder_level):'—'}</td>
    <td data-label="Status"><span style="font-size:.72rem;font-weight:700;padding:3px 8px;border-radius:20px;background:${statusBg};color:${statusColor}">${statusLabel}</span></td>
    <td data-label="Last Received" style="font-size:.78rem;color:var(--text-muted)">${i.last_received_at ? fmtDate(i.last_received_at) : '—'}</td>
    <td data-label="Last Used" style="font-size:.78rem;color:var(--text-muted)">${i.last_consumed_at ? fmtDate(i.last_consumed_at) : '—'}</td>
    <td>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm inv-crit-btn" ${dataActEl('toggleClientCritical', i.sku)} title="${i.is_critical?'Unmark critical':'Mark as critical'}" style="${i.is_critical?'color:#b45309;border-color:#fcd34d;background:var(--warning-bg)':''}">${i.is_critical?'★':'☆'}</button>
        <button class="btn btn-secondary btn-sm" ${dataAct('logConsumptionModal', i.sku, i.item_name||i.sku, i.qty_on_hand||0, i.uom||'unit')}>Log Use</button>
        ${(i.stock_status==='low'||i.stock_status==='out') ? `<button class="btn btn-gold btn-sm" ${dataAct('orderMoreItem', h(i.sku), h(i.item_name||i.sku))}>Order More</button>` : ''}
        <button class="btn btn-secondary btn-sm" ${dataAct('editInvItemModal', i.sku, i.item_name||'', i.reorder_level||0)} title="Edit name / reorder level">✏️</button>
      </div>
    </td>
  </tr>`;
}

function renderConsumptionRows(rows) {
  if (!rows.length) return `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">No consumption recorded in this period.</td></tr>`;
  return rows.map(r => `<tr>
    <td style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${fmtDate(r.consumed_at)}</td>
    <td><div style="font-weight:600;font-size:.85rem">${h(r.item_name)}</div><div class="u-muted-xs">${h(r.sku)}</div></td>
    <td style="text-align:right;font-weight:700">${Math.round(r.qty)}</td>
    <td style="font-size:.8rem;color:var(--text-muted)">${r.notes ? h(r.notes) : '—'}</td>
    <td style="font-size:.8rem;color:var(--text-muted)">${h(r.recorded_by||'—')}</td>
  </tr>`).join('');
}

function switchMyInvTab(tab) {
  ['stock','consumption'].forEach(t => {
    document.getElementById(`inv-panel-${t}`).style.display = t===tab ? '' : 'none';
    const btn = document.getElementById(`inv-tab-${t}`);
    btn.style.borderBottom = t===tab ? '2px solid var(--primary)' : '2px solid transparent';
    btn.style.color = t===tab ? 'var(--primary)' : 'var(--text-muted)';
  });
}

function filterMyInventoryTable() {
  const q      = (document.getElementById('inv-search')?.value||'').toLowerCase();
  const status = document.getElementById('inv-filter-status')?.value || '';
  const cat    = document.getElementById('inv-filter-cat')?.value || '';
  document.querySelectorAll('#my-inv-tbody tr[data-sku]').forEach(row => {
    const text   = row.textContent.toLowerCase();
    const rowCat = row.dataset.cat || '';
    const rowSt  = row.dataset.status || '';
    const rowCrit= row.dataset.critical === '1';
    const statusMatch = !status ? true : status === 'critical' ? rowCrit : rowSt === status;
    const show   = (!q || text.includes(q)) && statusMatch && (!cat || rowCat===cat);
    row.style.display = show ? '' : 'none';
  });
}

// Mark / unmark an item as critical for this client (tracked for availability)
async function toggleClientCritical(sku, btn) {
  const row = btn.closest('tr');
  const next = !(row?.dataset.critical === '1');
  btn.disabled = true;
  const res = await api('/client-inventory/' + encodeURIComponent(sku), { method:'PATCH', body: JSON.stringify({ is_critical: next ? 1 : 0 }) });
  btn.disabled = false;
  if (!res) return; // api() already surfaced the error
  if (row) {
    row.dataset.critical = next ? '1' : '0';
    btn.textContent = next ? '★' : '☆';
    btn.title = next ? 'Unmark critical' : 'Mark as critical';
    btn.style.cssText = next ? 'color:#b45309;border-color:#fcd34d;background:var(--warning-bg)' : '';
    const nameEl = row.querySelector('.inv-name');
    if (nameEl) {
      const nm = nameEl.textContent.replace(/^★\s*/, '');
      nameEl.innerHTML = (next ? '<span class="inv-star" title="Critical for you" style="color:var(--amber)">★</span> ' : '') + h(nm);
    }
  }
  const it = (APP._clientInvItems||[]).find(x => x.sku === sku);
  if (it) it.is_critical = next ? 1 : 0;
  updateCriticalKpi();
  // if currently filtering by critical, hide de-selected rows
  if (document.getElementById('inv-filter-status')?.value) filterMyInventoryTable();
  showToast(next ? 'Marked as critical' : 'Removed from critical');
}

function updateCriticalKpi() {
  const items = APP._clientInvItems || [];
  const crit  = items.filter(i => i.is_critical);
  const need  = crit.filter(i => i.stock_status === 'low' || i.stock_status === 'out').length;
  const v = document.getElementById('inv-kpi-critical'); if (v) v.textContent = crit.length;
  const s = document.getElementById('inv-kpi-critical-sub');
  if (s) { s.textContent = need ? `${need} need restock` : 'tracked for availability'; s.style.color = need ? 'var(--danger)' : 'var(--text-muted)'; }
}

// Shared: add a list of inventory items to the cart, each with a suggested qty
// that clears its reorder gap (min 1). Resolves prices from the catalogue once.
async function bulkAddToCart(items) {
  if (!items || !items.length) return 0;
  const cat = await api('/inventory');
  const bySku = {}; (Array.isArray(cat) ? cat : []).forEach(c => { bySku[c.sku] = c; });
  items.forEach(i => {
    const c = bySku[i.sku];
    const price = c?.unit_price || c?.client_price || i.unit_price || 0;
    const qty = i.reorder_level > 0 ? Math.max(Math.round(i.reorder_level - (i.qty_on_hand||0)), 1) : 1;
    const existing = APP.cart.find(x => x.sku === i.sku);
    if (existing) existing.qty += qty;
    else APP.cart.push({ sku: i.sku, name: i.item_name || c?.name || i.sku, qty, unit_price: price, emoji: c?.emoji || '📦' });
  });
  return items.length;
}

// My Inventory: add every low & out-of-stock item to the cart, then jump to review
async function orderAllLowStock() {
  const items = (APP._clientInvItems || []).filter(i => i.stock_status === 'low' || i.stock_status === 'out');
  if (!items.length) { showToast('Nothing is low or out of stock', 'info'); return; }
  const n = await bulkAddToCart(items);
  showToast(`${n} item${n!==1?'s':''} added to your order`);
  APP._postNavStep = 'review';
  navigate('place_order');
}

// Dashboard "Needs attention": add all flagged items at once, then review
async function orderAllAttention() {
  const items = APP._attentionItems || [];
  if (!items.length) { showToast('Nothing needs attention', 'info'); return; }
  const n = await bulkAddToCart(items);
  showToast(`${n} item${n!==1?'s':''} added to your order`);
  APP._postNavStep = 'review';
  navigate('place_order');
}

// Dashboard "Needs attention": add a single item but STAY on the page so the
// user can add several before reviewing.
async function addAttentionItem(sku, name, btn) {
  const items = await api('/inventory?q=' + encodeURIComponent(sku));
  const item = Array.isArray(items) ? items.find(i => i.sku === sku) : null;
  const price = item?.unit_price || item?.client_price || 0;
  const existing = APP.cart.find(c => c.sku === sku);
  if (existing) existing.qty += 1;
  else APP.cart.push({ sku, name: item?.name || name, qty: 1, unit_price: price, emoji: item?.emoji || '📦' });
  if (btn) {
    btn.textContent = '✓ Added — Review';
    btn.className = 'btn btn-secondary btn-sm';
    btn.style.cssText = 'width:100%;background:#dcfce7;color:#15803d;border-color:#86efac';
    btn.onclick = () => { APP._postNavStep = 'review'; navigate('place_order'); };
  }
  const total = APP.cart.reduce((s, i) => s + i.qty, 0);
  showToast(`${item?.name || name} added — ${total} in cart`);
  updateAttnReviewBtn();
}

function updateAttnReviewBtn() {
  const btn = document.getElementById('attn-review-btn'); if (!btn) return;
  const count = (APP.cart || []).reduce((s, i) => s + (i.qty||0), 0);
  btn.style.display = count > 0 ? 'inline-flex' : 'none';
  const c = document.getElementById('attn-review-count'); if (c) c.textContent = count;
}

// Open the log-usage modal for the most relevant item (nudge CTA).
function logFirstItemUse() {
  const items = APP._clientInvItems || [];
  if (!items.length) return;
  const t = items.find(i => i.stock_status === 'low' || i.stock_status === 'out')
    || items.find(i => i.is_critical) || items[0];
  logConsumptionModal(t.sku, t.item_name || t.sku, t.qty_on_hand || 0, t.uom || 'unit');
}

function logConsumptionModal(sku, name, qty, uom) {
  const onHand = Math.round(qty) || 0;
  openModal(`Log Consumption — ${name}`, `
    <div style="margin-bottom:14px">
      <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:4px">Currently in store: <strong>${onHand} ${uom}</strong></div>
    </div>
    <div class="form-group">
      <label class="form-label">Quantity Used <span class="u-danger">*</span></label>
      <input id="cons-qty" type="number" min="1" step="1" max="${onHand}" class="form-control" placeholder="e.g. 5" style="max-width:160px"
        ${dataInput('validateConsQty', onHand)}>
      <div id="cons-qty-warn" style="display:none;font-size:.76rem;color:var(--danger);margin-top:5px"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes (optional)</label>
      <input id="cons-notes" type="text" class="form-control" placeholder="e.g. Used for lunch service">
    </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button id="cons-save-btn" class="btn btn-primary" ${dataAct('submitConsumption', h(sku), onHand)}>Save</button>`);
}

function validateConsQty(onHand) {
  const input = document.getElementById('cons-qty');
  const warn  = document.getElementById('cons-qty-warn');
  const btn   = document.getElementById('cons-save-btn');
  const val   = parseInt(input?.value, 10);
  let msg = '';
  if (input?.value && (isNaN(val) || val <= 0)) msg = 'Enter a quantity of at least 1.';
  else if (val > onHand) msg = `Only ${onHand} in store — you cannot use more than that.`;
  if (warn) { warn.textContent = msg; warn.style.display = msg ? 'block' : 'none'; }
  if (input) input.style.borderColor = msg ? 'var(--danger)' : '';
  if (btn) btn.disabled = !!msg;
  return !msg;
}

async function submitConsumption(sku, onHand) {
  const qty   = parseInt(document.getElementById('cons-qty')?.value, 10);
  const notes = document.getElementById('cons-notes')?.value?.trim();
  if (!qty || qty <= 0) { showToast('Enter a valid quantity', 'error'); return; }
  if (typeof onHand === 'number' && qty > onHand) {
    showToast(`Only ${onHand} in store — cannot log ${qty}`, 'error');
    validateConsQty(onHand);
    return;
  }

  const res = await api('/client-inventory/consume', {method:'POST', body:JSON.stringify({sku, qty, notes})});
  if (res?.ok) {
    showToast(`Consumption logged — ${qty} units`);
    closeModal();
    navigate('my_inventory');
  } else {
    showToast(res?.error || 'Error logging consumption', 'error');
  }
}

function editInvItemModal(sku, currentName, currentLevel) {
  openModal(`Reorder Level — ${currentName||sku}`, `
    <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:14px">
      Flag this item as <b>Low Stock</b> when quantity falls to or below this level.
    </div>
    <div class="form-group">
      <label class="form-label">Reorder Level</label>
      <input id="edit-inv-reorder" type="number" min="0" step="1" class="form-control" value="${currentLevel||0}" style="max-width:160px">
    </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveInvItemEdit', h(sku))}>Save</button>`);
}

async function saveInvItemEdit(sku) {
  const level = parseFloat(document.getElementById('edit-inv-reorder')?.value);
  if (isNaN(level) || level < 0) { showToast('Enter a valid reorder level', 'error'); return; }
  const res = await api(`/client-inventory/${encodeURIComponent(sku)}`, {method:'PATCH', body:JSON.stringify({reorder_level: level})});
  if (res?.ok) { showToast('Reorder level saved'); closeModal(); navigate('my_inventory'); }
  else showToast(res?.error || 'Error saving', 'error');
}

async function syncClientInventory(btn) {
  const orig = btn.textContent;
  btn.textContent = 'Syncing…'; btn.disabled = true;
  const res = await api('/client-inventory/sync', {method:'POST'});
  btn.textContent = orig; btn.disabled = false;
  if (res?.ok) { showToast('Inventory synced from deliveries'); navigate('my_inventory'); }
  else showToast(res?.error || 'Sync failed', 'error');
}

async function reloadConsumptionLog() {
  const from = document.getElementById('inv-cons-from')?.value;
  const to   = document.getElementById('inv-cons-to')?.value;
  const tbody = document.getElementById('cons-log-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Loading…</td></tr>`;
  const rows = await api(`/client-inventory/consumption?from=${from}&to=${to}`).catch(()=>[]);
  tbody.innerHTML = renderConsumptionRows(rows||[]);
}
