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

// Profile greeting + photo strings.
Object.assign(DICT.en, { greetMorning: "Good morning", greetAfternoon: "Good afternoon", greetEvening: "Good evening", changePhoto: "Change photo", removePhoto: "Remove photo", saved: "Saved" });
Object.assign(DICT.kn, { greetMorning: "ಶುಭೋದಯ", greetAfternoon: "ಶುಭ ಮಧ್ಯಾಹ್ನ", greetEvening: "ಶುಭ ಸಂಜೆ", changePhoto: "ಫೋಟೋ ಬದಲಿಸಿ", removePhoto: "ಫೋಟೋ ತೆಗೆದುಹಾಕಿ", saved: "ಉಳಿಸಲಾಗಿದೆ" });
Object.assign(DICT.hi, { greetMorning: "शुभ प्रभात", greetAfternoon: "नमस्कार", greetEvening: "शुभ संध्या", changePhoto: "फ़ोटो बदलें", removePhoto: "फ़ोटो हटाएँ", saved: "सहेजा गया" });

// FR-09 Helpdesk + FR-21 POSH strings.
Object.assign(DICT.en, {
  navHelpdesk: "Helpdesk", helpdesk_help: "Raise an HR, IT or general request, or a confidential POSH complaint. Track status, SLA and the conversation.",
  category: "Category", subject: "Subject", description: "Description", submitTicket: "Raise ticket", ticketCreated: "Ticket raised.",
  myTickets: "My tickets", queueTitle: "Assigned to me", noTickets: "No tickets.", open: "Open", overdue: "overdue", send: "Send",
  cat_hr: "HR", cat_it: "IT", cat_general: "General", cat_posh: "POSH (confidential)",
  st_open: "open", st_in_progress: "in progress", st_resolved: "resolved", st_closed: "closed",
  posh_note: "POSH complaints are confidential — only you and the Internal Committee can see them.",
  poshConfig: "POSH Internal Committee", posh_config_help: "Members listed here are the only people who can see and handle POSH complaints.",
  addMember: "Add", remove: "Remove", noCommittee: "No committee members yet.",
});
Object.assign(DICT.kn, {
  navHelpdesk: "ಸಹಾಯಕೇಂದ್ರ", helpdesk_help: "HR, IT ಅಥವಾ ಸಾಮಾನ್ಯ ವಿನಂತಿ, ಅಥವಾ ಗೌಪ್ಯ POSH ದೂರು ಸಲ್ಲಿಸಿ.",
  category: "ವರ್ಗ", subject: "ವಿಷಯ", description: "ವಿವರಣೆ", submitTicket: "ಟಿಕೆಟ್ ಸಲ್ಲಿಸಿ", ticketCreated: "ಟಿಕೆಟ್ ಸಲ್ಲಿಸಲಾಗಿದೆ.",
  myTickets: "ನನ್ನ ಟಿಕೆಟ್‌ಗಳು", queueTitle: "ನನಗೆ ನಿಯೋಜಿಸಲಾಗಿದೆ", noTickets: "ಟಿಕೆಟ್‌ಗಳಿಲ್ಲ.", open: "ತೆರೆ", overdue: "ಮೀರಿದೆ", send: "ಕಳುಹಿಸಿ",
  cat_hr: "HR", cat_it: "IT", cat_general: "ಸಾಮಾನ್ಯ", cat_posh: "POSH (ಗೌಪ್ಯ)",
  st_open: "ತೆರೆದಿದೆ", st_in_progress: "ಪ್ರಗತಿಯಲ್ಲಿ", st_resolved: "ಪರಿಹರಿಸಲಾಗಿದೆ", st_closed: "ಮುಚ್ಚಲಾಗಿದೆ",
  posh_note: "POSH ದೂರುಗಳು ಗೌಪ್ಯ — ನೀವು ಮತ್ತು ಆಂತರಿಕ ಸಮಿತಿ ಮಾತ್ರ ನೋಡಬಹುದು.",
  poshConfig: "POSH ಆಂತರಿಕ ಸಮಿತಿ", posh_config_help: "ಇಲ್ಲಿರುವ ಸದಸ್ಯರು ಮಾತ್ರ POSH ದೂರುಗಳನ್ನು ನೋಡಬಹುದು.",
  addMember: "ಸೇರಿಸಿ", remove: "ತೆಗೆದುಹಾಕಿ", noCommittee: "ಸಮಿತಿ ಸದಸ್ಯರಿಲ್ಲ.",
});
Object.assign(DICT.hi, {
  navHelpdesk: "हेल्पडेस्क", helpdesk_help: "HR, IT या सामान्य अनुरोध, या गोपनीय POSH शिकायत दर्ज करें।",
  category: "श्रेणी", subject: "विषय", description: "विवरण", submitTicket: "टिकट बनाएँ", ticketCreated: "टिकट बनाया गया।",
  myTickets: "मेरे टिकट", queueTitle: "मुझे सौंपे गए", noTickets: "कोई टिकट नहीं।", open: "खोलें", overdue: "विलंबित", send: "भेजें",
  cat_hr: "HR", cat_it: "IT", cat_general: "सामान्य", cat_posh: "POSH (गोपनीय)",
  st_open: "खुला", st_in_progress: "प्रगति में", st_resolved: "हल", st_closed: "बंद",
  posh_note: "POSH शिकायतें गोपनीय हैं — केवल आप और आंतरिक समिति देख सकते हैं।",
  poshConfig: "POSH आंतरिक समिति", posh_config_help: "यहाँ सूचीबद्ध सदस्य ही POSH शिकायतें देख सकते हैं।",
  addMember: "जोड़ें", remove: "हटाएँ", noCommittee: "कोई समिति सदस्य नहीं।",
});

