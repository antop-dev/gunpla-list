# GTM 설정 가이드 — 건담 목록

GTM 컨테이너에 등록해야 하는 **변수 → 트리거 → 태그** 순서로 기술합니다.  
모든 태그는 **GA4 이벤트** 유형 기준입니다.  
어드민 화면(`/admin/**`)은 GTM 스크립트를 넣지 않으므로 태깅 대상이 아닙니다.

---

## 1. 내장 변수 활성화

`변수` → `내장 변수` → `구성` 에서 아래 항목을 체크합니다.

| 변수명 | 용도 |
|---|---|
| Click Classes | 배경(backdrop)·오버레이처럼 클릭한 요소 자체를 봐야 하는 트리거 |
| Click Element | CSS 선택자 트리거, data-gtm-* 속성 읽기 JS 변수 |
| Click Text | 버튼·링크 텍스트 수집 |
| Click URL | 외부 링크 URL 수집 |
| Page Path | 같은 클래스가 여러 페이지에 있을 때 페이지 구분 |

---

## 2. 사용자 정의 변수

### 2-1. data-gtm-* 속성 읽기 — 맞춤 JavaScript

AG Grid 셀·아이콘 버튼은 중첩 DOM이라 클릭한 요소가 `<i>` 아이콘일 수 있습니다.  
클릭한 요소에서 위로 올라가며 속성을 찾는 아래 템플릿으로 변수를 만듭니다.

> `변수` → `새로 만들기` → **맞춤 JavaScript**

```javascript
function() {
  var el = {{Click Element}};
  while (el) {
    if (el.dataset && el.dataset.gtmProductId !== undefined) {
      return el.dataset.gtmProductId;
    }
    el = el.parentElement;
  }
  return undefined;
}
```

템플릿의 `gtmProductId` 부분만 아래 표의 dataset 키로 바꿔 각각 만듭니다.

| 변수명 | dataset 키 | HTML 속성 | 값 |
|---|---|---|---|
| `var_gtm_product_id` | `gtmProductId` | `data-gtm-product-id` | 제품 ID |
| `var_gtm_product_name` | `gtmProductName` | `data-gtm-product-name` | 제품명 |
| `var_gtm_grade` | `gtmGrade` | `data-gtm-grade` | 등급 (빈 값이면 `'전체'` 로 반환하도록 `|| '전체'` 추가) |
| `var_gtm_owned` | `gtmOwned` | `data-gtm-owned` | 클릭 전 보유 여부 `true`/`false` |
| `var_gtm_assembled` | `gtmAssembled` | `data-gtm-assembled` | 클릭 전 조립 여부 |
| `var_gtm_decal_attached` | `gtmDecalAttached` | `data-gtm-decal-attached` | 클릭 전 데칼 부착 여부 |
| `var_gtm_alert` | `gtmAlert` | `data-gtm-alert` | 판매제품 — 클릭 전 알림 여부 |
| `var_gtm_source` | `gtmSource` | `data-gtm-source` | 판매제품 — 출처(판매처) |
| `var_gtm_zoom` | `gtmZoom` | `data-gtm-zoom` | 바리에이션 구성도 — `in`/`out`/`fit` |
| `var_gtm_request_type` | `gtmRequestType` | `data-gtm-request-type` | 요청 유형 `REGISTER`/`MODIFY` |
| `var_gtm_guide_target` | `guideTarget` | `data-guide-target` | 이용 안내 목차 섹션 id |

### 2-2. 체크박스 상태 — 맞춤 JavaScript

#### `var_gtm_checked`

클릭 이벤트 시점에는 이미 체크 상태가 바뀌어 있으므로 **클릭 후 값**입니다.

```javascript
function() {
  var el = {{Click Element}};
  return el && el.type === 'checkbox' ? String(el.checked) : undefined;
}
```

---

## 3. 트리거

모든 트리거는 `트리거` → `새로 만들기` → **클릭 - 모든 요소** 유형입니다.

조건 표기:

