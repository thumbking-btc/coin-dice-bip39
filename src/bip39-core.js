(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Bip39Physical = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ALLOWED_ENTROPY_BITS = Object.freeze([128, 160, 192, 224, 256]);
  const WORD_COUNT_TO_ENTROPY = Object.freeze({ 12: 128, 15: 160, 18: 192, 21: 224, 24: 256 });
  const VARIABLE_LENGTH_DICE_BITS = Object.freeze({
    "1": "01",
    "2": "10",
    "3": "11",
    "4": "0",
    "5": "1",
    "6": "00"
  });
  const SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function rotr(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function sha256(input) {
    const bytes = input instanceof Uint8Array ? input : Uint8Array.from(input);
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;

    const bitLength = bytes.length * 8;
    const paddingView = new DataView(padded.buffer);
    paddingView.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
    paddingView.setUint32(paddedLength - 4, bitLength >>> 0, false);

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;
    const schedule = new Uint32Array(64);

    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let i = 0; i < 16; i += 1) {
        schedule[i] = paddingView.getUint32(offset + i * 4, false);
      }
      for (let i = 16; i < 64; i += 1) {
        const x = schedule[i - 15];
        const y = schedule[i - 2];
        const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
        const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
        schedule[i] = (schedule[i - 16] + s0 + schedule[i - 7] + s1) >>> 0;
      }

      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;

      for (let i = 0; i < 64; i += 1) {
        const bigS1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const choose = (e & f) ^ (~e & g);
        const temp1 = (h + bigS1 + choose + SHA256_K[i] + schedule[i]) >>> 0;
        const bigS0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (bigS0 + majority) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }

    const output = new Uint8Array(32);
    const outputView = new DataView(output.buffer);
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach(function (value, index) {
      outputView.setUint32(index * 4, value, false);
    });
    schedule.fill(0);
    padded.fill(0);
    return output;
  }

  function asciiBytes(text) {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      if (code > 0x7f) throw new Error("ASCII 문자열만 지원합니다.");
      bytes[i] = code;
    }
    return bytes;
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, function (value) {
      return value.toString(16).padStart(2, "0");
    }).join("");
  }

  function sha256Hex(bytes) {
    return bytesToHex(sha256(bytes));
  }

  function hexToBytes(hex) {
    if (typeof hex !== "string" || hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
      throw new Error("올바른 16진수 문자열이 아닙니다.");
    }
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  function bytesToBits(bytes) {
    return Array.from(bytes, function (value) {
      return value.toString(2).padStart(8, "0");
    }).join("");
  }

  function bitsToBytes(bits) {
    if (typeof bits !== "string" || bits.length % 8 !== 0 || /[^01]/.test(bits)) {
      throw new Error("비트열 길이는 8의 배수여야 합니다.");
    }
    const bytes = new Uint8Array(bits.length / 8);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
    }
    return bytes;
  }

  function validateWordlist(wordlist) {
    if (!Array.isArray(wordlist) || wordlist.length !== 2048) {
      throw new Error("BIP39 영문 단어 목록은 정확히 2,048개여야 합니다.");
    }
    if (new Set(wordlist).size !== 2048) {
      throw new Error("BIP39 영문 단어 목록에 중복이 있습니다.");
    }
    for (let i = 1; i < wordlist.length; i += 1) {
      if (wordlist[i - 1] >= wordlist[i]) {
        throw new Error("BIP39 영문 단어 목록의 정렬이 잘못되었습니다.");
      }
    }
    if (wordlist[0] !== "abandon" || wordlist[2047] !== "zoo") {
      throw new Error("BIP39 영문 단어 목록의 경계값이 잘못되었습니다.");
    }
    const canonicalText = wordlist.join("\n") + "\n";
    const expectedHash = "2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda";
    if (sha256Hex(asciiBytes(canonicalText)) !== expectedHash) {
      throw new Error("BIP39 영문 단어 목록의 SHA-256 검증에 실패했습니다.");
    }
    return true;
  }

  function entropyBytesToMnemonic(entropy, wordlist) {
    if (!(entropy instanceof Uint8Array)) entropy = Uint8Array.from(entropy);
    const entropyLength = entropy.length * 8;
    if (!ALLOWED_ENTROPY_BITS.includes(entropyLength)) {
      throw new Error("엔트로피는 128, 160, 192, 224, 256비트 중 하나여야 합니다.");
    }
    if (!Array.isArray(wordlist) || wordlist.length !== 2048) {
      throw new Error("BIP39 단어 목록이 올바르지 않습니다.");
    }

    const entropyBits = bytesToBits(entropy);
    const checksumLength = entropyLength / 32;
    const checksumBits = bytesToBits(sha256(entropy)).slice(0, checksumLength);
    const combinedBits = entropyBits + checksumBits;
    const indices = [];
    const words = [];
    for (let i = 0; i < combinedBits.length; i += 11) {
      const index = parseInt(combinedBits.slice(i, i + 11), 2);
      indices.push(index);
      words.push(wordlist[index]);
    }
    const lastBits = combinedBits.slice(-11);
    const lastEntropyBitCount = 11 - checksumLength;
    return {
      entropyBits: entropyBits,
      entropyHex: bytesToHex(entropy),
      entropyLength: entropyLength,
      checksumBits: checksumBits,
      checksumLength: checksumLength,
      combinedBits: combinedBits,
      indices: indices,
      words: words,
      mnemonic: words.join(" "),
      lastWord: words[words.length - 1],
      lastIndex: indices[indices.length - 1],
      lastBits: lastBits,
      lastEntropyBits: lastBits.slice(0, lastEntropyBitCount),
      lastChecksumBits: lastBits.slice(lastEntropyBitCount)
    };
  }

  function entropyBitsToMnemonic(bits, wordlist) {
    if (typeof bits !== "string" || /[^01]/.test(bits) || !ALLOWED_ENTROPY_BITS.includes(bits.length)) {
      throw new Error("엔트로피 비트열이 올바르지 않습니다.");
    }
    return entropyBytesToMnemonic(bitsToBytes(bits), wordlist);
  }

  function mnemonicToEntropy(mnemonic, wordlist) {
    const words = Array.isArray(mnemonic)
      ? mnemonic.slice()
      : String(mnemonic).trim().split(/\s+/);
    const validWordCounts = [12, 15, 18, 21, 24];
    if (!validWordCounts.includes(words.length)) {
      throw new Error("니모닉 단어 수가 올바르지 않습니다.");
    }
    const positions = new Map(wordlist.map(function (word, index) { return [word, index]; }));
    let combinedBits = "";
    words.forEach(function (word) {
      if (!positions.has(word)) throw new Error("단어 목록에 없는 단어가 있습니다: " + word);
      combinedBits += positions.get(word).toString(2).padStart(11, "0");
    });
    const entropyLength = (words.length * 11 * 32) / 33;
    const checksumLength = entropyLength / 32;
    const entropyBits = combinedBits.slice(0, entropyLength);
    const suppliedChecksum = combinedBits.slice(entropyLength);
    const entropy = bitsToBytes(entropyBits);
    const expectedChecksum = bytesToBits(sha256(entropy)).slice(0, checksumLength);
    if (suppliedChecksum !== expectedChecksum) throw new Error("니모닉 체크섬이 올바르지 않습니다.");
    return {
      entropyBits: entropyBits,
      entropyHex: bytesToHex(entropy),
      checksumBits: suppliedChecksum
    };
  }

  function parsePhysicalTranscript(text, source) {
    const input = String(text);
    const allowed = source === "coin" ? /^[01]$/ : (source === "dice" ? /^[1-6]$/ : null);
    if (!allowed) throw new Error("물리 입력 종류는 coin 또는 dice여야 합니다.");
    const events = [];
    let line = 1;
    let column = 0;
    for (let offset = 0; offset < input.length; offset += 1) {
      const character = input[offset];
      if (character === "\r") {
        if (input[offset + 1] === "\n") offset += 1;
        line += 1;
        column = 0;
        continue;
      }
      if (character === "\n") {
        line += 1;
        column = 0;
        continue;
      }
      column += 1;
      if (/\s/u.test(character)) continue;
      if (!allowed.test(character)) {
        const expected = source === "coin" ? "동전은 0 또는 1만" : "주사위는 1부터 6까지만";
        throw new Error(line + "행 " + column + "열의 ‘" + character + "’는 사용할 수 없습니다. " + expected + " 입력하세요.");
      }
      events.push(character);
    }
    return { events: events, cleanText: events.join("") };
  }

  function coinFlipsToBits(flips, targetBits) {
    if (!Number.isInteger(targetBits) || targetBits < 1) throw new Error("목표 비트 수가 올바르지 않습니다.");
    const normalized = Array.from(flips, function (value) { return String(value); });
    if (normalized.some(function (value) { return value !== "0" && value !== "1"; })) {
      throw new Error("동전 입력은 0 또는 1이어야 합니다.");
    }
    const bits = normalized.slice(0, targetBits).join("");
    return {
      bits: bits,
      consumedFlips: Math.min(normalized.length, targetBits),
      unusedFlips: Math.max(0, normalized.length - targetBits),
      complete: bits.length === targetBits
    };
  }

  function diceRollsToBits(rolls, targetBits) {
    if (!Number.isInteger(targetBits) || targetBits < 1) throw new Error("목표 비트 수가 올바르지 않습니다.");
    const normalized = Array.from(rolls, function (value) { return Number(value); });
    if (normalized.some(function (value) { return !Number.isInteger(value) || value < 1 || value > 6; })) {
      throw new Error("주사위 입력은 1부터 6까지의 정수여야 합니다.");
    }

    let bits = "";
    let consumedRolls = 0;
    let acceptedPairs = 0;
    let rejectedPairs = 0;
    let finalBitsUsed = 0;
    while (consumedRolls + 1 < normalized.length && bits.length < targetBits) {
      const first = normalized[consumedRolls];
      const second = normalized[consumedRolls + 1];
      consumedRolls += 2;
      const value = (first - 1) * 6 + (second - 1);
      if (value >= 32) {
        rejectedPairs += 1;
        continue;
      }
      acceptedPairs += 1;
      const fiveBits = value.toString(2).padStart(5, "0");
      const needed = Math.min(5, targetBits - bits.length);
      bits += fiveBits.slice(0, needed);
      finalBitsUsed = needed;
    }

    const complete = bits.length === targetBits;
    const pendingRoll = !complete && consumedRolls < normalized.length
      ? normalized[consumedRolls]
      : null;
    if (pendingRoll !== null) consumedRolls += 1;
    return {
      bits: bits,
      consumedRolls: consumedRolls,
      unusedRolls: Math.max(0, normalized.length - consumedRolls),
      acceptedPairs: acceptedPairs,
      rejectedPairs: rejectedPairs,
      pendingRoll: pendingRoll,
      finalBitsUsed: finalBitsUsed,
      complete: complete
    };
  }

  function variableLengthDiceRollsToBits(rolls, targetBits) {
    if (!Number.isInteger(targetBits) || targetBits < 1) throw new Error("목표 비트 수가 올바르지 않습니다.");
    const normalized = Array.from(rolls, function (value) { return Number(value); });
    if (normalized.some(function (value) { return !Number.isInteger(value) || value < 1 || value > 6; })) {
      throw new Error("주사위 입력은 1부터 6까지의 정수여야 합니다.");
    }
    const rawBits = normalized.map(function (value) {
      return VARIABLE_LENGTH_DICE_BITS[String(value)];
    }).join("");
    const complete = rawBits.length >= targetBits;
    const droppedLeadingBits = complete ? rawBits.length - targetBits : 0;
    return {
      bits: complete ? rawBits.slice(-targetBits) : rawBits,
      rawBits: rawBits,
      consumedRolls: normalized.length,
      droppedLeadingBits: droppedLeadingBits,
      complete: complete
    };
  }

  function analyzeDirectInputCapacity(inputs, source, diceMethod, targetBits) {
    if (!Number.isInteger(targetBits) || targetBits < 1) throw new Error("목표 비트 수가 올바르지 않습니다.");
    const values = Array.from(inputs);
    let acceptedCount = values.length;
    let complete = false;
    if (source === "coin") {
      const process = coinFlipsToBits(values, targetBits);
      complete = process.complete;
      if (complete) acceptedCount = process.consumedFlips;
    } else if (source === "dice" && diceMethod === "dice-variable-bits-v1") {
      let bitCount = 0;
      for (let index = 0; index < values.length; index += 1) {
        const roll = String(values[index]);
        if (!Object.prototype.hasOwnProperty.call(VARIABLE_LENGTH_DICE_BITS, roll)) {
          throw new Error("주사위 입력은 1부터 6까지의 정수여야 합니다.");
        }
        bitCount += VARIABLE_LENGTH_DICE_BITS[roll].length;
        if (bitCount >= targetBits) {
          complete = true;
          acceptedCount = index + 1;
          break;
        }
      }
    } else if (source === "dice" && diceMethod === "dice-pair-rejection-v1") {
      const process = diceRollsToBits(values, targetBits);
      complete = process.complete;
      if (complete) acceptedCount = process.consumedRolls;
    } else {
      throw new Error("직접 입력 변환 방식이 올바르지 않습니다.");
    }
    return {
      complete: complete,
      acceptedCount: acceptedCount,
      extraCount: Math.max(0, values.length - acceptedCount)
    };
  }

  function transcriptHashToBits(inputs, source, targetBits) {
    if (!ALLOWED_ENTROPY_BITS.includes(targetBits)) {
      throw new Error("목표 엔트로피는 128, 160, 192, 224, 256비트 중 하나여야 합니다.");
    }
    const values = Array.from(inputs);
    let cleanText = "";
    if (source === "coin") {
      const normalized = values.map(function (value) { return String(value); });
      if (normalized.some(function (value) { return value !== "0" && value !== "1"; })) {
        throw new Error("동전 입력은 0 또는 1이어야 합니다.");
      }
      cleanText = normalized.join("");
    } else if (source === "dice") {
      const normalized = values.map(function (value) { return Number(value); });
      if (normalized.some(function (value) { return !Number.isInteger(value) || value < 1 || value > 6; })) {
        throw new Error("주사위 입력은 1부터 6까지의 정수여야 합니다.");
      }
      cleanText = normalized.map(function (value) { return value === 6 ? "0" : String(value); }).join("");
    } else {
      throw new Error("물리 입력 종류는 coin 또는 dice여야 합니다.");
    }
    return {
      bits: cleanText ? bytesToBits(sha256(asciiBytes(cleanText))).slice(0, targetBits) : "",
      cleanText: cleanText,
      available: cleanText.length > 0
    };
  }

  function lastWordCandidates(prefixWords, fullWordCount, wordlist) {
    const allowedWordCounts = [12, 15, 18, 21, 24];
    if (!allowedWordCounts.includes(fullWordCount)) {
      throw new Error("완성 니모닉 길이는 12, 15, 18, 21, 24단어 중 하나여야 합니다.");
    }
    if (!Array.isArray(prefixWords) || prefixWords.length !== fullWordCount - 1) {
      throw new Error("앞 단어 수가 선택한 니모닉 길이와 맞지 않습니다.");
    }
    if (!Array.isArray(wordlist) || wordlist.length !== 2048) {
      throw new Error("BIP39 단어 목록이 올바르지 않습니다.");
    }
    const words = prefixWords.map(function (word) { return String(word); });
    const positions = new Map(wordlist.map(function (word, index) { return [word, index]; }));
    words.forEach(function (word, index) {
      if (!positions.has(word)) {
        throw new Error((index + 1) + "번째 단어가 BIP39 영문 목록에 없습니다: " + word);
      }
    });

    const entropyLength = WORD_COUNT_TO_ENTROPY[fullWordCount];
    const checksumLength = entropyLength / 32;
    const prefixBits = words.map(function (word) {
      return positions.get(word).toString(2).padStart(11, "0");
    }).join("");
    const missingEntropyLength = entropyLength - prefixBits.length;
    const candidateCount = 2 ** missingEntropyLength;
    const candidates = [];

    for (let value = 0; value < candidateCount; value += 1) {
      const missingEntropyBits = value.toString(2).padStart(missingEntropyLength, "0");
      const result = entropyBitsToMnemonic(prefixBits + missingEntropyBits, wordlist);
      for (let index = 0; index < words.length; index += 1) {
        if (result.words[index] !== words[index]) throw new Error("마지막 단어 후보 내부 검증에 실패했습니다.");
      }
      candidates.push({
        missingEntropyBits: missingEntropyBits,
        checksumBits: result.checksumBits,
        lastBits: result.lastBits,
        lastIndex: result.lastIndex,
        listNumber: result.lastIndex + 1,
        lastWord: result.lastWord
      });
    }

    return {
      fullWordCount: fullWordCount,
      prefixWordCount: words.length,
      entropyLength: entropyLength,
      checksumLength: checksumLength,
      missingEntropyLength: missingEntropyLength,
      candidateCount: candidateCount,
      candidates: candidates
    };
  }

  function selfTest(wordlist) {
    validateWordlist(wordlist);
    if (sha256Hex(asciiBytes("")) !== "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855") {
      throw new Error("SHA-256 빈 문자열 자체 검증에 실패했습니다.");
    }
    if (sha256Hex(asciiBytes("abc")) !== "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad") {
      throw new Error("SHA-256 abc 자체 검증에 실패했습니다.");
    }
    const vectors = [
      ["00000000000000000000000000000000", "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"],
      ["ffffffffffffffffffffffffffffffff", "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong"],
      ["0000000000000000000000000000000000000000000000000000000000000000", "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"]
    ];
    vectors.forEach(function (vector) {
      const result = entropyBytesToMnemonic(hexToBytes(vector[0]), wordlist);
      if (result.mnemonic !== vector[1]) throw new Error("BIP39 공식 벡터 자체 검증에 실패했습니다.");
      if (mnemonicToEntropy(result.mnemonic, wordlist).entropyHex !== vector[0]) {
        throw new Error("BIP39 역변환 자체 검증에 실패했습니다.");
      }
    });
    const variableMappingTest = variableLengthDiceRollsToBits([1, 2, 3, 4, 5, 6], 128);
    if (variableMappingTest.rawBits !== "0110110100" || variableMappingTest.complete) {
      throw new Error("한 눈 가변 비트 매핑 자체 검증에 실패했습니다.");
    }
    const variableTrimTest = variableLengthDiceRollsToBits([1, 1], 3);
    if (variableTrimTest.rawBits !== "0101" || variableTrimTest.bits !== "101" || variableTrimTest.droppedLeadingBits !== 1) {
      throw new Error("가변 비트 방식의 우측 비트 선택 자체 검증에 실패했습니다.");
    }
    const transcriptHashTest = transcriptHashToBits([6], "dice", 128);
    if (transcriptHashTest.cleanText !== "0" || bytesToHex(bitsToBytes(transcriptHashTest.bits)) !== "5feceb66ffc86f38d952786c6d696c79") {
      throw new Error("입력 기록 SHA-256 자체 검증에 실패했습니다.");
    }
    const directCapacityTest = analyzeDirectInputCapacity(new Array(65).fill(6), "dice", "dice-variable-bits-v1", 128);
    if (!directCapacityTest.complete || directCapacityTest.acceptedCount !== 64 || directCapacityTest.extraCount !== 1) {
      throw new Error("직접 입력 초과 감지 자체 검증에 실패했습니다.");
    }
    if (parsePhysicalTranscript("01 10\n01", "coin").cleanText !== "011001") {
      throw new Error("동전 입력 텍스트 파서 자체 검증에 실패했습니다.");
    }
    if (parsePhysicalTranscript("1 2 6\n3456", "dice").cleanText !== "1263456") {
      throw new Error("주사위 입력 텍스트 파서 자체 검증에 실패했습니다.");
    }
    const candidateTest = lastWordCandidates(new Array(11).fill("abandon"), 12, wordlist);
    if (candidateTest.candidateCount !== 128 || candidateTest.candidates[0].lastWord !== "about" || candidateTest.candidates[127].lastWord !== "wrap") {
      throw new Error("마지막 단어 후보 자체 검증에 실패했습니다.");
    }
    return true;
  }

  return Object.freeze({
    ALLOWED_ENTROPY_BITS: ALLOWED_ENTROPY_BITS,
    VARIABLE_LENGTH_DICE_BITS: VARIABLE_LENGTH_DICE_BITS,
    sha256: sha256,
    sha256Hex: sha256Hex,
    asciiBytes: asciiBytes,
    bytesToHex: bytesToHex,
    hexToBytes: hexToBytes,
    bytesToBits: bytesToBits,
    bitsToBytes: bitsToBytes,
    validateWordlist: validateWordlist,
    entropyBytesToMnemonic: entropyBytesToMnemonic,
    entropyBitsToMnemonic: entropyBitsToMnemonic,
    mnemonicToEntropy: mnemonicToEntropy,
    parsePhysicalTranscript: parsePhysicalTranscript,
    coinFlipsToBits: coinFlipsToBits,
    diceRollsToBits: diceRollsToBits,
    variableLengthDiceRollsToBits: variableLengthDiceRollsToBits,
    analyzeDirectInputCapacity: analyzeDirectInputCapacity,
    transcriptHashToBits: transcriptHashToBits,
    lastWordCandidates: lastWordCandidates,
    selfTest: selfTest
  });
});
