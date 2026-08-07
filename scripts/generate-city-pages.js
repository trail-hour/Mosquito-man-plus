// Regenerates all 16 areas/*.html city pages from data/cities.json, using
// the Query Fan-Out section structure (each H2 answers one distinct
// sub-question) from the programmatic-SEO expansion spec. Run with
// --dry-run to build one page (oshawa) into scripts/.dry-run-output.html
// without touching the real areas/ files.
//
// Uniqueness lives in cities.json, not here — this script is deliberately
// "dumb" about content. Sections built from real per-city research
// (water_bodies, mosquito_pressure_drivers, neighborhoods) differ city to
// city; sections that are legitimately identical everywhere (how barrier
// spray works, safety, the cost explainer) are shared on purpose.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CITIES_PATH = path.join(ROOT, "data", "cities.json");
const AREAS_DIR = path.join(ROOT, "areas");
const SITE_URL = "https://mosquitomanplus.com";
const DRY_RUN = process.argv.includes("--dry-run");

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isUnverified(arr) {
  return !Array.isArray(arr) || arr.length === 0 || (arr.length === 1 && arr[0] === "verify");
}

function jsonForHtmlComment(obj) {
  return JSON.stringify(obj).replace(/--/g, "––");
}

function joinWithAnd(items) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildIntro(city) {
  const drivers = city.mosquito_pressure_drivers[0];
  const waterList = joinWithAnd(city.water_bodies.slice(0, 3));
  return `<p>${escapeHtml(city.name)} homeowners know the feeling — you step outside on a summer evening and the mosquitoes drive you back inside within minutes. Between ${escapeHtml(
    waterList
  )}, ${escapeHtml(city.name)} has real local water features that give mosquitoes exactly what they need to breed: ${escapeHtml(
    drivers
  )}.</p>
<p>Mosquito Man Plus is a locally operated mosquito control company based right here in Durham Region. Unlike national chains, we tailor every treatment to the specific conditions of your yard — we're part of the Bugman Plus family, so you're getting a local team with real roots in this community, not a call centre hundreds of kilometres away. Our barrier spray treatments eliminate adult mosquitoes on contact and keep protecting your property for up to 21 days per application.</p>`;
}

function buildWhySection(city) {
  const items = city.mosquito_pressure_drivers
    .map((driver) => `<li>${escapeHtml(driver.charAt(0).toUpperCase() + driver.slice(1))}</li>`)
    .join("\n      ");
  return `<p>${escapeHtml(city.name)}'s geography creates real mosquito pressure every summer — not generic "warm weather," but specific local conditions:</p>
    <ul>
      ${items}
    </ul>
    <p>Professional barrier spray is the most effective way to break this cycle and reclaim your outdoor space.</p>`;
}

function buildHowSection() {
  return `<ol>
      <li><strong>Inspection:</strong> We walk your property and identify mosquito hotspots — standing water, dense vegetation, shaded damp areas, and entry points from neighbouring properties.</li>
      <li><strong>Barrier Spray Treatment:</strong> We apply a targeted barrier spray to trees, shrubs, fence lines, and ground cover. The treatment bonds to foliage and kills mosquitoes on contact, then continues working for up to 21 days.</li>
      <li><strong>Breeding Source Control:</strong> Where possible, we advise on eliminating standing water sources — bird baths, low spots, clogged gutters — to reduce future breeding.</li>
      <li><strong>Follow-Up Service:</strong> We return every 21 days throughout mosquito season to maintain your protection barrier.</li>
    </ol>
    <p>Most treatments take 20–40 minutes. You can return to your yard once the product has dried — typically within 30 minutes. See our full <a href="../services/residential.html">residential mosquito control program</a> for pricing factors and FAQs.</p>`;
}

