// Ching's personality: how it talks back, in the language the agent used —
// English, Hinglish (Roman Hindi/Urdu), Hindi (Devanagari) or Urdu (Nastaliq).
// Warm, quick, a little cheeky, always brief, never at the client's expense.
// Pure JS: picks words only. It never decides what the trip is — that stays
// with the parsers — so it can't change what gets filled.
//
//   replyStyle(raw, listenLang)      → "en" | "hinglish" | "hi" | "ur"
//   smalltalkIntent(text)            → "greet" | "joke" | … | null
//   personaLine(intent, style, ctx)  → { text, parts?, prefer? } | null
//     parts — [{ ur, hi }] for speaking Urdu / Hindi (see voice.js speakUrdu)
//     prefer — "hi" to read with a Hindi voice first

const DEVA = /[ऀ-ॿ]/;
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
// Roman Hindi / Urdu words that are rarely English.
const ROMAN = /\b(?:hai|hain|ho|hoon|hun|kya|kaise|kaisa|kaisi|karo|kar\s+do|karna|banao|bana\s+do|ke\s+liye|liye|mein|mai|aap|aapka|tum|tumhara|nahi|nahin|bhai|yaar|yar|haan|han|theek|thik|acha|accha|achha|shukriya|shukria|chahiye|kitna|kitne|sunao|batao|bolo|chalo|kab|kahan|kyun|kyon|mujhe|humein|hum|apna|bahut|bohot|ekdum|matlab|samjhe|samjha|raat|din|bachche|bacche|log|logon|wala|wali|jaldi|abhi|phir|kuch|koi|sab|bas|ji|janab|khuda|allah|inshallah|mashallah|subhanallah|dost|mazak|chutkula|thak|pareshan|gussa|chai|khana|ghar|kaam|naam|accha\s+hai)\b/gi;

/** Which language to answer in, from how the agent spoke (raw, before translation). */
export function replyStyle(raw, listenLang = "") {
  const s = String(raw || "");
  if (ARABIC.test(s) || listenLang === "ur-PK") return "ur";
  if (DEVA.test(s) || listenLang === "hi-IN") return "hi";
  const words = s.trim().split(/\s+/).filter(Boolean).length;
  const hits = (s.match(ROMAN) || []).length;
  if (hits >= 2 || (hits >= 1 && words <= 4)) return "hinglish";
  return "en";
}

