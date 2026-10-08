// Hindi + Urdu voice commands → the English Ching's parsers understand.
// Pure, no network, no AI — the same rule-based approach as the rest of Ching.
//
// The browser's speech recognition hands us Hindi in Devanagari
// ("राहुल के लिए 10 नवंबर से 2 रात श्रीनगर ग्रैंड मुमताज़ ट्रिप बनाओ") and
// Urdu in Urdu script ("راہل کے لیے دو رات سرینگر"), and in English mode
// Hinglish / Roman Urdu ("rahul ke liye 2 raat srinagar trip banao").
// toEnglishCommand(text, catalog) turns all of these into
// "create trip for rahul 10 november 2 nights srinagar grand mumtaz":
//   1. native digits → 0-9; number words, months, trip vocabulary → English
//   2. the rest is transliterated (Devanagari with schwa deletion; Urdu
//      letter by letter) and "snapped" by sound to the agency's own hotel,
//      city, cab and activity names ("श्रीनगर" → srinagar, "گلمرگ" → gulmarg)
//      and to English loanwords ("नाइट्स" → nights)
//   3. Hindi/Urdu word order: "X ke liye" → "for X", "srinagar se gulmarg" →
//      "srinagar to gulmarg", a clause-final verb ("… gondola jodo") moves to
//      the front ("add … gondola").
// English text passes through unchanged.

const DEVA = /[\u0900-\u097F]/
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/

export function scriptOf(text) {
  const s = String(text || '')
  if (DEVA.test(s)) return 'deva'
  if (ARABIC.test(s)) return 'urdu'
  return 'latin'
}

// ── 1. digits ───────────────────────────────────────────────────────────────
function asciiDigits(s) {
  return s
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫]/g, '.')
    .replace(/[،؛۔।॥]/g, ',') // ، ؛ ۔ । ॥
    .replace(/؟/g, '?')
}