function buildCostSection(city) {
  return `<p>Every ${escapeHtml(
    city.name
  )} property is different, so we don't quote a flat rate before seeing the yard. What actually drives the price is property size, how much shaded/vegetated area needs treating, whether you want a single visit or a seasonal program, and how far the property is from water or wooded land — properties near ${escapeHtml(
    city.water_bodies[0]
  )} or dense tree cover typically need closer attention to breeding sites. The fastest way to get a real number is a free quote — tell us about your property and we'll give you an honest price before you book anything.</p>`;
}

function buildSafetySection(city) {
  return `<p>Yes. We use EPA/PMRA (Health Canada Pest Management Regulatory Agency) registered products, applied by trained technicians, with timing that keeps kids, pets, and edible gardens in mind. Once the spray has dried — usually about 30 minutes after application — your ${escapeHtml(
    city.name
  )} yard is safe to use normally again. We don't invent safety claims beyond what the product labels actually support; ask your technician about specific timing if you have a vegetable garden, a pool, or pets with particular sensitivities.</p>`;
}

function buildTimingSection(city) {
  return `<p>Mosquito activity in ${escapeHtml(
    city.name
  )} generally follows the same pattern as the rest of Durham Region and the GTA — starting as temperatures stay consistently warm in late spring and continuing through early fall, typically late May through September, with peaks after rainfall. The most effective approach is starting a seasonal program before activity ramps up rather than reacting once your yard already has a problem — by the time you notice mosquitoes every evening, several generations have usually already hatched.</p>`;
}

function buildNeighborhoodsSection(city) {
  if (isUnverified(city.neighborhoods)) {
    return `<p>We serve all of ${escapeHtml(
      city.name
    )} and the surrounding area — properties of every size, from starter lots to larger yards backing onto green space. If you're unsure whether we cover your specific street, ask when you request a quote.</p>`;
  }
  const items = city.neighborhoods.map((n) => `<li>${escapeHtml(n)}</li>`).join("\n      ");
  return `<p>We cover all of ${escapeHtml(city.name)}, including:</p>
    <ul>
      ${items}
    </ul>`;
}

function buildUseCasesSection(city) {
  return `<p>Not sure which service fits? Most ${escapeHtml(
    city.name
  )} properties fall into one of three categories:</p>
    <ul>
      <li><strong><a href="../services/residential.html">Residential mosquito control in ${escapeHtml(
        city.name
      )}</a>:</strong> recurring seasonal barrier treatments for backyards, built around families and pets.</li>
      <li><strong><a href="../services/events.html">Mosquito spraying for backyard events in ${escapeHtml(
        city.name
      )}</a>:</strong> a single treatment timed 24&ndash;48 hours before a wedding, party, or outdoor gathering.</li>
      <li><strong><a href="../services/commercial.html">Commercial mosquito control for ${escapeHtml(
        city.name
      )} patios and properties</a>:</strong> scheduled service for restaurants, breweries, campgrounds, and managed properties.</li>
    </ul>`;
}

function buildFaqItems(city) {
  const cityNeighborhoodAnswer = isUnverified(city.neighborhoods)
    ? `Yes — we cover all of ${city.name} and the surrounding area. We also serve surrounding Durham Region communities.`
    : `Yes — we cover all of ${city.name} including ${city.neighborhoods.slice(0, 6).join(", ")}. We also serve surrounding Durham Region communities.`;

  const landmarkAnswer = city.local_landmarks.length
    ? `${city.name} properties near ${city.local_landmarks[0]} or other green/wet areas often see more mosquito pressure than properties further from water — those spots are worth extra attention during your inspection.`
    : `Properties near creeks, ponds, or wooded lots tend to see more mosquito pressure than properties further from water.`;

  return [
    {
      q: `How long does a mosquito treatment last in ${city.name}?`,
      a: `Each barrier spray treatment lasts up to 21 days. We recommend treatments every three weeks throughout mosquito season (May to September) for continuous protection.`,
    },
    {
      q: `Is the treatment safe for kids and pets?`,
      a: `Yes. Once the spray has dried, usually 30 minutes after application, your yard is safe for children and pets. We use professional-grade products approved for residential use in Ontario.`,
    },
    {
      q: `Do you serve all of ${city.name}?`,
      a: cityNeighborhoodAnswer,
    },
    {
      q: `Does it matter if my ${city.name} property is near water or a conservation area?`,
      a: landmarkAnswer,
    },
    {
      q: `How soon can you come out?`,
      a: `We typically schedule within 2-3 business days. Contact us today and we'll get you booked in quickly.`,
    },
    {
      q: `Do you offer a guarantee?`,
      a: `Yes. If mosquitoes return within 21 days of your treatment, we'll come back and re-treat at no charge.`,
    },
  ];
}

