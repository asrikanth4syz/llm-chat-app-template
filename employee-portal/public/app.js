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

// FR-02 Attendance strings (kn/hi initial, review before go-live).
Object.assign(DICT.en, {
  navAttendance: "Attendance", month: "Month", present: "Present", absent: "Absent",
  weekoff: "Week-off", holiday: "Holiday", leaveWord: "Leave", workHours: "Work",
  exceptionsWord: "Exceptions", colDate: "Date", colIn: "In", colOut: "Out",
  colWork: "Work", colStatus: "Status", requestCorrection: "Request correction",
  correctionType: "Type", t_regularisation: "Regularisation", t_on_duty: "On-duty",
  t_client_visit: "Client visit", t_wfh: "Work from home", requestedIn: "In (HH:MM)",
  requestedOut: "Out (HH:MM)", myCorrections: "My corrections",
  correctionApprovals: "Correction approvals", noAttendance: "No attendance for this month.",
  correctionSubmitted: "Correction request submitted.", ex_missing_out: "missing out",
  ex_missing_in: "missing in", ex_absent: "absent", ex_short_hours: "short hours",
});
Object.assign(DICT.kn, {
  navAttendance: "ಹಾಜರಾತಿ", month: "ತಿಂಗಳು", present: "ಹಾಜರ್", absent: "ಗೈರು",
  weekoff: "ವಾರದ ರಜೆ", holiday: "ರಜಾದಿನ", leaveWord: "ರಜೆ", workHours: "ಕೆಲಸ",
  exceptionsWord: "ಸಮಸ್ಯೆಗಳು", colDate: "ದಿನಾಂಕ", colIn: "ಒಳಗೆ", colOut: "ಹೊರಗೆ",
  colWork: "ಕೆಲಸ", colStatus: "ಸ್ಥಿತಿ", requestCorrection: "ತಿದ್ದುಪಡಿ ವಿನಂತಿ",
  correctionType: "ಪ್ರಕಾರ", t_regularisation: "ಕ್ರಮಬದ್ಧಗೊಳಿಸುವಿಕೆ", t_on_duty: "ಕರ್ತವ್ಯ",
  t_client_visit: "ಗ್ರಾಹಕ ಭೇಟಿ", t_wfh: "ಮನೆಯಿಂದ ಕೆಲಸ", requestedIn: "ಒಳಗೆ (HH:MM)",
  requestedOut: "ಹೊರಗೆ (HH:MM)", myCorrections: "ನನ್ನ ತಿದ್ದುಪಡಿಗಳು",
  correctionApprovals: "ತಿದ್ದುಪಡಿ ಅನುಮೋದನೆಗಳು", noAttendance: "ಈ ತಿಂಗಳ ಹಾಜರಾತಿ ಇಲ್ಲ.",
  correctionSubmitted: "ತಿದ್ದುಪಡಿ ವಿನಂತಿ ಸಲ್ಲಿಸಲಾಗಿದೆ.", ex_missing_out: "ಹೊರಗೆ ಇಲ್ಲ",
  ex_missing_in: "ಒಳಗೆ ಇಲ್ಲ", ex_absent: "ಗೈರು", ex_short_hours: "ಕಡಿಮೆ ಸಮಯ",
});
Object.assign(DICT.hi, {
  navAttendance: "उपस्थिति", month: "माह", present: "उपस्थित", absent: "अनुपस्थित",
  weekoff: "साप्ताहिक अवकाश", holiday: "छुट्टी", leaveWord: "अवकाश", workHours: "कार्य",
  exceptionsWord: "समस्याएँ", colDate: "तिथि", colIn: "इन", colOut: "आउट",
  colWork: "कार्य", colStatus: "स्थिति", requestCorrection: "सुधार अनुरोध",
  correctionType: "प्रकार", t_regularisation: "नियमितीकरण", t_on_duty: "ड्यूटी पर",
  t_client_visit: "क्लाइंट विज़िट", t_wfh: "घर से कार्य", requestedIn: "इन (HH:MM)",
  requestedOut: "आउट (HH:MM)", myCorrections: "मेरे सुधार",
  correctionApprovals: "सुधार अनुमोदन", noAttendance: "इस माह की कोई उपस्थिति नहीं।",
  correctionSubmitted: "सुधार अनुरोध सबमिट किया गया।", ex_missing_out: "आउट नहीं",
  ex_missing_in: "इन नहीं", ex_absent: "अनुपस्थित", ex_short_hours: "कम घंटे",
});

