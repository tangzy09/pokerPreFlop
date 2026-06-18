'use strict';
/*
 * build-www.js — assemble the zero-build web app into www/ for Capacitor's
 * webDir. Copies gto-trainer.html -> www/index.html and the whole js/ tree.
 * The web source is unchanged (gto-trainer.html still double-clicks from file://);
 * www/ is a generated staging dir (gitignored). Run before `npx cap copy`.
 *   node tools/build-www.js
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const www = path.join(root, 'www');

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
fs.copyFileSync(path.join(root, 'gto-trainer.html'), path.join(www, 'index.html'));
fs.cpSync(path.join(root, 'js'), path.join(www, 'js'), { recursive: true });
console.log('www/ assembled — index.html + js/ (' +
  fs.readdirSync(path.join(www, 'js')).length + ' js entries)');
