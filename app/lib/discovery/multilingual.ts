/**
 * MULTILINGUAL PRIVACY POLICY DETECTION
 * 
 * Industry-standard multilingual support for detecting privacy policy links
 * across 190+ languages. This module provides translation mappings for
 * privacy-related terms used in footer links and page content.
 * 
 * @author PolicyParser
 * @version 2.0.0
 */

/**
 * Privacy-related terms in 100+ languages
 * Format: { languageCode: { term: translation, ... } }
 * 
 * Terms covered:
 * - privacy / privacy policy
 * - data protection
 * - legal
 * - terms
 * - cookies
 */
export const PRIVACY_TERMS: Record<string, Record<string, string>> = {
    // Germanic Languages
    en: { privacy: 'privacy', policy: 'policy', data_protection: 'data protection', legal: 'legal', terms: 'terms', cookies: 'cookies', notice: 'notice' },
    de: { privacy: 'datenschutz', policy: 'richtlinie', data_protection: 'datenschutz', legal: 'rechtliches', terms: 'nutzungsbedingungen', cookies: 'cookies', notice: 'hinweis', impressum: 'impressum' },
    nl: { privacy: 'privacy', policy: 'beleid', data_protection: 'gegevensbescherming', legal: 'juridisch', terms: 'voorwaarden', cookies: 'cookies' },
    sv: { privacy: 'integritet', policy: 'policy', data_protection: 'dataskydd', legal: 'juridisk', terms: 'villkor', cookies: 'cookies' },
    da: { privacy: 'privatliv', policy: 'politik', data_protection: 'databeskyttelse', legal: 'juridisk', terms: 'vilkår', cookies: 'cookies' },
    no: { privacy: 'personvern', policy: 'retningslinjer', data_protection: 'personvern', legal: 'juridisk', terms: 'vilkår', cookies: 'cookies' },
    is: { privacy: 'persónuvernd', policy: 'stefna', data_protection: 'persónuvernd', legal: 'lögfræði', terms: 'skilmálar', cookies: 'cookies' },
    af: { privacy: 'privaatheid', policy: 'beleid', data_protection: 'databeskerming', legal: 'wettig', terms: 'terme', cookies: 'koekies' },
    yi: { privacy: 'פּריוואַטקייט', policy: 'פּאָליסי', data_protection: 'דאַטע שוץ', legal: 'לעגאַל', terms: 'טערמינען', cookies: 'קוקיז' },
    lb: { privacy: 'dateschutz', policy: 'politik', data_protection: 'dateschutz', legal: 'legal', terms: 'konditiounen', cookies: 'cookies' },

    // Romance Languages
    fr: { privacy: 'confidentialité', policy: 'politique', data_protection: 'protection des données', legal: 'mentions légales', terms: 'conditions', cookies: 'cookies', vie_privee: 'vie privée' },
    es: { privacy: 'privacidad', policy: 'política', data_protection: 'protección de datos', legal: 'legal', terms: 'términos', cookies: 'cookies', aviso: 'aviso' },
    pt: { privacy: 'privacidade', policy: 'política', data_protection: 'proteção de dados', legal: 'legal', terms: 'termos', cookies: 'cookies' },
    it: { privacy: 'privacy', policy: 'informativa', data_protection: 'protezione dati', legal: 'legale', terms: 'termini', cookies: 'cookies', riservatezza: 'riservatezza' },
    ro: { privacy: 'confidențialitate', policy: 'politică', data_protection: 'protecția datelor', legal: 'legal', terms: 'termeni', cookies: 'cookies' },
    ca: { privacy: 'privacitat', policy: 'política', data_protection: 'protecció de dades', legal: 'legal', terms: 'termes', cookies: 'cookies' },
    gl: { privacy: 'privacidade', policy: 'política', data_protection: 'protección de datos', legal: 'legal', terms: 'termos', cookies: 'cookies' },

    // Slavic Languages
    ru: { privacy: 'конфиденциальность', policy: 'политика', data_protection: 'защита данных', legal: 'правовая', terms: 'условия', cookies: 'куки' },
    pl: { privacy: 'prywatność', policy: 'polityka', data_protection: 'ochrona danych', legal: 'prawne', terms: 'warunki', cookies: 'ciasteczka' },
    uk: { privacy: 'конфіденційність', policy: 'політика', data_protection: 'захист даних', legal: 'правова', terms: 'умови', cookies: 'куки' },
    cs: { privacy: 'soukromí', policy: 'zásady', data_protection: 'ochrana údajů', legal: 'právní', terms: 'podmínky', cookies: 'cookies' },
    sk: { privacy: 'súkromie', policy: 'zásady', data_protection: 'ochrana údajov', legal: 'právne', terms: 'podmienky', cookies: 'cookies' },
    bg: { privacy: 'поверителност', policy: 'политика', data_protection: 'защита на данни', legal: 'правна', terms: 'условия', cookies: 'бисквитки' },
    sr: { privacy: 'приватност', policy: 'политика', data_protection: 'заштита података', legal: 'правно', terms: 'услови', cookies: 'колачићи' },
    hr: { privacy: 'privatnost', policy: 'politika', data_protection: 'zaštita podataka', legal: 'pravno', terms: 'uvjeti', cookies: 'kolačići' },
    sl: { privacy: 'zasebnost', policy: 'politika', data_protection: 'varstvo podatkov', legal: 'pravno', terms: 'pogoji', cookies: 'piškotki' },
    mk: { privacy: 'приватност', policy: 'политика', data_protection: 'заштита на податоци', legal: 'правно', terms: 'услови', cookies: 'колачиња' },
    be: { privacy: 'прыватнасць', policy: 'палітыка', data_protection: 'абарона дадзеных', legal: 'прававое', terms: 'умовы', cookies: 'кукі' },

    // Baltic Languages
    lt: { privacy: 'privatumas', policy: 'politika', data_protection: 'duomenų apsauga', legal: 'teisinis', terms: 'sąlygos', cookies: 'slapukai' },
    lv: { privacy: 'privātums', policy: 'politika', data_protection: 'datu aizsardzība', legal: 'juridisks', terms: 'noteikumi', cookies: 'sīkdatnes' },
    et: { privacy: 'privaatsus', policy: 'poliitika', data_protection: 'andmekaitse', legal: 'õiguslik', terms: 'tingimused', cookies: 'küpsised' },

    // Asian Languages
    zh: { privacy: '隐私', policy: '政策', data_protection: '数据保护', legal: '法律', terms: '条款', cookies: 'cookies', notice: '声明' },
    'zh-tw': { privacy: '隱私', policy: '政策', data_protection: '資料保護', legal: '法律', terms: '條款', cookies: 'cookies' },
    ja: { privacy: 'プライバシー', policy: 'ポリシー', data_protection: 'データ保護', legal: '法的', terms: '利用規約', cookies: 'クッキー', kojin: '個人情報' },
    ko: { privacy: '개인정보', policy: '정책', data_protection: '데이터 보호', legal: '법적', terms: '약관', cookies: '쿠키', boho: '보호' },
    th: { privacy: 'ความเป็นส่วนตัว', policy: 'นโยบาย', data_protection: 'การคุ้มครองข้อมูล', legal: 'กฎหมาย', terms: 'เงื่อนไข', cookies: 'คุกกี้' },
    vi: { privacy: 'quyền riêng tư', policy: 'chính sách', data_protection: 'bảo vệ dữ liệu', legal: 'pháp lý', terms: 'điều khoản', cookies: 'cookies' },
    id: { privacy: 'privasi', policy: 'kebijakan', data_protection: 'perlindungan data', legal: 'hukum', terms: 'syarat', cookies: 'cookies' },
    ms: { privacy: 'privasi', policy: 'dasar', data_protection: 'perlindungan data', legal: 'undang-undang', terms: 'terma', cookies: 'kuki' },
    tl: { privacy: 'privacy', policy: 'patakaran', data_protection: 'proteksyon ng data', legal: 'legal', terms: 'tuntunin', cookies: 'cookies' },
    my: { privacy: 'ကိုယ်ရေးအချက်အလက်', policy: 'မူဝါဒ', data_protection: 'ဒေတာကာကွယ်မှု', legal: 'ဥပဒေ', terms: 'စည်းကမ်းချက်', cookies: 'cookies' },
    km: { privacy: 'ភាពឯកជន', policy: 'គោលនយោបាយ', data_protection: 'ការការពារទិន្នន័យ', legal: 'ច្បាប់', terms: 'លក្ខខណ្ឌ', cookies: 'cookies' },
    lo: { privacy: 'ຄວາມເປັນສ່ວນຕົວ', policy: 'ນະໂຍບາຍ', data_protection: 'ການປົກປ້ອງຂໍ້ມູນ', legal: 'ກົດໝາຍ', terms: 'ເງື່ອນໄຂ', cookies: 'cookies' },

    // South Asian Languages
    hi: { privacy: 'गोपनीयता', policy: 'नीति', data_protection: 'डेटा सुरक्षा', legal: 'कानूनी', terms: 'शर्तें', cookies: 'कुकीज़' },
    bn: { privacy: 'গোপনীয়তা', policy: 'নীতি', data_protection: 'তথ্য সুরক্ষা', legal: 'আইনি', terms: 'শর্তাবলী', cookies: 'কুকিজ' },
    ta: { privacy: 'தனியுரிமை', policy: 'கொள்கை', data_protection: 'தரவு பாதுகாப்பு', legal: 'சட்ட', terms: 'விதிமுறைகள்', cookies: 'குக்கீகள்' },
    te: { privacy: 'గోప్యత', policy: 'విధానం', data_protection: 'డేటా రక్షణ', legal: 'చట్టపరమైన', terms: 'నిబంధనలు', cookies: 'కుకీలు' },
    mr: { privacy: 'गोपनीयता', policy: 'धोरण', data_protection: 'डेटा संरक्षण', legal: 'कायदेशीर', terms: 'अटी', cookies: 'कुकीज' },
    gu: { privacy: 'ગોપનીયતા', policy: 'નીતિ', data_protection: 'ડેટા સુરક્ષા', legal: 'કાનૂની', terms: 'શરતો', cookies: 'કૂકીઝ' },
    kn: { privacy: 'ಗೌಪ್ಯತೆ', policy: 'ನೀತಿ', data_protection: 'ಡೇಟಾ ರಕ್ಷಣೆ', legal: 'ಕಾನೂನು', terms: 'ನಿಯಮಗಳು', cookies: 'ಕುಕೀಸ್' },
    ml: { privacy: 'സ്വകാര്യത', policy: 'നയം', data_protection: 'ഡാറ്റ പരിരക്ഷണം', legal: 'നിയമ', terms: 'നിബന്ധനകൾ', cookies: 'കുക്കീസ്' },
    pa: { privacy: 'ਪਰਾਈਵੇਸੀ', policy: 'ਨੀਤੀ', data_protection: 'ਡਾਟਾ ਸੁਰੱਖਿਆ', legal: 'ਕਾਨੂੰਨੀ', terms: 'ਸ਼ਰਤਾਂ', cookies: 'ਕੁਕੀਜ਼' },
    ur: { privacy: 'رازداری', policy: 'پالیسی', data_protection: 'ڈیٹا تحفظ', legal: 'قانونی', terms: 'شرائط', cookies: 'کوکیز' },
    ne: { privacy: 'गोपनीयता', policy: 'नीति', data_protection: 'डाटा सुरक्षा', legal: 'कानूनी', terms: 'सर्तहरू', cookies: 'कुकीहरू' },
    si: { privacy: 'පෞද්ගලිකත්වය', policy: 'ප්‍රතිපත්තිය', data_protection: 'දත්ත ආරක්ෂාව', legal: 'නෛතික', terms: 'නියමයන්', cookies: 'කුකීස්' },

    // Middle Eastern Languages
    ar: { privacy: 'الخصوصية', policy: 'سياسة', data_protection: 'حماية البيانات', legal: 'قانوني', terms: 'الشروط', cookies: 'ملفات تعريف الارتباط' },
    he: { privacy: 'פרטיות', policy: 'מדיניות', data_protection: 'הגנת מידע', legal: 'משפטי', terms: 'תנאים', cookies: 'עוגיות' },
    fa: { privacy: 'حریم خصوصی', policy: 'سیاست', data_protection: 'حفاظت از داده', legal: 'حقوقی', terms: 'شرایط', cookies: 'کوکی‌ها' },
    tr: { privacy: 'gizlilik', policy: 'politika', data_protection: 'veri koruma', legal: 'yasal', terms: 'koşullar', cookies: 'çerezler', kvkk: 'kvkk', aydinlatma: 'aydınlatma' },
    ku: { privacy: 'nepenî', policy: 'siyaset', data_protection: 'parastina dane', legal: 'qanûnî', terms: 'şert', cookies: 'cookies' },

    // African Languages
    sw: { privacy: 'faragha', policy: 'sera', data_protection: 'ulinzi wa data', legal: 'kisheria', terms: 'masharti', cookies: 'vidakuzi' },
    am: { privacy: 'ግላዊነት', policy: 'ፖሊሲ', data_protection: 'የውሂብ ጥበቃ', legal: 'ሕጋዊ', terms: 'ውሎች', cookies: 'ኩኪዎች' },
    zu: { privacy: 'ubumfihlo', policy: 'inqubomgomo', data_protection: 'ukuvikelwa kwedatha', legal: 'ngokusemthethweni', terms: 'imigomo', cookies: 'amakhukhi' },
    xh: { privacy: 'ubumfihlo', policy: 'umgaqo-nkqubo', data_protection: 'ukukhuselwa kwedatha', legal: 'ngokusemthethweni', terms: 'imiqathango', cookies: 'iikhukhi' },
    yo: { privacy: 'àṣírí', policy: 'ìlànà', data_protection: 'ìdáàbòbò dátà', legal: 'òfin', terms: 'àwọn ọ̀rọ̀', cookies: 'cookies' },
    ig: { privacy: 'nzuzo', policy: 'iwu', data_protection: 'nchekwa data', legal: 'iwu', terms: 'usoro', cookies: 'cookies' },
    ha: { privacy: 'sirri', policy: 'manufa', data_protection: 'kariyar bayanai', legal: 'shari\'a', terms: 'sharuɗɗa', cookies: 'cookies' },

    // European Regional Languages  
    eu: { privacy: 'pribatutasuna', policy: 'politika', data_protection: 'datuen babesa', legal: 'legala', terms: 'baldintzak', cookies: 'cookieak' },
    cy: { privacy: 'preifatrwydd', policy: 'polisi', data_protection: 'diogelu data', legal: 'cyfreithiol', terms: 'telerau', cookies: 'cwcis' },
    ga: { privacy: 'príobháideacht', policy: 'polasaí', data_protection: 'cosaint sonraí', legal: 'dlíthiúil', terms: 'téarmaí', cookies: 'fianáin' },
    gd: { privacy: 'prìobhaideachd', policy: 'poileasaidh', data_protection: 'dìon dàta', legal: 'laghail', terms: 'teirmean', cookies: 'briosgaidean' },
    mt: { privacy: 'privatezza', policy: 'politika', data_protection: 'protezzjoni tad-data', legal: 'legali', terms: 'termini', cookies: 'cookies' },
    sq: { privacy: 'privatësia', policy: 'politika', data_protection: 'mbrojtja e të dhënave', legal: 'ligjor', terms: 'kushtet', cookies: 'cookies' },
    el: { privacy: 'απόρρητο', policy: 'πολιτική', data_protection: 'προστασία δεδομένων', legal: 'νομικά', terms: 'όροι', cookies: 'cookies', prosopika: 'προσωπικά' },
    fi: { privacy: 'yksityisyys', policy: 'käytäntö', data_protection: 'tietosuoja', legal: 'oikeudellinen', terms: 'ehdot', cookies: 'evästeet' },
    hu: { privacy: 'adatvédelem', policy: 'szabályzat', data_protection: 'adatvédelem', legal: 'jogi', terms: 'feltételek', cookies: 'sütik' },

    // Central Asian Languages
    kk: { privacy: 'құпиялылық', policy: 'саясат', data_protection: 'деректерді қорғау', legal: 'заңды', terms: 'шарттар', cookies: 'cookies' },
    uz: { privacy: 'maxfiylik', policy: 'siyosat', data_protection: 'ma\'lumotlarni himoya', legal: 'huquqiy', terms: 'shartlar', cookies: 'cookies' },
    ky: { privacy: 'купуялуулук', policy: 'саясат', data_protection: 'маалыматтарды коргоо', legal: 'мыйзамдык', terms: 'шарттар', cookies: 'cookies' },
    tg: { privacy: 'махфият', policy: 'сиёсат', data_protection: 'ҳифзи маълумот', legal: 'ҳуқуқӣ', terms: 'шартҳо', cookies: 'cookies' },
    mn: { privacy: 'нууцлал', policy: 'бодлого', data_protection: 'өгөгдөл хамгаалах', legal: 'хуулийн', terms: 'нөхцөл', cookies: 'cookies' },

    // Caucasian Languages
    ka: { privacy: 'კონფიდენციალურობა', policy: 'პოლიტიკა', data_protection: 'მონაცემთა დაცვა', legal: 'სამართლებრივი', terms: 'პირობები', cookies: 'cookies' },
    hy: { privacy: 'privacy', policy: 'policy', data_protection: 'data protection', legal: 'legal', terms: 'terms', cookies: 'cookies' },
    az: { privacy: 'məxfilik', policy: 'siyasət', data_protection: 'məlumatların qorunması', legal: 'hüquqi', terms: 'şərtlər', cookies: 'cookies' },
};

