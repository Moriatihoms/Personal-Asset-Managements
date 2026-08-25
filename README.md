# Personal Asset Managements

대학생이 소액·분산·장기 투자 습관을 기록하고 관리할 수 있는 개인 투자 포트폴리오 웹앱입니다.

## 주요 기능

- 대시보드 KPI와 현재 자산배분
- 자산군·목표 비중·월 투자금 관리
- 투자 기록 추가·수정·삭제
- ETF 후보 비교 및 편집
- 목표 비중 대비 리밸런싱 점검
- 투자 목표, 복리 계산, 투자 원칙
- JSON 백업·복원과 CSV 내보내기
- 브라우저 자동 저장, 다크 모드, 모바일 UI

## GitHub Pages

`main` 브랜치가 변경되면 GitHub Actions가 정적 앱을 빌드해 GitHub Pages로 배포합니다.

예상 주소: <https://moriatihoms.github.io/Personal-Asset-Managements/>

## 로컬 실행

```bash
npm install
npm run dev
```

프로덕션 빌드:

```bash
npm run build
```

## 데이터 저장

투자 데이터는 현재 브라우저의 LocalStorage에 저장됩니다. PC와 휴대전화 데이터는 자동 동기화되지 않으므로, 기기를 변경하기 전에 JSON 백업을 내려받아 새 기기에서 복원하세요.

## 주의사항

이 앱은 개인 투자 기록과 금융 학습을 위한 도구입니다. 특정 상품의 매수·매도 추천, 자동매매, 미래가격 예측 또는 수익 보장을 제공하지 않습니다.