// FR-08 Directory strings.
Object.assign(DICT.en, { navDirectory: "Directory", search: "Search name, role, location", noResults: "No matches.", manager: "Manager" });
Object.assign(DICT.kn, { navDirectory: "ಡೈರೆಕ್ಟರಿ", search: "ಹೆಸರು, ಪಾತ್ರ, ಸ್ಥಳ ಹುಡುಕಿ", noResults: "ಯಾವುದೇ ಹೊಂದಾಣಿಕೆ ಇಲ್ಲ.", manager: "ಮೇಲಧಿಕಾರಿ" });
Object.assign(DICT.hi, { navDirectory: "निर्देशिका", search: "नाम, भूमिका, स्थान खोजें", noResults: "कोई मेल नहीं।", manager: "प्रबंधक" });

// FR-04 Approvals + inline-help strings.
Object.assign(DICT.en, {
  navApprovals: "Approvals", delegation: "Delegation", delegateTo: "Delegate to",
  delegate: "Add delegate", delegationCreated: "Delegation added.", revoke: "Revoke",
  active: "active", inactive: "inactive", kind_leave: "Leave", kind_attendance: "Attendance",
  kind_profile: "Profile",
  sensitive_help: "Bank, PAN and Aadhaar are hidden by default. Reveal shows the full value and is logged.",
  leaveBalances_help: "Balance changes only after approval. Pending requests are held against it.",
  attendance_help: "Punches come from the biometric system. Flags mark missing punches, absences and short hours.",
  directory_help: "Non-confidential contact and role info only — salary and identity are never shown.",
  approvals_help: "Requests awaiting your decision across leave, attendance and profile — including any delegated to you.",
  delegation_help: "Let a colleague approve your team's requests while you're away, for a date range.",
});
Object.assign(DICT.kn, {
  navApprovals: "ಅನುಮೋದನೆಗಳು", delegation: "ನಿಯೋಜನೆ", delegateTo: "ಗೆ ನಿಯೋಜಿಸಿ",
  delegate: "ನಿಯೋಜಿತರನ್ನು ಸೇರಿಸಿ", delegationCreated: "ನಿಯೋಜನೆ ಸೇರಿಸಲಾಗಿದೆ.", revoke: "ಹಿಂಪಡೆ",
  active: "ಸಕ್ರಿಯ", inactive: "ನಿಷ್ಕ್ರಿಯ", kind_leave: "ರಜೆ", kind_attendance: "ಹಾಜರಾತಿ",
  kind_profile: "ಪ್ರೊಫೈಲ್",
  sensitive_help: "ಬ್ಯಾಂಕ್, ಪ್ಯಾನ್, ಆಧಾರ್ ಪೂರ್ವನಿಯೋಜಿತವಾಗಿ ಮರೆಮಾಡಲಾಗಿದೆ. ತೋರಿಸಿದರೆ ದಾಖಲಿಸಲಾಗುತ್ತದೆ.",
  leaveBalances_help: "ಅನುಮೋದನೆಯ ನಂತರ ಮಾತ್ರ ಬಾಕಿ ಬದಲಾಗುತ್ತದೆ.",
  attendance_help: "ಪಂಚ್‌ಗಳು ಬಯೋಮೆಟ್ರಿಕ್ ವ್ಯವಸ್ಥೆಯಿಂದ ಬರುತ್ತವೆ. ಗುರುತುಗಳು ಸಮಸ್ಯೆಗಳನ್ನು ತೋರಿಸುತ್ತವೆ.",
  directory_help: "ಗೌಪ್ಯವಲ್ಲದ ಮಾಹಿತಿ ಮಾತ್ರ — ಸಂಬಳ/ಗುರುತು ತೋರಿಸುವುದಿಲ್ಲ.",
  approvals_help: "ನಿಮ್ಮ ನಿರ್ಧಾರಕ್ಕೆ ಕಾಯುತ್ತಿರುವ ವಿನಂತಿಗಳು — ನಿಯೋಜಿತವಾದವೂ ಸೇರಿ.",
  delegation_help: "ನೀವು ಇಲ್ಲದಿದ್ದಾಗ ಸಹೋದ್ಯೋಗಿ ನಿಮ್ಮ ತಂಡದ ವಿನಂತಿಗಳನ್ನು ಅನುಮೋದಿಸಬಹುದು.",
});
Object.assign(DICT.hi, {
  navApprovals: "अनुमोदन", delegation: "प्रतिनिधिमंडल", delegateTo: "को सौंपें",
  delegate: "प्रतिनिधि जोड़ें", delegationCreated: "प्रतिनिधि जोड़ा गया।", revoke: "रद्द करें",
  active: "सक्रिय", inactive: "निष्क्रिय", kind_leave: "अवकाश", kind_attendance: "उपस्थिति",
  kind_profile: "प्रोफ़ाइल",
  sensitive_help: "बैंक, पैन, आधार डिफ़ॉल्ट रूप से छिपे हैं। दिखाने पर लॉग होता है।",
  leaveBalances_help: "शेष केवल अनुमोदन के बाद बदलता है।",
  attendance_help: "पंच बायोमेट्रिक सिस्टम से आते हैं। ध्वज समस्याएँ दर्शाते हैं।",
  directory_help: "केवल गैर-गोपनीय जानकारी — वेतन/पहचान नहीं दिखाई जाती।",
  approvals_help: "आपके निर्णय की प्रतीक्षा में अनुरोध — सौंपे गए सहित।",
  delegation_help: "आपकी अनुपस्थिति में सहकर्मी आपकी टीम के अनुरोध अनुमोदित कर सकते हैं।",
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
  attMonth: null,
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

// ---- app shell (HRMS-style: sidebar + topbar) ----------------------------------
const VIEWS = [
  { id: "profile", icon: "user", titleKey: "myProfile" },
  { id: "leave", icon: "calendar", titleKey: "navLeave" },
  { id: "attendance", icon: "clock", titleKey: "navAttendance" },
  { id: "directory", icon: "users", titleKey: "navDirectory" },
  { id: "approvals", icon: "check", titleKey: "navApprovals" },
];
const ICONS = {
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  check: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
};
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" })) svg.setAttribute(k, v);
  try { svg.innerHTML = ICONS[name] || ""; } catch { /* older engines: label still shows */ }
  return svg;
}
function help(tip) { return el("span", { class: "help", title: tip, "data-tip": tip, tabindex: "0", "aria-label": tip }, ["?"]); }
function h2help(text, tip) { return el("h2", {}, [text, help(tip)]); }
function initials(s) { return (s || "?").trim().split(/\s+/).map((w) => w[0] || "").slice(0, 2).join("").toUpperCase(); }

function sidebar() {
  const items = VIEWS.map((v) => el("button", { class: `navitem${state.view === v.id ? " active" : ""}`, onclick: () => switchView(v.id) }, [icon(v.icon), el("span", { text: t(v.titleKey) })]));
  return el("nav", { class: "sidebar", id: "sidebar" }, [
    el("div", { class: "brand" }, [el("div", { class: "logo", text: "4S" }), el("div", {}, [document.createTextNode("4SYZ"), el("small", { text: t("appTitle") })])]),
    ...items,
    el("div", { class: "spacer" }),
    el("div", { class: "side-foot" }, [langSelect(), el("button", { class: "sm", text: t("logout"), onclick: doLogout })]),
  ]);
}

async function renderApp() {
  clear(app());
  const content = el("div", { class: "content", id: "body" });
  const main = el("div", { class: "main" }, [
    el("div", { class: "topbar" }, [
      el("h1", { id: "pagetitle", text: "" }),
      el("div", { class: "userchip" }, [el("span", { text: state.role || "" }), el("div", { class: "avatar", text: initials(state.role) })]),
    ]),
    el("div", { id: "flash" }),
    content,
  ]);
  app().appendChild(el("div", { class: "shell" }, [sidebar(), main]));
  await switchView(state.view || "profile");
}

async function switchView(view) {
  state.view = view;
  const sb = document.getElementById("sidebar");
  if (sb && sb.parentNode) sb.parentNode.replaceChild(sidebar(), sb);
  const v = VIEWS.find((x) => x.id === view);
  const titleEl = document.getElementById("pagetitle");
  if (titleEl && v) titleEl.textContent = t(v.titleKey);
  flash("", "");
  if (view === "leave") await loadLeaveView();
  else if (view === "attendance") await loadAttendanceView();
  else if (view === "directory") await loadDirectoryView();
  else if (view === "approvals") await loadApprovalsView();
  else await loadProfile();
}

function doLogout() {
  state.token = null; state.role = null; state.emp = null; state.revealed = {};
  ss.del("ep_token"); ss.del("ep_role");
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
  const sens = el("div", { class: "card" }, [ h2help(t("sensitiveInfo"), t("sensitive_help")) ]);
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
  clear(card); card.appendChild(h2help(t("leaveBalances"), t("leaveBalances_help")));
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

// ---- FR-02 Attendance ----------------------------------------------------------
const ST_WORD = { P: "present", A: "absent", WO: "weekoff", HL: "holiday", LV: "leaveWord" };
function statusWord(code) { return ST_WORD[code] ? t(ST_WORD[code]) : (code || "—"); }
function minToHHMM(m) { m = Math.max(0, Math.round(m || 0)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; }

async function loadAttendanceView() {
  const body = document.getElementById("body");
  clear(body);
  const monthInput = el("input", { type: "month", value: state.attMonth || new Date().toISOString().slice(0, 7), style: "width:auto" });
  monthInput.addEventListener("change", () => { state.attMonth = monthInput.value; loadAttendanceMonth(); });
  state.attMonth = monthInput.value;
  body.appendChild(el("div", { class: "card" }, [
    h2help(t("navAttendance"), t("attendance_help")),
    el("div", { class: "actions" }, [el("label", { text: t("month"), style: "margin:0" }), monthInput]),
    el("div", { id: "att_summary", class: "muted", style: "margin-top:8px;font-size:13px" }),
  ]));
  body.appendChild(el("div", { class: "card", id: "att_table" }, [el("div", { class: "muted", text: "…" })]));
  body.appendChild(el("div", { class: "card", id: "att_corr_form" }, [el("h2", { text: t("requestCorrection") })]));
  body.appendChild(el("div", { class: "card", id: "att_mycorr" }, [el("h2", { text: t("myCorrections") }), el("div", { class: "muted", text: "…" })]));
  if (canApproveLeave()) body.appendChild(el("div", { class: "card", id: "att_queue" }, [el("h2", { text: t("correctionApprovals") }), el("div", { class: "muted", text: "…" })]));
  await loadAttendanceMonth();
  renderCorrectionForm();
  loadMyCorrections();
  if (canApproveLeave()) loadAttCorrQueue();
}

async function loadAttendanceMonth() {
  const sumEl = document.getElementById("att_summary");
  const tableEl = document.getElementById("att_table");
  if (!tableEl) return;
  try {
    const data = await api(`/api/attendance?month=${encodeURIComponent(state.attMonth)}`);
    const s = data.summary;
    if (sumEl && s) sumEl.textContent = `${t("present")}: ${s.present} · ${t("absent")}: ${s.absent} · ${t("leaveWord")}: ${s.leave} · ${t("weekoff")}: ${s.weekoff} · ${t("holiday")}: ${s.holiday} · ${t("workHours")}: ${minToHHMM(s.workMinutes)} · ${t("exceptionsWord")}: ${s.exceptionDays}`;
    clear(tableEl);
    if (!data.days || !data.days.length) { tableEl.appendChild(el("div", { class: "muted", text: t("noAttendance") })); return; }
    for (const d of data.days) {
      const flags = (d.exceptions || []).map((x) => el("span", { class: "pill pending", style: "margin-right:4px", text: t("ex_" + x) }));
      tableEl.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k" }, [el("div", { text: d.date.slice(8) }), el("div", { class: "muted", style: "font-size:11px", text: d.date })]),
        el("div", { class: "v" }, [
          el("div", { text: `${d.in || "--:--"} → ${d.out || "--:--"} · ${minToHHMM(d.workMinutes)} · ${statusWord(d.status)}` }),
          flags.length ? el("div", { style: "margin-top:4px" }, flags) : null,
          el("div", { style: "margin-top:4px" }, [el("button", { class: "sm", text: t("requestCorrection"), onclick: () => prefillCorrection(d.date, d.in, d.out) })]),
        ]),
      ]));
    }
  } catch (ex) { flash("err", ex.message); }
}

