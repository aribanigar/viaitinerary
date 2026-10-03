import React from "react";
import { Helmet } from "react-helmet-async";
import { SITE_URL, BRAND } from "./siteContent";
import { organizationSchema, websiteSchema, ORG_ID, WEBSITE_ID } from "./schema";

// Per-page <head>: title, description, canonical, Open Graph and one JSON-LD
// @graph. `path` is the route ("/about-us"); `schema` is an array of extra
// graph nodes (the page's WebPage node is added here).
const Seo = ({ title, description, path = "/", schema = [], pageType = "WebPage" }) => {
  const url = `${SITE_URL}${path}`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema,
      websiteSchema,
      {
        "@type": pageType,
        "@id": `${url}#webpage`,
        url,
        name: title,
        description,
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        inLanguage: "en-IN",
      },
      ...schema,
    ],
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content="index, follow" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={BRAND} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={`${SITE_URL}/pwa-512x512.png`} />
      <meta name="twitter:card" content="summary" />
      <script type="application/ld+json">{JSON.stringify(graph)}</script>
    </Helmet>
  );
};

export default Seo;
