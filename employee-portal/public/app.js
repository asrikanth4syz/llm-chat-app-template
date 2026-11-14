// 4SYZ Employee Portal — FR-01 Profile UI (vanilla, no build step).
// Talks to the Worker API: 2FA login, masked profile with reveal-on-click,
// self-service edits, controlled bank/identity change requests, and (for HR /
// super_admin) a verification queue. English / Kannada / Hindi.

// ---- i18n (kn/hi are initial translations; have a native speaker review) --------
const DICT = {
  en: {
    appTitle: "4SYZ Employee Portal", signInTitle: "Sign in",
    email: "Email", password: "Password", otp: "Verification code",
    otpHint: "2FA is required for all users. Dev code: 000000",
    signIn: "Sign in", signingIn: "Signing in…", logout: "Log out",
    myProfile: "My profile", employment: "Employment", name: "Name",
    designation: "Designation", segment: "Segment", location: "Location",
    workEmail: "Work email", contactInfo: "Contact — you can edit these",
    phone: "Phone", personalEmail: "Personal email", address: "Address",
    emergencyContact: "Emergency contact", save: "Save", saving: "Saving…",
    sensitiveInfo: "Identity & financial — masked", pan: "PAN",
    bankAccount: "Bank account", aadhaar: "Aadhaar (last 4)", ctc: "CTC",
    reveal: "Reveal", hide: "Hide", requestChange: "Request change",
    newValueFor: "New value", reasonOptional: "Reason (optional)",
    submit: "Submit", cancel: "Cancel", myRequests: "My change requests",
    noRequests: "No change requests.", requestedAt: "Requested",
    verifyQueue: "Verification queue", approve: "Approve", reject: "Reject",
    noPending: "Nothing pending.", employee: "Employee", none: "—",
    office: "Office", client_site: "Client site",
    changeSubmitted: "Change requested — pending HR verification.",
    directSaved: "Saved.", revealedNote: "Revealed (logged).",
    errorGeneric: "Something went wrong.", pending: "pending",
    approved: "approved", rejected: "rejected",
  },
  kn: {
    appTitle: "4SYZ ಉದ್ಯೋಗಿ ಪೋರ್ಟಲ್", signInTitle: "ಸೈನ್ ಇನ್",
    email: "ಇಮೇಲ್", password: "ಪಾಸ್‌ವರ್ಡ್", otp: "ಪರಿಶೀಲನಾ ಕೋಡ್",
    otpHint: "ಎಲ್ಲಾ ಬಳಕೆದಾರರಿಗೆ 2FA ಅಗತ್ಯ. ಡೆವ್ ಕೋಡ್: 000000",
    signIn: "ಸೈನ್ ಇನ್", signingIn: "ಸೈನ್ ಇನ್ ಆಗುತ್ತಿದೆ…", logout: "ಲಾಗ್ ಔಟ್",
    myProfile: "ನನ್ನ ಪ್ರೊಫೈಲ್", employment: "ಉದ್ಯೋಗ ವಿವರ", name: "ಹೆಸರು",
    designation: "ಹುದ್ದೆ", segment: "ವಿಭಾಗ", location: "ಸ್ಥಳ",
    workEmail: "ಕೆಲಸದ ಇಮೇಲ್", contactInfo: "ಸಂಪರ್ಕ — ನೀವು ಸಂಪಾದಿಸಬಹುದು",
    phone: "ಫೋನ್", personalEmail: "ವೈಯಕ್ತಿಕ ಇಮೇಲ್", address: "ವಿಳಾಸ",
    emergencyContact: "ತುರ್ತು ಸಂಪರ್ಕ", save: "ಉಳಿಸಿ", saving: "ಉಳಿಸಲಾಗುತ್ತಿದೆ…",
    sensitiveInfo: "ಗುರುತು ಮತ್ತು ಹಣಕಾಸು — ಮರೆಮಾಡಲಾಗಿದೆ", pan: "ಪ್ಯಾನ್",
    bankAccount: "ಬ್ಯಾಂಕ್ ಖಾತೆ", aadhaar: "ಆಧಾರ್ (ಕೊನೆಯ 4)", ctc: "ಸಿಟಿಸಿ",
    reveal: "ತೋರಿಸಿ", hide: "ಮರೆಮಾಡಿ", requestChange: "ಬದಲಾವಣೆ ವಿನಂತಿಸಿ",
    newValueFor: "ಹೊಸ ಮೌಲ್ಯ", reasonOptional: "ಕಾರಣ (ಐಚ್ಛಿಕ)",
    submit: "ಸಲ್ಲಿಸಿ", cancel: "ರದ್ದುಮಾಡಿ", myRequests: "ನನ್ನ ಬದಲಾವಣೆ ವಿನಂತಿಗಳು",
    noRequests: "ಯಾವುದೇ ವಿನಂತಿಗಳಿಲ್ಲ.", requestedAt: "ವಿನಂತಿಸಿದ ದಿನಾಂಕ",
    verifyQueue: "ಪರಿಶೀಲನಾ ಸರತಿ", approve: "ಅನುಮೋದಿಸಿ", reject: "ತಿರಸ್ಕರಿಸಿ",
    noPending: "ಬಾಕಿ ಏನೂ ಇಲ್ಲ.", employee: "ಉದ್ಯೋಗಿ", none: "—",
    office: "ಕಚೇರಿ", client_site: "ಕ್ಲೈಂಟ್ ಸೈಟ್",
    changeSubmitted: "ಬದಲಾವಣೆ ವಿನಂತಿಸಲಾಗಿದೆ — HR ಪರಿಶೀಲನೆ ಬಾಕಿ.",
    directSaved: "ಉಳಿಸಲಾಗಿದೆ.", revealedNote: "ತೋರಿಸಲಾಗಿದೆ (ದಾಖಲಿಸಲಾಗಿದೆ).",
    errorGeneric: "ಏನೋ ತಪ್ಪಾಗಿದೆ.", pending: "ಬಾಕಿ",
    approved: "ಅನುಮೋದಿತ", rejected: "ತಿರಸ್ಕೃತ",
  },
  hi: {
    appTitle: "4SYZ कर्मचारी पोर्टल", signInTitle: "साइन इन",
    email: "ईमेल", password: "पासवर्ड", otp: "सत्यापन कोड",
    otpHint: "सभी उपयोगकर्ताओं के लिए 2FA आवश्यक है। डेव कोड: 000000",
    signIn: "साइन इन", signingIn: "साइन इन हो रहा है…", logout: "लॉग आउट",
    myProfile: "मेरी प्रोफ़ाइल", employment: "रोज़गार विवरण", name: "नाम",
    designation: "पदनाम", segment: "वर्ग", location: "स्थान",
    workEmail: "कार्य ईमेल", contactInfo: "संपर्क — आप इन्हें संपादित कर सकते हैं",
    phone: "फ़ोन", personalEmail: "व्यक्तिगत ईमेल", address: "पता",
    emergencyContact: "आपातकालीन संपर्क", save: "सहेजें", saving: "सहेजा जा रहा है…",
    sensitiveInfo: "पहचान और वित्तीय — छिपाया गया", pan: "पैन",
    bankAccount: "बैंक खाता", aadhaar: "आधार (अंतिम 4)", ctc: "सीटीसी",
    reveal: "दिखाएँ", hide: "छुपाएँ", requestChange: "बदलाव का अनुरोध करें",
    newValueFor: "नया मान", reasonOptional: "कारण (वैकल्पिक)",
    submit: "सबमिट करें", cancel: "रद्द करें", myRequests: "मेरे बदलाव अनुरोध",
    noRequests: "कोई अनुरोध नहीं।", requestedAt: "अनुरोध किया",
    verifyQueue: "सत्यापन कतार", approve: "स्वीकृत करें", reject: "अस्वीकार करें",
    noPending: "कुछ भी लंबित नहीं।", employee: "कर्मचारी", none: "—",
    office: "कार्यालय", client_site: "क्लाइंट साइट",
    changeSubmitted: "बदलाव का अनुरोध किया गया — HR सत्यापन लंबित।",
    directSaved: "सहेजा गया।", revealedNote: "दिखाया गया (लॉग किया गया)।",
    errorGeneric: "कुछ गड़बड़ हो गई।", pending: "लंबित",
    approved: "स्वीकृत", rejected: "अस्वीकृत",
  },
};

