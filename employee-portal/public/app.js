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
// Payroll-ready attendance strings (kn/hi initial, review before go-live).
Object.assign(DICT.en, {
  otWord: "OT", payableDays: "Payable days", lopWord: "LOP", lockedWord: "Locked", openWord: "Open",
  previewWord: "Preview", pendingWord: "pending", workingDays: "Working days", notMapped: "no biometric code",
  payrollLock: "Payroll cutoff & lock", lockMonth: "Lock month", unlockMonth: "Unlock month",
  lockedMonths: "Locked", confirmLock: "Lock this month for payroll? Imports and corrections will be frozen.",
  confirmUnlock: "Reopen this month? It will accept imports and corrections again.",
  payrollInput: "Payroll input", exportCsv: "Export CSV", holidayCalendar: "Holiday calendar",
  addHoliday: "Add holiday", holidayName: "Holiday name", locationAll: "Location (blank = all)",
  noHolidays: "No holidays this year.", remove: "Remove", confirmRemove: "Remove this holiday?",
  payroll_lock_help: "Lock a month once attendance is final. A locked month is frozen — no imports, no new corrections, no write-backs — so payroll reads stable data. Unlocking is audited.",
  payroll_input_help: "The per-employee figures payroll consumes: payable days (calendar − loss-of-pay), present/leave/LOP, and overtime, counted against each person's holiday calendar. Export when the month is locked.",
  holiday_help: "Holidays (plus Sundays) are excluded from working days. Leave the location blank for a company-wide holiday, or name a location for a site-specific one.",
  attPolicy: "Attendance policy", weeklyOff: "Weekly off", weeklyTargetHours: "Weekly target (hours)", fullDayHours: "Full day (hours)",
  save: "Save", needWorkingDay: "Keep at least one working day.",
  sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat",
  att_policy_help: "Working days = calendar − weekly-off − holiday. Set which weekdays are off and the weekly hours target used for exception flags. Default: Sunday off, 48h/week.",
});
Object.assign(DICT.kn, {
  otWord: "ಓಟಿ", payableDays: "ಪಾವತಿ ದಿನಗಳು", lopWord: "ಎಲ್‌ಒಪಿ", lockedWord: "ಲಾಕ್", openWord: "ತೆರೆದಿದೆ",
  previewWord: "ಮುನ್ನೋಟ", pendingWord: "ಬಾಕಿ", workingDays: "ಕೆಲಸದ ದಿನಗಳು", notMapped: "ಬಯೋಮೆಟ್ರಿಕ್ ಕೋಡ್ ಇಲ್ಲ",
  payrollLock: "ವೇತನ ಕಟ್‌ಆಫ್ ಮತ್ತು ಲಾಕ್", lockMonth: "ತಿಂಗಳು ಲಾಕ್ ಮಾಡಿ", unlockMonth: "ತಿಂಗಳು ಅನ್‌ಲಾಕ್ ಮಾಡಿ",
  lockedMonths: "ಲಾಕ್ ಆಗಿದೆ", confirmLock: "ಈ ತಿಂಗಳನ್ನು ವೇತನಕ್ಕಾಗಿ ಲಾಕ್ ಮಾಡುವುದೇ? ಆಮದು ಮತ್ತು ತಿದ್ದುಪಡಿಗಳು ಸ್ಥಗಿತಗೊಳ್ಳುತ್ತವೆ.",
  confirmUnlock: "ಈ ತಿಂಗಳನ್ನು ಮತ್ತೆ ತೆರೆಯುವುದೇ?",
  payrollInput: "ವೇತನ ಇನ್‌ಪುಟ್", exportCsv: "CSV ರಫ್ತು", holidayCalendar: "ರಜಾದಿನ ಕ್ಯಾಲೆಂಡರ್",
  addHoliday: "ರಜಾದಿನ ಸೇರಿಸಿ", holidayName: "ರಜಾದಿನ ಹೆಸರು", locationAll: "ಸ್ಥಳ (ಖಾಲಿ = ಎಲ್ಲಾ)",
  noHolidays: "ಈ ವರ್ಷ ರಜಾದಿನಗಳಿಲ್ಲ.", remove: "ತೆಗೆದುಹಾಕಿ", confirmRemove: "ಈ ರಜಾದಿನ ತೆಗೆದುಹಾಕುವುದೇ?",
  payroll_lock_help: "ಹಾಜರಾತಿ ಅಂತಿಮವಾದ ಮೇಲೆ ತಿಂಗಳನ್ನು ಲಾಕ್ ಮಾಡಿ. ಲಾಕ್ ಆದ ತಿಂಗಳು ಸ್ಥಗಿತ — ಆಮದು, ತಿದ್ದುಪಡಿ ಇಲ್ಲ.",
  payroll_input_help: "ವೇತನ ಬಳಸುವ ಅಂಕಿಅಂಶಗಳು: ಪಾವತಿ ದಿನಗಳು, ಹಾಜರ್/ರಜೆ/ಎಲ್‌ಒಪಿ, ಓವರ್‌ಟೈಮ್.",
  holiday_help: "ರಜಾದಿನಗಳು (ಮತ್ತು ಭಾನುವಾರ) ಕೆಲಸದ ದಿನಗಳಿಂದ ಹೊರಗಿಡಲಾಗುತ್ತದೆ.",
  attPolicy: "ಹಾಜರಾತಿ ನೀತಿ", weeklyOff: "ವಾರದ ರಜೆ", weeklyTargetHours: "ವಾರದ ಗುರಿ (ಗಂಟೆ)", fullDayHours: "ಪೂರ್ಣ ದಿನ (ಗಂಟೆ)",
  save: "ಉಳಿಸಿ", needWorkingDay: "ಕನಿಷ್ಠ ಒಂದು ಕೆಲಸದ ದಿನ ಇರಲಿ.",
  sun: "ಭಾನು", mon: "ಸೋಮ", tue: "ಮಂಗಳ", wed: "ಬುಧ", thu: "ಗುರು", fri: "ಶುಕ್ರ", sat: "ಶನಿ",
  att_policy_help: "ಕೆಲಸದ ದಿನಗಳು = ಕ್ಯಾಲೆಂಡರ್ − ವಾರದ ರಜೆ − ರಜಾದಿನ. ಡೀಫಾಲ್ಟ್: ಭಾನುವಾರ ರಜೆ, ವಾರಕ್ಕೆ 48 ಗಂಟೆ.",
});
Object.assign(DICT.hi, {
  otWord: "ओटी", payableDays: "देय दिन", lopWord: "एलओपी", lockedWord: "लॉक", openWord: "खुला",
  previewWord: "पूर्वावलोकन", pendingWord: "लंबित", workingDays: "कार्य दिवस", notMapped: "बायोमेट्रिक कोड नहीं",
  payrollLock: "पेरोल कटऑफ और लॉक", lockMonth: "माह लॉक करें", unlockMonth: "माह अनलॉक करें",
  lockedMonths: "लॉक", confirmLock: "इस माह को पेरोल के लिए लॉक करें? आयात और सुधार फ़्रीज़ हो जाएँगे.",
  confirmUnlock: "इस माह को फिर से खोलें?",
  payrollInput: "पेरोल इनपुट", exportCsv: "CSV निर्यात", holidayCalendar: "अवकाश कैलेंडर",
  addHoliday: "अवकाश जोड़ें", holidayName: "अवकाश नाम", locationAll: "स्थान (खाली = सभी)",
  noHolidays: "इस वर्ष कोई अवकाश नहीं।", remove: "हटाएँ", confirmRemove: "यह अवकाश हटाएँ?",
  payroll_lock_help: "उपस्थिति अंतिम होने पर माह लॉक करें। लॉक माह फ़्रीज़ — कोई आयात, सुधार या राइट-बैक नहीं।",
  payroll_input_help: "पेरोल द्वारा उपयोग किए जाने वाले आँकड़े: देय दिन, उपस्थित/अवकाश/एलओपी, ओवरटाइम।",
  holiday_help: "अवकाश (और रविवार) कार्य दिवसों से बाहर रखे जाते हैं।",
  attPolicy: "उपस्थिति नीति", weeklyOff: "साप्ताहिक अवकाश", weeklyTargetHours: "साप्ताहिक लक्ष्य (घंटे)", fullDayHours: "पूर्ण दिवस (घंटे)",
  save: "सहेजें", needWorkingDay: "कम से कम एक कार्य दिवस रखें।",
  sun: "रवि", mon: "सोम", tue: "मंगल", wed: "बुध", thu: "गुरु", fri: "शुक्र", sat: "शनि",
  att_policy_help: "कार्य दिवस = कैलेंडर − साप्ताहिक अवकाश − छुट्टी। डिफ़ॉल्ट: रविवार अवकाश, 48 घंटे/सप्ताह।",
});
// Payroll core (P6a) strings (kn/hi initial, review before go-live).
Object.assign(DICT.en, {
  navPayroll: "Payroll", employeeSalary: "Employee salary", componentsCatalog: "Salary components",
  selectEmployee: "Employee", effectiveFrom: "Effective from", component: "Component", amount: "Amount",
  monthlyGross: "Monthly gross", saveSalary: "Save salary revision", salaryHistory: "Salary history",
  revision: "Rev", noSalary: "No salary set yet.", earning: "earning", deduction: "deduction",
  addComponent: "Add component", statutoryWord: "statutory", noProrate: "no LOP proration",
  selectEmployeeDate: "Pick an employee and an effective date.", needEarning: "Add at least one earning amount.",
  payrollRun: "Payroll run", prepareRun: "Prepare run", prepared: "Prepared", noRun: "No run for this month yet.",
  netWord: "Net", noExceptions: "no exceptions", divisorWord: "Divisor",
  exc_negative_net: "negative net", exc_zero_pay: "no paid days", exc_no_salary: "no salary set", exc_missing_bank: "missing bank",
  submitReview: "Submit for review", approveLock: "Approve & lock", reject: "Reject", reopen: "Reopen", bankAdvice: "Bank advice",
  payslipsPublished: "Locked. Payslips published to employees (in Documents).",
  confirmApprove: "Approve and lock this payroll? Payslips will be published and the run becomes immutable.",
  confirmReopen: "Reopen as a new version for correction? The locked version and its payslips are kept.",
  payroll_run_help: "Prepare a run for a month whose attendance is locked. It computes each employee's pay from their effective-dated salary and the locked attendance (payable days, LOP, OT). Re-preparing recomputes in place. Maker-checker approval + payslips come in the next slice.",
  payroll_help: "Set up salary structures and run payroll here. Payroll consumes the locked monthly attendance.",
  payroll_setup_note: "Run a month, then review the register and exceptions. Approval/lock + payslips are the next slice (P6c).",
  emp_salary_help: "Assign or revise an employee's salary, effective-dated. A new revision supersedes the previous one from its start date; history is kept. Amounts in ₹; % components are of their base.",
  catalog_help: "Reusable component definitions. Statutory components (PF/ESI/PT/TDS) are placeholders — their rules arrive in the CA-validated statutory phase.",
});
Object.assign(DICT.kn, {
  navPayroll: "ವೇತನ", employeeSalary: "ಉದ್ಯೋಗಿ ವೇತನ", componentsCatalog: "ವೇತನ ಘಟಕಗಳು",
  selectEmployee: "ಉದ್ಯೋಗಿ", effectiveFrom: "ಇಂದಿನಿಂದ", component: "ಘಟಕ", amount: "ಮೊತ್ತ",
  monthlyGross: "ಮಾಸಿಕ ಒಟ್ಟು", saveSalary: "ವೇತನ ಪರಿಷ್ಕರಣೆ ಉಳಿಸಿ", salaryHistory: "ವೇತನ ಇತಿಹಾಸ",
  revision: "ಪರಿಷ್ಕ.", noSalary: "ಇನ್ನೂ ವೇತನ ಇಲ್ಲ.", earning: "ಗಳಿಕೆ", deduction: "ಕಡಿತ",
  addComponent: "ಘಟಕ ಸೇರಿಸಿ", statutoryWord: "ಶಾಸನಬದ್ಧ", noProrate: "ಎಲ್‌ಒಪಿ ಇಲ್ಲ",
  selectEmployeeDate: "ಉದ್ಯೋಗಿ ಮತ್ತು ದಿನಾಂಕ ಆಯ್ಕೆಮಾಡಿ.", needEarning: "ಕನಿಷ್ಠ ಒಂದು ಗಳಿಕೆ ಸೇರಿಸಿ.",
  payrollRun: "ವೇತನ ರನ್", prepareRun: "ರನ್ ಸಿದ್ಧಪಡಿಸಿ", prepared: "ಸಿದ್ಧವಾಗಿದೆ", noRun: "ಈ ತಿಂಗಳ ರನ್ ಇಲ್ಲ.",
  netWord: "ನಿವ್ವಳ", noExceptions: "ಸಮಸ್ಯೆ ಇಲ್ಲ", divisorWord: "ಭಾಜಕ",
  exc_negative_net: "ಋಣ ನಿವ್ವಳ", exc_zero_pay: "ಪಾವತಿ ದಿನ ಇಲ್ಲ", exc_no_salary: "ವೇತನ ಇಲ್ಲ", exc_missing_bank: "ಬ್ಯಾಂಕ್ ಇಲ್ಲ",
  submitReview: "ಪರಿಶೀಲನೆಗೆ ಸಲ್ಲಿಸಿ", approveLock: "ಅನುಮೋದಿಸಿ ಮತ್ತು ಲಾಕ್", reject: "ತಿರಸ್ಕರಿಸಿ", reopen: "ಮತ್ತೆ ತೆರೆಯಿರಿ", bankAdvice: "ಬ್ಯಾಂಕ್ ಸಲಹೆ",
  payslipsPublished: "ಲಾಕ್ ಆಗಿದೆ. ಪೇಸ್ಲಿಪ್‌ಗಳು ಉದ್ಯೋಗಿಗಳಿಗೆ ಪ್ರಕಟಿಸಲಾಗಿದೆ (ಡಾಕ್ಯುಮೆಂಟ್ಸ್).",
  confirmApprove: "ಈ ವೇತನವನ್ನು ಅನುಮೋದಿಸಿ ಲಾಕ್ ಮಾಡುವುದೇ? ಪೇಸ್ಲಿಪ್ ಪ್ರಕಟವಾಗುತ್ತದೆ ಮತ್ತು ಬದಲಾಯಿಸಲಾಗದು.",
  confirmReopen: "ತಿದ್ದುಪಡಿಗಾಗಿ ಹೊಸ ಆವೃತ್ತಿಯಾಗಿ ತೆರೆಯುವುದೇ? ಲಾಕ್ ಆವೃತ್ತಿ ಉಳಿಯುತ್ತದೆ.",
  payroll_run_help: "ಹಾಜರಾತಿ ಲಾಕ್ ಆದ ತಿಂಗಳಿಗೆ ರನ್ ಸಿದ್ಧಪಡಿಸಿ. ಪ್ರತಿ ಉದ್ಯೋಗಿಯ ವೇತನವನ್ನು ಲೆಕ್ಕ ಹಾಕುತ್ತದೆ. ಅನುಮೋದನೆ + ಪೇಸ್ಲಿಪ್ ಮುಂದೆ.",
  payroll_help: "ವೇತನ ರಚನೆ ಮತ್ತು ರನ್ ಇಲ್ಲಿ. ವೇತನ ಲಾಕ್ ಆದ ಹಾಜರಾತಿಯನ್ನು ಬಳಸುತ್ತದೆ.",
  payroll_setup_note: "ತಿಂಗಳನ್ನು ರನ್ ಮಾಡಿ, ನಂತರ ರಿಜಿಸ್ಟರ್ ಪರಿಶೀಲಿಸಿ. ಅನುಮೋದನೆ/ಲಾಕ್ + ಪೇಸ್ಲಿಪ್ ಮುಂದಿನ ಹಂತ.",
  emp_salary_help: "ಉದ್ಯೋಗಿ ವೇತನವನ್ನು ದಿನಾಂಕಾಧಾರಿತವಾಗಿ ನಿಗದಿಪಡಿಸಿ. ಹೊಸ ಪರಿಷ್ಕರಣೆ ಹಿಂದಿನದನ್ನು ಬದಲಿಸುತ್ತದೆ.",
  catalog_help: "ಮರುಬಳಕೆಯ ಘಟಕ ವ್ಯಾಖ್ಯಾನಗಳು. ಶಾಸನಬದ್ಧ ಘಟಕಗಳ ನಿಯಮಗಳು ಮುಂದಿನ ಹಂತದಲ್ಲಿ.",
});
Object.assign(DICT.hi, {
  navPayroll: "पेरोल", employeeSalary: "कर्मचारी वेतन", componentsCatalog: "वेतन घटक",
  selectEmployee: "कर्मचारी", effectiveFrom: "प्रभावी तिथि", component: "घटक", amount: "राशि",
  monthlyGross: "मासिक सकल", saveSalary: "वेतन संशोधन सहेजें", salaryHistory: "वेतन इतिहास",
  revision: "संशो.", noSalary: "अभी कोई वेतन नहीं।", earning: "आय", deduction: "कटौती",
  addComponent: "घटक जोड़ें", statutoryWord: "सांविधिक", noProrate: "एलओपी नहीं",
  selectEmployeeDate: "कर्मचारी और तिथि चुनें।", needEarning: "कम से कम एक आय जोड़ें।",
  payrollRun: "पेरोल रन", prepareRun: "रन तैयार करें", prepared: "तैयार", noRun: "इस माह का कोई रन नहीं।",
  netWord: "शुद्ध", noExceptions: "कोई समस्या नहीं", divisorWord: "भाजक",
  exc_negative_net: "ऋणात्मक शुद्ध", exc_zero_pay: "कोई देय दिन नहीं", exc_no_salary: "वेतन नहीं", exc_missing_bank: "बैंक नहीं",
  submitReview: "समीक्षा हेतु भेजें", approveLock: "अनुमोदित करें और लॉक करें", reject: "अस्वीकार करें", reopen: "पुनः खोलें", bankAdvice: "बैंक सलाह",
  payslipsPublished: "लॉक। पे-स्लिप कर्मचारियों को प्रकाशित (दस्तावेज़ में)।",
  confirmApprove: "इस पेरोल को अनुमोदित और लॉक करें? पे-स्लिप प्रकाशित होंगी और यह अपरिवर्तनीय हो जाएगा.",
  confirmReopen: "सुधार हेतु नए संस्करण के रूप में खोलें? लॉक संस्करण और उसकी पे-स्लिप रहेंगी.",
  payroll_run_help: "लॉक किए गए माह के लिए रन तैयार करें। प्रत्येक कर्मचारी का वेतन गणना करता है। अनुमोदन + पे-स्लिप अगले चरण में।",
  payroll_help: "वेतन संरचना और रन यहाँ। पेरोल लॉक की गई उपस्थिति का उपयोग करता है।",
  payroll_setup_note: "माह चलाएँ, फिर रजिस्टर और समस्याएँ देखें। अनुमोदन/लॉक + पे-स्लिप अगला चरण।",
  emp_salary_help: "कर्मचारी वेतन को तिथि-आधारित रूप से निर्धारित करें। नया संशोधन पिछले को प्रतिस्थापित करता है।",
  catalog_help: "पुन: प्रयोज्य घटक परिभाषाएँ। सांविधिक घटकों के नियम अगले चरण में।",
});
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