// FR-07 Announcements strings.
Object.assign(DICT.en, {
  navAnnouncements: "Announcements", announcements_help: "Company announcements for you. Ones marked must-acknowledge need your confirmation.",
  newAnnouncement: "New announcement", editAnnouncement: "Edit announcement",
  announcements_publish_help: "Publish to everyone or a segment. Mark policy items must-acknowledge; editing bumps the version so people re-acknowledge.",
  title: "Title", body: "Message", audience: "Audience", aud_all: "Everyone", aud_office: "Office", aud_client_site: "Client site",
  requiresAck: "Requires acknowledgement", publish: "Publish", saveChanges: "Save changes", announcementPublished: "Published.",
  acknowledge: "Acknowledge", acknowledged: "Acknowledged", mustAck: "Action needed", published_label: "Published",
  ackCount: "acks", viewAcks: "Acknowledgements", acksTitle: "Acknowledged by", noAcks: "No acknowledgements yet.",
  retire: "Retire", reactivate: "Reactivate", edit: "Edit", noAnnouncements: "No announcements.",
});
Object.assign(DICT.kn, {
  navAnnouncements: "ಪ್ರಕಟಣೆಗಳು", announcements_help: "ನಿಮಗಾಗಿ ಕಂಪನಿ ಪ್ರಕಟಣೆಗಳು. ಒಪ್ಪಿಗೆ ಅಗತ್ಯವಿರುವವು ದೃಢೀಕರಣ ಬೇಕು.",
  newAnnouncement: "ಹೊಸ ಪ್ರಕಟಣೆ", editAnnouncement: "ಪ್ರಕಟಣೆ ಸಂಪಾದಿಸಿ",
  announcements_publish_help: "ಎಲ್ಲರಿಗೂ ಅಥವಾ ವಿಭಾಗಕ್ಕೆ ಪ್ರಕಟಿಸಿ. ಸಂಪಾದಿಸಿದರೆ ಆವೃತ್ತಿ ಹೆಚ್ಚುತ್ತದೆ, ಮತ್ತೆ ಒಪ್ಪಿಗೆ ಬೇಕು.",
  title: "ಶೀರ್ಷಿಕೆ", body: "ಸಂದೇಶ", audience: "ಪ್ರೇಕ್ಷಕರು", aud_all: "ಎಲ್ಲರೂ", aud_office: "ಕಚೇರಿ", aud_client_site: "ಕ್ಲೈಂಟ್ ಸೈಟ್",
  requiresAck: "ಒಪ್ಪಿಗೆ ಅಗತ್ಯ", publish: "ಪ್ರಕಟಿಸಿ", saveChanges: "ಬದಲಾವಣೆ ಉಳಿಸಿ", announcementPublished: "ಪ್ರಕಟಿಸಲಾಗಿದೆ.",
  acknowledge: "ಒಪ್ಪಿಕೊಳ್ಳಿ", acknowledged: "ಒಪ್ಪಿಕೊಳ್ಳಲಾಗಿದೆ", mustAck: "ಕ್ರಮ ಅಗತ್ಯ", published_label: "ಪ್ರಕಟಿತ",
  ackCount: "ಒಪ್ಪಿಗೆಗಳು", viewAcks: "ಒಪ್ಪಿಗೆಗಳು", acksTitle: "ಒಪ್ಪಿಕೊಂಡವರು", noAcks: "ಇನ್ನೂ ಒಪ್ಪಿಗೆಗಳಿಲ್ಲ.",
  retire: "ಹಿಂಪಡೆ", reactivate: "ಮರುಸಕ್ರಿಯಗೊಳಿಸಿ", edit: "ಸಂಪಾದಿಸಿ", noAnnouncements: "ಪ್ರಕಟಣೆಗಳಿಲ್ಲ.",
});
Object.assign(DICT.hi, {
  navAnnouncements: "घोषणाएँ", announcements_help: "आपके लिए कंपनी घोषणाएँ। स्वीकृति-आवश्यक वाली पुष्टि माँगती हैं।",
  newAnnouncement: "नई घोषणा", editAnnouncement: "घोषणा संपादित करें",
  announcements_publish_help: "सभी या किसी वर्ग को प्रकाशित करें। संपादन संस्करण बढ़ाता है, पुनः स्वीकृति आवश्यक।",
  title: "शीर्षक", body: "संदेश", audience: "दर्शक", aud_all: "सभी", aud_office: "कार्यालय", aud_client_site: "क्लाइंट साइट",
  requiresAck: "स्वीकृति आवश्यक", publish: "प्रकाशित करें", saveChanges: "परिवर्तन सहेजें", announcementPublished: "प्रकाशित।",
  acknowledge: "स्वीकार करें", acknowledged: "स्वीकृत", mustAck: "कार्रवाई आवश्यक", published_label: "प्रकाशित",
  ackCount: "स्वीकृतियाँ", viewAcks: "स्वीकृतियाँ", acksTitle: "स्वीकार करने वाले", noAcks: "अभी तक कोई स्वीकृति नहीं।",
  retire: "वापस लें", reactivate: "पुनः सक्रिय", edit: "संपादित करें", noAnnouncements: "कोई घोषणा नहीं।",
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
function canPublish() { return ["hr_admin", "super_admin"].includes(state.role); }

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
  { id: "announcements", icon: "bell", titleKey: "navAnnouncements" },
  { id: "helpdesk", icon: "help", titleKey: "navHelpdesk" },
  { id: "approvals", icon: "check", titleKey: "navApprovals" },
];
const ICONS = {
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  check: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  help: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
};
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" })) svg.setAttribute(k, v);
  try { svg.innerHTML = ICONS[name] || ""; } catch { /* older engines: label still shows */ }
  return svg;
}
// One styled tooltip only — no native `title` (that showed a second, plain tooltip).
function help(tip) { return el("span", { class: "help", "data-tip": tip, tabindex: "0", role: "img", "aria-label": tip }, ["?"]); }
function h2help(text, tip) { return el("h2", {}, [text, help(tip)]); }
function initials(s) { return (s || "?").trim().split(/\s+/).map((w) => w[0] || "").slice(0, 2).join("").toUpperCase(); }

