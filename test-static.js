"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const template = fs.readFileSync(path.join(__dirname, "src", "app.template.html"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "src", "app.css"), "utf8");
const core = fs.readFileSync(path.join(__dirname, "src", "bip39-core.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "src", "app.js"), "utf8");
const wordlist = fs.readFileSync(path.join(__dirname, "refs", "english.txt"), "utf8").replace(/\r\n/g, "\n");
const outputPath = path.join(root, "dist", "coin-dice-bip39.html");
const checksumPath = path.join(root, "dist", "SHA256SUMS.txt");
const output = fs.readFileSync(outputPath, "utf8");

const expected = template
  .replace("/*__APP_CSS__*/", styles)
  .replace("/*__BIP39_CORE__*/", core)
  .replace("/*__BIP39_APP__*/", app.replace("__WORDLIST_JSON__", JSON.stringify(wordlist)));
assert.strictEqual(output, expected, "built HTML must be byte-identical to source reconstruction");

const actualHash = crypto.createHash("sha256").update(Buffer.from(output, "utf8")).digest("hex");
const declaredHash = fs.readFileSync(checksumPath, "utf8").trim().split(/\s+/)[0];
assert.strictEqual(declaredHash, actualHash, "checksum declaration");
assert.strictEqual(wordlist.trim().split("\n").length, 2048, "BIP39 word count");
assert.doesNotMatch(output, /__APP_CSS__|__BIP39_CORE__|__BIP39_APP__|__WORDLIST_JSON__/);
assert.match(template, /<title>동전·주사위로 BIP39 니모닉 만들기<\/title>/);
assert.match(template, /<h1 class="brand"[^>]*>[\s\S]*동전·주사위로 BIP39 니모닉 만들기/);

const ids = Array.from(output.matchAll(/\sid="([^"]+)"/g), function (match) { return match[1]; });
assert.strictEqual(new Set(ids).size, ids.length, "all IDs must be unique");
const idSet = new Set(ids);
const jsReferences = Array.from(app.matchAll(/getElementById\("([^"]+)"\)/g), function (match) { return match[1]; });
jsReferences.forEach(function (id) { assert.ok(idSet.has(id), "missing JS target #" + id); });

const referenceAttributes = /\s(?:for|aria-controls|aria-labelledby|aria-describedby|aria-errormessage)="([^"]+)"/g;
for (const match of output.matchAll(referenceAttributes)) {
  match[1].split(/\s+/).forEach(function (id) { assert.ok(idSet.has(id), "broken HTML reference #" + id); });
}

const helpControls = Array.from(template.matchAll(/data-help-trigger="([^"]+)"[^>]+aria-controls="([^"]+)"/g));
assert.strictEqual(helpControls.length, 4, "exactly four contextual help triggers");
helpControls.forEach(function (match) {
  assert.strictEqual(match[1], match[2], "help trigger and panel ID must match");
  assert.ok(idSet.has(match[2]), "missing help panel #" + match[2]);
});

assert.doesNotMatch(output, /<script\s+[^>]*src=|<link\s+[^>]*href=["']https?:|\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\blocalStorage\b|\bsessionStorage\b|navigator\.clipboard|serviceWorker/i);
assert.match(template, /원래 마지막 단어 하나를 특정하는 기능이 아닙니다/);
assert.match(template, /실제로 나온 모든 결과를 순서대로 한 번씩 입력하세요/);
assert.match(template, /SHA-256은 부족하거나 편향된 물리 난수를 늘리거나 고치지 않습니다/);
assert.match(template, /화면만 숨겼습니다[^<]*지워지지 않았습니다/);
assert.match(template, /id="network-status"[^>]*role="status"[^>]*aria-live="polite"/);
assert.match(template, /브라우저의 ‘오프라인’ 표시는 물리적 네트워크 격리나 기기 안전을 증명하지 않습니다/);
assert.match(app, /수집 기준 충족 · 현재 입력 기록의 결과/);
assert.match(app, /마지막 단어는 체크섬만이 아닙니다/);
assert.match(app, /typeof navigator\.onLine === "boolean"/);
assert.match(app, /window\.addEventListener\("online", updateNetworkStatus\)/);
assert.match(app, /window\.addEventListener\("offline", updateNetworkStatus\)/);
assert.match(app, /브라우저 보고: 온라인/);
assert.match(app, /브라우저 보고: 오프라인/);
assert.match(styles, /\.network-status\.online \{[^}]*border: 2px solid/s);
assert.match(styles, /\.network-status\.offline \{[^}]*border: 1px solid/s);
assert.doesNotMatch(styles, /\.network-status\.offline \{[^}]*(?:var\(--green\)|green-soft)/s);
assert.doesNotMatch(template + app + styles, /toggle-input-size|expanded-input|togglePhysicalInputSize/);
assert.match(template, /id="sequence-groups" tabindex="0" aria-label="입력 순번, 실제 입력값, 계산 반영 결과"/);
assert.match(styles, /\.physical-input \{[^}]*overflow-y: auto;[^}]*resize: none;/s);
assert.match(styles, /\.sequence-groups \{[^}]*max-height: 360px;[^}]*overflow-y: auto;/s);
assert.match(app, /captureSequenceScroll[\s\S]*restoreSequenceScroll/);
assert.doesNotMatch(template + app + styles, /appendSequenceBlocks|sequence-block|sequence-range|sequence-cells/);
assert.match(app, /수집 기준 계산용 비트 · BIP39 엔트로피 아님/);
assert.match(app, /hasCopyablePhysicalResult[\s\S]*window\.confirm/);
assert.match(app, /config\.derivation !== HASH_MODE \|\| state\.process\.complete/);
assert.match(app, /!hadCopyableResult && nowCopyableResult/);
assert.match(app, /hadCopyableResult && !nowCopyableResult/);
assert.doesNotMatch(template, /Ian|Coleman|이안|콜먼/);
assert.match(template, /<meta name="theme-color" content="#ffffff">/);
assert.match(styles, /color-scheme:\s*light/);
assert.match(styles, /--bg:\s*#ffffff/);
assert.match(styles, /--text:\s*#111111/);
assert.doesNotMatch(styles, /color-scheme:\s*dark|linear-gradient|backdrop-filter/);
assert.match(styles, /\.screen-cover \{[^}]*background:\s*#dddddd;/s);

const widthBreakpoints = Array.from(styles.matchAll(/@media \(max-width:/g)).length;
assert.strictEqual(widthBreakpoints, 2, "one consolidated responsive breakpoint system");

process.stdout.write("PASS: source/output integrity, checksum, DOM references, help structure, offline boundary, and content invariants.\n");