// FR-05 Tasks + FR-13 Notifications strings.
Object.assign(DICT.en, {
  navTasks: "Tasks", tasks_help: "Your assigned tasks — update status and add evidence. Managers and HR can assign to their team.",
  newTask: "New task", assignTo: "Assign to", myself: "Myself", dueDate: "Due date", priority: "Priority",
  prio_low: "Low", prio_medium: "Medium", prio_high: "High",
  myTasks: "My tasks", assignedByMe: "Assigned by me", noTasks: "No tasks.", addTask: "Add task",
  markInProgress: "Start", markDone: "Mark done", evidenceLabel: "Evidence / note", assignedBy: "Assigned by",
  tstatus_open: "open", tstatus_in_progress: "in progress", tstatus_done: "done", tstatus_cancelled: "cancelled",
  notifications: "Notifications", notifEmpty: "You're all caught up.",
  notif_approvals: "Approvals pending", notif_announcements: "To acknowledge", notif_tasks: "Open tasks", notif_helpdesk: "Tickets to handle",
});
Object.assign(DICT.kn, {
  navTasks: "ಕಾರ್ಯಗಳು", tasks_help: "ನಿಮ್ಮ ಕಾರ್ಯಗಳು — ಸ್ಥಿತಿ ನವೀಕರಿಸಿ, ಸಾಕ್ಷ್ಯ ಸೇರಿಸಿ. ವ್ಯವಸ್ಥಾಪಕರು/HR ತಂಡಕ್ಕೆ ನಿಯೋಜಿಸಬಹುದು.",
  newTask: "ಹೊಸ ಕಾರ್ಯ", assignTo: "ಗೆ ನಿಯೋಜಿಸಿ", myself: "ನನಗೆ", dueDate: "ಗಡುವು", priority: "ಆದ್ಯತೆ",
  prio_low: "ಕಡಿಮೆ", prio_medium: "ಮಧ್ಯಮ", prio_high: "ಹೆಚ್ಚು",
  myTasks: "ನನ್ನ ಕಾರ್ಯಗಳು", assignedByMe: "ನಾನು ನಿಯೋಜಿಸಿದವು", noTasks: "ಕಾರ್ಯಗಳಿಲ್ಲ.", addTask: "ಕಾರ್ಯ ಸೇರಿಸಿ",
  markInProgress: "ಪ್ರಾರಂಭಿಸಿ", markDone: "ಪೂರ್ಣಗೊಳಿಸಿ", evidenceLabel: "ಸಾಕ್ಷ್ಯ / ಟಿಪ್ಪಣಿ", assignedBy: "ನಿಯೋಜಿಸಿದವರು",
  tstatus_open: "ತೆರೆದಿದೆ", tstatus_in_progress: "ಪ್ರಗತಿಯಲ್ಲಿ", tstatus_done: "ಮುಗಿದಿದೆ", tstatus_cancelled: "ರದ್ದಾಗಿದೆ",
  notifications: "ಅಧಿಸೂಚನೆಗಳು", notifEmpty: "ಎಲ್ಲವೂ ಮುಗಿದಿದೆ.",
  notif_approvals: "ಅನುಮೋದನೆ ಬಾಕಿ", notif_announcements: "ಒಪ್ಪಿಗೆ ಬೇಕು", notif_tasks: "ತೆರೆದ ಕಾರ್ಯಗಳು", notif_helpdesk: "ಟಿಕೆಟ್‌ಗಳು",
});
Object.assign(DICT.hi, {
  navTasks: "कार्य", tasks_help: "आपके कार्य — स्थिति अपडेट करें, साक्ष्य जोड़ें। प्रबंधक/HR टीम को सौंप सकते हैं।",
  newTask: "नया कार्य", assignTo: "को सौंपें", myself: "स्वयं", dueDate: "नियत तिथि", priority: "प्राथमिकता",
  prio_low: "निम्न", prio_medium: "मध्यम", prio_high: "उच्च",
  myTasks: "मेरे कार्य", assignedByMe: "मेरे द्वारा सौंपे", noTasks: "कोई कार्य नहीं।", addTask: "कार्य जोड़ें",
  markInProgress: "शुरू करें", markDone: "पूर्ण करें", evidenceLabel: "साक्ष्य / नोट", assignedBy: "सौंपा गया",
  tstatus_open: "खुला", tstatus_in_progress: "प्रगति में", tstatus_done: "पूर्ण", tstatus_cancelled: "रद्द",
  notifications: "सूचनाएँ", notifEmpty: "सब पूरा हो गया।",
  notif_approvals: "अनुमोदन लंबित", notif_announcements: "स्वीकृति हेतु", notif_tasks: "खुले कार्य", notif_helpdesk: "टिकट",
});