- **`.gtm-xxx`** → `Click Element` · **CSS 선택자와 일치** · `.gtm-xxx, .gtm-xxx *`  
  버튼 안의 아이콘(`<i>`)이나 셀 안의 글자를 눌러도 잡히도록 자손까지 포함합니다.
- **클래스 `gtm-xxx`** → `Click Classes` · **포함** · `gtm-xxx`  
  팝업 배경·라이트박스처럼 **그 요소 자체**를 눌렀을 때만 잡아야 하는 경우입니다. (자손까지 포함하면 팝업 안 아무 곳이나 눌러도 발동합니다)
- **제외** → 같은 트리거에 `Click Element` · **CSS 선택자와 일치하지 않음** 조건을 추가합니다.

### 3-1. 헤더 (모든 사용자 페이지 공통)

| 트리거명 | 조건 |
|---|---|
| `trigger_header_guide` | `.gtm-header-guide` |
| `trigger_header_github` | `.gtm-header-github` |
| `trigger_header_feedback` | `.gtm-header-feedback` |
| `trigger_header_donate` | `.gtm-header-donate` |
| `trigger_header_product_request` | `.gtm-header-product-request` |
| `trigger_header_my_requests` | `.gtm-header-my-requests` |
| `trigger_header_on_sale` | `.gtm-header-on-sale` |
| `trigger_header_product_list` | `.gtm-header-product-list` |
| `trigger_header_login` | `.gtm-header-login` |
| `trigger_header_share` | `.gtm-header-share` |
| `trigger_header_settings` | `.gtm-header-settings` |
| `trigger_header_logout` | `.gtm-header-logout` |

### 3-2. 제품 목록 — 툴바 · 등급 탭

| 트리거명 | 조건 |
|---|---|
| `trigger_header_view_normal` | `.gtm-header-view-normal` |
| `trigger_header_view_tab` | `.gtm-header-view-tab` |
| `trigger_toolbar_refresh` | `.gtm-toolbar-refresh` |
| `trigger_grade_tab` | `.gtm-grade-tab` |

### 3-3. 제품 목록 — 그리드 셀

| 트리거명 | 조건 |
|---|---|
| `trigger_grid_boxart` | `.gtm-grid-boxart` |
| `trigger_grid_name` | `.gtm-grid-name` · 제외 `.gtm-grid-variation, .gtm-grid-variation *` |
| `trigger_grid_variation` | `.gtm-grid-variation` |
| `trigger_grid_owned` | `.gtm-grid-owned` · 제외 `.gtm-grid-owned-minus, .gtm-grid-owned-plus` |
| `trigger_grid_owned_minus` | `.gtm-grid-owned-minus` |
| `trigger_grid_owned_plus` | `.gtm-grid-owned-plus` |
| `trigger_grid_assembled` | `.gtm-grid-assembled` |
| `trigger_grid_decal_attached` | `.gtm-grid-decal-attached` |
| `trigger_grid_manual` | `.gtm-grid-manual` |
| `trigger_grid_source` | `.gtm-grid-source` |
| `trigger_grid_purchase_date` | `.gtm-grid-purchase-date` |
| `trigger_grid_purchase_place` | `.gtm-grid-purchase-place` |
| `trigger_grid_purchase_price` | `.gtm-grid-purchase-price` |
| `trigger_grid_decal` | `.gtm-grid-decal` |

### 3-4. 제품 목록 — 상세 팝업 · 바리에이션 팝업 · 라이트박스

