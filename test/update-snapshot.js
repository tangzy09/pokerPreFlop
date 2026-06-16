'use strict';
// Regenerate the golden snapshot after an INTENTIONAL change to MODES/ranges.
// Run: npm run test:update
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./load-app');
const { buildSnapshot, SNAP_PATH } = require('./snapshot');

const snap = buildSnapshot(loadApp());
fs.mkdirSync(path.dirname(SNAP_PATH), { recursive: true });
fs.writeFileSync(SNAP_PATH, JSON.stringify(snap, null, 2) + '\n', 'utf8');
const spots = Object.keys(snap.charts).length;
const modes = Object.keys(snap.modes).length;
console.log(`snapshot written: ${modes} modes, ${spots} chart spots -> ${SNAP_PATH}`);