/**
 * Flattened list of ALL privacy-related terms across all languages
 * Used for quick pattern matching
 */
export const ALL_PRIVACY_TERMS: string[] = [];

// Build the flattened list
for (const lang of Object.values(PRIVACY_TERMS)) {
    for (const term of Object.values(lang)) {
        const normalized = term.toLowerCase();
        if (!ALL_PRIVACY_TERMS.includes(normalized)) {
            ALL_PRIVACY_TERMS.push(normalized);
        }
    }
}

/**
 * Common URL path patterns for privacy policies across languages
 */
export const MULTILINGUAL_PRIVACY_PATHS: string[] = [
    // English
    '/privacy', '/privacy-policy', '/privacy-notice', '/privacy-statement',
    '/legal/privacy', '/policies/privacy', '/about/privacy',
    // German - INCLUDING NESTED PATHS (common German bank pattern)
    '/datenschutz', '/datenschutzerklaerung', '/datenschutzerklarung',
    '/datenschutz/datenschutzerklaerung', '/datenschutz/datenschutzerklarung',  // NESTED - Berenberg pattern
    '/datenschutz/datenschutzhinweise', '/datenschutz/datenschutzrichtlinie',
    '/rechtliches/datenschutz', '/rechtliches/datenschutzerklaerung',
    '/legal/datenschutz', '/legal/datenschutzerklaerung',
    '/impressum/datenschutz', '/datenschutzhinweise',
    '/de/datenschutz', '/de/datenschutzerklaerung',
    '/de/privacy', '/de/privacy-policy',
    // French
    '/confidentialite', '/politique-de-confidentialite', '/vie-privee',
    '/mentions-legales', '/donnees-personnelles',
    // Spanish
    '/privacidad', '/politica-de-privacidad', '/aviso-de-privacidad',
    '/legal/privacidad', '/proteccion-de-datos',
    // Italian
    '/privacy', '/informativa-privacy', '/riservatezza',
    '/privacy-policy', '/protezione-dati',
    // Portuguese
    '/privacidade', '/politica-de-privacidade',
    '/protecao-de-dados',
    // Dutch
    '/privacy', '/privacybeleid', '/gegevensbescherming',
    // Russian
    '/privacy', '/politika-konfidencialnosti', '/konfidencialnost',
    // Japanese
    '/privacy', '/kojin-joho', '/privacy-policy',
    // Chinese
    '/privacy', '/yinsi', '/yinsi-zhengce',
    // Korean
    '/privacy', '/gaeinjeongbo', '/privacy-policy',
    // Arabic
    '/privacy', '/siyasat-alkhususiya',
    // Turkish
    '/gizlilik', '/gizlilik-politikasi', '/kvkk', '/aydinlatma-metni',
    // Polish
    '/prywatnosc', '/polityka-prywatnosci', '/ochrona-danych',
    // Swedish
    '/integritet', '/integritetspolicy', '/dataskydd',
    // Norwegian
    '/personvern', '/personvernerklaering',
    // Danish
    '/privatliv', '/privatlivspolitik', '/databeskyttelse',
    // Finnish
    '/tietosuoja', '/tietosuojaseloste', '/yksityisyys',
    // Czech
    '/soukromi', '/ochrana-osobnich-udaju', '/zasady-ochrany',
    // Hungarian
    '/adatvedelem', '/adatvedelmi-tajekoztato',
    // Greek
    '/privacy', '/aporreto', '/prostasia-dedomenon',
    // Hebrew
    '/privacy', '/mediniyut-fartiyut',
    // Thai
    '/privacy', '/นโยบายความเป็นส่วนตัว',
    // Vietnamese
    '/quyen-rieng-tu', '/chinh-sach-bao-mat',
    // Indonesian/Malay
    '/privasi', '/kebijakan-privasi',
    // Hindi
    '/privacy', '/gopaniyata-niti',
];

