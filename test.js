"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const core = require("./src/bip39-core.js");

const wordlist = fs.readFileSync(path.join(__dirname, "refs", "english.txt"), "utf8").trim().split(/\r?\n/);
const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, "refs", "vectors.json"), "utf8")).english;

assert.strictEqual(core.selfTest(wordlist), true);

const fourLetterPrefixes = new Map();
wordlist.forEach(function (word) {
  if (word.length < 4) return;
  const prefix = word.slice(0, 4);
  assert.strictEqual(fourLetterPrefixes.has(prefix), false, "unique BIP39 four-letter prefix: " + prefix);
  fourLetterPrefixes.set(prefix, word);
});
assert.strictEqual(fourLetterPrefixes.get("aban"), "abandon");
assert.deepStrictEqual(
  wordlist.filter(function (word) { return word.startsWith("act"); }),
  ["act", "action", "actor", "actress", "actual"]
);
assert.strictEqual(wordlist.includes("act"), true, "a complete short BIP39 word remains valid beside longer prefix matches");
assert.deepStrictEqual(core.wordPrefixCandidates("ABAN", wordlist), ["abandon"]);
assert.deepStrictEqual(core.wordPrefixCandidates("act", wordlist), ["act", "action", "actor", "actress", "actual"]);
assert.deepStrictEqual(core.wordPrefixCandidates("act!", wordlist), []);
const originalDraft = ["abandon", "ability"];
assert.deepStrictEqual(core.distributeWordDraft(originalDraft, 1, ["about", "above"]), ["abandon", "about", "above"]);
assert.deepStrictEqual(originalDraft, ["abandon", "ability"], "word distribution must not mutate its source draft");

vectors.forEach(function (vector, index) {
  const result = core.entropyBytesToMnemonic(core.hexToBytes(vector[0]), wordlist);
  assert.strictEqual(result.mnemonic, vector[1], "mnemonic vector " + index);
  assert.strictEqual(core.mnemonicToEntropy(vector[1], wordlist).entropyHex, vector[0], "roundtrip vector " + index);
  const vectorWords = vector[1].split(" ");
  const vectorCandidates = core.lastWordCandidates(vectorWords.slice(0, -1), vectorWords.length, wordlist);
  assert.strictEqual(
    vectorCandidates.candidates.some(function (candidate) { return candidate.lastWord === vectorWords[vectorWords.length - 1]; }),
    true,
    "last-word candidate vector " + index
  );
});

assert.deepStrictEqual(
  core.coinFlipsToBits(["0", "1", "1", "0"], 3),
  { bits: "011", consumedFlips: 3, unusedFlips: 1, complete: true }
);

assert.deepStrictEqual(
  core.diceRollsToBits([1, 1, 6, 2], 10),
  {
    bits: "0000011111",
    consumedRolls: 4,
    unusedRolls: 0,
    acceptedPairs: 2,
    rejectedPairs: 0,
    pendingRoll: null,
    finalBitsUsed: 5,
    complete: true
  }
);

assert.deepStrictEqual(
  core.diceRollsToBits([6, 3, 1, 2, 4], 5),
  {
    bits: "00001",
    consumedRolls: 4,
    unusedRolls: 1,
    acceptedPairs: 1,
    rejectedPairs: 1,
    pendingRoll: null,
    finalBitsUsed: 5,
    complete: true
  }
);

assert.deepStrictEqual(
  core.diceRollsToBits([6], 5),
  {
    bits: "",
    consumedRolls: 1,
    unusedRolls: 0,
    acceptedPairs: 0,
    rejectedPairs: 0,
    pendingRoll: 6,
    finalBitsUsed: 0,
    complete: false
  }
);

assert.strictEqual(core.diceRollsToBits([6, 2], 3).bits, "111");
assert.strictEqual(core.diceRollsToBits([6, 3, 6, 4, 6, 5, 6, 6], 5).bits, "");

assert.deepStrictEqual(
  core.variableLengthDiceRollsToBits([1, 2, 3, 4, 5, 6], 128),
  {
    bits: "0110110100",
    rawBits: "0110110100",
    consumedRolls: 6,
    droppedLeadingBits: 0,
    complete: false
  }
);
assert.deepStrictEqual(
  core.variableLengthDiceRollsToBits([1, 1], 3),
  {
    bits: "101",
    rawBits: "0101",
    consumedRolls: 2,
    droppedLeadingBits: 1,
    complete: true
  }
);
const variableZero = core.variableLengthDiceRollsToBits(new Array(64).fill(6), 128);
assert.strictEqual(variableZero.complete, true);
assert.strictEqual(variableZero.bits, "0".repeat(128));
assert.strictEqual(core.entropyBitsToMnemonic(variableZero.bits, wordlist).mnemonic, "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");

const variableRightTrim = core.variableLengthDiceRollsToBits(new Array(63).fill(6).concat([4, 1]), 128);
assert.strictEqual(variableRightTrim.rawBits.length, 129);
assert.strictEqual(variableRightTrim.droppedLeadingBits, 1);
assert.strictEqual(variableRightTrim.bits, "0".repeat(127) + "1");
assert.strictEqual(core.entropyBitsToMnemonic(variableRightTrim.bits, wordlist).mnemonic, "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon actual");

