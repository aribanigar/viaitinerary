// What Ching can do, as a tree: branch → what it covers → things to say. It is
// what "help" / "what can you do" answers from, one branch at a time, so an
// agent can find a capability by asking about it ("help with payments") rather
// than reading a manual. Every example is a sentence the parsers really take —
// add a branch here when Ching learns something new. Pure.
const B = (id, label, can, words, covers, examples) => ({ id, label, can, words, covers, examples })

export const CAPABILITY_TREE = [
  B('plan', 'Plan a trip', 'plan a trip', 'plan|planning|new trip|create|itinerar(?:y|ies)|package|quote|quotation|trips?',
    'I plan a whole trip from your catalog: route, hotels, cab, day-wise plan and price. Tell me who, how many, when, how long and where, in any order.',
    ['plan a Kashmir trip for 4 people, 5 nights from 10 November, budget hotels', 'honeymoon in Kashmir, 6 nights from 20 December, somewhere quiet by the river', 'create a trip step by step']),
  B('where', 'Suggest where to go', 'suggest where a client should go', 'where|destinations?|places?|suggest(?:ion)?s?|undecided|not sure',
    'When a client has not chosen a place, tell me what they want from it and I suggest up to three of your destinations, each with why, or a combination when no one place has it all.',
    ['where should they go for snow and shopping', 'suggest a quiet place by the river for a family', 'plan the first one', 'tag Gulmarg as snow and skiing']),
  B('client', "A client's message", 'read a client’s voice note or message', 'voice ?notes?|whats ?app|messages?|client said|audio|paste',
    "Play a client's voice note to the mic, or paste their message: I read it for the dates, people, towns, rooms and wishes and plan it as they said.",
    ['(paste the client’s message into my box)', '(tap the mic and play the voice note)']),
  B('find', 'Find hotels', 'find hotels', 'hotels?|stays?|rooms?|houseboats?|accommodation|find|search|tags?|views?',
    'I search your own hotels by price, stars, meals and availability, and by what they are like once they are tagged.',
    ['find a 4 star in Srinagar under 6000 with breakfast', 'which hotels are riverside in Pahalgam', 'tag Heevan Resort as riverside and quiet', 'use the first one']),
  B('options', 'Hotel options', 'give three hotel options for a stay', 'options?|choices?|alternatives?|upgrade|cheaper one|what else',
    'For any stay I give three hotels: the one I would book, one that costs less and one step up, each with the price difference. You can switch, or offer them all to the client.',
    ['options for Gulmarg', 'use the cheaper one in Pahalgam', 'upgrade Srinagar', 'offer all three to the client']),
  B('edit', 'Change the open trip', 'change the open trip', 'change|edit|update|swap|replace|add|remove|nights?|cabs?|activit(?:y|ies)|days?',
    'With a trip open I change it as you speak, and every change can be undone.',
    ['make Gulmarg 2 nights', 'change the Srinagar hotel to Grand Mumtaz', 'add shikara ride on day 2', 'sort the hotels', 'undo']),
  B('price', 'Price it', 'price it', 'pric(?:e|ing)|margins?|profit|gst|cheaper|budget|totals?|costs?',
    'I set the margin or work back from the price you want to quote, and can look for a cheaper plan.',
    ['quote 45000', '15000 per person', 'give me 20% margin', "what's my profit", 'make it cheaper']),
  B('send', 'Documents and sending', 'make and send documents', 'pdf|excel|invoice|vouchers?|receipts?|documents?|send|email|proposal|download|export',
    'I make and send the itinerary PDF, quotation, invoice, vouchers and receipts for any trip.',
    ['export the pdf', 'email it to me', "download Rahul's vouchers", 'email the invoice to Rahul', 'send it to the client on WhatsApp']),
  B('money', 'Payments', 'record payments and send reminders', 'payments?|paid|advance|balance|reminders?|dues?|unpaid',
    'I record what a client paid (after a yes), and send payment links and reminders.',
    ['Rahul paid 20000 by UPI', 'send a payment reminder to Rahul', "who hasn't paid"]),
  B('ops', 'Operations', 'run the day’s operations', 'operations?|suppliers?|drivers?|confirm(?:ed|ation)?|arrivals?|bookings?|status',
    'I chase suppliers, note drivers and tell you what is happening today.',
    ["today's arrivals", 'pending confirmations', "the driver for Rahul's trip is Imran 9876543210", "mark Rahul's trip as confirmed"]),
  B('memory', 'What I remember', 'remember your habits and our conversation', 'remember|memory|forget|usual|favou?rite|call me|conversation|history',
    'I learn your usual hotels and cabs from the trips you save, remember what you tell me, and keep our conversation.',
    ['my usual hotel in Gulmarg is Highlands Park', 'when I say Heaven I mean Heevan Resort', 'what do you remember', 'clear our conversation']),
  B('report', 'How I am doing', 'show how well I am doing', 'report|score|insights?|miss(?:es|ed)?|mistakes?|doing|wrong',
    'I keep count of what I understood and log every request I got wrong, grouped by the kind of sentence, so you can see what to teach me next.',
    ['how are you doing', 'what did you miss']),
  B('go', 'Open a page', 'open any page', 'open|go to|show|page|ledger|dashboard|settings',
    'I open any page or trip by name.',
    ['open the ledger', "open Rahul's trip", 'find unpaid trips to Gulmarg in October']),
]

const ASK = /^(?:please )?(?:help|what (?:all )?can you do|what do you do|how do i use you|what are your (?:commands|features)|commands|(?:show|tell) me what you can do)\b\s*(?:me )?(?:with|about|for|on|to|in)?\s*(.*)$/

/** "help", "what can you do with payments" → { topic } (topic may be ""), else null. */
export function helpAsk(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+/g, ' ').replace(/\s+/g, ' ').trim()
  const m = ASK.exec(t)
  if (!m) return null
  const topic = m[1].replace(/^(?:the|my|a|an) /, '').trim()
  // "help me plan a kashmir trip for 4 people…" is a request, not a question about Ching.
  if (topic.split(' ').length > 4) return null
  return { topic }
}

/** The branch a topic belongs to ("payments" → money), or null. */
export const branchFor = (topic) => (topic ? CAPABILITY_TREE.find((b) => new RegExp(`\\b(?:${b.words})\\b`).test(topic)) || null : null)

/** What Ching says: the branches, or one branch with its examples. */
export function helpReply(topic = '') {
  const b = branchFor(topic)
  if (b) return `${b.covers} Try: ${b.examples.slice(0, 4).map((e) => (e.startsWith('(') ? e : `“${e}”`)).join(', ')}.`
  const names = CAPABILITY_TREE.map((x) => x.can)
  return `I can ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}. Ask “help with hotels” (or payments, documents…) for what to say, or just tell me a trip: “plan a Kashmir trip for 4 people, 5 nights from 10 November”.`
}
