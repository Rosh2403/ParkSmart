#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i++;
  }
  return out;
}

function readInputText({ sourceTextFile = "", sourceText = "" }) {
  if (sourceText) return sourceText;
  if (!sourceTextFile) return "";
  return fs.readFileSync(path.resolve(sourceTextFile), "utf8");
}

function stripCodeFences(s) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function normalizeAlias(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function validateEntry(entry) {
  const errs = [];
  if (!entry || typeof entry !== "object") errs.push("Entry must be an object.");
  if (!entry.key) errs.push("Missing key.");
  if (!entry.displayName) errs.push("Missing displayName.");
  if (!Array.isArray(entry.aliases) || entry.aliases.length === 0) errs.push("aliases must be non-empty array.");
  if (!entry.tariff || entry.tariff.type !== "first_hour_then_half_hour") errs.push("Unsupported tariff schema.");
  const tariff = entry.tariff || {};
  ["weekday", "weekendOrPH", "night"].forEach((k) => {
    const band = tariff[k];
    if (!band) errs.push(`Missing tariff.${k}.`);
    if (band && !Number.isFinite(Number(band.firstHour))) errs.push(`tariff.${k}.firstHour must be numeric.`);
    if (band && !Number.isFinite(Number(band.perHalfHour))) errs.push(`tariff.${k}.perHalfHour must be numeric.`);
    if (band && !band.rateLabel) errs.push(`tariff.${k}.rateLabel missing.`);
  });
  if (!tariff.capLabel) errs.push("tariff.capLabel missing.");
  return errs;
}

function toCatalogEntry(raw, { sourceUrl = "" }) {
  const fallbackAliases = [raw.displayName, String(raw.key || "").replace(/_/g, " ")];
  const aliases = (raw.aliases || []).map(normalizeAlias).filter(Boolean);
  const mergedAliases = [...new Set([...aliases, ...fallbackAliases.map(normalizeAlias).filter(Boolean)])];

  const entry = {
    key: raw.key,
    displayName: raw.displayName,
    aliases: mergedAliases,
    geofence: raw.geofence || null,
    tariff: {
      type: "first_hour_then_half_hour",
      dayStartMins: Number(raw.tariff?.dayStartMins ?? 420),
      dayEndMins: Number(raw.tariff?.dayEndMins ?? 1320),
      weekday: {
        firstHour: Number(raw.tariff?.weekday?.firstHour),
        perHalfHour: Number(raw.tariff?.weekday?.perHalfHour),
        rateLabel: String(raw.tariff?.weekday?.rateLabel || ""),
      },
      weekendOrPH: {
        firstHour: Number(raw.tariff?.weekendOrPH?.firstHour),
        perHalfHour: Number(raw.tariff?.weekendOrPH?.perHalfHour),
        rateLabel: String(raw.tariff?.weekendOrPH?.rateLabel || ""),
      },
      night: {
        firstHour: Number(raw.tariff?.night?.firstHour),
        perHalfHour: Number(raw.tariff?.night?.perHalfHour),
        rateLabel: String(raw.tariff?.night?.rateLabel || ""),
      },
      capLabel: String(raw.tariff?.capLabel || ""),
      sourceUrl: sourceUrl || String(raw.tariff?.sourceUrl || ""),
      lastVerifiedAt: new Date().toISOString().slice(0, 10),
    },
  };
  if (!entry.geofence || !Number.isFinite(Number(entry.geofence.lat)) || !Number.isFinite(Number(entry.geofence.lng))) {
    delete entry.geofence;
  } else {
    entry.geofence = {
      lat: Number(entry.geofence.lat),
      lng: Number(entry.geofence.lng),
      radiusM: Number(entry.geofence.radiusM || 800),
    };
  }
  return entry;
}

async function callGemini({ apiKey, mallName, sourceUrl, sourceText }) {
  const prompt = [
    "Convert the provided mall parking tariff source into strict JSON.",
    "Output exactly one JSON object with schema:",
    "{",
    '  "key": "snake_case_mall_key",',
    '  "displayName": "Mall Name",',
    '  "aliases": ["name alias", "..."],',
    '  "geofence": { "lat": number, "lng": number, "radiusM": number },',
    '  "tariff": {',
    '    "dayStartMins": number,',
    '    "dayEndMins": number,',
    '    "weekday": { "firstHour": number, "perHalfHour": number, "rateLabel": string },',
    '    "weekendOrPH": { "firstHour": number, "perHalfHour": number, "rateLabel": string },',
    '    "night": { "firstHour": number, "perHalfHour": number, "rateLabel": string },',
    '    "capLabel": string',
    "  }",
    "}",
    "Rules:",
    "- Use SGD values only.",
    "- If source has incomplete details, infer conservatively and include label text indicating estimate.",
    "- Keep output JSON-only, no markdown.",
    "",
    `Mall Name: ${mallName || ""}`,
    `Source URL: ${sourceUrl || ""}`,
    "Source Text:",
    sourceText || "(none)",
  ].join("\n");

  const normalizeModel = (m) => String(m || "").replace(/^models\//, "").trim();
  const requested = process.env.GEMINI_MODEL ? [normalizeModel(process.env.GEMINI_MODEL)] : [];
  const candidates = [
    ...requested,
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-lite-001",
  ];
  const tried = new Set();
  const errors = [];

  for (const model of candidates) {
    if (!model || tried.has(model)) continue;
    tried.add(model);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      errors.push(`${model}: ${err.message || String(err)}`);
      continue;
    }
    clearTimeout(timeout);
    if (!res.ok) {
      const txt = await res.text();
      errors.push(`${model}: ${res.status} ${txt.slice(0, 200)}`);
      continue;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n").trim();
    if (!text) {
      errors.push(`${model}: empty response content`);
      continue;
    }
    const parsed = JSON.parse(stripCodeFences(text));
    return parsed;
  }

  throw new Error(`Gemini API request failed for all candidate models. Details: ${errors.join(" | ")}`);
}

function upsertCandidate(entry, outFile) {
  let arr = [];
  if (fs.existsSync(outFile)) {
    arr = JSON.parse(fs.readFileSync(outFile, "utf8"));
    if (!Array.isArray(arr)) arr = [];
  }
  const idx = arr.findIndex((x) => x.key === entry.key);
  if (idx >= 0) arr[idx] = entry;
  else arr.push(entry);
  fs.writeFileSync(outFile, `${JSON.stringify(arr, null, 2)}\n`);
}

async function main() {
  const args = parseArgs(process.argv);
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY in environment.");
    process.exit(1);
  }
  const mallName = args.name || "";
  const sourceUrl = args.url || "";
  const sourceText = readInputText({ sourceTextFile: args["source-text-file"], sourceText: args["source-text"] });
  if (!mallName) {
    console.error("Usage: node scripts/extract-mall-rates.js --name \"Mall Name\" [--url \"https://...\"] [--source-text-file ./notes.txt]");
    process.exit(1);
  }

  const raw = await callGemini({ apiKey, mallName, sourceUrl, sourceText });
  const entry = toCatalogEntry(raw, { sourceUrl });
  const errs = validateEntry(entry);
  if (errs.length > 0) {
    console.error("Validation failed:");
    errs.forEach((e) => console.error(`- ${e}`));
    console.error(JSON.stringify(entry, null, 2));
    process.exit(1);
  }

  const outFile = path.resolve("data/mallRatesCandidates.json");
  upsertCandidate(entry, outFile);
  console.log(`Saved candidate for ${entry.displayName} to ${outFile}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
