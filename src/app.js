(function () {
  "use strict";

  const WORDLIST_TEXT = __WORDLIST_JSON__;
  const WORDLIST = WORDLIST_TEXT.trim().split(/\r?\n/);
  const WORD_POSITIONS = new Map(WORDLIST.map(function (word, index) { return [word, index]; }));
  const core = globalThis.Bip39Physical;
  const WORD_TO_ENTROPY = Object.freeze({ 12: 128, 15: 160, 18: 192, 21: 224, 24: 256 });
  const HASH_MODE = "cumulative-transcript-sha256-v1";
  const VARIABLE_METHOD = "dice-variable-bits-v1";
  const PAIR_METHOD = "dice-pair-rejection-v1";

  const state = {
    events: [],
    result: null,
    process: null,
    hashInput: null,
    appliedConfig: null,
    configurationNotice: "",
    draftValid: true,
    inputError: "",
    candidateResult: null,
    activeHelpTrigger: null,
    physicalAnnouncementKey: "",
    physicalRevision: 0,
    healthy: false
  };

  const elements = {
    header: document.querySelector("header"),
    app: document.getElementById("app"),
    footer: document.querySelector("footer"),
    networkStatus: document.getElementById("network-status"),
    health: document.getElementById("health"),
    taskInputs: document.querySelectorAll("input[name='tool-task']"),
    generatorFlow: document.getElementById("generator-flow"),
    candidateFlow: document.getElementById("candidate-flow"),
    derivation: document.getElementById("derivation-mode"),
    words: document.getElementById("word-count"),
    wordCountNote: document.getElementById("word-count-note"),
    source: document.getElementById("source"),
    diceMethodWrap: document.getElementById("dice-method-wrap"),
    diceRuleGuide: document.getElementById("dice-rule-guide"),
    diceMethod: document.getElementById("dice-method"),
    conversionSettingsSummary: document.getElementById("conversion-settings-summary"),
    configurationChangeNote: document.getElementById("configuration-change-note"),
    coinControls: document.getElementById("coin-controls"),
    diceControls: document.getElementById("dice-controls"),
    method: document.getElementById("method-explanation"),
    modeSummary: document.getElementById("mode-summary"),
    progressLabel: document.getElementById("progress-label"),
    progress: document.getElementById("entropy-progress"),
    progressText: document.getElementById("progress-text"),
    inputStats: document.getElementById("input-stats"),
    pending: document.getElementById("pending-pair"),
    physicalInput: document.getElementById("physical-input"),
    physicalInputFormat: document.getElementById("physical-input-format"),
    physicalInputStatus: document.getElementById("physical-input-status"),
    sequenceGroups: document.getElementById("sequence-groups"),
    inputCount: document.getElementById("input-count"),
    convertedTitle: document.getElementById("converted-title"),
    convertedNote: document.getElementById("converted-note"),
    convertedBits: document.getElementById("converted-bits"),
    convertedCount: document.getElementById("converted-count"),
    usedBitsWrap: document.getElementById("used-bits-wrap"),
    usedBits: document.getElementById("used-bits"),
    undo: document.getElementById("undo"),
    clear: document.getElementById("clear"),
    liveGrid: document.getElementById("live-mnemonic-grid"),
    livePanel: document.getElementById("live-panel"),
    liveTitle: document.getElementById("live-title"),
    liveStatus: document.getElementById("live-status"),
    liveDescription: document.getElementById("live-description"),
    resultPanel: document.getElementById("result-panel"),
    sensitive: document.getElementById("sensitive-result"),
    cover: document.getElementById("cover"),
    resultHeading: document.getElementById("result-heading"),
    resultNotice: document.getElementById("result-notice"),
    mnemonicCopyWrap: document.getElementById("mnemonic-copy-wrap"),
    mnemonicText: document.getElementById("mnemonic-text"),
    mnemonicTextHelp: document.getElementById("mnemonic-text-help"),
    lastOrdinal: document.getElementById("last-ordinal"),
    lastWord: document.getElementById("last-word"),
    lastIndex: document.getElementById("last-index"),
    lastEntropyBits: document.getElementById("last-entropy-bits"),
    lastChecksumBits: document.getElementById("last-checksum-bits"),
    resultMethod: document.getElementById("result-method"),
    entropyBinary: document.getElementById("entropy-binary"),
    entropyHex: document.getElementById("entropy-hex"),
    checksum: document.getElementById("checksum"),
    candidateWords: document.getElementById("candidate-word-count"),
    candidatePrefixLabel: document.getElementById("candidate-prefix-label"),
    candidatePrefix: document.getElementById("candidate-prefix"),
    candidateCount: document.getElementById("candidate-input-count"),
    candidateExplanation: document.getElementById("candidate-explanation"),
    candidateStatus: document.getElementById("candidate-status"),
    candidateCalculate: document.getElementById("candidate-calculate"),
    candidateClear: document.getElementById("candidate-clear"),
    candidateResults: document.getElementById("candidate-results"),
    candidateResultTitle: document.getElementById("candidate-result-title"),
    candidateSummary: document.getElementById("candidate-summary"),
    candidateGrid: document.getElementById("candidate-grid"),
    candidateMetaToggle: document.getElementById("candidate-meta-toggle"),
    announcement: document.getElementById("announcement"),
    screenCover: document.getElementById("screen-cover"),
    emergencyCover: document.getElementById("emergency-cover"),
    uncoverScreen: document.getElementById("uncover-screen")
  };

  function updateNetworkStatus() {
    const networkState = typeof navigator.onLine === "boolean"
      ? (navigator.onLine ? "online" : "offline")
      : "checking";
    if (elements.networkStatus.dataset.state === networkState) return;
    elements.networkStatus.dataset.state = networkState;
    elements.networkStatus.className = "network-status " + networkState;
    elements.networkStatus.textContent = networkState === "online"
      ? "브라우저 보고: 온라인"
      : networkState === "offline"
        ? "브라우저 보고: 오프라인"
        : "연결 상태 확인 불가";
    elements.networkStatus.setAttribute(
      "aria-label",
      networkState === "online"
        ? "브라우저가 온라인 상태를 감지했습니다. 실제 니모닉을 입력하지 마세요."
        : networkState === "offline"
          ? "브라우저가 오프라인 상태를 감지했습니다. 물리적 네트워크 격리나 기기 안전을 보증하지 않습니다."
          : "브라우저 연결 상태를 확인할 수 없습니다."
    );
    document.documentElement.dataset.network = networkState;
  }

  function currentConfiguration() {
    return {
      source: elements.source.value,
      wordCount: Number(elements.words.value),
      derivation: elements.derivation.value,
      diceMethod: elements.diceMethod.value
    };
  }

  function selectedConfiguration() {
    return state.appliedConfig || currentConfiguration();
  }

  function snapshotConfiguration(config) {
    return Object.freeze({
      source: config.source,
      wordCount: config.wordCount,
      derivation: config.derivation,
      diceMethod: config.diceMethod
    });
  }

  function sameConfiguration(left, right) {
    return Boolean(left && right)
      && left.source === right.source
      && left.wordCount === right.wordCount
      && left.derivation === right.derivation
      && left.diceMethod === right.diceMethod;
  }

  function restoreConfigurationControls(config) {
    elements.source.value = config.source;
    elements.words.value = String(config.wordCount);
    elements.derivation.value = config.derivation;
    elements.diceMethod.value = config.diceMethod;
  }

  function configurationLabel(config) {
    const parts = [config.source === "coin" ? "동전" : "주사위", config.wordCount + "단어"];
    if (config.derivation === HASH_MODE) {
      parts.push("입력 기록 전체를 SHA-256으로 변환");
    } else if (config.source === "coin") {
      parts.push("0/1 비트를 직접 사용");
    } else if (config.diceMethod === VARIABLE_METHOD) {
      parts.push("한 눈씩 1~2비트로 변환");
    } else {
      parts.push("두 눈씩 묶어 5비트로 변환");
    }
    return parts.join(" · ");
  }

  function selectedEntropyBits() {
    return WORD_TO_ENTROPY[selectedConfiguration().wordCount];
  }

  function isHashMode() {
    return selectedConfiguration().derivation === HASH_MODE;
  }

  function selectedTask() {
    const selected = Array.from(elements.taskInputs).find(function (input) { return input.checked; });
    return selected ? selected.value : "generate";
  }

  function helpPanelFor(trigger) {
    return trigger ? document.getElementById(trigger.getAttribute("aria-controls")) : null;
  }

  function closeContextHelp(returnFocus) {
    const trigger = state.activeHelpTrigger;
    if (!trigger) return;
    const panel = helpPanelFor(trigger);
    trigger.setAttribute("aria-expanded", "false");
    if (panel) panel.hidden = true;
    state.activeHelpTrigger = null;
    if (returnFocus && document.contains(trigger)) trigger.focus({ preventScroll: true });
  }

  function toggleContextHelp(trigger) {
    const wasOpen = state.activeHelpTrigger === trigger;
    closeContextHelp(false);
    if (wasOpen) {
      trigger.focus({ preventScroll: true });
      return;
    }
    const panel = helpPanelFor(trigger);
    if (!panel) return;
    state.activeHelpTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    panel.focus({ preventScroll: true });
    const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }

  function renderTaskChoice() {
    const candidate = selectedTask() === "candidate";
    elements.taskInputs.forEach(function (input) {
      const option = input.closest(".task-option");
      if (option) option.classList.toggle("selected", input.checked);
    });
    elements.generatorFlow.hidden = candidate;
    elements.candidateFlow.hidden = !candidate;
    closeContextHelp(false);
    elements.announcement.textContent = candidate ? "마지막 단어 후보 보기 영역을 표시했습니다." : "새 복구 단어 만들기 영역을 표시했습니다.";
  }

  function selectedMethodId() {
    const config = selectedConfiguration();
    if (isHashMode()) return HASH_MODE;
    if (config.source === "coin") return "binary-msb-v1";
    return config.diceMethod;
  }

  function selectedMethodLabel() {
    const config = selectedConfiguration();
    if (isHashMode()) {
      return "전체 입력 기록 SHA-256 · " + (config.source === "dice" ? "주사위 1–5 유지, 6→0, 구분자 없음" : "동전 0/1 연결");
    }
    if (config.source === "coin") return "난수 비트 직접 사용 · 동전 0/1 · 첫 입력이 최상위 비트";
    if (config.diceMethod === VARIABLE_METHOD) return "비트 직접 사용 · 주사위 1회 가변 비트";
    return "비트 직접 사용 · 주사위 2회 묶음·거부 추출";
  }

  function expectedPairRolls(entropyBits) {
    const acceptedPairs = Math.ceil(entropyBits / 5);
    return Math.ceil(acceptedPairs * 2 * 36 / 32);
  }

  function expectedVariableRolls(entropyBits) {
    return Math.ceil(entropyBits * 3 / 5);
  }

  function groupBits(bits) {
    if (!bits) return "";
    return bits.match(/.{1,8}/g).join(" ");
  }

  function processInputs() {
    const config = selectedConfiguration();
    const target = selectedEntropyBits();
    if (config.source === "coin") return core.coinFlipsToBits(state.events, target);
    if (isHashMode() || config.diceMethod === VARIABLE_METHOD) {
      return core.variableLengthDiceRollsToBits(state.events, target);
    }
    return core.diceRollsToBits(state.events, target);
  }

  function deriveCurrentResult() {
    const config = selectedConfiguration();
    if (isHashMode()) {
      state.hashInput = core.transcriptHashToBits(state.events, config.source, selectedEntropyBits());
      return state.hashInput.available ? core.entropyBitsToMnemonic(state.hashInput.bits, WORDLIST) : null;
    }
    state.hashInput = null;
    return state.process.complete ? core.entropyBitsToMnemonic(state.process.bits, WORDLIST) : null;
  }

  function renderMethod() {
    const config = selectedConfiguration();
    const entropyBits = selectedEntropyBits();
    const wordCount = config.wordCount;
    const isCoin = config.source === "coin";
    const hash = isHashMode();

    elements.wordCountNote.hidden = wordCount === 12 || wordCount === 24;

    elements.coinControls.hidden = !isCoin;
    elements.diceControls.hidden = isCoin;
    elements.diceMethodWrap.hidden = isCoin || hash;
    elements.diceRuleGuide.hidden = isCoin || hash;
    if (elements.diceMethodWrap.hidden && state.activeHelpTrigger && elements.diceMethodWrap.contains(state.activeHelpTrigger)) {
      closeContextHelp(false);
    }
    elements.physicalInputFormat.textContent = isCoin ? "동전은 0 또는 1" : "주사위는 1부터 6";
    elements.physicalInput.placeholder = isCoin ? "0과 1을 실제로 나온 순서대로 입력" : "1부터 6을 실제로 나온 순서대로 입력";
    elements.progressLabel.textContent = hash ? "물리 난수 수집 기준" : "모인 난수 비트";
    elements.progress.setAttribute("aria-label", elements.progressLabel.textContent);
    const configurationNote = state.configurationNotice
      || (state.appliedConfig
        ? "현재 적용: " + configurationLabel(config) + " · 설정을 바꾸면 입력 기록은 유지하고 전체를 다시 계산합니다."
        : "");
    elements.configurationChangeNote.hidden = !configurationNote;
    if (elements.configurationChangeNote.textContent !== configurationNote) {
      elements.configurationChangeNote.textContent = configurationNote;
    }

    if (hash && isCoin) {
      elements.conversionSettingsSummary.textContent = "계산 규칙·재현 방법 · 동전 입력 기록 SHA-256";
      elements.modeSummary.textContent = "SHA-256은 입력을 섞을 뿐 난수를 늘리지 않습니다. 동전 " + entropyBits + "회를 채우기 전 미리보기는 사용하지 마세요.";
      elements.method.textContent = "앞면=0, 뒷면=1 기록을 구분자 없이 순서대로 연결합니다. 연결한 기록 전체를 SHA-256하고 앞 " + entropyBits + "비트를 엔트로피로 사용해 " + wordCount + "단어를 만듭니다. 해시는 입력을 섞을 뿐 물리 난수를 늘리지 않습니다.";
    } else if (hash) {
      elements.conversionSettingsSummary.textContent = "계산 규칙·재현 방법 · 주사위 입력 기록 SHA-256";
      elements.modeSummary.textContent = "SHA-256은 입력을 섞을 뿐 난수를 늘리지 않습니다. 주사위 수집 기준 전 미리보기는 사용하지 말고, 나온 모든 눈을 순서대로 입력하세요.";
      elements.method.textContent = "주사위 1~5는 같은 숫자로, 6은 0으로 바꾼 뒤 구분자 없이 연결합니다. 기록 전체를 SHA-256하고 앞 " + entropyBits + "비트를 엔트로피로 사용해 " + wordCount + "단어를 만듭니다. 아래 진행률은 보수적인 수집 기준이며, 환산 비트열 자체를 SHA-256에 넣지는 않습니다.";
    } else if (isCoin) {
      elements.conversionSettingsSummary.textContent = "계산 규칙·재현 방법 · 동전 0/1 직접 사용";
      elements.modeSummary.textContent = "동전 한 번마다 난수 비트 1개가 쌓이며 " + entropyBits + "회를 모두 입력한 뒤 복구 단어가 완성됩니다.";
      elements.method.textContent = "앞면=0, 뒷면=1로 바꿔 입력 순서대로 이어 붙이고 그 비트를 BIP39 엔트로피로 직접 사용합니다. 첫 입력이 최상위 비트이며, 목표를 모두 모은 뒤 SHA-256으로 체크섬만 계산합니다.";
    } else if (config.diceMethod === VARIABLE_METHOD) {
      elements.conversionSettingsSummary.textContent = "계산 규칙·재현 방법 · 주사위 한 눈씩 비트 변환";
      elements.modeSummary.textContent = "공정하고 독립인 주사위의 모든 눈을 순서대로 입력하세요. 한 번에 1~2비트가 쌓이고 평균 약 " + expectedVariableRolls(entropyBits) + "회가 필요하며, 마지막 앞쪽 초과 비트는 앱이 자동 제외합니다.";
      elements.method.textContent = "각 눈을 1→01, 2→10, 3→11, 4→0, 5→1, 6→00으로 바꿔 이어 붙인 비트를 BIP39 엔트로피로 직접 사용합니다. 목표를 한 비트 넘으면 맨 앞 초과 비트를 제외하고 뒤쪽 " + entropyBits + "비트를 사용합니다.";
    } else {
      elements.conversionSettingsSummary.textContent = "계산 규칙·재현 방법 · 주사위 두 눈씩 5비트 변환";
      elements.modeSummary.textContent = "공정하고 독립인 주사위의 모든 눈을 순서대로 입력하세요. 앱이 일부 쌍만 계산에서 제외하며 평균 약 " + expectedPairRolls(entropyBits) + "회가 필요합니다.";
      elements.method.textContent = "연속된 두 눈으로 v=(첫눈−1)×6+(둘째눈−1)을 계산합니다. v가 0~31이면 5비트로 쓰고, 32~35인 (6,3)~(6,6)은 그 쌍을 버립니다. 마지막에는 목표까지 필요한 앞 비트만 사용합니다.";
    }
  }

  function createSequenceCell(entry, isLatest) {
    const item = document.createElement("li");
    item.className = "sequence-cell" + (entry.className ? " " + entry.className : "");
    if (isLatest) item.setAttribute("aria-current", "true");
    const position = document.createElement("span");
    position.className = "sequence-index";
    position.textContent = entry.position;
    const value = document.createElement("strong");
    value.className = "sequence-value";
    value.textContent = entry.value;
    const mapping = document.createElement("span");
    mapping.className = "sequence-map";
    mapping.textContent = entry.mapping;
    item.append(position, value, mapping);
    return item;
  }

  function appendSequenceEntries(entries) {
    entries.forEach(function (entry, index) {
      elements.sequenceGroups.appendChild(createSequenceCell(entry, index === entries.length - 1));
    });
  }

  function captureSequenceScroll() {
    const maximum = Math.max(0, elements.sequenceGroups.scrollHeight - elements.sequenceGroups.clientHeight);
    return {
      top: elements.sequenceGroups.scrollTop,
      followLatest: maximum <= 1 || maximum - elements.sequenceGroups.scrollTop <= 24
    };
  }

  function restoreSequenceScroll(snapshot) {
    const maximum = Math.max(0, elements.sequenceGroups.scrollHeight - elements.sequenceGroups.clientHeight);
    elements.sequenceGroups.scrollTop = snapshot.followLatest ? maximum : Math.min(snapshot.top, maximum);
  }

  function renderInputSequence() {
    const config = selectedConfiguration();
    const scrollSnapshot = captureSequenceScroll();
    elements.sequenceGroups.replaceChildren();
    elements.inputCount.textContent = state.events.length + "회";
    if (state.events.length === 0) {
      const empty = document.createElement("li");
      empty.className = "sequence-empty";
      empty.textContent = "아직 입력 없음";
      elements.sequenceGroups.appendChild(empty);
      restoreSequenceScroll(scrollSnapshot);
      return;
    }

    if (config.source === "coin") {
      const entries = state.events.map(function (input, index) {
        return {
          position: String(index + 1).padStart(3, "0"),
          value: input === "0" ? "앞면 · 0" : "뒷면 · 1",
          mapping: isHashMode() ? "기록 " + input : "비트 " + input
        };
      });
      appendSequenceEntries(entries);
      restoreSequenceScroll(scrollSnapshot);
      return;
    }

    if (isHashMode() || config.diceMethod === VARIABLE_METHOD) {
      const entries = state.events.map(function (input, index) {
        const hashDigit = input === "6" ? "0" : input;
        return {
          position: String(index + 1).padStart(3, "0"),
          value: "주사위 " + input,
          mapping: isHashMode()
            ? "기록 " + hashDigit + " · 환산 " + core.VARIABLE_LENGTH_DICE_BITS[input]
            : "비트 " + core.VARIABLE_LENGTH_DICE_BITS[input]
        };
      });
      appendSequenceEntries(entries);
      restoreSequenceScroll(scrollSnapshot);
      return;
    }

    const entries = [];
    const target = selectedEntropyBits();
    let usedBitCount = 0;
    for (let index = 0; index < state.events.length; index += 2) {
      const first = Number(state.events[index]);
      const secondText = state.events[index + 1];
      const firstPosition = String(index + 1).padStart(3, "0");
      if (secondText === undefined) {
        entries.push({ position: firstPosition, value: "주사위 " + first, mapping: "다음 눈 대기", className: "pending-cell" });
        break;
      }
      const second = Number(secondText);
      const secondPosition = String(index + 2).padStart(3, "0");
      const value = (first - 1) * 6 + (second - 1);
      if (value >= 32) {
        entries.push({ position: firstPosition + "–" + secondPosition, value: first + " · " + second, mapping: "폐기", className: "rejected-cell" });
        continue;
      }
      const fiveBits = value.toString(2).padStart(5, "0");
      const needed = Math.min(5, target - usedBitCount);
      entries.push({
        position: firstPosition + "–" + secondPosition,
        value: first + " · " + second,
        mapping: "비트 " + fiveBits + (needed < 5 ? " · 앞 " + needed + "비트 사용" : "")
      });
      usedBitCount += needed;
    }
    appendSequenceEntries(entries);
    restoreSequenceScroll(scrollSnapshot);
  }

  function renderBitStreams() {
    const config = selectedConfiguration();
    const rawBits = isHashMode() && config.source === "coin"
      ? state.events.join("")
      : (typeof state.process.rawBits === "string" ? state.process.rawBits : state.process.bits);
    elements.convertedTitle.textContent = isHashMode() ? "수집 기준 계산용 비트 · BIP39 엔트로피 아님" : "BIP39 엔트로피로 쓰는 비트";
    elements.convertedCount.textContent = rawBits.length + (isHashMode() ? "비트 환산" : "비트");
    elements.convertedNote.hidden = !isHashMode();
    elements.convertedNote.textContent = isHashMode()
      ? "진행률을 계산하기 위한 환산값입니다. SHA-256에는 위의 전체 숫자 기록을 문자로 연결해 넣습니다(동전은 0/1, 주사위는 1–5 유지·6→0). 아래 비트열을 BIP39 엔트로피로 직접 쓰지 않으며, 기준을 채운 뒤 입력을 더해도 해시 결과와 복구 단어가 모두 바뀝니다."
      : "";
    elements.convertedBits.textContent = rawBits ? groupBits(rawBits) : "아직 변환된 비트 없음";
    const showUsed = !isHashMode() && selectedMethodId() === VARIABLE_METHOD && state.process.complete && state.process.droppedLeadingBits > 0;
    elements.usedBitsWrap.hidden = !showUsed;
    if (showUsed) {
      elements.usedBitsWrap.querySelector("strong").textContent = "최종 사용 엔트로피 · 앞 " + state.process.droppedLeadingBits + "비트 제외";
      elements.usedBits.textContent = groupBits(state.process.bits);
    } else {
      elements.usedBits.textContent = "";
    }
  }

  function addLiveWord(index, text, stateClass) {
    const item = document.createElement("li");
    item.className = stateClass || "";
    const number = document.createElement("span");
    number.className = "word-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const value = document.createElement("span");
    value.className = "word-value";
    value.textContent = text;
    if (WORD_POSITIONS.has(text)) value.lang = "en";
    item.append(number, value);
    elements.liveGrid.appendChild(item);
  }

  function addWaitingSummary(startIndex, endIndex) {
    const item = document.createElement("li");
    item.className = "waiting-summary";
    const range = document.createElement("span");
    range.className = "word-number";
    range.textContent = String(startIndex + 1).padStart(2, "0") + "–" + String(endIndex + 1).padStart(2, "0");
    const value = document.createElement("span");
    value.className = "word-value";
    value.textContent = "나머지 " + (endIndex - startIndex + 1) + "개 단어 대기";
    item.append(range, value);
    elements.liveGrid.appendChild(item);
  }

  function fitMnemonicText() {
    if (elements.mnemonicCopyWrap.hidden || !elements.mnemonicText.value) return;
    elements.mnemonicText.style.height = "auto";
    elements.mnemonicText.style.height = elements.mnemonicText.scrollHeight + 2 + "px";
  }

  function fitEditableTextArea(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    const contentHeight = Number(textarea.scrollHeight) || 0;
    if (!contentHeight) return;
    const maxHeight = 320;
    textarea.style.height = Math.min(contentHeight + 2, maxHeight) + "px";
    textarea.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }

  function fitCandidatePrefix() {
    fitEditableTextArea(elements.candidatePrefix);
  }

  function renderLiveWords() {
    const wordCount = selectedConfiguration().wordCount;
    const checksumBits = selectedEntropyBits() / 32;
    const finalEntropyBits = 11 - checksumBits;
    elements.liveGrid.replaceChildren();
    elements.liveStatus.className = "live-status";

    if (isHashMode() && state.result) {
      const preview = !state.process.complete;
      state.result.words.forEach(function (word, index) {
        const stateClass = preview
          ? "preview-word"
          : (index === wordCount - 1 ? "last ready-word" : "confirmed-word");
        addLiveWord(index, word, stateClass);
      });
      elements.liveTitle.textContent = preview
        ? "복구 단어 미리보기 · 사용 금지"
        : "수집 기준 충족 · 현재 입력 기록의 결과";
      elements.liveDescription.textContent = preview
        ? "입력을 추가할 때마다 전체 기록을 다시 해시해 모든 단어가 바뀝니다."
        : "최소 물리 입력 기준에 도달해 현재 기록의 복사용 전체 텍스트를 표시합니다.";
      elements.liveStatus.textContent = preview
        ? "체크섬 형식은 맞지만 필요한 물리 난수를 아직 모으지 않았습니다. SHA-256은 난수를 늘리지 않습니다."
        : "현재 입력 기록의 결과입니다. 한 번 더 입력하거나 설정을 바꾸면 모든 단어가 달라집니다.";
      elements.liveGrid.setAttribute("aria-label", preview ? "사용 금지 복구 단어 미리보기" : "수집 기준을 충족한 현재 입력 기록의 복구 단어");
      return;
    }

    const bits = state.process.bits;
    const variablePreview = selectedMethodId() === VARIABLE_METHOD && !state.process.complete;
    for (let index = 0; index < wordCount - 1; index += 1) {
      const chunk = bits.slice(index * 11, index * 11 + 11);
      if (chunk.length === 11) {
        addLiveWord(index, WORDLIST[parseInt(chunk, 2)], variablePreview ? "preview-word" : "confirmed-word");
      } else if (chunk.length > 0) {
        addLiveWord(index, chunk + "… · " + chunk.length + "/11비트", "partial-word");
        break;
      } else {
        break;
      }
    }

    const finalStart = (wordCount - 1) * 11;
    const finalChunk = bits.slice(finalStart, finalStart + finalEntropyBits);
    if (state.process.complete && state.result) {
      addLiveWord(wordCount - 1, state.result.lastWord, "last ready-word");
      elements.liveTitle.textContent = "복구 단어 완성";
      elements.liveDescription.textContent = "진행 단어를 그대로 유지하며 복사용 전체 텍스트를 표시합니다.";
      elements.liveStatus.textContent = "필요한 난수 비트와 체크섬 계산이 끝났습니다. 현재 입력과 설정으로 완전한 복구 문구가 정해졌습니다.";
      elements.liveGrid.setAttribute("aria-label", "완성된 BIP39 복구 단어");
    } else if (finalChunk.length > 0) {
      addLiveWord(wordCount - 1, finalChunk + "… · 난수 " + finalChunk.length + "/" + finalEntropyBits + "비트, 체크섬 대기", "last partial-word");
      elements.liveTitle.textContent = variablePreview ? "복구 단어 미리보기 · 사용 금지" : "복구 단어 만드는 중 · 사용 불가";
      elements.liveDescription.textContent = "11비트가 채워진 부분은 단어로, 덜 모인 부분은 비트 수로 표시합니다.";
      elements.liveStatus.textContent = variablePreview
        ? "마지막 입력에서 앞쪽 초과 비트가 자동 제외될 수 있어 지금 보이는 단어도 바뀔 수 있습니다."
        : "현재 입력에서 11비트가 채워진 부분만 단어로 보입니다. 전체 복구 문구는 아직 사용할 수 없습니다.";
      elements.liveGrid.setAttribute("aria-label", "현재 단어 진행");
    } else {
      const remainingWords = wordCount - elements.liveGrid.children.length;
      if (remainingWords > 0) {
        addWaitingSummary(elements.liveGrid.children.length, wordCount - 1);
      }
      elements.liveTitle.textContent = variablePreview ? "복구 단어 미리보기 · 사용 금지" : "복구 단어 만드는 중 · 사용 불가";
      elements.liveDescription.textContent = "11비트가 채워진 부분은 단어로, 덜 모인 부분은 비트 수로 표시합니다.";
      elements.liveStatus.textContent = variablePreview
        ? "입력은 즉시 반영되지만 완료 시 앞쪽 초과 비트가 제외될 수 있습니다. 지금 보이는 단어는 사용하지 마세요."
        : "진행 중입니다. 보이는 앞 단어가 있어도 아직 사용할 수 있는 BIP39 복구 문구가 아닙니다.";
      elements.liveGrid.setAttribute("aria-label", "현재 단어 진행");
    }
  }

  function clearSensitiveDom() {
    elements.mnemonicCopyWrap.hidden = true;
    if (elements.mnemonicText.value) {
      elements.mnemonicText.value = "0".repeat(elements.mnemonicText.value.length);
      elements.mnemonicText.value = "";
    }
    elements.mnemonicText.style.height = "";
    elements.lastWord.textContent = "";
    elements.lastIndex.textContent = "";
    elements.lastEntropyBits.textContent = "";
    elements.lastChecksumBits.textContent = "";
    elements.resultMethod.textContent = "";
    elements.entropyBinary.textContent = "";
    elements.entropyHex.textContent = "";
    elements.checksum.textContent = "";
    elements.resultPanel.querySelectorAll("details").forEach(function (details) { details.open = false; });
  }

  function renderEmptyLivePanel(title, description, status, stateClass) {
    elements.livePanel.hidden = false;
    elements.liveTitle.textContent = title;
    elements.liveDescription.textContent = description;
    elements.liveStatus.className = "live-status " + (stateClass || "empty-output");
    elements.liveStatus.textContent = status;
    elements.liveGrid.replaceChildren();
    elements.liveGrid.setAttribute("aria-label", title);
  }

  function showResult() {
    if (!state.result) return;
    const preview = isHashMode() && !state.process.complete;
    const hash = isHashMode();
    const result = state.result;
    elements.mnemonicCopyWrap.hidden = false;
    elements.mnemonicText.value = result.mnemonic;
    fitMnemonicText();
    elements.resultHeading.textContent = "마지막 단어는 체크섬만이 아닙니다 · 남은 난수 " + result.lastEntropyBits.length + "비트 + 오타 검사용 체크섬 " + result.lastChecksumBits.length + "비트";
    elements.resultNotice.hidden = !hash;
    elements.resultNotice.textContent = preview
      ? "이 문구는 형식상 유효하지만 SHA-256이 물리 엔트로피를 늘린 것은 아닙니다. 필요한 물리 입력량을 아직 모두 모으지 않았으므로 실제 지갑에 사용하지 마세요."
      : (hash ? "수집 기준을 충족한 현재 입력 기록의 결과입니다. 입력이나 설정을 더 바꾸면 모든 단어가 달라지므로 이전 복사본과 섞지 마세요." : "");
    elements.mnemonicTextHelp.textContent = hash
      ? "컴퓨터에서는 전체 선택 후 복사하고, 휴대폰에서는 길게 눌러 전체 선택하세요. 현재 입력 기록의 결과이므로 기록하기로 했다면 입력을 멈추고, 운영체제 클립보드는 사용 후 직접 지우세요."
      : "컴퓨터에서는 전체 선택 후 복사하고, 휴대폰에서는 길게 눌러 전체 선택하세요. 이 문구는 지갑을 복구하는 비밀입니다. 입력이나 설정을 바꾸면 다른 지갑이 되며, 운영체제 클립보드는 사용 후 직접 지우세요.";
    elements.lastOrdinal.textContent = result.words.length + "번째 단어";
    elements.lastWord.textContent = result.lastWord;
    elements.lastIndex.textContent = "단어 목록 번호 " + (result.lastIndex + 1) + " · 0부터 세면 " + result.lastIndex;
    elements.lastEntropyBits.textContent = result.lastEntropyBits;
    elements.lastChecksumBits.textContent = result.lastChecksumBits;
    elements.resultMethod.textContent = selectedMethodLabel();
    elements.entropyBinary.textContent = groupBits(result.entropyBits);
    elements.entropyHex.textContent = result.entropyHex.match(/.{1,8}/g).join(" ");
    elements.checksum.textContent = result.checksumBits;
    elements.sensitive.hidden = false;
  }

  function setPhysicalInputStatus(message, type) {
    state.inputError = message || "";
    elements.physicalInputStatus.hidden = !message;
    elements.physicalInputStatus.className = "physical-input-status" + (type === "warning" ? " warning-text" : "");
    elements.physicalInputStatus.textContent = message || "";
    if (message) elements.physicalInput.setAttribute("aria-invalid", "true");
    else elements.physicalInput.removeAttribute("aria-invalid");
  }

  function zeroizePhysicalData() {
    for (let index = 0; index < state.events.length; index += 1) state.events[index] = "0";
    if (state.process) {
      if (typeof state.process.bits === "string") state.process.bits = "";
      if (typeof state.process.rawBits === "string") state.process.rawBits = "";
    }
    if (state.hashInput) {
      state.hashInput.bits = "";
      state.hashInput.cleanText = "";
    }
    if (state.result) {
      state.result.entropyBits = "";
      state.result.entropyHex = "";
      state.result.combinedBits = "";
      state.result.mnemonic = "";
      state.result.words.fill("");
      state.result.indices.fill(0);
    }
    state.events.length = 0;
    state.result = null;
    state.process = null;
    state.hashInput = null;
    clearSensitiveDom();
  }

  function clearPhysicalResultDom() {
    elements.sequenceGroups.replaceChildren();
    elements.inputCount.textContent = "0회";
    elements.convertedTitle.textContent = isHashMode() ? "수집 기준 계산용 비트 · BIP39 엔트로피 아님" : "BIP39 엔트로피로 쓰는 비트";
    elements.convertedNote.textContent = "";
    elements.convertedNote.hidden = true;
    elements.convertedBits.textContent = "";
    elements.convertedCount.textContent = isHashMode() ? "0비트 환산" : "0비트";
    elements.usedBits.textContent = "";
    elements.usedBitsWrap.hidden = true;
    elements.pending.textContent = "";
    elements.pending.hidden = true;
    elements.liveGrid.replaceChildren();
    elements.resultPanel.hidden = true;
    elements.sensitive.hidden = true;
    clearSensitiveDom();
    renderEmptyLivePanel("복구 단어 결과", "입력하면 이곳에 단어 진행이 표시됩니다.", "실제 결과를 순서대로 입력하세요. 아직 사용할 수 있는 복구 문구는 없습니다.", "empty-output");
  }

  function directOverflow(events, config) {
    if (config.derivation === HASH_MODE) return null;
    const target = WORD_TO_ENTROPY[config.wordCount];
    const capacity = core.analyzeDirectInputCapacity(events, config.source, config.diceMethod, target);
    return capacity.extraCount > 0 ? capacity : null;
  }

  function renderInvalidPhysicalTool() {
    renderMethod();
    const target = selectedEntropyBits();
    elements.progress.max = target;
    elements.progress.value = 0;
    elements.progress.textContent = "0%";
    elements.progress.setAttribute("aria-valuetext", "입력 오류를 수정해야 계산할 수 있습니다.");
    elements.progressText.textContent = "입력 오류";
    elements.inputStats.textContent = "입력창의 오류를 수정하면 계산을 다시 시작합니다.";
    elements.pending.hidden = true;
    clearPhysicalResultDom();
    renderEmptyLivePanel("입력 오류 · 결과 없음", "현재 입력은 선택한 규칙으로 계산할 수 없습니다.", "오류를 수정하면 다시 계산합니다. 이전에 보인 복구 문구를 사용하지 마세요.", "error-output");
    elements.inputCount.textContent = "확인 필요";
    elements.undo.disabled = !/\S/u.test(elements.physicalInput.value);
    elements.clear.disabled = elements.physicalInput.value.length === 0;
    document.querySelectorAll("[data-input]").forEach(function (button) { button.disabled = true; });
    state.physicalAnnouncementKey = "invalid";
    elements.announcement.textContent = "";
  }

  function announcePhysicalProgress(config, current, target, complete) {
    if (current === 0) {
      state.physicalAnnouncementKey = "empty:" + configurationLabel(config);
      return;
    }
    const configKey = configurationLabel(config);
    let key;
    let message;
    if (config.derivation === HASH_MODE && complete) {
      const prefix = "hash-ready:" + configKey + ":";
      const wasAlreadyReady = state.physicalAnnouncementKey.indexOf(prefix) === 0;
      key = prefix + state.physicalRevision;
      message = wasAlreadyReady
        ? "입력 기록이 바뀌어 현재 기록의 복구 단어가 모두 다시 계산되었습니다."
        : "최소 수집 기준을 충족했습니다. 현재 입력 기록의 복사용 전체 텍스트가 표시되었습니다.";
    } else if (complete) {
      const prefix = "direct-ready:" + configKey + ":";
      const wasAlreadyReady = state.physicalAnnouncementKey.indexOf(prefix) === 0;
      key = prefix + state.physicalRevision;
      message = wasAlreadyReady
        ? "입력 기록이 바뀌어 완성된 복구 단어가 모두 다시 계산되었습니다."
        : "BIP39 복구 단어 계산이 완료되었습니다. 복사용 전체 텍스트가 표시되었습니다.";
    } else {
      const bucket = Math.floor(current / 11);
      key = (config.derivation === HASH_MODE ? "hash-progress:" : "direct-progress:") + configKey + ":" + bucket;
      message = config.derivation === HASH_MODE
        ? "물리 입력 수집 기준 " + current + " / " + target + " 비트. 미리보기는 아직 사용하면 안 됩니다."
        : "모인 난수 비트 " + current + " / " + target + " 비트. 아직 사용할 수 있는 복구 문구가 아닙니다.";
    }
    if (state.physicalAnnouncementKey === key) return;
    state.physicalAnnouncementKey = key;
    elements.announcement.textContent = message;
  }

  function hashExtraInputCount(config, target) {
    if (config.derivation !== HASH_MODE || !state.process || !state.process.complete) return 0;
    if (config.source === "coin") return Math.max(0, state.events.length - target);
    return core.analyzeDirectInputCapacity(state.events, "dice", VARIABLE_METHOD, target).extraCount;
  }

  function hasCopyablePhysicalResult(config) {
    return state.draftValid
      && Boolean(state.result)
      && Boolean(state.process)
      && (config.derivation !== HASH_MODE || state.process.complete);
  }

  function renderPhysicalTool() {
    if (!state.draftValid) {
      renderInvalidPhysicalTool();
      return;
    }
    const config = selectedConfiguration();
    renderMethod();
    state.process = processInputs();
    state.result = deriveCurrentResult();
    const target = selectedEntropyBits();
    const current = state.process.bits.length;
    const remaining = Math.max(0, target - current);
    const complete = state.process.complete;
    const hashExtraInputs = hashExtraInputCount(config, target);

    elements.progress.max = target;
    elements.progress.value = current;
    elements.progress.textContent = Math.round((current / target) * 100) + "%";
    if (isHashMode() && complete) {
      const extraText = hashExtraInputs > 0 ? " · 기준 이후 " + hashExtraInputs + "회도 포함" : "";
      elements.progress.setAttribute("aria-valuetext", "수집 기준 충족" + extraText);
      elements.progressText.textContent = "기준 충족 · " + target + " / " + target + "비트" + extraText;
    } else {
      elements.progress.setAttribute("aria-valuetext", current + " / " + target + " 비트");
      elements.progressText.textContent = current + " / " + target + " 비트";
    }
    renderInputSequence();
    renderBitStreams();
    if (state.events.length > 0) {
      elements.livePanel.hidden = false;
      renderLiveWords();
    } else {
      renderEmptyLivePanel("복구 단어 결과", "입력하면 이곳에 단어 진행이 표시됩니다.", "실제 결과를 순서대로 입력하세요. 아직 사용할 수 있는 복구 문구는 없습니다.", "empty-output");
    }
    elements.undo.disabled = !/\S/u.test(elements.physicalInput.value);
    elements.clear.disabled = elements.physicalInput.value.length === 0;

    if (config.source === "coin") {
      elements.inputStats.textContent = "";
      elements.pending.hidden = true;
    } else if (isHashMode()) {
      elements.inputStats.textContent = "";
      elements.pending.hidden = true;
    } else if (config.diceMethod === VARIABLE_METHOD) {
      const dropped = !isHashMode() && state.process.droppedLeadingBits > 0 ? " · 앞에서 제외된 비트 " + state.process.droppedLeadingBits : "";
      elements.inputStats.textContent = "주사위 입력 " + state.process.consumedRolls + "회" + dropped;
      elements.pending.hidden = true;
    } else {
      elements.inputStats.textContent = "주사위 입력 " + state.process.consumedRolls + "회 · 유효 쌍 " + state.process.acceptedPairs + " · 폐기 쌍 " + state.process.rejectedPairs + " · 남은 수집량 " + remaining + "비트" + (state.process.rejectedPairs ? " · 폐기 쌍은 기록에 남고 계산에서만 제외" : "");
      elements.pending.hidden = state.process.pendingRoll === null;
      elements.pending.textContent = state.process.pendingRoll === null ? "" : "첫 번째 눈 " + state.process.pendingRoll + "이 다음 눈을 기다립니다. 삭제하거나 다시 굴리지 마세요.";
    }

    document.querySelectorAll("[data-input]").forEach(function (button) {
      button.disabled = (!isHashMode() && complete) || !state.healthy;
    });

    const resultReadyForCopy = Boolean(state.result) && (!isHashMode() || complete);
    if (resultReadyForCopy) {
      elements.resultPanel.hidden = false;
      showResult();
    } else {
      elements.resultPanel.hidden = true;
      elements.sensitive.hidden = true;
      clearSensitiveDom();
    }
    announcePhysicalProgress(config, current, target, complete);
  }

  function applyPhysicalTranscript() {
    if (!state.healthy) return;
    state.configurationNotice = "";
    const rawText = elements.physicalInput.value;
    if (!state.appliedConfig && /\S/u.test(rawText)) {
      state.appliedConfig = snapshotConfiguration(currentConfiguration());
    }
    const config = selectedConfiguration();
    let parsed;
    try {
      parsed = core.parsePhysicalTranscript(rawText, config.source);
      if (parsed.events.length > 4096) throw new Error("입력은 최대 4,096회까지 처리할 수 있습니다.");
      const overflow = directOverflow(parsed.events, config);
      if (overflow) {
        throw new Error("필요한 난수를 모두 모은 뒤 " + overflow.extraCount + "회가 더 입력되었습니다. 뒤의 숫자 " + overflow.extraCount + "개를 삭제하세요.");
      }
    } catch (error) {
      zeroizePhysicalData();
      state.draftValid = false;
      setPhysicalInputStatus(error.message, "error");
      renderInvalidPhysicalTool();
      return;
    }

    zeroizePhysicalData();
    Array.prototype.push.apply(state.events, parsed.events);
    state.physicalRevision += 1;
    state.draftValid = true;
    setPhysicalInputStatus("", "");
    if (parsed.events.length === 0) {
      state.appliedConfig = null;
      state.configurationNotice = "";
    }
    renderPhysicalTool();
  }

  function handleConfigurationChange() {
    const nextConfig = currentConfiguration();
    const previousConfig = state.appliedConfig;
    const hasInput = /\S/u.test(elements.physicalInput.value);

    if (!hasInput) {
      state.appliedConfig = null;
      state.configurationNotice = "";
      renderPhysicalTool();
      return;
    }

    if (!previousConfig) {
      state.appliedConfig = snapshotConfiguration(nextConfig);
      applyPhysicalTranscript();
      return;
    }

    if (sameConfiguration(previousConfig, nextConfig)) {
      renderMethod();
      return;
    }

    const hadCopyableResult = hasCopyablePhysicalResult(previousConfig);

    if (hadCopyableResult) {
      const confirmed = window.confirm(
        "복사용 결과가 바뀝니다.\n\n"
        + "현재: " + configurationLabel(previousConfig) + "\n"
        + "변경: " + configurationLabel(nextConfig) + "\n\n"
        + "입력 기록은 지우지 않고 새 규칙으로 다시 계산합니다. 변경 전후 결과는 서로 다른 지갑입니다. 계속할까요?"
      );

      if (!confirmed) {
        restoreConfigurationControls(previousConfig);
        state.configurationNotice = "변경을 취소했습니다. 현재 결과에 계속 적용: " + configurationLabel(previousConfig) + ".";
        renderMethod();
        elements.announcement.textContent = "설정 변경을 취소했습니다.";
        return;
      }
    }

    const nextLabel = configurationLabel(nextConfig);
    state.appliedConfig = snapshotConfiguration(nextConfig);
    state.configurationNotice = "";
    applyPhysicalTranscript();
    if (state.draftValid) {
      const nowCopyableResult = hasCopyablePhysicalResult(nextConfig);
      if (!hadCopyableResult && nowCopyableResult) {
        state.configurationNotice = "설정 변경 · 입력 기록을 ‘" + nextLabel + "’ 규칙으로 다시 계산한 결과 복구 단어가 완성되어 복사용 텍스트를 표시했습니다.";
        elements.announcement.textContent = "설정 변경 후 복구 단어가 완성되어 복사용 전체 텍스트를 표시했습니다.";
      } else if (hadCopyableResult && !nowCopyableResult) {
        state.configurationNotice = "설정 변경 완료 · 새 설정에서는 수집량이 부족해 복사용 결과를 숨겼습니다. 계속 입력하세요. 이전 복구 단어와 섞지 마세요.";
        elements.announcement.textContent = "설정 변경 후 수집량이 부족해 복사용 결과를 숨겼습니다. 계속 입력하세요.";
      } else if (hadCopyableResult) {
        state.configurationNotice = "설정 변경 완료 · 입력 기록은 유지하고 ‘" + nextLabel + "’ 규칙으로 다시 계산했습니다. 이전 복구 단어와 섞지 마세요.";
        elements.announcement.textContent = "설정 변경 완료. 이전 복구 단어와 섞지 마세요.";
      } else {
        state.configurationNotice = "설정 변경 · 입력 기록은 유지하고 ‘" + nextLabel + "’ 규칙으로 전체를 다시 계산했습니다.";
        elements.announcement.textContent = "설정을 변경하고 기존 입력 기록 전체를 새 규칙으로 다시 계산했습니다.";
      }
    } else {
      state.configurationNotice = "설정은 변경했지만 현재 입력이 새 규칙과 맞지 않아 결과를 숨겼습니다. 현재 적용: " + nextLabel + ". 입력을 수정하거나 설정을 다시 변경하세요.";
      elements.announcement.textContent = "설정은 변경했지만 현재 입력이 새 규칙과 맞지 않아 결과를 숨겼습니다.";
    }
    renderMethod();
  }

  function addInput(value) {
    if (!state.healthy || !state.draftValid || (!isHashMode() && state.process && state.process.complete)) return;
    elements.physicalInput.value += String(value);
    applyPhysicalTranscript();
  }

  function undoInput() {
    const characters = Array.from(elements.physicalInput.value);
    let index = characters.length - 1;
    while (index >= 0 && /\s/u.test(characters[index])) index -= 1;
    if (index < 0) return;
    characters.splice(index, 1);
    elements.physicalInput.value = characters.join("");
    applyPhysicalTranscript();
  }

  function bindPhysicalInputElement() {
    elements.physicalInput.addEventListener("input", applyPhysicalTranscript);
  }

  function replacePhysicalInputWithEmpty() {
    const previous = elements.physicalInput;
    if (previous.value) {
      previous.value = "0".repeat(previous.value.length);
      previous.value = "";
    }
    const replacement = previous.cloneNode(false);
    replacement.value = "";
    replacement.style.height = "";
    replacement.style.overflowY = "";
    replacement.removeAttribute("aria-invalid");
    previous.replaceWith(replacement);
    elements.physicalInput = replacement;
    bindPhysicalInputElement();
  }

  function zeroizePhysicalState() {
    zeroizePhysicalData();
    state.physicalRevision = 0;
    replacePhysicalInputWithEmpty();
    state.appliedConfig = null;
    state.configurationNotice = "";
    state.draftValid = true;
    setPhysicalInputStatus("", "");
    clearPhysicalResultDom();
    if (state.healthy) renderPhysicalTool();
  }

  function clearPhysical(ask) {
    if (ask && elements.physicalInput.value.length > 0 && !window.confirm("모든 물리 입력과 계산 결과를 지울까요? 이 작업은 되돌릴 수 없습니다.")) return;
    closeContextHelp(false);
    zeroizePhysicalState();
    elements.announcement.textContent = "물리 입력과 계산 결과를 지웠습니다.";
    elements.physicalInput.focus();
  }

  function candidateFullWordCount() {
    return Number(elements.candidateWords.value);
  }

  function candidateRequiredPrefixCount() {
    return candidateFullWordCount() - 1;
  }

  function candidateInputWords() {
    const value = elements.candidatePrefix.value.trim();
    return value ? value.split(/\s+/) : [];
  }

  function clearCandidateResult() {
    if (state.candidateResult) {
      state.candidateResult.candidates.forEach(function (candidate) {
        candidate.missingEntropyBits = "";
        candidate.checksumBits = "";
        candidate.lastBits = "";
        candidate.lastWord = "";
      });
      state.candidateResult.candidates.length = 0;
    }
    state.candidateResult = null;
    elements.candidateGrid.replaceChildren();
    elements.candidateSummary.textContent = "";
    elements.candidateResults.hidden = true;
  }

  function validateCandidateWords(words) {
    const required = candidateRequiredPrefixCount();
    for (let index = 0; index < words.length; index += 1) {
      if (!WORD_POSITIONS.has(words[index])) {
        return { valid: false, error: (index + 1) + "번째 단어 ‘" + words[index] + "’는 BIP39 영문 목록에 없습니다." };
      }
    }
    if (words.length !== required) {
      return { valid: false, error: required + "개가 필요합니다. 현재 " + words.length + "개입니다." };
    }
    return { valid: true, error: "" };
  }

  function renderCandidateGuidance() {
    const full = candidateFullWordCount();
    const required = full - 1;
    const entropy = WORD_TO_ENTROPY[full];
    const checksum = entropy / 32;
    const missing = entropy - required * 11;
    const words = candidateInputWords();
    elements.candidatePrefixLabel.textContent = "앞 " + required + "단어";
    elements.candidatePrefix.placeholder = "BIP39 영문 단어 " + required + "개를 공백으로 구분해 입력";
    elements.candidateCount.textContent = words.length + " / " + required + "단어";
    elements.candidateExplanation.textContent = "앞 " + required + "단어를 고정하면 가능한 마지막 단어는 " + (2 ** missing) + "개입니다. 모르는 난수 " + missing + "비트마다 체크섬 " + checksum + "비트가 자동 계산됩니다.";
    elements.candidateClear.disabled = elements.candidatePrefix.value.length === 0 && !state.candidateResult;
    fitCandidatePrefix();
    return { words: words, validation: validateCandidateWords(words) };
  }

  function invalidateCandidateOnEdit() {
    clearCandidateResult();
    elements.announcement.textContent = "";
    const input = renderCandidateGuidance();
    const required = candidateRequiredPrefixCount();
    elements.candidateStatus.className = "candidate-status";
    if (input.words.length === 0) {
      elements.candidateStatus.textContent = "앞 단어를 입력한 뒤 가능한 후보 계산을 누르세요.";
    } else if (input.words.length !== required) {
      elements.candidateStatus.textContent = required + "개가 필요합니다. 현재 " + input.words.length + "개입니다.";
    } else {
      elements.candidateStatus.textContent = "단어 수가 맞습니다. 가능한 후보 계산을 눌러 BIP39 형식상 가능한 목록을 만드세요.";
    }
  }

  function renderCandidateGrid(result) {
    elements.candidateGrid.replaceChildren();
    result.candidates.forEach(function (candidate, index) {
      const item = document.createElement("li");
      const number = document.createElement("span");
      number.className = "candidate-number";
      number.textContent = String(index + 1).padStart(3, "0");
      const word = document.createElement("strong");
      word.className = "candidate-word";
      word.textContent = candidate.lastWord;
      word.lang = "en";
      const meta = document.createElement("span");
      meta.className = "candidate-meta";
      meta.textContent = "난수 " + candidate.missingEntropyBits + " · 체크섬 " + candidate.checksumBits + " · 목록 " + candidate.listNumber + " (0부터 " + candidate.lastIndex + ")";
      item.append(number, word, meta);
      elements.candidateGrid.appendChild(item);
    });
  }

  function calculateCandidates() {
    if (!state.healthy) return;
    clearCandidateResult();
    const input = renderCandidateGuidance();
    if (!input.validation.valid) {
      elements.candidateStatus.className = "candidate-status error-text";
      elements.candidateStatus.textContent = input.validation.error;
      elements.announcement.textContent = input.validation.error;
      elements.candidatePrefix.focus();
      return;
    }
    try {
      state.candidateResult = core.lastWordCandidates(input.words, candidateFullWordCount(), WORDLIST);
      const result = state.candidateResult;
      renderCandidateGrid(result);
      elements.candidateResultTitle.textContent = "BIP39 형식상 가능한 후보 " + result.candidateCount + "개";
      elements.candidateSummary.textContent = "원래 단어 확인 결과가 아닙니다. 알려진 주소·거래 기록으로만 확인하고, 새 지갑 생성에는 이 후보를 고르지 마세요.";
      elements.candidateResults.hidden = false;
      elements.candidateStatus.className = "candidate-status ok-text";
      elements.candidateStatus.textContent = result.candidateCount + "개 후보 계산 완료";
      elements.candidateClear.disabled = false;
      elements.candidateResultTitle.focus({ preventScroll: true });
      const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      elements.candidateResults.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      elements.announcement.textContent = "마지막 단어 후보 " + result.candidateCount + "개 계산 완료";
    } catch (error) {
      elements.candidateStatus.className = "candidate-status error-text";
      elements.candidateStatus.textContent = "후보 계산 실패: " + error.message;
    }
  }

  function zeroizeCandidateState() {
    clearCandidateResult();
    elements.announcement.textContent = "";
    const previous = elements.candidatePrefix;
    if (previous.value) {
      previous.value = "0".repeat(previous.value.length);
      previous.value = "";
    }
    const replacement = previous.cloneNode(false);
    replacement.value = "";
    replacement.style.height = "";
    replacement.style.overflowY = "";
    previous.replaceWith(replacement);
    elements.candidatePrefix = replacement;
    bindCandidatePrefixElement();
    renderCandidateGuidance();
    elements.candidateStatus.className = "candidate-status";
    elements.candidateStatus.textContent = "앞 단어를 입력한 뒤 가능한 후보 계산을 누르세요.";
  }

  function clearCandidates() {
    closeContextHelp(false);
    zeroizeCandidateState();
    elements.announcement.textContent = "후보 입력과 계산 결과를 지웠습니다.";
    elements.candidatePrefix.focus();
  }

  function bindCandidatePrefixElement() {
    elements.candidatePrefix.addEventListener("input", invalidateCandidateOnEdit);
  }

  function hasSensitiveData() {
    return elements.physicalInput.value.trim().length > 0 || elements.candidatePrefix.value.trim().length > 0 || Boolean(state.candidateResult);
  }

  function coverScreen() {
    closeContextHelp(false);
    [elements.header, elements.app, elements.footer].forEach(function (element) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    elements.screenCover.hidden = false;
    elements.screenCover.setAttribute("aria-hidden", "false");
    if (!document.hidden) elements.uncoverScreen.focus();
  }

  function uncoverScreen() {
    elements.screenCover.hidden = true;
    elements.screenCover.setAttribute("aria-hidden", "true");
    elements.header.inert = false;
    elements.header.removeAttribute("aria-hidden");
    elements.footer.inert = false;
    elements.footer.removeAttribute("aria-hidden");
    elements.app.inert = !state.healthy;
    elements.app.removeAttribute("aria-hidden");
    if (state.healthy) elements.app.removeAttribute("aria-disabled");
    else elements.app.setAttribute("aria-disabled", "true");
    elements.emergencyCover.focus();
  }

  document.querySelectorAll("[data-input]").forEach(function (button) {
    button.addEventListener("click", function () { addInput(button.dataset.input); });
  });
  elements.taskInputs.forEach(function (input) {
    input.addEventListener("change", renderTaskChoice);
  });
  elements.derivation.addEventListener("change", handleConfigurationChange);
  elements.words.addEventListener("change", handleConfigurationChange);
  elements.source.addEventListener("change", handleConfigurationChange);
  elements.diceMethod.addEventListener("change", handleConfigurationChange);
  bindPhysicalInputElement();
  elements.undo.addEventListener("click", undoInput);
  elements.clear.addEventListener("click", function () { clearPhysical(true); });
  elements.cover.addEventListener("click", coverScreen);
  elements.emergencyCover.addEventListener("click", coverScreen);
  elements.uncoverScreen.addEventListener("click", uncoverScreen);
  elements.candidateWords.addEventListener("change", invalidateCandidateOnEdit);
  elements.candidateMetaToggle.addEventListener("change", function () {
    elements.candidateFlow.classList.toggle("show-candidate-meta", elements.candidateMetaToggle.checked);
  });
  elements.candidateFlow.classList.toggle("show-candidate-meta", elements.candidateMetaToggle.checked);
  bindCandidatePrefixElement();
  elements.candidateCalculate.addEventListener("click", calculateCandidates);
  elements.candidateClear.addEventListener("click", clearCandidates);
  document.querySelectorAll("[data-help-trigger]").forEach(function (trigger) {
    trigger.addEventListener("click", function () { toggleContextHelp(trigger); });
  });
  document.querySelectorAll("[data-help-close]").forEach(function (button) {
    button.addEventListener("click", function () { closeContextHelp(true); });
  });
  document.addEventListener("click", function (event) {
    if (!state.activeHelpTrigger) return;
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("[data-help-trigger]") || event.target.closest(".inline-help")) return;
    closeContextHelp(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state.activeHelpTrigger) {
      event.preventDefault();
      closeContextHelp(true);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.ctrlKey || event.altKey || event.metaKey || event.repeat || elements.screenCover.hidden === false) return;
    if (elements.generatorFlow.hidden) return;
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target.isContentEditable) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      undoInput();
      return;
    }
    const config = selectedConfiguration();
    if (config.source === "coin" && (event.key === "0" || event.key === "1")) {
      event.preventDefault();
      addInput(event.key);
    } else if (config.source === "dice" && /^[1-6]$/.test(event.key)) {
      event.preventDefault();
      addInput(event.key);
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && hasSensitiveData()) coverScreen();
    else if (!document.hidden) updateNetworkStatus();
  });
  window.addEventListener("pagehide", function () {
    closeContextHelp(false);
    zeroizePhysicalData();
    state.physicalAnnouncementKey = "";
    state.physicalRevision = 0;
    replacePhysicalInputWithEmpty();
    state.appliedConfig = null;
    state.configurationNotice = "";
    state.draftValid = true;
    setPhysicalInputStatus("", "");
    clearPhysicalResultDom();
    zeroizeCandidateState();
  });
  window.addEventListener("pageshow", function () {
    updateNetworkStatus();
    if (!state.healthy) return;
    state.appliedConfig = null;
    state.configurationNotice = "";
    applyPhysicalTranscript();
  });
  window.addEventListener("beforeprint", coverScreen);
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  window.addEventListener("resize", function () {
    fitMnemonicText();
    fitCandidatePrefix();
  });

  updateNetworkStatus();
  try {
    core.selfTest(WORDLIST);
    state.healthy = true;
    elements.health.className = "health ok";
    elements.health.textContent = "도구 자체검사 통과";
    elements.health.setAttribute("aria-label", "도구 자체검사 통과. BIP39 목록과 공식 계산 예가 일치합니다.");
  } catch (error) {
    state.healthy = false;
    elements.health.className = "health fail";
    elements.health.textContent = "자체 검증 실패 · 사용 중지: " + error.message;
    elements.app.classList.add("disabled");
    elements.app.inert = true;
    elements.app.setAttribute("aria-disabled", "true");
    zeroizePhysicalState();
    zeroizeCandidateState();
  }
  renderTaskChoice();
  renderCandidateGuidance();
  invalidateCandidateOnEdit();
  if (state.healthy) applyPhysicalTranscript();
})();
