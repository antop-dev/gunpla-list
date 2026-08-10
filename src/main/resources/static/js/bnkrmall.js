/* 반다이남코몰(bnkrmall.co.kr) 건프라 목록 — 등급별 카테고리 페이지(HG/RG/MG/PG)와 프리미엄반다이 목록을 스크래핑해
 * 등급/제품명/상태/판매가격/링크를 추출한 순서 그대로 보여줌(DB 비교 없음, 단순 조회 전용)
 * 페이지 진입 시 자동으로 목록을 조회하며, 등급/상태 검색은 콤보 변경 시 즉시,
 * 제품명 검색은 300ms 디바운스 후 이미 가져온 결과 내에서 필터링됨(재조회 없음, isExternalFilterPresent/doesExternalFilterPass 패턴)
 * "새로고침" 버튼을 누르면 서버에서 목록을 다시 가져옴
 */
(function () {
    let gridApi = null;
    let rowSeq = 0;

    const STATUS_COLORS = {
        '판매중': '#6fcf97',
        '예약판매': '#56ccf2',
        '품절': '#6c7a8d',
    };

    // ---- AG Grid cell renderers ----

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

    function StatusRenderer() {}
    StatusRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        const status = params.data.status || '';
        const color = STATUS_COLORS[status] || '#6c7a8d';
        this.eGui.style.cssText = `color:${color};font-weight:600`;
        this.eGui.textContent = status;
    };
    StatusRenderer.prototype.getGui = function () { return this.eGui; };
    StatusRenderer.prototype.refresh = function () { return false; };

    function LinkRenderer() {}
    LinkRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        const url = params.data.url;
        this.eGui.innerHTML = url
            ? `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer"
                  style="color:var(--accent);font-size:13px">바로가기 <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px"></i></a>`
            : '';
    };
    LinkRenderer.prototype.getGui = function () { return this.eGui; };
    LinkRenderer.prototype.refresh = function () { return false; };

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

    // ---- Grid init ----

    function initGrid() {
        const gridEl = document.getElementById('bnkrmall-grid');
        const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const leftStyle   = { display: 'flex', alignItems: 'center', overflow: 'hidden' };
        const rightStyle  = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };

        const colDefs = [
            {
                field: 'grade', headerName: '등급', width: 90, filter: false,
                headerClass: 'header-center',
                cellRenderer: GradeRenderer, cellStyle: centerStyle,
            },
            {
                field: 'imageUrl', headerName: '이미지', width: 100, filter: false,
                resizable: false, sortable: false,
                headerClass: 'header-center',
                cellRenderer: ImageRenderer, cellStyle: centerStyle,
            },
            {
                field: 'url', headerName: '링크', width: 120, filter: false,
                headerClass: 'header-center',
                cellRenderer: LinkRenderer, cellStyle: centerStyle,
            },
            {
                field: 'name', headerName: '제품명', flex: 1, minWidth: 260, filter: false,
                cellStyle: leftStyle,
            },
            {
                field: 'status', headerName: '상태', width: 100, filter: false,
                headerClass: 'header-center',
                cellRenderer: StatusRenderer, cellStyle: centerStyle,
            },
            {
                field: 'price', headerName: '판매가격', width: 120, filter: false,
                headerClass: 'header-right',
                cellStyle: rightStyle,
                valueFormatter: p => p.value != null ? '₩ ' + Number(p.value).toLocaleString() : '',
            },
            {
                headerName: '', flex: 1, resizable: false, sortable: false, filter: false,
            },
        ];

        gridApi = agGrid.createGrid(gridEl, {
            columnDefs: colDefs,
            rowData: [],
            rowHeight: 42,
            headerHeight: 40,
            defaultColDef: { resizable: true, sortable: false },
            animateRows: false,
            enableCellTextSelection: true,
            getRowId: params => String(params.data._rowId),
            overlayLoadingTemplate: '<span style="color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> 불러오는 중...</span>',
            overlayNoRowsTemplate: '<span style="color:var(--text-muted)">조회된 제품이 없습니다.</span>',
            isExternalFilterPresent: isFilterActive,
            doesExternalFilterPass: filterPass,
        });
    }

    // ---- Filter (서버에서 가져온 결과 내에서 등급/제품명/상태로 클라이언트 사이드 필터링) ----

    function isFilterActive() {
        return !!(
            document.getElementById('search-grade')?.value ||
            document.getElementById('search-name')?.value.trim() ||
            document.getElementById('search-status')?.value
        );
    }

    function filterPass(node) {
        const grade = document.getElementById('search-grade')?.value;
        const name = document.getElementById('search-name')?.value.trim().toLowerCase();
        const status = document.getElementById('search-status')?.value;
        if (grade && node.data.grade !== grade) return false;
        if (status && node.data.status !== status) return false;
        if (name && !node.data.name.toLowerCase().includes(name)) return false;
        return true;
    }

    // ---- Search ----

    async function search() {
        setSearching(true);
        gridApi.showLoadingOverlay();
        try {
            const rows = await Api.get('/api/admin/bnkrmall-products');
            rows.forEach(r => { r._rowId = ++rowSeq; });
            gridApi.setGridOption('rowData', rows);
            Toast.success(`${rows.length}건의 제품을 조회했습니다.`);
        } catch (e) {
            gridApi.hideOverlay();
            Toast.error(e.message);
        } finally {
            setSearching(false);
        }
    }

    // ---- Lightbox ----

    function openLightbox(url) {
        if (!url) return;
        document.getElementById('lightbox-img').src = url;
        document.getElementById('lightbox-overlay').classList.add('active');
    }

    function setSearching(loading) {
        const btn = document.getElementById('btn-refresh');
        btn.disabled = loading;
        btn.innerHTML = loading
            ? '<i class="fa-solid fa-spinner fa-spin"></i>'
            : '<i class="fa-solid fa-rotate"></i>';
    }

    // ---- Init ----

    document.addEventListener('DOMContentLoaded', () => {
        initGrid();
        document.getElementById('btn-refresh').addEventListener('click', search);
        const applyFilter = () => gridApi.onFilterChanged();
        document.getElementById('search-name').addEventListener('input', debounce(applyFilter, 300));
        document.getElementById('search-name').addEventListener('keypress', e => { if (e.key === 'Enter') applyFilter(); });
        ['search-grade', 'search-status'].forEach(id => {
            document.getElementById(id).addEventListener('change', applyFilter);
        });
        document.getElementById('lightbox-overlay').addEventListener('click', () => {
            document.getElementById('lightbox-overlay').classList.remove('active');
        });
        search();
    });
})();