// FR-06 Documents strings.
Object.assign(DICT.en, {
  navDocuments: "Documents", documents_help: "Your published documents — payslips, letters and policies. Drafts are not shown.",
  noDocuments: "No documents.", openDoc: "Open", publishDocument: "Publish a document", allDocuments: "All documents",
  forEmployee: "For employee", docBodyOptional: "Text content (optional)", attachFile: "Attach file (PDF/image, optional)", publishNow: "Publish now",
  doc_payslip: "Payslip", doc_letter: "Letter", doc_policy: "Policy", doc_other: "Other",
  dstatus_draft: "draft", dstatus_published: "published", fileTooLarge: "File too large (max ~1.5MB).",
});
Object.assign(DICT.kn, {
  navDocuments: "ದಾಖಲೆಗಳು", documents_help: "ನಿಮ್ಮ ಪ್ರಕಟಿತ ದಾಖಲೆಗಳು — ವೇತನಚೀಟಿ, ಪತ್ರಗಳು, ನೀತಿಗಳು. ಕರಡುಗಳು ತೋರಿಸುವುದಿಲ್ಲ.",
  noDocuments: "ದಾಖಲೆಗಳಿಲ್ಲ.", openDoc: "ತೆರೆ", publishDocument: "ದಾಖಲೆ ಪ್ರಕಟಿಸಿ", allDocuments: "ಎಲ್ಲಾ ದಾಖಲೆಗಳು",
  forEmployee: "ಉದ್ಯೋಗಿಗಾಗಿ", docBodyOptional: "ಪಠ್ಯ (ಐಚ್ಛಿಕ)", attachFile: "ಫೈಲ್ ಲಗತ್ತಿಸಿ (PDF/ಚಿತ್ರ, ಐಚ್ಛಿಕ)", publishNow: "ಈಗ ಪ್ರಕಟಿಸಿ",
  doc_payslip: "ವೇತನಚೀಟಿ", doc_letter: "ಪತ್ರ", doc_policy: "ನೀತಿ", doc_other: "ಇತರೆ",
  dstatus_draft: "ಕರಡು", dstatus_published: "ಪ್ರಕಟಿತ", fileTooLarge: "ಫೈಲ್ ತುಂಬಾ ದೊಡ್ಡದು (ಗರಿಷ್ಠ ~1.5MB).",
});
Object.assign(DICT.hi, {
  navDocuments: "दस्तावेज़", documents_help: "आपके प्रकाशित दस्तावेज़ — वेतनपर्ची, पत्र, नीतियाँ। ड्राफ़्ट नहीं दिखते।",
  noDocuments: "कोई दस्तावेज़ नहीं।", openDoc: "खोलें", publishDocument: "दस्तावेज़ प्रकाशित करें", allDocuments: "सभी दस्तावेज़",
  forEmployee: "कर्मचारी के लिए", docBodyOptional: "पाठ सामग्री (वैकल्पिक)", attachFile: "फ़ाइल संलग्न करें (PDF/छवि, वैकल्पिक)", publishNow: "अभी प्रकाशित करें",
  doc_payslip: "वेतनपर्ची", doc_letter: "पत्र", doc_policy: "नीति", doc_other: "अन्य",
  dstatus_draft: "ड्राफ़्ट", dstatus_published: "प्रकाशित", fileTooLarge: "फ़ाइल बहुत बड़ी (अधिकतम ~1.5MB)।",
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
function canVerify() { return ["hr_admin", "hr_executive", "super_admin"].includes(state.role); }
function canApproveLeave() { return ["manager", "hr_admin", "hr_executive", "super_admin"].includes(state.role); }
function canLockAttendance() { return ["hr_admin", "finance", "finance_admin", "finance_approver", "super_admin"].includes(state.role); }
function canPublish() { return ["hr_admin", "hr_executive", "super_admin"].includes(state.role); }

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
      // Language follows the user's profile (server-persisted); cache it locally too.
      if (data.lang) { state.lang = data.lang; ss.set("ep_lang", data.lang); }
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
    // Persist to the profile when signed in, so it follows across devices/logins.
    if (state.token) { api("/api/me/lang", { method: "POST", body: { lang: state.lang } }).catch(() => {}); }
    state.token ? renderApp() : renderLogin();
  } });
  for (const [code, name] of [["en", "English"], ["kn", "ಕನ್ನಡ"], ["hi", "हिन्दी"]]) {
    sel.appendChild(el("option", { value: code, text: name, ...(code === state.lang ? { selected: "" } : {}) }));
  }
  return sel;
}