// ── 2. vocabulary (phrases first; matched on whole words) ───────────────────
// Number words.
const HI_NUM = {
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, छः: 6, छे: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
  ग्यारह: 11, बारह: 12, तेरह: 13, चौदह: 14, पंद्रह: 15, पन्द्रह: 15, सोलह: 16, सत्रह: 17, अठारह: 18,
  उन्नीस: 19, बीस: 20, इक्कीस: 21, बाईस: 22, तेईस: 23, चौबीस: 24, पच्चीस: 25, छब्बीस: 26, सत्ताईस: 27,
  अट्ठाईस: 28, उनतीस: 29, तीस: 30, इकतीस: 31, चालीस: 40, पचास: 50, साठ: 60, सत्तर: 70, अस्सी: 80, नब्बे: 90, सौ: 100,
}
const UR_NUM = {
  ایک: 1, دو: 2, تین: 3, چار: 4, پانچ: 5, چھ: 6, چھے: 6, سات: 7, آٹھ: 8, نو: 9, دس: 10, گیارہ: 11, بارہ: 12,
  تیرہ: 13, چودہ: 14, پندرہ: 15, سولہ: 16, سترہ: 17, اٹھارہ: 18, انیس: 19, بیس: 20, اکیس: 21, بائیس: 22,
  تئیس: 23, چوبیس: 24, پچیس: 25, چھبیس: 26, ستائیس: 27, اٹھائیس: 28, انتیس: 29, تیس: 30, اکتیس: 31,
  چالیس: 40, پچاس: 50, ساٹھ: 60, ستر: 70, اسی: 80, نوے: 90, سو: 100,
}
const ROMAN_NUM = {
  ek: 1, teen: 3, tin: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, chhah: 6, chay: 6, saat: 7, sat: 7,
  aath: 8, ath: 8, nau: 9, das: 10, gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15, solah: 16,
  satrah: 17, atharah: 18, unnis: 19, bees: 20, bis: 20, pachis: 25, pachees: 25, tees: 30, pachaas: 50, pachas: 50,
}
// Ordinal days: "तीसरे दिन" → "day 3".
const ORD = {
  पहले: 1, पहला: 1, पहली: 1, दूसरे: 2, दूसरा: 2, दूसरी: 2, तीसरे: 3, तीसरा: 3, तीसरी: 3, चौथे: 4, चौथा: 4, चौथी: 4,
  पांचवे: 5, पांचवें: 5, पाँचवें: 5, पांचवा: 5, छठे: 6, छठा: 6, सातवें: 7, सातवे: 7, आठवें: 8, आठवे: 8, नौवें: 9, दसवें: 10,
  پہلے: 1, پہلا: 1, پہلی: 1, دوسرے: 2, دوسرا: 2, دوسری: 2, تیسرے: 3, تیسرا: 3, تیسری: 3, چوتھے: 4, چوتھا: 4,
  پانچویں: 5, پانچواں: 5, چھٹے: 6, چھٹا: 6, ساتویں: 7, آٹھویں: 8, نویں: 9, دسویں: 10,
  pehle: 1, pehla: 1, pehli: 1, doosre: 2, dusre: 2, doosra: 2, teesre: 3, tisre: 3, teesra: 3, chauthe: 4, chautha: 4,
  paanchve: 5, panchve: 5, chhate: 6, chhathe: 6, saatve: 7, aathve: 8,
}
const MONTH = {
  जनवरी: 'january', फरवरी: 'february', मार्च: 'march', अप्रैल: 'april', अप्रेल: 'april', मई: 'may', जून: 'june',
  जुलाई: 'july', अगस्त: 'august', सितंबर: 'september', सितम्बर: 'september', अक्टूबर: 'october', अक्तूबर: 'october',
  नवंबर: 'november', नवम्बर: 'november', दिसंबर: 'december', दिसम्बर: 'december',
  جنوری: 'january', فروری: 'february', مارچ: 'march', اپریل: 'april', مئی: 'may', جون: 'june', جولائی: 'july',
  اگست: 'august', ستمبر: 'september', اکتوبر: 'october', نومبر: 'november', دسمبر: 'december',
}
// Words and phrases → English. "@" marks a word that only joins the sentence
// (dropped), "KELIYE" / "SE" / "VERB:x" are resolved by the reordering step.
const PHRASES = [
  // meals first: they contain "रात" (night) / "دن"
  ['रात का खाना', 'dinner'], ['रात के खाने', 'dinner'], ['दोपहर का खाना', 'lunch'], ['तीनों टाइम का खाना', 'all meals'],
  ['सारे खाने', 'all meals'], ['सिर्फ कमरा', 'room only'], ['केवल कमरा', 'room only'], ['बिना खाने', 'room only'],
  ['رات کا کھانا', 'dinner'], ['رات کے کھانے', 'dinner'], ['دوپہر کا کھانا', 'lunch'], ['تینوں وقت کا کھانا', 'all meals'],
  ['صرف کمرہ', 'room only'],
  ['raat ka khana', 'dinner'], ['raat ke khane', 'dinner'], ['dopahar ka khana', 'lunch'], ['sirf kamra', 'room only'],
  // connectors and postpositions
  ['के लिए', 'KELIYE'], ['के लिये', 'KELIYE'], ['की लिए', 'KELIYE'], ['کے لیے', 'KELIYE'], ['کے لئے', 'KELIYE'],
  ['ke liye', 'KELIYE'], ['ke liya', 'KELIYE'], ['k liye', 'KELIYE'], ['ke lie', 'KELIYE'], ['kay liye', 'KELIYE'],
  ['के साथ', 'with'], ['کے ساتھ', 'with'], ['ke saath', 'with'], ['ke sath', 'with'],
  ['प्रति व्यक्ति', 'per person'], ['फी व्यक्ति', 'per person'], ['فی کس', 'per person'], ['fi person', 'per person'],
  ['जीएसटी नहीं', 'no gst'], ['बिना जीएसटी', 'without gst'], ['جی ایس ٹی نہیں', 'no gst'], ['بغیر جی ایس ٹی', 'without gst'],
  ['जी एस टी', 'gst'], ['جی ایس ٹی', 'gst'], ['एक्स्ट्रा बेड', 'extra bed'], ['ایکسٹرا بیڈ', 'extra bed'],
  ['डे ट्रिप', 'day trip'], ['ڈے ٹرپ', 'day trip'], ['एयरपोर्ट पिकअप', 'airport pickup'], ['ایئرپورٹ پک اپ', 'airport pickup'],
  ['हो गया', 'done'], ['ہو گیا', 'done'],
  // questions to Ching ("کیا باقی ہے" = what's pending, "ٹوٹل کتنا ہے" = what's the total)
  ['کیا باقی ہے', 'what is pending'], ['کیا رہ گیا ہے', 'what is pending'], ['کیا رہ گیا', 'what is pending'], ['کیا بچا ہے', 'what is pending'],
  ['क्या बाकी है', 'what is pending'], ['क्या बाक़ी है', 'what is pending'], ['क्या बचा है', 'what is pending'], ['क्या रह गया है', 'what is pending'],
  ['क्या रह गया', 'what is pending'], ['kya baki hai', 'what is pending'], ['kya baaki hai', 'what is pending'], ['kya bacha hai', 'what is pending'],
  ['ٹوٹل کتنا', 'what is the total'], ['کل کتنا', 'what is the total'], ['کل رقم کتنی', 'what is the total'], ['قیمت کتنی', 'what is the total'],
  ['टोटल कितना', 'what is the total'], ['कुल कितना', 'what is the total'], ['कीमत कितनी', 'what is the total'], ['total kitna', 'what is the total'],
  ['منافع کتنا', 'what is my profit'], ['پرافٹ کتنا', 'what is my profit'], ['मुनाफा कितना', 'what is my profit'], ['मुनाफ़ा कितना', 'what is my profit'],
  ['प्रॉफिट कितना', 'what is my profit'], ['munafa kitna', 'what is my profit'], ['profit kitna', 'what is my profit'],
  // manners ("آپ کیسے ہیں" = how are you, "میں ٹھیک ہوں" = I am fine)
  ['आप कैसे हैं', 'how are you'], ['आप कैसे हो', 'how are you'], ['आप कैसी हैं', 'how are you'], ['कैसे हो', 'how are you'],
  ['कैसे हैं', 'how are you'], ['क्या हाल है', 'how are you'], ['क्या हाल हैं', 'how are you'], ['हाल चाल', 'how are you'],
  ['آپ کیسے ہیں', 'how are you'], ['آپ کیسے ہو', 'how are you'], ['آپ کیسی ہیں', 'how are you'], ['کیسے ہو', 'how are you'],
  ['کیسے ہیں', 'how are you'], ['کیا حال ہے', 'how are you'], ['حال چال', 'how are you'],
  ['kya haal hai', 'how are you'], ['kya hal hai', 'how are you'], ['kya haal chaal hai', 'how are you'], ['kaise hain', 'how are you'],
  ['मैं ठीक हूँ', 'i am fine'], ['मैं ठीक हूं', 'i am fine'], ['में ठीक हूँ', 'i am fine'], ['ठीक हूँ', 'i am fine'], ['ठीक हूं', 'i am fine'],
  ['मैं अच्छा हूँ', 'i am good'], ['मैं अच्छा हूं', 'i am good'], ['میں ٹھیک ہوں', 'i am fine'], ['ٹھیک ہوں', 'i am fine'],
  ['میں اچھا ہوں', 'i am good'], ['main theek hoon', 'i am fine'], ['main thik hu', 'i am fine'], ['main theek hu', 'i am fine'],
  ['जी हाँ', 'yes'], ['जी हां', 'yes'], ['جی ہاں', 'yes'], ['जी नहीं', 'no'], ['جی نہیں', 'no'],
  ['السلام علیکم', 'assalamu alaikum'], ['اسلام علیکم', 'assalamu alaikum'], ['अस्सलाम अलैकुम', 'assalamu alaikum'],
  ['अस्सलामु अलैकुम', 'assalamu alaikum'], ['خدا حافظ', 'khuda hafiz'], ['اللہ حافظ', 'allah hafiz'], ['खुदा हाफिज', 'khuda hafiz'],
  ['ख़ुदा हाफ़िज़', 'khuda hafiz'], ['الحمد للہ', 'alhamdulillah'],
  // email addresses ("राहुल एट जीमेल डॉट कॉम")
  ['ई मेल', 'email'], ['ای میل', 'email'], ['ای-میل', 'email'], ['एट द रेट', 'at the rate'], ['ایٹ دی ریٹ', 'at the rate'],
  ['जी मेल', 'gmail'], ['جی میل', 'gmail'], ['ہاٹ میل', 'hotmail'], ['हॉट मेल', 'hotmail'], ['آؤٹ لک', 'outlook'],
  ['ڈاٹ کام', 'dot com'], ['ڈاٹ ان', 'dot in'], ['ڈاٹ کو', 'dot co'], ['ڈاٹ او آر جی', 'dot org'], ['انڈر سکور', 'underscore'],
  ['डॉट कॉम', 'dot com'], ['डॉट इन', 'dot in'], ['डॉट को', 'dot co'], ['डॉट ओआरजी', 'dot org'], ['अंडर स्कोर', 'underscore'],
  // verbs (clause-final in Hindi/Urdu)
  ['बना दो', 'VERB:create'], ['बना दीजिए', 'VERB:create'], ['तैयार करो', 'VERB:create'], ['بنا دو', 'VERB:create'],
  ['تیار کرو', 'VERB:create'], ['bana do', 'VERB:create'], ['bana dijiye', 'VERB:create'], ['taiyar karo', 'VERB:create'],
  ['जोड़ दो', 'VERB:add'], ['जोड दो', 'VERB:add'], ['डाल दो', 'VERB:add'], ['ऐड करो', 'VERB:add'], ['एड करो', 'VERB:add'],
  ['शामिल करो', 'VERB:add'], ['جوڑ دو', 'VERB:add'], ['ڈال دو', 'VERB:add'], ['شامل کرو', 'VERB:add'], ['ایڈ کرو', 'VERB:add'],
  ['jod do', 'VERB:add'], ['daal do', 'VERB:add'], ['dal do', 'VERB:add'], ['add karo', 'VERB:add'], ['add kar do', 'VERB:add'],
  ['shamil karo', 'VERB:add'],
  ['बदल दो', 'VERB:change'], ['चेंज करो', 'VERB:change'], ['بدل دو', 'VERB:change'], ['badal do', 'VERB:change'],
  ['change karo', 'VERB:change'], ['हटा दो', 'VERB:remove'], ['ہٹا دو', 'VERB:remove'], ['hata do', 'VERB:remove'],
  ['कर दो', 'VERB:do'], ['कर दीजिए', 'VERB:do'], ['कर दें', 'VERB:do'], ['کر دو', 'VERB:do'], ['کر دیں', 'VERB:do'],
  ['کر دیجیے', 'VERB:do'], ['kar do', 'VERB:do'], ['kar dijiye', 'VERB:do'], ['kar den', 'VERB:do'], ['kardo', 'VERB:do'],
  ['भेज दो', 'VERB:send'], ['بھیج دو', 'VERB:send'], ['bhej do', 'VERB:send'],
]
const WORDS = {
  // units
  रात: 'nights', रातें: 'nights', रातों: 'nights', रात्रि: 'nights', नाइट: 'nights', नाइट्स: 'nights',
  دن: 'DAYWORD', दिन: 'DAYWORD', दिनों: 'days', डे: 'DAYWORD', डेज: 'days', دنوں: 'days',
  رات: 'nights', راتیں: 'nights', راتوں: 'nights', نائٹ: 'nights', نائٹس: 'nights',
  raat: 'nights', raaten: 'nights', raatein: 'nights', raton: 'nights', ratein: 'nights', rat: 'nights', din: 'DAYWORD', dino: 'days', dinon: 'days',
  हफ्ता: 'week', हफ्ते: 'week', ہفتہ: 'week', ہفتے: 'week', hafta: 'week', hafte: 'week',
  // people
  लोग: 'people', लोगों: 'people', व्यक्ति: 'people', आदमी: 'people', पैक्स: 'pax', पर्सन: 'people',
  वयस्क: 'adults', बड़े: 'adults', बडे: 'adults', एडल्ट: 'adults', एडल्ट्स: 'adults',
  बच्चे: 'children', बच्चों: 'children', बच्चा: 'child', बच्ची: 'child', किड्स: 'kids', चाइल्ड: 'child',
  शिशु: 'infants', इन्फेंट: 'infants',
  لوگ: 'people', افراد: 'people', بندے: 'people', پیکس: 'pax', بالغ: 'adults', بڑے: 'adults', ایڈلٹ: 'adults',
  بچے: 'children', بچوں: 'children', بچہ: 'child', بچی: 'child', شیرخوار: 'infants',
  log: 'people', logon: 'people', bade: 'adults', bado: 'adults', bachche: 'children', bacche: 'children',
  bache: 'children', bachhe: 'children', bachon: 'children', bachcha: 'child', bacha: 'child',
  परिवार: 'family', फैमिली: 'family', خاندان: 'family', فیملی: 'family', parivar: 'family', pariwar: 'family', family: 'family',
  // hotel
  होटल: 'hotel', होटलों: 'hotels', रिसॉर्ट: 'resort', रिजॉर्ट: 'resort', कमरा: 'room', कमरे: 'rooms', कमरों: 'rooms',
  रूम: 'room', रूम्स: 'rooms', नाश्ता: 'breakfast', नाश्ते: 'breakfast', ब्रेकफास्ट: 'breakfast', डिनर: 'dinner', लंच: 'lunch',
  डीलक्स: 'deluxe', डिलक्स: 'deluxe', सुपर: 'super', स्टैंडर्ड: 'standard', प्रीमियम: 'premium', ठहरना: 'stay', रुकना: 'stay',
  ہوٹل: 'hotel', ریزورٹ: 'resort', کمرہ: 'room', کمرے: 'rooms', کمروں: 'rooms', روم: 'room', ناشتہ: 'breakfast',
  ناشتے: 'breakfast', ڈنر: 'dinner', لنچ: 'lunch', ڈیلکس: 'deluxe', سپر: 'super', قیام: 'stay',
  kamra: 'room', kamre: 'rooms', kamron: 'rooms', nashta: 'breakfast', nashte: 'breakfast', khana: 'meals',
  // cab
  गाड़ी: 'cab', गाडी: 'cab', गाड़ियां: 'cabs', कार: 'car', टैक्सी: 'taxi', कैब: 'cab', वाहन: 'vehicle', सेडान: 'sedan',
  एयरपोर्ट: 'airport', पिकअप: 'pickup', ड्रॉप: 'drop', घूमना: 'sightseeing', साइटसीइंग: 'sightseeing',
  گاڑی: 'cab', گاڑیاں: 'cabs', کار: 'car', ٹیکسی: 'taxi', کیب: 'cab', سیڈان: 'sedan', ایئرپورٹ: 'airport',
  پک: 'pick', ڈراپ: 'drop', سیر: 'sightseeing',
  gaadi: 'cab', gadi: 'cab', gaddi: 'cab', gaadiyan: 'cabs', ghoomna: 'sightseeing', sair: 'sightseeing',
  // trip
  ट्रिप: 'trip', यात्रा: 'trip', टूर: 'tour', पैकेज: 'package', इटिनरेरी: 'itinerary', कोटेशन: 'quotation',
  ٹرپ: 'trip', سفر: 'trip', ٹور: 'tour', پیکج: 'package', کوٹیشن: 'quotation',
  safar: 'trip', yatra: 'trip',
  // pricing
  कोट: 'VERB:quote', मार्जिन: 'margin', प्रतिशत: 'percent', परसेंट: 'percent', फीसदी: 'percent', जीएसटी: 'gst', कुल: 'total', टोटल: 'total',
  कीमत: 'price', दाम: 'price', प्राइस: 'price', फाइनल: 'final', रुपये: 'rupees', रुपए: 'rupees', हजार: 'thousand',
  हज़ार: 'thousand', लाख: 'lakh', मुनाफा: 'profit', प्रॉफिट: 'profit',
  کوٹ: 'VERB:quote', مارجن: 'margin', فیصد: 'percent', پرسنٹ: 'percent', ٹوٹل: 'total', قیمت: 'price', فائنل: 'final', روپے: 'rupees',
  ہزار: 'thousand', لاکھ: 'lakh', منافع: 'profit',
  pratishat: 'percent', fisad: 'percent', feesad: 'percent', keemat: 'price', kimat: 'price', hazaar: 'thousand',
  hazar: 'thousand', munafa: 'profit', rupaye: 'rupees', rupay: 'rupees',
  // contact
  फोन: 'phone', मोबाइल: 'mobile', नंबर: 'number', ईमेल: 'email', डॉट: 'dot', فون: 'phone', موبائل: 'mobile',
  نمبر: 'number', ای: 'e', میل: 'mail', ڈاٹ: 'dot',
  एट: 'at', ऐट: 'at', ایٹ: 'at', जीमेल: 'gmail', جیمیل: 'gmail', याहू: 'yahoo', یاہو: 'yahoo',
  हॉटमेल: 'hotmail', ہاٹمیل: 'hotmail', आउटलुक: 'outlook', कॉम: 'com', अंडरस्कोर: 'underscore', انڈرسکور: 'underscore',
  // connectors / postpositions
  और: 'and', तथा: 'and', फिर: 'then', اور: 'and', پھر: 'then', aur: 'and', phir: 'then', fir: 'then',
  से: 'SE', سے: 'SE', se: 'SE', तक: '@', تک: '@', tak: '@',
  में: 'MEIN', पर: '@', को: '@', का: 'POSS', की: 'POSS', के: 'POSS', है: '@', हैं: '@', जी: '@', भी: '@', वाला: '@', वाली: '@', वाले: '@',
  میں: 'MEIN', پر: '@', کو: '@', کا: 'POSS', کی: 'POSS', کے: 'POSS', ہے: '@', ہیں: '@', جی: '@', بھی: '@', والا: '@', والی: '@', والے: '@',
  mein: 'MEIN', mai: 'MEIN', ka: 'POSS', ki: 'POSS', ke: 'POSS', ko: '@', hai: '@', hain: '@', wala: '@', wali: '@', wale: '@', bhi: '@',
  साथ: 'with', ساتھ: 'with', saath: 'with', sath: 'with', बिना: 'without', بغیر: 'without', bina: 'without', baghair: 'without',
  नहीं: 'no', نہیں: 'no', nahi: 'no', nahin: 'no', सिर्फ: 'only', केवल: 'only', صرف: 'only', sirf: 'only',
  सभी: 'all', सारे: 'all', تمام: 'all', سب: 'all', sab: 'all', sare: 'all', saare: 'all',
  बस: 'done', ختم: 'done', بس: 'done',
  // verbs
  बनाओ: 'VERB:create', बनाइए: 'VERB:create', बनाएं: 'VERB:create', बनाना: 'VERB:create', بناؤ: 'VERB:create',
  بنائیں: 'VERB:create', بنانا: 'VERB:create', banao: 'VERB:create', banaiye: 'VERB:create', banayein: 'VERB:create', bnao: 'VERB:create',
  जोड़ो: 'VERB:add', जोडो: 'VERB:add', डालो: 'VERB:add', जोड़ें: 'VERB:add', جوڑو: 'VERB:add', ڈالو: 'VERB:add', شامل: 'VERB:add',
  jodo: 'VERB:add', jodiye: 'VERB:add', daalo: 'VERB:add', dalo: 'VERB:add',
  बदलो: 'VERB:change', बदलें: 'VERB:change', بدلو: 'VERB:change', بدلیں: 'VERB:change', badlo: 'VERB:change',
  हटाओ: 'VERB:remove', निकालो: 'VERB:remove', ہٹاؤ: 'VERB:remove', نکالو: 'VERB:remove', hatao: 'VERB:remove', nikalo: 'VERB:remove',
  भेजो: 'VERB:send', بھیجو: 'VERB:send', bhejo: 'VERB:send', रखो: '@', رکھو: '@', rakho: '@',
  कर: '@', دو: 'NUM2_OR_GIVE', दो: 'NUM2_OR_GIVE', kar: '@',
  // "… airport pickup dzire se karo": "do it" — an add when the phrase names a cab/hotel/activity.
  करो: 'VERB:do', करें: 'VERB:do', कीजिए: 'VERB:do', کرو: 'VERB:do', کریں: 'VERB:do', کیجیے: 'VERB:do',
  karo: 'VERB:do', kijiye: 'VERB:do', karen: 'VERB:do', 'kar do': 'VERB:do',
  // languages ("हिंदी में सुनो" → listen in hindi)
  हिंदी: 'hindi', हिन्दी: 'hindi', उर्दू: 'urdu', अंग्रेजी: 'english', अंग्रेज़ी: 'english', इंग्लिश: 'english',
  हाँ: 'yes', हां: 'yes', ہاں: 'yes', शुक्रिया: 'thank you', धन्यवाद: 'thank you', شکریہ: 'thank you', بہت: '@',
  नमस्ते: 'namaste', नमस्कार: 'namaste', آداب: 'aadab', الحمدللہ: 'alhamdulillah', बढ़िया: 'great', बढिया: 'great', بڑھیا: 'great',
  मस्त: 'great', زبردست: 'great', ज़बरदस्त: 'great', जबरदस्त: 'great',
  ہندی: 'hindi', اردو: 'urdu', انگریزی: 'english', انگلش: 'english',
  सुनो: 'listen', समझो: 'listen', बोलो: 'listen', سنو: 'listen', سمجھو: 'listen', بولو: 'listen', suno: 'listen', bolo: 'listen',
  // pronouns ("मुझे … चाहिए" = I need …): not part of any name
  मुझे: '@', मुझको: '@', हमें: '@', हमको: '@', मेरे: '@', मेरा: '@', मेरी: '@', हमारे: '@', हमारा: '@', आप: '@', कृपया: '@',
  مجھے: '@', ہمیں: '@', میرے: '@', میرا: '@', میری: '@', ہمارے: '@', ہمارا: '@', آپ: '@', براہ: '@', کرم: '@', مہربانی: '@',
  mujhe: '@', hamein: '@', humein: '@', mere: '@', mera: '@', meri: '@', hamare: '@', hamara: '@', aap: '@', kripya: '@',
  // "चाहिए" (need): a new trip when a trip/package is named
  चाहिए: 'WANT', चाहिये: 'WANT', چاہیے: 'WANT', چاہئے: 'WANT', chahiye: 'WANT', chahie: 'WANT', chaiye: 'WANT',
  // greeting / wake
  हेलो: 'hello', हैलो: 'hello', हलो: 'hello', ہیلو: 'hello', चिंग: 'ching', चींग: 'ching', छिंग: 'ching', چنگ: 'ching',
}

