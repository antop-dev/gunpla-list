/* 요청 현황 — 내가 올린 제품 등록/수정 요청 목록과 상세 확인 (읽기 전용, 대기 중인 건은 취소 가능)
 * 항목 표는 product-request-fields.js(ProductRequestFields) 공용 모듈로 그린다
 */
(function () {
    let gridApi = null;
    let allRequests = [];
    let detailRequest = null;

    // ---- AG Grid cell renderers ----

    function DateTimeRenderer() {}
    DateTimeRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    DateTimeRenderer.prototype.getGui = function () { return this.eGui; };
    DateTimeRenderer.prototype.refresh = function (params) {
        this.eGui.textContent = formatRequestDateTime(params.value);
        return true;
    };

    function TypeRenderer() {}
    TypeRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    TypeRenderer.prototype.getGui = function () { return this.eGui; };
    TypeRenderer.prototype.refresh = function (params) {
        this.eGui.textContent = PRODUCT_REQUEST_LABELS.type[params.value] || params.value;
        return true;
    };

    function StatusRenderer() {}
    StatusRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.refresh(params);
    };
    StatusRenderer.prototype.getGui = function () { return this.eGui; };
    StatusRenderer.prototype.refresh = function (params) {
        this.eGui.innerHTML = productRequestStatusHtml(params.value);
        return true;
    };

    // 요청 대상 제품이 있으면(수정 요청 또는 승인되어 등록된 건) 제품명을 링크로 만들어 제품 상세를 연다
    function NameRenderer() {}
    NameRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'cell-request-name';
        const name = params.data.requested?.name || '';
        if (params.data.current) {
            this.eGui.innerHTML = `<a href="#" class="req-product-link" title="현재 제품 정보 보기">${escHtml(name)}</a>`;
            this.eGui.querySelector('a').addEventListener('click', e => {
                e.preventDefault();
                openProductDetail(params.data);
            });
        } else {
            this.eGui.textContent = name;
        }
    };
    NameRenderer.prototype.getGui = function () { return this.eGui; };
    NameRenderer.prototype.refresh = function () { return false; };

    function ActionsRenderer() {}
    ActionsRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'cell-actions';
        this.eGui.innerHTML = `<button class="btn btn-sm btn-secondary" data-action="detail">상세</button>`;
        this.eGui.querySelector('[data-action="detail"]').addEventListener('click', () => openDetail(params.data));
    };
    ActionsRenderer.prototype.getGui = function () { return this.eGui; };
    ActionsRenderer.prototype.refresh = function () { return false; };

    // ---- Grid ----

    function initGrid() {
        const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const leftStyle = { display: 'flex', alignItems: 'center', overflow: 'hidden' };

        gridApi = agGrid.createGrid(document.getElementById('requests-grid'), {
            columnDefs: [
                // 순번은 요청이 들어온 차례(오래된 것이 1번) — 기본 정렬은 역순이라 최신 요청이 맨 위에 온다
                { field: 'seq', headerName: '순번', width: 96, sort: 'desc', sortIndex: 0, cellStyle: centerStyle },
                { field: 'type', headerName: '유형', width: 80, cellRenderer: TypeRenderer, cellStyle: centerStyle },
                {
                    colId: 'name', headerName: '제품명', width: 320, minWidth: 160,
                    valueGetter: p => p.data?.requested?.name || '',
                    cellRenderer: NameRenderer, cellStyle: leftStyle,
                },
                { field: 'status', headerName: '상태', width: 90, cellRenderer: StatusRenderer, cellStyle: centerStyle },
                {
                    colId: 'actions', headerName: '', cellRenderer: ActionsRenderer, width: 80,
                    resizable: false, sortable: false, cellStyle: centerStyle,
                },
                {
                    field: 'processedAt', headerName: '처리일시', width: 150, minWidth: 120,
                    cellRenderer: DateTimeRenderer, cellStyle: centerStyle,
                },
                // 반려 사유는 길이가 제각각이라 남는 너비를 모두 쓰게 한다
                { field: 'rejectReason', headerName: '반려 사유', flex: 1, minWidth: 160, cellStyle: leftStyle },
            ],
            rowData: [],
            rowHeight: 44,
            headerHeight: 40,
            defaultColDef: { resizable: true, sortable: true, filter: false },
            animateRows: false,
            enableCellTextSelection: true,
            getRowId: params => String(params.data.id),
            isExternalFilterPresent: isFilterActive,
            doesExternalFilterPass: filterPass,
            overlayNoRowsTemplate: '<span style="color:var(--text-muted)">요청 내역이 없습니다.</span>',
            unSortIcon: true,
            icons: { sortUnSort: '<span style="color:var(--text-muted)">–</span>' },
        });
    }

    function isFilterActive() {
        return !!(document.getElementById('search-type').value || document.getElementById('search-status').value);
    }

    function filterPass(node) {
        const type = document.getElementById('search-type').value;
        const status = document.getElementById('search-status').value;
        if (type && node.data.type !== type) return false;
        if (status && node.data.status !== status) return false;
        return true;
    }

    async function loadRequests() {
        try {
            allRequests = withSeq(await Api.get('/api/user/product-requests'));
            gridApi.setGridOption('rowData', allRequests);
        } catch (e) {
            Toast.error(e.message);
        }
    }

    // 요청이 들어온 차례대로 1번부터 번호를 매긴다 — 정렬/필터를 바꿔도 번호가 흔들리지 않게 값으로 고정
    function withSeq(requests) {
        const order = [...requests].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
        const seqById = new Map(order.map((r, i) => [r.id, i + 1]));
        return requests.map(r => ({ ...r, seq: seqById.get(r.id) }));
    }

    async function refresh() {
        const btn = document.getElementById('btn-refresh');
        const icon = btn.querySelector('i');
        btn.disabled = true;
        icon.className = 'fa-solid fa-spinner fa-spin';
        try {
            await loadRequests();
            gridApi.onFilterChanged();
        } finally {
            btn.disabled = false;
            icon.className = 'fa-solid fa-rotate';
        }
    }

    // ---- Detail popup ----

    function openDetail(request) {
        detailRequest = request;
        const typeLabel = PRODUCT_REQUEST_LABELS.type[request.type] || request.type;
        document.getElementById('modal-request-detail-title').textContent = `제품 ${typeLabel} 요청 상세`;

        // 격자(라벨 | 값 | 라벨 | 값)에 채워지므로 왼쪽 열 -> 오른쪽 열 순서로 나열한다
        const rows = [
            ['유형', typeLabel],
            ['상태', productRequestStatusHtml(request.status)],
            ['요청일시', formatRequestDateTime(request.createdAt)],
        ];
        if (request.processedAt) rows.push(['처리일시', formatRequestDateTime(request.processedAt)]);
        document.getElementById('request-detail-meta').innerHTML = rows
            .map(([label, value]) =>
                `<span class="req-meta-label">${label}</span><span class="req-meta-value">${value}</span>`)
            .join('');

        const rejectEl = document.getElementById('request-detail-reject');
        if (request.status === 'REJECTED') {
            rejectEl.innerHTML = `<b>반려 사유</b><br>${escHtml(request.rejectReason || '-')}`;
            rejectEl.style.display = '';
        } else {
            rejectEl.style.display = 'none';
        }

        // 승인된 수정 요청은 제품이 이미 요청 내용으로 바뀐 뒤라 '기존' 열이 비교 대상이 되지 않는다
        // (반려/취소는 제품이 그대로이므로 비교를 계속 보여준다)
        const current = (request.type === 'MODIFY' && request.status !== 'APPROVED') ? request.current : null;
        ProductRequestFields.render(document.getElementById('request-detail-fields'), {
            current,
            requested: request.requested,
        });

        document.getElementById('btn-request-cancel').style.display = request.status === 'PENDING' ? '' : 'none';
        document.getElementById('modal-request-detail').classList.add('active');
    }

    function closeDetail() {
        document.getElementById('modal-request-detail').classList.remove('active');
        detailRequest = null;
    }

    // 취소해도 요청은 지워지지 않고 '취소' 상태로 남아 이력으로 계속 보인다
    async function cancelRequest() {
        if (!detailRequest) return;
        const ok = await Confirm.show('요청을 취소하시겠습니까? 취소하면 다시 되돌릴 수 없습니다.');
        if (!ok) return;
        const btn = document.getElementById('btn-request-cancel');
        btn.disabled = true;
        try {
            const response = await Api.post(`/api/user/product-requests/${detailRequest.id}/cancel`);
            Toast.success('요청이 취소되었습니다.');
            const idx = allRequests.findIndex(r => r.id === response.id);
            // 서버 응답에는 화면에서만 쓰는 순번이 없으므로 기존 행의 순번을 이어 붙인다
            const updated = { ...response, seq: idx !== -1 ? allRequests[idx].seq : undefined };
            if (idx !== -1) allRequests[idx] = updated;
            gridApi.applyTransaction({ update: [updated] });
            gridApi.onFilterChanged();
            closeDetail();
        } catch (e) {
            Toast.error(e.message);
        } finally {
            btn.disabled = false;
        }
    }

    // ---- 제품 상세 팝업 (요청 대상 제품의 현재 정보) ----

    function openProductDetail(request) {
        const product = request.current;
        if (!product) return;
        ProductRequestFields.render(document.getElementById('product-detail-fields'), { requested: product });
        document.getElementById('modal-product-detail').classList.add('active');
    }

    function closeProductDetail() {
        document.getElementById('modal-product-detail').classList.remove('active');
    }

    // ---- Logout ----

    async function confirmLogout() {
        const ok = await Confirm.show('로그아웃 하시겠습니까?');
        if (ok) document.getElementById('form-logout').submit();
    }

    // ---- Init ----

    document.addEventListener('DOMContentLoaded', async () => {
        initGrid();

        document.getElementById('btn-refresh').addEventListener('click', refresh);
        document.getElementById('btn-profile')?.addEventListener('click', confirmLogout);
        ['search-type', 'search-status'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => gridApi.onFilterChanged());
        });
        document.getElementById('modal-product-detail-close').addEventListener('click', closeProductDetail);
        document.getElementById('btn-product-detail-close').addEventListener('click', closeProductDetail);
        document.getElementById('modal-product-detail').addEventListener('click', e => {
            if (e.target === e.currentTarget) closeProductDetail();
        });
        document.getElementById('modal-request-detail-close').addEventListener('click', closeDetail);
        document.getElementById('btn-request-detail-close').addEventListener('click', closeDetail);
        document.getElementById('btn-request-cancel').addEventListener('click', cancelRequest);
        document.getElementById('modal-request-detail').addEventListener('click', e => {
            if (e.target === e.currentTarget) closeDetail();
        });
        // 제품 상세가 요청 상세 위에 겹쳐 뜰 수 있으므로 위에 있는 것부터 닫는다
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            if (document.getElementById('modal-product-detail').classList.contains('active')) {
                closeProductDetail();
            } else if (document.getElementById('modal-request-detail').classList.contains('active')) {
                closeDetail();
            }
        });

        await loadRequests();
    });
})();
