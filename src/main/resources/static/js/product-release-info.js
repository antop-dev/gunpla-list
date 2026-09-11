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

    // 첫번째 열 — 제품 추가 / 박스아트 찾기 버튼을 가로로 나란히
    function ActionRenderer() {}
    ActionRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:4px;height:100%';

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn btn-sm btn-primary';
        addBtn.title = '추가';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        addBtn.addEventListener('click', () => openAddForRow(params.data));
        this.eGui.appendChild(addBtn);

        const boxArtBtn = document.createElement('button');
        boxArtBtn.type = 'button';
        boxArtBtn.className = 'btn btn-sm btn-secondary';
        boxArtBtn.title = '박스아트 찾기';
        boxArtBtn.innerHTML = '<i class="fa-solid fa-image"></i>';
        boxArtBtn.addEventListener('click', () => openBoxArtSearch(params.data));
        this.eGui.appendChild(boxArtBtn);
    };
    ActionRenderer.prototype.getGui = function () { return this.eGui; };
    ActionRenderer.prototype.refresh = function () { return false; };

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

    // 제품명 — 영문 / 일본어 / 한글(번역) 순으로 최대 3줄, 값이 없는 언어는 줄 자체를 생략
    function NameRenderer() {}
    NameRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = 'width:100%;line-height:1.35;overflow:hidden';
        const d = params.data;
        this.eGui.innerHTML = [
            [d.nameEn, 'color:var(--text-primary);font-size:13px'],
            [d.nameJp, 'color:var(--text-secondary);font-size:12px'],
            [d.nameKo, 'color:var(--text-secondary);font-size:12px'],
        ]
            .filter(([value]) => value)
            .map(([value, style]) =>
                `<div style="${style};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(value)}</div>`)
            .join('');
    };
    NameRenderer.prototype.getGui = function () { return this.eGui; };
    NameRenderer.prototype.refresh = function () { return false; };

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
        'gunpla.fyi': 'https://gunpla.fyi/?grade=HG%2HGUC%2CRG%2CPG%2CMG%2CMGSD%2CMGEX',
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

    // 사이트 — URL 을 새 창으로 여는 링크 아이콘과 URL 을 클립보드로 복사하는 아이콘
    function SiteRenderer() {}
    SiteRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;height:100%';
        this.refresh(params);
    };
    SiteRenderer.prototype.getGui = function () { return this.eGui; };
    SiteRenderer.prototype.refresh = function (params) {
        const url = params.data.sourceUrl;
        this.eGui.innerHTML = '';
        if (!url) return true;

        const linkStyle = 'color:var(--accent);font-size:14px;cursor:pointer;text-decoration:none';

        const link = document.createElement('a');
        link.style.cssText = linkStyle;
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = url;
        link.innerHTML = '<i class="fa-solid fa-link"></i>';
        this.eGui.appendChild(link);

        const copyLink = document.createElement('a');
        copyLink.style.cssText = linkStyle;
        copyLink.href = '#';
        copyLink.title = 'URL 복사';
        copyLink.innerHTML = '<i class="fa-solid fa-copy"></i>';
        copyLink.addEventListener('click', e => {
            e.preventDefault();
            copyUrl(url);
        });
        this.eGui.appendChild(copyLink);
        return true;
    };

    async function copyUrl(url) {
        try {
            await navigator.clipboard.writeText(url);
            Toast.success('URL 을 복사했습니다.');
        } catch (e) {
            Toast.error('URL 복사에 실패했습니다.');
        }
    }

    // 반다이 메뉴얼 URL(https://manual.bandai-hobby.net/menus/detail/{번호})에서 메뉴얼 번호만 추출
    const MANUAL_URL_PATTERN = /^https?:\/\/manual\.bandai-hobby\.net\/menus\/detail\/([^/?#]+)/i;

    function manualNumber(url) {
        const matched = url && url.match(MANUAL_URL_PATTERN);
        return matched ? matched[1] : '';
    }

    // ---- Grid init ----

    function initGrid() {
        const gridEl = document.getElementById('product-release-info-grid');
        const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const leftStyle   = { display: 'flex', alignItems: 'center', overflow: 'hidden' };
        const rightStyle  = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };

        const colDefs = [
            {
                headerName: '', pinned: 'left', width: 84,
                resizable: false, sortable: false, filter: false,
                cellRenderer: ActionRenderer, cellStyle: centerStyle,
            },
            {
                headerName: '확인여부', width: 90, filter: false,
                headerClass: 'header-center',
                cellRenderer: CheckRenderer, cellStyle: centerStyle,
            },
            {
                headerName: '이미지', width: 100,
                resizable: false, sortable: false, filter: false,
                headerClass: 'header-center',
                cellRenderer: ImageRenderer, cellStyle: centerStyle,
            },
            {
                field: 'grade', headerName: '등급', width: 90, filter: false,
                headerClass: 'header-center',
                cellRenderer: GradeRenderer, cellStyle: centerStyle,
            },
            {
                field: 'source', headerName: '출처', width: 160, minWidth: 100, filter: false,
                cellRenderer: SourceRenderer, cellStyle: leftStyle,
            },
            {
                headerName: '제품명', flex: 1, minWidth: 260, filter: false,
                cellRenderer: NameRenderer, cellStyle: leftStyle,
            },
            {
                headerName: '발매년월', width: 110, filter: false,
                headerClass: 'header-center',
                cellStyle: centerStyle,
                valueGetter: p => formatReleaseDate(p.data.releaseYear, p.data.releaseMonth),
            },
            {
                field: 'price', headerName: '출시가격', width: 110, filter: false,
                headerClass: 'header-right',
                cellStyle: rightStyle,
                valueFormatter: p => p.value != null ? '¥ ' + p.value.toLocaleString() : '',
            },
            {
                field: 'sourceUrl', headerName: '사이트', width: 100, filter: false,
                resizable: false,
                cellRenderer: SiteRenderer, cellStyle: centerStyle,
            },
            {
                headerName: '메뉴얼 번호', width: 110, filter: false,
                headerClass: 'header-center',
                cellStyle: centerStyle,
                valueGetter: p => manualNumber(p.data.sourceUrl),
            },
        ];

        gridApi = agGrid.createGrid(gridEl, {
            columnDefs: colDefs,
            rowData: [],
            rowHeight: 68,
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
        const name = row.nameEn || row.nameJp || row.nameKo;
        const parts = ['gunpla', row.grade, row.releaseYear, name, 'boxart'];
        const query = parts.filter(Boolean).join(' ');
        window.open('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query), '_blank', 'noopener');
    }

    // ---- Lightbox ----

    function openLightbox(url) {
        if (!url) return;
        document.getElementById('lightbox-img').src = _url('/api/admin/product-release-info/image?url=' + encodeURIComponent(url));
        document.getElementById('lightbox-overlay').classList.add('active');
    }

    function closeLightbox() {
        document.getElementById('lightbox-overlay').classList.remove('active');
    }

    /** 서버가 내려주는 이미지는 JPEG 이지만 클립보드는 PNG 만 허용하므로 캔버스로 변환한다.
     *  (이미지는 같은 출처의 프록시 API 로 받으므로 캔버스가 오염되지 않는다) */
    function toPngBlob(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('이미지 변환 실패'))), 'image/png');
        });
    }

    async function copyLightboxImage() {
        const img = document.getElementById('lightbox-img');
        if (!img.src || !img.naturalWidth) {
            Toast.error('이미지를 아직 불러오지 못했습니다.');
            return;
        }
        try {
            const blob = await toPngBlob(img);
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            Toast.success('이미지를 복사했습니다.');
            closeLightbox();
        } catch (e) {
            Toast.error('이미지 복사에 실패했습니다.');
        }
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
        document.getElementById('lightbox-overlay').addEventListener('click', closeLightbox);
        document.getElementById('lightbox-copy').addEventListener('click', e => {
            e.stopPropagation(); // 오버레이 클릭(닫기)으로 전파되지 않게 함 — 복사 성공 후에만 닫는다
            copyLightboxImage();
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.getElementById('lightbox-overlay').classList.contains('active')) {
                closeLightbox();
            }
        });
        const categories = await Api.get('/api/admin/categories');
        ProductModal.init({ categories, onSaved: onProductAdded });
        search();
    });
})();