// FR-03 Leave strings (merged in; kn/hi initial, review before go-live).
Object.assign(DICT.en, {
  navProfile: "Profile", navLeave: "Leave", leaveBalances: "Leave balances",
  entitled: "Entitled", used: "Used", available: "Available", pendingDays: "Pending",
  applyLeave: "Apply for leave", leaveType: "Leave type", startDate: "Start date",
  endDate: "End date", halfDayLabel: "Half day (single day)", apply: "Apply",
  myLeave: "My leave requests", noLeave: "No leave requests.", daysUnit: "days",
  leaveApprovals: "Leave approvals", comment: "Comment (optional)", cancelled: "cancelled",
  leaveSubmitted: "Leave request submitted.", cancelRequest: "Cancel", to: "to",
});
Object.assign(DICT.kn, {
  navProfile: "ಪ್ರೊಫೈಲ್", navLeave: "ರಜೆ", leaveBalances: "ರಜೆ ಬಾಕಿ",
  entitled: "ಅರ್ಹತೆ", used: "ಬಳಸಿದ", available: "ಲಭ್ಯ", pendingDays: "ಬಾಕಿ",
  applyLeave: "ರಜೆಗೆ ಅರ್ಜಿ", leaveType: "ರಜೆ ಪ್ರಕಾರ", startDate: "ಪ್ರಾರಂಭ ದಿನಾಂಕ",
  endDate: "ಅಂತಿಮ ದಿನಾಂಕ", halfDayLabel: "ಅರ್ಧ ದಿನ (ಒಂದು ದಿನ)", apply: "ಅರ್ಜಿ ಸಲ್ಲಿಸಿ",
  myLeave: "ನನ್ನ ರಜೆ ಅರ್ಜಿಗಳು", noLeave: "ಯಾವುದೇ ರಜೆ ಅರ್ಜಿಗಳಿಲ್ಲ.", daysUnit: "ದಿನಗಳು",
  leaveApprovals: "ರಜೆ ಅನುಮೋದನೆಗಳು", comment: "ಟಿಪ್ಪಣಿ (ಐಚ್ಛಿಕ)", cancelled: "ರದ್ದಾಗಿದೆ",
  leaveSubmitted: "ರಜೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಲಾಗಿದೆ.", cancelRequest: "ರದ್ದುಮಾಡಿ", to: "ರಿಂದ",
});
Object.assign(DICT.hi, {
  navProfile: "प्रोफ़ाइल", navLeave: "अवकाश", leaveBalances: "अवकाश शेष",
  entitled: "हकदार", used: "उपयोग", available: "उपलब्ध", pendingDays: "लंबित",
  applyLeave: "अवकाश के लिए आवेदन", leaveType: "अवकाश प्रकार", startDate: "प्रारंभ तिथि",
  endDate: "समाप्ति तिथि", halfDayLabel: "आधा दिन (एक दिन)", apply: "आवेदन करें",
  myLeave: "मेरे अवकाश अनुरोध", noLeave: "कोई अवकाश अनुरोध नहीं।", daysUnit: "दिन",
  leaveApprovals: "अवकाश अनुमोदन", comment: "टिप्पणी (वैकल्पिक)", cancelled: "रद्द",
  leaveSubmitted: "अवकाश अनुरोध सबमिट किया गया।", cancelRequest: "रद्द करें", to: "से",
});