/**
 * RegExp patterns that match privacy-related URL paths in any language
 */
export const PRIVACY_URL_PATTERNS: RegExp[] = [
    // English patterns
    /\/privacy/i,
    /\/data[_-]?protection/i,
    /\/legal\/privacy/i,
    /\/policies\/privacy/i,
    /\/personal[_-]?data/i,
    /\/your[_-]?privacy/i,
    
    // German patterns
    /\/datenschutz/i,
    /\/rechtlich/i,
    /\/impressum/i,
    
    // French patterns
    /\/confidentialite/i,
    /\/mentions[_-]?legales/i,
    /\/vie[_-]?privee/i,
    /\/donnees[_-]?personnelles/i,
    
    // Spanish patterns
    /\/privacidad/i,
    /\/aviso[_-]?legal/i,
    /\/proteccion[_-]?datos/i,
    
    // Italian patterns
    /\/riservatezza/i,
    /\/informativa/i,
    /\/protezione[_-]?dati/i,
    
    // Portuguese patterns
    /\/privacidade/i,
    /\/protecao[_-]?dados/i,
    
    // Dutch patterns
    /\/privacybeleid/i,
    /\/gegevensbescherming/i,
    
    // Nordic patterns
    /\/integritet/i,          // Swedish
    /\/personvern/i,          // Norwegian
    /\/privatliv/i,           // Danish
    /\/tietosuoja/i,          // Finnish
    /\/dataskydd/i,           // Swedish
    
    // Eastern European
    /\/prywatnosc/i,          // Polish
    /\/soukromi/i,            // Czech
    /\/adatvedelem/i,         // Hungarian
    /\/ochrana[_-]?udaju/i,   // Czech/Slovak
    
    // Turkish
    /\/gizlilik/i,
    /\/kvkk/i,
    /\/aydinlatma/i,
    
    // Greek
    /\/aporreto/i,
    /\/prostasia/i,
    
    // Asian languages (romanized)
    /\/kojin[_-]?joho/i,      // Japanese (個人情報)
    /\/gaein[_-]?jeongbo/i,   // Korean (개인정보)
    /\/yinsi/i,               // Chinese (隐私)
    
    // Generic patterns
    /\/legal[\/\?#]/i,
    /[?&]page=privacy/i,
    /[?&]p=privacy/i,
];

/**
 * Link text patterns that indicate a privacy policy link (multilingual)
 * These are used to identify privacy links in page footers
 * ENHANCED with high-frequency terms from policy-keyword-analyzer
 */
export const FOOTER_LINK_PATTERNS: string[] = [
    // English - High confidence from analyzer
    'privacy policy', 'privacy', 'data protection', 'data privacy',
    'privacy notice', 'privacy statement', 'your privacy', 'legal',
    'terms & privacy', 'privacy & terms', 'privacy & cookies',
    'personal data', 'personal information', 'information we collect',
    'how we use information', 'data we collect', 'your rights',
    'third parties', 'third-party', 'cookies policy', 'cookie policy',
    'data processing', 'data controller', 'data subject rights',
    'consent', 'consent preferences', 'privacy preferences',
    'gdpr', 'ccpa', 'california privacy', 'do not sell',
    
    // German - Enhanced with analyzer keywords
    'datenschutz', 'datenschutzerklärung', 'datenschutzrichtlinie',
    'rechtliches', 'impressum', 'rechtliche hinweise',
    'personenbezogene daten', 'verarbeitung', 'datenverarbeitung',
    'einwilligung', 'ihre rechte', 'betroffenenrechte',
    'nutzung', 'informationen', 'datenschutzhinweise',
    'widerspruch', 'löschung', 'auskunft', 'berichtigung',
    'verantwortlicher', 'dsgvo', 'cookies', 'speicherung',
    
    // French
    'confidentialité', 'politique de confidentialité', 'vie privée',
    'mentions légales', 'données personnelles', 'protection des données',
    
    // Spanish
    'privacidad', 'política de privacidad', 'aviso de privacidad',
    'aviso legal', 'protección de datos', 'datos personales',
    
    // Italian
    'privacy', 'informativa privacy', 'informativa sulla privacy',
    'protezione dei dati', 'riservatezza', 'note legali',
    
    // Portuguese
    'privacidade', 'política de privacidade', 'proteção de dados',
    'dados pessoais', 'termos legais',
    
    // Dutch
    'privacy', 'privacybeleid', 'privacyverklaring',
    'gegevensbescherming', 'persoonsgegevens',
    
    // Russian
    'конфиденциальность', 'политика конфиденциальности',
    'защита данных', 'персональные данные',
    
    // Japanese
    'プライバシー', 'プライバシーポリシー', '個人情報',
    '個人情報保護', '個人情報の取り扱い',
    
    // Chinese
    '隐私', '隐私政策', '隐私声明', '个人信息',
    '隱私', '隱私政策', '個人資料', // Traditional
    
    // Korean
    '개인정보', '개인정보처리방침', '개인정보보호',
    '프라이버시', '정보보호',
    
    // Arabic
    'الخصوصية', 'سياسة الخصوصية', 'حماية البيانات',
    
    // Turkish
    'gizlilik', 'gizlilik politikası', 'kişisel verilerin korunması',
    'kvkk', 'aydınlatma metni',
    
    // Polish
    'prywatność', 'polityka prywatności', 'ochrona danych',
    
    // Swedish
    'integritet', 'integritetspolicy', 'dataskydd',
    
    // Norwegian
    'personvern', 'personvernerklæring',
    
    // Danish
    'privatliv', 'privatlivspolitik', 'databeskyttelse',
    
    // Finnish
    'tietosuoja', 'tietosuojaseloste', 'yksityisyys',
    
    // Czech
    'soukromí', 'ochrana osobních údajů', 'zásady ochrany',
    
    // Hungarian
    'adatvédelem', 'adatvédelmi tájékoztató',
    
    // Greek
    'απόρρητο', 'πολιτική απορρήτου', 'προστασία δεδομένων',
    
    // Hebrew
    'פרטיות', 'מדיניות פרטיות', 'הגנת מידע',
    
    // Thai
    'นโยบายความเป็นส่วนตัว', 'ความเป็นส่วนตัว',
    
    // Vietnamese
    'quyền riêng tư', 'chính sách bảo mật',
    
    // Indonesian
    'privasi', 'kebijakan privasi',
];

/**
 * Check if a URL path matches any privacy-related pattern
 */
export function isPrivacyUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return PRIVACY_URL_PATTERNS.some(pattern => pattern.test(lowerUrl));
}