function renderCorrectionForm() {
  const card = document.getElementById("att_corr_form");
  if (!card) return;
  clear(card); card.appendChild(el("h2", { text: t("requestCorrection") }));
  const date = el("input", { type: "date", id: "cf_date" });
  const type = el("select", { id: "cf_type" });
  for (const [v, k] of [["regularisation", "t_regularisation"], ["on_duty", "t_on_duty"], ["client_visit", "t_client_visit"], ["wfh", "t_wfh"]]) type.appendChild(el("option", { value: v, text: t(k) }));
  const inp = el("input", { id: "cf_in", placeholder: t("requestedIn") });
  const outp = el("input", { id: "cf_out", placeholder: t("requestedOut") });
  const reason = el("input", { id: "cf_reason", placeholder: t("reasonOptional") });
  const btn = el("button", { class: "primary", text: t("submit") });
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await api("/api/attendance/corrections", { method: "POST", body: { date: date.value, type: type.value, requestedIn: inp.value || undefined, requestedOut: outp.value || undefined, reason: reason.value || undefined } });
      flash("ok", t("correctionSubmitted"));
      date.value = ""; inp.value = ""; outp.value = ""; reason.value = "";
      loadMyCorrections();
    } catch (ex) { flash("err", ex.message); }
    finally { btn.disabled = false; }
  });
  card.appendChild(el("div", { class: "stack" }, [
    el("label", { text: t("colDate") }), date,
    el("label", { text: t("correctionType") }), type,
    el("label", { text: t("requestedIn") }), inp,
    el("label", { text: t("requestedOut") }), outp,
    el("label", { text: t("reasonOptional") }), reason,
    el("div", { class: "actions", style: "margin-top:10px" }, [btn]),
  ]));
}