// ── 3. transliteration ──────────────────────────────────────────────────────
const D_CONS = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n', ट: 't', ठ: 'th', ड: 'd',
  ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n', प: 'p', फ: 'f', ब: 'b', भ: 'bh', म: 'm', य: 'y',
  र: 'r', ल: 'l', व: 'v', श: 'sh', ष: 'sh', स: 's', ह: 'h', ळ: 'l', क़: 'k', ख़: 'kh', ग़: 'g', ज़: 'z', ड़: 'r',
  ढ़: 'rh', फ़: 'f', य़: 'y',
}
const D_VOWEL = { अ: 'a', आ: 'a', इ: 'i', ई: 'i', उ: 'u', ऊ: 'u', ऋ: 'ri', ए: 'e', ऐ: 'a', ओ: 'o', औ: 'au', ऑ: 'o', ऍ: 'e' }
const D_MATRA = { 'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'े': 'e', 'ै': 'a', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e' }
const VIRAMA = '्'
const NUKTA = '़'

function translitDeva(word) {
  // Syllables: { c: consonant(s), v: vowel | null (inherent a) | '' (virama), nasal }
  const syl = []
  const chars = [...word.normalize('NFC')]
  for (let i = 0; i < chars.length; i++) {
    let ch = chars[i]
    if (chars[i + 1] === NUKTA) {
      ch += NUKTA
      i++
    }
    if (D_CONS[ch] != null) syl.push({ c: D_CONS[ch], v: null, n: '' })
    else if (D_VOWEL[ch] != null) syl.push({ c: '', v: D_VOWEL[ch], n: '' })
    else if (D_MATRA[ch] != null && syl.length) syl[syl.length - 1].v = D_MATRA[ch]
    else if (ch === VIRAMA && syl.length) syl[syl.length - 1].v = ''
    else if ((ch === 'ं' || ch === 'ँ') && syl.length) syl[syl.length - 1].n = 'n'
    else if (ch === 'ः' && syl.length) syl[syl.length - 1].n = 'h'
    else if (/[a-z0-9]/i.test(ch)) syl.push({ c: ch.toLowerCase(), v: '', n: '' })
  }
  // Schwa deletion, right to left: the last inherent a goes; an inherent a
  // between a vowel-carrying syllable and a following consonant+vowel goes.
  const vowelOf = (s) => (s.v === null ? 'a' : s.v)
  const last = syl.length - 1
  if (last > 0 && syl[last].v === null && syl[last].c) syl[last].v = ''
  for (let i = last - 1; i > 0; i--) {
    const s = syl[i]
    if (s.v !== null || !s.c) continue
    if (vowelOf(syl[i - 1]) && syl[i + 1] && syl[i + 1].c && vowelOf(syl[i + 1])) s.v = ''
  }
  return syl
    .map((s) => s.c + vowelOf(s) + (s.n === 'n' ? (/^[pbm]/.test(s.c) ? 'm' : 'n') : s.n))
    .join('')
}