function avatarNode(emp) { return emp && emp.photo ? el("img", { class: "avatar", src: emp.photo, alt: "" }) : el("div", { class: "avatar", text: initials((emp && emp.name) || state.role) }); }
function avatarBig(emp) { return emp && emp.photo ? el("img", { class: "avatar avatar-lg", src: emp.photo, alt: "" }) : el("div", { class: "avatar avatar-lg", text: initials((emp && emp.name) || state.role) }); }
function userChip() { return [el("span", { text: (state.emp && state.emp.name) || state.role || "" }), avatarNode(state.emp)]; }
function updateChip() { const c = document.getElementById("userchip"); if (c) { clear(c); for (const n of userChip()) c.appendChild(n); } }
function greeting() { const h = new Date().getHours(); return h < 12 ? t("greetMorning") : h < 17 ? t("greetAfternoon") : t("greetEvening"); }

function resizeImage(file, max) {
  max = max || 256;
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d"); if (ctx) ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try { res(c.toDataURL("image/jpeg", 0.85)); } catch (e) { rej(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("invalid image")); };
    img.src = url;
  });
}
function photoControls() {
  const file = el("input", { type: "file", accept: "image/*", style: "display:none" });
  const pick = el("button", { class: "sm", text: t("changePhoto"), onclick: () => file.click() });
  file.addEventListener("change", async () => {
    if (!file.files || !file.files[0]) return;
    try {
      const dataUrl = await resizeImage(file.files[0]);
      await api("/api/profile/photo", { method: "POST", body: { photo: dataUrl } });
      state.emp = (await api("/api/me")).employee;
      flash("ok", t("saved")); renderProfile(); updateChip();
    } catch (ex) { flash("err", ex.message || t("errorGeneric")); }
  });
  const rm = el("button", { class: "sm", text: t("removePhoto"), onclick: async () => {
    try { await api("/api/profile/photo", { method: "POST", body: { photo: null } }); state.emp = (await api("/api/me")).employee; flash("ok", t("saved")); renderProfile(); updateChip(); }
    catch (ex) { flash("err", ex.message); }
  } });
  return el("div", { class: "actions", style: "margin-top:12px" }, [pick, rm, file]);
}

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
  if (state.token && state.emp == null) { try { state.emp = (await api("/api/me")).employee; } catch { /* pure admin (no employee record) or transient */ } }
  const content = el("div", { class: "content", id: "body" });
  const main = el("div", { class: "main" }, [
    el("div", { class: "topbar" }, [
      el("h1", { id: "pagetitle", text: "" }),
      el("div", { class: "userchip", id: "userchip" }, userChip()),
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
  else if (view === "announcements") await loadAnnouncementsView();
  else if (view === "helpdesk") await loadHelpdeskView();
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

  // welcome header: greeting + name + photo
  body.appendChild(el("div", { class: "card" }, [
    el("div", { style: "display:flex;align-items:center;gap:14px" }, [
      avatarBig(e),
      el("div", {}, [
        el("div", { style: "font-size:18px;font-weight:700", text: `${greeting()}, ${e.name} 👋` }),
        el("div", { class: "muted", style: "font-size:13px", text: [e.designation, e.location].filter(Boolean).join(" · ") }),
      ]),
    ]),
    photoControls(),
  ]));

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

// ---- FR-09 Helpdesk + FR-21 POSH -----------------------------------------------
function catLabel(c) { return t("cat_" + c); }
function statusPillT(s) { return el("span", { class: "pill " + (s === "resolved" || s === "closed" ? "approved" : (s === "open" ? "pending" : "")), text: t("st_" + s) }); }

async function loadHelpdeskView() {
  const body = document.getElementById("body"); clear(body);
  const cat = el("select", { id: "hd_cat" });
  for (const c of ["hr", "it", "general", "posh"]) cat.appendChild(el("option", { value: c, text: catLabel(c) }));
  const poshNote = el("div", { class: "muted", style: "font-size:12px;display:none", text: t("posh_note") });
  cat.addEventListener("change", () => { poshNote.style.display = cat.value === "posh" ? "block" : "none"; });
  const subj = el("input", { id: "hd_subj", placeholder: t("subject") });
  const desc = el("input", { id: "hd_desc", placeholder: t("description") });
  const btn = el("button", { class: "primary", text: t("submitTicket") });
  btn.addEventListener("click", async () => {
    if (!subj.value.trim()) return;
    btn.disabled = true;
    try { await api("/api/helpdesk/tickets", { method: "POST", body: { category: cat.value, subject: subj.value, description: desc.value } }); flash("ok", t("ticketCreated")); subj.value = ""; desc.value = ""; loadMyTickets(); }
    catch (ex) { flash("err", ex.message); } finally { btn.disabled = false; }
  });
  body.appendChild(el("div", { class: "card" }, [
    h2help(t("navHelpdesk"), t("helpdesk_help")),
    el("div", { class: "stack" }, [el("label", { text: t("category") }), cat, poshNote, el("label", { text: t("subject") }), subj, el("label", { text: t("description") }), desc, el("div", { class: "actions", style: "margin-top:8px" }, [btn])]),
  ]));
  body.appendChild(el("div", { class: "card", id: "hd_mine" }, [el("h2", { text: t("myTickets") }), el("div", { class: "muted", text: "…" })]));
  body.appendChild(el("div", { class: "card", id: "hd_queue" }, [el("h2", { text: t("queueTitle") }), el("div", { class: "muted", text: "…" })]));
  body.appendChild(el("div", { class: "card", id: "hd_detail", style: "display:none" }));
  if (state.role === "super_admin") body.appendChild(el("div", { class: "card", id: "hd_posh" }, [h2help(t("poshConfig"), t("posh_config_help")), el("div", { class: "muted", text: "…" })]));
  loadMyTickets();
  loadTicketQueue();
  if (state.role === "super_admin") loadPoshConfig();
}

function ticketRow(tk, who) {
  const flags = [statusPillT(tk.status)];
  if (tk.overdue) flags.push(el("span", { class: "pill rejected", text: t("overdue") }));
  flags.push(el("button", { class: "sm", text: t("open"), onclick: () => openTicket(tk.id) }));
  return el("div", { class: "row" }, [
    el("div", { class: "k" }, [el("div", { class: "actions" }, [el("span", { class: "pill", text: catLabel(tk.category) }), who ? el("span", { style: "font-weight:600", text: who }) : null]), el("div", { style: "font-size:14px;margin-top:2px", text: tk.subject })]),
    el("div", { class: "v" }, [el("div", { class: "actions" }, flags)]),
  ]);
}

async function loadMyTickets() {
  const card = document.getElementById("hd_mine"); if (!card) return;
  try {
    const { tickets } = await api("/api/helpdesk/tickets");
    clear(card); card.appendChild(el("h2", { text: t("myTickets") }));
    if (!tickets.length) { card.appendChild(el("div", { class: "muted", text: t("noTickets") })); return; }
    for (const tk of tickets) card.appendChild(ticketRow(tk, null));
  } catch (ex) { flash("err", ex.message); }
}

async function loadTicketQueue() {
  const card = document.getElementById("hd_queue"); if (!card) return;
  try {
    const { tickets } = await api("/api/helpdesk/queue");
    clear(card); card.appendChild(el("h2", { text: t("queueTitle") }));
    if (!tickets.length) { card.appendChild(el("div", { class: "muted", text: t("noPending") })); return; }
    for (const tk of tickets) card.appendChild(ticketRow(tk, tk.employee_name));
  } catch (ex) { flash("err", ex.message); }
}

async function openTicket(id) {
  const card = document.getElementById("hd_detail"); if (!card) return;
  card.style.display = "block"; clear(card); card.appendChild(el("div", { class: "muted", text: "…" }));
  try {
    const { ticket, comments, canHandle } = await api(`/api/helpdesk/tickets/${encodeURIComponent(id)}`);
    clear(card);
    card.appendChild(el("h2", { text: `${catLabel(ticket.category)} · ${ticket.subject}` }));
    card.appendChild(el("div", { class: "row" }, [el("div", { class: "k", text: t("status") }), el("div", { class: "v" }, [el("div", { class: "actions" }, [statusPillT(ticket.status), ticket.overdue ? el("span", { class: "pill rejected", text: t("overdue") }) : null])])]));
    if (ticket.description) card.appendChild(el("div", { class: "row" }, [el("div", { class: "k", text: t("description") }), el("div", { class: "v", text: ticket.description })]));
    const clist = el("div", { class: "stack", style: "margin-top:8px" });
    for (const c of comments) clist.appendChild(el("div", { style: "border-top:1px solid var(--line);padding-top:8px" }, [el("div", { class: "muted", style: "font-size:12px", text: `${c.author_name || c.author_role || ""} · ${c.created_at}` }), el("div", { text: c.body })]));
    card.appendChild(clist);
    const cbox = el("input", { placeholder: t("comment") });
    const cbtn = el("button", { class: "sm", text: t("send") });
    cbtn.addEventListener("click", async () => { if (!cbox.value.trim()) return; cbtn.disabled = true; try { await api(`/api/helpdesk/tickets/${encodeURIComponent(id)}/comment`, { method: "POST", body: { body: cbox.value } }); openTicket(id); } catch (ex) { flash("err", ex.message); cbtn.disabled = false; } });
    card.appendChild(el("div", { class: "actions", style: "margin-top:10px" }, [el("div", { class: "grow" }, [cbox]), cbtn]));
    if (canHandle) {
      const st = el("select", {});
      for (const s of ["open", "in_progress", "resolved", "closed"]) st.appendChild(el("option", { value: s, text: t("st_" + s), ...(s === ticket.status ? { selected: "" } : {}) }));
      const sbtn = el("button", { class: "primary sm", text: t("save") });
      sbtn.addEventListener("click", async () => { sbtn.disabled = true; try { await api(`/api/helpdesk/tickets/${encodeURIComponent(id)}/status`, { method: "POST", body: { status: st.value } }); flash("ok", t("saved")); openTicket(id); loadTicketQueue(); loadMyTickets(); } catch (ex) { flash("err", ex.message); sbtn.disabled = false; } });
      card.appendChild(el("div", { style: "border-top:1px solid var(--line);margin-top:10px;padding-top:10px" }, [el("label", { text: t("status") }), el("div", { class: "actions" }, [el("div", { class: "grow" }, [st]), sbtn])]));
    }
  } catch (ex) { flash("err", ex.message); card.style.display = "none"; }
}

async function loadPoshConfig() {
  const card = document.getElementById("hd_posh"); if (!card) return;
  try {
    const { members } = await api("/api/admin/posh/committee");
    let dir = { entries: [] };
    try { dir = await api("/api/directory"); } catch { /* keep empty */ }
    clear(card); card.appendChild(h2help(t("poshConfig"), t("posh_config_help")));
    const sel = el("select", {});
    sel.appendChild(el("option", { value: "", text: "—" }));
    for (const e of dir.entries) sel.appendChild(el("option", { value: e.id, text: e.name }));
    const btn = el("button", { class: "primary sm", text: t("addMember") });
    btn.addEventListener("click", async () => { if (!sel.value) return; btn.disabled = true; try { await api("/api/admin/posh/committee", { method: "POST", body: { employeeId: sel.value } }); loadPoshConfig(); } catch (ex) { flash("err", ex.message); } finally { btn.disabled = false; } });
    card.appendChild(el("div", { class: "actions", style: "margin-bottom:8px" }, [el("div", { class: "grow" }, [sel]), btn]));
    if (!members.length) card.appendChild(el("div", { class: "muted", text: t("noCommittee") }));
    for (const m of members) {
      const rm = el("button", { class: "sm", text: t("remove") });
      rm.addEventListener("click", async () => { try { await api(`/api/admin/posh/committee/${encodeURIComponent(m.employee_id)}/remove`, { method: "POST" }); loadPoshConfig(); } catch (ex) { flash("err", ex.message); } });
      card.appendChild(el("div", { class: "row" }, [el("div", { class: "k", text: m.name || m.employee_id }), el("div", { class: "v" }, [el("div", { class: "actions" }, [rm])])]));
    }
  } catch (ex) { flash("err", ex.message); }
}

// ---- FR-07 Announcements -------------------------------------------------------
async function loadAnnouncementsView() {
  const body = document.getElementById("body"); clear(body);
  body.appendChild(el("div", { class: "card", id: "ann_feed" }, [h2help(t("navAnnouncements"), t("announcements_help")), el("div", { class: "muted", text: "…" })]));
  if (canPublish()) {
    body.appendChild(el("div", { class: "card", id: "ann_new" }, [h2help(t("newAnnouncement"), t("announcements_publish_help"))]));
    body.appendChild(el("div", { class: "card", id: "ann_admin" }, [el("h2", { text: t("published_label") }), el("div", { class: "muted", text: "…" })]));
    body.appendChild(el("div", { class: "card", id: "ann_acks", style: "display:none" }));
  }
  loadAnnFeed();
  if (canPublish()) { renderAnnForm(null); loadAnnAdmin(); }
}

async function loadAnnFeed() {
  const card = document.getElementById("ann_feed"); if (!card) return;
  try {
    const { announcements } = await api("/api/announcements");
    clear(card); card.appendChild(h2help(t("navAnnouncements"), t("announcements_help")));
    if (!announcements.length) { card.appendChild(el("div", { class: "muted", text: t("noAnnouncements") })); return; }
    for (const a of announcements) {
      const head = el("div", { style: "display:flex;align-items:baseline;gap:8px;flex-wrap:wrap" }, [
        el("div", { style: "font-weight:650;font-size:15px", text: a.title }),
        a.requiresAck ? (a.acked ? el("span", { class: "pill approved", text: t("acknowledged") }) : el("span", { class: "pill pending", text: t("mustAck") })) : null,
      ]);
      const kids = [head, el("div", { class: "muted", style: "font-size:12px", text: a.publishedAt }), a.body ? el("div", { style: "margin-top:6px;white-space:pre-wrap", text: a.body }) : null];
      if (a.requiresAck && !a.acked) {
        const b = el("button", { class: "primary sm", style: "margin-top:10px", text: t("acknowledge") });
        b.addEventListener("click", async () => { b.disabled = true; try { await api(`/api/announcements/${encodeURIComponent(a.id)}/ack`, { method: "POST" }); flash("ok", t("acknowledged")); loadAnnFeed(); } catch (ex) { flash("err", ex.message); b.disabled = false; } });
        kids.push(b);
      }
      card.appendChild(el("div", { class: "row" }, [el("div", { style: "flex:1" }, kids)]));
    }
  } catch (ex) { flash("err", ex.message); }
}

function renderAnnForm(editing) {
  const card = document.getElementById("ann_new"); if (!card) return;
  clear(card); card.appendChild(h2help(editing ? t("editAnnouncement") : t("newAnnouncement"), t("announcements_publish_help")));
  const title = el("input", { placeholder: t("title"), value: editing ? editing.title : "" });
  const bodyi = el("input", { placeholder: t("body") });
  const aud = el("select", {});
  for (const a of ["all", "office", "client_site"]) aud.appendChild(el("option", { value: a, text: t("aud_" + a), ...(editing && editing.audience === a ? { selected: "" } : {}) }));
  const ack = el("input", { type: "checkbox" }); if (editing && editing.requiresAck) ack.checked = true;
  const ackWrap = el("label", { style: "display:flex;gap:8px;align-items:center;margin:8px 0 0" }, [ack, " " + t("requiresAck")]);
  const btn = el("button", { class: "primary", text: editing ? t("saveChanges") : t("publish") });
  btn.addEventListener("click", async () => {
    if (!title.value.trim()) return; btn.disabled = true;
    try {
      const b = { title: title.value, body: bodyi.value, audience: aud.value, requiresAck: ack.checked };
      if (editing) await api(`/api/admin/announcements/${encodeURIComponent(editing.id)}`, { method: "POST", body: b });
      else await api("/api/admin/announcements", { method: "POST", body: b });
      flash("ok", editing ? t("saved") : t("announcementPublished")); renderAnnForm(null); loadAnnAdmin(); loadAnnFeed();
    } catch (ex) { flash("err", ex.message); } finally { btn.disabled = false; }
  });
  const actions = el("div", { class: "actions", style: "margin-top:10px" }, [btn]);
  if (editing) actions.appendChild(el("button", { class: "sm", text: t("cancel"), onclick: () => renderAnnForm(null) }));
  card.appendChild(el("div", { class: "stack" }, [el("label", { text: t("title") }), title, el("label", { text: t("body") }), bodyi, el("label", { text: t("audience") }), aud, ackWrap, actions]));
}

async function loadAnnAdmin() {
  const card = document.getElementById("ann_admin"); if (!card) return;
  try {
    const { announcements } = await api("/api/admin/announcements");
    clear(card); card.appendChild(el("h2", { text: t("published_label") }));
    if (!announcements.length) { card.appendChild(el("div", { class: "muted", text: t("noAnnouncements") })); return; }
    for (const a of announcements) {
      const acts = el("div", { class: "actions" }, [
        el("span", { class: "pill " + (a.active ? "active" : "inactive"), text: a.active ? t("active") : t("inactive") }),
        el("span", { class: "muted", style: "font-size:12px", text: `v${a.version} · ${t("aud_" + a.audience)}${a.requiresAck ? ` · ${t("ackCount")}: ${a.ackCount}` : ""}` }),
        el("button", { class: "sm", text: t("edit"), onclick: () => renderAnnForm({ id: a.id, title: a.title, audience: a.audience, requiresAck: a.requiresAck }) }),
      ]);
      if (a.requiresAck) acts.appendChild(el("button", { class: "sm", text: t("viewAcks"), onclick: () => loadAnnAcks(a.id, a.title) }));
      acts.appendChild(el("button", { class: "sm", text: a.active ? t("retire") : t("reactivate"), onclick: async () => { try { await api(`/api/admin/announcements/${encodeURIComponent(a.id)}/active`, { method: "POST", body: { active: !a.active } }); loadAnnAdmin(); loadAnnFeed(); } catch (ex) { flash("err", ex.message); } } }));
      card.appendChild(el("div", { class: "row" }, [el("div", { class: "k", text: a.title }), el("div", { class: "v" }, [acts])]));
    }
  } catch (ex) { flash("err", ex.message); }
}

async function loadAnnAcks(id, title) {
  const card = document.getElementById("ann_acks"); if (!card) return;
  card.style.display = "block"; clear(card); card.appendChild(el("div", { class: "muted", text: "…" }));
  try {
    const { version, acks } = await api(`/api/admin/announcements/${encodeURIComponent(id)}/acks`);
    clear(card); card.appendChild(el("h2", { text: `${t("acksTitle")}: ${title} (v${version})` }));
    if (!acks.length) { card.appendChild(el("div", { class: "muted", text: t("noAcks") })); return; }
    for (const k of acks) card.appendChild(el("div", { class: "row" }, [el("div", { class: "k", text: k.name || k.employee_id }), el("div", { class: "v muted", style: "font-size:12px", text: k.acked_at })]));
  } catch (ex) { flash("err", ex.message); }
}

// ---- boot ----------------------------------------------------------------------
if (state.token) renderApp(); else renderLogin();