const fixedDice = core.transcriptHashToBits([1, 6, 2], "dice", 128);
assert.strictEqual(fixedDice.cleanText, "102");
assert.strictEqual(
  fixedDice.bits,
  Array.from(crypto.createHash("sha256").update("102", "ascii").digest()).map(function (byte) {
    return byte.toString(2).padStart(8, "0");
  }).join("").slice(0, 128)
);
assert.strictEqual(core.transcriptHashToBits(["0", "1"], "coin", 256).cleanText, "01");

assert.deepStrictEqual(
  core.parsePhysicalTranscript("0101 1001\n01", "coin"),
  { events: "0101100101".split(""), cleanText: "0101100101" }
);
assert.deepStrictEqual(
  core.parsePhysicalTranscript("1 2 6\n3456", "dice"),
  { events: "1263456".split(""), cleanText: "1263456" }
);
assert.throws(function () { core.parsePhysicalTranscript("0102", "coin"); }, /1행 4열.*0 또는 1/);
assert.throws(function () { core.parsePhysicalTranscript("1206", "dice"); }, /1행 3열.*1부터 6/);
assert.throws(function () { core.parsePhysicalTranscript("１", "dice"); }, /1행 1열/);

assert.deepStrictEqual(
  core.analyzeDirectInputCapacity(new Array(129).fill("0"), "coin", "dice-variable-bits-v1", 128),
  { complete: true, acceptedCount: 128, extraCount: 1 }
);
assert.deepStrictEqual(
  core.analyzeDirectInputCapacity(new Array(65).fill("6"), "dice", "dice-variable-bits-v1", 128),
  { complete: true, acceptedCount: 64, extraCount: 1 }
);
assert.deepStrictEqual(
  core.analyzeDirectInputCapacity(new Array(27).fill(["1", "1"]).flat(), "dice", "dice-pair-rejection-v1", 128),
  { complete: true, acceptedCount: 52, extraCount: 2 }
);
const pairWithRejection = new Array(25).fill(["1", "1"]).flat().concat(["6", "3", "1", "1", "4"]);
assert.deepStrictEqual(
  core.analyzeDirectInputCapacity(pairWithRejection, "dice", "dice-pair-rejection-v1", 128),
  { complete: true, acceptedCount: 54, extraCount: 1 }
);
const parsedHashDice = core.parsePhysicalTranscript("1 6\n2", "dice").events;
assert.strictEqual(core.transcriptHashToBits(parsedHashDice, "dice", 128).cleanText, "102");
assert.strictEqual(
  core.transcriptHashToBits(new Array(128).fill("0"), "coin", 128).bits === core.transcriptHashToBits(new Array(129).fill("0"), "coin", 128).bits,
  false
);

const candidateExpectations = [
  [12, 128, "about", "wrap"],
  [15, 64, "address", "word"],
  [18, 32, "agent", "wedding"],
  [21, 16, "admit", "verify"],
  [24, 8, "art", "trouble"]
];
candidateExpectations.forEach(function (expectation) {
  const fullWordCount = expectation[0];
  const result = core.lastWordCandidates(new Array(fullWordCount - 1).fill("abandon"), fullWordCount, wordlist);
  assert.strictEqual(result.candidateCount, expectation[1]);
  assert.strictEqual(result.candidates[0].lastWord, expectation[2]);
  assert.strictEqual(result.candidates[result.candidates.length - 1].lastWord, expectation[3]);
  assert.strictEqual(new Set(result.candidates.map(function (candidate) { return candidate.lastWord; })).size, result.candidateCount);
  result.candidates.forEach(function (candidate, index) {
    assert.strictEqual(parseInt(candidate.missingEntropyBits, 2), index);
    assert.strictEqual(candidate.lastIndex >> result.checksumLength, index);
  });
});

const legalPrefix = "legal winner thank year wave sausage worth useful legal winner thank".split(" ");
assert.strictEqual(
  core.lastWordCandidates(legalPrefix, 12, wordlist).candidates.some(function (candidate) { return candidate.lastWord === "yellow"; }),
  true
);
assert.throws(function () { core.lastWordCandidates(new Array(10).fill("abandon"), 12, wordlist); }, /앞 단어 수/);
assert.throws(function () { core.lastWordCandidates(new Array(10).fill("abandon").concat(["Abandon"]), 12, wordlist); }, /11번째 단어/);

for (const entropyLength of core.ALLOWED_ENTROPY_BITS) {
  const bytes = new Uint8Array(entropyLength / 8);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 73 + entropyLength) & 0xff;
  const encoded = core.entropyBytesToMnemonic(bytes, wordlist);
  const decoded = core.mnemonicToEntropy(encoded.mnemonic, wordlist);
  assert.strictEqual(decoded.entropyHex, core.bytesToHex(bytes), "roundtrip ENT=" + entropyLength);
  assert.strictEqual(encoded.lastEntropyBits.length + encoded.lastChecksumBits.length, 11);
  assert.strictEqual(encoded.lastChecksumBits.length, entropyLength / 32);
}

process.stdout.write("PASS: 24 official vectors, both physical-input modes, last-word candidates, and all entropy sizes.\n");