function buildFaqHtml(faqItems) {
  return faqItems
    .map(
      (item) => `    <div class="faq-item">
      <h3>${escapeHtml(item.q)}</h3>
      <p>${escapeHtml(item.a)}</p>
    </div>`
    )
    .join("\n\n");
}

function buildFaqSchema(faqItems) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  });
}

function buildLocalBusinessSchema(city, slug) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "PestControl"],
    name: "Mosquito Man Plus",
    url: `${SITE_URL}/areas/${slug}.html`,
    telephone: "+19059242847",
    email: "info@mosquitomanplus.com",
    address: { "@type": "PostalAddress", addressLocality: "Oshawa", addressRegion: "ON", addressCountry: "CA" },
    areaServed: { "@type": "City", name: `${city.name}, ON` },
    parentOrganization: { "@type": "Organization", name: "Bugman Plus", url: "https://www.bugmanplus.com" },
    priceRange: "$$",
  });
}

function buildServiceSchema(city, slug) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Mosquito Control / Barrier Spray",
    provider: { "@type": "LocalBusiness", name: "Mosquito Man Plus" },
    areaServed: { "@type": "City", name: `${city.name}, ON` },
    url: `${SITE_URL}/areas/${slug}.html`,
  });
}

function buildNearbyAreasHtml(city, allCities) {
  const links = city.nearest_serviced_cities
    .map((name) => {
      const slug = Object.keys(allCities).find((key) => allCities[key].name === name);
      if (!slug) return null;
      return `<li><a href="../areas/${slug}.html">${escapeHtml(name)}</a></li>`;
    })
    .filter(Boolean);
  return links.join("\n      ");
}