// Locale-aware formatting (quick win). India locale per language; INR currency.
const LOCALE = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" };
function curLocale() { return LOCALE[state.lang] || "en-IN"; }
function fmtINR(n) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  try { return new Intl.NumberFormat(curLocale(), { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v); }
  catch { return "₹" + v.toLocaleString("en-IN"); }
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00:00Z" : iso);
  if (isNaN(d)) return iso;
  try { return new Intl.DateTimeFormat(curLocale(), { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d); }
  catch { return iso; }
}

// ---- app shell (HRMS-style: sidebar + topbar) ----------------------------------
const VIEWS = [
  { id: "profile", icon: "user", titleKey: "myProfile" },
  { id: "leave", icon: "calendar", titleKey: "navLeave" },
  { id: "attendance", icon: "clock", titleKey: "navAttendance" },
  { id: "tasks", icon: "task", titleKey: "navTasks" },
  { id: "directory", icon: "users", titleKey: "navDirectory" },
  { id: "announcements", icon: "bell", titleKey: "navAnnouncements" },
  { id: "documents", icon: "file", titleKey: "navDocuments" },
  { id: "payroll", icon: "money", titleKey: "navPayroll", when: () => canViewPayroll() },
  { id: "helpdesk", icon: "help", titleKey: "navHelpdesk" },
  { id: "approvals", icon: "check", titleKey: "navApprovals" },
];
function canViewPayroll() { return ["hr_admin", "finance", "finance_admin", "finance_approver", "super_admin"].includes(state.role); }
function canPreparePay() { return ["hr_admin", "finance", "finance_admin", "super_admin"].includes(state.role); }
function canApprovePay() { return ["finance_approver", "super_admin"].includes(state.role); }
const ICONS = {
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  check: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  help: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  task: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  money: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><line x1="2" y1="10" x2="2" y2="10"/><line x1="22" y1="14" x2="22" y2="14"/>',
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
  const items = VIEWS.filter((v) => !v.when || v.when()).map((v) => el("button", { class: `navitem${state.view === v.id ? " active" : ""}`, onclick: () => switchView(v.id) }, [icon(v.icon), el("span", { text: t(v.titleKey) })]));
  return el("nav", { class: "sidebar", id: "sidebar" }, [
    el("div", { class: "brand" }, [el("div", { class: "logo", text: "4S" }), el("div", {}, [document.createTextNode("4SYZ"), el("small", { text: t("appTitle") })])]),
    ...items,
    el("div", { class: "spacer" }),
    el("div", { class: "side-foot" }, [langSelect(), el("button", { class: "sm", text: t("logout"), onclick: doLogout })]),
  ]);
}

async function renderApp() {
  clear(app());
  if (state.token && state.emp == null) { try { const me = await api("/api/me"); state.emp = me.employee; if (me.lang && me.lang !== state.lang) { state.lang = me.lang; ss.set("ep_lang", me.lang); } } catch { /* pure admin (no employee record) or transient */ } }
  const content = el("div", { class: "content", id: "body" });
  const main = el("div", { class: "main" }, [
    el("div", { class: "topbar" }, [
      el("h1", { id: "pagetitle", text: "" }),
      el("button", { class: "notifbtn", id: "notifbtn", title: t("notifications"), "aria-label": t("notifications"), onclick: toggleNotif }, [icon("bell"), el("span", { class: "notif-badge", id: "notifbadge", style: "display:none" })]),
      el("div", { class: "userchip", id: "userchip" }, userChip()),
      el("div", { class: "notifpanel", id: "notifpanel", style: "display:none" }),
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
  else if (view === "tasks") await loadTasksView();
  else if (view === "directory") await loadDirectoryView();
  else if (view === "announcements") await loadAnnouncementsView();
  else if (view === "documents") await loadDocumentsView();
  else if (view === "payroll") await loadPayrollView();
  else if (view === "helpdesk") await loadHelpdeskView();
  else if (view === "approvals") await loadApprovalsView();
  else await loadProfile();
  loadNotifications();
}

function toggleNotif() {
  const p = document.getElementById("notifpanel"); if (!p) return;
  if (!p.style.display || p.style.display === "none") { p.style.display = "block"; loadNotifications(); }
  else p.style.display = "none";
}

async function loadNotifications() {
  try {
    const { items, total } = await api("/api/notifications");
    const badge = document.getElementById("notifbadge");
    if (badge) { if (total) { badge.textContent = total > 99 ? "99+" : String(total); badge.style.display = "grid"; } else badge.style.display = "none"; }
    const p = document.getElementById("notifpanel");
    if (!p || !p.style.display || p.style.display === "none") return;
    clear(p);
    if (!items.length) { p.appendChild(el("div", { class: "nrow muted", text: t("notifEmpty") })); return; }
    for (const it of items) {
      const right = el("div", { class: "actions" }, [el("span", { class: "pill", text: String(it.count) })]);
      if (it.kind === "tasks" && it.overdue) right.appendChild(el("span", { class: "pill rejected", text: `${it.overdue} ${t("overdue")}` }));
      p.appendChild(el("div", { class: "nrow", onclick: () => { p.style.display = "none"; switchView(it.view); } }, [el("span", { text: t("notif_" + it.kind) }), right]));
    }
  } catch { /* ignore notification errors */ }
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
  if (e.ctc != null) emp.appendChild(row(t("ctc"), el("span", { text: fmtINR(e.ctc) })));
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
  if (canLockAttendance()) {
    body.appendChild(el("div", { class: "card", id: "att_policy" }, [h2help(t("attPolicy"), t("att_policy_help")), el("div", { class: "muted", text: "…" })]));
    body.appendChild(el("div", { class: "card", id: "att_lock" }, [h2help(t("payrollLock"), t("payroll_lock_help")), el("div", { class: "muted", text: "…" })]));
    body.appendChild(el("div", { class: "card", id: "att_payroll" }, [h2help(t("payrollInput"), t("payroll_input_help")), el("div", { class: "muted", text: "…" })]));
    body.appendChild(el("div", { class: "card", id: "att_holidays" }, [h2help(t("holidayCalendar"), t("holiday_help")), el("div", { class: "muted", text: "…" })]));
  }
  await loadAttendanceMonth();
  renderCorrectionForm();
  loadMyCorrections();
  if (canApproveLeave()) loadAttCorrQueue();
  if (canLockAttendance()) { loadAttPolicy(); loadPayrollLock(); loadPayrollInput(); loadHolidays(); }
}

// Attendance policy editor (quick win): weekly-off days + weekly target hours.
async function loadAttPolicy() {
  const card = document.getElementById("att_policy");
  if (!card) return;
  clear(card); card.appendChild(h2help(t("attPolicy"), t("att_policy_help")));
  try {
    const { policy } = await api("/api/admin/attendance/policy");
    const off = new Set(String(policy.weekly_off_days || "0").split(",").map((s) => parseInt(s, 10)));
    const dayNames = [t("sun"), t("mon"), t("tue"), t("wed"), t("thu"), t("fri"), t("sat")];
    const boxes = dayNames.map((nm, i) => {
      const cb = el("input", { type: "checkbox", id: `wo_${i}`, ...(off.has(i) ? { checked: "" } : {}) });
      return el("label", { style: "display:inline-flex;align-items:center;gap:4px;margin:0 10px 0 0;font-size:13px;color:var(--ink)" }, [cb, el("span", { text: nm })]);
    });
    const targetH = el("input", { type: "number", min: "0", step: "0.5", value: String((Number(policy.weekly_target_minutes) || 0) / 60), style: "max-width:90px" });
    const fullH = el("input", { type: "number", min: "0", step: "0.5", value: String((Number(policy.full_day_minutes) || 0) / 60), style: "max-width:90px" });
    const save = el("button", { class: "primary sm", text: t("save") });
    save.addEventListener("click", async () => {
      const weeklyOffDays = dayNames.map((_, i) => i).filter((i) => document.getElementById(`wo_${i}`).checked);
      if (weeklyOffDays.length > 6) { flash("err", t("needWorkingDay")); return; }
      save.disabled = true;
      try { await api("/api/admin/attendance/policy", { method: "POST", body: { weeklyOffDays, weeklyTargetMinutes: Math.round(Number(targetH.value) * 60), fullDayMinutes: Math.round(Number(fullH.value) * 60) } }); flash("ok", t("saved")); loadAttPolicy(); loadPayrollInput(); }
      catch (ex) { flash("err", ex.message); }
      finally { save.disabled = false; }
    });
    card.appendChild(el("div", { style: "margin-bottom:8px" }, [el("div", { class: "muted", style: "font-size:12px;margin-bottom:4px", text: t("weeklyOff") }), el("div", {}, boxes)]));
    card.appendChild(el("div", { class: "actions" }, [
      el("label", { style: "margin:0", text: t("weeklyTargetHours") }), targetH,
      el("label", { style: "margin:0 0 0 8px", text: t("fullDayHours") }), fullH,
      save,
    ]));
  } catch (ex) { card.appendChild(el("div", { class: "msg err", text: ex.message })); }
}

// Payroll-ready attendance admin (HR/finance): month lock, payroll input, holidays.
async function loadPayrollLock() {
  const card = document.getElementById("att_lock");
  if (!card) return;
  clear(card); card.appendChild(h2help(t("payrollLock"), t("payroll_lock_help")));
  try {
    const month = state.attMonth;
    const { periods } = await api("/api/admin/attendance/periods");
    const cur = (periods || []).find((p) => p.ym === month);
    const locked = cur && cur.status === "locked";
    card.appendChild(el("div", { class: "actions" }, [
      el("span", { text: `${t("month")}: ${month}` }),
      el("span", { class: "pill " + (locked ? "approved" : "pending"), text: locked ? t("lockedWord") : t("openWord") }),
      el("button", {
        class: locked ? "sm" : "primary sm", text: locked ? t("unlockMonth") : t("lockMonth"),
        onclick: async () => {
          if (!confirm(locked ? t("confirmUnlock") : t("confirmLock"))) return;
          try { await api(`/api/admin/attendance/periods/${month}/${locked ? "unlock" : "lock"}`, { method: "POST", body: {} }); flash("ok", t("saved")); loadPayrollLock(); loadAttendanceMonth(); loadPayrollInput(); }
          catch (ex) { flash("err", ex.message); }
        },
      }),
    ]));
    const recent = (periods || []).filter((p) => p.status === "locked").slice(0, 6);
    if (recent.length) card.appendChild(el("div", { class: "muted", style: "margin-top:8px;font-size:12px", text: `${t("lockedMonths")}: ${recent.map((p) => p.ym).join(", ")}` }));
  } catch (ex) { card.appendChild(el("div", { class: "msg err", text: ex.message })); }
}

async function loadPayrollInput() {
  const card = document.getElementById("att_payroll");
  if (!card) return;
  clear(card); card.appendChild(h2help(t("payrollInput"), t("payroll_input_help")));
  try {
    const month = state.attMonth;
    const data = await api(`/api/admin/attendance/payroll-input?month=${encodeURIComponent(month)}`);
    card.appendChild(el("div", { class: "actions", style: "margin-bottom:8px" }, [
      el("span", { text: `${t("month")}: ${month} · ${t("workingDays")}: ${data.workingDaysBaseline}` }),
      data.locked ? el("span", { class: "pill approved", text: t("lockedWord") }) : el("span", { class: "pill pending", text: t("previewWord") }),
      el("button", { class: "sm", text: t("exportCsv"), onclick: () => exportPayrollCsv(month, data.employees) }),
    ]));
    const head = el("div", { class: "row", style: "font-weight:600;font-size:12px" }, [
      el("div", { class: "k", text: t("employee") }),
      el("div", { class: "v", text: `${t("payableDays")} · ${t("present")}/${t("leaveWord")}/${t("lopWord")} · ${t("otWord")}` }),
    ]);
    card.appendChild(head);
    for (const e of data.employees) {
      const p = e.input;
      const warn = (!e.mapped || p.lop || p.exceptionDays);
      card.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k" }, [el("div", { text: e.name }), e.mapped ? null : el("div", { class: "muted", style: "font-size:11px", text: t("notMapped") })]),
        el("div", { class: "v" }, [
          el("span", { text: `${p.payableDays}/${p.calendarDays} · ${p.present}/${p.paidLeave}/${p.lop} · ${minToHHMM(p.otMinutes)}` }),
          p.pending ? el("span", { class: "muted", style: "margin-left:6px;font-size:11px", text: `${p.pending} ${t("pendingWord")}` }) : null,
          warn && p.exceptionDays ? el("span", { class: "pill pending", style: "margin-left:6px", text: `${p.exceptionDays} ${t("exceptionsWord")}` }) : null,
        ]),
      ]));
    }
  } catch (ex) { card.appendChild(el("div", { class: "msg err", text: ex.message })); }
}

function exportPayrollCsv(month, employees) {
  const cols = ["employee", "location", "mapped", "calendarDays", "workingDays", "present", "paidLeave", "lop", "pending", "weekoff", "holiday", "payableDays", "otMinutes", "exceptionDays"];
  const lines = [cols.join(",")];
  for (const e of employees) {
    const p = e.input;
    const row = [csv(e.name), csv(e.location || ""), e.mapped ? 1 : 0, p.calendarDays, p.workingDays, p.present, p.paidLeave, p.lop, p.pending, p.weekoff, p.holiday, p.payableDays, p.otMinutes, p.exceptionDays];
    lines.push(row.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `payroll-input-${month}.csv` });
  document.body.appendChild(a); a.click(); a.remove();
}
function csv(s) { return /[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s); }

async function loadHolidays() {
  const card = document.getElementById("att_holidays");
  if (!card) return;
  clear(card); card.appendChild(h2help(t("holidayCalendar"), t("holiday_help")));
  const year = (state.attMonth || "").slice(0, 4) || new Date().toISOString().slice(0, 4);
  const date = el("input", { type: "date", style: "width:auto" });
  const name = el("input", { placeholder: t("holidayName") });
  const loc = el("input", { placeholder: t("locationAll"), style: "max-width:120px" });
  const add = el("button", { class: "primary sm", text: t("addHoliday") });
  add.addEventListener("click", async () => {
    add.disabled = true;
    try { await api("/api/admin/holidays", { method: "POST", body: { date: date.value, name: name.value, location: loc.value || "*" } }); flash("ok", t("saved")); date.value = ""; name.value = ""; loc.value = ""; loadHolidays(); loadPayrollInput(); }
    catch (ex) { flash("err", ex.message); }
    finally { add.disabled = false; }
  });
  card.appendChild(el("div", { class: "actions", style: "margin-bottom:8px" }, [date, name, loc, add]));
  try {
    const { holidays } = await api(`/api/admin/holidays?year=${year}`);
    if (!holidays || !holidays.length) { card.appendChild(el("div", { class: "muted", text: t("noHolidays") })); return; }
    for (const h of holidays) {
      card.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k", text: h.holiday_date }),
        el("div", { class: "v" }, [
          el("span", { text: `${h.name}${h.location && h.location !== "*" ? ` · ${h.location}` : ""}` }),
          el("button", { class: "sm", style: "margin-left:8px", text: t("remove"), onclick: async () => { if (!confirm(t("confirmRemove"))) return; try { await api(`/api/admin/holidays/${encodeURIComponent(h.id)}/delete`, { method: "POST", body: {} }); loadHolidays(); loadPayrollInput(); } catch (ex) { flash("err", ex.message); } } }),
        ]),
      ]));
    }
  } catch (ex) { card.appendChild(el("div", { class: "msg err", text: ex.message })); }
}

