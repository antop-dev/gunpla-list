/* 어드민 제품 목록 그리드 — AG Grid Community 사용
 * 검색/정렬은 서버에서 처리한다 — 검색 버튼/Enter 를 눌렀을 때의 조건(appliedCriteria)과 헤더 정렬로 목록을 다시 조회한다
 * 제품 추가/수정 팝업은 product-modal.js(ProductModal) 공용 모듈 사용
 */
(function () {
    let gridApi = null;
    let allProducts = [];
    let allCategories = [];
    // 마지막으로 '검색'을 실행한 조건 — 입력창을 고쳐도 검색 전까지는 목록/하이라이트에 반영되지 않는다
    let appliedCriteria = {};
    let loadSeq = 0;            // 늦게 도착한 이전 응답이 최신 결과를 덮지 않도록 하는 요청 번호
    let suppressSortEvent = false; // 코드로 정렬 상태를 바꿀 때 sortChanged 로 인한 재조회를 막는다

    // ---- AG Grid cell renderers ----

    function BoxArtRenderer() {}
    BoxArtRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'cell-boxart';
        this.refresh(params);
    };
    BoxArtRenderer.prototype.getGui = function () { return this.eGui; };
    BoxArtRenderer.prototype.refresh = function (params) {
        if (params.value) {
            this.eGui.innerHTML = `<img src="${params.value}" alt="thumb" style="cursor:zoom-in">`
                + boxArtCountHtml(params.data);
            // 여러 장이면 라이트박스에서 < > 로 넘겨 볼 수 있도록 전체 목록을 넘긴다
            const urls = params.data.boxArts?.length ? params.data.boxArts.map(b => b.url) : [params.data.boxArtUrl];
            this.eGui.querySelector('img').addEventListener('click', () => openLightbox(urls));
        } else {
            this.eGui.innerHTML = `<div class="cell-boxart-placeholder">NO IMAGE</div>`;
        }
        return true;
    };

    function CategoryRenderer() {}
    CategoryRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'cell-categories';
        this.refresh(params);
    };
    CategoryRenderer.prototype.getGui = function () { return this.eGui; };
    CategoryRenderer.prototype.refresh = function (params) {
        const c = params.value;
        this.eGui.innerHTML = c
            ? `<span class="chip" style="background:${hexToRgba(c.color,0.2)};border-color:${c.color};color:${c.color}">${escHtml(c.name)}</span>`
            : '';
        return true;
    };

    function NameRenderer() {}
    NameRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'cell-name';
        this.refresh(params);
    };
    NameRenderer.prototype.getGui = function () { return this.eGui; };
    NameRenderer.prototype.refresh = function (params) {
        const name = params.data.name || '';
        const grade = params.data.grade || '';
        const cat = params.data.category;
        const catHtml = cat
            ? `<span class="chip" style="background:${hexToRgba(cat.color,0.2)};border-color:${cat.color};color:${cat.color}">${escHtml(cat.name)}</span>`
            : '';
        const gradeColor = GRADE_COLORS[grade] || '#6c7a8d';
        const gradeHtml = grade
            ? `<span class="chip" style="background:${hexToRgba(gradeColor,0.15)};border-color:${gradeColor};color:${gradeColor}">${escHtml(grade)}</span>`
            : '';
        const nameKw = appliedCriteria.name || '';
        const variationHtml = params.data.variationId
            ? `<button type="button" class="variation-tree-icon" title="바리에이션 구성도" aria-label="바리에이션 구성도"><i class="fa-solid fa-sitemap"></i></button>`
            : '';
        this.eGui.innerHTML = `
            <div class="name-line1">${highlightText(name, nameKw)}${variationHtml}</div>
            <div class="name-line2">${gradeHtml}${catHtml}</div>
        `;
        this.eGui.querySelector('.variation-tree-icon')?.addEventListener('click', e => {
            e.stopPropagation();
            openVariationPopup(params.data);
        });
        return true;
    };

    function ModelNumberRenderer() {}
    ModelNumberRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    ModelNumberRenderer.prototype.getGui = function () { return this.eGui; };
    ModelNumberRenderer.prototype.refresh = function (params) {
        const kw = appliedCriteria.modelNumber || '';
        this.eGui.innerHTML = highlightText(params.data.modelNumber, kw);
        return true;
    };

    function SeriesRenderer() {}
    SeriesRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    SeriesRenderer.prototype.getGui = function () { return this.eGui; };
    SeriesRenderer.prototype.refresh = function (params) {
        const kw = appliedCriteria.series || '';
        this.eGui.innerHTML = highlightText(params.data.series, kw);
        return true;
    };

    function ManualRenderer() {}
    ManualRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = 'display:flex;align-items:center;gap:8px;height:100%';
        this.refresh(params);
    };
    ManualRenderer.prototype.getGui = function () { return this.eGui; };
    // 매뉴얼이 여러 개인 제품이 있어 앞의 2개까지 아이콘으로 걸고 아래첨자로 번호를 매긴다 (전체는 수정 팝업에서 확인)
    ManualRenderer.prototype.refresh = function (params) {
        const all = params.data.manualUrls || [];
        const urls = all.slice(0, MANUAL_LIMIT);
        this.eGui.innerHTML = urls
            .map((url, i) => `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer"
                  title="매뉴얼 ${i + 1} (총 ${all.length}건)"
                  style="color:var(--accent);font-size:14px"
                  onclick="event.stopPropagation()">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>${manualIndexHtml(urls.length, i)}
               </a>`)
            .join('');
        return true;
    };

    function SourceRenderer() {}
    SourceRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = 'display:flex;align-items:center;height:100%';
        this.refresh(params);
    };
    SourceRenderer.prototype.getGui = function () { return this.eGui; };
    SourceRenderer.prototype.refresh = function (params) {
        const url = params.data.sourceUrl;
        this.eGui.innerHTML = url
            ? `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer"
                  style="color:var(--accent);font-size:14px"
                  onclick="event.stopPropagation()">
                <i class="fa-solid fa-link"></i>
               </a>`
            : '';
        return true;
    };

    function PriceRenderer() {}
    PriceRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    PriceRenderer.prototype.getGui = function () { return this.eGui; };
    PriceRenderer.prototype.refresh = function (params) {
        const { currency, price } = params.data;
        this.eGui.textContent = (currency && price != null) ? formatPrice(currency, price) : '';
        return true;
    };

    function ActionsRenderer() {}
    ActionsRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.className = 'cell-actions';
        this.eGui.innerHTML = `
            <button class="btn btn-sm btn-secondary" data-action="edit"><i class="fa-solid fa-pen-to-square"></i> 수정</button>
            <button class="btn btn-sm btn-secondary" data-action="delete"><i class="fa-solid fa-trash" style="color:#dc3545"></i></button>`;
        this.eGui.querySelector('[data-action="edit"]').addEventListener('click', () => {
            const current = allProducts.find(p => p.id === params.data.id) || params.data;
            ProductModal.openEdit(current);
        });
        this.eGui.querySelector('[data-action="delete"]').addEventListener('click', () => deleteProduct(params.data.id));
    };
    ActionsRenderer.prototype.getGui = function () { return this.eGui; };
    ActionsRenderer.prototype.refresh = function () { return false; };

    function ReleaseDateRenderer() {}
    ReleaseDateRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    ReleaseDateRenderer.prototype.getGui = function () { return this.eGui; };
    ReleaseDateRenderer.prototype.refresh = function (params) {
        const { releaseYear: y, releaseMonth: m } = params.data;
        this.eGui.textContent = formatReleaseDate(y, m);
        return true;
    };

    // ---- Grid init ----

    function initGrid() {
        const gridEl = document.getElementById('products-grid');
        const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
        const leftStyle   = { display: 'flex', alignItems: 'center', overflow: 'hidden' };

        const colDefs = [
            {
                field: 'boxArtThumbUrl', headerName: '박스아트',
                cellRenderer: BoxArtRenderer, width: 100, resizable: false, sortable: false, filter: false,
                cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
            },
            {
                field: 'modelNumber', headerName: '형식번호', width: 161, minWidth: 100, filter: false,
                cellRenderer: ModelNumberRenderer, comparator: serverOrder,
                cellClass: 'col-model-number',
                cellStyle: leftStyle,
            },
            {
                field: 'name', headerName: '제품명',
                cellRenderer: NameRenderer, comparator: serverOrder, width: 450, minWidth: 150, filter: false,
                cellStyle: leftStyle,
            },
            {
                colId: 'releaseDate', headerName: '발매년월',
                cellRenderer: ReleaseDateRenderer, comparator: serverOrder, width: 110, minWidth: 80, sortable: true,
                sort: 'desc', sortIndex: 0, filter: false,
                cellStyle: centerStyle,
            },
            {
                field: 'price', headerName: '출시가격',
                cellRenderer: PriceRenderer, comparator: serverOrder, width: 150, minWidth: 100, filter: false,
                cellStyle: centerStyle,
            },
            {
                field: 'series', headerName: '출연작', width: 200, minWidth: 100, filter: false,
                cellRenderer: SeriesRenderer, comparator: serverOrder,
                cellStyle: leftStyle,
            },
            {
                field: 'sourceUrl', headerName: '출처',
                cellRenderer: SourceRenderer, width: 70, resizable: false, sortable: false, filter: false,
                cellStyle: centerStyle,
            },
            {
                field: 'manualUrls', headerName: '매뉴얼',
                cellRenderer: ManualRenderer, width: 80, resizable: false, sortable: false, filter: false,
                cellStyle: centerStyle,
            },
            {
                headerName: '', flex: 1, resizable: false, sortable: false, filter: false,
            },
            {
                field: 'actions', headerName: '', cellRenderer: ActionsRenderer,
                width: 130, resizable: false, sortable: false, filter: false, pinned: 'right',
                cellStyle: centerStyle,
            },
        ];

        gridApi = agGrid.createGrid(gridEl, {
            columnDefs: colDefs,
            rowData: [],
            rowHeight: 58,
            headerHeight: 40,
            defaultColDef: { resizable: true, sortable: true },
            animateRows: false,
            enableCellTextSelection: true,
            getRowId: params => String(params.data.id),
            ...lastClickedRowHighlight(),
            onSortChanged: () => { if (!suppressSortEvent) loadProducts(); },
            overlayLoadingTemplate: GRID_LOADING_OVERLAY,
            unSortIcon: true,
            icons: { sortUnSort: '<span style="color:var(--text-muted)">–</span>' },
        });
    }

    // 정렬은 서버가 하므로 그리드는 받은 순서를 그대로 둔다
    function serverOrder() { return 0; }

    // 입력창의 현재 값을 검색 조건으로 확정한다
    function readCriteria() {
        const val = id => document.getElementById(id)?.value.trim() || '';
        return {
            grade: val('search-grade'),
            categoryId: val('search-category'),
            name: val('search-name'),
            modelNumber: val('search-model'),
            series: val('search-series'),
            hasBoxArt: val('search-boxart'),
            hasManual: val('search-manual'),
        };
    }

    function buildQuery() {
        const params = new URLSearchParams();
        const c = appliedCriteria;
        if (c.grade) params.set('grade', c.grade);
        if (c.categoryId) params.set('categoryId', c.categoryId);
        if (c.name) params.set('name', c.name);
        if (c.modelNumber) params.set('modelNumber', c.modelNumber);
        if (c.series) params.set('series', c.series);
        if (c.hasBoxArt) params.set('hasBoxArt', c.hasBoxArt === 'Y');
        if (c.hasManual) params.set('hasManual', c.hasManual === 'Y');
        const sorted = gridApi.getColumnState().find(s => s.sort);
        if (sorted) {
            params.set('sortBy', sorted.colId);
            params.set('sortDir', sorted.sort);
        }
        return params.toString();
    }

    // ---- Data loading ----

    async function loadCategories() {
        allCategories = await Api.get('/api/admin/categories');
        renderCategoryFilter();
    }

    function renderCategoryFilter() {
        const sel = document.getElementById('search-category');
        if (!sel) return;
        sel.innerHTML = `<option value="">구분 전체</option>` +
            allCategories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
    }

    // 적용된 검색 조건 + 현재 정렬로 서버에서 목록을 가져온다
    async function loadProducts() {
        const seq = ++loadSeq;
        const stopLoading = startGridLoading(gridApi, document.getElementById('btn-search'), [document.getElementById('btn-refresh')]);
        try {
            const products = await Api.get('/api/admin/products?' + buildQuery());
            if (seq !== loadSeq) return;
            allProducts = products;
            gridApi.setGridOption('rowData', allProducts);
            gridApi.refreshCells({ force: true }); // 검색어 하이라이트 갱신
        } catch (e) {
            if (seq === loadSeq) Toast.error(e.message);
        } finally {
            if (seq === loadSeq) stopLoading();
        }
    }

    // 검색: 입력창의 현재 조건으로 조회
    async function searchProducts() {
        appliedCriteria = readCriteria();
        await loadProducts();
    }

    // 새로고침: 검색/정렬 조건을 초기화하고 서버에서 목록을 다시 가져옴
    async function refreshProducts() {
        const btn = document.getElementById('btn-refresh');
        const icon = btn.querySelector('i');
        btn.disabled = true;
        icon.className = 'fa-solid fa-spinner fa-spin';
        try {
            ['search-category', 'search-grade', 'search-model', 'search-name', 'search-series', 'search-boxart', 'search-manual'].forEach(id => {
                document.getElementById(id).value = '';
            });
            suppressSortEvent = true;
            gridApi.applyColumnState({
                state: [{ colId: 'releaseDate', sort: 'desc', sortIndex: 0 }],
                defaultState: { sort: null },
            });
            suppressSortEvent = false;
            await searchProducts();
        } catch (e) {
            Toast.error(e.message);
        } finally {
            btn.disabled = false;
            icon.className = 'fa-solid fa-rotate';
        }
    }

    // ---- Product modal save callback ----

    function onProductSaved(product, isNew) {
        if (isNew) {
            allProducts.push(product);
            gridApi.applyTransaction({ add: [product] });
        } else {
            const idx = allProducts.findIndex(p => p.id === product.id);
            if (idx !== -1) allProducts[idx] = product;
            gridApi.applyTransaction({ update: [product] });
            const node = gridApi.getRowNode(String(product.id));
            if (node) gridApi.refreshCells({ rowNodes: [node], force: true });
        }
        flashRow(product.id);
    }

    async function deleteProduct(id) {
        const ok = await Confirm.show('정말로 삭제하시겠습니까?');
        if (!ok) return;
        try {
            await Api.delete(`/api/admin/products/${id}`);
            Toast.success('삭제되었습니다.');
            const idx = allProducts.findIndex(p => p.id === id);
            if (idx !== -1) allProducts.splice(idx, 1);
            gridApi.applyTransaction({ remove: [{ id }] });
        } catch (e) {
            Toast.error(e.message);
        }
    }

    // ---- 바리에이션 구성도 팝업 (보기 전용) ----

    // Drawflow 는 팝업을 띄운 뒤에 만들어야 연결선 위치가 맞는다 (한 번 만들어 계속 재사용)
    let variationEditor = null;

    async function openVariationPopup(product) {
        let variation;
        try {
            variation = await Api.get(`/api/products/${product.id}/variation`);
        } catch (e) {
            Toast.error(e.message);
            return;
        }
        document.getElementById('modal-variation-title').textContent = `바리에이션 구성도 · ${variation.name}`;
        document.getElementById('modal-variation').classList.add('active');
        PopupNav.open(closeVariationPopup);

        const board = document.getElementById('variation-board');
        if (!variationEditor) {
            variationEditor = VariationTree.create(board, { mode: 'view' });
            VariationTree.addZoomControls(variationEditor, board);
        }
        VariationTree.load(variationEditor, variation, { currentProductId: product.id, ownedProductIds: new Set() });
        VariationTree.fit(variationEditor);
    }

    function closeVariationPopup() {
        document.getElementById('modal-variation').classList.remove('active');
        PopupNav.close();
    }

    // ---- Category modal ----

    async function openCategoryModal() {
        await renderCategoryList();
        document.getElementById('modal-category').classList.add('active');
        PopupNav.open(closeCategoryModal);
    }

    function closeCategoryModal() {
        document.getElementById('modal-category').classList.remove('active');
        PopupNav.close();
    }

    async function renderCategoryList() {
        allCategories = await Api.get('/api/admin/categories');
        const list = document.getElementById('category-list');
        list.innerHTML = allCategories.map(c => `
            <div class="category-item" data-id="${c.id}">
                <input type="color" class="category-color-input" value="${escHtml(c.color)}"
                       onchange="updateCategoryItem(${c.id})">
                <input type="text" class="category-name-input" value="${escHtml(c.name)}"
                       onblur="updateCategoryItem(${c.id})"
                       onkeydown="if(event.key==='Enter')this.blur()">
                <button class="btn btn-sm btn-ghost" onclick="deleteCategoryItem(${c.id})">×</button>
            </div>`).join('');
    }

    async function addCategory() {
        const nameEl = document.getElementById('new-category-name');
        const colorEl = document.getElementById('new-category-color');
        const name = nameEl.value.trim();
        if (!name) return;
        try {
            await Api.post('/api/admin/categories', { name, color: colorEl.value });
            nameEl.value = '';
            await renderCategoryList();
            renderCategoryFilter();
            ProductModal.refreshCategories(allCategories);
        } catch (e) {
            Toast.error(e.message);
        }
    }

    window.updateCategoryItem = async function (id) {
        const item = document.querySelector(`.category-item[data-id="${id}"]`);
        if (!item) return;
        const name = item.querySelector('.category-name-input').value.trim();
        const color = item.querySelector('.category-color-input').value;
        if (!name) return;
        const cat = allCategories.find(c => c.id === id);
        if (!cat || (cat.name === name && cat.color === color)) return;
        try {
            const updated = await Api.put(`/api/admin/categories/${id}`, { name, color, sortOrder: cat.sortOrder });
            const idx = allCategories.findIndex(c => c.id === id);
            if (idx !== -1) allCategories[idx] = updated;
            renderCategoryFilter();
            ProductModal.refreshCategories(allCategories);
        } catch (e) {
            item.querySelector('.category-name-input').value = cat.name;
            item.querySelector('.category-color-input').value = cat.color;
            Toast.error(e.message);
        }
    };

    window.deleteCategoryItem = async function (id) {
        try {
            await Api.delete(`/api/admin/categories/${id}`);
            await renderCategoryList();
            renderCategoryFilter();
            ProductModal.refreshCategories(allCategories);
        } catch (e) {
            Toast.error(e.message);
        }
    };

    // ---- Lightbox ----

    // 라이트박스에서 넘겨 볼 원본 이미지 목록과 현재 위치 (박스아트가 여러 장인 제품)
    let lightboxUrls = [];
    let lightboxIndex = 0;

    function closeLightbox() {
        document.getElementById('lightbox-img').removeAttribute('src');
        document.getElementById('lightbox-overlay').classList.remove('active');
        lightboxUrls = [];
        PopupNav.close();
    }

    // url 하나 또는 URL 목록을 받는다 — 목록이 두 장 이상이면 < > 버튼과 장수를 보여준다
    window.openLightbox = function (urls, index = 0) {
        lightboxUrls = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
        if (!lightboxUrls.length) return;
        showLightboxImage(index);
        document.getElementById('lightbox-overlay').classList.add('active');
        PopupNav.open(closeLightbox);
    };

    // 목록 끝에서 넘기면 반대쪽 끝으로 돌아간다
    function showLightboxImage(index) {
        lightboxIndex = (index + lightboxUrls.length) % lightboxUrls.length;
        const multiple = lightboxUrls.length > 1;
        document.getElementById('lightbox-prev').hidden = !multiple;
        document.getElementById('lightbox-next').hidden = !multiple;
        const counter = document.getElementById('lightbox-counter');
        counter.hidden = !multiple;
        counter.textContent = `${lightboxIndex + 1} / ${lightboxUrls.length}`;
        document.getElementById('lightbox-img').src = lightboxUrls[lightboxIndex];
    }

    function isLightboxOpen() {
        return document.getElementById('lightbox-overlay').classList.contains('active');
    }

    // ---- Helpers ----

    function flashRow(productId) {
        requestAnimationFrame(() => {
            const rowEl = document.querySelector(`.ag-row[row-id="${productId}"]`);
            if (!rowEl) return;
            rowEl.classList.remove('row-flash');
            void rowEl.offsetWidth;
            rowEl.classList.add('row-flash');
            rowEl.addEventListener('animationend', () => rowEl.classList.remove('row-flash'), { once: true });
        });
    }

    // ---- Event bindings ----

    function bindEvents() {
        document.getElementById('btn-add-product').addEventListener('click', () => {
            const searchGrade = document.getElementById('search-grade')?.value;
            ProductModal.openAdd(searchGrade ? { grade: searchGrade } : null);
        });
        document.getElementById('btn-manage-categories').addEventListener('click', openCategoryModal);

        document.getElementById('btn-refresh').addEventListener('click', refreshProducts);
        // 조건을 바꿔도 바로 검색하지 않고, 검색 버튼이나 Enter 를 눌렀을 때만 조회한다
        const guardedSearch = ignoreWhileRunning(searchProducts);
        document.getElementById('btn-search').addEventListener('click', guardedSearch);
        ['search-name', 'search-model', 'search-series'].forEach(id => {
            document.getElementById(id).addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.isComposing) guardedSearch();
            });
        });

        // Category modal
        document.getElementById('btn-category-add').addEventListener('click', addCategory);
        document.getElementById('btn-category-close').addEventListener('click', closeCategoryModal);
        document.getElementById('modal-category-close').addEventListener('click', closeCategoryModal);
        document.getElementById('modal-variation-close').addEventListener('click', closeVariationPopup);
        document.getElementById('modal-variation').addEventListener('click', e => {
            if (e.target === e.currentTarget) closeVariationPopup();
        });
        document.getElementById('new-category-name').addEventListener('keypress', e => {
            if (e.key === 'Enter') addCategory();
        });

        // Lightbox
        document.getElementById('lightbox-overlay').addEventListener('click', closeLightbox);
        // < > 버튼은 배경 클릭(닫기)으로 전달되지 않게 막는다
        document.getElementById('lightbox-prev').addEventListener('click', e => {
            e.stopPropagation();
            showLightboxImage(lightboxIndex - 1);
        });
        document.getElementById('lightbox-next').addEventListener('click', e => {
            e.stopPropagation();
            showLightboxImage(lightboxIndex + 1);
        });
        document.addEventListener('keydown', e => {
            if (!isLightboxOpen() || lightboxUrls.length < 2) return;
            if (e.key === 'ArrowLeft') showLightboxImage(lightboxIndex - 1);
            if (e.key === 'ArrowRight') showLightboxImage(lightboxIndex + 1);
        });
    }

    // ---- Init ----

    document.addEventListener('DOMContentLoaded', async () => {
        initGrid();
        createColumnDropdown(document.getElementById('column-visibility'), gridApi);
        bindEvents();
        await Promise.all([loadCategories(), searchProducts()]);
        ProductModal.init({ categories: allCategories, onSaved: onProductSaved });
    });

})();
