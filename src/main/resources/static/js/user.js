/* User Products Grid */
(function () {
    let gridApi = null;
    let isLoggedIn = false;

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

    function getProd(data) {
        return isLoggedIn ? data.product : data;
    }

    function isMobileView()  { return window.innerWidth < 500; }
    function isTabletView()  { return window.innerWidth >= 500 && window.innerWidth < 1200; }
    function isSmallScreen() { return isMobileView() || isTabletView(); }

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
        const gradeHtml = grade
            ? `<span class="chip" style="background:rgba(108,122,141,0.15);border-color:#6c7a8d;color:#6c7a8d">${escHtml(grade)}</span>`
            : '';
        this.eGui.innerHTML = `
            <div class="name-line1"><span class="name-text">${escHtml(name)}</span><i class="fa-solid fa-circle-info name-detail-icon"></i></div>
            <div class="name-line2">${gradeHtml}${catHtml}</div>
        `;
        this.eGui.style.cursor = 'default';
        const nameLine1 = this.eGui.querySelector('.name-line1');
        if (nameLine1) {
            nameLine1.style.cursor = 'pointer';
            nameLine1.addEventListener('click', (e) => {
                e.stopPropagation();
                openDetailPopup(params.data);
            });
        }
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
                cellStyle: left,
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
                valueGetter: p => getProd(p.data)?.releaseYear,
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
                colId: 'purchaseDate',
                field: 'purchaseDate',
                headerName: '구매일시',
                width: 100, minWidth: 80,
                editable: isLoggedIn,
                headerClass: 'header-center',
                hide: mobile,
                cellStyle: center,
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
                    return v !== '' ? Number(v) : null;
                },
            },
            {
                colId: 'decal',
                field: 'decal',
                headerName: '데칼',
                width: 120, minWidth: 80,
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
        if (isMobileView()) {
            return !!(document.getElementById('search-keyword-mobile')?.value.trim());
        }
        const category = document.getElementById('search-category')?.value;
        const grade    = document.getElementById('search-grade')?.value;
        const model    = document.getElementById('search-model')?.value.trim();
        const name     = document.getElementById('search-name')?.value.trim();
        const owned    = document.getElementById('search-owned')?.value;
        return !!(category || grade || model || name || owned);
    }

    function externalFilterPass(node) {
        const p = getProd(node.data);

        if (isMobileView()) {
            const keyword = document.getElementById('search-keyword-mobile')?.value.trim().toLowerCase();
            if (keyword) {
                const haystack = [p?.grade, p?.modelNumber, p?.name].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(keyword)) return false;
            }
            return true;
        }

        const category = document.getElementById('search-category')?.value;
        const grade    = document.getElementById('search-grade')?.value;
        const model    = document.getElementById('search-model')?.value.trim().toLowerCase();
        const name     = document.getElementById('search-name')?.value.trim().toLowerCase();
        const owned    = document.getElementById('search-owned')?.value;
        if (category && String(p?.category?.id) !== category) return false;
        if (grade && p?.grade !== grade) return false;
        if (model && !p?.modelNumber?.toLowerCase().includes(model)) return false;
        if (name && !p?.name?.toLowerCase().includes(name)) return false;
        if (owned === 'true' && !node.data.owned) return false;
        if (owned === 'false' && !!node.data.owned) return false;
        return true;
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
            defaultColDef: { resizable: true, sortable: true },
            animateRows: true,
            enableCellTextSelection: true,
            singleClickEdit: true,
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

        gridApi.applyColumnState({
            state: [
                { colId: 'boxArt',          hide: mobile && isLoggedIn,  pinned: mobile ? null : 'left' },
                { colId: 'modelNumber',     hide: mobile,                 pinned: mobile ? null : 'left' },
                { colId: 'name',            hide: false,                  pinned: mobile ? null : 'left', flex: mobile ? 1 : null, width: mobile ? undefined : 300 },
                { colId: 'releaseDate',     hide: mobile,                 pinned: null },
                { colId: 'price',           hide: mobile,                 pinned: null },
                { colId: 'manual',          hide: mobile,                 pinned: null },
                { colId: 'owned',           hide: mobile && !isLoggedIn,  pinned: null },
                { colId: 'purchaseDate',    hide: mobile,                 pinned: null },
                { colId: 'purchasePlace',   hide: mobile,                 pinned: null },
                { colId: 'purchaseAmount',  hide: mobile,                 pinned: null },
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

    function onCellClicked(params) {
        const colId = params.colDef.colId;

        if (colId === 'owned' && isLoggedIn) {
            toggleOwned(params.data, params.node);
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

    async function onCellValueChanged(params) {
        if (!isLoggedIn) return;
        const data = params.data;
        const productId = data.product?.id;
        if (!productId) return;

        const body = buildUpdateBody(data, params.colDef.field, params.newValue);
        try {
            const updated = await Api.put(`/api/user/products/${productId}`, body);
            params.node.setData({ ...data, ...updated });
        } catch (e) {
            Toast.error(e.message);
            params.node.setDataValue(params.colDef.field, params.oldValue);
        }
    }

    function buildUpdateBody(data, changedField, changedValue) {
        const d = { ...data, [changedField]: changedValue };
        return {
            owned: d.owned ?? false,
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
    }

    function closeDetailPopup() {
        document.getElementById('modal-detail').classList.remove('active');
    }

    // ---- Lightbox ----

    window.openLightbox = function (url) {
        if (!url) return;
        document.getElementById('lightbox-img').src = url;
        document.getElementById('lightbox-overlay').classList.add('active');
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

        const applyFilter = () => gridApi.onFilterChanged();

        document.getElementById('btn-search').addEventListener('click', applyFilter);
        ['search-name', 'search-model', 'search-keyword-mobile'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('keypress', e => { if (e.key === 'Enter') applyFilter(); });
        });

        document.getElementById('btn-clear').addEventListener('click', () => {
            ['search-category', 'search-grade', 'search-model', 'search-name', 'search-owned', 'search-keyword-mobile'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            gridApi.onFilterChanged();
        });

        ['search-category', 'search-grade', 'search-owned'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', applyFilter);
        });

        const profileBtn = document.getElementById('btn-profile');
        if (profileBtn) profileBtn.addEventListener('click', confirmLogout);

        document.getElementById('modal-detail-close').addEventListener('click', closeDetailPopup);
        document.getElementById('modal-detail').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeDetailPopup();
        });

        document.getElementById('lightbox-overlay').addEventListener('click', () => {
            document.getElementById('lightbox-overlay').classList.remove('active');
        });

        await Promise.all([loadCategories(), loadProducts()]);
    });

})();