async function loadAttendanceMonth() {
  const sumEl = document.getElementById("att_summary");
  const tableEl = document.getElementById("att_table");
  if (!tableEl) return;
  try {
    const data = await api(`/api/attendance?month=${encodeURIComponent(state.attMonth)}`);
    const s = data.summary;
    if (sumEl && s) {
      clear(sumEl);
      sumEl.appendChild(el("span", { text: `${t("present")}: ${s.present} · ${t("absent")}: ${s.absent} · ${t("leaveWord")}: ${s.leave} · ${t("weekoff")}: ${s.weekoff} · ${t("holiday")}: ${s.holiday} · ${t("workHours")}: ${minToHHMM(s.workMinutes)} · ${t("otWord")}: ${minToHHMM(s.otMinutes)} · ${t("exceptionsWord")}: ${s.exceptionDays}` }));
      if (data.payroll) sumEl.appendChild(el("div", { style: "margin-top:4px" }, [el("b", { text: `${t("payableDays")}: ${data.payroll.payableDays}/${data.payroll.calendarDays}` }), data.payroll.lop ? el("span", { class: "pill pending", style: "margin-left:6px", text: `${t("lopWord")}: ${data.payroll.lop}` }) : null]));
      if (data.locked) sumEl.appendChild(el("span", { class: "pill approved", style: "margin-left:6px", text: t("lockedWord") }));
    }
    clear(tableEl);
    if (!data.days || !data.days.length) { tableEl.appendChild(el("div", { class: "muted", text: t("noAttendance") })); return; }
    for (const d of data.days) {
      const flags = (d.exceptions || []).map((x) => el("span", { class: "pill pending", style: "margin-right:4px", text: t("ex_" + x) }));
      tableEl.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k" }, [el("div", { text: d.date.slice(8) }), el("div", { class: "muted", style: "font-size:11px", text: fmtDate(d.date) })]),
        el("div", { class: "v" }, [
          el("div", { text: `${d.in || "--:--"} → ${d.out || "--:--"} · ${minToHHMM(d.workMinutes)}${d.otMinutes ? ` · ${t("otWord")} ${minToHHMM(d.otMinutes)}` : ""} · ${statusWord(d.status)}` }),
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

// ---- FR-05 Tasks ---------------------------------------------------------------
function canAssignTasks() { return ["manager", "hr_admin", "hr_executive", "super_admin"].includes(state.role); }

async function loadTasksView() {
  const body = document.getElementById("body"); clear(body);
  body.appendChild(el("div", { class: "card", id: "tk_new" }, [h2help(t("newTask"), t("tasks_help"))]));
  body.appendChild(el("div", { class: "card", id: "tk_mine" }, [el("h2", { text: t("myTasks") }), el("div", { class: "muted", text: "…" })]));
  if (canAssignTasks()) body.appendChild(el("div", { class: "card", id: "tk_assigned" }, [el("h2", { text: t("assignedByMe") }), el("div", { class: "muted", text: "…" })]));
  renderTaskForm();
  loadMyTasks();
  if (canAssignTasks()) loadAssignedTasks();
}

async function renderTaskForm() {
  const card = document.getElementById("tk_new"); if (!card) return;
  clear(card); card.appendChild(h2help(t("newTask"), t("tasks_help")));
  const title = el("input", { placeholder: t("title") });
  const desc = el("input", { placeholder: t("description") });
  const due = el("input", { type: "date" });
  const prio = el("select", {}); for (const p of ["low", "medium", "high"]) prio.appendChild(el("option", { value: p, text: t("prio_" + p), ...(p === "medium" ? { selected: "" } : {}) }));
  const kids = [el("label", { text: t("title") }), title, el("label", { text: t("description") }), desc];
  let assignee = null;
  if (canAssignTasks()) {
    assignee = el("select", {});
    assignee.appendChild(el("option", { value: "", text: t("myself") }));
    try { const dir = await api("/api/directory"); for (const e of dir.entries) assignee.appendChild(el("option", { value: e.id, text: e.name })); } catch { /* keep self only */ }
    kids.push(el("label", { text: t("assignTo") }), assignee);
  }
  kids.push(el("label", { text: t("dueDate") }), due, el("label", { text: t("priority") }), prio);
  const btn = el("button", { class: "primary", text: t("addTask") });
  btn.addEventListener("click", async () => {
    if (!title.value.trim()) return; btn.disabled = true;
    try {
      await api("/api/tasks", { method: "POST", body: { title: title.value, description: desc.value, assigneeEmployeeId: assignee && assignee.value ? assignee.value : undefined, dueDate: due.value || undefined, priority: prio.value } });
      flash("ok", t("saved")); title.value = ""; desc.value = ""; due.value = "";
      loadMyTasks(); if (canAssignTasks()) loadAssignedTasks();
    } catch (ex) { flash("err", ex.message); } finally { btn.disabled = false; }
  });
  kids.push(el("div", { class: "actions", style: "margin-top:10px" }, [btn]));
  card.appendChild(el("div", { class: "stack" }, kids));
}

async function updTask(id, body) {
  try { await api(`/api/tasks/${encodeURIComponent(id)}`, { method: "POST", body }); flash("ok", t("saved")); loadMyTasks(); if (canAssignTasks()) loadAssignedTasks(); }
  catch (ex) { flash("err", ex.message); }
}

function myTaskRow(tk) {
  const meta = [el("span", { class: "pill", text: t("tstatus_" + tk.status) })];
  if (tk.overdue) meta.push(el("span", { class: "pill rejected", text: t("overdue") }));
  if (tk.dueDate) meta.push(el("span", { class: "muted", style: "font-size:12px", text: tk.dueDate }));
  meta.push(el("span", { class: "muted", style: "font-size:12px", text: t("prio_" + tk.priority) }));
  const acts = el("div", { class: "actions", style: "margin-top:6px" });
  const isOpen = tk.status === "open" || tk.status === "in_progress";
  if (tk.status === "open") acts.appendChild(el("button", { class: "sm", text: t("markInProgress"), onclick: () => updTask(tk.id, { status: "in_progress" }) }));
  if (isOpen) acts.appendChild(el("button", { class: "primary sm", text: t("markDone"), onclick: () => updTask(tk.id, { status: "done" }) }));
  const ev = el("input", { placeholder: t("evidenceLabel"), value: tk.evidence || "" });
  const evb = el("button", { class: "sm", text: t("save"), onclick: () => updTask(tk.id, { evidence: ev.value }) });
  return el("div", { class: "row" }, [
    el("div", { class: "k" }, [el("div", { style: "font-weight:600", text: tk.title }), tk.assignedByName ? el("div", { class: "muted", style: "font-size:12px", text: `${t("assignedBy")}: ${tk.assignedByName}` }) : null, tk.description ? el("div", { class: "muted", style: "font-size:12px", text: tk.description }) : null]),
    el("div", { class: "v stack" }, [el("div", { class: "actions" }, meta), acts, el("div", { class: "actions" }, [el("div", { class: "grow" }, [ev]), evb])]),
  ]);
}

async function loadMyTasks() {
  const card = document.getElementById("tk_mine"); if (!card) return;
  try {
    const { tasks } = await api("/api/tasks");
    clear(card); card.appendChild(el("h2", { text: t("myTasks") }));
    if (!tasks.length) { card.appendChild(el("div", { class: "muted", text: t("noTasks") })); return; }
    for (const tk of tasks) card.appendChild(myTaskRow(tk));
  } catch (ex) { flash("err", ex.message); }
}

async function loadAssignedTasks() {
  const card = document.getElementById("tk_assigned"); if (!card) return;
  try {
    const { tasks } = await api("/api/tasks/assigned");
    clear(card); card.appendChild(el("h2", { text: t("assignedByMe") }));
    if (!tasks.length) { card.appendChild(el("div", { class: "muted", text: t("noTasks") })); return; }
    for (const tk of tasks) {
      const meta = [el("span", { class: "pill", text: t("tstatus_" + tk.status) })];
      if (tk.overdue) meta.push(el("span", { class: "pill rejected", text: t("overdue") }));
      if (tk.dueDate) meta.push(el("span", { class: "muted", style: "font-size:12px", text: tk.dueDate }));
      card.appendChild(el("div", { class: "row" }, [el("div", { class: "k" }, [el("div", { style: "font-weight:600", text: tk.title }), el("div", { class: "muted", style: "font-size:12px", text: tk.assigneeName || "" })]), el("div", { class: "v" }, [el("div", { class: "actions" }, meta)])]));
    }
  } catch (ex) { flash("err", ex.message); }
}

// ---- FR-06 Documents -----------------------------------------------------------
function canManageDocs() { return ["hr_admin", "hr_executive", "super_admin"].includes(state.role); }
function docCatLabel(c) { return t("doc_" + c); }
function readFileDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("read failed")); r.readAsDataURL(file); }); }

async function loadDocumentsView() {
  const body = document.getElementById("body"); clear(body);
  body.appendChild(el("div", { class: "card", id: "doc_mine" }, [h2help(t("navDocuments"), t("documents_help")), el("div", { class: "muted", text: "…" })]));
  body.appendChild(el("div", { class: "card", id: "doc_detail", style: "display:none" }));
  if (canManageDocs()) {
    body.appendChild(el("div", { class: "card", id: "doc_new" }, [el("h2", { text: t("publishDocument") })]));
    body.appendChild(el("div", { class: "card", id: "doc_admin" }, [el("h2", { text: t("allDocuments") }), el("div", { class: "muted", text: "…" })]));
  }
  loadMyDocuments();
  if (canManageDocs()) { renderDocForm(); loadDocAdmin(); }
}

async function loadMyDocuments() {
  const card = document.getElementById("doc_mine"); if (!card) return;
  try {
    const { documents } = await api("/api/documents");
    clear(card); card.appendChild(h2help(t("navDocuments"), t("documents_help")));
    if (!documents.length) { card.appendChild(el("div", { class: "muted", text: t("noDocuments") })); return; }
    for (const d of documents) {
      card.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k" }, [el("div", { style: "font-weight:600", text: d.title }), el("div", { class: "muted", style: "font-size:12px", text: `${docCatLabel(d.category)} · ${d.published_at || ""}` })]),
        el("div", { class: "v" }, [el("div", { class: "actions" }, [el("button", { class: "sm", text: t("openDoc"), onclick: () => openDoc(d.id) })])]),
      ]));
    }
  } catch (ex) { flash("err", ex.message); }
}

