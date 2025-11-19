import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * Smoke test for web/lib/list-utils.ts
 * Run with: node web/tests/verify-list-utils.mjs
 */

const cwd = process.cwd();
const utilsPath = path.join(cwd, 'web', 'lib', 'list-utils.tsx');

if (!fs.existsSync(utilsPath)) {
    console.error('❌ list-utils.ts not found');
    process.exit(1);
}

const content = fs.readFileSync(utilsPath, 'utf8');

const expectedExports = [
    'export function uniq',
    'export function parseMulti',
    'export function includesAll',
    'export function checkMatches',
    'export function highlight'
];

let missing = false;
for (const exp of expectedExports) {
    if (!content.includes(exp)) {
        console.error(`❌ Missing export: ${exp}`);
        missing = true;
    }
}

if (missing) {
    console.error('❌ list-utils.ts verification failed');
    process.exit(1);
}

console.log('✅ list-utils.ts verification passed (static check)');

// Check usage in projects page
const projPath = path.join(cwd, 'web', 'app', 'projects', 'page.tsx');
const projContent = fs.readFileSync(projPath, 'utf8');

// Relaxed check for imports to handle different formatting/newlines
if (!projContent.includes('from "@/lib/list-utils"') && !projContent.includes("from '@/lib/list-utils'")) {
    console.warn('⚠️ Projects page might not be importing list-utils correctly. Check import statement.');
}

// Check usage of MultiFilterChips
if (!projContent.includes('<MultiFilterChips')) {
    console.error('❌ Projects page does not use MultiFilterChips component');
    missing = true;
}

// Check usage of PageCtaCard
if (!projContent.includes('<PageCtaCard')) {
    console.error('❌ Projects page does not use PageCtaCard component');
    missing = true;
}

if (missing) {
    process.exit(1);
}

console.log('✅ Projects page refactoring verification passed (static check)');