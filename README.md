# 동전·주사위로 BIP39 니모닉 만들기

동전·주사위 결과를 직접 입력해 BIP39 영문 니모닉을 만들거나, 이미 알고 있는 앞 단어로 마지막 단어 후보를 확인하는 단일 HTML 도구입니다.

## 먼저 읽어 주세요

실제 자금에는 검증된 하드웨어 지갑의 내장 생성기를 우선 권장합니다. 이 도구를 사용한다면 평소 쓰는 온라인 PC가 아니라, 깨끗하게 준비하고 작업 뒤에도 다시 온라인에 연결하지 않을 전용 기기에서 실행하세요.

로컬 HTML이라고 실행 환경까지 안전해지는 것은 아닙니다. 감염된 운영체제, 브라우저 확장, 키로거, 화면 녹화와 사용자가 만든 클립보드 사본은 입력과 결과를 유출할 수 있습니다. 상단의 온라인·오프라인 표시는 브라우저가 제공하는 신호일 뿐 물리적 격리나 기기 안전을 증명하지 않습니다.

## 주요 기능

- 동전 `0/1` 또는 육면체 주사위 `1–6` 전체 기록 입력
- 모은 난수 비트를 BIP39에 직접 사용하는 방식
- 전체 입력 기록을 SHA-256으로 변환하는 방식
- 주사위 한 눈씩 변환 또는 두 눈씩 묶는 변환
- 입력할 때마다 단어 진행과 계산 반영 결과 표시
- 12·15·18·21·24단어 BIP39 영문 니모닉 지원
- 앞 11·14·17·20·23단어로 가능한 마지막 단어 후보 열거
- 입력 기록, 최종 엔트로피, 체크섬과 마지막 단어 구성 확인

마지막 단어 후보 기능은 원래 단어 하나를 찾아내지 않습니다. 표시되는 후보마다 서로 다른 지갑이며, 복구할 때는 알려진 주소나 거래 기록 같은 별도 증거로 확인해야 합니다.

## 실행

1. [`dist/coin-dice-bip39.html`](dist/coin-dice-bip39.html)을 내려받습니다.
2. 가능하면 다른 신뢰 경로에 게시된 SHA-256과 비교합니다.
3. 네트워크를 물리적으로 분리한 전용 기기로 파일을 옮깁니다.
4. JavaScript를 실행할 수 있는 브라우저에서 HTML 파일을 엽니다.

BOOX Palma 실기기에서는 HTML 뷰어와 NeoReader는 계산 기능이 동작하지 않았고, NeoBrowser와 Chrome은 오프라인에서 동작했습니다. 자세한 조건은 [`docs/PALMA-COMPATIBILITY.md`](docs/PALMA-COMPATIBILITY.md)에 기록했습니다.

## SHA-256 확인

Windows PowerShell:

```powershell
Get-FileHash .\coin-dice-bip39.html -Algorithm SHA256
```

macOS:

```sh
shasum -a 256 coin-dice-bip39.html
```

Linux:

```sh
sha256sum coin-dice-bip39.html
```

해시 일치는 확인한 파일이 기준 파일과 바이트 단위로 같다는 뜻입니다. 코드의 안전성, 파일 출처, 기기 무결성이나 입력 난수의 품질을 보증하지는 않습니다.

## 소스에서 다시 만들기

Node.js만 필요하며 외부 패키지를 설치하지 않습니다.

```sh
npm run verify
```

명령이 성공하면 `dist/coin-dice-bip39.html`과 `dist/SHA256SUMS.txt`가 생성됩니다.

## 계산 근거

- [BIP-39 규격](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP-39 공식 영문 단어 목록](https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt)
- [Trezor python-mnemonic 테스트 벡터](https://github.com/trezor/python-mnemonic/blob/master/vectors.json)

BIP-39는 최종 엔트로피에서 체크섬과 단어를 만드는 과정을 정의합니다. 동전·주사위 기록을 엔트로피로 바꾸는 규칙은 이 도구가 명시적으로 제공하는 변환 방식이므로, 외부 도구와 비교할 때는 입력 순서·단어 수·변환 방식까지 모두 맞춰야 합니다.

## 개인정보와 통신 경계

배포 HTML에는 외부 스크립트, 분석 코드, 광고, 브라우저 저장소, 네트워크 요청과 자동 클립보드 API가 없습니다. CSP의 `connect-src 'none'`으로 연결도 차단합니다. 다만 브라우저와 운영체제 자체의 안전은 이 파일이 통제할 수 없습니다.

실제 니모닉이나 후보 단어를 GitHub Issue, 화면 캡처, 로그 또는 오류 보고에 첨부하지 마세요.
