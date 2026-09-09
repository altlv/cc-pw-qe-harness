import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { NetworkRecorder } from '../capture/network.js';
import { formatScan, scanPage } from '../tools/page-scanner.js';

const url = process.argv[2];
const within = process.env.SCAN_WITHIN;
const outPath = process.argv[3];

if (url === undefined) {
  console.error('usage: npm run scan -- <url> [output.json]');
  process.exit(2);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const network = NetworkRecorder.attach(page);

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const scan = await scanPage(page, within ? { within } : {});

  await network.settle();
  scan.endpoints = network
    .entries()
    .filter((call) => call.resourceType === 'fetch' || call.resourceType === 'xhr')
    .map((call) => ({ method: call.method, path: call.path, status: call.status }));

  console.log(formatScan(scan));

  if (outPath !== undefined) {
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(scan, null, 2), 'utf8');
    console.log(`\nWritten to ${outPath}`);
  }
} finally {
  await browser.close();
}