| 트리거명 | 조건 |
|---|---|
| `trigger_modal_detail_close` | `.gtm-modal-detail-close` |
| `trigger_modal_detail_backdrop` | 클래스 `gtm-modal-detail-backdrop` |
| `trigger_modal_detail_manual` | `.gtm-modal-detail-manual` |
| `trigger_modal_detail_boxart_prev` | `.gtm-modal-detail-boxart-prev` |
| `trigger_modal_detail_boxart_next` | `.gtm-modal-detail-boxart-next` |
| `trigger_modal_detail_modify_request` | `.gtm-modal-detail-modify-request` |
| `trigger_modal_variation_close` | `.gtm-modal-variation-close` |
| `trigger_modal_variation_backdrop` | 클래스 `gtm-modal-variation-backdrop` |
| `trigger_modal_variation_zoom` | `.gtm-modal-variation-zoom` |
| `trigger_lightbox_close` | 클래스 `gtm-lightbox-close` (제품 목록·판매제품·공유 페이지 공통) |
| `trigger_lightbox_prev` | `.gtm-lightbox-prev` |
| `trigger_lightbox_next` | `.gtm-lightbox-next` |

### 3-5. 제품 등록/수정 요청 팝업 (로그인 사용자)

| 트리거명 | 조건 |
|---|---|
| `trigger_modal_product_boxart_upload` | `.gtm-modal-product-boxart-upload` |
| `trigger_modal_product_manual_add` | `.gtm-modal-product-manual-add` |
| `trigger_modal_product_save` | `.gtm-modal-product-save` |
| `trigger_modal_product_cancel` | `.gtm-modal-product-cancel` |
| `trigger_modal_product_close` | `.gtm-modal-product-close` |

### 3-6. 판매제품 모아보기 (`/on-sale`)

| 트리거명 | 조건 |
|---|---|
| `trigger_on_sale_alert_on` | `.gtm-on-sale-alert-on` |
| `trigger_on_sale_alert_off` | `.gtm-on-sale-alert-off` |
| `trigger_on_sale_refresh` | `.gtm-on-sale-refresh` |
| `trigger_on_sale_grid_alert` | `.gtm-on-sale-grid-alert` |
| `trigger_on_sale_grid_boxart` | `.gtm-on-sale-grid-boxart` |
| `trigger_on_sale_grid_link` | `.gtm-on-sale-grid-link` |

### 3-7. 요청 현황 (`/my/product-requests`)

| 트리거명 | 조건 |
|---|---|
| `trigger_my_requests_refresh` | `.gtm-my-requests-refresh` |
| `trigger_my_requests_grid_product` | `.gtm-my-requests-grid-product` |
| `trigger_my_requests_grid_detail` | `.gtm-my-requests-grid-detail` |
| `trigger_modal_request_detail_close` | `.gtm-modal-request-detail-close, .gtm-modal-request-detail-ok` |
| `trigger_modal_request_detail_backdrop` | 클래스 `gtm-modal-request-detail-backdrop` |
| `trigger_modal_request_detail_cancel_request` | `.gtm-modal-request-detail-cancel-request` |
| `trigger_modal_product_detail_close` | `.gtm-modal-product-detail-close, .gtm-modal-product-detail-ok` |
| `trigger_modal_product_detail_backdrop` | 클래스 `gtm-modal-product-detail-backdrop` |

> 닫기 X 버튼과 하단 닫기 버튼을 한 트리거로 묶을 때는 CSS 선택자에 `.a, .a *, .b, .b *` 로 모두 적습니다.

### 3-8. 설정 · 닉네임 팝업 (로그인 사용자)

| 트리거명 | 조건 |
|---|---|
| `trigger_modal_settings_share_enabled` | `.gtm-modal-settings-share-enabled` |
| `trigger_modal_settings_notify_on_sale` | `.gtm-modal-settings-notify-on-sale` |
| `trigger_modal_settings_save` | `.gtm-modal-settings-save` |
| `trigger_modal_settings_close` | `.gtm-modal-settings-close, .gtm-modal-settings-cancel` |
| `trigger_modal_settings_backdrop` | 클래스 `gtm-modal-settings-backdrop` |
| `trigger_modal_nickname_save` | `.gtm-modal-nickname-save` |
| `trigger_modal_nickname_skip` | `.gtm-modal-nickname-skip` |

### 3-9. 공유하기 팝업 (로그인 사용자)