const U_MAP = {
  ا: 'a', آ: 'a', أ: 'a', ب: 'b', پ: 'p', ت: 't', ٹ: 't', ث: 's', ج: 'j', چ: 'ch', ح: 'h', خ: 'kh', د: 'd', ڈ: 'd',
  ذ: 'z', ر: 'r', ڑ: 'r', ز: 'z', ژ: 'zh', س: 's', ش: 'sh', ص: 's', ض: 'z', ط: 't', ظ: 'z', ع: '', غ: 'gh', ف: 'f',
  ق: 'k', ک: 'k', ك: 'k', گ: 'g', ل: 'l', م: 'm', ن: 'n', ں: 'n', ھ: 'h', ء: '', ئ: 'i', ۃ: 't', ة: 't', ى: 'i',
  'َ': 'a', 'ِ': 'i', 'ُ': 'u', 'ّ': '',
}
function translitUrdu(word) {
  const chars = [...word]
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const next = chars[i + 1]
    const atStart = i === 0
    const atEnd = i === chars.length - 1
    // ہ: a final ہ is "a" (nashta); after a letter it carries a short a
    // before it (پہلگام = pahalgam, not "ph" as in f).
    if (ch === 'ہ' || ch === 'ه') out += atEnd && i > 0 ? 'a' : i > 0 && !/[aeiou]$/.test(out) ? 'ah' : 'h'
    else if (ch === 'ی' || ch === 'ي') out += atStart ? 'y' : 'i'
    else if (ch === 'ے') out += 'e'
    // و: v at the start or before a vowel letter, else o/u — "w" lets the
    // sound-snapping try both.
    else if (ch === 'و') out += atStart || /[اآیےئ]/.test(next || '') ? 'v' : 'w'
    else if (U_MAP[ch] != null) out += U_MAP[ch]
    else if (/[a-z0-9]/i.test(ch)) out += ch.toLowerCase()
  }
  return out
}

