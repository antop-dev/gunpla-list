/* 제품 출시 정보 — gunpla.fyi + 반다이 하비 글로벌 발매 스케줄 등급별 리스트와 DB를 비교한 후보 목록을 보여주고,
 * 각 행에서 바로 제품 추가 팝업(product-modal.js)을 프리필로 띄우거나 박스아트를 구글 이미지에서 검색할 수 있게 함
 * 페이지 진입 시 자동으로 목록을 조회하며, 등급/제품명/확인여부 검색은 콤보 변경 시 즉시,
 * 텍스트 입력은 300ms 디바운스 후 이미 가져온 결과 내에서 필터링됨(재조회 없음, isExternalFilterPresent/doesExternalFilterPass 패턴)
 * "새로고침" 버튼을 누르면 서버에서 목록을 다시 가져옴
 */
(function () {
    let gridApi = null;
    let rowSeq = 0;
    let pendingRow = null;

    // ---- AG Grid cell renderers ----

    function AddRenderer() {}
    AddRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('button');
        this.eGui.className = 'btn btn-sm btn-primary';
        this.eGui.title = '추가';
        this.eGui.innerHTML = '<i class="fa-solid fa-plus"></i>';
        this.eGui.addEventListener('click', () => openAddForRow(params.data));
    };
    AddRenderer.prototype.getGui = function () { return this.eGui; };
    AddRenderer.prototype.refresh = function () { return false; };

    function CheckRenderer() {}
    CheckRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.eGui.title = '클릭해서 확인/미확인 전환';
        this.eGui.addEventListener('click', () => toggleChecked(this.params));
        this.refresh(params);
    };
    CheckRenderer.prototype.getGui = function () { return this.eGui; };
    CheckRenderer.prototype.refresh = function (params) {
        this.params = params;
        const checked = params.data.checked;
        this.eGui.className = checked ? 'cell-checked-yes' : 'cell-checked-no';
        this.eGui.textContent = checked ? '확인' : '미확인';
        return true;
    };

    function BoxArtFindRenderer() {}
    BoxArtFindRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('button');
        this.eGui.className = 'btn btn-sm btn-secondary';
        this.eGui.title = '박스아트 찾기';
        this.eGui.innerHTML = '<i class="fa-solid fa-image"></i>';
        this.eGui.addEventListener('click', () => openBoxArtSearch(params.data));
    };
    BoxArtFindRenderer.prototype.getGui = function () { return this.eGui; };
    BoxArtFindRenderer.prototype.refresh = function () { return false; };

    function ImageRenderer() {}
    ImageRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'cell-boxart';
        const url = params.data.imageUrl;
        if (url) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'thumb';
            img.style.cursor = 'zoom-in';
            img.addEventListener('error', () => {
                params.data.imageUrl = null;
                this.eGui.innerHTML = '<div class="cell-boxart-placeholder">NO IMAGE</div>';
            }, { once: true });
            img.addEventListener('click', () => openLightbox(url));
            this.eGui.appendChild(img);
        } else {
            this.eGui.innerHTML = '<div class="cell-boxart-placeholder">NO IMAGE</div>';
        }
    };
    ImageRenderer.prototype.getGui = function () { return this.eGui; };
    ImageRenderer.prototype.refresh = function () { return false; };

    function GradeRenderer() {}
    GradeRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        const grade = params.data.grade || '';
        const color = GRADE_COLORS[grade] || '#6c7a8d';
        this.eGui.className = 'chip';
        this.eGui.style.cssText = `background:${hexToRgba(color,0.15)};border-color:${color};color:${color}`;
        this.eGui.textContent = grade;
    };
    GradeRenderer.prototype.getGui = function () { return this.eGui; };
    GradeRenderer.prototype.refresh = function () { return false; };

    // 출처(스크래핑 사이트) 이름 → 홈/스케줄 링크. 반다이 하비 글로벌은 한국어 사이트로 연결
    const SOURCE_LINKS = {
        'gunpla.fyi': 'https://gunpla.fyi/?grade=HG%2CRG%2CPG%2CMG%2CMGEX',
        '반다이 하비 글로벌': 'https://global.bandai-hobby.net/kr/schedule/',
    };

    function SourceRenderer() {}
    SourceRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = 'display:flex;align-items:center;height:100%;overflow:hidden';
        this.refresh(params);
    };
    SourceRenderer.prototype.getGui = function () { return this.eGui; };
    SourceRenderer.prototype.refresh = function (params) {
        const source = params.data.source;
        const url = SOURCE_LINKS[source];
        this.eGui.innerHTML = url
            ? `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer"
                  style="color:var(--accent);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(source)}</a>`
            : escHtml(source || '');
        return true;
    };

    function SiteRenderer() {}
    SiteRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = 'display:flex;align-items:center;height:100%;overflow:hidden';
        this.refresh(params);
    };
    SiteRenderer.prototype.getGui = function () { return this.eGui; };
    SiteRenderer.prototype.refresh = function (params) {
        const url = params.data.sourceUrl;
        this.eGui.innerHTML = url
            ? `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" title="${escHtml(url)}"
                  style="color:var(--accent);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(url)}</a>`
            : '';
        return true;
    };

    // ---- Grid init ----

    function initGrid() {
        const gridEl = document.getElementById('product-release-info-grid');
        const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const leftStyle   = { display: 'flex', alignItems: 'center', overflow: 'hidden' };
        const rightStyle  = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };

        const colDefs = [
            {
                headerName: '', pinned: 'left', width: 42,
                resizable: false, sortable: false, filter: false,
                cellRenderer: AddRenderer, cellStyle: centerStyle,
            },
            {
                headerName: '확인여부', width: 90, filter: false,
                cellRenderer: CheckRenderer, cellStyle: centerStyle,
            },
            {
                headerName: '', pinned: 'left', width: 42,
                resizable: false, sortable: false, filter: false,
                cellRenderer: BoxArtFindRenderer, cellStyle: centerStyle,
            },
            {
                headerName: '이미지', width: 100,
                resizable: false, sortable: false, filter: false,
                cellRenderer: ImageRenderer, cellStyle: centerStyle,
            },
            {
                field: 'grade', headerName: '등급', width: 90, filter: false,
                cellRenderer: GradeRenderer, cellStyle: centerStyle,
            },
            {
                field: 'source', headerName: '출처', width: 160, minWidth: 100, filter: false,
                cellRenderer: SourceRenderer, cellStyle: leftStyle,
            },
            {
                field: 'nameEn', headerName: '제품명(영문)', flex: 1, minWidth: 180, filter: false,
                cellStyle: leftStyle,
                valueFormatter: p => p.value || '',
            },
            {
                field: 'nameJp', headerName: '제품명(일본어)', flex: 1, minWidth: 180, filter: false,
                cellStyle: leftStyle,
                valueFormatter: p => p.value || '',
            },
            {
                field: 'nameKo', headerName: '제품명(한글, 번역)', flex: 1, minWidth: 180, filter: false,
                cellStyle: leftStyle,
            },
            {
                headerName: '발매년월', width: 110, filter: false,
                cellStyle: centerStyle,
                valueGetter: p => formatReleaseDate(p.data.releaseYear, p.data.releaseMonth),
            },
            {
                field: 'price', headerName: '출시가격', width: 110, filter: false,
                cellStyle: rightStyle,
                valueFormatter: p => p.value != null ? '¥ ' + p.value.toLocaleString() : '',
            },
            {
                field: 'sourceUrl', headerName: '사이트', width: 260, minWidth: 160, filter: false,
                cellRenderer: SiteRenderer, cellStyle: leftStyle,
            },
        ];

        gridApi = agGrid.createGrid(gridEl, {
            columnDefs: colDefs,
            rowData: [],
            rowHeight: 46,
            headerHeight: 40,
            defaultColDef: { resizable: true, sortable: false },
            animateRows: false,
            enableCellTextSelection: true,
            getRowId: params => String(params.data._rowId),
            overlayLoadingTemplate: '<span style="color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> 불러오는 중...</span>',
            overlayNoRowsTemplate: '<span style="color:var(--text-muted)">누락된 제품이 없습니다.</span>',
            isExternalFilterPresent: isFilterActive,
            doesExternalFilterPass: filterPass,
        });
    }

    // ---- Filter (서버에서 가져온 결과 내에서 등급/제품명/확인여부로 클라이언트 사이드 필터링) ----

    function isFilterActive() {
        return !!(
            document.getElementById('search-grade')?.value ||
            document.getElementById('search-name')?.value.trim() ||
            document.getElementById('search-checked')?.value
        );
    }

    function filterPass(node) {
        const grade = document.getElementById('search-grade')?.value;
        const name = document.getElementById('search-name')?.value.trim().toLowerCase();
        const checkedFilter = document.getElementById('search-checked')?.value;
        if (grade && node.data.grade !== grade) return false;
        if (checkedFilter !== '' && String(node.data.checked) !== checkedFilter) return false;
        if (name) {
            const hit = [node.data.nameKo, node.data.nameEn, node.data.nameJp]
                .some(v => v && v.toLowerCase().includes(name));
            if (!hit) return false;
        }
        return true;
    }

    // ---- Search ----

    // 발매년월 내림차순(최신이 위) — 값이 없는 항목은 가장 아래로
    function compareReleaseDateDesc(a, b) {
        const ay = a.releaseYear ?? -Infinity;
        const by = b.releaseYear ?? -Infinity;
        if (ay !== by) return by - ay;
        const am = a.releaseMonth ?? -Infinity;
        const bm = b.releaseMonth ?? -Infinity;
        return bm - am;
    }

    async function search() {
        setSearching(true);
        gridApi.showLoadingOverlay();
        try {
            const rows = await Api.get('/api/admin/product-release-info');
            rows.sort(compareReleaseDateDesc);
            rows.forEach(r => { r._rowId = ++rowSeq; });
            gridApi.setGridOption('rowData', rows);
            Toast.success(`${rows.length}건의 제품 출시 정보를 조회했습니다.`);
        } catch (e) {
            gridApi.hideOverlay();
            Toast.error(e.message);
        } finally {
            setSearching(false);
        }
    }

    function setSearching(loading) {
        const btn = document.getElementById('btn-refresh');
        btn.disabled = loading;
        btn.innerHTML = loading
            ? '<i class="fa-solid fa-spinner fa-spin"></i>'
            : '<i class="fa-solid fa-rotate"></i>';
    }

    // ---- Add / Box art search ----

    function openAddForRow(row) {
        pendingRow = row;
        ProductModal.openAdd({
            grade: row.grade,
            modelNumber: row.modelNumber,
            name: row.nameKo || row.nameEn || row.nameJp,
            releaseYear: row.releaseYear,
            releaseMonth: row.releaseMonth,
            price: row.price,
            series: row.series,
            sourceUrl: row.sourceUrl,
            imageUrl: row.imageUrl,
        });
    }

    async function onProductAdded() {
        if (!pendingRow) return;
        const row = pendingRow;
        pendingRow = null;
        try {
            await Api.put(`/api/admin/product-release-info/check/${encodeURIComponent(row.hash)}`);
            row.checked = true;
            gridApi.applyTransaction({ update: [row] });
            gridApi.onFilterChanged();
        } catch (e) {
            Toast.error('확인 상태 반영 실패: ' + e.message);
        }
    }

    async function toggleChecked(params) {
        const row = params.data;
        const next = !row.checked;
        try {
            if (next) {
                await Api.put(`/api/admin/product-release-info/check/${encodeURIComponent(row.hash)}`);
            } else {
                await Api.delete(`/api/admin/product-release-info/check/${encodeURIComponent(row.hash)}`);
            }
            row.checked = next;
            gridApi.applyTransaction({ update: [row] });
            gridApi.onFilterChanged();
        } catch (e) {
            Toast.error(e.message);
        }
    }

    function openBoxArtSearch(row) {
        const parts = ['gunpla', row.grade, row.releaseYear, row.nameEn, 'boxart'];
        const query = parts.filter(Boolean).join(' ');
        window.open('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query), '_blank', 'noopener');
    }

    // ---- Lightbox ----

    function openLightbox(url) {
        if (!url) return;
        document.getElementById('lightbox-img').src = _url('/api/admin/product-release-info/image?url=' + encodeURIComponent(url));
        document.getElementById('lightbox-overlay').classList.add('active');
    }

    // ---- Init ----

    document.addEventListener('DOMContentLoaded', async () => {
        initGrid();
        document.getElementById('btn-refresh').addEventListener('click', search);
        const applyFilter = () => gridApi.onFilterChanged();
        document.getElementById('search-name').addEventListener('input', debounce(applyFilter, 300));
        document.getElementById('search-name').addEventListener('keypress', e => { if (e.key === 'Enter') applyFilter(); });
        ['search-grade', 'search-checked'].forEach(id => {
            document.getElementById(id).addEventListener('change', applyFilter);
        });
        document.getElementById('lightbox-overlay').addEventListener('click', () => {
            document.getElementById('lightbox-overlay').classList.remove('active');
        });
        const categories = await Api.get('/api/admin/categories');
        ProductModal.init({ categories, onSaved: onProductAdded });
        search();
    });
})();
