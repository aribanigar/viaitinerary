// Single source of truth for the public marketing pages. The same arrays feed
// both the visible copy and the JSON-LD (FAQPage, SoftwareApplication) so the
// structured data can never drift from what a visitor actually reads.
import {
  Inbox,
  Route,
  Package,
  BedDouble,
  Wallet,
  BarChart3,
} from "lucide-react";

export const SITE_URL = "https://viaitinerary.in";
export const BRAND = "ViaItinerary";
export const CONTACT_EMAIL = "contact@viaitinerary.com";
export const CONTACT_PHONE = "+91 9186051499";
export const WHATSAPP_URL = "https://wa.me/919186051499";
export const SOCIAL_LINKS = [
  "https://www.instagram.com/viaitinerary_official/",
  "https://www.youtube.com/@ViaItinerary_official",
];

// Ching, the voice trip builder. Copy mirrors what the app really does
// (components/ching, utils/ching): browser speech recognition in English (India),
// live form filling, voice edits with undo, and export / email / WhatsApp commands.
export const VOICE = {
  name: "Ching",
  wake: "Hello Ching",
  example:
    "Create a 5 day trip for Rahul Sharma, 2 adults and 1 child, from 10 November, 2 nights in Srinagar, 2 nights in Pahalgam, with Innova, breakfast and dinner.",
  capabilities: [
    {
      title: "Speak the trip, watch it fill",
      text: "Client, guests, dates, hotels from your own catalog, day-wise plan, cab and meals are filled in while you are still talking.",
    },
    {
      title: "Edit by voice",
      text: "Say \u201cmake Gulmarg 2 nights\u201d, \u201cadd Shikara ride on day 2\u201d or \u201cgive me 20% margin\u201d. Days shift, the total recalculates and Undo is one tap away.",
    },
    {
      title: "Deliver without touching the keyboard",
      text: "Say \u201cexport\u201d, \u201cemail it to me\u201d or \u201csend it to the client on WhatsApp\u201d when you finish.",
    },
    {
      title: "Hands-free when you want it",
      text: "Turn on \u201cHello Ching\u201d and start a trip from any page of the app. Prefer to type? The same request works typed.",
    },
  ],
};

// The six modules shown in the home page tab switcher. `preview` picks which
// product mock renders on the right.
export const MODULES = [
  {
    key: "leads",
    icon: Inbox,
    title: "Lead Management",
    summary:
      "Every enquiry from your website, WhatsApp, ads and referrals lands in one inbox, assigned to the right agent with a follow-up date.",
    points: [
      "Embeddable enquiry form for your own website",
      "Assign leads to team members and track status",
      "Bulk import existing leads from Excel",
    ],
  },
  {
    key: "itinerary",
    icon: Route,
    title: "Itinerary Builder",
    summary:
      "Build a day-by-day itinerary with hotels, cabs and sightseeing pulled from your own rate sheets, priced as you go.",
    points: [
      "Day-wise plan with destinations and activities",
      "Live hotel and transport costing with your markup",
      "Speak the trip aloud and it fills in live",
    ],
  },
  {
    key: "packages",
    icon: Package,
    title: "Packages & Quotes",
    summary:
      "Save your best-selling trips as packages and turn any of them into a branded quote for a new client in a few clicks.",
    points: [
      "Reusable package templates",
      "Branded PDF in Classic or Modern layout",
      "Share by link, email or WhatsApp",
    ],
  },
  {
    key: "inventory",
    icon: BedDouble,
    title: "Hotels & Transport",
    summary:
      "Keep your contracted hotels, room categories, vehicles and services in one catalog so every quote uses current rates.",
    points: [
      "Hotel catalog with room and meal plan rates",
      "Booking calendar for room availability",
      "Vehicle and complementary service masters",
    ],
  },
  {
    key: "payments",
    icon: Wallet,
    title: "Payments & Vouchers",
    summary:
      "Track what each client has paid, issue vouchers and invoices, and keep a running ledger for every booking.",
    points: [
      "Payment collection and balance tracking",
      "Vouchers, invoices and confirmation emails",
      "Per-booking ledger and bank details on documents",
    ],
  },
  {
    key: "reports",
    icon: BarChart3,
    title: "Reports & Team",
    summary:
      "See how many leads each agent converted, what is pending, and how revenue is moving, with role-based access for your team.",
    points: [
      "Team performance and conversion reports",
      "Accounting summary across bookings",
      "Admin and team roles with scoped access",
    ],
  },
];

