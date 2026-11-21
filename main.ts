// Neon Coast Cover Studio — the entry program (Node 22, standard library only).
//
// Copies app/ and screenshots/ from this repository into the output directory
// and writes /output/dossier.json with buildDossier from vendor/makefun-app.ts,
// exactly as the grader runs it. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root is the directory this file lives in.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// The grader gives us a writable /output; locally MAKEFUN_OUTPUT_DIR is used.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The dossier caps are this bounty's gate limits (see the kit's RULES.txt).
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

// Start from an empty output directory so a stale file can never be handed in.
// Clear the directory's CONTENTS without removing the directory itself: the
// grader mounts an empty directory at /output, and removing a mount point
// throws EBUSY ("Device or resource busy").
mkdirSync(outputDir, { recursive: true });
for (const child of readdirSync(outputDir)) {
  rmSync(join(outputDir, child), { recursive: true, force: true });
}

// Hand in the app and its screenshots, whole.
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });

// The dossier is byte for byte what the kit library writes from those files.
const dossier = buildDossier(outputDir, dossierCaps);
writeFileSync(join(outputDir, 'dossier.json'), dossier);

// Sanity-check what we just handed in before reporting success: the output
// must hold the app, the screenshots and the dossier, nothing else missing.
const handedIn = readdirSync(outputDir).sort();
for (const needed of ['app', 'screenshots', 'dossier.json']) {
  if (!existsSync(join(outputDir, needed))) {
    throw new Error(`main.ts: ${needed} is missing from ${outputDir}`);
  }
}

console.log(`wrote ${outputDir}/dossier.json (${dossier.length} bytes)`);
console.log(`handed in ${handedIn.join(', ')} for gta6-cover-art-01`);