// ── 4. sound-snapping to known words ────────────────────────────────────────
function phonetic(w) {
  return String(w)
    .toLowerCase()
    .replace(/igh/g, 'i')
    .replace(/chh|ch/g, 'C')
    .replace(/sh|zh/g, 's')
    .replace(/ph/g, 'f')
    .replace(/([kgtdbj])h/g, '$1')
    .replace(/ck|q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/C/g, 'c')
    .replace(/w/g, 'v')
    .replace(/ee|ii|ie|ea/g, 'i')
    .replace(/oo|uu|ou/g, 'u')
    .replace(/(.)\1+/g, '$1')
}
// s / z / j fold together (ज़ is often written ज; a plural s sounds like z).
const skeleton = (w) => phonetic(w).replace(/[aeiouy]/g, '').replace(/[szj]/g, 's').replace(/(.)\1+/g, '$1')
// "w" from Urdu و may be a v or a vowel: both skeletons.
const skeletons = (w) => [...new Set([skeleton(w), skeleton(w.replace(/w/g, 'o'))])]

function lev(a, b) {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}
const ratio = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1)

// English words Hindi/Urdu speakers say as loanwords (written in their script).
const ENGLISH = [
  'trip', 'itinerary', 'package', 'tour', 'hotel', 'resort', 'nights', 'days', 'adults', 'children', 'kids', 'infants',
  'people', 'pax', 'rooms', 'room', 'breakfast', 'dinner', 'lunch', 'meals', 'cab', 'car', 'taxi', 'vehicle',
  'transport', 'transportation', 'margin', 'percent', 'gst', 'quote', 'quotation', 'total', 'price', 'final', 'add',
  'create', 'new', 'change', 'remove', 'replace', 'send', 'email', 'phone', 'mobile', 'whatsapp', 'pdf', 'export', 'save',
  'sightseeing', 'airport', 'pickup', 'drop', 'transfer', 'leisure', 'arrival', 'departure', 'extra', 'bed', 'double',
  'single', 'deluxe', 'super', 'standard', 'premium', 'executive', 'family', 'suite', 'plan', 'only', 'phase', 'ride',
  'activity', 'accommodation', 'undo', 'cheaper', 'profit', 'rupees', 'lakh', 'thousand', 'per', 'person', 'day',
  'week', 'sedan', 'star', 'budget', 'luxury', 'client', 'name', 'number', 'start', 'date', 'from', 'with', 'without',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'hello', 'ching', 'done', 'confirm', 'cancel', 'yes', 'okay', 'open', 'show', 'ledger', 'pending',
]

