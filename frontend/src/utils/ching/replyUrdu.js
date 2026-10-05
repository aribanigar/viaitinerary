// Ching answers in Urdu when the agent spoke Urdu. Ching's replies are built
// in English (assistant.js, tripDraft.js, the widget); this turns them into
// Urdu, sentence by sentence, from a table of Ching's own reply patterns.
// Names (hotels, cities, clients) and anything not in the table stay in
// English. Each Urdu sentence also carries the same words in Devanagari:
// spoken Urdu and Hindi are one language, so where the browser has no Urdu
// voice (desktop Chrome) a Hindi voice reads the Urdu sentence.
//
//   urduReply("Done! Rahul's trip is filled in. Total comes to ₹45,000.")
//   → { text: "ہو گیا! Rahul کا ٹرپ تیار ہے۔ کل رقم 45,000 روپے ہے۔",
//       parts: [{ ur, hi }, { ur, hi }, …, { en }] }

const u = (ur, hi) => ({ ur, hi });
const rupees = (s) =>
  String(s || "").replace(/₹\s?([\d,]+(?:\.\d+)?)/g, (_, n) => `${n} RUPEES`);
const R = (s, lang) => rupees(s).replace(/RUPEES/g, lang === "ur" ? "روپے" : "रुपये");

// Words inside captured English bits ("2 adults, 3 nights").
function words(s, lang) {
  const ur = lang === "ur";
  return R(s, lang)
    .replace(/\b(\d+)\s+nights?\b/gi, (_, n) => `${n} ${n === "1" ? (ur ? "رات" : "रात") : ur ? "راتیں" : "रातें"}`)
    .replace(/\b(\d+)\s+days?\b/gi, (_, n) => `${n} ${ur ? "دن" : "दिन"}`)
    .replace(/\b(\d+)\s+adults?\b/gi, (_, n) => `${n} ${ur ? "بڑے" : "बड़े"}`)
    .replace(/\b(\d+)\s+(?:kids?|children|child)\b/gi, (_, n) => `${n} ${ur ? "بچے" : "बच्चे"}`)
    .replace(/\b(\d+)\s+infants?\b/gi, (_, n) => `${n} ${ur ? "شیر خوار" : "शीर-ख़्वार"}`)
    .replace(/\bday\s+(\d+)\b/gi, (_, n) => `${ur ? "دن" : "दिन"} ${n}`)
    .replace(/\band\b/g, ur ? "اور" : "और");
}

