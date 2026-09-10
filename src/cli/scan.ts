import '../env.js';
import { chromium } from '@playwright/test';
import { NetworkRecorder } from '../capture/network.js';
import { formatProbe, probePage, writeProbeArtifacts } from '../tools/probe.js';
import { isEnvironment, policyFor } from '../qe/exploration-policy.js';

const url = process.argv[2];
const within = process.env.SCAN_WITHIN;
const outPath = process.argv[3];

if (url === undefined) {
  console.error('usage: npm run scan -- <url> [output.json]');
  console.error('  SCAN_WITHIN=<selector>  scope the element scan to one region');
  console.error('  EXPLORE_ENV=local|test|prod  rules of engagement (default local)');
  console.error(
    '  SCAN_DEEP=1                  hover, keyboard, responsive and late-arrival passes',
  );
  process.exit(2);
}

// scan only looks — it never clicks — so unlike a session it can carry a default.
// The setting that still matters here is whether payload bodies reach the disk.
const declared = process.env.EXPLORE_ENV;
if (declared !== undefined && !isEnvironment(declared)) {
  console.error(`EXPLORE_ENV must be local, test or prod — got "${declared}"`);
  process.exit(2);
}
const policy = policyFor(isEnvironment(declared) ? declared : 'local');

const browser = await chromium.launch();
const page = await browser.newPage();
const network = NetworkRecorder.attach(page, { captureBodies: policy.captureBodies });

try {
  // domcontentloaded, not load: a client-rendered app may not fire load in a
  // useful window, and the probe settles the network itself afterwards.
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const result = await probePage(page, network, {
    ...(within !== undefined ? { within } : {}),
    ...(process.env.SCAN_DEEP === '1' ? { hover: true } : {}),
  });

  console.log(formatProbe(result));

  console.log(
    `\nEnvironment: ${policy.environment}${
      policy.captureBodies
        ? ' — payload bodies ARE recorded'
        : ' — payload bodies withheld from the log'
    }`,
  );

  if (outPath !== undefined) {
    const written = await writeProbeArtifacts(result, outPath);
    console.log('\nWritten:');
    console.log(`  ${written.json}   structured record`);
    console.log(`  ${written.ndjson} raw call log, one JSON per line`);
    console.log(`  ${written.txt}    rendered digest`);
  }
} finally {
  await browser.close();
}
