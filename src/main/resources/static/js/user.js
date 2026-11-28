/* 사용자 제품 목록 그리드 — AG Grid Community 사용
 * 비로그인: /api/products → 행 데이터가 ProductResponseDto 직접
 * 로그인:  /api/user/products → 행 데이터가 UserProductResponseDto { product, owned, ... }
 * getProd(data) 가 두 구조를 추상화하므로 렌더러는 항상 getProd() 를 통해 제품 정보를 참조
 */
(function () {
    let gridApi = null;
    let isLoggedIn = false;
    let tabMode = false;
    let activeTabGrade = '';
    let desktopTabMode = false;
    let allCategories = [];
    // 상세 팝업에 띄운 제품 — '수정 요청' 버튼이 대상 제품으로 사용한다
    let detailProduct = null;
    // 라이트박스에서 넘겨 볼 원본 이미지 목록과 현재 위치 (박스아트가 여러 장인 제품)
    let lightboxUrls = [];
    let lightboxIndex = 0;

    // ---- Helpers ----

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    function escHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // 로그인 여부에 따라 행 데이터에서 제품 정보를 추출
    // 로그인: UserProductResponseDto.product / 비로그인: ProductResponseDto 직접
    function getProd(data) {
        return isLoggedIn ? data.product : data;
    }

    function isMobileView()  { return window.innerWidth < 500; }
    function isTabletView()  { return window.innerWidth >= 500 && window.innerWidth < 1200; }
    function isSmallScreen() { return isMobileView() || isTabletView(); }

    // ---- Custom cell editors ----

    function DateCellEditor() {}
    DateCellEditor.prototype.init = function (params) {
        this.eInput = document.createElement('input');
        this.eInput.type = 'date';
        this.eInput.value = params.value || '';
        this.eInput.style.cssText = 'width:100%;height:100%;border:none;background:var(--bg-input);color:var(--text-primary);padding:0 6px;font-size:13px;outline:none;box-sizing:border-box';
        this.eInput.addEventListener('change', () => this.eInput.blur());
        this.eInput.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
    };
    DateCellEditor.prototype.getGui = function () { return this.eInput; };
    DateCellEditor.prototype.getValue = function () { return this.eInput.value || null; };
    DateCellEditor.prototype.afterGuiAttached = function () {
        this.eInput.focus();
        try { this.eInput.showPicker(); } catch (e) { /* 브라우저가 showPicker를 지원하지 않는 경우 무시 */ }
    };
    DateCellEditor.prototype.isPopup = function () { return false; };

    // ---- Cell Renderers ----

    function BoxArtRenderer() {}
    BoxArtRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'cell-boxart';
        this.refresh(params);
    };
    BoxArtRenderer.prototype.getGui = function () { return this.eGui; };
    BoxArtRenderer.prototype.refresh = function (params) {
        const p = getProd(params.data);
        const url = p?.boxArtThumbUrl;
        if (url) {
            const id = p?.id ?? '';
            const name = p?.name ?? '';
            this.eGui.innerHTML = `<img src="${escHtml(url)}" alt="thumb" class="gtm-grid-boxart" data-gtm-product-id="${escHtml(String(id))}" data-gtm-product-name="${escHtml(name)}" style="cursor:zoom-in">`
                + boxArtCountHtml(p);
            // 여러 장이면 라이트박스에서 < > 로 넘겨 볼 수 있도록 전체 목록을 넘긴다
            this.eGui.querySelector('img').addEventListener('click', () => openLightbox(boxArtUrlsOf(p)));
        } else {
            this.eGui.innerHTML = `<div class="cell-boxart-placeholder">NO IMAGE</div>`;
        }
        return true;
    };

    function NameCellRenderer() {}
    NameCellRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'cell-name';
        this.refresh(params);
    };
    NameCellRenderer.prototype.getGui = function () { return this.eGui; };
    NameCellRenderer.prototype.refresh = function (params) {
        const p = getProd(params.data);
        this.eGui.className = 'cell-name gtm-grid-name';
        this.eGui.dataset.gtmProductId = String(p?.id ?? '');
        this.eGui.dataset.gtmProductName = p?.name ?? '';
        const name = p?.name || '';
        const grade = p?.grade || '';
        const cat = p?.category;
        const catHtml = cat
            ? `<span class="chip" style="background:${hexToRgba(cat.color,0.2)};border-color:${cat.color};color:${cat.color}">${escHtml(cat.name)}</span>`
            : '';
        const gradeColor = GRADE_COLORS[grade] || '#6c7a8d';
        const gradeHtml = grade
            ? `<span class="chip" style="background:${hexToRgba(gradeColor,0.15)};border-color:${gradeColor};color:${gradeColor}">${escHtml(grade)}</span>`
            : '';
        const nameKw = isMobileView()
            ? (document.getElementById('search-keyword-mobile')?.value.trim() || '')
            : (document.getElementById('search-name')?.value.trim() || '');
        // 바리에이션 구성도 보드에 올라간 제품만 구성도 아이콘을 붙인다 — 클릭은 onCellClicked 에서 상세 팝업과 구분한다
        const variationHtml = p?.variationId
            ? `<button type="button" class="variation-tree-icon gtm-grid-variation" data-gtm-product-id="${escHtml(String(p.id))}" title="바리에이션 구성도" aria-label="바리에이션 구성도"><i class="fa-solid fa-sitemap"></i></button>`
            : '';
        this.eGui.innerHTML = `
            <div class="name-line1"><span class="name-text">${highlightText(name, nameKw)}</span><i class="fa-solid fa-up-right-from-square name-popup-icon"></i>${variationHtml}</div>
            <div class="name-line2">${gradeHtml}${catHtml}</div>
        `;
        return true;
    };

    function ModelNumberRenderer() {}
    ModelNumberRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    ModelNumberRenderer.prototype.getGui = function () { return this.eGui; };
    ModelNumberRenderer.prototype.refresh = function (params) {
        const kw = isMobileView()
            ? (document.getElementById('search-keyword-mobile')?.value.trim() || '')
            : (document.getElementById('search-model')?.value.trim() || '');
        console.log("--");
        console.log("kw = " + kw + ", params = ", params);
        this.eGui.innerHTML = highlightText(getProd(params.data)?.modelNumber, kw);
        return true;
    };

    function SeriesRenderer() {}
    SeriesRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    SeriesRenderer.prototype.getGui = function () { return this.eGui; };
    SeriesRenderer.prototype.refresh = function (params) {
        const kw = document.getElementById('search-series')?.value.trim() || '';
        this.eGui.innerHTML = highlightText(getProd(params.data)?.series, kw);
        return true;
    };

    function PriceRenderer() {}
    PriceRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    PriceRenderer.prototype.getGui = function () { return this.eGui; };
    PriceRenderer.prototype.refresh = function (params) {
        const p = getProd(params.data);
        this.eGui.textContent = (p?.currency && p?.price != null) ? formatPrice(p.currency, p.price) : '';
        return true;
    };

    // 보유 셀 — 보유면 "- {n}개 +" (-/+ 는 셀 양쪽 끝), 클릭 처리는 onCellClicked → onOwnedCellClicked
    function OwnedRenderer() {}
    OwnedRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    OwnedRenderer.prototype.getGui = function () { return this.eGui; };
    OwnedRenderer.prototype.refresh = function (params) {
        this.eGui.dataset.gtmProductId = String(getProd(params.data)?.id ?? '');
        this.eGui.dataset.gtmOwned = String(!!params.data.owned);
        if (!isLoggedIn) {
            this.eGui.className = 'gtm-grid-owned';
            this.eGui.textContent = '-';
        } else if (params.data.owned) {
            this.eGui.className = 'cell-owned gtm-grid-owned';
            this.eGui.innerHTML =
                '<button type="button" class="cell-owned-step cell-owned-minus gtm-grid-owned-minus" data-owned-step="-1" aria-label="보유 개수 줄이기">-</button>' +
                `<span class="cell-owned-yes cell-owned-count">${params.data.ownedCount ?? 1}개</span>` +
                '<button type="button" class="cell-owned-step cell-owned-plus gtm-grid-owned-plus" data-owned-step="1" aria-label="보유 개수 늘리기">+</button>';
        } else {
            this.eGui.className = 'cell-owned-no gtm-grid-owned';
            this.eGui.textContent = '미보유';
        }
        return true;
    };

    function AssembledRenderer() {}
    AssembledRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    AssembledRenderer.prototype.getGui = function () { return this.eGui; };
    AssembledRenderer.prototype.refresh = function (params) {
        this.eGui.dataset.gtmProductId = String(getProd(params.data)?.id ?? '');
        this.eGui.dataset.gtmAssembled = String(!!params.data.assembled);
        if (!isLoggedIn) {
            this.eGui.className = 'gtm-grid-assembled';
            this.eGui.textContent = '-';
        } else if (params.data.assembled) {
            this.eGui.className = 'cell-owned-yes gtm-grid-assembled';
            this.eGui.textContent = '조립';
        } else {
            this.eGui.className = 'cell-owned-no gtm-grid-assembled';
            this.eGui.textContent = '미조립';
        }
        return true;
    };

    function DecalAttachedRenderer() {}
    DecalAttachedRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    DecalAttachedRenderer.prototype.getGui = function () { return this.eGui; };
    DecalAttachedRenderer.prototype.refresh = function (params) {
        this.eGui.dataset.gtmProductId = String(getProd(params.data)?.id ?? '');
        this.eGui.dataset.gtmDecalAttached = String(!!params.data.decalAttached);
        if (!isLoggedIn) {
            this.eGui.className = 'gtm-grid-decal-attached';
            this.eGui.textContent = '-';
        } else if (params.data.decalAttached) {
            this.eGui.className = 'cell-owned-yes gtm-grid-decal-attached';
            this.eGui.textContent = '부착';
        } else {
            this.eGui.className = 'cell-owned-no gtm-grid-decal-attached';
            this.eGui.textContent = '미부착';
        }
        return true;
    };

    function ReleaseDateRenderer() {}
    ReleaseDateRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    ReleaseDateRenderer.prototype.getGui = function () { return this.eGui; };
    ReleaseDateRenderer.prototype.refresh = function (params) {
        const p = getProd(params.data);
        this.eGui.textContent = formatReleaseDate(p?.releaseYear, p?.releaseMonth);
        return true;
    };

    function ManualRenderer() {}
    ManualRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;height:100%';
        this.refresh(params);
    };
    ManualRenderer.prototype.getGui = function () { return this.eGui; };
    // 출처 컬럼과 동일 — 1개면 아이콘에 바로 링크, 2개 이상이면 아이콘 + 개수 버튼을 누르면 아래에 링크 선택 툴팁
    ManualRenderer.prototype.refresh = function (params) {
        const p = getProd(params.data);
        const urls = p?.manualUrls || [];
        const gtmAttrs = `class="gtm-grid-manual" data-gtm-product-id="${escHtml(String(p?.id ?? ''))}"`;
        if (!urls.length) {
            this.eGui.innerHTML = '';
            return true;
        }
        if (urls.length === 1) {
            this.eGui.innerHTML = `<a href="${escHtml(safeUrl(urls[0]))}" target="_blank" rel="noopener noreferrer"
                  ${gtmAttrs} style="color:var(--accent);font-size:14px"
                  onclick="event.stopPropagation()"><i class="fa-solid fa-book-open"></i></a>`;
            return true;
        }
        this.eGui.innerHTML = linkMenuToggleHtml('매뉴얼', 'fa-book-open', urls.length);
        bindLinkMenuToggle(this.eGui, '매뉴얼', 'fa-book-open', urls, gtmAttrs);
        return true;
    };

    function SourceRenderer() {}
    SourceRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%';
        this.refresh(params);
    };
    SourceRenderer.prototype.getGui = function () { return this.eGui; };
    // 1개면 링크 아이콘 하나에 바로 링크, 2개 이상이면 아이콘 + 개수를 버튼으로 두고 클릭 시 아래에 링크 선택 툴팁을 띄운다
    SourceRenderer.prototype.refresh = function (params) {
        const p = getProd(params.data);
        const urls = p?.sourceUrls || [];
        const gtmAttrs = `class="gtm-grid-source" data-gtm-product-id="${escHtml(String(p?.id ?? ''))}"`;
        if (urls.length <= 1) {
            this.eGui.innerHTML = sourceLinksHtml(urls, gtmAttrs);
            return true;
        }
        this.eGui.innerHTML = linkMenuToggleHtml('출처', 'fa-link', urls.length);
        bindLinkMenuToggle(this.eGui, '출처', 'fa-link', urls, gtmAttrs);
        return true;
    };

    // 링크가 2개 이상일 때 셀에 두는 아이콘 + 개수 버튼 (출처/매뉴얼 공용)
    function linkMenuToggleHtml(label, icon, count) {
        return `<button type="button" class="source-menu-toggle" aria-label="${label} ${count}건"
                aria-haspopup="menu" aria-expanded="false">
            <span class="source-icon-count"><i class="fa-solid ${icon}"></i><span class="source-count">${count}</span></span>
           </button>`;
    }

    function bindLinkMenuToggle(cell, label, icon, urls, gtmAttrs) {
        const toggle = cell.querySelector('.source-menu-toggle');
        toggle.addEventListener('click', e => {
            e.stopPropagation(); // 행 클릭(상세 팝업)으로 번지지 않게
            SourceMenu.toggle(toggle, label, icon, urls, gtmAttrs);
        });
    }

    // 링크 선택 툴팁 (출처/매뉴얼 공용) — 그리드 셀은 overflow 로 잘리므로 body 에 하나만 두고 버튼 위치에 맞춰 fixed 로 띄운다
    const SourceMenu = (function () {
        let menu = null;
        let owner = null;

        function close() {
            if (!menu) return;
            menu.remove();
            menu = null;
            if (owner) owner.setAttribute('aria-expanded', 'false');
            owner = null;
        }

        function position(toggle) {
            const r = toggle.getBoundingClientRect();
            const gap = 8;
            const margin = 8;
            const w = menu.offsetWidth;
            const h = menu.offsetHeight;
            // 버튼 가운데 아래에 두되 화면 밖으로 나가지 않게 좌우를 맞춘다
            let left = r.left + r.width / 2 - w / 2;
            left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
            // 아래 공간이 모자라면 위로 뒤집는다
            const below = r.bottom + gap + h <= window.innerHeight - margin;
            const top = below ? r.bottom + gap : r.top - gap - h;
            menu.classList.toggle('above', !below);
            menu.style.left = `${left}px`;
            menu.style.top = `${top}px`;
            // 꼬리(화살표)는 항상 버튼 가운데를 가리키게
            menu.style.setProperty('--caret-x', `${r.left + r.width / 2 - left}px`);
        }

        function open(toggle, label, icon, urls, gtmAttrs) {
            close();
            menu = document.createElement('div');
            menu.className = 'source-menu';
            menu.setAttribute('role', 'menu');
            // 아이콘에 번호를 붙여 4열로 나열한다
            menu.innerHTML = urls
                .map((url, i) => `<a href="${escHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer"
                      ${gtmAttrs} role="menuitem" aria-label="${label} ${i + 1}"
                      ><i class="fa-solid ${icon}"></i><sub class="manual-index">${i + 1}</sub></a>`)
                .join('');
            // 링크를 골라 새 탭으로 열어도 툴팁은 열어둔다 (다른 링크도 이어서 열 수 있게)
            menu.addEventListener('click', e => e.stopPropagation());
            document.body.appendChild(menu);
            owner = toggle;
            owner.setAttribute('aria-expanded', 'true');
            position(toggle);
        }

        function toggle(btn, label, icon, urls, gtmAttrs) {
            if (menu && owner === btn) close();
            else open(btn, label, icon, urls, gtmAttrs);
        }

        // 바깥 클릭, ESC, 스크롤(그리드 포함), 리사이즈 시 닫는다
        document.addEventListener('click', e => {
            if (menu && !menu.contains(e.target)) close();
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') close();
        });
        document.addEventListener('scroll', e => {
            if (menu && !menu.contains(e.target)) close();
        }, true);
        window.addEventListener('resize', close);

        return { toggle, close };
    })();

    // ---- Column definitions ----

    function buildColDefs() {
        const mobile = isMobileView();

        const center = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const left   = { display: 'flex', alignItems: 'center' };
        const right  = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };

        // 모바일이거나 비로그인이면 틀고정을 풀고 제품명이 남는 폭을 채운다
        const nameFlex = mobile || !isLoggedIn;

        return [
            {
                colId: 'boxArt',
                field: 'boxArtThumbUrl',
                headerName: '박스아트',
                cellRenderer: BoxArtRenderer,
                width: 100, resizable: false,
                sortable: false,
                hide: mobile && isLoggedIn,
                pinned: nameFlex ? null : 'left',
                cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
            },
            {
                colId: 'modelNumber',
                field: 'modelNumber',
                headerName: '형식번호',
                width: 170, minWidth: 100,
                valueGetter: p => getProd(p.data)?.modelNumber,
                cellRenderer: ModelNumberRenderer,
                hide: mobile,
                pinned: nameFlex ? null : 'left',
                cellStyle: left,
            },
            {
                colId: 'name',
                field: 'name',
                headerName: '제품명',
                // 모바일이거나 비로그인(보유~ 컬럼 숨김)이면 남는 폭을 제품명이 채운다 — 고정(pinned) 컬럼은 flex 가 안 되므로 고정도 푼다
                flex: nameFlex ? 1 : undefined,
                width: nameFlex ? undefined : 400,
                minWidth: 200,
                cellRenderer: NameCellRenderer,
                pinned: nameFlex ? null : 'left',
                sortable: true,
                valueGetter: p => getProd(p.data)?.name,
                getQuickFilterText: params => {
                    const p = getProd(params.data);
                    return [p?.name, p?.grade, p?.category?.name, p?.modelNumber].filter(Boolean).join(' ');
                },
                cellStyle: { ...left, cursor: 'pointer' },
            },
            // 품번 — 반다이 제품 고유 번호
            {
                colId: 'productNo',
                headerName: '품번',
                width: 110, minWidth: 80,
                hide: mobile,
                cellStyle: left,
                valueGetter: p => getProd(p.data)?.productNo,
            },
            // 발매번호 — 등급별 라인업 넘버링
            {
                colId: 'releaseNo',
                headerName: '발매번호',
                width: 120, minWidth: 80,
                hide: mobile,
                cellStyle: left,
                valueGetter: p => getProd(p.data)?.releaseNo,
            },
            {
                colId: 'releaseDate',
                field: 'releaseYear',
                headerName: '발매년월',
                cellRenderer: ReleaseDateRenderer,
                width: 110, resizable: false,
                headerClass: 'header-center',
                hide: mobile,
                sort: 'desc', sortIndex: 0,
                cellStyle: center,
                // year * 100 + month 를 정렬 기준값으로 사용 — 동일 연도 내 월 순서를 정확히 비교하기 위함
                valueGetter: p => {
                    const prod = getProd(p.data);
                    const year = prod?.releaseYear;
                    if (!year) return null;
                    return year * 100 + (prod?.releaseMonth || 0);
                },
            },
            {
                colId: 'price',
                field: 'price',
                headerName: '출시가격',
                cellRenderer: PriceRenderer,
                width: 140, minWidth: 100,
                headerClass: 'header-right',
                hide: mobile,
                cellStyle: right,
                valueGetter: p => getProd(p.data)?.price,
            },
            // 출연작 — 해당 건프라가 등장하는 작품명
            {
                colId: 'series',
                headerName: '출연작',
                width: 200, minWidth: 100,
                hide: mobile,
                cellStyle: left,
                valueGetter: p => getProd(p.data)?.series,
                cellRenderer: SeriesRenderer,
            },
            // 출처 — 제품 정보 원출처 링크 (아이콘 렌더러)
            {
                colId: 'source',
                headerName: '출처',
                cellRenderer: SourceRenderer,
                width: 75, resizable: false,
                sortable: false, filter: false,
                headerClass: 'header-center',
                hide: mobile,
                cellStyle: center,
            },
            {
                colId: 'manual',
                headerName: '매뉴얼',
                cellRenderer: ManualRenderer,
                width: 75, resizable: false,
                sortable: false, filter: false,
                headerClass: 'header-center',
                hide: mobile,
                cellStyle: center,
            },
            {
                colId: 'owned',
                field: 'owned',
                headerName: '보유',
                cellRenderer: OwnedRenderer,
                width: 100, resizable: false,
                headerClass: 'header-center',
                pinned: null,
                hide: !isLoggedIn,
                // -/+ 를 연달아 눌러도 글자가 선택(파랗게 칠해짐)되지 않도록 텍스트 선택을 막는다
                cellStyle: { ...center, cursor: isLoggedIn ? 'pointer' : 'default', userSelect: 'none' },
            },
            {
                colId: 'purchaseDate',
                field: 'purchaseDate',
                headerName: '구매일자',
                width: 130, resizable: false,
                editable: isLoggedIn,
                cellEditor: DateCellEditor,
                headerClass: 'header-center',
                cellClass: 'gtm-grid-purchase-date',
                hide: mobile || !isLoggedIn,
                cellStyle: center,
                valueFormatter: p => p.value ? String(p.value).replace(/-/g, '.') : '',
            },
            {
                colId: 'purchasePlace',
                field: 'purchasePlace',
                headerName: '구매처',
                width: 120, minWidth: 80,
                editable: isLoggedIn,
                cellClass: 'gtm-grid-purchase-place',
                hide: mobile || !isLoggedIn,
                cellStyle: left,
            },
            {
                colId: 'purchaseAmount',
                field: 'purchasePrice',
                headerName: '구매가격',
                width: 140, minWidth: 100,
                headerClass: 'header-right',
                cellClass: 'gtm-grid-purchase-price',
                hide: mobile || !isLoggedIn,
                editable: isLoggedIn,
                cellStyle: right,
                sortable: true,
                valueGetter: p => p.data.purchasePrice,
                valueFormatter: p => p.value != null ? Number(p.value).toLocaleString() : '',
                valueParser: p => {
                    const v = String(p.newValue ?? '').replace(/,/g, '').trim();
                    if (v === '') return null;
                    const n = Number(v);
                    if (isNaN(n) || n < 0 || n > 10000000) return p.oldValue ?? null;
                    return n;
                },
            },
            {
                colId: 'assembled',
                field: 'assembled',
                headerName: '조립',
                cellRenderer: AssembledRenderer,
                width: 100, resizable: false,
                headerClass: 'header-center',
                pinned: null,
                hide: mobile || !isLoggedIn,
                cellStyle: { ...center, cursor: isLoggedIn ? 'pointer' : 'default' },
            },
            {
                colId: 'decalAttached',
                field: 'decalAttached',
                headerName: '데칼',
                cellRenderer: DecalAttachedRenderer,
                width: 100, resizable: false,
                headerClass: 'header-center',
                pinned: null,
                hide: mobile || !isLoggedIn,
                cellStyle: { ...center, cursor: isLoggedIn ? 'pointer' : 'default' },
            },
            {
                colId: 'decal',
                field: 'decal',
                headerName: '데칼 브랜드',
                width: 240, minWidth: 80,
                editable: isLoggedIn,
                cellClass: 'gtm-grid-decal',
                hide: mobile || !isLoggedIn,
                cellStyle: left,
            },
            {
                colId: 'filler',
                headerName: '', flex: 1,
                sortable: false, resizable: false, filter: false,
                hide: mobile || !isLoggedIn,
            },
        ];
    }

    // ---- Grid init ----

    function isExternalFilterActive() {
        if (tabMode && activeTabGrade) return true;
        if (isMobileView()) {
            return !!(document.getElementById('search-keyword-mobile')?.value.trim());
        }
        const category = document.getElementById('search-category')?.value;
        const grade    = document.getElementById('search-grade')?.value;
        const model    = document.getElementById('search-model')?.value.trim();
        const name     = document.getElementById('search-name')?.value.trim();
        const series   = document.getElementById('search-series')?.value.trim();
        const owned    = document.getElementById('search-owned')?.value;
        return !!(category || grade || model || name || series || owned);
    }

    function externalFilterPass(node) {
        const p = getProd(node.data);

        if (tabMode && activeTabGrade && p?.grade !== activeTabGrade) return false;

        if (isMobileView()) {
            const keyword = document.getElementById('search-keyword-mobile')?.value.trim();
            if (keyword) {
                const haystack = [p?.modelNumber, p?.name].filter(Boolean).join(' ');
                if (!matchesAllTokens(haystack, keyword)) return false;
            }
            return true;
        }

        const category = document.getElementById('search-category')?.value;
        const grade    = tabMode ? '' : (document.getElementById('search-grade')?.value ?? '');
        const model    = document.getElementById('search-model')?.value.trim().toLowerCase();
        const name     = document.getElementById('search-name')?.value.trim().toLowerCase();
        const series   = document.getElementById('search-series')?.value.trim().toLowerCase();
        const owned    = document.getElementById('search-owned')?.value;
        if (category && String(p?.category?.id) !== category) return false;
        if (grade && p?.grade !== grade) return false;
        if (model && !p?.modelNumber?.toLowerCase().includes(model)) return false;
        if (name && !matchesAllTokens(p?.name, name)) return false;
        if (series && !p?.series?.toLowerCase().includes(series)) return false;
        if (owned === 'true' && !node.data.owned) return false;
        if (owned === 'false' && !!node.data.owned) return false;
        return true;
    }

    function setTabMode(enabled) {
        tabMode = enabled;
        const gradeSelect = document.getElementById('search-grade');
        const gradeTabs   = document.getElementById('grade-tabs');

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === (enabled ? 'tab' : 'normal'));
        });

        if (enabled) {
            // 일반 모드의 등급 선택값을 탭에 반영
            const gradeValue = gradeSelect?.value ?? '';
            const validGrades = ['HG', 'RE', 'RG', 'MG', 'MGSD', 'MGEX', 'PG'];
            activeTabGrade = validGrades.includes(gradeValue) ? gradeValue : '';
            document.querySelectorAll('.grade-tab').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.grade === activeTabGrade);
            });
            if (gradeSelect) gradeSelect.style.display = 'none';
            gradeTabs?.classList.add('active');
        } else {
            // 탭의 등급 선택값을 일반 모드 콤보에 반영
            if (gradeSelect) {
                gradeSelect.value = activeTabGrade;
                gradeSelect.style.display = '';
            }
            gradeTabs?.classList.remove('active');
            activeTabGrade = '';
        }
        gridApi?.onFilterChanged();
    }

    function setActiveTab(grade) {
        activeTabGrade = grade;
        document.querySelectorAll('.grade-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.grade === grade);
        });
        gridApi?.onFilterChanged();
    }

    async function loadCategories() {
        allCategories = await Api.get('/api/categories');
        const sel = document.getElementById('search-category');
        if (!sel) return;
        sel.innerHTML = `<option value="">구분 전체</option>` +
            allCategories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
    }

    function initGrid() {
        const gridEl = document.getElementById('products-grid');
        gridApi = agGrid.createGrid(gridEl, {
            columnDefs: buildColDefs(),
            rowData: [],
            rowHeight: 58,
            headerHeight: 40,
            defaultColDef: {
                resizable: true,
                sortable: true,
                suppressKeyboardEvent: params => {
                    if (params.event.key === 'Enter' && params.editing) {
                        setTimeout(() => document.activeElement?.blur(), 0);
                        return true;
                    }
                    return false;
                },
            },
            animateRows: false,
            enableCellTextSelection: true,
            // 행 id 를 제품 id 로 고정해 목록을 다시 불러와도 마지막 클릭 행 표시(common.js)가 같은 제품에 남게 한다
            getRowId: params => String(getProd(params.data).id),
            singleClickEdit: true,
            stopEditingWhenCellsLoseFocus: true,
            onCellClicked: onCellClicked,
            onCellValueChanged: onCellValueChanged,
            isExternalFilterPresent: isExternalFilterActive,
            doesExternalFilterPass: externalFilterPass,
            unSortIcon: true,
            icons: { sortUnSort: '<span style="color:var(--text-muted)">–</span>' },
        });
    }

    // ---- Responsive column update ----

    function applyResponsiveColumns() {
        if (!gridApi) return;
        const mobile = isMobileView();

        const toggle = document.getElementById('view-mode-toggle');
        if (toggle) toggle.style.display = mobile ? 'none' : '';

        const newTabMode = mobile || desktopTabMode;
        if (tabMode !== newTabMode) setTabMode(newTabMode);

        // 비로그인이면 보유부터 오른쪽 컬럼은 숨기고 틀고정을 풀어 제품명이 남는 폭을 채운다
        const nameFlex = mobile || !isLoggedIn;

        gridApi.applyColumnState({
            state: [
                { colId: 'boxArt',          hide: mobile && isLoggedIn,  pinned: nameFlex ? null : 'left' },
                { colId: 'modelNumber',     hide: mobile,                 pinned: nameFlex ? null : 'left' },
                { colId: 'name',            hide: false,                  pinned: nameFlex ? null : 'left', flex: nameFlex ? 1 : null, width: nameFlex ? undefined : 300 },
                { colId: 'productNo',       hide: mobile,                 pinned: null }, // 품번
                { colId: 'releaseNo',       hide: mobile,                 pinned: null }, // 발매번호
                { colId: 'releaseDate',     hide: mobile,                 pinned: null },
                { colId: 'price',           hide: mobile,                 pinned: null },
                { colId: 'series',          hide: mobile,                 pinned: null }, // 출연작
                { colId: 'source',          hide: mobile,                 pinned: null }, // 출처
                { colId: 'manual',          hide: mobile,                 pinned: null },
                { colId: 'owned',           hide: !isLoggedIn,            pinned: null },
                { colId: 'purchaseDate',    hide: mobile || !isLoggedIn,  pinned: null },
                { colId: 'purchasePlace',   hide: mobile || !isLoggedIn,  pinned: null },
                { colId: 'purchaseAmount',  hide: mobile || !isLoggedIn,  pinned: null },
                { colId: 'assembled',       hide: mobile || !isLoggedIn,  pinned: null },
                { colId: 'decalAttached',   hide: mobile || !isLoggedIn,  pinned: null },
                { colId: 'decal',           hide: mobile || !isLoggedIn,  pinned: null },
                { colId: 'filler',          hide: mobile || !isLoggedIn },
            ],
            applyOrder: false,
        });
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applyResponsiveColumns, 150);
    });

    // ---- Cell events ----

    // onCellValueChanged 에서 값을 되돌릴 때 재귀 호출 방지용 플래그
    let revertingCell = false;

    function onCellClicked(params) {
        const colId = params.colDef.colId;

        if (colId === 'name') {
            if (params.event?.target.closest('.variation-tree-icon')) {
                openVariationPopup(getProd(params.data));
            } else {
                openDetailPopup(params.data);
            }
        } else if (colId === 'owned' && isLoggedIn) {
            onOwnedCellClicked(params);
        } else if (colId === 'assembled' && isLoggedIn) {
            toggleAssembled(params.data, params.node);
        } else if (colId === 'decalAttached' && isLoggedIn) {
            toggleDecalAttached(params.data, params.node);
        }
    }

    // 미보유 클릭 → 1개 / "{n}개" 클릭 → 미보유 / + → 1개 늘림 / - → 1개 줄임 (1개에서 누르면 미보유)
    function onOwnedCellClicked(params) {
        const data = params.data;
        const step = Number(params.event?.target.closest('[data-owned-step]')?.dataset.ownedStep || 0);
        if (!data.owned) {
            changeOwned(params.node, true, 1);
        } else if (step > 0) {
            changeOwned(params.node, true, (data.ownedCount ?? 1) + 1);
        } else if (step < 0) {
            const count = data.ownedCount ?? 1;
            count > 1 ? changeOwned(params.node, true, count - 1) : changeOwned(params.node, false, 0);
        } else {
            changeOwned(params.node, false, 0);
        }
    }

    // +/- 를 빠르게 연타해도 화면이 바로 반응하도록 먼저 그리드에 반영하고,
    // 저장 요청은 제품별로 줄을 세워 앞 요청이 끝난 뒤 그 시점의 최신 값으로 보낸다 (요청 순서가 뒤바뀌지 않도록)
    // 실패하면 마지막으로 서버에 저장된 값으로 되돌린다 (연타 중이면 중간 값이 아니라 첫 클릭 이전 값)
    const ownedSaveQueues = new Map();
    const ownedSaved = new Map();

    function changeOwned(node, owned, ownedCount) {
        const productId = node.data.product?.id;
        if (!productId) return;
        if (!ownedSaveQueues.has(productId)) {
            ownedSaved.set(productId, { owned: node.data.owned, ownedCount: node.data.ownedCount });
        }
        node.setData({ ...node.data, owned, ownedCount });

        const prev = ownedSaveQueues.get(productId) || Promise.resolve();
        const next = prev.then(async () => {
            // 뒤에 같은 제품의 변경이 더 쌓여 있으면 마지막 것만 보내면 되므로 건너뛴다
            if (ownedSaveQueues.get(productId) !== next) return;
            try {
                const updated = await Api.put(`/api/user/products/${productId}`, buildUpdateBody(node.data));
                ownedSaved.set(productId, { owned: updated.owned, ownedCount: updated.ownedCount });
                // 응답을 기다리는 동안 다시 바뀌었다면 화면 값을 유지한다
                if (ownedSaveQueues.get(productId) === next) node.setData({ ...node.data, ...updated });
            } catch (e) {
                Toast.error(e.message);
                if (ownedSaveQueues.get(productId) === next) node.setData({ ...node.data, ...ownedSaved.get(productId) });
            } finally {
                if (ownedSaveQueues.get(productId) === next) ownedSaveQueues.delete(productId);
            }
        });
        ownedSaveQueues.set(productId, next);
    }

    async function toggleAssembled(data, node) {
        const productId = isLoggedIn ? data.product?.id : null;
        if (!productId) return;
        const body = buildUpdateBody(data, 'assembled', !data.assembled);
        try {
            const updated = await Api.put(`/api/user/products/${productId}`, body);
            node.setData({ ...data, ...updated });
        } catch (e) {
            Toast.error(e.message);
        }
    }

    async function toggleDecalAttached(data, node) {
        const productId = isLoggedIn ? data.product?.id : null;
        if (!productId) return;
        const body = buildUpdateBody(data, 'decalAttached', !data.decalAttached);
        try {
            const updated = await Api.put(`/api/user/products/${productId}`, body);
            node.setData({ ...data, ...updated });
        } catch (e) {
            Toast.error(e.message);
        }
    }

    async function onCellValueChanged(params) {
        if (!isLoggedIn || revertingCell) return;
        const data = params.data;
        const productId = data.product?.id;
        if (!productId) return;

        if (params.colDef.colId === 'purchaseAmount') {
            const val = params.newValue;
            if (val !== null && val !== undefined && (val < 0 || val > 10000000)) {
                Toast.error('구매가격은 0원 이상 1천만원 이하로 입력해주세요.');
                revertingCell = true;
                params.node.setDataValue(params.colDef.field, params.oldValue);
                revertingCell = false;
                return;
            }
        }

        const body = buildUpdateBody(data, params.colDef.field, params.newValue);
        try {
            const updated = await Api.put(`/api/user/products/${productId}`, body);
            params.node.setData({ ...data, ...updated });
        } catch (e) {
            Toast.error(e.message);
            revertingCell = true;
            params.node.setDataValue(params.colDef.field, params.oldValue);
            revertingCell = false;
        }
    }

    function buildUpdateBody(data, changedField, changedValue) {
        const d = changedField ? { ...data, [changedField]: changedValue } : data;
        return {
            owned: d.owned ?? false,
            ownedCount: d.owned ? (d.ownedCount ?? 1) : 0,
            assembled: d.assembled ?? false,
            decalAttached: d.decalAttached ?? false,
            purchaseDate: d.purchaseDate || null,
            purchasePlace: d.purchasePlace || null,
            purchaseCurrency: null,
            purchasePrice: d.purchasePrice != null && d.purchasePrice !== '' ? Number(d.purchasePrice) : null,
            decal: d.decal || null,
        };
    }

    // ---- Data loading ----

    async function loadProducts() {
        try {
            const apiUrl = isLoggedIn ? '/api/user/products' : '/api/products';
            gridApi.setGridOption('rowData', await Api.get(apiUrl));
        } catch (e) {
            Toast.error(e.message);
        }
    }

    // 새로고침: 검색/정렬 조건을 초기화하고 서버에서 목록을 다시 가져옴
    async function refreshProducts() {
        const btn = document.getElementById('btn-refresh');
        const icon = btn.querySelector('i');
        btn.disabled = true;
        icon.className = 'fa-solid fa-spinner fa-spin';
        try {
            ['search-category', 'search-grade', 'search-model', 'search-name', 'search-series', 'search-owned', 'search-keyword-mobile'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            gridApi.applyColumnState({
                state: [{ colId: 'releaseDate', sort: 'desc', sortIndex: 0 }],
                defaultState: { sort: null },
            });
            await loadProducts();
            gridApi.onFilterChanged();
            gridApi.refreshCells({ force: true });
        } finally {
            btn.disabled = false;
            icon.className = 'fa-solid fa-rotate';
        }
    }

    // ---- Detail popup (mobile/tablet) ----

    function openDetailPopup(data) {
        const p = getProd(data);
        detailProduct = p;

        // Box art: 중간 크기 이미지 표시 (여러 장이면 < > 로 넘겨 보고, 누르면 원본을 라이트박스로 본다)
        renderDetailBoxArt(boxArtMediumUrlsOf(p), boxArtUrlsOf(p), 0);

        const rows = [
            ['구분',    p?.category?.name || '-'],
            ['등급',       p?.grade || '-'],
            ['형식번호', p?.modelNumber || '-'],
            ['제품명',        p?.name || '-'],
            ['발매년월', formatReleaseDate(p?.releaseYear, p?.releaseMonth) || '-'],
            ['출시가격',       (p?.currency && p?.price != null) ? formatPrice(p.currency, p.price) : '-'],
        ];
        let tableHtml = rows.map(([k, v]) =>
            `<tr><td>${escHtml(k)}</td><td>${escHtml(String(v))}</td></tr>`
        ).join('');
        // 출처 → 매뉴얼 순으로 그리드와 같은 아이콘을 전부 나란히 건다 (여러 개면 아이콘 오른쪽 아래에 번호)
        const gtmAttrs = `data-gtm-product-id="${escHtml(String(p?.id ?? ''))}"`;
        tableHtml += detailIconRow('출처', p?.sourceUrls, 'fa-link', `class="gtm-modal-detail-source" ${gtmAttrs}`);
        tableHtml += detailIconRow('매뉴얼', p?.manualUrls, 'fa-book-open', `class="gtm-modal-detail-manual" ${gtmAttrs}`);
        document.getElementById('detail-table').innerHTML = tableHtml;

        document.getElementById('modal-detail').classList.add('active');
        PopupNav.open(closeDetailPopup);
    }

    // 상세 팝업의 링크 행 — 링크가 없으면 행을 만들지 않는다
    function detailIconRow(label, urls, icon, attrs) {
        if (!urls || !urls.length) return '';
        const links = urls
            .map((url, i) => `<a href="${escHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer" ${attrs}
                  title="${label} ${i + 1}" style="color:var(--accent);font-size:14px;margin-right:10px"
                  onclick="event.stopPropagation()"><i class="fa-solid ${icon}"></i>${manualIndexHtml(urls.length, i)}</a>`)
            .join('');
        return `<tr><td>${label}</td><td>${links}</td></tr>`;
    }

    function closeDetailPopup() {
        document.getElementById('modal-detail').classList.remove('active');
        PopupNav.close();
    }

    // ---- 바리에이션 구성도 팝업 ----

    // Drawflow 는 연결선 위치를 화면에 그려진 카드로 계산하므로 팝업을 띄운 뒤에 만든다 (한 번 만들어 계속 재사용)
    let variationEditor = null;

    async function openVariationPopup(product) {
        if (!product) return;
        let variation;
        try {
            variation = await Api.get(`/api/products/${product.id}/variation`);
        } catch (e) {
            Toast.error(e.message);
            return;
        }
        document.getElementById('modal-variation-title').textContent = `바리에이션 구성도 · ${variation.name}`;
        document.getElementById('modal-variation').classList.add('active');
        PopupNav.open(closeVariationPopup);

        const board = document.getElementById('variation-board');
        if (!variationEditor) {
            variationEditor = VariationTree.create(board, { mode: 'view' });
            VariationTree.addZoomControls(variationEditor, board);
        }
        VariationTree.load(variationEditor, variation, { currentProductId: product.id, ownedProductIds: ownedProductIds() });
        VariationTree.fit(variationEditor);
    }

    // 로그인 사용자는 구성도 카드에 보유 표시를 한다 — 그리드에 이미 불러온 보유 정보를 쓴다
    function ownedProductIds() {
        const ids = new Set();
        if (!isLoggedIn) return ids;
        gridApi.forEachNode(node => {
            if (node.data?.owned) ids.add(node.data.product.id);
        });
        return ids;
    }

    function closeVariationPopup() {
        document.getElementById('modal-variation').classList.remove('active');
        PopupNav.close();
    }

    // ---- Box art 목록 ----

    // 제품의 원본 박스아트 URL 목록 (정렬 순서대로) — boxArts 가 없으면 대표 이미지 한 장
    function boxArtUrlsOf(p) {
        if (p?.boxArts?.length) return p.boxArts.map(b => b.url);
        return p?.boxArtUrl ? [p.boxArtUrl] : [];
    }

    // 제품의 중간 크기 박스아트 URL 목록 (boxArtUrlsOf 와 같은 순서) — 화면 표시용
    function boxArtMediumUrlsOf(p) {
        if (p?.boxArts?.length) return p.boxArts.map(b => b.mediumUrl || b.url);
        const url = p?.boxArtMediumUrl || p?.boxArtUrl;
        return url ? [url] : [];
    }

    // 목록 끝에서 넘기면 반대쪽 끝으로 돌아간다
    function wrapIndex(index, length) {
        return (index + length) % length;
    }

    function boxArtNavHtml(index, length) {
        if (length < 2) return '';
        return `<button type="button" class="boxart-nav boxart-nav-prev gtm-modal-detail-boxart-prev" aria-label="이전 이미지"><i class="fa-solid fa-chevron-left"></i></button>
            <button type="button" class="boxart-nav boxart-nav-next gtm-modal-detail-boxart-next" aria-label="다음 이미지"><i class="fa-solid fa-chevron-right"></i></button>
            <span class="boxart-counter">${index + 1} / ${length}</span>`;
    }

    // urls 는 화면에 보여줄 중간 크기 이미지, originalUrls 는 이미지를 눌렀을 때 라이트박스로 볼 원본 (같은 순서)
    function renderDetailBoxArt(urls, originalUrls, index) {
        const boxartEl = document.getElementById('detail-boxart');
        if (!urls.length) {
            boxartEl.innerHTML = `<div class="detail-boxart-placeholder">NO IMAGE</div>`;
            return;
        }
        boxartEl.innerHTML = `<div class="boxart-carousel">
            <img src="${escHtml(urls[index])}" alt="boxart">
            ${boxArtNavHtml(index, urls.length)}
        </div>`;
        boxartEl.querySelector('img').addEventListener('click', () => openLightbox(originalUrls, index));
        boxartEl.querySelector('.boxart-nav-prev')?.addEventListener('click', () =>
            renderDetailBoxArt(urls, originalUrls, wrapIndex(index - 1, urls.length)));
        boxartEl.querySelector('.boxart-nav-next')?.addEventListener('click', () =>
            renderDetailBoxArt(urls, originalUrls, wrapIndex(index + 1, urls.length)));
        if (urls.length > 1) {
            bindSwipe(boxartEl.querySelector('.boxart-carousel'), step =>
                renderDetailBoxArt(urls, originalUrls, wrapIndex(index + step, urls.length)));
        }
    }

    // 모바일에서 좌우로 밀어 넘긴다 — 세로 스크롤과 구분하기 위해 가로 이동이 충분히 클 때만 반응
    function bindSwipe(el, onStep) {
        if (!el) return;
        let startX = null;
        let startY = null;
        el.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });
        el.addEventListener('touchend', e => {
            if (startX === null) return;
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            startX = null;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) onStep(dx < 0 ? 1 : -1);
        });
    }

    // ---- Lightbox ----

    function closeLightbox() {
        const img = document.getElementById('lightbox-img');
        img.onload = null;
        img.onerror = null;
        img.src = '';
        img.style.display = 'none';
        document.getElementById('lightbox-spinner').style.display = '';
        document.getElementById('lightbox-overlay').classList.remove('active');
        lightboxUrls = [];
        PopupNav.close();
    }

    // url 하나 또는 URL 목록을 받는다 — 목록이 두 장 이상이면 < > 버튼과 장수를 보여준다
    window.openLightbox = function (urls, index = 0) {
        lightboxUrls = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
        if (!lightboxUrls.length) return;
        showLightboxImage(index);
        document.getElementById('lightbox-overlay').classList.add('active');
        PopupNav.open(closeLightbox);
    };

    function showLightboxImage(index) {
        lightboxIndex = wrapIndex(index, lightboxUrls.length);
        const multiple = lightboxUrls.length > 1;
        document.getElementById('lightbox-prev').hidden = !multiple;
        document.getElementById('lightbox-next').hidden = !multiple;
        const counter = document.getElementById('lightbox-counter');
        counter.hidden = !multiple;
        counter.textContent = `${lightboxIndex + 1} / ${lightboxUrls.length}`;

        const url = lightboxUrls[lightboxIndex];
        const img = document.getElementById('lightbox-img');
        const spinner = document.getElementById('lightbox-spinner');
        img.onload = null;
        img.onerror = null;
        img.style.display = 'none';
        spinner.style.display = '';
        img.onload = () => { spinner.style.display = 'none'; img.style.display = ''; };
        img.onerror = () => { spinner.style.display = 'none'; img.style.display = ''; };
        img.src = url;
    }

    function isLightboxOpen() {
        return document.getElementById('lightbox-overlay')?.classList.contains('active');
    }

    // ---- Init ----

    document.addEventListener('DOMContentLoaded', async () => {
        isLoggedIn = window.USER_LOGGED_IN === true;
        initGrid();

        if (isMobileView()) {
            setTabMode(true);
            const toggleEl = document.getElementById('view-mode-toggle');
            if (toggleEl) toggleEl.style.display = 'none';
        }

        const applyFilter = () => {
            gridApi.onFilterChanged();
            setTimeout(() => gridApi.refreshCells({ force: true }), 0);
        };

        const debouncedApplyFilter = debounce(applyFilter, 300);
        ['search-name', 'search-model', 'search-series', 'search-keyword-mobile'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', debouncedApplyFilter);
            el.addEventListener('keypress', e => { if (e.key === 'Enter') applyFilter(); });
        });

        document.getElementById('btn-refresh')?.addEventListener('click', refreshProducts);

        ['search-category', 'search-grade', 'search-owned'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', applyFilter);
        });

        document.getElementById('view-mode-toggle')?.addEventListener('click', e => {
            const btn = e.target.closest('.mode-btn');
            if (!btn || btn.classList.contains('active')) return;
            desktopTabMode = btn.dataset.mode === 'tab';
            setTabMode(desktopTabMode);
        });

        document.getElementById('grade-tabs')?.addEventListener('click', e => {
            const btn = e.target.closest('.grade-tab');
            if (!btn || btn.classList.contains('active')) return;
            setActiveTab(btn.dataset.grade);
        });

        document.getElementById('modal-detail-close')?.addEventListener('click', closeDetailPopup);
        document.getElementById('modal-detail')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeDetailPopup();
        });

        document.getElementById('modal-variation-close')?.addEventListener('click', closeVariationPopup);
        document.getElementById('modal-variation')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeVariationPopup();
        });

        document.getElementById('lightbox-overlay')?.addEventListener('click', closeLightbox);
        // < > 버튼은 배경 클릭(닫기)으로 전달되지 않게 막는다
        document.getElementById('lightbox-prev')?.addEventListener('click', e => {
            e.stopPropagation();
            showLightboxImage(lightboxIndex - 1);
        });
        document.getElementById('lightbox-next')?.addEventListener('click', e => {
            e.stopPropagation();
            showLightboxImage(lightboxIndex + 1);
        });
        bindSwipe(document.getElementById('lightbox-overlay'), step => {
            if (lightboxUrls.length > 1) showLightboxImage(lightboxIndex + step);
        });
        document.addEventListener('keydown', e => {
            if (!isLightboxOpen() || lightboxUrls.length < 2) return;
            if (e.key === 'ArrowLeft') showLightboxImage(lightboxIndex - 1);
            if (e.key === 'ArrowRight') showLightboxImage(lightboxIndex + 1);
        });

        await Promise.all([loadCategories(), loadProducts()]);

        // 제품 등록/수정 요청 — 로그인 사용자에게만 팝업 스크립트가 로드된다
        // 어드민 제품 추가/수정과 같은 팝업을 요청 모드(requestMode)로 사용한다
        if (typeof ProductModal !== 'undefined') {
            ProductModal.init({ categories: allCategories, mode: 'request' });
            document.getElementById('btn-product-request')?.addEventListener('click', () => {
                ProductModal.openAdd();
            });
            document.getElementById('btn-detail-modify-request')?.addEventListener('click', () => {
                if (!detailProduct) return;
                // 상세 팝업 위에 겹쳐 띄우지 않고 닫은 뒤 요청 팝업으로 넘어간다
                const product = detailProduct;
                closeDetailPopup();
                ProductModal.openEdit(product);
            });
        }

        const HINT_KEY = 'hint:detail-popup';
        if (!localStorage.getItem(HINT_KEY)) {
            setTimeout(() => {
                Toast.info('제품명을 클릭하면 상세 정보를 볼 수 있어요');
                localStorage.setItem(HINT_KEY, '1');
            }, 1000);
        }
    });

})();