// Full capability list, grouped the way an agency thinks about its workflow.
export const FEATURE_GROUPS = [
  {
    title: "CRM & Sales",
    items: [
      "Central lead inbox",
      "Website enquiry form embed",
      "Lead assignment to agents",
      "Follow-ups and status tracking",
      "Excel bulk import and export",
      "Notifications for new leads",
    ],
  },
  {
    title: "Itinerary & Quoting",
    items: [
      "Day-by-day itinerary builder",
      "Voice trip builder (\u201cHello Ching\u201d)",
      "Voice edits with undo",
      "AI itinerary draft",
      "Pricing with markup control",
      "Reusable package templates",
      "Inclusions, exclusions and policies",
      "Branded PDF itineraries",
    ],
  },
  {
    title: "Inventory",
    items: [
      "Hotel and room rate catalog",
      "Hotel booking calendar",
      "Vehicles and transport rates",
      "Destinations and sightseeing",
      "Complementary services",
    ],
  },
  {
    title: "Payments & Accounts",
    items: [
      "Payment tracking per booking",
      "Vouchers and invoices",
      "Booking ledger",
      "Accounting summary",
      "Confirmation email templates",
    ],
  },
  {
    title: "Brand & Admin",
    items: [
      "Your logo, colours and fonts on documents",
      "Send from your own Gmail",
      "Team members and roles",
      "Team performance reports",
      "Installable on phone (PWA)",
    ],
  },
];

export const STEPS = [
  {
    title: "Capture",
    text: "Enquiries from every channel land in one inbox and are assigned to an agent.",
  },
  {
    title: "Quote",
    text: "The agent builds or picks a package, prices it from your rates and sends a branded PDF.",
  },
  {
    title: "Confirm",
    text: "Once the client agrees, the trip is locked and vouchers go out to the client.",
  },
  {
    title: "Collect",
    text: "Payments, balances and the booking ledger stay updated in one place.",
  },
];

export const AUDIENCES = [
  {
    title: "Destination Management Companies",
    text: "Quote B2B and B2C clients fast from your own contracted hotel and transport rates.",
  },
  {
    title: "Tour Operators",
    text: "Turn your best-selling routes into packages and reuse them across hundreds of enquiries.",
  },
  {
    title: "Travel Agencies",
    text: "Stop losing leads across WhatsApp and spreadsheets. One inbox, one follow-up list.",
  },
  {
    title: "Multi-agent Sales Teams",
    text: "Assign leads, set roles and see each agent's pipeline and conversions.",
  },
];

export const TRUST_PILLARS = [
  {
    title: "Built by a working tour operator",
    text: "ViaItinerary started inside a Kashmir travel company to fix its own quoting and follow-up problems. Every module is used on live bookings.",
  },
  {
    title: "Your data stays yours",
    text: "Each agency's leads, rates and clients are isolated to its own account. Export to Excel whenever you want.",
  },
  {
    title: "Real support on WhatsApp",
    text: "Talk directly to the team that builds the product, not a ticket queue.",
  },
];

export const FAQS = [
  {
    q: "What is ViaItinerary?",
    a: "ViaItinerary is a travel CRM and itinerary builder for travel agencies, tour operators and DMCs. It brings lead management, day-by-day itinerary building, package quotes, hotel and transport rates, vouchers and payment tracking into one web app.",
  },
  {
    q: "Who is ViaItinerary built for?",
    a: "It is built for travel agencies, tour operators, destination management companies (DMCs) and multi-agent sales teams who quote custom trips and packages and want to stop managing leads in WhatsApp and spreadsheets.",
  },
  {
    q: "Can I build an itinerary by voice?",
    a: "Yes. Inside the app, tap the mic or say \u201cHello Ching\u201d and describe the trip, for example the client name, guests, dates, hotels, cab and meals. The Trip Builder fills in while you speak, and you can then change it by voice, undo, export the PDF, email it to yourself or send it to the client on WhatsApp. Voice uses your browser\u2019s speech recognition in English (India), so it works in browsers that support it, such as Chrome and Edge. Where it is not available you can type the same request.",
  },
  {
    q: "How fast can I build an itinerary?",
    a: "Once your hotels, vehicles and destinations are in the catalog, an agent can build a priced day-by-day itinerary in a few minutes, or start from a saved package, an AI draft or a spoken request, and edit it.",
  },
  {
    q: "Can I send quotes with my own branding?",
    a: "Yes. Itineraries, vouchers and invoices are generated as PDFs with your agency logo, colours, fonts, bank details and policies, and emails can be sent from your own Gmail account.",
  },
  {
    q: "Can I capture leads from my website?",
    a: "Yes. ViaItinerary gives you an enquiry form you can embed on your own website. Submissions go straight into your lead inbox, where you can assign them to an agent.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. ViaItinerary runs in any modern browser and can be installed on Android and iPhone home screens as an app, so agents can check leads and share quotes on the go.",
  },
  {
    q: "Is there a free trial or demo?",
    a: "Yes. You can sign up for a free trial, or book a live demo and we will walk you through the product using your own destinations and rates.",
  },
];