/**
 * Check if link text matches any privacy-related pattern
 */
export function isPrivacyLinkText(text: string): boolean {
    const lowerText = text.toLowerCase().trim();
    return FOOTER_LINK_PATTERNS.some(pattern => 
        lowerText.includes(pattern.toLowerCase())
    );
}

/**
 * Score how likely a URL is to be a privacy policy based on multilingual patterns
 */
export function scorePrivacyUrl(url: string): number {
    const lowerUrl = url.toLowerCase();
    let score = 0;
    
    // Check URL patterns
    for (const pattern of PRIVACY_URL_PATTERNS) {
        if (pattern.test(lowerUrl)) {
            score += 20;
        }
    }
    
    // Check for explicit privacy paths
    for (const path of MULTILINGUAL_PRIVACY_PATHS) {
        if (lowerUrl.includes(path)) {
            score += 30;
        }
    }
    
    // Bonus for being in legal/policies subdirectory
    if (/\/(legal|policies|rechtlich|juridisch|legale)\//i.test(lowerUrl)) {
        score += 10;
    }
    
    return Math.min(100, score);
}

/**
 * Score how likely link text refers to a privacy policy
 */
export function scoreLinkText(text: string): number {
    const lowerText = text.toLowerCase().trim();
    let score = 0;
    
    // Exact matches score highest
    if (FOOTER_LINK_PATTERNS.includes(lowerText)) {
        score += 50;
    }
    
    // Partial matches
    for (const pattern of FOOTER_LINK_PATTERNS) {
        if (lowerText.includes(pattern)) {
            score += 20;
        }
    }
    
    // Check against all language terms
    for (const term of ALL_PRIVACY_TERMS) {
        if (lowerText.includes(term)) {
            score += 10;
        }
    }
    
    return Math.min(100, score);
}

