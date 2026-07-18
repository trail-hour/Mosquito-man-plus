/**
 * Backlink Outreach Automation — Mosquito Man Plus
 * ================================================
 * HOW IT WORKS:
 *   1. Reads target sites from targets.json
 *   2. Looks up contact email via Hunter.io API
 *   3. Drafts a personalized email per site type
 *   4. Sends via Brevo (your existing SMTP setup)
 *   5. Logs everything to outreach-log.csv
 *
 * USAGE:
 *   node backlink-outreach.js              → dry run (no emails sent)
 *   node backlink-outreach.js --send       → actually sends emails
 *   node backlink-outreach.js --send --limit=5  → send max 5 today
 *
 * INSTALL DEPENDENCIES FIRST:
 *   npm install axios csv-writer dotenv
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { createObjectCsvWriter } = require("csv-writer");
require("dotenv").config();

// ─── CONFIG ────────────────────────────────────────────────────────────────

const CONFIG = {
  // Your details
  senderName: "Krunal Agrawal",
  senderEmail: "info@mosquitomanplus.com",
  siteUrl: "https://mosquitomanplus.com",
  siteName: "Mosquito Man Plus",
  serviceArea: "Durham Region and GTA",
  parentSiteUrl: "https://www.bugmanplus.com",
  parentSiteName: "Bug Man Plus",

  // Safety limits
  maxPerDay: 10,         // never send more than this in one run
  delayBetweenMs: 4000, // 4 seconds between sends (looks human)

  // API Keys — store in .env file (never hardcode)
  hunterApiKey: process.env.HUNTER_API_KEY,
  brevoApiKey: process.env.BREVO_API_KEY,

  // Files
  targetsFile: "./targets.json",
  localTargetsFile: "./targets-local.json",
  logFile: "./outreach-log.csv",

  // Domain reachability check (dry-run report only)
  reachabilityTimeoutMs: 6000,
};

// Preferred inbox local-parts per site type, in priority order, used to pick
// the best match out of Hunter.io's returned email list (or as the guessed
// local-part when Hunter only returns a pattern, not real addresses).
const PREFERRED_LOCAL_PARTS = {
  chamber: ["info", "admin", "membership", "ecdev"],
  municipal: ["info", "admin", "membership", "ecdev"],
  association: ["info", "admin", "membership", "ecdev"],
  media: ["newsroom", "news", "editor", "tips"],
};

// ─── PARSE ARGS ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--send");
const limitArg = args.find((a) => a.startsWith("--limit="));
const DAILY_LIMIT = limitArg
  ? parseInt(limitArg.split("=")[1])
  : CONFIG.maxPerDay;

if (DRY_RUN) {
  console.log("\n⚠️  DRY RUN MODE — no emails will be sent.");
  console.log("   Add --send flag to actually send.\n");
}

// ─── EMAIL TEMPLATES ───────────────────────────────────────────────────────
// Different templates per site type for natural variation

function getEmailTemplate(site) {
  const { domain, type, contactName, name, city } = site;
  const greeting = contactName ? `Hi ${contactName}` : "Hi there";
  const cityLabel = city || CONFIG.serviceArea;
  const orgName = name || domain;

  const templates = {

    chamber: {
      subject: `Membership inquiry – local pest control business`,
      body: `${greeting},

My name is Krunal Agrawal and I own Bug Man Plus / Mosquito Man Plus, a locally operated pest control business serving ${cityLabel} and the wider Durham Region / GTA area.

I'm looking into joining ${orgName} and had a few questions:
• What membership tiers do you offer, and what's included at each level?
• Do members get a listing in your business directory with a link to their website?
• Are there any upcoming networking events or mixers I should know about?

Happy to send over more information about our business if that's helpful. Looking forward to hearing from you.

Thanks,
Krunal Agrawal
Bug Man Plus / Mosquito Man Plus
${CONFIG.parentSiteUrl}
${CONFIG.siteUrl}`,
    },

    municipal: {
      subject: `Adding a local business to your directory`,
      body: `${greeting},

My name is Krunal Agrawal and I own Bug Man Plus / Mosquito Man Plus, a locally operated pest control business serving ${cityLabel}.

I'd like to find out how to get our business added to your municipal / economic development business directory, and what information you'd need from us to do that (business number, address, service categories, etc.).

Let me know what the process looks like and I'll get everything over to you.

Thanks,
Krunal Agrawal
Bug Man Plus / Mosquito Man Plus
${CONFIG.parentSiteUrl}
${CONFIG.siteUrl}`,
    },

    association: {
      subject: `Membership inquiry – ${orgName}`,
      body: `${greeting},

My name is Krunal Agrawal. I'm a licensed pest control operator based in Durham Region, running Bug Man Plus / Mosquito Man Plus.

I'm interested in joining ${orgName} and wanted to ask about:
• Membership requirements and how to apply
• Annual fees or dues
• Whether members are listed in a public member directory

Happy to provide licensing details or anything else needed to get started.

Thanks,
Krunal Agrawal
Bug Man Plus / Mosquito Man Plus
${CONFIG.parentSiteUrl}
${CONFIG.siteUrl}`,
    },

    media: {
      subject: `Local expert source – mosquito/tick season in Durham`,
      body: `${greeting},

My name is Krunal Agrawal, owner of Bug Man Plus / Mosquito Man Plus, a pest control business serving Durham Region and the GTA.

I wanted to reach out ahead of mosquito and tick season in case it's ever useful to have a local, on-the-ground source for seasonal pest stories — mosquito season timing, tick activity, West Nile virus precautions, that kind of thing. I can offer practical, Durham-specific tips and am happy to be quoted whenever it's relevant.

This isn't a pitch to publish anything specific — just flagging that I'm available if you're ever working on a seasonal pest piece and want a local quote.

Thanks,
Krunal Agrawal
Bug Man Plus / Mosquito Man Plus
${CONFIG.parentSiteUrl}
${CONFIG.siteUrl}`,
    },

    directory: {
      subject: `Add Mosquito Man Plus to Your Directory`,
      body: `${greeting},

I came across ${domain} and wanted to reach out about getting Mosquito Man Plus listed in your directory.

We're a local mosquito and pest control company serving ${CONFIG.serviceArea}, specializing in barrier spray treatments that keep mosquitoes away for up to 21 days.

Our details:
• Business: Mosquito Man Plus
• Website: ${CONFIG.siteUrl}
• Services: Mosquito barrier spray, tick control, general pest control
• Areas: Durham Region (Ajax, Pickering, Whitby, Oshawa) and GTA

Would you be able to add us to your directory? Happy to provide any additional info you need.

Thanks for your time,
Krunal Agrawal
Mosquito Man Plus
${CONFIG.siteUrl}
info@mosquitomanplus.com`,
    },

    local: {
      subject: `Local Pest Control Business — Mosquito Man Plus`,
      body: `${greeting},

I noticed ${domain} features local Ontario businesses and wanted to introduce Mosquito Man Plus.

We're a Durham Region–based mosquito control company helping homeowners enjoy their backyards again. Our barrier spray treatments are safe for families and pets, and last up to 21 days per application.

We serve Ajax, Pickering, Whitby, Oshawa, and across the GTA — and we'd love to be included as a local resource on your site if that's something you do.

Website: ${CONFIG.siteUrl}

Thanks for considering us,
Krunal Agrawal
Mosquito Man Plus`,
    },

    blog: {
      subject: `Guest Post Idea — Mosquito Control Tips for Ontario Homeowners`,
      body: `${greeting},

I've been reading ${domain} and think your audience would find a practical piece on mosquito control really useful — especially heading into summer.

I'm Krunal from Mosquito Man Plus (${CONFIG.siteUrl}), a mosquito control company serving Durham Region and the GTA. I'd love to contribute a guest post along the lines of:

• "5 Reasons Mosquitoes Are Worse in Durham Region (And What To Do)"
• "Natural vs Chemical Mosquito Control: What Actually Works in Ontario"
• "How to Mosquito-Proof Your Backyard Before Your Next BBQ"

I'd write 600–800 words, include original tips, and just ask for a link back to our site in the author bio. No promotional fluff — just genuinely useful content.

Would this be a fit for your blog?

Thanks,
Krunal Agrawal
Mosquito Man Plus
${CONFIG.siteUrl}`,
    },

    resource: {
      subject: `Mosquito Man Plus — Canadian Pest Control Resource`,
      body: `${greeting},

I came across your site while researching pest control resources online and wanted to reach out.

Mosquito Man Plus (${CONFIG.siteUrl}) is a local mosquito and pest control company serving Durham Region and the GTA. We focus specifically on mosquito barrier spray treatments — a highly effective, family-safe solution most homeowners don't know about.

If you maintain a resource list or link to local service providers, we'd be grateful to be included. We're happy to return the favour where it makes sense.

Best,
Krunal Agrawal
Mosquito Man Plus
${CONFIG.siteUrl}`,
    },

  };

  return templates[type] || templates.directory;
}

// ─── HUNTER.IO EMAIL LOOKUP ────────────────────────────────────────────────

async function findEmail(domain, type) {
  if (!CONFIG.hunterApiKey) {
    console.log(`  ⚠️  No Hunter API key — skipping email lookup for ${domain}`);
    return null;
  }

  const preferred = PREFERRED_LOCAL_PARTS[type] || null;

  try {
    // Pull more than 1 result so we have a real list to prefer-match against.
    const res = await axios.get("https://api.hunter.io/v2/domain-search", {
      params: {
        domain,
        api_key: CONFIG.hunterApiKey,
        limit: preferred ? 10 : 1,
      },
    });

    const emails = res.data?.data?.emails;
    if (emails && emails.length > 0) {
      let found = emails[0];
      if (preferred) {
        for (const localPart of preferred) {
          const match = emails.find((e) => e.value.toLowerCase().startsWith(`${localPart}@`));
          if (match) {
            found = match;
            break;
          }
        }
      }
      console.log(`  ✅ Found email: ${found.value} (confidence: ${found.confidence}%)`);
      return {
        email: found.value,
        name: found.first_name || null,
        confidence: found.confidence,
      };
    }

    // Try generic patterns if no specific email found
    const genericEmails = res.data?.data?.pattern;
    if (genericEmails) {
      const guessLocalPart = preferred ? preferred[0] : "info";
      const guessed = `${guessLocalPart}@${domain}`;
      console.log(`  📧 Guessing: ${guessed}`);
      return { email: guessed, name: null, confidence: 50 };
    }

    console.log(`  ❌ No email found for ${domain}`);
    return null;
  } catch (err) {
    console.log(`  ❌ Hunter lookup failed for ${domain}: ${err.message}`);
    return null;
  }
}

// ─── DOMAIN REACHABILITY CHECK (dry-run report only) ──────────────────────

async function checkDomainReachable(domain) {
  for (const scheme of ["https", "http"]) {
    try {
      await axios.get(`${scheme}://${domain}`, {
        timeout: CONFIG.reachabilityTimeoutMs,
        maxRedirects: 5,
        validateStatus: () => true, // any HTTP response means the domain is live
        headers: { "User-Agent": "Mozilla/5.0 (compatible; OutreachCheck/1.0)" },
      });
      return true;
    } catch (err) {
      continue; // try the other scheme before giving up
    }
  }
  return false;
}

// ─── BREVO EMAIL SENDER ────────────────────────────────────────────────────

async function sendEmail(to, toName, subject, body) {
  if (DRY_RUN) {
    console.log(`  📨 [DRY RUN] Would send to: ${to}`);
    console.log(`     Subject: ${subject}`);
    return { success: true, dryRun: true };
  }

  if (!CONFIG.brevoApiKey) {
    console.log("  ❌ No Brevo API key found in .env");
    return { success: false, error: "Missing BREVO_API_KEY" };
  }

  try {
    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: CONFIG.senderName,
          email: CONFIG.senderEmail,
        },
        to: [{ email: to, name: toName || "" }],
        subject,
        textContent: body,
      },
      {
        headers: {
          "api-key": CONFIG.brevoApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`  ✅ Sent! Message ID: ${res.data.messageId}`);
    return { success: true, messageId: res.data.messageId };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.log(`  ❌ Send failed: ${msg}`);
    return { success: false, error: msg };
  }
}

// ─── CSV LOGGER ────────────────────────────────────────────────────────────

function getLogger() {
  const fileExists = fs.existsSync(CONFIG.logFile);
  return createObjectCsvWriter({
    path: CONFIG.logFile,
    header: [
      { id: "date", title: "DATE" },
      { id: "domain", title: "DOMAIN" },
      { id: "type", title: "TYPE" },
      { id: "email", title: "EMAIL" },
      { id: "subject", title: "SUBJECT" },
      { id: "status", title: "STATUS" },
      { id: "notes", title: "NOTES" },
    ],
    append: fileExists,
  });
}

// ─── ALREADY CONTACTED CHECK ───────────────────────────────────────────────

function getAlreadyContacted() {
  if (!fs.existsSync(CONFIG.logFile)) return new Set();
  const content = fs.readFileSync(CONFIG.logFile, "utf8");
  const domains = new Set();
  content.split("\n").forEach((line) => {
    const parts = line.split(",");
    const status = parts[5]?.trim().replace(/"/g, "");
    // Only a real, successful send counts as "already contacted" — DRY_RUN
    // and SKIPPED rows must not block a future real send for that domain.
    if (parts[1] && status === "SENT") {
      domains.add(parts[1].trim().replace(/"/g, ""));
    }
  });
  return domains;
}

// ─── SLEEP HELPER ──────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── TARGET LOADING (merges base + local targets, base file untouched) ────

function loadAllTargets() {
  const targets = [];

  if (fs.existsSync(CONFIG.targetsFile)) {
    const base = JSON.parse(fs.readFileSync(CONFIG.targetsFile, "utf8"));
    targets.push(...base);
  }

  if (fs.existsSync(CONFIG.localTargetsFile)) {
    const localRaw = JSON.parse(fs.readFileSync(CONFIG.localTargetsFile, "utf8"));
    const localList = Array.isArray(localRaw) ? localRaw : localRaw.targets || [];
    targets.push(...localList);
  }

  return targets;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("🦟 Mosquito Man Plus — Backlink Outreach System");
  console.log("================================================\n");

  // Load targets (base targets.json + targets-local.json, merged)
  if (!fs.existsSync(CONFIG.targetsFile) && !fs.existsSync(CONFIG.localTargetsFile)) {
    console.error(`❌ Neither targets.json nor targets-local.json found.`);
    process.exit(1);
  }

  const targets = loadAllTargets();
  const alreadyContacted = getAlreadyContacted();
  const logger = getLogger();

  console.log(`📋 Total targets: ${targets.length}`);
  console.log(`📬 Already contacted: ${alreadyContacted.size}`);
  console.log(`🎯 Daily limit: ${DAILY_LIMIT}\n`);

  let sentCount = 0;
  const logRows = [];
  const reportRows = []; // dry-run report table

  for (const site of targets) {
    if (sentCount >= DAILY_LIMIT) {
      console.log(`\n🛑 Hit daily limit of ${DAILY_LIMIT}. Run again tomorrow.`);
      break;
    }

    console.log(`\n🔍 Processing: ${site.domain} [${site.type}]`);

    // Reachability check (dry-run report only — skip for real send runs to save time)
    let reachable = null;
    if (DRY_RUN) {
      reachable = await checkDomainReachable(site.domain);
      console.log(`  🌐 Domain reachable: ${reachable ? "yes" : "NO — dead or unreachable"}`);
    }

    if (alreadyContacted.has(site.domain)) {
      console.log(`⏭️  Skipping ${site.domain} — already contacted`);
      reportRows.push({
        target: site.name || site.domain,
        domain: site.domain,
        type: site.type,
        reachable: reachable === null ? "n/a" : reachable ? "yes" : "NO",
        contactFound: "n/a (already contacted)",
        template: "n/a",
        subject: "n/a",
        flag: "already contacted — skipped",
      });
      continue;
    }

    // Find email
    let emailInfo = null;
    if (site.email) {
      // Manual email override in targets.json
      emailInfo = { email: site.email, name: site.contactName || null, confidence: 100 };
      console.log(`  📧 Using manual email: ${site.email}`);
    } else {
      emailInfo = await findEmail(site.domain, site.type);
      await sleep(1000); // rate limit Hunter API
    }

    if (!emailInfo) {
      logRows.push({
        date: new Date().toISOString().split("T")[0],
        domain: site.domain,
        type: site.type,
        email: "NOT FOUND",
        subject: "",
        status: "SKIPPED",
        notes: "No email found",
      });
      reportRows.push({
        target: site.name || site.domain,
        domain: site.domain,
        type: site.type,
        reachable: reachable === null ? "n/a" : reachable ? "yes" : "NO",
        contactFound: "NO",
        template: "n/a",
        subject: "n/a",
        flag: !reachable && reachable !== null ? "dead domain + no contact" : "no contact found",
      });
      continue;
    }

    // Skip low-confidence emails to protect sender reputation
    if (emailInfo.confidence && emailInfo.confidence < 40) {
      console.log(`  ⚠️  Confidence too low (${emailInfo.confidence}%) — skipping`);
      logRows.push({
        date: new Date().toISOString().split("T")[0],
        domain: site.domain,
        type: site.type,
        email: emailInfo.email,
        subject: "",
        status: "SKIPPED",
        notes: `Low confidence: ${emailInfo.confidence}%`,
      });
      reportRows.push({
        target: site.name || site.domain,
        domain: site.domain,
        type: site.type,
        reachable: reachable === null ? "n/a" : reachable ? "yes" : "NO",
        contactFound: `${emailInfo.email} (low confidence ${emailInfo.confidence}%)`,
        template: "n/a",
        subject: "n/a",
        flag: "low-confidence contact — skipped",
      });
      continue;
    }

    // Get email template
    const enrichedSite = { ...site, contactName: emailInfo.name };
    const template = getEmailTemplate(enrichedSite);

    // Send
    const result = await sendEmail(
      emailInfo.email,
      emailInfo.name,
      template.subject,
      template.body
    );

    logRows.push({
      date: new Date().toISOString().split("T")[0],
      domain: site.domain,
      type: site.type,
      email: emailInfo.email,
      subject: template.subject,
      status: result.success ? (DRY_RUN ? "DRY_RUN" : "SENT") : "FAILED",
      notes: result.error || result.messageId || "",
    });

    reportRows.push({
      target: site.name || site.domain,
      domain: site.domain,
      type: site.type,
      reachable: reachable === null ? "n/a" : reachable ? "yes" : "NO",
      contactFound: emailInfo.email,
      template: site.type,
      subject: template.subject,
      flag: reachable === false ? "dead domain — verify before sending" : "",
    });

    if (result.success && !DRY_RUN) sentCount++;

    // Human-like delay between sends
    if (!DRY_RUN) await sleep(CONFIG.delayBetweenMs);
  }

  // Write log
  if (logRows.length > 0) {
    await logger.writeRecords(logRows);
    console.log(`\n📝 Log updated: ${CONFIG.logFile}`);
  }

  // Dry-run report table
  if (DRY_RUN && reportRows.length > 0) {
    console.log("\n📊 DRY RUN REPORT\n");
    console.table(
      reportRows.map((r) => ({
        Target: r.target,
        Domain: r.domain,
        Type: r.type,
        "Reachable?": r.reachable,
        "Contact Found": r.contactFound,
        Template: r.template,
        Subject: r.subject,
      }))
    );

    const flagged = reportRows.filter((r) => r.flag);
    if (flagged.length > 0) {
      console.log("\n🚩 FLAGGED:");
      flagged.forEach((r) => console.log(`  - ${r.domain} (${r.type}): ${r.flag}`));
    }
  }

  console.log(`\n✅ Done. Emails sent today: ${DRY_RUN ? "0 (dry run)" : sentCount}`);
  console.log(`📊 Full log: ${path.resolve(CONFIG.logFile)}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
