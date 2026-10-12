/* 어드민 대시보드 — 요약 KPI, 차트(Chart.js), 판매제품 수집 상태, 사용자 목록, 인기 제품 TOP 10
 * 사용자 목록 행을 클릭하면 해당 사용자의 보유 제품 목록을 팝업으로 보여준다
 * 판매제품 수집 상태는 출처별 최근 결과(정상/0건/실패/지연)이며, 출처를 클릭하면 수집 이력을 팝업으로 보여준다
 * 차트는 모두 단일 시리즈라 범례 없이 제목으로 대상을 표시하고, 값은 툴팁으로 확인한다
 */
(function () {
    const CHART_COLOR = '#4f8ef7';
    const charts = {};
    let usersGridApi = null;
    let userProductsGridApi = null;
    let topProductsGridApi = null;
    let onSaleLogsGridApi = null;

    Chart.defaults.color = '#a0a0b0';
    Chart.defaults.borderColor = 'rgba(44, 62, 90, 0.6)';
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

    const pad = n => String(n).padStart(2, '0');
    const numberFormat = n => Number(n).toLocaleString('ko-KR');

    // 서버의 LocalDateTime 은 UTC 이므로 'Z' 를 붙여 로컬 시간으로 표시
    function formatDateTime(value) {
        if (!value) return '';
        const date = new Date(value.endsWith('Z') ? value : value + 'Z');
        if (isNaN(date.getTime())) return value;
        return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function formatDate(value) {
        return value ? value.replaceAll('-', '.') : '';
    }

    function gradeChipHtml(grade) {
        if (!grade) return '';
        const color = GRADE_COLORS[grade] || '#6c7a8d';
        return `<span class="chip" style="background:${hexToRgba(color, 0.15)};border-color:${color};color:${color}">${escHtml(grade)}</span>`;
    }

    function boxArtHtml(product) {
        return product.boxArtThumbUrl
            ? `<div class="cell-boxart"><img src="${escHtml(product.boxArtThumbUrl)}" alt="thumb"></div>`
            : `<div class="cell-boxart"><div class="cell-boxart-placeholder">NO IMAGE</div></div>`;
    }

    // ---- KPI ----

    function renderKpis(summary) {
        document.getElementById('kpi-total-users').textContent = numberFormat(summary.totalUsers);
        document.getElementById('kpi-active-users').textContent = numberFormat(summary.activeUsers);
        document.getElementById('kpi-active-ratio').textContent = summary.totalUsers
            ? `전체의 ${Math.round(summary.activeUsers / summary.totalUsers * 100)}%`
            : '';
        document.getElementById('kpi-total-owned').textContent = numberFormat(summary.totalOwned);
        document.getElementById('kpi-avg-owned').textContent = summary.avgOwnedPerActiveUser.toFixed(1);
        document.getElementById('kpi-notify').textContent = numberFormat(summary.notifySubscribers);
    }

    // ---- Charts ----

    function barDataset(data) {
        return {
            data,
            backgroundColor: CHART_COLOR,
            hoverBackgroundColor: '#7aaaf9',
            borderRadius: 4,
            maxBarThickness: 28,
        };
    }

    function renderChart(id, config) {
        charts[id]?.destroy();
        charts[id] = new Chart(document.getElementById(id), config);
    }

    function renderGradeChart(gradeDistribution) {
        const total = gradeDistribution.reduce((sum, g) => sum + g.count, 0);
        renderChart('chart-grade', {
            type: 'bar',
            data: {
                labels: gradeDistribution.map(g => g.grade),
                datasets: [{ ...barDataset(gradeDistribution.map(g => g.count)), maxBarThickness: 56 }],
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${numberFormat(ctx.raw)}개 (${total ? (ctx.raw / total * 100).toFixed(1) : 0}%)`,
                        },
                    },
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, ticks: { precision: 0 } },
                },
            },
        });
    }

    // 구분은 이름이 길어 가로 막대로 그린다 (축에 이름이 잘리지 않도록)
    function renderCategoryChart(categoryDistribution) {
        const total = categoryDistribution.reduce((sum, c) => sum + c.count, 0);
        renderChart('chart-category', {
            type: 'bar',
            data: {
                labels: categoryDistribution.map(c => c.name || '(구분 없음)'),
                datasets: [barDataset(categoryDistribution.map(c => c.count))],
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${numberFormat(ctx.raw)}개 (${total ? (ctx.raw / total * 100).toFixed(1) : 0}%)`,
                        },
                    },
                },
                scales: {
                    x: { beginAtZero: true, ticks: { precision: 0 } },
                    y: { grid: { display: false } },
                },
            },
        });
    }

    // ---- 판매제품 수집 상태 ----

    // EMPTY 는 예외 없이 0건 — 사이트 구조가 바뀌어 제품을 못 찾는 경우가 대부분이라 경고로 표시
    const SCRAPE_STATUS = {
        SUCCESS: { text: '정상', cls: 'ok', icon: 'fa-circle-check' },
        EMPTY: { text: '0건', cls: 'warn', icon: 'fa-triangle-exclamation' },
        FAILED: { text: '실패', cls: 'error', icon: 'fa-circle-xmark' },
    };

    function scrapeStatusPillHtml(status) {
        const s = SCRAPE_STATUS[status];
        return s ? `<span class="onsale-pill ${s.cls}"><i class="fa-solid ${s.icon}"></i> ${s.text}</span>` : '';
    }

    function timeAgo(value) {
        const minutes = Math.floor((Date.now() - new Date(value.endsWith('Z') ? value : value + 'Z').getTime()) / 60000);
        if (minutes < 1) return '방금 전';
        if (minutes < 60) return `${minutes}분 전`;
        const hours = Math.floor(minutes / 60);
        return hours < 24 ? `${hours}시간 전` : `${Math.floor(hours / 24)}일 전`;
    }

    const formatDuration = ms => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}초`;

    function onSaleSourceHtml(s) {
        const latest = s.latest;
        let pill;
        if (!latest) pill = '<span class="onsale-pill none">기록 없음</span>';
        else if (s.stale) pill = '<span class="onsale-pill warn"><i class="fa-solid fa-clock"></i> 지연</span>';
        else pill = scrapeStatusPillHtml(latest.status);

        const meta = latest
            ? `${timeAgo(latest.startedAt)} · 수집 ${numberFormat(latest.itemCount)}건 · 적재 ${numberFormat(s.storedCount)}건`
            : `적재 ${numberFormat(s.storedCount)}건`;

        let note = '';
        if (s.stale) note = '10분 넘게 수집 기록이 없습니다 — 서버/배치 확인 필요';
        else if (latest?.status === 'EMPTY') note = '0건 수집 — 사이트 구조 변경 의심';
        else if (latest?.errorMessage) note = latest.errorMessage;
        if (note && s.consecutiveProblems > 1) note = `연속 ${s.consecutiveProblems}회 · ${note}`;

        return `
            <div class="onsale-source ${s.problem ? 'problem' : ''}" data-source="${escHtml(s.source)}" title="클릭하면 수집 이력을 볼 수 있습니다">
                <div class="onsale-source-head"><strong>${escHtml(s.source)}</strong>${pill}</div>
                <span class="onsale-source-meta">${meta}</span>
                ${note ? `<span class="onsale-source-note" title="${escHtml(note)}">${escHtml(note)}</span>` : ''}
            </div>`;
    }

    function renderOnSaleStatus(status) {
        const box = document.getElementById('onsale-sources');
        box.innerHTML = status.sources.length
            ? status.sources.map(onSaleSourceHtml).join('')
            : '<p class="dash-empty">등록된 수집 출처가 없습니다.</p>';
    }

    function initOnSaleLogsGrid() {
        const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const rightStyle = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };
        onSaleLogsGridApi = agGrid.createGrid(document.getElementById('onsale-logs-grid'), {
            columnDefs: [
                {
                    field: 'startedAt', headerName: '수집 일시', width: 160, sort: 'desc', cellStyle: centerStyle,
                    valueFormatter: p => formatDateTime(p.value),
                },
                { field: 'status', headerName: '결과', width: 100, cellStyle: centerStyle, cellRenderer: p => scrapeStatusPillHtml(p.value) },
                { field: 'itemCount', headerName: '건수', width: 90, cellStyle: rightStyle, valueFormatter: p => numberFormat(p.value) },
                { field: 'durationMs', headerName: '소요', width: 90, cellStyle: rightStyle, valueFormatter: p => formatDuration(p.value) },
                { field: 'errorMessage', headerName: '오류', flex: 1, minWidth: 200, tooltipField: 'errorMessage', cellClass: 'onsale-error-text' },
            ],
            defaultColDef: { sortable: true, resizable: true },
            getRowId: p => String(p.data.id),
            rowHeight: 36,
            overlayNoRowsTemplate: '<span class="dash-empty">수집 이력이 없습니다.</span>',
        });
    }

    const onSaleLogsModal = document.getElementById('modal-onsale-logs');

    async function openOnSaleLogs(source) {
        document.getElementById('modal-onsale-logs-title').textContent = `${source} 수집 이력 (최근 7일)`;
        onSaleLogsGridApi.setGridOption('rowData', []);
        onSaleLogsModal.classList.add('active');
        PopupNav.open(closeOnSaleLogs);
        try {
            const logs = await Api.get(`/api/admin/on-sale/logs?source=${encodeURIComponent(source)}`);
            onSaleLogsGridApi.setGridOption('rowData', logs);
        } catch (e) {
            Toast.error(e.message || '오류가 발생했습니다.');
        }
    }

    function closeOnSaleLogs() {
        if (!onSaleLogsModal.classList.contains('active')) return;
        onSaleLogsModal.classList.remove('active');
        PopupNav.close();
    }

    // ---- Top products grid ----

    function initTopProductsGrid() {
        const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const rightStyle = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };
        topProductsGridApi = agGrid.createGrid(document.getElementById('top-products-grid'), {
            columnDefs: [
                { field: 'rank', headerName: '순위', width: 70, sort: 'asc', cellStyle: centerStyle },
                {
                    colId: 'boxArt', headerName: '박스아트', width: 100, resizable: false, sortable: false,
                    cellRenderer: p => boxArtHtml(p.data.product), cellStyle: { padding: 0, ...centerStyle },
                },
                {
                    colId: 'name', headerName: '제품명', flex: 1, minWidth: 160,
                    valueGetter: p => p.data?.product.name || '',
                    cellRenderer: p => `
                        <div class="dash-top-name">
                            <strong title="${escHtml(p.value)}">${escHtml(p.value)}</strong>
                            <span>${gradeChipHtml(p.data.product.grade)} ${escHtml(p.data.product.modelNumber || '')}</span>
                        </div>`,
                },
                {
                    field: 'ownerCount', headerName: '보유', width: 80, cellStyle: rightStyle,
                    valueFormatter: p => `${numberFormat(p.value)}명`,
                },
                {
                    colId: 'assembledRate', headerName: '조립률', width: 90, cellStyle: rightStyle,
                    valueGetter: p => p.data ? Math.round(p.data.assembledCount / p.data.ownerCount * 100) : 0,
                    valueFormatter: p => `${p.value}%`,
                },
            ],
            defaultColDef: { sortable: true, resizable: true },
            getRowId: p => String(p.data.product.id),
            rowHeight: 50,
            overlayNoRowsTemplate: '<span class="dash-empty">보유 데이터가 없습니다.</span>',
        });
    }

    // ---- Users grid ----

    function UserRenderer(params) {
        const el = document.createElement('div');
        el.className = 'dash-user-cell';
        const picture = params.data.picture;
        el.innerHTML =
            (picture ? `<img src="${escHtml(picture)}" alt="" referrerpolicy="no-referrer">` : '') +
            `<span>${escHtml(params.data.name || '(이름 없음)')}</span>`;
        return el;
    }

    function initUsersGrid() {
        const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const rightStyle = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };
        usersGridApi = agGrid.createGrid(document.getElementById('users-grid'), {
            ...lastClickedRowHighlight(),
            columnDefs: [
                { colId: 'name', headerName: '사용자', flex: 1, minWidth: 140, cellRenderer: UserRenderer, valueGetter: p => p.data?.name || '' },
                { field: 'email', headerName: '이메일', flex: 1, minWidth: 160 },
                {
                    field: 'ownedCount', headerName: '보유', width: 80, sort: 'desc', cellStyle: rightStyle,
                    valueFormatter: p => numberFormat(p.value),
                },
                {
                    field: 'assembledCount', headerName: '조립', width: 80, cellStyle: rightStyle,
                    valueFormatter: p => numberFormat(p.value),
                },
                {
                    field: 'notifyOnSale', headerName: '알림', width: 70, cellStyle: centerStyle,
                    cellRenderer: p => p.value ? '<i class="fa-solid fa-bell" title="판매 알림 구독"></i>' : '',
                },
                { field: 'createdAt', headerName: '가입일시', width: 140, cellStyle: centerStyle, valueFormatter: p => formatDateTime(p.value) },
                { field: 'lastActivityAt', headerName: '최근 활동', width: 140, cellStyle: centerStyle, valueFormatter: p => formatDateTime(p.value) },
            ],
            defaultColDef: { sortable: true, resizable: true },
            getRowId: p => String(p.data.id),
            rowHeight: 40,
            // onRowClicked 는 lastClickedRowHighlight() 가 사용하므로 팝업은 onCellClicked 에서 연다
            onCellClicked: params => openUserProducts(params.data),
            overlayNoRowsTemplate: '<span class="dash-empty">사용자가 없습니다.</span>',
        });
    }

    // ---- User products modal ----

    const modal = document.getElementById('modal-user-products');

    function initUserProductsGrid() {
        const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const rightStyle = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };
        const leftStyle = { display: 'flex', alignItems: 'center', overflow: 'hidden' };
        const boolRenderer = p => p.value ? '<i class="fa-solid fa-check"></i>' : '';
        userProductsGridApi = agGrid.createGrid(document.getElementById('user-products-grid'), {
            columnDefs: [
                {
                    colId: 'boxArt', headerName: '박스아트', width: 100, resizable: false, sortable: false,
                    cellRenderer: p => boxArtHtml(p.data.product), cellStyle: { padding: 0, ...centerStyle },
                },
                {
                    colId: 'grade', headerName: '등급', width: 90, cellStyle: centerStyle,
                    valueGetter: p => p.data?.product.grade, cellRenderer: p => gradeChipHtml(p.value),
                },
                { colId: 'modelNumber', headerName: '형식번호', width: 130, cellStyle: leftStyle, valueGetter: p => p.data?.product.modelNumber || '' },
                { colId: 'name', headerName: '제품명', flex: 1, minWidth: 200, cellStyle: leftStyle, valueGetter: p => p.data?.product.name || '' },
                { field: 'assembled', headerName: '조립', width: 70, cellStyle: centerStyle, cellRenderer: boolRenderer },
                { field: 'decalAttached', headerName: '데칼', width: 70, cellStyle: centerStyle, cellRenderer: boolRenderer },
                { field: 'purchaseDate', headerName: '구매일', width: 110, cellStyle: centerStyle, valueFormatter: p => formatDate(p.value) },
                { field: 'purchasePlace', headerName: '구매처', width: 130, cellStyle: leftStyle },
                {
                    field: 'purchasePrice', headerName: '구매가격', width: 120, cellStyle: rightStyle,
                    valueFormatter: p => p.value == null ? '' : (formatPrice(p.data.purchaseCurrency, p.value) || numberFormat(p.value)),
                },
                { field: 'createdAt', headerName: '등록일시', width: 140, sort: 'desc', cellStyle: centerStyle, valueFormatter: p => formatDateTime(p.value) },
            ],
            defaultColDef: { sortable: true, resizable: true },
            rowHeight: 50,
            overlayNoRowsTemplate: '<span class="dash-empty">보유 제품이 없습니다.</span>',
        });
    }

    async function openUserProducts(user) {
        document.getElementById('modal-user-products-title').textContent =
            `${user.name || '(이름 없음)'} 님의 보유 제품 (${numberFormat(user.ownedCount)}개)`;
        userProductsGridApi.setGridOption('rowData', []);
        modal.classList.add('active');
        PopupNav.open(closeUserProducts);
        try {
            const products = await Api.get(`/api/admin/dashboard/users/${user.id}/products`);
            userProductsGridApi.setGridOption('rowData', products);
        } catch (e) {
            Toast.error(e.message || '오류가 발생했습니다.');
        }
    }

    function closeUserProducts() {
        if (!modal.classList.contains('active')) return;
        modal.classList.remove('active');
        PopupNav.close();
    }

    // ---- Load ----

    async function load() {
        try {
            const [summary, users, onSaleStatus] = await Promise.all([
                Api.get('/api/admin/dashboard'),
                Api.get('/api/admin/dashboard/users'),
                Api.get('/api/admin/on-sale/status'),
            ]);
            renderKpis(summary);
            renderGradeChart(summary.gradeDistribution);
            renderCategoryChart(summary.categoryDistribution);
            renderOnSaleStatus(onSaleStatus);
            topProductsGridApi.setGridOption('rowData', summary.topProducts.map((item, index) => ({ ...item, rank: index + 1 })));
            usersGridApi.setGridOption('rowData', users);
        } catch (e) {
            Toast.error(e.message || '오류가 발생했습니다.');
        }
    }

    document.getElementById('modal-user-products-close').addEventListener('click', closeUserProducts);
    modal.addEventListener('click', e => {
        if (e.target === modal) closeUserProducts();
    });
    document.getElementById('modal-onsale-logs-close').addEventListener('click', closeOnSaleLogs);
    onSaleLogsModal.addEventListener('click', e => {
        if (e.target === onSaleLogsModal) closeOnSaleLogs();
    });
    document.getElementById('onsale-sources').addEventListener('click', e => {
        const item = e.target.closest('.onsale-source');
        if (item) openOnSaleLogs(item.dataset.source);
    });
    document.getElementById('btn-refresh').addEventListener('click', load);

    initOnSaleLogsGrid();
    initUsersGrid();
    initTopProductsGrid();
    initUserProductsGrid();
    load();
})();