| 트리거명 | 조건 |
|---|---|
| `trigger_modal_share_link` | `.gtm-modal-share-link` |
| `trigger_modal_share_copy` | `.gtm-modal-share-copy` |
| `trigger_modal_share_qr_copy` | `.gtm-modal-share-qr-copy` |
| `trigger_modal_share_close` | `.gtm-modal-share-close` |
| `trigger_modal_share_backdrop` | 클래스 `gtm-modal-share-backdrop` |

### 3-10. 이용 안내 팝업

| 트리거명 | 조건 |
|---|---|
| `trigger_modal_guide_nav` | `.gtm-modal-guide-nav` |
| `trigger_modal_guide_hide` | `.gtm-modal-guide-hide` |
| `trigger_modal_guide_close` | `.gtm-modal-guide-close, .gtm-modal-guide-ok` |
| `trigger_modal_guide_backdrop` | 클래스 `gtm-modal-guide-backdrop` |
| `trigger_guide_github` | `.gtm-guide-github` |
| `trigger_guide_feedback` | `.gtm-guide-feedback` |
| `trigger_guide_donate` | `.gtm-guide-donate` |

### 3-11. 공유 페이지 (`/share/{shareId}`, 비로그인 방문자)

| 트리거명 | 조건 |
|---|---|
| `trigger_share_home` | `.gtm-share-home` |
| `trigger_share_list` | `.gtm-share-list` |
| `trigger_share_donate` | `.gtm-share-donate` |
| `trigger_share_boxart` | `.gtm-share-boxart` |
| `trigger_share_manual` | `.gtm-share-manual` |

---

## 4. 태그

모든 태그는 `태그` → `새로 만들기` → **Google 애널리틱스: GA4 이벤트** 유형입니다.  
측정 ID는 GA4 스트림의 `G-XXXXXXXXXX` 값을 입력합니다.  
태그 이름은 트리거 이름의 `trigger_` 를 `tag_` 로 바꿔 씁니다. (예: `trigger_header_share` → `tag_header_share`)

### 4-1. 헤더

| 태그 | 이벤트 이름 | 매개변수 |
|---|---|---|
| `tag_header_guide` | `guide_open` | `source`=`header` |
| `tag_header_github` | `click_external_link` | `link_type`=`github`, `link_url`=`{{Click URL}}`, `source`=`header` |
| `tag_header_feedback` | `click_external_link` | `link_type`=`feedback`, `link_url`=`{{Click URL}}`, `source`=`header` |
| `tag_header_donate` | `click_external_link` | `link_type`=`donate`, `link_url`=`{{Click URL}}`, `source`=`header` |
| `tag_header_product_request` | `product_request_open` | `request_type`=`REGISTER` |
| `tag_header_my_requests` | `navigate` | `destination`=`my_requests` |
| `tag_header_on_sale` | `navigate` | `destination`=`on_sale` |
| `tag_header_product_list` | `navigate` | `destination`=`product_list` |
| `tag_header_login` | `login_click` | `method`=`google` |
| `tag_header_share` | `share_open` | — |
| `tag_header_settings` | `settings_open` | — |
| `tag_header_logout` | `logout_click` | — |

### 4-2. 제품 목록 — 툴바 · 등급 탭

| 태그 | 이벤트 이름 | 매개변수 |
|---|---|---|
| `tag_header_view_normal` | `view_mode_change` | `mode`=`normal` |
| `tag_header_view_tab` | `view_mode_change` | `mode`=`tab` |
| `tag_toolbar_refresh` | `list_refresh` | `page`=`product_list` |
| `tag_grade_tab` | `grade_tab_click` | `grade`=`{{var_gtm_grade}}` |

> 검색 조건(등급·구분·키워드 등)은 입력 즉시 필터링되어 클릭 이벤트가 없습니다. 필요하면 `dataLayer.push()` 로 별도 이벤트를 보냅니다.

### 4-3. 제품 목록 — 그리드 셀