// ---- state (token in sessionStorage; cleared when the tab closes) --------------
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};
const state = {
  token: ss.get("ep_token"),
  role: ss.get("ep_role"),
  lang: ss.get("ep_lang") || "en",
  view: "profile",
  emp: null,
  revealed: {}, // field -> full value
  leaveBalances: [],
};
const DIRECT = ["phone", "personalEmail", "address", "emergencyContact"];
const SENSITIVE = ["pan", "bankAccount", "aadhaarLast4"];
const SENS_LABEL = { pan: "pan", bankAccount: "bankAccount", aadhaarLast4: "aadhaar" };

function t(k) { return (DICT[state.lang] && DICT[state.lang][k]) || DICT.en[k] || k; }
function canVerify() { return state.role === "hr_admin" || state.role === "super_admin"; }
function canApproveLeave() { return ["manager", "hr_admin", "super_admin"].includes(state.role); }

// ---- tiny DOM helper -----------------------------------------------------------
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return n;
}
const app = () => document.getElementById("app");
function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

// ---- API -----------------------------------------------------------------------
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && state.token) { doLogout(); throw new Error("session expired"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || t("errorGeneric")), { data, status: res.status });
  return data;
}

function flash(kind, text) {
  const host = document.getElementById("flash");
  if (!host) return;
  clear(host);
  if (text) host.appendChild(el("div", { class: `msg ${kind}`, text }));
}

