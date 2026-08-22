"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const templatePath = path.join(__dirname, "src", "app.template.html");
const stylePath = path.join(__dirname, "src", "app.css");
const corePath = path.join(__dirname, "src", "bip39-core.js");
const appPath = path.join(__dirname, "src", "app.js");
const wordlistPath = path.join(__dirname, "refs", "english.txt");
const outputPath = path.join(root, "dist", "coin-dice-bip39.html");
const checksumPath = path.join(root, "dist", "SHA256SUMS.txt");

function readTextLf(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n?/g, "\n");
}

const template = readTextLf(templatePath);
const styles = readTextLf(stylePath);
const core = readTextLf(corePath);
const app = readTextLf(appPath);
const wordlist = readTextLf(wordlistPath);

if (wordlist.trim().split("\n").length !== 2048) {
  throw new Error("Expected exactly 2,048 BIP39 English words.");
}

const builtApp = app.replace("__WORDLIST_JSON__", JSON.stringify(wordlist));
const output = template
  .replace("/*__APP_CSS__*/", styles)
  .replace("/*__BIP39_CORE__*/", core)
  .replace("/*__BIP39_APP__*/", builtApp);

if (output.includes("/*__APP_CSS__*/") || output.includes("/*__BIP39_CORE__*/") || output.includes("/*__BIP39_APP__*/") || output.includes("__WORDLIST_JSON__")) {
  throw new Error("Build placeholder replacement failed.");
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, "utf8");
const fileHash = crypto.createHash("sha256").update(Buffer.from(output, "utf8")).digest("hex");
fs.writeFileSync(checksumPath, fileHash + " *coin-dice-bip39.html\r\n", "utf8");
process.stdout.write(outputPath + "\n" + checksumPath + "\nSHA256 " + fileHash + "\n");
