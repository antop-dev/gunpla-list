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
        const orig = p?.boxArtUrl;
        if (url) {
            this.eGui.innerHTML = `<img src="${escHtml(url)}" alt="thumb" onclick="openLightbox('${escHtml(orig)}')" style="cursor:zoom-in">`;
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
        this.eGui.innerHTML = `
            <div class="name-line1"><span class="name-text">${highlightText(name, nameKw)}</span></div>
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

    function OwnedRenderer() {}
    OwnedRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    OwnedRenderer.prototype.getGui = function () { return this.eGui; };
    OwnedRenderer.prototype.refresh = function (params) {
        if (!isLoggedIn) {
            this.eGui.className = '';
            this.eGui.textContent = '-';
        } else if (params.data.owned) {
            this.eGui.className = 'cell-owned-yes';
            this.eGui.textContent = '보유';
        } else {
            this.eGui.className = 'cell-owned-no';
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
        if (!isLoggedIn) {
            this.eGui.className = '';
            this.eGui.textContent = '-';
        } else if (params.data.assembled) {
            this.eGui.className = 'cell-owned-yes';
            this.eGui.textContent = '조립';
        } else {
            this.eGui.className = 'cell-owned-no';
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
        if (!isLoggedIn) {
            this.eGui.className = '';
            this.eGui.textContent = '-';
        } else if (params.data.decalAttached) {
            this.eGui.className = 'cell-owned-yes';
            this.eGui.textContent = '부착';
        } else {
            this.eGui.className = 'cell-owned-no';
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
        this.eGui.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%';
        this.refresh(params);
    };
    ManualRenderer.prototype.getGui = function () { return this.eGui; };
    ManualRenderer.prototype.refresh = function (params) {
        const url = getProd(params.data)?.manualUrl;
        this.eGui.innerHTML = url
            ? `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer"
                  style="color:var(--accent);font-size:14px"
                  onclick="event.stopPropagation()">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
               </a>`
            : '';
        return true;
    };

    function SourceRenderer() {}
    SourceRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%';
        this.refresh(params);
    };
    SourceRenderer.prototype.getGui = function () { return this.eGui; };
    SourceRenderer.prototype.refresh = function (params) {
        const url = getProd(params.data)?.sourceUrl;
        this.eGui.innerHTML = url
            ? `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer"
                  style="color:var(--accent);font-size:14px"
                  onclick="event.stopPropagation()">
                <i class="fa-solid fa-link"></i>
               </a>`
            : '';
        return true;
    };

    // ---- Column definitions ----

    function buildColDefs() {
        const mobile = isMobileView();

        const center = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const left   = { display: 'flex', alignItems: 'center' };
        const right  = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };

        return [
            {
                colId: 'boxArt',
                field: 'boxArtThumbUrl',
                headerName: '박스아트',
                cellRenderer: BoxArtRenderer,
                width: 100, resizable: false,
                sortable: false,
                hide: mobile && isLoggedIn,
                pinned: mobile ? null : 'left',
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
                pinned: mobile ? null : 'left',
                cellStyle: left,
            },
            {
                colId: 'name',
                field: 'name',
                headerName: '제품명',
                flex: mobile ? 1 : undefined,
                width: mobile ? undefined : 400,
                minWidth: 200,
                cellRenderer: NameCellRenderer,
                pinned: mobile ? null : 'left',
                sortable: true,
                valueGetter: p => getProd(p.data)?.name,
                getQuickFilterText: params => {
                    const p = getProd(params.data);
                    return [p?.name, p?.grade, p?.category?.name, p?.modelNumber].filter(Boolean).join(' ');
                },
                cellStyle: { ...left, cursor: 'pointer' },
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
                width: 70, resizable: false,
                sortable: false, filter: false,
                headerClass: 'header-center',
                hide: mobile,
                cellStyle: center,
            },
            {
                colId: 'manual',
                headerName: '매뉴얼',
                cellRenderer: ManualRenderer,
                width: 80, resizable: false,
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
                hide: mobile && !isLoggedIn,
                cellStyle: { ...center, cursor: isLoggedIn ? 'pointer' : 'default' },
            },
            {
                colId: 'assembled',
                field: 'assembled',
                headerName: '조립',
                cellRenderer: AssembledRenderer,
                width: 100, resizable: false,
                headerClass: 'header-center',
                pinned: null,
                hide: mobile && !isLoggedIn,
                cellStyle: { ...center, cursor: isLoggedIn ? 'pointer' : 'default' },
            },
            {
                colId: 'purchaseDate',
                field: 'purchaseDate',
                headerName: '구매일자',
                width: 130, resizable: false,
                editable: isLoggedIn,
                cellEditor: DateCellEditor,
                headerClass: 'header-center',
                hide: mobile,
                cellStyle: center,
                valueFormatter: p => p.value ? String(p.value).replace(/-/g, '.') : '',
            },
            {
                colId: 'purchasePlace',
                field: 'purchasePlace',
                headerName: '구매처',
                width: 120, minWidth: 80,
                editable: isLoggedIn,
                hide: mobile,
                cellStyle: left,
            },
            {
                colId: 'purchaseAmount',
                field: 'purchasePrice',
                headerName: '구매가격',
                width: 140, minWidth: 100,
                headerClass: 'header-right',
                hide: mobile,
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
                colId: 'decalAttached',
                field: 'decalAttached',
                headerName: '데칼',
                cellRenderer: DecalAttachedRenderer,
                width: 100, resizable: false,
                headerClass: 'header-center',
                pinned: null,
                hide: mobile && !isLoggedIn,
                cellStyle: { ...center, cursor: isLoggedIn ? 'pointer' : 'default' },
            },
            {
                colId: 'decal',
                field: 'decal',
                headerName: '데칼 브랜드',
                width: 240, minWidth: 80,
                editable: isLoggedIn,
                hide: mobile,
                cellStyle: left,
            },
            {
                colId: 'filler',
                headerName: '', flex: 1,
                sortable: false, resizable: false, filter: false,
                hide: mobile,
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
            const keyword = document.getElementById('search-keyword-mobile')?.value.trim().toLowerCase();
            if (keyword) {
                const haystack = [p?.modelNumber, p?.name].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(keyword)) return false;
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
        if (name && !p?.name?.toLowerCase().includes(name)) return false;
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
            const validGrades = ['HG', 'RG', 'MG', 'MGEX', 'PG'];
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
        const categories = await Api.get('/api/categories');
        const sel = document.getElementById('search-category');
        if (!sel) return;
        sel.innerHTML = `<option value="">구분 전체</option>` +
            categories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
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

        gridApi.applyColumnState({
            state: [
                { colId: 'boxArt',          hide: mobile && isLoggedIn,  pinned: mobile ? null : 'left' },
                { colId: 'modelNumber',     hide: mobile,                 pinned: mobile ? null : 'left' },
                { colId: 'name',            hide: false,                  pinned: mobile ? null : 'left', flex: mobile ? 1 : null, width: mobile ? undefined : 300 },
                { colId: 'releaseDate',     hide: mobile,                 pinned: null },
                { colId: 'price',           hide: mobile,                 pinned: null },
                { colId: 'series',          hide: mobile,                 pinned: null }, // 출연작
                { colId: 'source',          hide: mobile,                 pinned: null }, // 출처
                { colId: 'manual',          hide: mobile,                 pinned: null },
                { colId: 'owned',           hide: mobile && !isLoggedIn,  pinned: null },
                { colId: 'assembled',       hide: mobile && !isLoggedIn,  pinned: null },
                { colId: 'purchaseDate',    hide: mobile,                 pinned: null },
                { colId: 'purchasePlace',   hide: mobile,                 pinned: null },
                { colId: 'purchaseAmount',  hide: mobile,                 pinned: null },
                { colId: 'decalAttached',   hide: mobile && !isLoggedIn,  pinned: null },
                { colId: 'decal',           hide: mobile,                 pinned: null },
                { colId: 'filler',          hide: mobile },
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

    // 모바일 뒤로가기로 팝업을 닫기 위해 pushState 했는지 추적
    let _historyPopupPushed = false;

    function pushPopupHistory() {
        history.pushState({ popup: true }, '');
        _historyPopupPushed = true;
    }

    function popPopupHistory() {
        if (_historyPopupPushed) {
            _historyPopupPushed = false;
            history.back();
        }
    }

    function onCellClicked(params) {
        const colId = params.colDef.colId;

        if (colId === 'name') {
            openDetailPopup(params.data);
        } else if (colId === 'owned' && isLoggedIn) {
            toggleOwned(params.data, params.node);
        } else if (colId === 'assembled' && isLoggedIn) {
            toggleAssembled(params.data, params.node);
        } else if (colId === 'decalAttached' && isLoggedIn) {
            toggleDecalAttached(params.data, params.node);
        }
    }

    async function toggleOwned(data, node) {
        const productId = isLoggedIn ? data.product?.id : null;
        if (!productId) return;
        const body = buildUpdateBody(data, 'owned', !data.owned);
        try {
            const updated = await Api.put(`/api/user/products/${productId}`, body);
            node.setData({ ...data, ...updated });
        } catch (e) {
            Toast.error(e.message);
        }
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
        const d = { ...data, [changedField]: changedValue };
        return {
            owned: d.owned ?? false,
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

    // ---- Detail popup (mobile/tablet) ----

    function openDetailPopup(data) {
        const p = getProd(data);

        // Box art: 원본 이미지 표시
        const boxartEl = document.getElementById('detail-boxart');
        if (p?.boxArtUrl) {
            boxartEl.innerHTML = `<img src="${escHtml(p.boxArtUrl)}" alt="boxart">`;
        } else {
            boxartEl.innerHTML = `<div class="detail-boxart-placeholder">NO IMAGE</div>`;
        }

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
        if (p?.manualUrl) {
            tableHtml += `<tr><td>매뉴얼</td><td><a href="${escHtml(p.manualUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${escHtml(p.manualUrl)}</a></td></tr>`;
        }
        document.getElementById('detail-table').innerHTML = tableHtml;

        document.getElementById('modal-detail').classList.add('active');
        pushPopupHistory();
    }

    function closeDetailPopup() {
        document.getElementById('modal-detail').classList.remove('active');
        popPopupHistory();
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
    }

    window.openLightbox = function (url) {
        if (!url) return;
        const img = document.getElementById('lightbox-img');
        const spinner = document.getElementById('lightbox-spinner');
        img.onload = null;
        img.onerror = null;
        img.style.display = 'none';
        spinner.style.display = '';
        img.onload = () => { spinner.style.display = 'none'; img.style.display = ''; };
        img.onerror = () => { spinner.style.display = 'none'; img.style.display = ''; };
        img.src = url;
        document.getElementById('lightbox-overlay').classList.add('active');
        pushPopupHistory();
    };

    // ---- Logout ----

    async function confirmLogout() {
        const ok = await Confirm.show('로그아웃 하시겠습니까?');
        if (ok) document.getElementById('form-logout').submit();
    }

    // ---- Init ----

    document.addEventListener('DOMContentLoaded', async () => {
        isLoggedIn = window.USER_LOGGED_IN === true;
        initGrid();

        if (isMobileView()) {
            setTabMode(true);
            document.getElementById('view-mode-toggle').style.display = 'none';
        }

        const applyFilter = () => {
            gridApi.onFilterChanged();
            setTimeout(() => gridApi.refreshCells({ force: true }), 0);
        };

        document.getElementById('btn-search').addEventListener('click', applyFilter);
        ['search-name', 'search-model', 'search-series', 'search-keyword-mobile'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('keypress', e => { if (e.key === 'Enter') applyFilter(); });
        });

        document.getElementById('btn-clear').addEventListener('click', () => {
            ['search-category', 'search-grade', 'search-model', 'search-name', 'search-series', 'search-owned', 'search-keyword-mobile'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            gridApi.onFilterChanged();
            setTimeout(() => gridApi.refreshCells({ force: true }), 0);
        });

        ['search-category', 'search-grade', 'search-owned'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', applyFilter);
        });

        document.getElementById('view-mode-toggle').addEventListener('click', e => {
            const btn = e.target.closest('.mode-btn');
            if (!btn || btn.classList.contains('active')) return;
            desktopTabMode = btn.dataset.mode === 'tab';
            setTabMode(desktopTabMode);
        });

        document.getElementById('grade-tabs').addEventListener('click', e => {
            const btn = e.target.closest('.grade-tab');
            if (!btn || btn.classList.contains('active')) return;
            setActiveTab(btn.dataset.grade);
        });

        const profileBtn = document.getElementById('btn-profile');
        if (profileBtn) profileBtn.addEventListener('click', confirmLogout);

        document.getElementById('modal-detail-close').addEventListener('click', closeDetailPopup);
        document.getElementById('modal-detail').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeDetailPopup();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (document.getElementById('lightbox-overlay').classList.contains('active')) {
                closeLightbox();
                popPopupHistory();
            } else if (document.getElementById('modal-detail').classList.contains('active')) {
                closeDetailPopup();
            }
        });

        document.getElementById('lightbox-overlay').addEventListener('click', () => {
            closeLightbox();
            popPopupHistory();
        });

        window.addEventListener('popstate', () => {
            if (!_historyPopupPushed) return;
            _historyPopupPushed = false;
            // 브라우저가 이미 히스토리를 되돌렸으므로 history.back() 없이 팝업만 닫음
            if (document.getElementById('lightbox-overlay').classList.contains('active')) {
                closeLightbox();
            } else if (document.getElementById('modal-detail').classList.contains('active')) {
                document.getElementById('modal-detail').classList.remove('active');
            }
        });

        await Promise.all([loadCategories(), loadProducts()]);
    });

})();
