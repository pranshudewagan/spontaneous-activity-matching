#!/usr/bin/env node
/**
 * Pre-reads all node_modules files to prime macOS security scanning cache.
 * Prevents ETIMEDOUT errors in Metro when com.apple.provenance xattr causes
 * syspolicyd to block first reads under load.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', 'node_modules');
let count = 0;
let errors = 0;

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(full);
    } else if (entry.endsWith('.js') || entry.endsWith('.json')) {
      try {
        const content = fs.readFileSync(full);
        crypto.createHash('sha1').update(content).digest('hex');
        count++;
      } catch (e) {
        if (e.code !== 'ENOENT') errors++;
      }
    }
  }
}

process.stdout.write('Warming up node_modules security scan cache...');
walk(ROOT);
process.stdout.write(` done (${count} files, ${errors} errors)\n`);