const KEEP_ENGLISH = new Set([
  ...ENGLISH, 'what', 'is', 'the', 'my', 'at', 'dot', 'com', 'in', 'co', 'org', 'gmail', 'yahoo', 'hotmail', 'outlook',
  'underscore', 'rate', 'and', 'for', 'to', 'on', 'of', 'room only', 'all',
  'how', 'are', 'you', 'i', 'am', 'fine', 'good', 'great', 'yes', 'no', 'thank', 'assalamu', 'alaikum', 'khuda', 'allah', 'hafiz',
  'namaste', 'aadab', 'alhamdulillah',
])

// Common names (Kashmir and wider South Asia). Urdu script leaves out short
// vowels — عمران is "mrn" — so a client's name is matched to these by sound.
const NAMES = (
  'imran rahul ahmed ahmad mohammad muhammad mohd ali farooq bilal usman hassan hussain khan malik shah bhat dar lone mir wani ' +
  'sheikh shaikh qureshi butt ayesha aisha fatima sana zainab sara sarah aamir amir arif asif zubair tariq yasir faisal irfan ' +
  'javed rashid sajid nadeem naveed kashif adnan salman sameer samir shahid wasim zahid junaid owais umar omar abdullah rehman ' +
  'rahman raza abbas iqbal akhtar anwar mushtaq showkat shaukat bashir nazir gulzar manzoor shabir hilal rafiq firdous rubina ' +
  'shabnam nusrat parveen rukhsana yasmeen nazia saima hina asma mehreen uzma ishfaq ishtiaq mudasir mudassir aijaz ajaz ' +
  'riyaz riaz fayaz feroz firoz muzaffar nisar showket sajad sajjad tanveer touseef tauseef waseem yousuf yusuf zubair zahoor ' +
  'aadil adil aqib arshad azhar danish ehsan faizan haris hamid hanif harun idrees ilyas jamal kamran khalid majid masood ' +
  'mansoor mubashir nadir naeem nasir noman qasim rizwan sadiq saleem shafiq shakeel shoaib sohail suhail talha umair waqar ' +
  'yaseen zeeshan ahsan amjad anees asad babar ghulam habib ibrahim ismail kabir latif mehmood mahmood nabi nazeer rauf ' +
  'sharma verma gupta singh kumar kapoor mehta jain agarwal reddy rao nair iyer patel shah joshi chopra malhotra bhatia ' +
  'priya neha pooja anjali kavya riya simran ananya aditi vikram rohan arjun amit sumit rohit vijay ajay sanjay rajesh suresh ' +
  'ramesh mahesh dinesh mukesh anil sunil manoj deepak vivek ankit nikhil karan varun ravi raj aman akash vishal'
).split(' ')

/** Known words from the agency's catalog (names of hotels, cities, cabs, activities). */
export function vocabularyOf(catalog = {}) {
  const words = new Set()
  const phrases = []
  const kinds = new Map() // word → hotel | city | vehicle | activity | client
  const add = (name, kind) => {
    const toks = String(name || '').toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').split(/\s+/).filter(Boolean)
    toks.forEach((t) => {
      if (t.length < 3 || /^\d+$/.test(t)) return
      words.add(t)
      if (!kinds.has(t) || kind === 'city') kinds.set(t, kind)
    })
    if (toks.length > 1) phrases.push(toks)
  }
  ;(catalog.hotels || []).forEach((h) => add(h?.name, 'hotel'))
  ;(catalog.vehicles || []).forEach((v) => add(v?.name, 'vehicle'))
  ;(catalog.activities || []).forEach((a) => add(a?.name, 'activity'))
  ;(catalog.destinations || []).forEach((d) => {
    add(d?.name, 'city')
    add(d?.city, 'city')
    add(d?.state, 'city')
  })
  ;(catalog.hotels || []).forEach((h) => add(h?.city, 'city'))
  // Past clients (Ching's memory): Urdu script drops short vowels — "راہل" → Rahul.
  ;(catalog.memory?.clients || []).forEach((c) => add(c?.name, 'client'))
  return { words: [...words], phrases, kinds }
}

function snapWord(heard, list, { loose = false, urdu = false } = {}) {
  const hs = skeletons(heard)
  const hp = phonetic(heard.replace(/w/g, 'o'))
  let best = null
  for (const w of list) {
    const sk = skeleton(w)
    const wp = phonetic(w)
    const r = ratio(hp, wp)
    // Urdu script drops short vowels: "للت" (llt) is "lalit" — an exact 2-consonant
    // skeleton is enough there, for the agency's own names.
    const same = hs.includes(sk) && (sk.length >= 3 || r >= 0.75 || (loose && sk.length >= 1 && r >= 0.5) || (urdu && sk.length === 2 && heard.length >= 3))
    if (!same && !(r >= 0.86 && wp.length >= 5)) continue
    if (!best || r > best.r) best = { w, r }
  }
  return best?.w || null
}

// ── 5. the conversion ───────────────────────────────────────────────────────
function phraseReplace(s) {
  // Longest phrases first, whole-word (space-delimited) matches only.
  let out = ` ${s} `
  for (const [from, to] of [...PHRASES].sort((a, b) => b[0].length - a[0].length)) {
    out = out.split(` ${from} `).join(` ${to} `)
  }
  return out.trim()
}

const isVerb = (t) => /^VERB:/.test(t)
const UNIT = /^(?:nights?|days?|adults?|children|child|kids?|infants?|people|pax|rooms?|percent|rupees|thousand|lakh)$/
const MONTHS = /^(?:january|february|march|april|may|june|july|august|september|october|november|december)$/