// ---- login ---------------------------------------------------------------------
function renderLogin() {
  clear(app());
  const email = el("input", { type: "email", autocomplete: "username", placeholder: t("email") });
  const pw = el("input", { type: "password", autocomplete: "current-password", placeholder: t("password") });
  const otp = el("input", { type: "text", inputmode: "numeric", autocomplete: "one-time-code", placeholder: t("otp") });
  const err = el("div", { id: "loginerr" });
  const btn = el("button", { class: "primary grow", type: "submit", text: t("signIn") });

  const form = el("form", { class: "card login stack", onsubmit: async (e) => {
    e.preventDefault();
    clear(err); btn.disabled = true; btn.textContent = t("signingIn");
    try {
      const data = await api("/api/auth/login", { method: "POST", body: { email: email.value.trim(), password: pw.value, otp: otp.value.trim() } });
      state.token = data.token; state.role = data.role;
      ss.set("ep_token", data.token); ss.set("ep_role", data.role);
      await renderApp();
    } catch (ex) {
      err.appendChild(el("div", { class: "msg err", text: ex.message || t("errorGeneric") }));
    } finally { btn.disabled = false; btn.textContent = t("signIn"); }
  } }, [
    el("h2", { text: t("signInTitle") }),
    el("label", { text: t("email") }), email,
    el("label", { text: t("password") }), pw,
    el("label", { text: t("otp") }), otp,
    el("div", { class: "muted", style: "font-size:12px", text: t("otpHint") }),
    err,
    el("div", { class: "actions", style: "margin-top:12px" }, [btn, langSelect()]),
  ]);
  app().appendChild(el("div", { class: "center" }, [form]));
}

function langSelect() {
  const sel = el("select", { class: "lang", "aria-label": "Language", onchange: (e) => {
    state.lang = e.target.value; ss.set("ep_lang", state.lang);
    state.token ? renderApp() : renderLogin();
  } });
  for (const [code, name] of [["en", "English"], ["kn", "ಕನ್ನಡ"], ["hi", "हिन्दी"]]) {
    sel.appendChild(el("option", { value: code, text: name, ...(code === state.lang ? { selected: "" } : {}) }));
  }
  return sel;
}

