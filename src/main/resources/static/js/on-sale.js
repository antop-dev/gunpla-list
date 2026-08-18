/* 판매제품 모아보기 — 서버가 배치로 스크래핑해 DB에 적재해둔 판매 제품 목록(출처/등급/제품명/상태/판매가격/링크)을 조회만 함
 * (요청마다 대상 사이트를 직접 스크래핑하지 않음 — OnSaleSyncService 참고)
 * 페이지 진입 시 자동으로 목록을 조회하며, 등급/상태 검색은 콤보 변경 시 즉시,
 * 제품명 검색은 300ms 디바운스 후 이미 가져온 결과 내에서 필터링됨(재조회 없음, isExternalFilterPresent/doesExternalFilterPass 패턴)
 * "새로고침" 버튼을 누르면 DB에서 목록을 다시 가져옴(재스크래핑은 아님)
 */
(function () {
    let gridApi = null;
    let rowSeq = 0;

    const STATUS_COLORS = {
        '판매중': '#6fcf97',
        '품절': '#6c7a8d',
    };

    // 출처 표시 순서(반다이남코코리아몰 → 네이버+ 스토어 → PREMIUM BANDAI) — 목록 정렬에 사용
    const SOURCE_ORDER = ['반다이남코코리아몰', '네이버+ 스토어', 'PREMIUM BANDAI'];

    // 목록 기본 정렬: 출처(SOURCE_ORDER) → 판매중 우선 → 최근 갱신순(newSince 내림차순) → 등급 → 제품명
    // newSince 는 최초 등록/품절→판매중 전환 시각(NEW 라벨 기준과 동일)이라 새로 뜬 제품이 각 출처 위쪽에 모임
    function sortRows(rows) {
        const statusRank = row => (row.status === '판매중' ? 0 : 1);
        const newSinceTime = row => (row.newSince ? Date.parse(row.newSince) : 0);
        return rows.slice().sort((a, b) => {
            const sa = SOURCE_ORDER.indexOf(a.source);
            const sb = SOURCE_ORDER.indexOf(b.source);
            if (sa !== sb) return sa - sb;
            if (statusRank(a) !== statusRank(b)) return statusRank(a) - statusRank(b);
            if (newSinceTime(a) !== newSinceTime(b)) return newSinceTime(b) - newSinceTime(a);
            if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
            return a.name.localeCompare(b.name);
        });
    }

    // ---- AG Grid cell renderers ----

    function SourceRenderer() {}
    SourceRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.eGui.textContent = params.data.source || '';
    };
    SourceRenderer.prototype.getGui = function () { return this.eGui; };
    SourceRenderer.prototype.refresh = function () { return false; };

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

    const RESERVATION_COLOR = '#D4AF37';

    function NameRenderer() {}
    NameRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.eGui.appendChild(document.createTextNode(params.value || ''));
        if (params.data.isNew) {
            const badge = document.createElement('span');
            badge.className = 'chip';
            badge.style.cssText = `background:${hexToRgba('#eb5757',0.15)};border-color:#eb5757;color:#eb5757;margin-left:6px`;
            badge.textContent = 'NEW';
            this.eGui.appendChild(badge);
        }
        if (params.data.isReservation) {
            const badge = document.createElement('span');
            badge.className = 'chip';
            badge.style.cssText = `background:${hexToRgba(RESERVATION_COLOR,0.15)};border-color:${RESERVATION_COLOR};color:${RESERVATION_COLOR};margin-left:6px`;
            badge.textContent = params.data.status === '품절' ? '사전예약 종료' : '사전예약';
            this.eGui.appendChild(badge);
        }
    };
    NameRenderer.prototype.getGui = function () { return this.eGui; };
    NameRenderer.prototype.refresh = function () { return false; };

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
        const gridEl = document.getElementById('on-sale-grid');
        const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const leftStyle   = { display: 'flex', alignItems: 'center', overflow: 'hidden' };
        const rightStyle  = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };

        // 번호 이외의 기준으로 정렬할 때, 동점(같은 값)인 행끼리는 항상 번호 내림차순으로 정렬되도록 하는 보조 비교자.
        // AG Grid는 컬럼이 내림차순일 때 comparator의 반환값 부호를 자동으로 뒤집으므로,
        // isDescending일 때 부호를 미리 반대로 만들어둬야 최종 결과가 항상 "번호 내림차순"으로 유지됨
        function withNoTiebreak(primaryCompare) {
            return (valueA, valueB, nodeA, nodeB, isDescending) => {
                const primary = primaryCompare(valueA, valueB, nodeA, nodeB);
                if (primary !== 0) return primary;
                const noA = nodeA?.data?.no ?? 0;
                const noB = nodeB?.data?.no ?? 0;
                return isDescending ? (noA - noB) : (noB - noA);
            };
        }
        const compareText = (a, b) => String(a ?? '').localeCompare(String(b ?? ''));
        // 등급은 알파벳순이 아니라 GRADE_COLORS(common.js)에 정의된 순서(HG < RG < MG < MGEX < PG)를 따름
        const GRADE_ORDER = Object.keys(GRADE_COLORS);
        const compareGrade = (a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b);

        const colDefs = [
            {
                field: 'no', headerName: '번호', width: 70, filter: false, sortable: true, sort: 'desc', resizable: false,
                headerClass: 'header-right',
                cellStyle: rightStyle,
                // 표시값은 화면에 보이는(필터링된) 행 기준으로 매번 다시 계산 — 빈틈없이 항상 N~1
                valueGetter: params => params.api.getDisplayedRowCount() - (params.node.rowIndex ?? 0),
                // 정렬은 표시값이 아니라 고정된 no 필드로 판단(표시값은 rowIndex 의존이라 정렬 기준으로 쓰면 자기참조가 됨)
                comparator: (valueA, valueB, nodeA, nodeB) => (nodeA?.data?.no ?? 0) - (nodeB?.data?.no ?? 0),
            },
            {
                field: 'imageUrl', headerName: '이미지', width: 100, filter: false,
                resizable: false, sortable: false,
                headerClass: 'header-center',
                cellRenderer: ImageRenderer, cellStyle: centerStyle,
            },
            {
                field: 'grade', headerName: '등급', width: 90, filter: false, sortable: true,
                headerClass: 'header-center',
                cellRenderer: GradeRenderer, cellStyle: centerStyle,
                comparator: withNoTiebreak(compareGrade),
            },
            {
                field: 'name', headerName: '제품명', flex: 1, minWidth: 260, filter: false, sortable: true,
                cellRenderer: NameRenderer, cellStyle: leftStyle,
                comparator: withNoTiebreak(compareText),
            },
            {
                field: 'status', headerName: '상태', width: 100, filter: false, sortable: true,
                headerClass: 'header-center',
                cellRenderer: StatusRenderer, cellStyle: centerStyle,
                comparator: withNoTiebreak(compareText),
            },
            {
                field: 'price', headerName: '판매가격', width: 120, filter: false, sortable: true,
                headerClass: 'header-right',
                cellStyle: rightStyle,
                // 달러는 원화 환산(*1500) 기준으로 정렬
                comparator: withNoTiebreak((valueA, valueB, nodeA, nodeB) => {
                    const toKrw = data => (data?.currency === 'USD' ? (data.price ?? 0) * 1500 : (data?.price ?? 0));
                    return toKrw(nodeA?.data) - toKrw(nodeB?.data);
                }),
                valueFormatter: p => {
                    if (p.value == null) return '';
                    const currency = p.data?.currency || 'KRW';
                    return currency === 'USD'
                        ? '$ ' + Number(p.value).toFixed(2)
                        : '₩ ' + Number(p.value).toLocaleString();
                },
            },
            {
                field: 'source', headerName: '출처', width: 150, filter: false, sortable: true,
                cellRenderer: SourceRenderer, cellStyle: leftStyle,
                comparator: withNoTiebreak(compareText),
            },
            {
                field: 'url', headerName: '링크', width: 120, filter: false,
                headerClass: 'header-center',
                cellRenderer: LinkRenderer, cellStyle: centerStyle,
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
            // '번호' 컬럼의 valueGetter는 rowIndex/표시행수에 의존하는데 AG Grid는 이를 자동으로 알지 못해
            // 필터/정렬이 바뀌어도 이미 렌더된 행의 값을 캐시된 채로 남겨둠 → 매번 강제로 다시 계산시킴
            onSortChanged: () => gridApi.refreshCells({ columns: ['no'], force: true }),
            onFilterChanged: () => gridApi.refreshCells({ columns: ['no'], force: true }),
        });
    }

    // ---- Filter (서버에서 가져온 결과 내에서 등급/제품명/상태로 클라이언트 사이드 필터링) ----

    function isFilterActive() {
        return !!(
            document.getElementById('search-source')?.value ||
            document.getElementById('search-grade')?.value ||
            document.getElementById('search-name')?.value.trim() ||
            document.getElementById('search-status')?.value
        );
    }

    function filterPass(node) {
        const source = document.getElementById('search-source')?.value;
        const grade = document.getElementById('search-grade')?.value;
        const name = document.getElementById('search-name')?.value.trim().toLowerCase();
        const status = document.getElementById('search-status')?.value;
        if (source && node.data.source !== source) return false;
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
            const rows = sortRows(await Api.get('/api/on-sale-products'));
            // 기본 정렬(출처/판매중/최근갱신/등급/제품명순) 기준 역순 번호 — 맨 위 항목이 가장 큰 번호
            rows.forEach((r, i) => {
                r._rowId = ++rowSeq;
                r.no = rows.length - i;
            });
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

    // ---- Hover preview (행에 마우스오버 시 이미지 칸을 5배 확대해 그리드 밖 오버레이로 표시) ----
    // 이미지 열의 왼쪽 시작점 + 행의 상단에 맞춰 표시 — 미리보기 최대 크기(500x250)를
    // 기준으로 화면 밖으로 벗어나지 않게 좌표를 clamp함
    const PREVIEW_WIDTH = 500;
    const PREVIEW_HEIGHT = 250;
    const PREVIEW_MARGIN = 8;

    function initHoverPreview(gridEl) {
        const preview = document.getElementById('hover-preview');
        const previewImg = document.getElementById('hover-preview-img');
        let activeRow = null;

        const isInside = el => !!el && ((activeRow && activeRow.contains(el)) || preview.contains(el));

        function hide() {
            activeRow = null;
            preview.classList.remove('active');
        }

        function clampLeft(left) {
            const max = Math.max(PREVIEW_MARGIN, window.innerWidth - PREVIEW_WIDTH - PREVIEW_MARGIN);
            return Math.min(Math.max(left, PREVIEW_MARGIN), max);
        }

        function clampTop(top) {
            const max = Math.max(PREVIEW_MARGIN, window.innerHeight - PREVIEW_HEIGHT - PREVIEW_MARGIN);
            return Math.min(Math.max(top, PREVIEW_MARGIN), max);
        }

        gridEl.addEventListener('mouseover', e => {
            const rowEl = e.target.closest('.ag-row');
            if (!rowEl || rowEl === activeRow) return;
            const boxartEl = rowEl.querySelector('.cell-boxart');
            const img = boxartEl?.querySelector('img');
            if (!img) return;
            activeRow = rowEl;
            const rect = boxartEl.getBoundingClientRect();
            previewImg.src = img.src;
            preview.style.left = clampLeft(rect.left) + 'px';
            preview.style.top = clampTop(rect.top) + 'px';
            preview.classList.add('active');
        });

        gridEl.addEventListener('mouseout', e => {
            if (!activeRow || isInside(e.relatedTarget)) return;
            hide();
        });

        preview.addEventListener('mouseleave', e => {
            if (isInside(e.relatedTarget)) return;
            hide();
        });

        previewImg.addEventListener('click', () => {
            const url = previewImg.src;
            hide();
            openLightbox(url);
        });

        return { hide };
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
        const hoverPreview = initHoverPreview(document.getElementById('on-sale-grid'));
        document.getElementById('btn-refresh').addEventListener('click', search);
        const applyFilter = () => gridApi.onFilterChanged();
        document.getElementById('search-name').addEventListener('input', debounce(applyFilter, 300));
        document.getElementById('search-name').addEventListener('keypress', e => { if (e.key === 'Enter') applyFilter(); });
        ['search-source', 'search-grade', 'search-status'].forEach(id => {
            document.getElementById(id).addEventListener('change', applyFilter);
        });
        document.getElementById('lightbox-overlay').addEventListener('click', () => {
            document.getElementById('lightbox-overlay').classList.remove('active');
        });
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            const lightbox = document.getElementById('lightbox-overlay');
            if (lightbox.classList.contains('active')) {
                lightbox.classList.remove('active');
                return;
            }
            hoverPreview.hide();
        });
        search();
    });
})();