async function openDoc(id) {
  try {
    const { document: d } = await api(`/api/documents/${encodeURIComponent(id)}`);
    if (d.file) {
      const a = document.createElement("a"); a.href = d.file; a.download = d.title || "document"; a.target = "_blank";
      document.body.appendChild(a); a.click(); a.remove();
    } else {
      const card = document.getElementById("doc_detail");
      if (card) { card.style.display = "block"; clear(card); card.appendChild(el("h2", { text: d.title })); card.appendChild(el("div", { style: "white-space:pre-wrap", text: d.body || "" })); card.scrollIntoView({ behavior: "smooth", block: "center" }); }
    }
  } catch (ex) { flash("err", ex.message); }
}

async function renderDocForm() {
  const card = document.getElementById("doc_new"); if (!card) return;
  clear(card); card.appendChild(el("h2", { text: t("publishDocument") }));
  const emp = el("select", {});
  try { const dir = await api("/api/directory"); for (const e of dir.entries) emp.appendChild(el("option", { value: e.id, text: e.name })); } catch { /* none */ }
  const title = el("input", { placeholder: t("title") });
  const cat = el("select", {}); for (const c of ["payslip", "letter", "policy", "other"]) cat.appendChild(el("option", { value: c, text: t("doc_" + c) }));
  const bodyi = el("input", { placeholder: t("docBodyOptional") });
  const file = el("input", { type: "file", accept: "application/pdf,image/*" });
  const pub = el("input", { type: "checkbox" });
  const pubWrap = el("label", { style: "display:flex;gap:8px;align-items:center;margin:8px 0 0" }, [pub, " " + t("publishNow")]);
  const btn = el("button", { class: "primary", text: t("save") });
  btn.addEventListener("click", async () => {
    if (!emp.value || !title.value.trim()) return; btn.disabled = true;
    try {
      let fileData;
      if (file.files && file.files[0]) {
        if (file.files[0].size > 1500000) { flash("err", t("fileTooLarge")); btn.disabled = false; return; }
        fileData = await readFileDataURL(file.files[0]);
      }
      await api("/api/admin/documents", { method: "POST", body: { employeeId: emp.value, title: title.value, category: cat.value, body: bodyi.value || undefined, file: fileData, status: pub.checked ? "published" : "draft" } });
      flash("ok", t("saved")); title.value = ""; bodyi.value = ""; file.value = ""; pub.checked = false; loadDocAdmin();
    } catch (ex) { flash("err", ex.message); } finally { btn.disabled = false; }
  });
  card.appendChild(el("div", { class: "stack" }, [el("label", { text: t("forEmployee") }), emp, el("label", { text: t("title") }), title, el("label", { text: t("category") }), cat, el("label", { text: t("docBodyOptional") }), bodyi, el("label", { text: t("attachFile") }), file, pubWrap, el("div", { class: "actions", style: "margin-top:10px" }, [btn])]));
}

