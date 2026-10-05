// Ching's manners: greetings, "how are you" (and asking back), the agent's
// answer to that, thanks, sorry, goodbyes — a short, friendly back-and-forth
// that ends by offering to get to work. Rule-based like everything in Ching.
//
// `topic` is what Ching itself last asked in small talk ("asked-how" after
// "How about you?", "offer" after "Shall we plan something?"), so a bare
// "good" or "yes" is understood as the answer to it. The widget keeps it for
// one turn (ChingWidget `chatTopic`); anything else resets it.
//
//   chatReply("how are you")            → { reply: "I'm doing great… How about you?", topic: "asked-how" }
//   chatReply("i'm good", "asked-how")  → { reply: "Glad to hear that! …", topic: "offer" }
//   chatReply("yes", "offer")           → { reply: "Great — tell me the client's name…", topic: null }

const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

const partOfDay = (now = new Date()) => {
  const h = now.getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
};

const OFFER = [
  "What are we planning today — a new trip, or changes to one?",
  "Shall we plan something? A new trip, or a change to one you have?",
  "Got a trip for me today?",
];
const HOW = ["How are you doing today?", "How's your day going?", "How are you today?"];

// The agent says how they are.
const FEEL_GOOD =
  /^(?:(?:i'?m|i am|am|we'?re|we are|all|everything(?:'s| is)?|doing|feeling|pretty|very|really|quite|super|so|just|also|too|alhamdulillah|by god's grace|thank god|thanks|thank you|and you|main|mein|hum|bilkul|sab)\s+)*(?:good|great|fine|well|okay|ok|alright|all right|awesome|fantastic|excellent|wonderful|amazing|not bad|nice|cool|happy|perfect|theek|thik|theek hoon|thik hu|badhiya|badiya|mast|accha|acha|khairiyat|khair|alhamdulillah|good good)(?:\s+(?:too|also|thanks|thank you|as well|hoon|hu|hai|hain|alhamdulillah|and you|what about you|how about you|you))*$/;
const FEEL_BAD =
  /^(?:(?:i'?m|i am|am|feeling|bit|a bit|little|a little|very|so|really|quite|not|kinda|kind of)\s+)*(?:tired|busy|stressed|exhausted|sick|unwell|bad|not good|not great|not well|not so good|so so|so-so|meh|sad|bored|hectic|overloaded|thak gaya|thaka hua|pareshan|bimar)(?:\s+(?:today|day|hoon|hu|hai|lately|these days))*$/;
const ASK_BACK = /^(?:and you|what about you|how about you|and yourself|how are you|aap kaise ho|aap kaise hain|tum kaise ho|aur aap|aur tum)$/;

const GREETING =
  /^(?:hello|hi|hey|hiya|namaste|namaskar|salaam|salam|assalamu? ?alaikum|asalam ?o ?alaikum|as-?salamu ?alaikum|aadab|adaab|good (?:morning|afternoon|evening|day))(?: (?:there|everyone|ji|sir|ma'?am|dear|friend|buddy))?$/;
const HOW_ARE_YOU =
  /^(?:(?:hello|hi|hey|salaam|namaste|good (?:morning|afternoon|evening))\s+)?(?:how are you(?: doing| today| doing today)?|how're you|how are things|how's it going|how is it going|how's everything|how is everything|how do you do|how have you been|what's up|whats up|wassup|sup|kaise ho|kaise hain|aap kaise hain|aap kaise ho|kya haal hai|kya hal hai|kya haal chaal|haal chaal|kaisa hai|kaisi ho|kya chal raha hai|sab theek|sab khairiyat)(?: (?:ching|dear|buddy|friend|ji))?$/;

/** A reply to small talk, or null when the text isn't small talk. */
export function chatReply(t, topic = null, { now = new Date() } = {}) {
  const s = String(t || "").trim().replace(/\s+/g, " ");
  if (!s || s.split(" ").length > 9) return null;

  // Salaam is answered in kind; "good morning" by the time of day.
  if (GREETING.test(s)) {
    if (/salaam|salam|alaikum/.test(s)) return { reply: `Wa alaikum assalam! ${pick(HOW)}`, topic: "asked-how" };
    if (/^aadab|^adaab/.test(s)) return { reply: `Aadab! ${pick(HOW)}`, topic: "asked-how" };
    if (/^good (morning|afternoon|evening)/.test(s)) return { reply: `Good ${partOfDay(now)}! ${pick(HOW)}`, topic: "asked-how" };
    if (/^namaste|^namaskar/.test(s)) return { reply: `Namaste! ${pick(HOW)}`, topic: "asked-how" };
    return { reply: `${pick(["Hello!", "Hi there!", "Hey!"])} ${pick(HOW)}`, topic: "asked-how" };
  }
  if (HOW_ARE_YOU.test(s)) {
    const me = pick(["I'm doing great, thanks for asking!", "I'm good, thank you — fully charged and ready.", "All good here, thanks for asking!"]);
    return { reply: `${me} ${pick(["How about you?", "How are you doing?", "And how are you?"])}`, topic: "asked-how" };
  }
  if (ASK_BACK.test(s)) return { reply: `I'm doing great, thanks for asking! ${pick(OFFER)}`, topic: "offer" };

  // How the agent is — always understood when said in full ("I'm good"), and a
  // bare "good" / "fine" right after Ching asked.
  const fullAnswer = /^(?:i'?m|i am|am|we'?re|all|everything|doing|feeling|main|mein|alhamdulillah)\b/.test(s) || /\b(?:theek hoon|thik hu|khairiyat)\b/.test(s);
  if ((topic === "asked-how" || fullAnswer) && FEEL_BAD.test(s)) {
    return {
      reply: pick([
        "Sorry to hear that. Let me take some work off your plate — tell me the trip and I'll fill it in.",
        "Oh no — hope it gets better. I can do the heavy lifting: just tell me the trip.",
      ]),
      topic: "offer",
    };
  }
  if ((topic === "asked-how" || fullAnswer) && FEEL_GOOD.test(s)) {
    const askedBack = /\b(?:and you|what about you|how about you|you)$/.test(s);
    return {
      reply: `${pick(["Glad to hear that!", "That's great to hear!", "Wonderful!"])}${askedBack ? " I'm doing great too, thanks." : ""} ${pick(OFFER)}`,
      topic: "offer",
    };
  }

  // The answer to "Shall we plan something?"
  if (topic === "offer") {
    if (/^(?:yes|yeah|yep|yup|sure|ok|okay|haan|han|ji|ji haan|of course|let's go|lets go|let's do it|new trip|a new trip|new one|why not|go ahead|please)(?: (?:please|sure|ji|a new trip|new trip|let's go))?$/.test(s)) {
      return { reply: "Great — tell me the client's name, how many guests, the start date and where they're going. I'll fill in the rest.", topic: null };
    }
    if (/^(?:changes?|change one|edit|edit one|an existing one|existing|old trip|modify)(?: (?:to )?(?:one|a trip|an existing trip|the trip))?$/.test(s)) {
      return { reply: "Sure — say “open” and the client's name, like “open Rahul's trip”, and tell me what to change.", topic: null };
    }
    if (/^(?:no|nope|nah|not now|not yet|nothing|later|maybe later|no thanks|no thank you|nahi|abhi nahi|just checking|just saying hi)$/.test(s)) {
      return { reply: pick(["No problem — I'm right here whenever you need me.", "Sure thing. Just call me when you're ready."]), topic: null };
    }
  }

  if (/^(?:thank you|thanks|thank u|thanks a lot|thank you so much|thanks ching|thank you ching|many thanks|shukriya|shukria|dhanyavad|dhanyawad|jazakallah|jazak allah)(?: (?:so much|a lot|very much|ching|dear|ji))?$/.test(s)) {
    return { reply: `${pick(["You're welcome!", "My pleasure!", "Anytime!"])} ${pick(["Anything else I can help with?", "Is there anything else?", "What's next?"])}`, topic: "offer" };
  }
  if (/^(?:sorry|my bad|oops|apologies|sorry about that|maaf karna|maafi)(?: (?:ching|about that))?$/.test(s)) {
    return { reply: "No worries at all! What would you like to do?", topic: "offer" };
  }
  if (/^(?:nice to meet you|pleased to meet you|good to meet you|glad to meet you)(?: too| ching)?$/.test(s)) {
    return { reply: "Nice to meet you too! I'm Ching. Say “call me” and your name, and I'll remember it.", topic: null };
  }
  if (/^(?:are you there|you there|ching are you there|can you hear me|are you listening|hello are you there)$/.test(s)) {
    return { reply: "Right here and listening! What do you need?", topic: "offer" };
  }
  if (/^(?:who made you|who built you|who created you|who developed you)$/.test(s)) {
    return { reply: "The Via Itinerary team built me — to take the typing out of trip planning for travel agents like you.", topic: null };
  }
  if (/^(?:take care|khuda hafiz|allah hafiz|alvida|see you later|see you soon|talk later|catch you later)$/.test(s)) {
    return { reply: pick(["Take care! I'll be right here when you need me.", "Khuda hafiz! Talk soon."]), topic: null };
  }
  return null;
}