/**
 * Hindi / Urdu (script or romanized) → English command text.
 * catalog (optional) = { hotels, destinations, vehicles, activities } for
 * sound-snapping names; English input comes back unchanged.
 */
export function toEnglishCommand(text, catalog = null) {
  const raw = String(text || '')
  const script = scriptOf(raw)
  let s = asciiDigits(raw.normalize('NFC'))
    .replace(/\u200c|\u200d|\u064B|\u064C|\u064D|\u0651|\u0652|\u0653|\u0654|\u0655|\u0670/g, '') // ZWNJ/ZWJ, tanween, shadda, sukun (zabar/zer/pesh are kept)
    .replace(/([,.!?])/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()
  if (script === 'latin') s = s.toLowerCase()
  // Hindi/Urdu markers in Latin text (Hinglish / Roman Urdu)? Otherwise English: leave it.
  const romanHindi =
    script === 'latin' &&
    /(?:^|\s)(?:ke liye|ke liya|k liye|liye|raat|raaten|raatein|din|dino|banao|bana do|jodo|jod do|daalo|dalo|daal do|dal do|hatao|hata do|badlo|badal do|bhejo|kamre|kamra|bachche|bacche|log|logon|aur|mein|tak|karo|kar do|wala|wali|hai|nashta|gaadi|gadi|se|chahiye|chahie|pehle|doosre|dusre|teesre|chauthe|mujhe|hamein|ka|ki|ke)(?=\s|$)/.test(s)
  if (script === 'latin' && !romanHindi) return raw
  s = phraseReplace(s)
  const vocab = catalog ? vocabularyOf(catalog) : { words: [], phrases: [] }
  const tokens = []
  for (const tok of s.split(' ')) {
    if (!tok) continue
    if (/^[0-9][0-9.,:/-]*$/.test(tok) || /^[,.!?]$/.test(tok)) {
      tokens.push(tok)
      continue
    }
    if (/^(?:KELIYE|SE|MEIN|POSS|VERB:\w+)$/.test(tok)) {
      tokens.push(tok)
      continue
    }
    const key = script === 'latin' ? tok.toLowerCase() : tok
    if (HI_NUM[key] != null) tokens.push(String(HI_NUM[key]))
    else if (UR_NUM[key] != null) tokens.push(String(UR_NUM[key]))
    else if (script === 'latin' && ROMAN_NUM[key] != null) tokens.push(String(ROMAN_NUM[key]))
    else if (ORD[key] != null) tokens.push(`ORD${ORD[key]}`)
    else if (MONTH[key]) tokens.push(MONTH[key])
    else if (WORDS[key] != null) tokens.push(WORDS[key])
    else if (script === 'latin') tokens.push(key)
    // English already (from the phrase table, or said in English): keep it.
    else if (KEEP_ENGLISH.has(tok.toLowerCase())) tokens.push(tok.toLowerCase())
    else {
      // Transliterate, then snap to the catalog (names) or English loanwords.
      const lat = script === 'deva' ? translitDeva(tok) : translitUrdu(tok)
      if (!lat) continue
      tokens.push({ lat })
    }
  }
  // Snap transliterated words: catalog phrases first (all their words), then
  // single catalog words, then English loanwords.
  // Urdu often splits one English name in two ("ہائی لینڈز" = highlands): join.
  for (let i = 0; i + 1 < tokens.length; i++) {
    const a = tokens[i]
    const b = tokens[i + 1]
    if (typeof a !== 'object' || typeof b !== 'object') continue
    if (snapWord(a.lat, vocab.words) || snapWord(b.lat, vocab.words)) continue
    const hit = snapWord(a.lat + b.lat, vocab.words)
    if (hit && skeleton(hit).length >= 4) {
      Object.assign(a, { lat: hit, snapped: true })
      tokens.splice(i + 1, 1)
    }
  }
  // Catalog names of several words, or a run of 2+ of their words ("gondola ride").
  for (const phrase of vocab.phrases) {
    for (let n = phrase.length; n >= 2; n--) {
      for (let p0 = 0; p0 + n <= phrase.length; p0++) {
        const part = phrase.slice(p0, p0 + n)
        for (let i = 0; i + n <= tokens.length; i++) {
          const win = tokens.slice(i, i + n)
          if (!win.every((t) => typeof t === 'object' && !t.snapped)) continue
          const strong = win.some((t, k) => skeletons(t.lat).includes(skeleton(part[k])) && skeleton(part[k]).length >= 3)
          // inside a matched name, the same consonants are enough ("llt grand palace")
          const all = win.every((t, k) => skeletons(t.lat).includes(skeleton(part[k])) || snapWord(t.lat, [part[k]], { loose: true }))
          if (strong && all) win.forEach((t, k) => Object.assign(t, { lat: part[k], snapped: true }))
        }
      }
    }
  }
  tokens.forEach((t) => {
    if (typeof t !== 'object' || t.snapped) return
    const hit = snapWord(t.lat, vocab.words, { urdu: script === 'urdu' }) || snapWord(t.lat, ENGLISH) || (script === 'urdu' ? snapWord(t.lat, NAMES, { loose: true }) : null)
    if (hit) Object.assign(t, { lat: hit, snapped: true, known: vocab.words.includes(hit) })
  })
  const known = vocab.kinds || new Map()
  const words = tokens.map((t) => (typeof t === 'object' ? t.lat : t)).filter((t) => t !== '@')
  return reorder(words, known)
}

function reorder(words, known = new Map()) {
  const kindOf = (w) => known.get(w) || ''
  const isNum = (w) => /^\d/.test(w || '')
  // "2" for the Hindi "दो" when it counts something, else drop (it's "give").
  words = words.map((w, i) => (w === 'NUM2_OR_GIVE' ? (UNIT.test(words[i + 1] || '') || MONTHS.test(words[i + 1] || '') ? '2' : '@') : w))
  const tripish = words.some((w) => /^(?:trip|package|tour|itinerary|quotation)$/.test(w))
  // "rahul ka … package" (Rahul's package): the first possessive after a
  // name-like word, before the trip noun, marks the client; others are dropped.
  let possUsed = !tripish || words.includes('KELIYE')
  words = words.map((w, i) => {
    if (w !== 'POSS') return w
    const prev = words[i - 1] || ''
    const later = words.slice(i + 1).some((x) => /^(?:trip|package|tour|itinerary|quotation)$/.test(x))
    if (!possUsed && later && /^[a-z][a-z'.-]*$/.test(prev) && !UNIT.test(prev) && !MONTHS.test(prev) && (!known.has(prev) || known.get(prev) === 'client') && !/^(?:trip|package|tour|day|days|nights?)$/.test(prev)) {
      possUsed = true
      return 'KELIYE'
    }
    return '@'
  })
  words = words.map((w) => (w !== 'WANT' ? w : tripish ? 'VERB:create' : '@'))
  // DAYWORD: "दिन 3" / "3 दिन" / "तीसरे दिन"
  words = words.map((w, i) => (w !== 'DAYWORD' ? w : isNum(words[i + 1]) ? 'day' : 'days'))
  let out = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w === '@') continue
    const ord = /^ORD(\d+)$/.exec(w)
    if (ord) {
      // "तीसरे दिन" → "day 3"; a bare ordinal → "3rd"
      if (words[i + 1] === 'days' || words[i + 1] === 'day') {
        out.push('day', ord[1])
        i++
      } else out.push(`${ord[1]}${['th', 'st', 'nd', 'rd'][+ord[1] % 10 < 4 && Math.floor(+ord[1] / 10) !== 1 ? +ord[1] % 10 : 0]}`)
      continue
    }
    out.push(w)
  }
  // "X SE Y" → "X to Y" between places; after a date / number it's "from" (dropped).
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== 'SE') continue
    const prev = out[i - 1] || ''
    const next = out[i + 1] || ''
    // "12 nov se 14 nov tak" / "12 se 14 november": a date range.
    const month = (w) => MONTHS.test(w) || /^(?:jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)$/.test(w)
    if ((isNum(prev) || month(prev)) && isNum(next) && month(out[i + 2] || '')) {
      out[i] = 'to'
      continue
    }
    out[i] = isNum(prev) || MONTHS.test(prev) || UNIT.test(prev) || !next || isNum(next) || isVerb(next) || next === '@' ? '@' : 'to'
  }
  // "श्रीनगर में 2 रात ललित …" (in Srinagar, 2 nights, Lalit …) → "2 nights in srinagar at lalit …";
  // any other "में" is just dropped.
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== 'MEIN') continue
    let j = i
    while (j > 0 && i - j < 2 && kindOf(out[j - 1]) === 'city') j--
    const hasCity = j < i
    if (hasCity && isNum(out[i + 1]) && /^nights?$/.test(out[i + 2] || '') && out[i + 3] && !isNum(out[i + 3]) && !/^(?:and|then)$/.test(out[i + 3]) && kindOf(out[i + 3]) !== 'city') {
      const place = out.slice(j, i)
      out.splice(j, i - j + 3, out[i + 1], out[i + 2], 'in', ...place, 'at')
      i = j + place.length + 3
    } else out[i] = '@'
  }
  out = out.filter((w) => w !== '@')
  // "rahul sharma KELIYE" → "for rahul sharma"; "2 nights KELIYE" → "for 2 nights"
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== 'KELIYE') continue
    let j = i
    if (UNIT.test(out[i - 1] || '') && isNum(out[i - 2])) j = i - 2
    else {
      while (j > 0 && i - j < 3 && /^[a-z][a-z'.-]*$/.test(out[j - 1]) && !UNIT.test(out[j - 1]) && !MONTHS.test(out[j - 1]) && !/^(?:and|with|trip|then|to|for|in|at|create|add)$/.test(out[j - 1]) && !isVerb(out[j - 1])) j--
    }
    out.splice(i, 1)
    out.splice(j, 0, 'for')
  }
  // Clause-final verbs: "create" goes to the very front; add/change/remove/send
  // to the start of the thing they act on.
  const hasCreate = out.includes('VERB:create')
  const res = []
  let seg = []
  const OBJ_NOUN = /^(?:hotel|hotels|resort|accommodation|cab|cabs|car|taxi|vehicle|transport|transportation|activity|pickup|drop|airport|rooms?)$/
  const place = (verb) => {
    let k = -1
    // "… day 3 shikara ride": from the "day N"
    for (let x = seg.length - 2; x >= 0 && k < 0; x--) if (seg[x] === 'day' && isNum(seg[x + 1])) k = x
    if (k < 0) {
      // the run of catalog names / object nouns it names ("grand mumtaz", "innova cab")
      let last = -1
      for (let x = seg.length - 1; x >= 0 && last < 0; x--) if (kindOf(seg[x]) || OBJ_NOUN.test(seg[x])) last = x
      if (last >= 0) {
        k = last
        while (k > 0 && (kindOf(seg[k - 1]) || OBJ_NOUN.test(seg[k - 1]) || seg[k - 1] === 'in')) k--
        // "2 nights in gulmarg at khyber resort": the whole stay phrase
        if (seg[k - 1] === 'at') {
          k--
          while (k > 0 && (kindOf(seg[k - 1]) === 'city' || /^(?:in|nights?|for)$/.test(seg[k - 1]) || isNum(seg[k - 1]))) k--
        }
      }
    }
    if (k < 0) {
      k = seg.length
      while (k > 0 && !/^(?:and|then|with|for|,|\.)$/.test(seg[k - 1]) && !(UNIT.test(seg[k - 1]) && isNum(seg[k - 2])) && !MONTHS.test(seg[k - 1]) && seg.length - k < 6) k--
    }
    res.push(...seg.slice(0, k), verb, ...seg.slice(k))
    seg = []
  }
  for (const w of out) {
    if (w === 'VERB:create') {
      res.push(...seg)
      seg = []
      continue
    }
    if (isVerb(w)) {
      const verb = w.slice(5)
      // "… 60000 quote" → "quote 60000"
      if (verb === 'quote') {
        const at = seg.map((x, i) => (isNum(x) ? i : -1)).filter((i) => i >= 0).pop()
        if (at != null) res.push(...seg.slice(0, at).filter((x) => x !== 'total'), 'quote', ...seg.slice(at).filter((x) => x !== 'total'))
        else res.push(...seg.filter((x) => x !== 'total'), 'quote')
        seg = []
        continue
      }
      // "karo" (do): an add when the phrase names a cab, hotel or activity; else nothing.
      if (verb === 'do') {
        if (!seg.some((x) => kindOf(x) === 'hotel' || kindOf(x) === 'vehicle' || kindOf(x) === 'activity' || OBJ_NOUN.test(x) || x === 'sightseeing')) {
          res.push(...seg)
          seg = []
          continue
        }
        place('add')
        continue
      }
      place(verb)
    } else if (w === 'and' || w === 'then' || w === ',') {
      res.push(...seg, w)
      seg = []
    } else seg.push(w)
  }
  res.push(...seg)
  let text = res.join(' ').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim()
  if (hasCreate && !/\b(?:create|make|new|plan|build)\b/.test(text)) text = `create ${text}`
  // "N week(s)" → N×7 nights
  text = text.replace(/\b(\d)\s+weeks?\b/g, (m, n) => `${n * 7} nights`)
  return text
}