| 태그 | 이벤트 이름 | 매개변수 |
|---|---|---|
| `tag_grid_boxart` | `product_boxart_click` | `product_id`, `product_name` |
| `tag_grid_name` | `product_detail_open` | `product_id`, `product_name` |
| `tag_grid_variation` | `product_variation_open` | `product_id` |
| `tag_grid_owned` | `product_owned_toggle` | `product_id`, `previous_value`=`{{var_gtm_owned}}` |
| `tag_grid_owned_minus` | `product_owned_count_change` | `product_id`, `step`=`-1` |
| `tag_grid_owned_plus` | `product_owned_count_change` | `product_id`, `step`=`1` |
| `tag_grid_assembled` | `product_assembled_toggle` | `product_id`, `previous_value`=`{{var_gtm_assembled}}` |
| `tag_grid_decal_attached` | `product_decal_toggle` | `product_id`, `previous_value`=`{{var_gtm_decal_attached}}` |
| `tag_grid_manual` | `product_manual_click` | `product_id`, `link_url`=`{{Click URL}}`, `source`=`grid` |
| `tag_grid_source` | `product_source_click` | `product_id`, `link_url`=`{{Click URL}}` |
| `tag_grid_purchase_date` | `product_purchase_date_edit` | — |
| `tag_grid_purchase_place` | `product_purchase_place_edit` | — |
| `tag_grid_purchase_price` | `product_purchase_price_edit` | — |
| `tag_grid_decal` | `product_decal_brand_edit` | — |

`product_id` = `{{var_gtm_product_id}}`, `product_name` = `{{var_gtm_product_name}}` 입니다. (이하 동일)

> 보유 셀은 비로그인 상태에서도 클릭되지만(로그인 안내) `previous_value` 는 `false` 로 수집됩니다.  
> 구매 정보 셀은 편집 시작(셀 클릭)만 추적합니다. 저장 성공 여부는 별도 `dataLayer.push()` 가 필요합니다.

### 4-4. 제품 목록 — 상세 팝업 · 바리에이션 팝업 · 라이트박스

| 태그 | 이벤트 이름 | 매개변수 |
|---|---|---|
| `tag_modal_detail_close` | `product_detail_close` | `close_method`=`button` |
| `tag_modal_detail_backdrop` | `product_detail_close` | `close_method`=`backdrop` |
| `tag_modal_detail_manual` | `product_manual_click` | `product_id`, `link_url`=`{{Click URL}}`, `source`=`detail_modal` |
| `tag_modal_detail_boxart_prev` | `boxart_navigate` | `direction`=`prev`, `source`=`detail_modal` |
| `tag_modal_detail_boxart_next` | `boxart_navigate` | `direction`=`next`, `source`=`detail_modal` |
| `tag_modal_detail_modify_request` | `product_request_open` | `request_type`=`MODIFY` |
| `tag_modal_variation_close` | `product_variation_close` | `close_method`=`button` |
| `tag_modal_variation_backdrop` | `product_variation_close` | `close_method`=`backdrop` |
| `tag_modal_variation_zoom` | `variation_zoom` | `zoom`=`{{var_gtm_zoom}}` |
| `tag_lightbox_close` | `lightbox_close` | `page_path`=`{{Page Path}}` |
| `tag_lightbox_prev` | `boxart_navigate` | `direction`=`prev`, `source`=`lightbox` |
| `tag_lightbox_next` | `boxart_navigate` | `direction`=`next`, `source`=`lightbox` |

### 4-5. 제품 등록/수정 요청 팝업

| 태그 | 이벤트 이름 | 매개변수 |
|---|---|---|
| `tag_modal_product_boxart_upload` | `product_request_boxart_select` | — |
| `tag_modal_product_manual_add` | `product_request_manual_add` | — |
| `tag_modal_product_save` | `product_request_submit` | — |
| `tag_modal_product_cancel` | `product_request_close` | `close_method`=`cancel` |
| `tag_modal_product_close` | `product_request_close` | `close_method`=`button` |

> 제출 버튼 클릭만 추적합니다. 필수값 누락 등으로 실패한 경우도 포함됩니다.

