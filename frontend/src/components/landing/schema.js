import {
  SITE_URL,
  BRAND,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  SOCIAL_LINKS,
} from "./siteContent";

// Shared E-E-A-T entities. Every public page references the same Organization
// @id so search engines connect the author, publisher and product into one
// entity graph instead of seeing a fresh anonymous publisher per page.
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;

export const organizationSchema = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: BRAND,
  url: SITE_URL,
  logo: `${SITE_URL}/pwa-512x512.png`,
  email: CONTACT_EMAIL,
  sameAs: SOCIAL_LINKS,
  contactPoint: {
    "@type": "ContactPoint",
    telephone: CONTACT_PHONE,
    email: CONTACT_EMAIL,
    contactType: "customer support",
    areaServed: "IN",
    availableLanguage: ["English", "Hindi"],
  },
};

export const websiteSchema = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: SITE_URL,
  name: BRAND,
  publisher: { "@id": ORG_ID },
  inLanguage: "en-IN",
};

export const softwareSchema = (features) => ({
  "@type": "SoftwareApplication",
  "@id": SOFTWARE_ID,
  name: BRAND,
  url: SITE_URL,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Travel CRM",
  operatingSystem: "Web, Android, iOS",
  description:
    "Travel CRM and itinerary builder for travel agencies, tour operators and DMCs: lead management, itinerary and package quotes, hotel and transport rates, vouchers and payment tracking.",
  featureList: features,
  publisher: { "@id": ORG_ID },
});

export const faqSchema = (faqs) => ({
  "@type": "FAQPage",
  mainEntity: faqs.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});

export const breadcrumbSchema = (trail) => ({
  "@type": "BreadcrumbList",
  itemListElement: trail.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    item: `${SITE_URL}${item.path}`,
  })),
});