function prefillCorrection(date, inVal, outVal) {
  const d = document.getElementById("cf_date"); if (d) d.value = date;
  const i = document.getElementById("cf_in"); if (i && inVal && inVal !== "--:--") i.value = inVal;
  const o = document.getElementById("cf_out"); if (o && outVal && outVal !== "--:--") o.value = outVal;
  const card = document.getElementById("att_corr_form"); if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function loadMyCorrections() {
  const card = document.getElementById("att_mycorr");
  if (!card) return;
  try {
    const { corrections } = await api("/api/attendance/corrections");
    clear(card); card.appendChild(el("h2", { text: t("myCorrections") }));
    if (!corrections.length) { card.appendChild(el("div", { class: "muted", text: t("none") })); return; }
    for (const c of corrections) {
      card.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k" }, [el("div", { text: c.date }), el("div", { class: "muted", style: "font-size:12px", text: t("t_" + c.type) })]),
        el("div", { class: "v" }, [el("div", { class: "actions" }, [statusPill(c.status), el("span", { class: "muted", style: "font-size:12px", text: `${c.requested_in || "--:--"} → ${c.requested_out || "--:--"}` })])]),
      ]));
    }
  } catch (ex) { flash("err", ex.message); }
}

async function loadAttCorrQueue() {
  const card = document.getElementById("att_queue");
  if (!card) return;
  try {
    const { corrections } = await api("/api/attendance/corrections/approvals");
    clear(card); card.appendChild(el("h2", { text: t("correctionApprovals") }));
    if (!corrections.length) { card.appendChild(el("div", { class: "muted", text: t("noPending") })); return; }
    for (const c of corrections) {
      const comment = el("input", { placeholder: t("comment") });
      const decide = async (verb) => {
        try { await api(`/api/attendance/corrections/${encodeURIComponent(c.id)}/${verb}`, { method: "POST", body: { comment: comment.value || undefined } }); loadAttCorrQueue(); }
        catch (ex) { flash("err", ex.message); }
      };
      card.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k" }, [el("div", { text: c.employee_name || c.employee_id }), el("div", { class: "muted", style: "font-size:12px", text: `${c.date} · ${t("t_" + c.type)}` })]),
        el("div", { class: "v stack" }, [
          el("div", { class: "muted", style: "font-size:12px", text: `${c.requested_in || "--:--"} → ${c.requested_out || "--:--"}${c.reason ? " · " + c.reason : ""}` }),
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

// ---- FR-08 Directory -----------------------------------------------------------
async function loadDirectoryView() {
  const body = document.getElementById("body"); clear(body);
  const box = el("input", { type: "search", placeholder: t("search"), id: "dir_q" });
  let timer;
  box.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => loadDirectory(box.value), 250); });
  body.appendChild(el("div", { class: "card" }, [h2help(t("navDirectory"), t("directory_help")), box]));
  body.appendChild(el("div", { class: "card", id: "dir_list" }, [el("div", { class: "muted", text: "…" })]));
  await loadDirectory("");
}

async function loadDirectory(q) {
  const card = document.getElementById("dir_list"); if (!card) return;
  try {
    const { entries } = await api(`/api/directory?q=${encodeURIComponent(q || "")}`);
    clear(card);
    if (!entries.length) { card.appendChild(el("div", { class: "muted", text: t("noResults") })); return; }
    for (const e of entries) {
      card.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k" }, [el("div", { text: e.name, style: "font-weight:600" }), el("div", { class: "muted", style: "font-size:12px", text: e.designation || "" })]),
        el("div", { class: "v" }, [
          el("div", { class: "muted", style: "font-size:13px", text: [e.location, t(e.segment)].filter(Boolean).join(" · ") }),
          e.workEmail ? el("div", { style: "font-size:13px", text: e.workEmail }) : null,
          e.managerName ? el("div", { class: "muted", style: "font-size:12px", text: `${t("manager")}: ${e.managerName}` }) : null,
        ]),
      ]));
    }
  } catch (ex) { flash("err", ex.message); }
}