async function loadDocAdmin() {
  const card = document.getElementById("doc_admin"); if (!card) return;
  try {
    const { documents } = await api("/api/admin/documents");
    clear(card); card.appendChild(el("h2", { text: t("allDocuments") }));
    if (!documents.length) { card.appendChild(el("div", { class: "muted", text: t("noDocuments") })); return; }
    for (const d of documents) {
      const acts = el("div", { class: "actions" }, [
        el("span", { class: "pill " + (d.status === "published" ? "approved" : "pending"), text: t("dstatus_" + d.status) }),
        el("span", { class: "muted", style: "font-size:12px", text: `${docCatLabel(d.category)} · ${d.employee_name || d.employee_id}` }),
      ]);
      if (d.status !== "published") acts.appendChild(el("button", { class: "sm", text: t("publish"), onclick: async () => { try { await api(`/api/admin/documents/${encodeURIComponent(d.id)}/publish`, { method: "POST" }); loadDocAdmin(); } catch (ex) { flash("err", ex.message); } } }));
      acts.appendChild(el("button", { class: "sm", text: t("remove"), onclick: async () => { try { await api(`/api/admin/documents/${encodeURIComponent(d.id)}/delete`, { method: "POST" }); loadDocAdmin(); } catch (ex) { flash("err", ex.message); } } }));
      card.appendChild(el("div", { class: "row" }, [el("div", { class: "k", text: d.title }), el("div", { class: "v" }, [acts])]));
    }
  } catch (ex) { flash("err", ex.message); }
}

// ---- Payroll core — P6a: salary setup (component catalog + employee salary) -----
// Money shown in ₹; stored as paise. Percent shown as %, stored as basis points.
async function loadPayrollView() {
  const body = document.getElementById("body");
  clear(body);
  body.appendChild(el("div", { class: "card" }, [
    h2help(t("navPayroll"), t("payroll_help")),
    el("div", { class: "muted", style: "font-size:13px", text: t("payroll_setup_note") }),
  ]));
  body.appendChild(el("div", { class: "card", id: "pay_run" }, [h2help(t("payrollRun"), t("payroll_run_help")), el("div", { class: "muted", text: "…" })]));
  body.appendChild(el("div", { class: "card", id: "pay_emp" }, [h2help(t("employeeSalary"), t("emp_salary_help")), el("div", { class: "muted", text: "…" })]));
  body.appendChild(el("div", { class: "card", id: "pay_cat" }, [h2help(t("componentsCatalog"), t("catalog_help")), el("div", { class: "muted", text: "…" })]));
  loadPayrollRunCard();
  await loadEmployeeSalaryCard();
  loadComponentCatalog();
}

