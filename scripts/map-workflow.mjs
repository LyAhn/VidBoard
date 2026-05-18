#!/usr/bin/env node
/**
 * map-workflow.mjs
 *
 * Reads a ComfyUI workflow (API format JSON) and suggests the node-map entry
 * needed in workflows.json.
 *
 * Usage:
 *   node scripts/map-workflow.mjs <workflow-file> [workflow-name] [--init] [--ref]
 *
 * Flags:
 *   --init   Treat the single LoadImage node as an init/img2img image rather than
 *            a character reference image. Use this for edit/inpaint workflows where
 *            the LoadImage is the canvas being edited.
 *   --ref    (default) Treat the single LoadImage node as a character reference image.
 *
 * Examples:
 *   node scripts/map-workflow.mjs comfyui/my-workflow.json my-workflow
 *   node scripts/map-workflow.mjs comfyui/flux2-klein-edit.workflow.json flux2-klein-edit --init
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith("--"));
const workflowName = args.filter((a) => !a.startsWith("--"))[1] ?? null;
const forceInit = args.includes("--init");

if (!filePath) {
  console.error("Usage: node scripts/map-workflow.mjs <workflow-file> [workflow-name] [--init]");
  process.exit(1);
}

let workflow;
try {
  workflow = JSON.parse(readFileSync(filePath, "utf8"));
} catch {
  console.error(`Could not read or parse "${filePath}".`);
  process.exit(1);
}

// ComfyUI API format: top-level keys are node IDs, values have class_type + inputs.
const nodes = Object.entries(workflow).map(([id, node]) => ({
  id,
  class_type: node.class_type ?? "unknown",
  inputs: node.inputs ?? {},
}));

const byType = (types) =>
  nodes.filter((n) => types.some((t) => n.class_type.toLowerCase().includes(t.toLowerCase())));

// ── Candidate detection ────────────────────────────────────────────────────
const clipNodes = byType(["CLIPTextEncode"]);

// Prefer dedicated noise/seed nodes over generic sampler wrappers.
const noiseNodes   = byType(["RandomNoise"]);
const samplerNodes = noiseNodes.length
  ? noiseNodes
  : byType(["KSampler", "SamplerCustomAdvanced", "KSamplerSelect"]);

const schedulerNodes = byType(["BasicScheduler", "KarrasScheduler", "SDTurboScheduler",
                                "PolyexponentialScheduler", "VPScheduler"]);

// Latent nodes: match Empty* generators specifically to avoid false positives like ReferenceLatent.
const latentNodes = byType(["EmptyLatentImage", "EmptySD3LatentImage", "EmptyHunyuanLatentVideo",
                             "EmptyFlux"]);
const hasBatchSize   = (n) => "batch_size" in n.inputs;
const hasWidthHeight = (n) => "width" in n.inputs && "height" in n.inputs;
const sizeNodes = nodes.filter(hasWidthHeight);

// Nodes with width+height+batch_size are almost certainly latent image nodes.
const latentLike = sizeNodes.filter(hasBatchSize);
const schedulerLike = sizeNodes.filter((n) => !hasBatchSize(n));

const effectiveLatent    = latentNodes.length ? latentNodes : latentLike.length ? latentLike : sizeNodes;
const effectiveScheduler = schedulerNodes.length
  ? schedulerNodes
  : schedulerLike.filter((n) => !effectiveLatent.find((l) => l.id === n.id));

const saveNodes = byType(["SaveImage", "SaveAnimatedWEBP", "VHS_VideoCombine"]);
const loadNodes = byType(["LoadImage"]);

// ── LoadImage classification ───────────────────────────────────────────────
// Two LoadImage nodes: first = referenceImage, second = initImage (convention).
// One LoadImage node: defaults to referenceImage; pass --init to override.
let refNode  = null;
let initNode = null;

if (loadNodes.length >= 2) {
  refNode  = loadNodes[0]?.id ?? null;
  initNode = loadNodes[1]?.id ?? null;
} else if (loadNodes.length === 1) {
  if (forceInit) {
    initNode = loadNodes[0].id;
  } else {
    refNode = loadNodes[0].id;
  }
}

const hasRef  = Boolean(refNode);
const hasInit = Boolean(initNode);

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (candidates) =>
  candidates.length === 0
    ? "⚠️  none found"
    : candidates.map((n) => `"${n.id}" (${n.class_type})`).join(" | ");

const pick = (candidates) => (candidates.length === 1 ? candidates[0].id : null);

// ── Print analysis ─────────────────────────────────────────────────────────
console.log("\n── Workflow analysis ─────────────────────────────────────────");
console.log(`File:        ${filePath}`);
console.log(`Total nodes: ${nodes.length}`);
console.log();
console.log(`CLIPTextEncode (prompt / negativePrompt):`);
clipNodes.forEach((n) => {
  const preview = typeof n.inputs.text === "string"
    ? `  text="${n.inputs.text.slice(0, 60).replace(/\n/g, " ")}…"`
    : "";
  console.log(`  [${n.id}] ${n.class_type}${preview}`);
});
console.log(`Sampler / seed:  ${fmt(samplerNodes)}`);
console.log(`Scheduler:       ${fmt(effectiveScheduler)}`);
console.log(`Latent:          ${fmt(effectiveLatent)}`);
console.log(`SaveImage:       ${fmt(saveNodes)}`);
console.log(`LoadImage:       ${fmt(loadNodes)}`);
if (loadNodes.length === 1) {
  console.log(`  → classified as ${hasInit ? "initImage (--init flag)" : "referenceImage (default; use --init to override)"}`);
}

// ── Build suggested entry ──────────────────────────────────────────────────
const name = workflowName ?? basename(filePath).replace(/\.workflow\.json$|\.json$/, "");
const file = basename(filePath);

const positiveClip  = clipNodes[0]?.id ?? "?";
const negativeClip  = clipNodes[1]?.id ?? null;
const seedNode      = pick(samplerNodes) ?? samplerNodes[0]?.id ?? "?";
const schedulerNode = pick(effectiveScheduler) ?? effectiveScheduler[0]?.id ?? null;
const latentNode    = pick(effectiveLatent) ?? effectiveLatent[0]?.id ?? null;
const saveNode      = pick(saveNodes) ?? saveNodes[0]?.id ?? "?";

const nodeMap = {
  prompt: positiveClip,
  ...(negativeClip ? { negativePrompt: negativeClip } : {}),
  seed: seedNode,
  ...(schedulerNode ? { scheduler: schedulerNode } : {}),
  ...(latentNode    ? { latent: latentNode }       : {}),
  saveImage: saveNode,
  ...(hasRef  ? { referenceImage: refNode }  : {}),
  ...(hasInit ? { initImage: initNode }      : {}),
};

const entry = {
  [name]: {
    file,
    capabilities: { referenceImage: hasRef, initImage: hasInit },
    nodes: nodeMap,
  },
};

console.log("\n── Suggested workflows.json entry ───────────────────────────");
console.log(JSON.stringify(entry, null, 2));

if (clipNodes.length > 2) {
  console.log("\n⚠️  More than two CLIPTextEncode nodes found — verify which is positive/negative.");
}
if (loadNodes.length > 2) {
  console.log("⚠️  More than two LoadImage nodes found — verify referenceImage vs initImage assignment.");
}
if (loadNodes.length === 1 && !forceInit) {
  console.log("ℹ️  Single LoadImage treated as referenceImage. If this is an edit/img2img workflow, re-run with --init.");
}
if (clipNodes.length === 0 || samplerNodes.length === 0) {
  console.log("⚠️  Some key nodes were not detected. The workflow may use custom node types.");
  console.log("   Check the node list above and fill in '?' entries manually.");
}

console.log(
  "\nCopy the entry above into the \"workflows\" object in comfyui/workflows.json.\n"
);
