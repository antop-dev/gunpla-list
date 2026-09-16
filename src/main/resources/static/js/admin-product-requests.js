/* 어드민 제품 등록/수정 요청 처리 — 목록에서 건을 골라 확인 팝업에서 승인/반려한다
 * 확인 팝업은 어드민 제품 등록/수정과 같은 폼(ProductModal) 을 'review' 모드로 띄운 것이고,
 * 수정 요청이면 달라지는 항목 아래에 기존 값이 함께 표시된다
 * 승인 시 팝업에 입력된 값이 그대로 제품에 저장되므로, 관리자가 내용을 고쳐서 승인할 수 있다
 */
(function () {
    let gridApi = null;
    let allRequests = [];
    let allCategories = [];
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

    function RequesterRenderer() {}
    RequesterRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'req-requester';
        this.refresh(params);
    };
    RequesterRenderer.prototype.getGui = function () { return this.eGui; };
    RequesterRenderer.prototype.refresh = function (params) {
        const picture = params.data.requesterPicture;
        const name = params.data.requesterName || '(알 수 없음)';
        this.eGui.innerHTML =
            (picture ? `<img src="${escHtml(picture)}" alt="" referrerpolicy="no-referrer">` : '') +
            `<span>${escHtml(name)}</span>`;
        return true;
    };

    function BoxArtRenderer() {}
    BoxArtRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'cell-boxart';
        this.refresh(params);
    };
    BoxArtRenderer.prototype.getGui = function () { return this.eGui; };
    BoxArtRenderer.prototype.refresh = function (params) {
        const thumb = params.data.requested?.boxArtThumbUrl;
        this.eGui.innerHTML = thumb
            ? `<img src="${escHtml(thumb)}" alt="thumb">`
            : `<div class="cell-boxart-placeholder">NO IMAGE</div>`;
        return true;
    };

    function ActionsRenderer() {}
    ActionsRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'cell-actions';
        const label = params.data.status === 'PENDING' ? '확인' : '상세';
        this.eGui.innerHTML = `<button class="btn btn-sm btn-secondary" data-action="detail">${label}</button>`;
        this.eGui.querySelector('[data-action="detail"]').addEventListener('click', e => {
            e.stopPropagation();
            openDetail(params.data);
        });
    };
    ActionsRenderer.prototype.getGui = function () { return this.eGui; };
    ActionsRenderer.prototype.refresh = function () { return false; };

    // ---- Grid ----

    function initGrid() {
        const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const leftStyle = { display: 'flex', alignItems: 'center', overflow: 'hidden' };

        gridApi = agGrid.createGrid(document.getElementById('requests-grid'), {
            columnDefs: [
                {
                    field: 'createdAt', headerName: '요청일시', width: 150, minWidth: 120,
                    cellRenderer: DateTimeRenderer, sort: 'desc', sortIndex: 0, cellStyle: centerStyle,
                },
                {
                    colId: 'requester', headerName: '요청자', width: 160, cellRenderer: RequesterRenderer,
                    valueGetter: p => p.data?.requesterName || '', cellStyle: leftStyle,
                },
                { field: 'type', headerName: '유형', width: 80, cellRenderer: TypeRenderer, cellStyle: centerStyle },
                {
                    colId: 'boxArt', headerName: '박스아트', width: 100, resizable: false, sortable: false,
                    cellRenderer: BoxArtRenderer, cellStyle: { padding: 0, ...centerStyle },
                },
                {
                    colId: 'name', headerName: '제품명', flex: 1, minWidth: 180,
                    valueGetter: p => p.data?.requested?.name || '', cellStyle: leftStyle,
                },
                { field: 'status', headerName: '상태', width: 90, cellRenderer: StatusRenderer, cellStyle: centerStyle },
                {
                    field: 'processedAt', headerName: '처리일시', width: 150, minWidth: 120,
                    cellRenderer: DateTimeRenderer, cellStyle: centerStyle,
                },
                { field: 'processedBy', headerName: '처리자', width: 110, cellStyle: leftStyle },
                {
                    colId: 'actions', headerName: '', cellRenderer: ActionsRenderer, width: 90,
                    resizable: false, sortable: false, pinned: 'right', cellStyle: centerStyle,
                },
            ],
            rowData: [],
            rowHeight: 58,
            headerHeight: 40,
            defaultColDef: { resizable: true, sortable: true, filter: false },
            animateRows: false,
            enableCellTextSelection: true,
            getRowId: params => String(params.data.id),
            isExternalFilterPresent: isFilterActive,
            doesExternalFilterPass: filterPass,
            onRowClicked: params => openDetail(params.data),
            overlayNoRowsTemplate: '<span style="color:var(--text-muted)">해당 조건의 요청이 없습니다.</span>',
            unSortIcon: true,
            icons: { sortUnSort: '<span style="color:var(--text-muted)">–</span>' },
        });
    }

    function isFilterActive() {
        return !!(
            document.getElementById('search-status').value ||
            document.getElementById('search-type').value ||
            document.getElementById('search-name').value.trim()
        );
    }

    function filterPass(node) {
        const status = document.getElementById('search-status').value;
        const type = document.getElementById('search-type').value;
        const name = document.getElementById('search-name').value.trim().toLowerCase();
        if (status && node.data.status !== status) return false;
        if (type && node.data.type !== type) return false;
        if (name && !(node.data.requested?.name || '').toLowerCase().includes(name)) return false;
        return true;
    }

    // ---- Data loading ----

    async function loadRequests() {
        try {
            allRequests = await Api.get('/api/admin/product-requests');
            gridApi.setGridOption('rowData', allRequests);
            gridApi.onFilterChanged();
        } catch (e) {
            Toast.error(e.message);
        }
    }

    async function refresh() {
        const btn = document.getElementById('btn-refresh');
        const icon = btn.querySelector('i');
        btn.disabled = true;
        icon.className = 'fa-solid fa-spinner fa-spin';
        try {
            await loadRequests();
        } finally {
            btn.disabled = false;
            icon.className = 'fa-solid fa-rotate';
        }
    }

    // ---- 요청 확인 / 승인 / 반려 ----

    // 어드민 제품 등록/수정과 같은 팝업(ProductModal)을 검토 모드로 열어 내용을 확인하고 보정한다
    function openDetail(request) {
        detailRequest = request;
        ProductModal.openReview(request, { onApprove: approve, onReject: openRejectModal });
    }

    // 승인 성공 시에만 팝업이 닫히도록, 실패는 그대로 던진다 (ProductModal 이 팝업을 열어 둔다)
    async function approve(body) {
        try {
            const updated = await Api.post(`/api/admin/product-requests/${detailRequest.id}/approve`, body);
            Toast.success('승인되었습니다.');
            applyUpdated(updated);
        } catch (e) {
            Toast.error(e.message);
            throw e;
        }
    }

    function openRejectModal() {
        document.getElementById('field-reject-reason').value = '';
        document.getElementById('modal-request-reject').classList.add('active');
        document.getElementById('field-reject-reason').focus();
    }

    function closeRejectModal() {
        document.getElementById('modal-request-reject').classList.remove('active');
    }

    async function rejectConfirm() {
        if (!detailRequest) return;
        const reason = document.getElementById('field-reject-reason').value.trim();
        if (!reason) { Toast.error('반려 사유를 입력하세요.'); return; }

        const btn = document.getElementById('btn-reject-confirm');
        btn.disabled = true;
        try {
            const updated = await Api.post(`/api/admin/product-requests/${detailRequest.id}/reject`, { reason });
            Toast.success('반려 처리되었습니다.');
            applyUpdated(updated);
            closeRejectModal();
            ProductModal.close();
        } catch (e) {
            Toast.error(e.message);
        } finally {
            btn.disabled = false;
        }
    }

    function applyUpdated(updated) {
        const idx = allRequests.findIndex(r => r.id === updated.id);
        if (idx !== -1) allRequests[idx] = updated;
        gridApi.applyTransaction({ update: [updated] });
        gridApi.onFilterChanged();
    }

    // ---- Init ----

    document.addEventListener('DOMContentLoaded', async () => {
        initGrid();

        document.getElementById('btn-refresh').addEventListener('click', refresh);
        ['search-status', 'search-type'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => gridApi.onFilterChanged());
        });
        document.getElementById('search-name').addEventListener('input', debounce(() => gridApi.onFilterChanged(), 300));

        document.getElementById('modal-request-reject-close').addEventListener('click', closeRejectModal);
        document.getElementById('btn-reject-cancel').addEventListener('click', closeRejectModal);
        document.getElementById('btn-reject-confirm').addEventListener('click', rejectConfirm);
        // 반려 사유 팝업이 위에 떠 있으면 그것만 닫는다 (검토 팝업의 ESC 는 ProductModal 이 처리)
        // 캡처 단계에서 전파를 끊어 ProductModal 의 ESC 핸들러까지 함께 도는 것을 막는다
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.getElementById('modal-request-reject').classList.contains('active')) {
                e.stopPropagation();
                closeRejectModal();
            }
        }, true);

        try {
            allCategories = await Api.get('/api/admin/categories');
        } catch (e) {
            Toast.error(e.message);
        }
        ProductModal.init({ categories: allCategories, mode: 'review' });
        await loadRequests();
    });
})();