### 4-6. 판매제품 모아보기

| 태그 | 이벤트 이름 | 매개변수 |
|---|---|---|
| `tag_on_sale_alert_on` | `on_sale_alert_bulk` | `enabled`=`true` |
| `tag_on_sale_alert_off` | `on_sale_alert_bulk` | `enabled`=`false` |
| `tag_on_sale_refresh` | `list_refresh` | `page`=`on_sale` |
| `tag_on_sale_grid_alert` | `on_sale_alert_toggle` | `product_name`, `previous_value`=`{{var_gtm_alert}}` |
| `tag_on_sale_grid_boxart` | `product_boxart_click` | `product_name`, `source`=`on_sale` |
| `tag_on_sale_grid_link` | `on_sale_link_click` | `product_name`, `store`=`{{var_gtm_source}}`, `link_url`=`{{Click URL}}` |

### 4-7. 요청 현황

| 태그 | 이벤트 이름 | 매개변수 |
|---|---|---|
| `tag_my_requests_refresh` | `list_refresh` | `page`=`my_requests` |
| `tag_my_requests_grid_product` | `product_detail_open` | `product_id`, `source`=`my_requests` |
| `tag_my_requests_grid_detail` | `product_request_detail_open` | `request_type`=`{{var_gtm_request_type}}` |
| `tag_modal_request_detail_close` | `product_request_detail_close` | `close_method`=`button` |
| `tag_modal_request_detail_backdrop` | `product_request_detail_close` | `close_method`=`backdrop` |
| `tag_modal_request_detail_cancel_request` | `product_request_cancel` | — |
| `tag_modal_product_detail_close` | `product_detail_close` | `close_method`=`button`, `source`=`my_requests` |
| `tag_modal_product_detail_backdrop` | `product_detail_close` | `close_method`=`backdrop`, `source`=`my_requests` |

### 4-8. 설정 · 닉네임 팝업

| 태그 | 이벤트 이름 | 매개변수 |
|---|---|---|
| `tag_modal_settings_share_enabled` | `settings_toggle` | `setting`=`share_enabled`, `value`=`{{var_gtm_checked}}` |
| `tag_modal_settings_notify_on_sale` | `settings_toggle` | `setting`=`notify_on_sale`, `value`=`{{var_gtm_checked}}` |
| `tag_modal_settings_save` | `settings_save` | — |
| `tag_modal_settings_close` | `settings_close` | `close_method`=`button` |
| `tag_modal_settings_backdrop` | `settings_close` | `close_method`=`backdrop` |
| `tag_modal_nickname_save` | `nickname_set` | `method`=`save` |
| `tag_modal_nickname_skip` | `nickname_set` | `method`=`skip` |

> 설정 체크박스는 저장 전 토글입니다. 실제 반영 여부는 `settings_save` 와 함께 봅니다.

### 4-9. 공유하기 팝업

| 태그 | 이벤트 이름 | 매개변수 |
|---|---|---|
| `tag_modal_share_link` | `share_link_open` | `link_url`=`{{Click URL}}` |
| `tag_modal_share_copy` | `share` | `method`=`copy_link` |
| `tag_modal_share_qr_copy` | `share` | `method`=`copy_qr` |
| `tag_modal_share_close` | `share_close` | `close_method`=`button` |
| `tag_modal_share_backdrop` | `share_close` | `close_method`=`backdrop` |

> `share` 는 GA4 권장 이벤트 이름이라 `method` 가 기본 보고서에 바로 잡힙니다.

### 4-10. 이용 안내 팝업

