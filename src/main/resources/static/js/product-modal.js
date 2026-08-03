/* 제품 추가/수정 팝업 — admin.html(제품 관리)과 product-release-info.html(제품 출시 정보)에서 공용으로 사용
 * 사용하는 페이지는 ProductModal.init({ categories, onSaved }) 을 먼저 호출해야 함
 * onSaved(product, isNew) 은 저장 성공 후 호출되며, 그리드 갱신 등 페이지별 후처리를 담당
 */
const ProductModal = (function () {
    let allCategories = [];
    let editingProductId = null;
    let editingProduct = null;
    let pendingBoxArtFile = null;
    let pendingBoxArtUrl = null;
    let onSaved = null;

    function init(options) {
        allCategories = options.categories || [];
        onSaved = options.onSaved || null;
        bindEvents();
    }

    function refreshCategories(categories) {
        allCategories = categories;
        renderCategoryPicker();
    }

    // ---- Open / Close ----

    function openAdd(prefill) {
        editingProductId = null;
        editingProduct = null;
        document.getElementById('modal-product-title').textContent = '제품 추가';
        resetProductForm();
        if (prefill) fillProductForm(prefill);
        if (prefill && prefill.imageUrl) {
            pendingBoxArtUrl = prefill.imageUrl;
            renderBoxArtPreview({ boxArtThumbUrl: prefill.imageUrl, boxArtUrl: prefill.imageUrl });
        }
        document.getElementById('modal-product').classList.add('active');
    }

    function openEdit(product) {
        editingProductId = product.id;
        editingProduct = product;
        document.getElementById('modal-product-title').textContent = '제품 수정';
        resetProductForm();
        fillProductForm(product);
        renderBoxArtPreview(product);
        document.getElementById('modal-product').classList.add('active');
    }

    function close() {
        document.getElementById('modal-product').classList.remove('active');
    }

    function resetProductForm() {
        document.getElementById('form-product').reset();
        document.getElementById('field-currency').value = 'JPY';
        document.getElementById('selected-categories').innerHTML = '';
        pendingBoxArtFile = null;
        pendingBoxArtUrl = null;
        renderBoxArtPreview({});
        renderCategoryPicker();
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

    // ---- Category picker ----

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

    function renderCategoryPicker() {
        const picker = document.getElementById('category-picker');
        if (!picker) return;
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

    // ---- Save ----

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
            const isNew = !editingProductId;
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
            } else if (pendingBoxArtUrl) {
                try {
                    finalProduct = await Api.put(`/api/admin/products/${savedProductId}/box-art-url`, { url: pendingBoxArtUrl });
                } catch (e) {
                    Toast.error('이미지 등록 실패: ' + e.message);
                }
                pendingBoxArtUrl = null;
            }

            Toast.success('저장되었습니다.');
            close();
            if (onSaved) onSaved(finalProduct, isNew);
        } finally {
            setSaving(false);
        }
    }

    // ---- Box art (remove existing) ----

    async function removeBoxArt() {
        if (pendingBoxArtFile || pendingBoxArtUrl) {
            pendingBoxArtFile = null;
            pendingBoxArtUrl = null;
            renderBoxArtPreview(editingProduct || {});
            return;
        }
        if (!editingProductId) return;
        try {
            const updated = await Api.delete(`/api/admin/products/${editingProductId}/box-art`);
            editingProduct = updated;
            renderBoxArtPreview({});
            if (onSaved) onSaved(updated, false);
            Toast.success('삭제되었습니다.');
        } catch (e) {
            Toast.error(e.message);
        }
    }

    // ---- Event bindings ----

    function bindEvents() {
        document.getElementById('btn-product-save').addEventListener('click', saveProduct);
        document.getElementById('btn-product-cancel').addEventListener('click', close);
        document.getElementById('modal-product-close').addEventListener('click', close);
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

        // 발매년월: blur 시 YYYY.MM 형식 검증
        document.getElementById('field-release').addEventListener('blur', () => {
            const el = document.getElementById('field-release');
            const v = el.value.trim();
            el.setCustomValidity(v && !/^\d{4}\.\d{1,2}$/.test(v) ? 'YYYY.MM 형식으로 입력하세요.' : '');
            el.reportValidity();
        });
    }

    return { init, refreshCategories, openAdd, openEdit, close };
})();
