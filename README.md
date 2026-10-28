# website2 — 날씨나무

지역의 실시간 날씨와 현지 일출·일몰에 따라 변하는 3D 나무 풍경입니다.

[웹사이트 열기](https://garykwon.github.io/website2/)

- Open-Meteo 날씨·지역 검색, 내 위치 조회
- 계절별 잎 색과 밀도, 바람·비·눈 표현
- 눈이 내릴 때 쌓이는 눈둔덕, 비가 내릴 때 커지는 물웅덩이와 파문
- 실제 눈·진흙 PBR 텍스처와 사실적인 구름 이미지
- 현지 시간에 따른 태양·달 이동과 배경 그라데이션
- 마우스·터치 드래그 또는 방향키로 나무 360도 회전
- 반응형 글래스 UI

HTML, CSS, JavaScript로 구성된 정적 사이트이며 빌드나 API 키가 필요하지 않습니다.

## 로컬 실행

```sh
python3 -m http.server 4173
```

`http://localhost:4173/`을 엽니다. 모델을 불러오려면 파일을 직접 여는 대신 HTTP 서버를 사용해야 합니다.

## GitHub Pages

저장소 **Settings → Pages → Deploy from a branch → main / (root)**에서 게시할 수 있습니다.

## 에셋과 출처

- [Realistic Tree](https://sketchfab.com/3d-models/realistic-tree-d989c0f801d847b9a74992ec4ddcfdfc) — [Daniel](https://sketchfab.com/danielpetrov), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). 원본 메시를 유지하고 PBR 재질·텍스처를 웹용으로 최적화했으며 계절·바람 표현을 적용했습니다. 자세한 내용은 [에셋 라이선스](assets/realistic-tree.LICENSE.txt)를 참고하세요.
- Three.js r160 — MIT, [라이선스](vendor/THREE-LICENSE.txt)
- 날씨: [Open-Meteo](https://open-meteo.com/), 지역: [GeoNames](https://www.geonames.org/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

눈과 물은 현재 날씨에 맞춰 짧은 시간 동안 시각적으로 축적됩니다. 실제 적설량이나 토양 수분을 측정한 값은 아닙니다. 맑아지면 서서히 녹거나 마르고, 지역을 바꾸면 초기화됩니다.

- 지면: Poly Haven의 Snow 02 · Brown Mud 03 (Rob Tuytel, CC0), Three.js waternormals (MIT). [지면 에셋 출처](assets/ground-weather.LICENSE.txt)
- 구름: 이 프로젝트를 위해 생성한 투명 이미지. [생성 출처와 프롬프트](assets/weather-cloud.LICENSE.txt)

텍스처와 메시를 날씨 변경마다 재생성하지 않으며, 숨긴 탭의 렌더링과 파티클 업데이트를 멈춥니다.