// ---- FR-04 Approvals (unified inbox + delegation) ------------------------------
async function loadApprovalsView() {
  const body = document.getElementById("body"); clear(body);
  body.appendChild(el("div", { class: "card", id: "ap_inbox" }, [h2help(t("navApprovals"), t("approvals_help")), el("div", { class: "muted", text: "…" })]));
  body.appendChild(el("div", { class: "card", id: "ap_deleg" }, [h2help(t("delegation"), t("delegation_help")), el("div", { class: "muted", text: "…" })]));
  await loadApprovalsInbox();
  loadDelegations();
}

async function loadApprovalsInbox() {
  const card = document.getElementById("ap_inbox"); if (!card) return;
  try {
    const { approvals } = await api("/api/approvals");
    clear(card); card.appendChild(h2help(t("navApprovals"), t("approvals_help")));
    if (!approvals.length) { card.appendChild(el("div", { class: "muted", text: t("noPending") })); return; }
    for (const a of approvals) {
      const comment = el("input", { placeholder: t("comment") });
      const decide = async (verb) => {
        try { await api(`${a.decideBase}/${verb}`, { method: "POST", body: { comment: comment.value || undefined } }); loadApprovalsInbox(); }
        catch (ex) { flash("err", ex.message); }
      };
      card.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k" }, [
          el("div", { class: "actions" }, [el("span", { class: "pill", text: t("kind_" + a.kind) }), el("span", { style: "font-weight:600", text: a.employeeName || "" })]),
          el("div", { class: "muted", style: "font-size:12px", text: a.title }),
        ]),
        el("div", { class: "v stack" }, [
          el("div", { class: "muted", style: "font-size:12px", text: a.detail }),
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

async function loadDelegations() {
  const card = document.getElementById("ap_deleg"); if (!card) return;
  try {
    const data = await api("/api/approvals/delegations");
    clear(card); card.appendChild(h2help(t("delegation"), t("delegation_help")));

    // Only approvers can delegate their own authority; offer a create form to them.
    if (canApproveLeave()) {
      let dir = { entries: [] };
      try { dir = await api("/api/directory"); } catch { /* keep empty */ }
      const sel = el("select", {});
      sel.appendChild(el("option", { value: "", text: "—" }));
      for (const e of dir.entries) sel.appendChild(el("option", { value: e.id, text: `${e.name}${e.designation ? " (" + e.designation + ")" : ""}` }));
      const start = el("input", { type: "date" });
      const end = el("input", { type: "date" });
      const btn = el("button", { class: "primary sm", text: t("delegate") });
      btn.addEventListener("click", async () => {
        if (!sel.value) return;
        btn.disabled = true;
        try { await api("/api/approvals/delegations", { method: "POST", body: { delegateEmployeeId: sel.value, startsOn: start.value || undefined, endsOn: end.value || undefined } }); flash("ok", t("delegationCreated")); loadDelegations(); }
        catch (ex) { flash("err", ex.message); } finally { btn.disabled = false; }
      });
      card.appendChild(el("div", { class: "stack" }, [
        el("label", { text: t("delegateTo") }), sel,
        el("label", { text: t("startDate") }), start,
        el("label", { text: t("endDate") }), end,
        el("div", { class: "actions", style: "margin-top:8px" }, [btn]),
      ]));
    }

    const list = (arr, dirn) => {
      for (const d of (arr || [])) {
        const who = dirn === "out" ? (d.delegate_name || d.delegate_employee_id) : (d.delegator_name || d.delegator_employee_id);
        const cells = [
          el("span", { class: "pill " + (d.active ? "active" : "inactive"), text: d.active ? t("active") : t("inactive") }),
          el("span", { class: "muted", style: "font-size:12px", text: `${d.starts_on || "—"} ${t("to")} ${d.ends_on || "—"}` }),
        ];
        if (dirn === "out" && d.active) {
          const rb = el("button", { class: "sm", text: t("revoke") });
          rb.addEventListener("click", async () => { try { await api(`/api/approvals/delegations/${encodeURIComponent(d.id)}/revoke`, { method: "POST" }); loadDelegations(); } catch (ex) { flash("err", ex.message); } });
          cells.push(rb);
        }
        card.appendChild(el("div", { class: "row" }, [
          el("div", { class: "k" }, [el("div", { text: who }), el("div", { class: "muted", style: "font-size:11px", text: dirn === "out" ? t("delegateTo") : t("manager") })]),
          el("div", { class: "v" }, [el("div", { class: "actions" }, cells)]),
        ]));
      }
    };
    list(data.delegatedOut, "out");
    list(data.delegatedToMe, "in");
    if (!(data.delegatedOut || []).length && !(data.delegatedToMe || []).length && !canApproveLeave()) {
      card.appendChild(el("div", { class: "muted", text: t("none") }));
    }
  } catch (ex) { flash("err", ex.message); }
}

// ---- boot ----------------------------------------------------------------------
if (state.token) renderApp(); else renderLogin();