// ---- app shell -----------------------------------------------------------------
async function renderApp() {
  removeBar();
  clear(app());
  // header
  const bar = el("header", { class: "bar" }, [
    el("div", { class: "bar-in" }, [
      el("h1", { text: t("appTitle") }),
      langSelect(),
      el("button", { class: "sm", text: t("logout"), onclick: doLogout }),
    ]),
  ]);
  document.body.insertBefore(bar, app());
  app().appendChild(nav());
  app().appendChild(el("div", { id: "flash" }));
  app().appendChild(el("div", { id: "body" }));
  await switchView(state.view || "profile");
}

function nav() {
  const mk = (view, label) => el("button", { class: `sm${state.view === view ? " primary" : ""}`, text: label, onclick: () => switchView(view) });
  return el("div", { class: "actions", id: "nav", style: "margin-bottom:14px" }, [mk("profile", t("navProfile")), mk("leave", t("navLeave"))]);
}

async function switchView(view) {
  state.view = view;
  const navEl = document.getElementById("nav");
  if (navEl && navEl.parentNode) navEl.parentNode.replaceChild(nav(), navEl);
  flash("", "");
  if (view === "leave") await loadLeaveView();
  else await loadProfile();
}

function removeBar() { const b = document.querySelector("header.bar"); if (b) b.remove(); }

function doLogout() {
  state.token = null; state.role = null; state.emp = null; state.revealed = {};
  ss.del("ep_token"); ss.del("ep_role");
  removeBar();
  renderLogin();
}

// ---- profile -------------------------------------------------------------------
async function loadProfile() {
  try {
    const { employee } = await api("/api/me");
    state.emp = employee;
    renderProfile();
    loadMyRequests();
    if (canVerify()) loadQueue();
  } catch (ex) { flash("err", ex.message); }
}

function row(label, valueNode) {
  return el("div", { class: "row" }, [el("div", { class: "k", text: label }), el("div", { class: "v" }, [valueNode])]);
}

function renderProfile() {
  const body = document.getElementById("body");
  clear(body);
  const e = state.emp;

  // employment (read-only)
  const emp = el("div", { class: "card" }, [ el("h2", { text: t("employment") }) ]);
  emp.appendChild(row(t("name"), el("span", { text: e.name || t("none") })));
  emp.appendChild(row(t("designation"), el("span", { text: e.designation || t("none") })));
  emp.appendChild(row(t("workEmail"), el("span", { text: e.workEmail || t("none") })));
  emp.appendChild(row(t("segment"), el("span", { text: t(e.segment) || e.segment })));
  emp.appendChild(row(t("location"), el("span", { text: e.location || t("none") })));
  if (e.ctc != null) emp.appendChild(row(t("ctc"), el("span", { text: String(e.ctc) })));
  body.appendChild(emp);

  // contact (editable)
  const contact = el("div", { class: "card" }, [ el("h2", { text: t("contactInfo") }) ]);
  for (const f of DIRECT) contact.appendChild(editableRow(f));
  body.appendChild(contact);

  // sensitive (masked + reveal + request change)
  const sens = el("div", { class: "card" }, [ el("h2", { text: t("sensitiveInfo") }) ]);
  for (const f of SENSITIVE) sens.appendChild(sensitiveRow(f));
  body.appendChild(sens);

  // my change requests
  body.appendChild(el("div", { class: "card", id: "myreq" }, [ el("h2", { text: t("myRequests") }), el("div", { class: "muted", text: "…" }) ]));

  // HR verify queue
  if (canVerify()) body.appendChild(el("div", { class: "card", id: "queue" }, [ el("h2", { text: t("verifyQueue") }), el("div", { class: "muted", text: "…" }) ]));
}

function editableRow(field) {
  const labelKey = field;
  const input = el("input", { value: state.emp[field] || "", "aria-label": t(labelKey) });
  const btn = el("button", { class: "sm", text: t("save") });
  btn.addEventListener("click", async () => {
    btn.disabled = true; btn.textContent = t("saving");
    try {
      await api("/api/profile/change", { method: "POST", body: { field, value: input.value } });
      state.emp[field] = input.value;
      flash("ok", t("directSaved"));
    } catch (ex) { flash("err", ex.message); }
    finally { btn.disabled = false; btn.textContent = t("save"); }
  });
  return el("div", { class: "row" }, [
    el("div", { class: "k", text: t(labelKey) }),
    el("div", { class: "v" }, [ el("div", { class: "actions" }, [ el("div", { class: "grow" }, [input]), btn ]) ]),
  ]);
}