function renderCityPage(slug, city, allCities) {
  const faqItems = buildFaqItems(city);
  const title = `Mosquito Control ${city.name} | Barrier Spray Service | Mosquito Man Plus`;
  const description = `Professional mosquito barrier spray in ${city.name}, ON. Mosquito Man Plus serves ${city.name} — treatments last up to 21 days. Local Durham Region team. Get a free quote today.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="google-site-verification" content="x6moIRS0K702c1lMZAvBaWKbRHSX69QVn9Ebyd6mvh8" />
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${SITE_URL}/areas/${slug}.html">
<link rel="icon" type="image/png" href="../favicon.png">
<meta name="theme-color" content="#16232c">
<link rel="stylesheet" href="../assets/css/styles.css">
<!-- CITY_DATA ${jsonForHtmlComment({ slug, name: city.name, region: city.region })} -->
<script type="application/ld+json">${buildLocalBusinessSchema(city, slug)}</script>
<script type="application/ld+json">${buildServiceSchema(city, slug)}</script>
<script type="application/ld+json">${buildFaqSchema(faqItems)}</script>
</head>
<body id="top">
<div class="site-shell">

<header class="site-header" data-site-header>
  <a class="brand" href="../index.html" aria-label="Mosquito Man Plus home">
    <span class="brand-logo">
      <img src="../assets/img/logo.png" alt="Mosquito Man Plus" width="1101" height="471">
    </span>
  </a>
  <nav class="primary-nav" aria-label="Primary navigation" data-primary-nav>
    <a href="../index.html">Home</a>
    <a href="../about.html">About</a>
    <a href="../services.html">Services</a>
    <a class="is-active" href="../areas.html" aria-current="page">Areas</a>
    <a href="../blog/index.html">Blog</a>
    <a href="../contact.html">Contact</a>
  </nav>
  <div class="header-actions">
    <a class="call-link" href="tel:+19059242847">905-924-2847</a>
    <a class="button button-small" href="../contact.html">Get a Quote</a>
    <button class="menu-button" type="button" aria-label="Open navigation" aria-expanded="false" data-menu-button>
      <span></span><span></span>
    </button>
  </div>
</header>

<main>

  <section class="city-hero">
    <h1>Mosquito Control in ${escapeHtml(city.name)}, ${escapeHtml(city.region)}</h1>
    <p class="city-tagline">Durham Region's local mosquito barrier spray specialists — keeping ${escapeHtml(
      city.name
    )} backyards bite-free all season long.</p>
    <a href="../contact.html" class="btn-primary">Get a Free Quote</a>
  </section>

  <section class="city-intro">
    <h2>Mosquito Man Plus Serves ${escapeHtml(city.name)}</h2>
    ${buildIntro(city)}
  </section>

  <section class="city-problem">
    <h2>Why ${escapeHtml(city.name)} Yards Get Mosquitoes</h2>
    ${buildWhySection(city)}
  </section>

  <section class="city-how">
    <h2>How Barrier Spray Works</h2>
    ${buildHowSection()}
  </section>

  <section class="city-cost">
    <h2>How Much Does Mosquito Control Cost in ${escapeHtml(city.name)}?</h2>
    ${buildCostSection(city)}
  </section>

  <section class="city-safety">
    <h2>Is Mosquito Treatment Safe for Pets and Kids?</h2>
    ${buildSafetySection(city)}
  </section>

  <section class="city-timing">
    <h2>When to Start Mosquito Treatment in ${escapeHtml(city.name)}</h2>
    ${buildTimingSection(city)}
  </section>

  <section class="city-neighborhoods">
    <h2>Neighbourhoods We Serve in ${escapeHtml(city.name)}</h2>
    ${buildNeighborhoodsSection(city)}
  </section>

  <section class="city-services">
    <h2>Which Service Fits Your ${escapeHtml(city.name)} Property?</h2>
    ${buildUseCasesSection(city)}
  </section>

  <section class="city-faq">
    <h2>Frequently Asked Questions — Mosquito Control in ${escapeHtml(city.name)}</h2>

${buildFaqHtml(faqItems)}

  </section>

  <section class="nearby-areas">
    <h2>Nearby Areas We Also Serve</h2>
    <ul class="nearby-list">
      ${buildNearbyAreasHtml(city, allCities)}
    </ul>
  </section>

  <section class="city-cta">
    <h2>Ready to Take Back Your ${escapeHtml(city.name)} Backyard?</h2>
    <p>Get a free quote from your local Durham Region mosquito control team, backed by a 21-day re-treat guarantee. We'll assess your property and recommend the right treatment plan for your yard.</p>
    <a href="../contact.html" class="btn-primary">Get a Free Quote</a>
  </section>

</main>

<footer class="site-footer">
  <div class="footer-grid">
    <div class="footer-location">
      <p class="section-kicker">Location</p>
      <p>Oshawa, Ontario</p>
      <p>Serving Oshawa, Whitby, Ajax, Pickering, Clarington, Bowmanville, Courtice, Newcastle, Brooklin, Port Perry, Scugog, Uxbridge, Brock, Durham Region, Scarborough, North York, Mississauga, Vaughan, Greater Toronto Area</p>
    </div>
    <div>
      <p class="section-kicker">Inquiry</p>
      <p><a href="mailto:info@mosquitomanplus.com">info@mosquitomanplus.com</a></p>
      <p><a href="tel:+19059242847">905-924-2847</a></p>
    </div>
    <div>
      <p class="section-kicker">Links</p>
      <ul class="footer-links">
        <li><a href="../index.html">Home</a></li>
        <li><a href="../about.html">About</a></li>
        <li><a href="../services.html">Services</a></li>
        <li><a href="../services/residential.html">Residential</a></li>
        <li><a href="../services/events.html">Events</a></li>
        <li><a href="../services/commercial.html">Commercial</a></li>
        <li><a href="../areas.html">Areas</a></li>
        <li><a href="../blog/index.html">Blog</a></li>
        <li><a href="../contact.html">Contact</a></li>
      </ul>
    </div>
    <div class="footer-brand">
      <span class="brand-text">Mosquito Man <em>Plus</em></span>
      <p>Dedicated mosquito control for homes, events, and patios across Durham Region and the GTA. A sister brand of <a href="https://www.bugmanplus.com">Bugman Plus</a>.</p>
    </div>
  </div>
  <div class="footer-bottom">
    <span>&copy; 2026 Mosquito Man Plus. All rights reserved.</span>
    <a href="#top" class="back-to-top" aria-label="Back to top">Up</a>
    <span>Oshawa, ON, Canada</span>
  </div>
</footer>

</div>

<div class="discount-modal" data-discount-modal hidden>
  <div class="discount-backdrop" data-discount-close></div>
  <section class="discount-dialog" role="dialog" aria-modal="true" aria-labelledby="discount-title">
    <button class="discount-close" type="button" aria-label="Close discount offer" data-discount-close>&times;</button>
    <p class="section-kicker">New Customer Offer</p>
    <h2 id="discount-title">Save 5% on your first mosquito treatment.</h2>
    <p>Register with your email and phone number, then mention this offer when Mosquito Man Plus confirms your appointment.</p>
    <form class="discount-form" action="https://formspree.io/f/mgojgpyq" method="POST" data-discount-form data-success-message="Thanks. Mosquito Man Plus received your discount registration.">
      <input type="hidden" name="formType" value="discount">
      <input type="hidden" name="context" value="5% discount registration">
      <label class="form-hp" aria-hidden="true">Website<input name="website" type="text" autocomplete="off" tabindex="-1"></label>
      <label>Email<input name="email" type="email" placeholder="you@example.com" autocomplete="email" required></label>
      <label>Phone (optional)<input name="phone" type="tel" placeholder="905-000-0000" autocomplete="tel"></label>
      <button class="button button-wide" type="submit">Claim 5% Discount</button>
      <p class="discount-note" data-form-note role="status" aria-live="polite"></p>
    </form>
    <p class="discount-success" data-discount-success role="status" aria-live="polite" hidden></p>
    <a class="discount-call" href="tel:+19059242847">Prefer to call? 905-924-2847</a>
  </section>
</div>

<a class="mobile-call-float" href="tel:+19059242847" aria-label="Call Mosquito Man Plus now at 905-924-2847">
  <span>Call Now</span>
  <strong>905-924-2847</strong>
</a>

<script src="../assets/js/main.js" defer></script>
</body>
</html>
`;
}

function main() {
  const cities = JSON.parse(fs.readFileSync(CITIES_PATH, "utf8"));

  if (DRY_RUN) {
    const slug = "oshawa";
    const html = renderCityPage(slug, cities[slug], cities);
    const outPath = path.join(__dirname, ".dry-run-output.html");
    fs.writeFileSync(outPath, html);
    console.log(`[dry run] Wrote ${outPath} (not touching areas/)`);
    return;
  }

  for (const [slug, city] of Object.entries(cities)) {
    const html = renderCityPage(slug, city, cities);
    const outPath = path.join(AREAS_DIR, `${slug}.html`);
    fs.writeFileSync(outPath, html);
    console.log(`Wrote areas/${slug}.html`);
  }
}

main();