async function downloadAuthed(path, filename) {
  try {
    const res = await fetch(path, { headers: state.token ? { Authorization: `Bearer ${state.token}` } : {} });
    if (!res.ok) { flash("err", t("errorGeneric")); return; }
    const blob = await res.blob();
    const a = el("a", { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a); a.click(); a.remove();
  } catch (ex) { flash("err", ex.message); }
}

async function loadPayrollRunCard() {
  const card = document.getElementById("pay_run");
  if (!card) return;
  clear(card); card.appendChild(h2help(t("payrollRun"), t("payroll_run_help")));
  const month = el("input", { type: "month", value: state.payMonth || new Date().toISOString().slice(0, 7), style: "width:auto" });
  state.payMonth = month.value;
  const prep = el("button", { class: "primary sm", text: t("prepareRun") });
  const detail = el("div", { id: "pay_run_detail", style: "margin-top:10px" });
  month.addEventListener("change", () => { state.payMonth = month.value; refreshRun(); });
  prep.addEventListener("click", async () => {
    prep.disabled = true;
    try { const r = await api("/api/admin/payroll/runs", { method: "POST", body: { ym: state.payMonth } }); flash("ok", `${t("prepared")} · ${r.employees} · ${t("exceptionsWord")}: ${r.exceptions}`); refreshRun(); }
    catch (ex) { flash("err", ex.message); }
    finally { prep.disabled = false; }
  });
  card.appendChild(el("div", { class: "actions", style: "margin-bottom:8px" }, [el("label", { style: "margin:0", text: t("month") }), month, prep]));
  card.appendChild(detail);

  async function runAct(id, verb) {
    if (verb === "approve" && !confirm(t("confirmApprove"))) return;
    if (verb === "reopen" && !confirm(t("confirmReopen"))) return;
    try { await api(`/api/admin/payroll/runs/${encodeURIComponent(id)}/${verb}`, { method: "POST", body: {} }); flash("ok", t("saved")); refreshRun(); }
    catch (ex) { flash("err", ex.message); }
  }

  async function refreshRun() {
    clear(detail);
    try {
      const { runs } = await api(`/api/admin/payroll/runs?month=${encodeURIComponent(state.payMonth)}`);
      if (!runs || !runs.length) { detail.appendChild(el("div", { class: "muted", text: t("noRun") })); return; }
      const run = runs[0];
      const full = await api(`/api/admin/payroll/runs/${encodeURIComponent(run.id)}`);
      const r = full.run;
      detail.appendChild(el("div", { class: "actions", style: "margin-bottom:8px" }, [
        el("span", { text: `v${r.version}` }),
        el("span", { class: "pill " + (r.status === "locked" || r.status === "approved" ? "approved" : "pending"), text: r.status }),
        el("span", { text: `${r.employees} · ${t("monthlyGross")}: ${fmtINR((r.gross_paise || 0) / 100)} · ${t("netWord")}: ${fmtINR((r.net_paise || 0) / 100)}` }),
        r.exceptions ? el("span", { class: "pill pending", text: `${r.exceptions} ${t("exceptionsWord")}` }) : el("span", { class: "pill approved", text: t("noExceptions") }),
        el("button", { class: "sm", text: t("exportCsv"), onclick: () => downloadAuthed(`/api/admin/payroll/runs/${encodeURIComponent(run.id)}/register`, `payroll-${r.ym}.csv`) }),
      ]));
      detail.appendChild(el("div", { class: "muted", style: "font-size:12px", text: `${t("divisorWord")}: ${r.divisor}` }));
      // Maker-checker controls by status (server enforces permissions + separation of duties).
      const controls = [];
      if (r.status === "draft" && canPreparePay()) controls.push(el("button", { class: "sm", text: t("submitReview"), onclick: () => runAct(run.id, "submit-review") }));
      if (r.status === "in_review" && canApprovePay()) {
        controls.push(el("button", { class: "primary sm", text: t("approveLock"), onclick: () => runAct(run.id, "approve") }));
        controls.push(el("button", { class: "sm", text: t("reject"), onclick: () => runAct(run.id, "reject") }));
      }
      if (r.status === "locked") {
        if (canApprovePay()) controls.push(el("button", { class: "sm", text: t("reopen"), onclick: () => runAct(run.id, "reopen") }));
        controls.push(el("button", { class: "sm", text: t("bankAdvice"), onclick: () => downloadAuthed(`/api/admin/payroll/runs/${encodeURIComponent(run.id)}/bank`, `bank-advice-${r.ym}.csv`) }));
      }
      if (controls.length) detail.appendChild(el("div", { class: "actions", style: "margin:8px 0" }, controls));
      if (r.status === "locked") detail.appendChild(el("div", { class: "msg ok", style: "font-size:12px", text: t("payslipsPublished") }));
      for (const l of full.lines) {
        const exc = l.exception ? el("span", { class: "pill pending", style: "margin-left:6px", text: t("exc_" + l.exception) || l.exception }) : null;
        detail.appendChild(el("div", { class: "row" }, [
          el("div", { class: "k" }, [el("div", { text: l.employee_name }), el("div", { class: "muted", style: "font-size:11px", text: `${l.employed_days}d · LOP ${l.lop_days}${l.ot_minutes ? " · OT " + minToHHMM(l.ot_minutes) : ""}` })]),
          el("div", { class: "v" }, [el("span", { text: `${fmtINR((l.gross_paise || 0) / 100)} − ${fmtINR((l.deductions_paise || 0) / 100)} = ` }), el("b", { text: fmtINR((l.net_paise || 0) / 100) }), exc]),
        ]));
      }
    } catch (ex) { detail.appendChild(el("div", { class: "msg err", text: ex.message })); }
  }
  refreshRun();
}

async function loadEmployeeSalaryCard() {
  const card = document.getElementById("pay_emp");
  if (!card) return;
  clear(card); card.appendChild(h2help(t("employeeSalary"), t("emp_salary_help")));
  try {
    const [emps, cat] = await Promise.all([api("/api/employees"), api("/api/admin/salary/components")]);
    const list = emps.employees || emps || [];
    const sel = el("select", { style: "max-width:260px" });
    sel.appendChild(el("option", { value: "", text: t("selectEmployee") }));
    for (const e of list) sel.appendChild(el("option", { value: e.id, text: `${e.name}${e.designation ? " · " + e.designation : ""}` }));
    const eff = el("input", { type: "date" });
    const grid = el("div", { id: "pay_comp_grid" });
    const gross = el("div", { class: "muted", style: "margin-top:6px;font-weight:600" });
    const save = el("button", { class: "primary sm", text: t("saveSalary"), disabled: "" });
    const history = el("div", { id: "pay_hist", style: "margin-top:10px" });

    function renderGrid() {
      clear(grid);
      grid.appendChild(el("div", { class: "row", style: "font-weight:600;font-size:12px" }, [el("div", { class: "k", text: t("component") }), el("div", { class: "v", text: t("amount") })]));
      for (const c of (cat.components || [])) {
        const isPct = c.calc_method === "percent_of_base";
        const inp = el("input", { type: "number", min: "0", step: isPct ? "0.1" : "1", "data-code": c.code, style: "max-width:140px" });
        grid.appendChild(el("div", { class: "row" }, [
          el("div", { class: "k" }, [el("div", { text: c.name }), el("div", { class: "muted", style: "font-size:11px", text: `${c.code} · ${t(c.kind)}${isPct ? " · % " + (c.base_code || "") : ""}` })]),
          el("div", { class: "v", style: "display:flex;align-items:center;gap:6px" }, [inp, el("span", { class: "muted", text: isPct ? "%" : "₹" })]),
        ]));
      }
      recalcGross();
    }
    function recalcGross() {
      // live gross estimate: sum earnings (fixed ₹ + percent% of its base ₹)
      const vals = {}; grid.querySelectorAll("input[data-code]").forEach((i) => { vals[i.getAttribute("data-code")] = Number(i.value) || 0; });
      let g = 0;
      for (const c of (cat.components || [])) {
        if (c.kind !== "earning") continue;
        if (c.calc_method === "percent_of_base") g += Math.round((vals[c.base_code] || 0) * 100 * (vals[c.code] || 0)) / 100;
        else g += (vals[c.code] || 0);
      }
      gross.textContent = `${t("monthlyGross")}: ${fmtINR(g)}`;
    }
    grid.addEventListener("input", recalcGross);

    async function loadHistory(empId) {
      clear(history);
      if (!empId) return;
      try {
        const { salaries } = await api(`/api/admin/employees/${encodeURIComponent(empId)}/salary`);
        if (!salaries || !salaries.length) { history.appendChild(el("div", { class: "muted", text: t("noSalary") })); return; }
        history.appendChild(el("div", { class: "muted", style: "font-size:12px;margin-bottom:4px", text: t("salaryHistory") }));
        for (const s of salaries) {
          const tag = s.status === "active" ? el("span", { class: "pill approved", text: t("active") }) : el("span", { class: "pill", text: s.status });
          history.appendChild(el("div", { class: "row" }, [
            el("div", { class: "k" }, [el("div", { text: `${t("revision")} ${s.revision_no}` }), el("div", { class: "muted", style: "font-size:11px", text: `${fmtDate(s.effective_from)} → ${s.effective_to ? fmtDate(s.effective_to) : "…"}` })]),
            el("div", { class: "v" }, [el("span", { text: fmtINR((s.monthly_gross_paise || 0) / 100) }), el("span", { style: "margin-left:8px" }, [tag])]),
          ]));
        }
      } catch (ex) { history.appendChild(el("div", { class: "msg err", text: ex.message })); }
    }

    sel.addEventListener("change", () => { save.disabled = !sel.value; loadHistory(sel.value); });
    save.addEventListener("click", async () => {
      if (!sel.value || !eff.value) { flash("err", t("selectEmployeeDate")); return; }
      const components = [];
      for (const c of (cat.components || [])) {
        const inp = grid.querySelector(`input[data-code="${c.code}"]`);
        const raw = inp && inp.value !== "" ? Number(inp.value) : null;
        if (raw == null || raw < 0) continue;
        const value = c.calc_method === "percent_of_base" ? Math.round(raw * 100) : Math.round(raw * 100); // %→bps, ₹→paise (both ×100)
        components.push({ code: c.code, name: c.name, kind: c.kind, calcMethod: c.calc_method, value, baseCode: c.base_code, prorates: !!c.prorates, taxable: !!c.taxable, statutory: !!c.statutory, sequence: c.sequence });
      }
      if (!components.some((c) => c.kind === "earning" && c.value > 0)) { flash("err", t("needEarning")); return; }
      save.disabled = true;
      try { await api(`/api/admin/employees/${encodeURIComponent(sel.value)}/salary`, { method: "POST", body: { effectiveFrom: eff.value, components } }); flash("ok", t("saved")); loadHistory(sel.value); }
      catch (ex) { flash("err", ex.message); }
      finally { save.disabled = false; }
    });

    card.appendChild(el("div", { class: "actions", style: "margin-bottom:8px" }, [el("label", { style: "margin:0", text: t("selectEmployee") }), sel, el("label", { style: "margin:0 0 0 8px", text: t("effectiveFrom") }), eff]));
    card.appendChild(grid);
    card.appendChild(el("div", { class: "actions", style: "margin-top:8px" }, [gross, save]));
    card.appendChild(history);
    renderGrid();
  } catch (ex) { card.appendChild(el("div", { class: "msg err", text: ex.message })); }
}

async function loadComponentCatalog() {
  const card = document.getElementById("pay_cat");
  if (!card) return;
  clear(card); card.appendChild(h2help(t("componentsCatalog"), t("catalog_help")));
  const code = el("input", { placeholder: "CODE", style: "max-width:110px;text-transform:uppercase" });
  const name = el("input", { placeholder: t("component"), style: "max-width:160px" });
  const kind = el("select", {}); for (const [v, k] of [["earning", "earning"], ["deduction", "deduction"]]) kind.appendChild(el("option", { value: v, text: t(k) }));
  const add = el("button", { class: "sm", text: t("addComponent") });
  add.addEventListener("click", async () => {
    if (!code.value.trim()) { flash("err", "code"); return; }
    add.disabled = true;
    try { await api("/api/admin/salary/components", { method: "POST", body: { code: code.value.trim().toUpperCase(), name: name.value.trim() || code.value.trim(), kind: kind.value, calcMethod: "fixed", prorates: kind.value === "earning", sequence: 50 } }); flash("ok", t("saved")); code.value = ""; name.value = ""; loadComponentCatalog(); loadEmployeeSalaryCard(); }
    catch (ex) { flash("err", ex.message); }
    finally { add.disabled = false; }
  });
  card.appendChild(el("div", { class: "actions", style: "margin-bottom:8px" }, [code, name, kind, add]));
  try {
    const { components } = await api("/api/admin/salary/components");
    for (const c of (components || [])) {
      card.appendChild(el("div", { class: "row" }, [
        el("div", { class: "k", text: c.code }),
        el("div", { class: "v" }, [el("span", { text: `${c.name} · ${t(c.kind)}${c.calc_method === "percent_of_base" ? " · % of " + (c.base_code || "") : ""}${c.statutory ? " · " + t("statutoryWord") : ""}${c.prorates ? "" : " · " + t("noProrate")}` })]),
      ]));
    }
  } catch (ex) { card.appendChild(el("div", { class: "msg err", text: ex.message })); }
}

// ---- boot ----------------------------------------------------------------------
if (state.token) renderApp(); else renderLogin();
