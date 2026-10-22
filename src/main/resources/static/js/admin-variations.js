/* 관리자 바리에이션 구성도 편집 — 보드를 골라 제품 카드를 올리고 원본 → 바리에이션 선을 잇는다 (그리기는 variation-tree.js)
 * 저장은 보드 전체(카드 좌표 + 연결선)를 한 번에 보내 서버에서 통째로 교체한다
 * 제품 하나는 보드 하나에만 올릴 수 있으므로, 다른 보드에 있는 제품은 목록에서 고를 수 없게 표시한다
 */
(function () {
    const PRODUCT_LIST_LIMIT = 100;

    let variations = [];
    let currentVariation = null;
    // productId → ProductResponseDto (전체 제품)
    let productMap = new Map();
    // productId → variationId (저장된 기준, 지금 편집 중인 보드의 미저장 변경은 boardProductIds 로 따로 본다)
    let assignments = new Map();
    let dirty = false;
    // 보드를 불러오는 동안 Drawflow 이벤트로 dirty 가 켜지지 않도록 막는다
    let loading = false;

    const boardEl = document.getElementById('variation-board');
    const editor = VariationTree.create(boardEl, { mode: 'edit' });
    VariationTree.addZoomControls(editor, boardEl);

    const nameInput = document.getElementById('field-variation-name');
    const searchInput = document.getElementById('field-product-search');

    // ---- 상태 ----

    function setDirty(value) {
        dirty = value;
        document.getElementById('dirty-indicator').hidden = !dirty;
    }

    function setEditorEnabled(enabled) {
        ['field-variation-name', 'btn-auto-layout', 'btn-variation-delete', 'btn-variation-save'].forEach(id => {
            document.getElementById(id).disabled = !enabled;
        });
        document.getElementById('board-empty').hidden = enabled;
    }

    // 지금 보드에 올라간 제품 (미저장 포함)
    function boardProductIds() {
        return new Set(Object.values(VariationTree.nodeData(editor)).map(n => n.data.productId));
    }

    // 다른 보드로 넘어가거나 페이지를 떠날 때 미저장 변경을 버릴지 묻는다
    async function confirmDiscard() {
        if (!dirty) return true;
        return Confirm.show('저장하지 않은 변경사항이 있습니다. 버리고 이동할까요?');
    }

    window.addEventListener('beforeunload', e => {
        if (dirty) e.preventDefault();
    });

    // ---- 보드 목록 ----

    async function loadVariations() {
        variations = await Api.get('/api/admin/variations');
        renderVariations();
    }

    function renderVariations() {
        const list = document.getElementById('variation-list');
        if (variations.length === 0) {
            list.innerHTML = '<li class="vr-list-empty">보드가 없습니다.</li>';
            return;
        }
        list.innerHTML = variations.map(f => `
            <li>
                <button type="button" class="vr-variation-item${currentVariation?.id === f.id ? ' active' : ''}" data-id="${escHtml(f.id)}">
                    <span class="vr-variation-name">${escHtml(f.name)}</span>
                    <span class="vr-variation-count">${f.productCount}</span>
                </button>
            </li>`).join('');
    }

    document.getElementById('variation-list').addEventListener('click', async e => {
        const btn = e.target.closest('.vr-variation-item');
        if (!btn) return;
        // 보드 ID 는 ULID 문자열
        const id = btn.dataset.id;
        if (currentVariation?.id === id) return;
        if (!(await confirmDiscard())) return;
        await openVariation(id);
    });

    document.getElementById('form-variation-create').addEventListener('submit', async e => {
        e.preventDefault();
        const input = document.getElementById('field-variation-new-name');
        const name = input.value.trim();
        if (!name) {
            input.focus();
            return;
        }
        if (!(await confirmDiscard())) return;
        try {
            const created = await Api.post('/api/admin/variations', { name });
            input.value = '';
            await loadVariations();
            await openVariation(created.id);
            Toast.success('보드를 만들었습니다.');
        } catch (err) {
            Toast.error(err.message);
        }
    });

    async function openVariation(id) {
        try {
            showVariation(await Api.get(`/api/admin/variations/${id}`));
        } catch (err) {
            Toast.error(err.message);
        }
    }

    function showVariation(variation) {
        currentVariation = variation;
        nameInput.value = variation.name;
        setEditorEnabled(true);
        loading = true;
        VariationTree.load(editor, variation);
        loading = false;
        VariationTree.fit(editor);
        setDirty(false);
        renderVariations();
        renderProducts();
    }

    function clearBoard() {
        currentVariation = null;
        nameInput.value = '';
        loading = true;
        editor.clear();
        loading = false;
        setDirty(false);
        setEditorEnabled(false);
        renderVariations();
        renderProducts();
    }

    // ---- 저장 / 삭제 ----

    document.getElementById('btn-variation-save').addEventListener('click', async () => {
        if (!currentVariation) return;
        const name = nameInput.value.trim();
        if (!name) {
            Toast.error('보드 이름을 입력해주세요.');
            nameInput.focus();
            return;
        }
        const btn = document.getElementById('btn-variation-save');
        btn.disabled = true;
        try {
            const saved = await Api.put(`/api/admin/variations/${currentVariation.id}`, { name, ...VariationTree.toSaveData(editor) });
            currentVariation = saved;
            setDirty(false);
            await Promise.all([loadVariations(), loadAssignments()]);
            renderProducts();
            Toast.success('저장했습니다.');
        } catch (err) {
            Toast.error(err.message);
        } finally {
            btn.disabled = false;
        }
    });

    document.getElementById('btn-variation-delete').addEventListener('click', async () => {
        if (!currentVariation) return;
        if (!(await Confirm.show(`'${currentVariation.name}' 보드를 삭제할까요? 카드와 연결선이 모두 사라집니다.`))) return;
        try {
            await Api.delete(`/api/admin/variations/${currentVariation.id}`);
            clearBoard();
            await Promise.all([loadVariations(), loadAssignments()]);
            renderProducts();
            Toast.success('보드를 삭제했습니다.');
        } catch (err) {
            Toast.error(err.message);
        }
    });

    nameInput.addEventListener('input', () => setDirty(true));

    // ---- 보드 편집 ----

    document.getElementById('btn-auto-layout').addEventListener('click', () => {
        VariationTree.autoLayout(editor, productMap);
        VariationTree.fit(editor);
        setDirty(true);
    });

    ['nodeCreated', 'nodeRemoved', 'nodeMoved', 'connectionRemoved'].forEach(event => {
        editor.on(event, () => {
            if (!loading) setDirty(true);
        });
    });

    // 카드가 빠지면 제품 목록에서 다시 고를 수 있게 한다
    editor.on('nodeRemoved', () => {
        if (!loading) renderProducts();
    });

    // 원본 → 바리에이션 관계가 순환하면 방금 그은 선을 되돌린다
    // 카드에 놓은 직후의 연결은 variation-tree.js 가 반대쪽 변으로 다시 잇고 그때 이벤트가 한 번 더 오므로, 정리된 연결만 본다
    editor.on('connectionCreated', conn => {
        if (loading || !VariationTree.isNormalized(conn)) return;
        if (VariationTree.hasCycle(VariationTree.toSaveData(editor).links)) {
            editor.removeSingleConnection(conn.output_id, conn.input_id, conn.output_class, conn.input_class);
            Toast.error('화살표가 순환합니다. 원본 카드의 변에서 바리에이션 카드로 이어주세요.');
            return;
        }
        setDirty(true);
    });

    // ---- 제품 목록 ----

    async function loadProducts() {
        const products = await Api.get('/api/admin/products');
        productMap = new Map(products.map(p => [p.id, p]));
    }

    async function loadAssignments() {
        const list = await Api.get('/api/admin/variations/assignments');
        assignments = new Map(list.map(a => [a.productId, a.variationId]));
    }

    function variationName(id) {
        return variations.find(f => f.id === id)?.name || '';
    }

    function renderProducts() {
        const list = document.getElementById('product-list');
        const query = searchInput.value;
        if (!query.trim()) {
            list.innerHTML = '<li class="vr-list-empty">형식번호나 제품명으로 검색하세요.</li>';
            return;
        }
        const onBoard = boardProductIds();
        const matched = [...productMap.values()]
            .filter(p => matchesAllTokens([p.modelNumber, p.name, p.grade, p.series].filter(Boolean).join(' '), query))
            .sort((a, b) => (a.releaseYear || 0) * 100 + (a.releaseMonth || 0) - ((b.releaseYear || 0) * 100 + (b.releaseMonth || 0)));
        if (matched.length === 0) {
            list.innerHTML = '<li class="vr-list-empty">검색 결과가 없습니다.</li>';
            return;
        }
        const shown = matched.slice(0, PRODUCT_LIST_LIMIT);
        list.innerHTML = shown.map(p => {
            const otherVariationId = assignments.get(p.id);
            // 이 보드에서 빼고 아직 저장 안 한 제품은 다시 올릴 수 있다
            const inOtherVariation = otherVariationId != null && otherVariationId !== currentVariation?.id;
            const disabled = !currentVariation || onBoard.has(p.id) || inOtherVariation;
            const status = onBoard.has(p.id) ? '보드에 있음'
                : inOtherVariation ? `다른 보드: ${variationName(otherVariationId)}` : '';
            const color = GRADE_COLORS[p.grade] || '#6c7a8d';
            return `
                <li>
                    <button type="button" class="vr-product-item" data-id="${p.id}" ${disabled ? 'disabled' : ''}>
                        <span class="vr-product-thumb">${p.boxArtThumbUrl ? `<img src="${escHtml(p.boxArtThumbUrl)}" alt="">` : 'NO IMAGE'}</span>
                        <span class="vr-product-info">
                            <span class="vr-product-meta">
                                <span class="chip" style="background:${hexToRgba(color, 0.15)};border-color:${color};color:${color}">${escHtml(p.grade)}</span>
                                ${escHtml(p.modelNumber || '')}
                                <span class="vr-product-release">${escHtml(formatReleaseDate(p.releaseYear, p.releaseMonth))}</span>
                            </span>
                            <span class="vr-product-name">${highlightText(p.name, query)}</span>
                            ${status ? `<span class="vr-product-status">${escHtml(status)}</span>` : ''}
                        </span>
                    </button>
                </li>`;
        }).join('') + (matched.length > shown.length
            ? `<li class="vr-list-empty">${matched.length - shown.length}건 더 있음 — 검색어를 더 입력하세요.</li>` : '');
    }

    searchInput.addEventListener('input', debounce(renderProducts, 150));

    // 제품을 누르면 지금 보이는 화면 가운데에 카드를 올린다 — 여러 개를 연달아 올려도 겹치지 않게 조금씩 비켜 놓는다
    let addOffset = 0;
    document.getElementById('product-list').addEventListener('click', e => {
        const btn = e.target.closest('.vr-product-item');
        if (!btn || btn.disabled || !currentVariation) return;
        const product = productMap.get(Number(btn.dataset.id));
        if (!product || boardProductIds().has(product.id)) return;
        const { x, y } = VariationTree.viewCenter(editor);
        addOffset = (addOffset + 1) % 6;
        VariationTree.addProduct(editor, product, x + addOffset * 24, y + addOffset * 24);
        renderProducts();
    });

    // ---- 사용 안내 팝업 ----

    const helpModal = document.getElementById('modal-variation-help');

    function closeHelp() {
        helpModal.classList.remove('active');
        PopupNav.close();
    }

    document.getElementById('btn-variation-help').addEventListener('click', () => {
        helpModal.classList.add('active');
        PopupNav.open(closeHelp);
    });
    document.getElementById('modal-variation-help-close').addEventListener('click', closeHelp);
    helpModal.addEventListener('click', e => {
        if (e.target === helpModal) closeHelp();
    });

    // ---- 초기화 ----

    (async function init() {
        setEditorEnabled(false);
        try {
            await Promise.all([loadVariations(), loadProducts(), loadAssignments()]);
            renderProducts();
        } catch (err) {
            Toast.error(err.message);
        }
    })();
})();