function sensitiveRow(field) {
  const labelKey = SENS_LABEL[field];
  const masked = state.emp[field];
  const valSpan = el("span", { class: "mask", text: state.revealed[field] != null ? state.revealed[field] : (masked || t("none")) });
  const actions = el("div", { class: "actions", style: "margin-top:6px" });

  if (masked) {
    const revealed = state.revealed[field] != null;
    const rbtn = el("button", { class: "sm", text: revealed ? t("hide") : t("reveal") });
    rbtn.addEventListener("click", async () => {
      if (state.revealed[field] != null) { delete state.revealed[field]; renderProfile(); return; }
      rbtn.disabled = true;
      try {
        const { employee } = await api(`/api/me?reveal=${encodeURIComponent(field)}`);
        state.revealed[field] = employee[field];
        flash("ok", t("revealedNote"));
        renderProfile();
      } catch (ex) { flash("err", ex.message); rbtn.disabled = false; }
    });
    actions.appendChild(rbtn);
  }
  const cbtn = el("button", { class: "sm", text: t("requestChange"), onclick: () => openChangeForm(field) });
  actions.appendChild(cbtn);

  return el("div", { class: "row" }, [
    el("div", { class: "k", text: t(labelKey) }),
    el("div", { class: "v" }, [ valSpan, actions, el("div", { id: `cf_${field}` }) ]),
  ]);
}

function openChangeForm(field) {
  const host = document.getElementById(`cf_${field}`);
  if (!host) return;
  clear(host);
  const val = el("input", { placeholder: t("newValueFor"), "aria-label": t("newValueFor") });
  const reason = el("input", { placeholder: t("reasonOptional"), "aria-label": t("reasonOptional") });
  const submit = el("button", { class: "primary sm", text: t("submit") });
  const cancel = el("button", { class: "sm", text: t("cancel"), onclick: () => clear(host) });
  submit.addEventListener("click", async () => {
    submit.disabled = true;
    try {
      await api("/api/profile/change", { method: "POST", body: { field, value: val.value, reason: reason.value || undefined } });
      clear(host);
      flash("ok", t("changeSubmitted"));
      loadMyRequests();
    } catch (ex) { flash("err", ex.message); submit.disabled = false; }
  });
  host.appendChild(el("div", { class: "stack", style: "margin-top:8px" }, [ val, reason, el("div", { class: "actions" }, [submit, cancel]) ]));
}

// ---- change requests + verify queue -------------------------------------------
function statusPill(s) { return el("span", { class: `pill ${s}`, text: t(s) || s }); }

async function loadMyRequests() {
  const card = document.getElementById("myreq");
  if (!card) return;
  try {
    const { changes } = await api("/api/profile/changes");
    clear(card); card.appendChild(el("h2", { text: t("myRequests") }));
    if (!changes.length) { card.appendChild(el("div", { class: "muted", text: t("noRequests") })); return; }
    for (const c of changes) {
      card.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k", text: t(SENS_LABEL[c.field] || c.field) || c.field }),
        el("div", { class: "v" }, [ el("div", { class: "actions" }, [
          statusPill(c.status),
          el("span", { class: "muted", style: "font-size:12px", text: `${t("requestedAt")}: ${c.requested_at || ""}` }),
        ]) ]),
      ]));
    }
  } catch (ex) { flash("err", ex.message); }
}

