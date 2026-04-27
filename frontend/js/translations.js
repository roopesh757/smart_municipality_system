// js/translations.js - Multi-language Support (English + Hindi)
const TRANSLATIONS = {
    en: {
        // Nav
        home: "Home",
        login: "Login",
        register: "Register",
        logout: "Logout",
        dashboard: "Dashboard",

        // Hero
        hero_badge: "🏛️ Official Municipality Portal",
        hero_title: "Smart Municipality Problem Reporting",
        hero_subtitle: "Report civic issues in your city. Track progress. Get results. Together we build better cities.",
        report_issue: "Report an Issue",
        admin_portal: "Admin Portal",

        // Features
        feat1_title: "Easy Reporting",
        feat1_desc: "Submit complaints with images, location, and priority in minutes.",
        feat2_title: "Real-time Tracking",
        feat2_desc: "Track complaint status from submission to resolution.",
        feat3_title: "Admin Dashboard",
        feat3_desc: "City officials manage, prioritize, and resolve issues efficiently.",
        feat4_title: "Notifications",
        feat4_desc: "Get instant alerts when your complaint status changes.",

        // Auth
        citizen_login: "Citizen Login",
        admin_login: "Admin Login",
        citizen_register: "Citizen Register",
        admin_register: "Admin Register",
        email: "Email Address",
        password: "Password",
        username: "Full Name",
        mobile: "Mobile Number",
        city: "City",
        ward: "Ward Number",
        sign_in: "Sign In",
        create_account: "Create Account",
        already_have_account: "Already have an account?",
        dont_have_account: "Don't have an account?",

        // Complaints
        my_complaints: "My Complaints",
        new_complaint: "New Complaint",
        complaint_title: "Complaint Title",
        description: "Description",
        problem_type: "Problem Type",
        location: "Location / Address",
        priority: "Priority Level",
        upload_image: "Upload Image",
        submit_complaint: "Submit Complaint",
        delete: "Delete",
        share: "Share",
        reattempt: "Re-attempt",

        // Status
        submitted: "Submitted",
        pending: "Pending",
        in_progress: "In Progress",
        solved: "Solved",
        rejected: "Rejected",

        // Priority
        low: "Low",
        medium: "Medium",
        high: "High",
        urgent: "Urgent",

        // Misc
        no_complaints: "No complaints found",
        loading: "Loading...",
        save: "Save",
        cancel: "Cancel",
        close: "Close",
        copy: "Copy",
        copied: "Copied!",
        search: "Search...",
        filter: "Filter",
        all: "All",
        notifications: "Notifications",
        mark_all_read: "Mark all read",
        no_notifications: "No notifications",
        attempt: "Attempt",
        of: "of",
        escalated: "Escalated",
        duplicate: "Duplicate",
        total: "Total",
        ward_wise: "Ward-wise Reports",
        problem_types: "By Problem Type",
    },
    hi: {
        // Nav
        home: "होम",
        login: "लॉगिन",
        register: "रजिस्टर",
        logout: "लॉगआउट",
        dashboard: "डैशबोर्ड",

        // Hero
        hero_badge: "🏛️ आधिकारिक नगर पालिका पोर्टल",
        hero_title: "स्मार्ट नगर पालिका समस्या रिपोर्टिंग",
        hero_subtitle: "अपने शहर में नागरिक समस्याएं रिपोर्ट करें। प्रगति ट्रैक करें। परिणाम पाएं।",
        report_issue: "समस्या रिपोर्ट करें",
        admin_portal: "प्रशासन पोर्टल",

        // Features
        feat1_title: "आसान रिपोर्टिंग",
        feat1_desc: "मिनटों में फोटो, स्थान और प्राथमिकता के साथ शिकायत दर्ज करें।",
        feat2_title: "रियल-टाइम ट्रैकिंग",
        feat2_desc: "सबमिशन से रिज़ॉल्यूशन तक शिकायत की स्थिति ट्रैक करें।",
        feat3_title: "प्रशासन डैशबोर्ड",
        feat3_desc: "नगर अधिकारी समस्याओं को कुशलतापूर्वक प्रबंधित और हल करते हैं।",
        feat4_title: "सूचनाएं",
        feat4_desc: "शिकायत की स्थिति बदलने पर तुरंत अलर्ट प्राप्त करें।",

        // Auth
        citizen_login: "नागरिक लॉगिन",
        admin_login: "प्रशासन लॉगिन",
        citizen_register: "नागरिक पंजीकरण",
        admin_register: "प्रशासन पंजीकरण",
        email: "ईमेल पता",
        password: "पासवर्ड",
        username: "पूरा नाम",
        mobile: "मोबाइल नंबर",
        city: "शहर",
        ward: "वार्ड संख्या",
        sign_in: "साइन इन",
        create_account: "खाता बनाएं",
        already_have_account: "पहले से खाता है?",
        dont_have_account: "खाता नहीं है?",

        // Complaints
        my_complaints: "मेरी शिकायतें",
        new_complaint: "नई शिकायत",
        complaint_title: "शिकायत का शीर्षक",
        description: "विवरण",
        problem_type: "समस्या का प्रकार",
        location: "स्थान / पता",
        priority: "प्राथमिकता स्तर",
        upload_image: "फोटो अपलोड करें",
        submit_complaint: "शिकायत दर्ज करें",
        delete: "हटाएं",
        share: "शेयर",
        reattempt: "पुनः प्रयास",

        // Status
        submitted: "दर्ज",
        pending: "लंबित",
        in_progress: "प्रगति में",
        solved: "हल",
        rejected: "अस्वीकृत",

        // Priority
        low: "कम",
        medium: "मध्यम",
        high: "उच्च",
        urgent: "अत्यावश्यक",

        // Misc
        no_complaints: "कोई शिकायत नहीं मिली",
        loading: "लोड हो रहा है...",
        save: "सहेजें",
        cancel: "रद्द करें",
        close: "बंद करें",
        copy: "कॉपी",
        copied: "कॉपी हो गया!",
        search: "खोजें...",
        filter: "फ़िल्टर",
        all: "सभी",
        notifications: "सूचनाएं",
        mark_all_read: "सभी पढ़े हुए मार्क करें",
        no_notifications: "कोई सूचना नहीं",
        attempt: "प्रयास",
        of: "में से",
        escalated: "एस्केलेट",
        duplicate: "डुप्लिकेट",
        total: "कुल",
        ward_wise: "वार्ड-वार रिपोर्ट",
        problem_types: "समस्या के प्रकार अनुसार",
    }
};

let currentLang = localStorage.getItem('lang') || 'en';

function t(key) {
    return TRANSLATIONS[currentLang][key] || TRANSLATIONS['en'][key] || key;
}

function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    // Update all elements with data-t attribute
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = t(key);
        } else {
            el.textContent = t(key);
        }
    });
    document.querySelectorAll('[data-t-val]').forEach(el => {
        const key = el.getAttribute('data-t-val');
        el.value = t(key);
    });
    // Update lang buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
}

// Apply translations on load
document.addEventListener('DOMContentLoaded', () => setLang(currentLang));