// ── what the agent is saying (on the English / romanized text) ──────────────
const INTENTS = [
  ["joke", /\b(?:joke|jokes|make me laugh|something funny|funny one|mazak|mazaak|chutkula|chutkule|latifa|hasao|hansao)\b/],
  ["roast", /\b(?:you(?:'re| are) (?:useless|stupid|dumb|slow|bad|terrible|the worst)|useless|bekaar|bekar|ghatiya|bewakoof|pagal ho|you suck|stupid bot|dumb bot)\b/],
  ["human", /\b(?:are you (?:a )?(?:human|real|robot|bot|ai|person)|kya tum insaan|insaan ho|robot ho|tum asli)\b/],
  ["love", /\b(?:i love you|love you ching|marry me|shaadi karoge|you(?:'re| are) (?:cute|sweet|the best|amazing|awesome|brilliant)|best assistant|pyaar|tum best)\b/],
  ["tired", /\b(?:i(?:'m| am) (?:so |very |really )?(?:tired|exhausted|stressed|burnt out|done for today)|long day|thak gaya|thak gayi|thaka hua|pareshan hoon|bahut kaam)\b/],
  ["boss", /\b(?:my boss|boss is|manager is) (?:angry|shouting|upset|mad)|\bboss (?:gussa|naraz)\b/],
  ["bargain", /\b(?:client|customer) (?:wants|is asking for|asking) (?:a )?(?:discount|less|cheaper)|\b(?:bargain|bargaining|mol bhav|molbhav|discount maang)\b/],
  ["chai", /\b(?:chai|tea|coffee|kahwa|kehwa|noon chai)\b/],
  ["sleep", /\b(?:do you (?:ever )?sleep|don't you sleep|tum sote ho|neend)\b/],
  ["bored", /\b(?:i(?:'m| am) bored|bore ho (?:raha|rahi)|boring)\b/],
  ["motivate", /\b(?:motivate me|motivation|no bookings|slow day|sales are (?:low|down)|business (?:is )?slow|booking nahi)\b/],
  ["weather", /\b(?:weather|mausam|barf|snow(?:ing)?|is it cold)\b/],
  ["who", /^(?:who are you|what are you|what is your name|what's your name|tumhara naam|aapka naam|tum kaun ho|aap kaun ho)\b/],
  ["maker", /^(?:who made you|who built you|who created you|tumhe kisne banaya)\b/],
  ["thanks", /^(?:thank you|thanks|thank u|thanks a lot|thank you so much|shukriya|shukria|dhanyavad|dhanyawad|jazakallah|jazak allah|great job|well done|good job|shabash|wah)\b/],
  ["sorry", /^(?:sorry|my bad|oops|apologies|maaf karna|maafi)\b/],
  ["bye", /^(?:bye|goodbye|good night|see you|take care|khuda hafiz|allah hafiz|alvida|chalo bye|phir milte)\b/],
  ["how", /^(?:(?:hello|hi|hey|salaam|namaste)\s+)?(?:how are you|how's it going|how are things|what's up|whats up|kaise ho|kaise hain|kya haal|kya hal|kaisa hai|kaisi ho|sab theek|sab khairiyat|kya chal raha)\b/],
  ["greet", /^(?:hello|hi|hey|hiya|namaste|namaskar|salaam|salam|assalamu? ?alaikum|asalam ?o ?alaikum|aadab|adaab|good (?:morning|afternoon|evening))\b/],
];

/** A small-talk intent for (English / romanized) text, or null. */
export function smalltalkIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t || t.split(" ").length > 12) return null;
  for (const [intent, re] of INTENTS) if (re.test(t)) return intent;
  return null;
}

// ── the lines ────────────────────────────────────────────────────────────────
// en / hinglish: strings. ur+hi: [urdu, hindi] pairs (the same words in two scripts).
const L = {
  greet: {
    en: ["Hello! Ching here — who are we sending on holiday today?", "Hey! Coffee's optional, itineraries aren't. What's the trip?", "Hi! Tell me the trip and watch me show off."],
    hinglish: ["Hello ji! Ching hazir hai — aaj kisko Kashmir ghumana hai?", "Aadab! Bataiye, aaj kaunsa trip banayein?", "Hey! Trip bolo, baaki kaam Ching ka."],
    pairs: [["آداب! چنگ حاضر ہے — آج کس کو کشمیر گھمانا ہے؟", "आदाब! चिंग हाज़िर है — आज किसको कश्मीर घुमाना है?"], ["سلام! بتائیے، آج کون سا ٹرپ بنائیں؟", "नमस्ते! बताइए, आज कौन सा ट्रिप बनाएँ?"]],
  },
  how: {
    en: ["Fully charged and fully booked — in a good way. You?", "Better than a Gulmarg sunrise. How are you?", "Great, thanks! Zero coffee, a hundred percent ready. And you?"],
    hinglish: ["Ekdum first class! Gulmarg ki dhoop jaisa fresh. Aap sunaiye?", "Mast hoon ji, battery full aur bookings ke liye taiyaar. Aap kaise ho?", "Alhamdulillah, sab badhiya! Aapka din kaisa ja raha hai?"],
    pairs: [["الحمدللہ، بالکل فرسٹ کلاس! گلمرگ کی دھوپ جیسا تازہ۔ آپ سنائیے؟", "अलहम्दुलिल्लाह, बिल्कुल फ़र्स्ट क्लास! गुलमर्ग की धूप जैसा ताज़ा। आप सुनाइए?"], ["مست ہوں جی، بیٹری فل ہے۔ آپ کیسے ہیں؟", "मस्त हूँ जी, बैटरी फुल है। आप कैसे हैं?"]],
  },
  joke: {
    en: [
      "Why did the tourist bring a ladder to Gulmarg? Heard the hotel rates were on another level.",
      "I asked the houseboat if it was tired. It said, \"No, just a little Dal.\"",
      "My favourite exercise? Jumping to conclusions — then fixing the itinerary.",
      "A client asked for snow in May. I said, \"Sure — in Sonamarg, and in your freezer.\"",
      "Why don't itineraries ever get lost? They always know their next day.",
    ],
    hinglish: [
      "Client bola: \"Bhai, Gulmarg mein barf guarantee chahiye.\" Maine kaha: \"Guarantee sirf fridge ki hoti hai, Gulmarg ki nahi!\"",
      "Houseboat se poocha: \"Thak gaye?\" Bola: \"Nahi yaar, bas thoda Dal mein hoon.\"",
      "Client ka budget dekh ke Pahalgam ke ghode bhi has pade — par main nahi hasunga, main professional hoon.",
      "Gondola wale ne kaha: \"Upar jaana free hai, neeche aane ka charge alag.\" Main bola: \"Yeh toh GST se bhi tez hai!\"",
    ],
    pairs: [
      ["کلائنٹ بولا: \"گلمرگ میں برف کی گارنٹی چاہیے۔\" میں نے کہا: \"گارنٹی صرف فریج کی ہوتی ہے، گلمرگ کی نہیں!\"", "क्लाइंट बोला: \"गुलमर्ग में बर्फ़ की गारंटी चाहिए।\" मैंने कहा: \"गारंटी सिर्फ़ फ़्रिज की होती है, गुलमर्ग की नहीं!\""],
      ["ہاؤس بوٹ سے پوچھا: \"تھک گئے؟\" بولا: \"نہیں یار، بس تھوڑا ڈل میں ہوں۔\"", "हाउसबोट से पूछा: \"थक गए?\" बोला: \"नहीं यार, बस थोड़ा डल में हूँ।\""],
    ],
  },
  roast: {
    en: ["Ouch. I'll pretend that was a typo. Tell me again and I'll get it right.", "Harsh, but fair — I'm still learning. Say it another way and I'll nail it.", "I've been called worse by a printer. Let's try that again?"],
    hinglish: ["Arre, dil pe lag gayi! Theek hai, ek baar aur boliye, is baar perfect karunga.", "Gussa jaayaz hai ji. Dobara bataiye, main sudhar jaata hoon.", "Itna gussa? Chai pi lijiye, phir dobara boliye — main ready hoon."],
    pairs: [["ارے، دل پہ لگ گئی! ایک بار پھر بولیے، اس بار ٹھیک کروں گا۔", "अरे, दिल पे लग गई! एक बार फिर बोलिए, इस बार ठीक करूँगा।"], ["غصہ جائز ہے جی۔ دوبارہ بتائیے، میں سدھر جاتا ہوں۔", "ग़ुस्सा जायज़ है जी। दोबारा बताइए, मैं सुधर जाता हूँ।"]],
  },
  human: {
    en: ["Not human — but I never take a lunch break, never mix up Pahalgam and Pahalgam Valley, and never ask for a raise.", "I'm Ching, an assistant made of code and good intentions. No coffee needed."],
    hinglish: ["Insaan toh nahi hoon, par chai-break bhi nahi leta aur salary bhi nahi maangta!", "Main Ching hoon ji — code ka bana, par dil se kaam karta hoon."],
    pairs: [["انسان تو نہیں ہوں، پر نہ چائے کا وقفہ لیتا ہوں نہ تنخواہ مانگتا ہوں!", "इंसान तो नहीं हूँ, पर न चाय का वक़्फ़ा लेता हूँ न तनख़्वाह माँगता हूँ!"]],
  },
  love: {
    en: ["Aww. I'd blush, but I'm mostly code. Let's book something!", "You're making my circuits warm. Now — whose trip are we doing?"],
    hinglish: ["Arre sharma gaya main! Chaliye, is khushi mein ek booking ho jaaye.", "Aap bhi kam nahi ho ji! Ab bataiye, agla trip kiska hai?"],
    pairs: [["ارے، شرما گیا میں! چلیے، اسی خوشی میں ایک بکنگ ہو جائے۔", "अरे, शरमा गया मैं! चलिए, इसी ख़ुशी में एक बुकिंग हो जाए।"]],
  },
  tired: {
    en: ["Long day? Sit back. Tell me the trip in one breath and I'll do the typing.", "Take a sip of something warm. You talk, I'll fill — that's the deal."],
    hinglish: ["Thak gaye? Aap bas bol dijiye, likhne ka kaam mera. Chai pi lijiye tab tak.", "Aaram se ji. Ek saans mein trip bata dijiye, baaki main sambhaal lunga."],
    pairs: [["تھک گئے؟ آپ بس بول دیجیے، لکھنے کا کام میرا۔ تب تک چائے پی لیجیے۔", "थक गए? आप बस बोल दीजिए, लिखने का काम मेरा। तब तक चाय पी लीजिए।"]],
  },
  boss: {
    en: ["Bosses calm down fastest when the quote is already sent. Want me to build it now?", "Let's give your boss nothing to shout about — tell me the trip."],
    hinglish: ["Boss ka gussa quotation bhejte hi thanda hota hai. Chaliye abhi bana dete hain!", "Fikar mat kijiye, aisa itinerary banayenge ki boss bhi tareef karega."],
    pairs: [["باس کا غصہ کوٹیشن بھیجتے ہی ٹھنڈا ہوتا ہے۔ چلیے ابھی بنا دیتے ہیں!", "बॉस का ग़ुस्सा कोटेशन भेजते ही ठंडा होता है। चलिए अभी बना देते हैं!"]],
  },
  bargain: {
    en: ["Classic. Say \"make it cheaper\" and I'll find a cheaper hotel or cab — without touching your margin unless you ask.", "Every client wants Gulmarg at Srinagar prices. Say \"make it cheaper\" and I'll show the options."],
    hinglish: ["Mol-bhav toh Kashmir ki parampara hai! \"Make it cheaper\" boliye, main sasta hotel ya gaadi dhoondh deta hoon.", "Har client ko Gulmarg Srinagar ke rate pe chahiye! \"Make it cheaper\" boliye, options dikhata hoon."],
    pairs: [["مول بھاؤ تو روایت ہے! \"میک اِٹ چیپر\" بولیے، میں سستا ہوٹل یا گاڑی ڈھونڈ دیتا ہوں۔", "मोल-भाव तो रिवायत है! \"मेक इट चीपर\" बोलिए, मैं सस्ता होटल या गाड़ी ढूँढ देता हूँ।"]],
  },
  chai: {
    en: ["I can't drink it, but I fully support noon chai breaks. Trip after the sip?", "Kahwa for you, itineraries for me. Deal?"],
    hinglish: ["Chai aap peejiye, trip main banaata hoon — fair deal?", "Noon chai ka time hai? Aap enjoy kijiye, main itinerary ready rakhta hoon."],
    pairs: [["چائے آپ پیجیے، ٹرپ میں بناتا ہوں — ٹھیک ہے؟", "चाय आप पीजिए, ट्रिप मैं बनाता हूँ — ठीक है?"]],
  },
  sleep: {
    en: ["Sleep? I just wait very patiently between your trips.", "Never. Somebody has to keep the hotel rates company at night."],
    hinglish: ["Sona? Main toh bas aapke agle trip ka intezaar karta hoon.", "Kabhi nahi ji! Raat bhar hotel rates ki rakhwali karta hoon."],
    pairs: [["سونا؟ میں تو بس آپ کے اگلے ٹرپ کا انتظار کرتا ہوں۔", "सोना? मैं तो बस आपके अगले ट्रिप का इंतज़ार करता हूँ।"]],
  },
  bored: {
    en: ["Bored? Let's plan a seven-night Kashmir loop just to feel something.", "I know a cure: a family of six, three hotels and one Innova. Want to try?"],
    hinglish: ["Bore ho rahe ho? Chaliye ek 7 raat ka Kashmir trip bana ke dekhte hain, mazaa aayega!", "Iska ilaaj hai: ek bada family trip. Bataiye shuru karein?"],
    pairs: [["بور ہو رہے ہیں؟ چلیے ایک سات رات کا کشمیر ٹرپ بنا کر دیکھتے ہیں!", "बोर हो रहे हैं? चलिए एक सात रात का कश्मीर ट्रिप बनाकर देखते हैं!"]],
  },
  motivate: {
    en: ["Slow days end with one good quote. Let's send three today — I'll build, you charm.", "Every big season starts with a single \"sure, send me the itinerary\". Let's get one out."],
    hinglish: ["Mandi ka din bhi ek achhe quotation se badalta hai. Aaj teen bhejte hain — banaunga main, manaoge aap!", "Season ek \"haan, itinerary bhejo\" se shuru hota hai. Chaliye pehla bhejte hain!"],
    pairs: [["سست دن بھی ایک اچھے کوٹیشن سے بدلتا ہے۔ آج تین بھیجتے ہیں — بناؤں گا میں، منائیں گے آپ!", "सुस्त दिन भी एक अच्छे कोटेशन से बदलता है। आज तीन भेजते हैं — बनाऊँगा मैं, मनाएँगे आप!"]],
  },
  weather: {
    en: ["I don't have a weather feed yet — but if it's Kashmir, pack a jacket. Always pack a jacket.", "No live weather here, sorry. Rule of thumb: Gulmarg is colder than whatever the client thinks."],
    hinglish: ["Mausam ka live data abhi nahi hai — par Kashmir hai toh jacket zaroor rakhwaiye!", "Weather toh nahi pata, par Gulmarg hamesha client ki soch se zyada thanda hota hai."],
    pairs: [["موسم کا لائیو ڈیٹا ابھی نہیں ہے — پر کشمیر ہے تو جیکٹ ضرور رکھوائیے!", "मौसम का लाइव डेटा अभी नहीं है — पर कश्मीर है तो जैकेट ज़रूर रखवाइए!"]],
  },
  who: {
    en: ["I'm Ching, your travel-desk sidekick. Tell me a trip and I'll fill the whole thing — hotels, cabs, day plan, price — while you talk."],
    hinglish: ["Main Ching hoon, aapka travel desk ka saathi. Trip boliye — hotel, gaadi, din ka plan, price, sab main bharunga."],
    pairs: [["میں چنگ ہوں، آپ کا ٹریول ڈیسک کا ساتھی۔ ٹرپ بولیے — ہوٹل، گاڑی، دن کا پلان، قیمت، سب میں بھروں گا۔", "मैं चिंग हूँ, आपका ट्रैवल डेस्क का साथी। ट्रिप बोलिए — होटल, गाड़ी, दिन का प्लान, क़ीमत, सब मैं भरूँगा।"]],
  },
  maker: {
    en: ["The Via Itinerary team built me — to take the typing out of trip planning."],
    hinglish: ["Mujhe Via Itinerary ki team ne banaya — taaki aapko typing na karni pade."],
    pairs: [["مجھے ویا آئٹنریری کی ٹیم نے بنایا — تاکہ آپ کو ٹائپنگ نہ کرنی پڑے۔", "मुझे वाया आइटिनरेरी की टीम ने बनाया — ताकि आपको टाइपिंग न करनी पड़े।"]],
  },
  thanks: {
    en: ["Anytime! Go close that deal.", "My pleasure. Next trip?", "Happy to help — that's literally my whole job."],
    hinglish: ["Arre shukriya kis baat ka! Agla trip?", "Koi baat nahi ji, yahi toh kaam hai mera. Aur kuch?", "Khush rahiye! Ab deal pakki kijiye."],
    pairs: [["شکریہ کس بات کا! اگلا ٹرپ؟", "शुक्रिया किस बात का! अगला ट्रिप?"], ["کوئی بات نہیں جی، یہی تو کام ہے میرا۔ اور کچھ؟", "कोई बात नहीं जी, यही तो काम है मेरा। और कुछ?"]],
  },
  sorry: {
    en: ["No worries at all! What would you like to do?", "All forgiven. Even I mix up Sonamarg and Sonmarg sometimes."],
    hinglish: ["Arre koi baat nahi ji! Bataiye kya karna hai?", "Maafi kis baat ki? Chaliye aage badhte hain."],
    pairs: [["ارے کوئی بات نہیں جی! بتائیے کیا کرنا ہے؟", "अरे कोई बात नहीं जी! बताइए क्या करना है?"]],
  },
  bye: {
    en: ["Bye! Go sell some holidays.", "Take care! I'll keep the trips warm."],
    hinglish: ["Khuda hafiz! Jaate jaate ek booking pakki kar lena.", "Chaliye phir milte hain — trips main sambhaal ke rakhta hoon."],
    pairs: [["خدا حافظ! جاتے جاتے ایک بکنگ پکی کر لیجیے گا۔", "ख़ुदा हाफ़िज़! जाते-जाते एक बुकिंग पक्की कर लीजिएगा।"]],
  },
  notUnderstood: {
    en: ["Hmm, I didn't catch that. Try something like \"make Gulmarg 2 nights\".", "That one flew over my head — like the Gondola. Say it another way?", "Didn't get that. You can say \"what's pending\" or \"open the ledger\"."],
    hinglish: ["Yeh baat thodi upar se nikal gayi — Gondola ki tarah! Ek baar aur boliye?", "Samajh nahi aaya ji. Aise boliye: \"Gulmarg 2 raat kar do\"."],
    pairs: [["یہ بات تھوڑی اوپر سے نکل گئی — گنڈولا کی طرح! ایک بار پھر بولیے؟", "यह बात थोड़ी ऊपर से निकल गई — गंडोला की तरह! एक बार फिर बोलिए?"], ["سمجھ نہیں آیا جی۔ ایسے بولیے: \"گلمرگ دو رات کر دو\"۔", "समझ नहीं आया जी। ऐसे बोलिए: \"गुलमर्ग दो रात कर दो\"।"]],
  },
  cancelled: {
    en: ["Okay, stopped — nothing was changed.", "Hit the brakes. Nothing changed."],
    hinglish: ["Theek hai, ruk gaya — kuch nahi badla.", "Brake laga diya ji, kuch nahi badla."],
    pairs: [["ٹھیک ہے، رک گیا — کچھ نہیں بدلا۔", "ठीक है, रुक गया — कुछ नहीं बदला।"]],
  },
};

let lastLine = "";
const pick = (xs) => {
  if (xs.length <= 1) return xs[0];
  let x;
  for (let i = 0; i < 4; i += 1) {
    x = xs[Math.floor(Math.random() * xs.length)];
    if ((Array.isArray(x) ? x[0] : x) !== lastLine) break;
  }
  lastLine = Array.isArray(x) ? x[0] : x;
  return x;
};

/**
 * A line in the agent's language for `intent` (see L), or null when Ching has
 * no line for it. { name } greets by name in English / Hinglish.
 */
export function personaLine(intent, style = "en", { name = "" } = {}) {
  const set = L[intent];
  if (!set) return null;
  if (style === "ur" || style === "hi") {
    const [ur, hi] = pick(set.pairs);
    return { text: style === "ur" ? ur : hi, parts: [{ ur, hi }], prefer: style === "hi" ? "hi" : "ur" };
  }
  let text = pick(style === "hinglish" ? set.hinglish : set.en);
  if (name && (intent === "greet" || intent === "how")) text = text.replace(/^(Hello ji|Hello|Hey|Hi|Aadab)!/, `$1, ${name}!`);
  return { text };
}

/** Every intent Ching has lines for (for tests). */
export const PERSONA_INTENTS = Object.keys(L);

// ── Ching's everyday replies in Hinglish (for Roman Hindi / Urdu turns) ─────
// Only the stock phrases; names, amounts and specific changes stay as they are.
const HINGLISH = [
  [/^(?:Done!|All set!|There you go!|Ta-da!) (.+?)'s trip is filled in\.$/, (m) => `Ho gaya! ${m[1]} ka trip taiyaar hai.`],
  [/^(?:Done!|All set!|There you go!|Ta-da!) The trip is filled in\.$/, () => "Ho gaya! Trip taiyaar hai."],
  [/^Total comes to (.+)\.$/, (m) => `Total ${m[1]} ban raha hai.`],
  [/^The total is (.+)\.$/, (m) => `Total ${m[1]} hai.`],
  [/^Everything's filled — just hit save or export\.$/, () => "Sab bhar diya — bas save ya export kar dijiye."],
  [/^Still need (.+)\.$/, (m) => `Abhi bhi chahiye: ${m[1].replace(/ and /g, " aur ")}.`],
  [/^Before you send it, still need (.+)\.$/, (m) => `Bhejne se pehle chahiye: ${m[1].replace(/ and /g, " aur ")}.`],
  [/^Everything required is filled\.$/, () => "Zaroori sab bhar gaya hai."],
  [/^Also worth adding: (.+)\.$/, (m) => `Yeh bhi daal dijiye toh behtar: ${m[1].replace(/ and /g, " aur ")}.`],
  [/^Say “confirm” to build it(.*)$/, (m) => `Theek lage toh “confirm” boliye${m[1]}`],
];

/** An English Ching reply → Hinglish, sentence by sentence ("" sentences unchanged). */
export function hinglishReply(english) {
  const text = String(english || "").trim();
  if (!text) return text;
  return text
    .replace(/(?:Done!|All set!|There you go!|Ta-da!) (.+?)'s trip is filled in\./, (m, who) => `Ho gaya! ${who} ka trip taiyaar hai.`)
    .replace(/(?:Done!|All set!|There you go!|Ta-da!) The trip is filled in\./, "Ho gaya! Trip taiyaar hai.")
    .replace(/^(?:Done\.|Got it\.|Updated\.)\s+/, "Ho gaya. ")
    .split(/(?<=[.!?])\s+(?=[A-Z“"₹0-9])/)
    .map((s) => {
      for (const [re, fn] of HINGLISH) {
        const m = re.exec(s);
        if (m) return fn(m);
      }
      return s;
    })
    .join(" ");
}