async function loadQueue() {
  const card = document.getElementById("queue");
  if (!card) return;
  try {
    const { pending } = await api("/api/admin/profile/changes");
    clear(card); card.appendChild(el("h2", { text: t("verifyQueue") }));
    if (!pending.length) { card.appendChild(el("div", { class: "muted", text: t("noPending") })); return; }
    for (const p of pending) {
      const act = async (verb) => {
        try { await api(`/api/admin/profile/changes/${encodeURIComponent(p.id)}/${verb}`, { method: "POST" }); loadQueue(); }
        catch (ex) { flash("err", ex.message); }
      };
      card.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k" }, [
          el("div", { text: p.employee_name || p.employee_id }),
          el("div", { class: "muted", style: "font-size:12px", text: t(SENS_LABEL[p.field] || p.field) || p.field }),
        ]),
        el("div", { class: "v" }, [ el("div", { class: "actions" }, [
          el("button", { class: "primary sm", text: t("approve"), onclick: () => act("approve") }),
          el("button", { class: "sm", text: t("reject"), onclick: () => act("reject") }),
        ]) ]),
      ]));
    }
  } catch (ex) { flash("err", ex.message); }
}

// ---- FR-03 Leave ---------------------------------------------------------------
async function loadLeaveView() {
  const body = document.getElementById("body");
  clear(body);
  body.appendChild(el("div", { class: "card", id: "lv_bal" }, [el("h2", { text: t("leaveBalances") }), el("div", { class: "muted", text: "…" })]));
  body.appendChild(el("div", { class: "card", id: "lv_apply" }, [el("h2", { text: t("applyLeave") }), el("div", { class: "muted", text: "…" })]));
  body.appendChild(el("div", { class: "card", id: "lv_mine" }, [el("h2", { text: t("myLeave") }), el("div", { class: "muted", text: "…" })]));
  if (canApproveLeave()) body.appendChild(el("div", { class: "card", id: "lv_queue" }, [el("h2", { text: t("leaveApprovals") }), el("div", { class: "muted", text: "…" })]));
  await loadBalances();
  loadMyLeave();
  if (canApproveLeave()) loadLeaveQueue();
}

async function loadBalances() {
  try {
    const { balances } = await api("/api/leave/balances");
    state.leaveBalances = balances || [];
    renderBalances(); renderApplyForm();
  } catch (ex) { flash("err", ex.message); }
}

function renderBalances() {
  const card = document.getElementById("lv_bal");
  if (!card) return;
  clear(card); card.appendChild(el("h2", { text: t("leaveBalances") }));
  if (!state.leaveBalances.length) { card.appendChild(el("div", { class: "muted", text: t("none") })); return; }
  for (const b of state.leaveBalances) {
    const avail = b.entitled - b.used - (b.pending || 0);
    card.appendChild(el("div", { class: "row" }, [
      el("div", { class: "k", text: `${b.code} — ${b.name}` }),
      el("div", { class: "v" }, [
        el("span", { text: `${t("available")}: ${avail} / ${b.entitled} ${t("daysUnit")}` }),
        el("div", { class: "muted", style: "font-size:12px", text: `${t("used")}: ${b.used} · ${t("pendingDays")}: ${b.pending || 0}` }),
      ]),
    ]));
  }
}

