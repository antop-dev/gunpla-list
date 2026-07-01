/* 어드민 제품 목록 그리드 — AG Grid Community 사용
 * 필터: isExternalFilterPresent/doesExternalFilterPass 패턴으로 클라이언트 사이드 필터링
 * 모달: 제품 추가/수정, 카테고리 관리, 비밀번호 변경
 */
(function () {
    let gridApi = null;
    let allProducts = [];
    let allCategories = [];
    let editingProductId = null;
    let pendingBoxArtFile = null;

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
            this.eGui.innerHTML = `<img src="${params.value}" alt="thumb" onclick="openLightbox('${params.data.boxArtUrl}')" style="cursor:zoom-in">`;
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
        const nameKw = document.getElementById('search-name')?.value.trim() || '';
        this.eGui.innerHTML = `
            <div class="name-line1">${highlightText(name, nameKw)}</div>
            <div class="name-line2">${gradeHtml}${catHtml}</div>
        `;
        return true;
    };

    function ModelNumberRenderer() {}
    ModelNumberRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('span');
        this.refresh(params);
    };
    ModelNumberRenderer.prototype.getGui = function () { return this.eGui; };
    ModelNumberRenderer.prototype.refresh = function (params) {
        const kw = document.getElementById('search-model')?.value.trim() || '';
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
        const kw = document.getElementById('search-series')?.value.trim() || '';
        this.eGui.innerHTML = highlightText(params.data.series, kw);
        return true;
    };

    function ManualRenderer() {}
    ManualRenderer.prototype.init = function (params) {
        this.eGui = document.createElement('div');
        this.eGui.style.cssText = 'display:flex;align-items:center;height:100%';
        this.refresh(params);
    };
    ManualRenderer.prototype.getGui = function () { return this.eGui; };
    ManualRenderer.prototype.refresh = function (params) {
        const url = params.data.manualUrl;
        this.eGui.innerHTML = url
            ? `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer"
                  style="color:var(--accent);font-size:14px"
                  onclick="event.stopPropagation()">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
               </a>`
            : '';
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
            openEditModal(current);
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
                cellRenderer: ModelNumberRenderer,
                cellClass: 'col-model-number',
                cellStyle: leftStyle,
            },
            {
                field: 'name', headerName: '제품명',
                cellRenderer: NameRenderer, width: 450, minWidth: 150, filter: false,
                cellStyle: leftStyle,
            },
            {
                headerName: '발매년월',
                cellRenderer: ReleaseDateRenderer, width: 110, minWidth: 80, sortable: true,
                sort: 'desc', sortIndex: 0, filter: false,
                cellStyle: centerStyle,
                valueGetter: p => {
                    const year = p.data?.releaseYear;
                    if (!year) return null;
                    return year * 100 + (p.data?.releaseMonth || 0);
                },
            },
            {
                field: 'price', headerName: '출시가격',
                cellRenderer: PriceRenderer, width: 150, minWidth: 100, filter: false,
                cellStyle: centerStyle,
            },
            {
                field: 'series', headerName: '출연작', width: 200, minWidth: 100, filter: false,
                cellRenderer: SeriesRenderer,
                cellStyle: leftStyle,
            },
            {
                field: 'sourceUrl', headerName: '출처',
                cellRenderer: SourceRenderer, width: 70, resizable: false, sortable: false, filter: false,
                cellStyle: centerStyle,
            },
            {
                field: 'manualUrl', headerName: '매뉴얼',
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
            isExternalFilterPresent: isFilterActive,
            doesExternalFilterPass: filterPass,
            unSortIcon: true,
            icons: { sortUnSort: '<span style="color:var(--text-muted)">–</span>' },
        });
    }

    function isFilterActive() {
        return !!(
            document.getElementById('search-grade')?.value ||
            document.getElementById('search-category')?.value ||
            document.getElementById('search-boxart')?.value ||
            document.getElementById('search-name')?.value.trim() ||
            document.getElementById('search-model')?.value.trim() ||
            document.getElementById('search-series')?.value.trim()
        );
    }

    function filterPass(node) {
        const grade = document.getElementById('search-grade')?.value;
        const categoryId = document.getElementById('search-category')?.value;
        const boxart = document.getElementById('search-boxart')?.value;
        const name = document.getElementById('search-name')?.value.trim().toLowerCase();
        const model = document.getElementById('search-model')?.value.trim().toLowerCase();
        const series = document.getElementById('search-series')?.value.trim().toLowerCase();
        if (grade && node.data.grade !== grade) return false;
        if (categoryId && String(node.data.category?.id) !== categoryId) return false;
        if (boxart === 'Y' && !node.data.boxArtThumbUrl) return false;
        if (boxart === 'N' && !!node.data.boxArtThumbUrl) return false;
        if (name && !node.data.name?.toLowerCase().includes(name)) return false;
        if (model && !node.data.modelNumber?.toLowerCase().includes(model)) return false;
        if (series && !node.data.series?.toLowerCase().includes(series)) return false;
        return true;
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

    async function loadProducts() {
        allProducts = await Api.get('/api/admin/products');
        gridApi.setGridOption('rowData', allProducts);
    }

    // ---- Modal: Create/Edit ----

    function openAddModal() {
        editingProductId = null;
        document.getElementById('modal-product-title').textContent = '제품 추가';
        resetProductForm();
        const searchGrade = document.getElementById('search-grade')?.value;
        if (searchGrade) document.getElementById('field-grade').value = searchGrade;
        document.getElementById('modal-product').classList.add('active');
    }

    function openEditModal(product) {
        editingProductId = product.id;
        document.getElementById('modal-product-title').textContent = '제품 수정';
        resetProductForm();
        fillProductForm(product);
        renderBoxArtPreview(product);
        document.getElementById('modal-product').classList.add('active');
    }

    function closeProductModal() {
        document.getElementById('modal-product').classList.remove('active');
    }

    function resetProductForm() {
        document.getElementById('form-product').reset();
        document.getElementById('field-currency').value = 'JPY';
        document.getElementById('selected-categories').innerHTML = '';
        pendingBoxArtFile = null;
        renderBoxArtPreview({});
    }

    function fillProductForm(p) {
        document.getElementById('field-grade').value = p.grade || '';
        document.getElementById('field-model').value = p.modelNumber || '';
        document.getElementById('field-name').value = p.name || '';
        document.getElementById('field-release').value = (p.releaseYear && p.releaseMonth)
            ? `${p.releaseYear}.${String(p.releaseMonth).padStart(2, '0')}` : '';
        document.getElementById('field-currency').value = p.currency || 'JPY';
        document.getElementById('field-price').value = p.price != null ? p.price : '';
        document.getElementById('field-manual').value = p.manualUrl || '';
        document.getElementById('field-source').value = p.sourceUrl || '';
        document.getElementById('field-series').value = p.series || '';

        const container = document.getElementById('selected-categories');
        if (p.category) addCategoryChip(container, p.category);

    }

    function renderBoxArtPreview(product) {
        const wrap = document.getElementById('boxart-preview-wrap');
        const pasteArea = document.getElementById('boxart-paste-area');
        if (product.boxArtThumbUrl) {
            document.getElementById('boxart-thumb-preview').src = product.boxArtThumbUrl;
            const link = document.getElementById('boxart-original-link');
            link.href = product.boxArtUrl || '#';
            link.style.display = product.boxArtUrl ? '' : 'none';
            wrap.style.display = '';
            document.getElementById('btn-boxart-remove').style.display = '';
            pasteArea.style.display = 'none';
        } else {
            wrap.style.display = 'none';
            document.getElementById('btn-boxart-remove').style.display = 'none';
            pasteArea.style.display = '';
        }
    }

    function addCategoryChip(container, cat) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.style.cssText = `background:${hexToRgba(cat.color,0.2)};border-color:${cat.color};color:${cat.color};cursor:pointer`;
        chip.dataset.id = cat.id;
        chip.textContent = cat.name + ' ×';
        chip.addEventListener('click', () => chip.remove());
        container.appendChild(chip);
    }

    function getSelectedCategoryId() {
        const el = document.getElementById('selected-categories').querySelector('[data-id]');
        return el ? parseInt(el.dataset.id) : null;
    }

    function setSaving(saving) {
        const btnSave   = document.getElementById('btn-product-save');
        const btnCancel = document.getElementById('btn-product-cancel');
        const btnClose  = document.getElementById('modal-product-close');
        btnSave.disabled   = saving;
        btnCancel.disabled = saving;
        btnClose.disabled  = saving;
        btnSave.querySelector('i').className = saving
            ? 'fa-solid fa-spinner fa-spin'
            : 'fa-solid fa-floppy-disk';
    }

    async function saveProduct() {
        const name = document.getElementById('field-name').value.trim();
        if (!name) { Toast.error('제품명은 필수입니다.'); return; }

        const releaseRaw = document.getElementById('field-release').value.trim();
        let releaseYear = null, releaseMonth = null;
        if (releaseRaw) {
            const m = releaseRaw.match(/^\d{4}\.\d{1,2}$/);
            if (!m) { Toast.error('발매년월은 YYYY.MM 형식으로 입력하세요.'); return; }
            const parts = releaseRaw.split('.');
            releaseYear = parseInt(parts[0]);
            releaseMonth = parseInt(parts[1]);
        }

        const priceRaw = document.getElementById('field-price').value.trim();
        const price = priceRaw ? parseInt(priceRaw) : null;
        const currency = priceRaw ? document.getElementById('field-currency').value : null;

        const body = {
            grade: document.getElementById('field-grade').value,
            modelNumber: document.getElementById('field-model').value.trim() || null,
            name,
            releaseYear,
            releaseMonth,
            currency,
            price,
            manualUrl: document.getElementById('field-manual').value.trim() || null,
            sourceUrl: document.getElementById('field-source').value.trim() || null,
            series: document.getElementById('field-series').value.trim() || null,
            categoryId: getSelectedCategoryId(),
        };

        setSaving(true);
        try {
            let finalProduct;
            try {
                if (editingProductId) {
                    finalProduct = await Api.put(`/api/admin/products/${editingProductId}`, body);
                } else {
                    finalProduct = await Api.post('/api/admin/products', body);
                }
            } catch (e) {
                Toast.error(e.message);
                return;
            }

            const savedProductId = finalProduct.id;

            if (pendingBoxArtFile) {
                try {
                    finalProduct = await Api.upload(`/api/admin/products/${savedProductId}/box-art`, pendingBoxArtFile);
                } catch (e) {
                    Toast.error('이미지 업로드 실패: ' + e.message);
                }
                pendingBoxArtFile = null;
            }

            Toast.success('저장되었습니다.');
            closeProductModal();

            if (editingProductId) {
                const idx = allProducts.findIndex(p => p.id === savedProductId);
                if (idx !== -1) allProducts[idx] = finalProduct;
                gridApi.applyTransaction({ update: [finalProduct] });
                const node = gridApi.getRowNode(String(savedProductId));
                if (node) gridApi.refreshCells({ rowNodes: [node], force: true });
                flashRow(savedProductId);
            } else {
                allProducts.push(finalProduct);
                gridApi.applyTransaction({ add: [finalProduct] });
                flashRow(savedProductId);
            }
        } finally {
            setSaving(false);
        }
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

    // ---- Box art (remove existing) ----

    async function removeBoxArt() {
        if (pendingBoxArtFile) {
            pendingBoxArtFile = null;
            const original = editingProductId ? allProducts.find(p => p.id === editingProductId) : null;
            renderBoxArtPreview(original || {});
            return;
        }
        if (!editingProductId) return;
        try {
            const updated = await Api.delete(`/api/admin/products/${editingProductId}/box-art`);
            renderBoxArtPreview({});
            const idx = allProducts.findIndex(p => p.id === editingProductId);
            if (idx !== -1) allProducts[idx] = updated;
            gridApi.applyTransaction({ update: [updated] });
            Toast.success('삭제되었습니다.');
        } catch (e) {
            Toast.error(e.message);
        }
    }

    // ---- Category modal ----

    async function openCategoryModal() {
        await renderCategoryList();
        document.getElementById('modal-category').classList.add('active');
    }

    function closeCategoryModal() {
        document.getElementById('modal-category').classList.remove('active');
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
            renderCategoryPicker();
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
            renderCategoryPicker();
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
            renderCategoryPicker();
        } catch (e) {
            Toast.error(e.message);
        }
    };

    function renderCategoryPicker() {
        const picker = document.getElementById('category-picker');
        picker.innerHTML = allCategories.map(c =>
            `<span class="chip" style="background:${hexToRgba(c.color,0.15)};border-color:${c.color};color:${c.color};cursor:pointer;margin:2px"
                  data-id="${c.id}" data-name="${escHtml(c.name)}" data-color="${c.color}"
                  onclick="toggleCategorySelect(this)">${escHtml(c.name)}</span>`
        ).join('');
    }

    window.toggleCategorySelect = function (el) {
        const id = el.dataset.id;
        const container = document.getElementById('selected-categories');
        const existing = container.querySelector(`[data-id="${id}"]`);
        container.innerHTML = '';
        if (existing) return;
        addCategoryChip(container, { id: parseInt(id), name: el.dataset.name, color: el.dataset.color });
    };

    // ---- Password change modal ----

    function openPasswordModal() {
        document.getElementById('form-password').reset();
        document.getElementById('modal-password').classList.add('active');
        document.getElementById('field-current-password').focus();
    }

    function closePasswordModal() {
        document.getElementById('modal-password').classList.remove('active');
    }

    async function changePassword() {
        const currentPassword = document.getElementById('field-current-password').value;
        const newPassword = document.getElementById('field-new-password').value;
        const confirmPassword = document.getElementById('field-confirm-password').value;

        if (!currentPassword) { Toast.error('현재 비밀번호를 입력하세요.'); return; }
        if (!newPassword) { Toast.error('새 비밀번호를 입력하세요.'); return; }
        if (newPassword !== confirmPassword) { Toast.error('새 비밀번호가 일치하지 않습니다.'); return; }

        const btnSave = document.getElementById('btn-password-save');
        const btnCancel = document.getElementById('btn-password-cancel');
        const btnClose = document.getElementById('modal-password-close');
        btnSave.disabled = btnCancel.disabled = btnClose.disabled = true;
        btnSave.querySelector('i').className = 'fa-solid fa-spinner fa-spin';

        try {
            await Api.put('/api/admin/password', { currentPassword, newPassword });
            Toast.success('비밀번호가 변경되었습니다. 다시 로그인해주세요.');
            closePasswordModal();
            setTimeout(() => document.getElementById('form-logout').submit(), 1500);
        } catch (e) {
            Toast.error(e.message);
            btnSave.disabled = btnCancel.disabled = btnClose.disabled = false;
            btnSave.querySelector('i').className = 'fa-solid fa-floppy-disk';
        }
    }

    // ---- Lightbox ----

    window.openLightbox = function (url) {
        if (!url) return;
        document.getElementById('lightbox-img').src = url;
        document.getElementById('lightbox-overlay').classList.add('active');
    };

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

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    function escHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ---- Event bindings ----

    function bindEvents() {
        document.getElementById('btn-add-product').addEventListener('click', openAddModal);
        document.getElementById('btn-manage-categories').addEventListener('click', openCategoryModal);

        const applyFilter = () => {
            gridApi.onFilterChanged();
            setTimeout(() => gridApi.refreshCells({ force: true }), 0);
        };
        document.getElementById('btn-search').addEventListener('click', applyFilter);
        document.getElementById('btn-clear').addEventListener('click', () => {
            document.getElementById('search-category').value = '';
            document.getElementById('search-grade').value = '';
            document.getElementById('search-boxart').value = '';
            document.getElementById('search-model').value = '';
            document.getElementById('search-name').value = '';
            document.getElementById('search-series').value = '';
            gridApi.onFilterChanged();
            setTimeout(() => gridApi.refreshCells({ force: true }), 0);
        });
        ['search-name', 'search-model', 'search-series'].forEach(id => {
            document.getElementById(id).addEventListener('keypress', e => { if (e.key === 'Enter') applyFilter(); });
        });
        ['search-grade', 'search-category', 'search-boxart'].forEach(id => {
            document.getElementById(id).addEventListener('change', applyFilter);
        });

        // Product modal
        document.getElementById('btn-product-save').addEventListener('click', saveProduct);
        document.getElementById('btn-product-cancel').addEventListener('click', closeProductModal);
        document.getElementById('modal-product-close').addEventListener('click', closeProductModal);

        document.getElementById('btn-boxart-remove').addEventListener('click', removeBoxArt);

        document.addEventListener('paste', e => {
            if (!document.getElementById('modal-product').classList.contains('active')) return;
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (!file) continue;
                    pendingBoxArtFile = file;
                    const objectUrl = URL.createObjectURL(file);
                    document.getElementById('boxart-thumb-preview').src = objectUrl;
                    document.getElementById('boxart-original-link').href = objectUrl;
                    document.getElementById('boxart-original-link').style.display = '';
                    document.getElementById('boxart-preview-wrap').style.display = '';
                    document.getElementById('btn-boxart-remove').style.display = '';
                    document.getElementById('boxart-paste-area').style.display = 'none';
                    break;
                }
            }
        });

        // Category modal
        document.getElementById('btn-category-add').addEventListener('click', addCategory);
        document.getElementById('btn-category-close').addEventListener('click', closeCategoryModal);
        document.getElementById('modal-category-close').addEventListener('click', closeCategoryModal);
        document.getElementById('new-category-name').addEventListener('keypress', e => {
            if (e.key === 'Enter') addCategory();
        });

        // Password change modal
        document.getElementById('btn-change-password').addEventListener('click', openPasswordModal);
        document.getElementById('btn-password-save').addEventListener('click', changePassword);
        document.getElementById('btn-password-cancel').addEventListener('click', closePasswordModal);
        document.getElementById('modal-password-close').addEventListener('click', closePasswordModal);
        document.getElementById('field-confirm-password').addEventListener('keypress', e => {
            if (e.key === 'Enter') changePassword();
        });

        // Lightbox
        document.getElementById('lightbox-overlay').addEventListener('click', () => {
            document.getElementById('lightbox-overlay').classList.remove('active');
        });

        // Release date: validate YYYY.MM format on blur
        document.getElementById('field-release').addEventListener('blur', () => {
            const el = document.getElementById('field-release');
            const v = el.value.trim();
            el.setCustomValidity(v && !/^\d{4}\.\d{1,2}$/.test(v) ? 'YYYY.MM 형식으로 입력하세요.' : '');
            el.reportValidity();
        });
    }

    // ---- Init ----

    document.addEventListener('DOMContentLoaded', async () => {
        initGrid();
        bindEvents();
        await Promise.all([loadCategories(), loadProducts()]);
        renderCategoryPicker();
    });

})();
