/* 어드민 사용자 관리 — Google 로그인 사용자 목록과 차단/차단 해제
 * 차단된 사용자는 로그인이 거부되고, 이미 로그인된 세션도 다음 요청에서 로그아웃된다 (BlockedUserFilter)
 * 검색/정렬은 서버에서 처리한다 — 검색 버튼/Enter 를 눌렀을 때의 조건(appliedCriteria)과 헤더 정렬로 목록을 다시 조회한다
 */
(function () {
    let gridApi = null;
    let allUsers = [];
    let appliedCriteria = {};
    let loadSeq = 0;            // 늦게 도착한 이전 응답이 최신 결과를 덮지 않도록 하는 요청 번호
    let suppressSortEvent = false; // 코드로 정렬 상태를 바꿀 때 sortChanged 로 인한 재조회를 막는다

    // 서버는 UTC LocalDateTime(타임존 표기 없음)으로 내려주므로 'Z' 를 붙여 로컬 시간으로 바꾼다
    function formatDateTime(value) {
        if (!value) return '';
        const date = new Date(value.endsWith('Z') ? value : value + 'Z');
        if (isNaN(date.getTime())) return value;
        const pad = n => String(n).padStart(2, '0');
        return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    // ---- AG Grid cell renderers ----

    function DateTimeRenderer() {}
    DateTimeRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    DateTimeRenderer.prototype.getGui = function () { return this.eGui; };
    DateTimeRenderer.prototype.refresh = function (params) {
        this.eGui.textContent = formatDateTime(params.value);
        return true;
    };

    function AvatarRenderer() {}
    AvatarRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'req-requester';
        this.refresh(params);
    };
    AvatarRenderer.prototype.getGui = function () { return this.eGui; };
    AvatarRenderer.prototype.refresh = function (params) {
        const picture = params.data.picture;
        this.eGui.innerHTML = picture ? `<img src="${escHtml(picture)}" alt="" referrerpolicy="no-referrer">` : '';
        return true;
    };

    function FlagRenderer() {}
    FlagRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    FlagRenderer.prototype.getGui = function () { return this.eGui; };
    FlagRenderer.prototype.refresh = function (params) {
        this.eGui.innerHTML = params.value
            ? '<i class="fa-solid fa-check" style="color:var(--success)"></i>'
            : '<span style="color:var(--text-muted)">–</span>';
        return true;
    };

    function StatusRenderer() {}
    StatusRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.refresh(params);
    };
    StatusRenderer.prototype.getGui = function () { return this.eGui; };
    StatusRenderer.prototype.refresh = function (params) {
        this.eGui.innerHTML = params.value
            ? `<span class="req-status req-status-rejected" title="${escHtml(formatDateTime(params.data.blockedAt))} 차단">차단</span>`
            : '<span class="req-status req-status-approved">정상</span>';
        return true;
    };

    function ActionsRenderer() {}
    ActionsRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'cell-actions';
        this.refresh(params);
    };
    ActionsRenderer.prototype.getGui = function () { return this.eGui; };
    ActionsRenderer.prototype.refresh = function (params) {
        this.eGui.innerHTML = params.data.blocked
            ? '<button class="btn btn-sm btn-secondary" data-action="unblock">차단 해제</button>'
            : '<button class="btn btn-sm btn-danger" data-action="block"><i class="fa-solid fa-ban"></i> 차단</button>';
        this.eGui.querySelector('button').addEventListener('click', e => {
            e.stopPropagation();
            toggleBlock(params.data);
        });
        return true;
    };

    // ---- Grid ----

    function initGrid() {
        const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const leftStyle = { display: 'flex', alignItems: 'center', overflow: 'hidden' };
        const rightStyle = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };

        gridApi = agGrid.createGrid(document.getElementById('users-grid'), {
            columnDefs: [
                {
                    colId: 'avatar', headerName: '', width: 56, resizable: false, sortable: false,
                    cellRenderer: AvatarRenderer, cellStyle: centerStyle,
                },
                {
                    field: 'name', headerName: '이름', width: 270, minWidth: 180,
                    valueFormatter: p => p.value || '(이름 없음)', cellStyle: leftStyle,
                },
                { field: 'email', headerName: '이메일', flex: 1, minWidth: 200, cellStyle: leftStyle },
                { field: 'ownedCount', headerName: '보유 제품', width: 100, cellStyle: rightStyle },
                { field: 'notifyOnSale', headerName: '판매 알림', width: 100, sortable: false, cellRenderer: FlagRenderer, cellStyle: centerStyle },
                { field: 'shareEnabled', headerName: '공유', width: 100, sortable: false, cellRenderer: FlagRenderer, cellStyle: centerStyle },
                {
                    field: 'createdAt', headerName: '가입일시', width: 150, minWidth: 120,
                    cellRenderer: DateTimeRenderer, cellStyle: centerStyle,
                },
                {
                    field: 'lastLoginAt', headerName: '마지막 로그인', width: 150, minWidth: 120,
                    cellRenderer: DateTimeRenderer, sort: 'desc', sortIndex: 0, cellStyle: centerStyle,
                },
                { field: 'blocked', headerName: '상태', width: 85, cellRenderer: StatusRenderer, cellStyle: centerStyle },
                {
                    colId: 'actions', headerName: '', cellRenderer: ActionsRenderer, width: 110,
                    resizable: false, sortable: false, cellStyle: centerStyle,
                },
            ],
            rowData: [],
            rowHeight: 44,
            headerHeight: 40,
            // 정렬은 서버가 하므로 그리드는 받은 순서를 그대로 둔다
            defaultColDef: { resizable: true, sortable: true, filter: false, comparator: serverOrder },
            animateRows: false,
            enableCellTextSelection: true,
            getRowId: params => String(params.data.id),
            onSortChanged: () => { if (!suppressSortEvent) loadUsers(); },
            overlayLoadingTemplate: GRID_LOADING_OVERLAY,
            overlayNoRowsTemplate: '<span style="color:var(--text-muted)">해당 조건의 사용자가 없습니다.</span>',
            unSortIcon: true,
            icons: { sortUnSort: '<span style="color:var(--text-muted)">–</span>' },
        });
    }

    function serverOrder() { return 0; }

    // 입력창의 현재 값을 검색 조건으로 확정한다
    function readCriteria() {
        const val = id => document.getElementById(id).value.trim();
        return {
            name: val('search-name'),
            email: val('search-email'),
            notifyOnSale: val('search-notify'),
            shareEnabled: val('search-share'),
            blocked: val('search-blocked'),
        };
    }

    function buildQuery() {
        const params = new URLSearchParams();
        Object.entries(appliedCriteria).forEach(([key, value]) => { if (value) params.set(key, value); });
        const sorted = gridApi.getColumnState().find(s => s.sort);
        if (sorted) {
            params.set('sortBy', sorted.colId);
            params.set('sortDir', sorted.sort);
        }
        return params.toString();
    }

    // ---- Data loading ----

    // 적용된 검색 조건 + 현재 정렬로 서버에서 목록을 가져온다
    async function loadUsers() {
        const seq = ++loadSeq;
        const stopLoading = startGridLoading(gridApi, document.getElementById('btn-search'), [document.getElementById('btn-refresh')]);
        try {
            const users = await Api.get('/api/admin/users?' + buildQuery());
            if (seq !== loadSeq) return;
            allUsers = users;
            gridApi.setGridOption('rowData', allUsers);
        } catch (e) {
            if (seq === loadSeq) Toast.error(e.message);
        } finally {
            if (seq === loadSeq) stopLoading();
        }
    }

    // 검색: 입력창의 현재 조건으로 조회
    async function searchUsers() {
        appliedCriteria = readCriteria();
        await loadUsers();
    }

    // 새로고침: 검색/정렬 조건을 초기화하고 서버에서 목록을 다시 가져옴
    async function refresh() {
        const btn = document.getElementById('btn-refresh');
        const icon = btn.querySelector('i');
        btn.disabled = true;
        icon.className = 'fa-solid fa-spinner fa-spin';
        try {
            ['search-name', 'search-email', 'search-notify', 'search-share', 'search-blocked'].forEach(id => {
                document.getElementById(id).value = '';
            });
            suppressSortEvent = true;
            gridApi.applyColumnState({
                state: [{ colId: 'lastLoginAt', sort: 'desc', sortIndex: 0 }],
                defaultState: { sort: null },
            });
            suppressSortEvent = false;
            await searchUsers();
        } finally {
            btn.disabled = false;
            icon.className = 'fa-solid fa-rotate';
        }
    }

    // ---- 차단 / 차단 해제 ----

    async function toggleBlock(user) {
        const name = user.name || user.email || `#${user.id}`;
        const message = user.blocked
            ? `'${name}' 사용자의 차단을 해제하시겠습니까?`
            : `'${name}' 사용자를 차단하시겠습니까? 차단하면 로그인할 수 없고 판매 알림 메일도 발송되지 않습니다.`;
        if (!await Confirm.show(message)) return;

        try {
            const action = user.blocked ? 'unblock' : 'block';
            const updated = await Api.post(`/api/admin/users/${user.id}/${action}`);
            const idx = allUsers.findIndex(u => u.id === updated.id);
            if (idx !== -1) allUsers[idx] = updated;
            gridApi.applyTransaction({ update: [updated] });
            Toast.success(updated.blocked ? '차단되었습니다.' : '차단이 해제되었습니다.');
        } catch (e) {
            Toast.error(e.message);
        }
    }

    // ---- Init ----

    document.addEventListener('DOMContentLoaded', async () => {
        initGrid();

        document.getElementById('btn-refresh').addEventListener('click', refresh);
        // 조건을 바꿔도 바로 검색하지 않고, 검색 버튼이나 Enter 를 눌렀을 때만 조회한다
        const guardedSearch = ignoreWhileRunning(searchUsers);
        document.getElementById('btn-search').addEventListener('click', guardedSearch);
        ['search-name', 'search-email'].forEach(id => {
            document.getElementById(id).addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.isComposing) guardedSearch();
            });
        });

        await searchUsers();
    });
})();