function renderApplyForm() {
  const card = document.getElementById("lv_apply");
  if (!card) return;
  clear(card); card.appendChild(el("h2", { text: t("applyLeave") }));
  const sel = el("select", { "aria-label": t("leaveType") });
  for (const b of state.leaveBalances) sel.appendChild(el("option", { value: b.leave_type_id, text: `${b.code} — ${b.name}` }));
  const start = el("input", { type: "date", "aria-label": t("startDate") });
  const end = el("input", { type: "date", "aria-label": t("endDate") });
  const half = el("input", { type: "checkbox" });
  const halfWrap = el("label", { style: "display:flex;gap:8px;align-items:center;margin:8px 0 0" }, [half, " " + t("halfDayLabel")]);
  const reason = el("input", { placeholder: t("reasonOptional"), "aria-label": t("reasonOptional") });
  const btn = el("button", { class: "primary", text: t("apply") });
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await api("/api/leave/requests", { method: "POST", body: {
        leaveTypeId: sel.value, startDate: start.value, endDate: end.value || start.value,
        halfDay: half.checked, reason: reason.value || undefined,
      } });
      flash("ok", t("leaveSubmitted"));
      start.value = ""; end.value = ""; half.checked = false; reason.value = "";
      loadBalances(); loadMyLeave();
    } catch (ex) { flash("err", ex.message); }
    finally { btn.disabled = false; }
  });
  card.appendChild(el("div", { class: "stack" }, [
    el("label", { text: t("leaveType") }), sel,
    el("label", { text: t("startDate") }), start,
    el("label", { text: t("endDate") }), end,
    halfWrap,
    el("label", { text: t("reasonOptional") }), reason,
    el("div", { class: "actions", style: "margin-top:10px" }, [btn]),
  ]));
}

async function loadMyLeave() {
  const card = document.getElementById("lv_mine");
  if (!card) return;
  try {
    const { requests } = await api("/api/leave/requests");
    clear(card); card.appendChild(el("h2", { text: t("myLeave") }));
    if (!requests.length) { card.appendChild(el("div", { class: "muted", text: t("noLeave") })); return; }
    for (const r of requests) {
      const actions = el("div", { class: "actions" }, [statusPill(r.status)]);
      if (r.status === "pending" || r.status === "approved") {
        const cbtn = el("button", { class: "sm", text: t("cancelRequest") });
        cbtn.addEventListener("click", async () => {
          cbtn.disabled = true;
          try { await api(`/api/leave/requests/${encodeURIComponent(r.id)}/cancel`, { method: "POST" }); loadBalances(); loadMyLeave(); }
          catch (ex) { flash("err", ex.message); cbtn.disabled = false; }
        });
        actions.appendChild(cbtn);
      }
      card.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k" }, [el("div", { text: r.type_code }), el("div", { class: "muted", style: "font-size:12px", text: `${r.start_date} ${t("to")} ${r.end_date}` })]),
        el("div", { class: "v" }, [el("div", { text: `${r.days} ${t("daysUnit")}` }), actions]),
      ]));
    }
  } catch (ex) { flash("err", ex.message); }
}

async function loadLeaveQueue() {
  const card = document.getElementById("lv_queue");
  if (!card) return;
  try {
    const { approvals } = await api("/api/leave/approvals");
    clear(card); card.appendChild(el("h2", { text: t("leaveApprovals") }));
    if (!approvals.length) { card.appendChild(el("div", { class: "muted", text: t("noPending") })); return; }
    for (const a of approvals) {
      const comment = el("input", { placeholder: t("comment"), "aria-label": t("comment") });
      const decide = async (verb) => {
        try { await api(`/api/leave/requests/${encodeURIComponent(a.id)}/${verb}`, { method: "POST", body: { comment: comment.value || undefined } }); loadLeaveQueue(); }
        catch (ex) { flash("err", ex.message); }
      };
      card.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k" }, [el("div", { text: a.employee_name || a.employee_id }), el("div", { class: "muted", style: "font-size:12px", text: `${a.type_code} · ${a.days} ${t("daysUnit")}` })]),
        el("div", { class: "v stack" }, [
          el("div", { class: "muted", style: "font-size:12px", text: `${a.start_date} ${t("to")} ${a.end_date}${a.reason ? " · " + a.reason : ""}` }),
          comment,
          el("div", { class: "actions" }, [
            el("button", { class: "primary sm", text: t("approve"), onclick: () => decide("approve") }),
            el("button", { class: "sm", text: t("reject"), onclick: () => decide("reject") }),
          ]),
        ]),
      ]));
    }
  } catch (ex) { flash("err", ex.message); }
}

// ---- boot ----------------------------------------------------------------------
if (state.token) renderApp(); else renderLogin();