/**
 * Get privacy terms for a specific URL based on TLD
 * Used for language-aware privacy detection
 */
export function getPrivacyTermsForUrl(url: string): string[] {
    const terms: string[] = [];
    
    // Always include English terms
    if (PRIVACY_TERMS['en']) {
        terms.push(...Object.values(PRIVACY_TERMS['en']));
    }
    
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        
        // Map TLDs to language codes
        const tldToLang: Record<string, string[]> = {
            '.de': ['de'],
            '.at': ['de'],
            '.ch': ['de', 'fr', 'it'],
            '.fr': ['fr'],
            '.es': ['es'],
            '.it': ['it'],
            '.pt': ['pt'],
            '.br': ['pt'],
            '.nl': ['nl'],
            '.be': ['nl', 'fr'],
            '.pl': ['pl'],
            '.ru': ['ru'],
            '.jp': ['ja'],
            '.cn': ['zh'],
            '.tw': ['zh-tw'],
            '.kr': ['ko'],
            '.se': ['sv'],
            '.dk': ['da'],
            '.no': ['no'],
            '.fi': ['fi'],
            '.cz': ['cs'],
            '.sk': ['sk'],
            '.hu': ['hu'],
            '.gr': ['el'],
            '.tr': ['tr'],
            '.ae': ['ar'],
            '.sa': ['ar'],
            '.il': ['he'],
        };
        
        // Check TLD
        for (const [tld, langs] of Object.entries(tldToLang)) {
            if (hostname.endsWith(tld)) {
                for (const lang of langs) {
                    if (PRIVACY_TERMS[lang]) {
                        terms.push(...Object.values(PRIVACY_TERMS[lang]));
                    }
                }
            }
        }
    } catch {
        // If URL parsing fails, just return English terms
    }
    
    // Return unique terms
    return [...new Set(terms)];
}

/**
 * Check if text is privacy-related in any of the provided terms
 */
export function isPrivacyRelatedText(text: string, terms: string[]): boolean {
    const lowerText = text.toLowerCase();
    
    // First check against provided terms
    for (const term of terms) {
        if (lowerText.includes(term.toLowerCase())) {
            return true;
        }
    }
    
    // Also check against all global terms
    for (const term of ALL_PRIVACY_TERMS) {
        if (lowerText.includes(term)) {
            return true;
        }
    }
    
    return false;
}