// The pending checklist's labels (utils/tripChecklist.js).
const LABELS = [
  [/^package name$/i, () => u("پیکج کا نام", "पैकेज का नाम")],
  [/^client name$/i, () => u("کلائنٹ کا نام", "क्लाइंट का नाम")],
  [/^client phone$/i, () => u("کلائنٹ کا فون نمبر", "क्लाइंट का फ़ोन नंबर")],
  [/^client email$/i, () => u("کلائنٹ کی ای میل", "क्लाइंट की ईमेल")],
  [/^trip title$/i, () => u("ٹرپ کا عنوان", "ट्रिप का उनवान")],
  [/^destination$/i, () => u("منزل", "मंज़िल")],
  [/^start date$/i, () => u("شروع کی تاریخ", "शुरू की तारीख़")],
  [/^trip length \(nights\)$/i, () => u("کتنی راتیں", "कितनी रातें")],
  [/^day-wise plan$/i, () => u("دن وار پلان", "दिन-वार प्लान")],
  [/^day plan has (\d+) of (\d+) days$/i, (m) => u(`دن کا پلان: ${m[2]} میں سے ${m[1]} دن`, `दिन का प्लान: ${m[2]} में से ${m[1]} दिन`)],
  [/^day (\d+) title$/i, (m) => u(`دن ${m[1]} کا عنوان`, `दिन ${m[1]} का उनवान`)],
  [/^day (\d+) plan is empty$/i, (m) => u(`دن ${m[1]} کا پلان خالی ہے`, `दिन ${m[1]} का प्लान ख़ाली है`)],
  [/^hotels$/i, () => u("ہوٹل", "होटल")],
  [/^no hotel for the night of (.+)$/i, (m) => u(`${m[1]} کی رات کا ہوٹل`, `${m[1]} की रात का होटल`)],
  [/^no hotel for (\d+) nights \(from (.+)\)$/i, (m) => u(`${m[1]} راتوں کا ہوٹل (${m[2]} سے)`, `${m[1]} रातों का होटल (${m[2]} से)`)],
  [/^(.+) has no room rate$/i, (m) => u(`${m[1]} کا کمرے کا ریٹ`, `${m[1]} का कमरे का रेट`)],
  [/^meal plan for (.+)$/i, (m) => u(`${m[1]} کا میل پلان`, `${m[1]} का मील प्लान`)],
  [/^cab \/ transport$/i, () => u("گاڑی", "गाड़ी")],
  [/^a transport booking has no vehicle$/i, () => u("ایک بکنگ میں گاڑی نہیں", "एक बुकिंग में गाड़ी नहीं")],
  [/^total price$/i, () => u("کل قیمت", "कुल क़ीमत")],
];
function label(text) {
  const t = String(text || "").trim();
  for (const [re, fn] of LABELS) {
    const m = re.exec(t);
    if (m) return fn(m);
  }
  return u(t, t);
}
// "a, b and c" → Urdu list; "and N more" kept as a count.
function labelList(s) {
  const items = String(s)
    .split(/,\s*|\s+and\s+(?=[^,]*$)/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(label);
  const join = (lang, sep, last) =>
    items.length <= 1 ? items.map((x) => x[lang]).join("") : `${items.slice(0, -1).map((x) => x[lang]).join(sep)} ${last} ${items[items.length - 1][lang]}`;
  return u(join("ur", "، ", "اور"), join("hi", ", ", "और"));
}
const more = (n, lang) => (n ? (lang === "ur" ? ` اور ${n} مزید` : ` और ${n} मज़ीद`) : "");

const TAB = {
  "trip info": u("ٹرپ کی معلومات", "ट्रिप की मालूमात"),
  itinerary: u("سفر نامہ", "सफ़रनामा"),
  logistics: u("ہوٹل اور گاڑی", "होटल और गाड़ी"),
  pricing: u("قیمت", "क़ीमत"),
};

// Whole replies that are more than one sentence.
const WHOLE = [
  [/^(?:Hmm, I didn't catch that|Sorry, that one flew over my head|I didn't get that)\b/, () =>
    u("معاف کیجیے، میں سمجھ نہیں پایا۔ ذرا دوسرے طریقے سے کہیے؟", "माफ़ कीजिए, मैं समझ नहीं पाया। ज़रा दूसरे तरीक़े से कहिए?")],
  [/^Okay, I'll keep quiet\b/, () => u("ٹھیک ہے، میں خاموش رہوں گا۔", "ठीक है, मैं ख़ामोश रहूँगा।")],
  [/^I'm back! I'll talk again\.$/, () => u("میں واپس آ گیا! اب بولوں گا۔", "मैं वापस आ गया! अब बोलूँगा।")],
  [/^Nothing's pending\b/, () => u("کچھ بھی باقی نہیں — ٹرپ محفوظ کرنے یا بھیجنے کے لیے تیار ہے۔ شاباش!", "कुछ भी बाक़ी नहीं — ट्रिप महफ़ूज़ करने या भेजने के लिए तैयार है। शाबाश!")],
  [/^No price yet\b/, () => u("ابھی کوئی قیمت نہیں — ہوٹل یا گاڑی جوڑیے، میں حساب کر دوں گا۔", "अभी कोई क़ीमत नहीं — होटल या गाड़ी जोड़िए, मैं हिसाब कर दूँगा।")],
  [/^No cost on this trip yet\b/, () => u("اس ٹرپ پر ابھی کوئی خرچ نہیں — ہوٹل، گاڑی یا ایکٹیویٹی جوڑیے، میں منافع بتا دوں گا۔", "इस ट्रिप पर अभी कोई ख़र्च नहीं — होटल, गाड़ी या एक्टिविटी जोड़िए, मैं मुनाफ़ा बता दूँगा।")],
  [/^Open a trip in the Trip Builder and I'll change it for you\.$/, () => u("ٹرپ بلڈر میں کوئی ٹرپ کھولیے، میں بدل دوں گا۔", "ट्रिप बिल्डर में कोई ट्रिप खोलिए, मैं बदल दूँगा।")],
  [/^Open a trip and I'll tell you exactly what's missing\.$/, () => u("کوئی ٹرپ کھولیے، میں بتاؤں گا کیا باقی ہے۔", "कोई ट्रिप खोलिए, मैं बताऊँगा क्या बाक़ी है।")],
  [/^Cancelled — the trip is back to how it was\.$/, () => u("منسوخ — ٹرپ پہلے جیسا ہو گیا۔", "मंसूख़ — ट्रिप पहले जैसा हो गया।")],
  [/^This trip costs you (₹[\d,]+)\. At ([\d.]+)% margin you make (₹[\d,]+)(?:, plus (₹[\d,]+) GST)? — the client pays (₹[\d,]+)\.$/, (m) =>
    u(
      `یہ ٹرپ آپ کو ${R(m[1], "ur")} کا پڑتا ہے۔ ${m[2]} فیصد مارجن پر آپ کا منافع ${R(m[3], "ur")} ہے${m[4] ? `، اور ${R(m[4], "ur")} جی ایس ٹی` : ""} — کلائنٹ ${R(m[5], "ur")} دے گا۔`,
      `यह ट्रिप आपको ${R(m[1], "hi")} का पड़ता है। ${m[2]} फ़ीसद मार्जिन पर आपका मुनाफ़ा ${R(m[3], "hi")} है${m[4] ? `, और ${R(m[4], "hi")} जी एस टी` : ""} — क्लाइंट ${R(m[5], "hi")} देगा।`,
    )],
];

// One sentence at a time.
const SENTENCE = [
  [/^(?:Done|All set|There you go|Ta-da|Got it|Updated)[.!]$/, () => u("ہو گیا!", "हो गया!")],
  [/^(.+?)'s trip is filled in\.$/, (m) => u(`${m[1]} کا ٹرپ تیار ہے۔`, `${m[1]} का ट्रिप तैयार है।`)],
  [/^The trip is filled in\.$/, () => u("ٹرپ تیار ہے۔", "ट्रिप तैयार है।")],
  [/^Total comes to (₹[\d,]+)\.$/, (m) => u(`کل رقم ${R(m[1], "ur")} ہے۔`, `कुल रक़म ${R(m[1], "hi")} है।`)],
  [/^The total is (₹[\d,]+)\.$/, (m) => u(`کل رقم ${R(m[1], "ur")} ہے۔`, `कुल रक़म ${R(m[1], "hi")} है।`)],
  [/^Still need (.+?)(?: and (\d+) more)?\.$/, (m) => {
    const l = labelList(m[1]);
    return u(`ابھی یہ باقی ہے: ${l.ur}${more(m[2], "ur")}۔`, `अभी यह बाक़ी है: ${l.hi}${more(m[2], "hi")}।`);
  }],
  [/^Also worth adding: (.+?)(?: and (\d+) more)?\.$/, (m) => {
    const l = labelList(m[1]);
    return u(`یہ بھی ہو تو بہتر ہے: ${l.ur}${more(m[2], "ur")}۔`, `यह भी हो तो बेहतर है: ${l.hi}${more(m[2], "hi")}।`);
  }],
  [/^Must fill: (.+?)(?: and (\d+) more)?\.?$/, (m) => {
    const l = labelList(m[1]);
    return u(`یہ بھرنا ضروری ہے: ${l.ur}${more(m[2], "ur")}۔`, `यह भरना ज़रूरी है: ${l.hi}${more(m[2], "hi")}।`);
  }],
  [/^Nice to have: (.+?)(?: and (\d+) more)?\.?$/, (m) => {
    const l = labelList(m[1]);
    return u(`یہ بھی ہو تو بہتر ہے: ${l.ur}${more(m[2], "ur")}۔`, `यह भी हो तो बेहतर है: ${l.hi}${more(m[2], "hi")}।`);
  }],
  [/^Everything's filled — just hit save or export\.$/, () =>
    u("سب کچھ بھر گیا ہے — بس محفوظ کیجیے یا پی ڈی ایف بنائیے۔", "सब कुछ भर गया है — बस महफ़ूज़ कीजिए या पी डी एफ़ बनाइए।")],
  [/^Everything required is filled\.$/, () => u("ضروری سب کچھ بھر گیا ہے۔", "ज़रूरी सब कुछ भर गया है।")],
  [/^Before you (?:save|send|export) it, still need (.+?)(?: and (\d+) more)?\.$/, (m) => {
    const l = labelList(m[1]);
    return u(`بھیجنے سے پہلے یہ باقی ہے: ${l.ur}${more(m[2], "ur")}۔`, `भेजने से पहले यह बाक़ी है: ${l.hi}${more(m[2], "hi")}।`);
  }],
  [/^Tip: in (.+?), (.+?) is a popular add-on — say “add .+? on day (\d+)”\.$/, (m) =>
    u(`مشورہ: ${m[1]} میں ${m[2]} بہت پسند کیا جاتا ہے — کہیے “دن ${m[3]} پر ${m[2]} جوڑو”۔`, `मशवरा: ${m[1]} में ${m[2]} बहुत पसंद किया जाता है — कहिए “दिन ${m[3]} पर ${m[2]} जोड़ो”।`)],
  [/^Here's the draft for (.+?): (.+)\.$/, (m) => u(`${m[1]} کا ڈرافٹ: ${words(m[2], "ur")}۔`, `${m[1]} का ड्राफ़्ट: ${words(m[2], "hi")}।`)],
  [/^Say “confirm” to build it, or tell me what to change\.$/, () =>
    u("“کنفرم” کہیے تو بنا دوں، یا بتائیے کیا بدلنا ہے۔", "“कन्फ़र्म” कहिए तो बना दूँ, या बताइए क्या बदलना है।")],
  [/^Before I build it: (.+)\.$/, (m) => u(`بنانے سے پہلے: ${words(m[1], "ur")}۔`, `बनाने से पहले: ${words(m[1], "hi")}।`)],
  [/^I can't build it yet: (.+)\.$/, (m) => u(`ابھی نہیں بنا سکتا: ${words(m[1], "ur")}۔`, `अभी नहीं बना सकता: ${words(m[1], "hi")}।`)],
  [/^Built and saved\.$/, () => u("ٹرپ بن گیا اور محفوظ ہو گیا۔", "ट्रिप बन गया और महफ़ूज़ हो गया।")],
  [/^Built\.$/, () => u("ٹرپ بن گیا۔", "ट्रिप बन गया।")],
  [/^Add the client's phone and email so I can save it(, then ask me again for the rest)?\.$/, (m) =>
    u(`محفوظ کرنے کے لیے کلائنٹ کا فون اور ای میل بتائیے${m[1] ? "، پھر باقی کام کے لیے دوبارہ کہیے" : ""}۔`, `महफ़ूज़ करने के लिए क्लाइंट का फ़ोन और ईमेल बताइए${m[1] ? ", फिर बाक़ी काम के लिए दोबारा कहिए" : ""}।`)],
  [/^The PDF is in your downloads\.$/, () => u("پی ڈی ایف آپ کے ڈاؤن لوڈز میں ہے۔", "पी डी एफ़ आपके डाउनलोड्स में है।")],
  [/^I couldn't make the PDF — try Export\.$/, () => u("پی ڈی ایف نہیں بن سکی — ایکسپورٹ دبا کر دیکھیے۔", "पी डी एफ़ नहीं बन सकी — एक्सपोर्ट दबा कर देखिए।")],
  [/^Email (.+?) now\?$/, (m) => u(`کیا ${m[1]} کو ابھی ای میل کر دوں؟`, `क्या ${m[1]} को अभी ईमेल कर दूँ?`)],
  [/^PDF downloaded\.$/, () => u("پی ڈی ایف ڈاؤن لوڈ ہو گئی۔", "पी डी एफ़ डाउनलोड हो गई।")],
  [/^Excel quotation downloaded\.$/, () => u("ایکسل کوٹیشن ڈاؤن لوڈ ہو گئی۔", "एक्सेल कोटेशन डाउनलोड हो गई।")],
  [/^Trip saved\.$/, () => u("ٹرپ محفوظ ہو گیا۔", "ट्रिप महफ़ूज़ हो गया।")],
  // The draft's route: "Srinagar 2 nights, Gulmarg 1 night."
  [/^([A-Za-z][A-Za-z .'&-]*? \d+ nights?(?:, [A-Za-z][A-Za-z .'&-]*? \d+ nights?)*)\.$/, (m) => u(`${words(m[1], "ur")}۔`, `${words(m[1], "hi")}।`)],
  [/^Say yes or no\.$/, () => u("ہاں یا نہیں کہیے۔", "हाँ या नहीं कहिए।")],
  [/^Okay, I won't do that\.$/, () => u("ٹھیک ہے، نہیں کرتا۔", "ठीक है, नहीं करता।")],
  [/^Going back\.$/, () => u("واپس جا رہا ہوں۔", "वापस जा रहा हूँ।")],
  [/^Here's (Trip Info|Itinerary|Logistics|Pricing)\.$/i, (m) => {
    const t = TAB[m[1].toLowerCase()];
    return u(`یہ رہا ${t.ur}۔`, `यह रहा ${t.hi}।`);
  }],
  [/^(\d+) things? still to fill here\.$/, (m) => u(`یہاں ابھی ${m[1]} چیزیں باقی ہیں۔`, `यहाँ अभी ${m[1]} चीज़ें बाक़ी हैं।`)],
  [/^(?:Opening|Taking you to|Here's) (.+)\.$/, (m) => u(`${m[1]} کھول رہا ہوں۔`, `${m[1]} खोल रहा हूँ।`)],
  [/^Let's follow the money\.$/, () => u("چلیے پیسوں کا حساب دیکھتے ہیں۔", "चलिए पैसों का हिसाब देखते हैं।")],
  [/^Okay — I'm listening in (English|Hindi|Urdu|[^ ]+) now\.$/, (m) => {
    const n = /urdu/i.test(m[1]) ? u("اردو", "उर्दू") : /hindi/i.test(m[1]) ? u("ہندی", "हिंदी") : u("انگریزی", "अंग्रेज़ी");
    return u(`ٹھیک ہے — اب میں ${n.ur} میں سن رہا ہوں۔`, `ठीक है — अब मैं ${n.hi} में सुन रहा हूँ।`);
  }],
  [/^Tap the mic and speak\.$/, () => u("مائیک دبائیے اور بولیے۔", "माइक दबाइए और बोलिए।")],
  [/^(?:Hmm, )?that didn't work: (.+)\.$/i, (m) => u(`یہ نہیں ہو سکا: ${m[1]}۔`, `यह नहीं हो सका: ${m[1]}।`)],
];

// "Done! Rahul's trip…" → ["Done!", "Rahul's trip…"]; quotes and ₹ amounts stay whole.
function sentences(text) {
  return String(text || "")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z“"₹0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** An English Ching reply → { text (Urdu, for the panel), parts (to speak) }. */
export function urduReply(english) {
  const text = String(english || "").trim();
  if (!text) return { text: "", parts: [] };
  for (const [re, fn] of WHOLE) {
    const m = re.exec(text);
    if (m) {
      const p = fn(m);
      return { text: p.ur, parts: [p] };
    }
  }
  const parts = [];
  for (const s of sentences(text)) {
    let hit = null;
    for (const [re, fn] of SENTENCE) {
      const m = re.exec(s);
      if (m) {
        hit = fn(m);
        break;
      }
    }
    parts.push(hit || { en: s });
  }
  // Two "Done!"s in a row read badly ("Done! … Done.") — keep the first.
  const out = parts.filter((p, i) => !(i && p.ur && p.ur === parts[i - 1].ur));
  return { text: out.map((p) => p.ur || p.en).join(" "), parts: out };
}