| 태그 | 이벤트 이름 | 매개변수 |
|---|---|---|
| `tag_modal_guide_nav` | `guide_section_click` | `section`=`{{var_gtm_guide_target}}` |
| `tag_modal_guide_hide` | `guide_hide_toggle` | `value`=`{{var_gtm_checked}}` |
| `tag_modal_guide_close` | `guide_close` | `close_method`=`button` |
| `tag_modal_guide_backdrop` | `guide_close` | `close_method`=`backdrop` |
| `tag_guide_github` | `click_external_link` | `link_type`=`github`, `link_url`=`{{Click URL}}`, `source`=`guide` |
| `tag_guide_feedback` | `click_external_link` | `link_type`=`feedback`, `link_url`=`{{Click URL}}`, `source`=`guide` |
| `tag_guide_donate` | `click_external_link` | `link_type`=`donate`, `link_url`=`{{Click URL}}`, `source`=`guide` |

> 이용 안내는 처음 방문 시 자동으로도 열리므로 `guide_open` 은 헤더 버튼으로 연 경우만 집계됩니다.

### 4-11. 공유 페이지

| 태그 | 이벤트 이름 | 매개변수 |
|---|---|---|
| `tag_share_home` | `navigate` | `destination`=`product_list`, `source`=`share_page_header` |
| `tag_share_list` | `navigate` | `destination`=`product_list`, `source`=`share_page_footer` |
| `tag_share_donate` | `click_external_link` | `link_type`=`donate`, `link_url`=`{{Click URL}}`, `source`=`share_page` |
| `tag_share_boxart` | `product_boxart_click` | `product_id`, `product_name`, `source`=`share_page` |
| `tag_share_manual` | `product_manual_click` | `product_id`, `link_url`=`{{Click URL}}`, `source`=`share_page` |

---

## 5. GA4 맞춤 측정기준 등록

GA4 `관리` → `맞춤 정의` → `맞춤 측정기준` 에 이벤트 매개변수를 등록해야 보고서에서 사용할 수 있습니다.

| 측정기준 이름 | 범위 | 이벤트 매개변수 |
|---|---|---|
| 뷰 모드 | 이벤트 | `mode` |
| 링크 유형 | 이벤트 | `link_type` |
| 등급 | 이벤트 | `grade` |
| 제품 ID | 이벤트 | `product_id` |
| 제품명 | 이벤트 | `product_name` |
| 이전 값 | 이벤트 | `previous_value` |
| 클릭 출처 | 이벤트 | `source` |
| 닫기 방법 | 이벤트 | `close_method` |
| 이동 대상 | 이벤트 | `destination` |
| 요청 유형 | 이벤트 | `request_type` |
| 화면 | 이벤트 | `page` |
| 방향 | 이벤트 | `direction` |
| 확대 동작 | 이벤트 | `zoom` |
| 보유 개수 증감 | 이벤트 | `step` |
| 판매처 | 이벤트 | `store` |
| 알림 일괄 설정 | 이벤트 | `enabled` |
| 설정 항목 | 이벤트 | `setting` |
| 설정 값 | 이벤트 | `value` |
| 안내 섹션 | 이벤트 | `section` |

---

## 6. 주의 사항

- 아래 요소는 클릭 핸들러에서 `event.stopPropagation()` 을 호출합니다. GTM 클릭 리스너는 `document` 에서 이벤트를 받으므로 **트리거가 발동하지 않을 수 있습니다.** 미리보기 모드에서 먼저 확인하고, 안 잡히면 해당 핸들러에서 `dataLayer.push()` 로 보내도록 바꿉니다.
  - `gtm-grid-manual`, `gtm-grid-source`, `gtm-modal-detail-manual` (인라인 `onclick="event.stopPropagation()"`)
  - `gtm-lightbox-prev`, `gtm-lightbox-next`
- 바리에이션 구성도 확대 버튼(`gtm-modal-variation-zoom`)은 `pointerdown`/`mousedown`/`touchstart` 만 막으므로 `click` 은 정상 전달됩니다.

---

## 7. 검증 절차

1. GTM 미리보기 모드 활성화
2. 사이트에서 각 요소 클릭 (로그인/비로그인 각각)
3. GTM 미리보기 패널에서 트리거 발동 및 변수 값 확인
4. GA4 `DebugView` (`관리` → `DebugView`)에서 이벤트 수신 확인
5. 이상 없으면 컨테이너 **게시**
