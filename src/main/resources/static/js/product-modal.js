/* 제품 추가/수정 팝업 — 제품 입력 폼이 필요한 모든 화면이 이 모듈 하나를 공용으로 쓴다
 * 사용하는 페이지는 ProductModal.init({ categories, onSaved, mode }) 을 먼저 호출해야 함
 *
 * mode
 *   'admin'   (기본) admin.html / product-release-info.html — 제품을 바로 저장
 *   'request' user.html — 제품에 반영하지 않고 /api/user/product-requests 로 승인 대기 요청을 만든다
 *             (수정 요청도 제품을 고치는 게 아니라 MODIFY 요청을 새로 만드는 것이므로 항상 POST)
 *   'review'  admin-product-requests.html — 올라온 요청을 같은 폼으로 확인하고 승인/반려한다
 *             수정 요청이면 달라지는 항목 아래에 '기존' 값을 덧붙여 보여준다
 *
 * 어느 모드든 폼 구성은 동일하고, 바뀌는 것은 안내 문구 / 푸터 버튼 / 저장 대상뿐이다
 * 'review' 모드는 요청 표시 헬퍼가 필요하므로 product-request-fields.js 를 함께 로드해야 한다
 * onSaved(product, isNew) 은 저장 성공 후 호출되며, 그리드 갱신 등 페이지별 후처리를 담당
 *
 * 박스아트
 *   'admin'   여러 장 등록 가능 — 추가/삭제/순서 변경(드래그)은 화면에서만 바꿔 두고 저장 시점에 서버에 반영한다
 *             (첫 번째 이미지가 그리드 썸네일 등에 쓰이는 대표 이미지)
 *   'request' 제품의 기존 이미지는 보기만 가능하고, 새 이미지 한 장을 첨부해 제안할 수 있다
 *   'review'  요청에 첨부된 이미지를 보기만 한다
 */
const ProductModal = (function () {
    let allCategories = [];
    let editingProductId = null;
    let editingProduct = null;
    // 화면에 보이는 박스아트 목록 (순서 = 표시 순서)
    // { id, url, thumbUrl } 은 서버에 저장된 이미지, id 없이 file / sourceUrl 이 있으면 저장 시 업로드할 이미지
    // readonly 는 요청 모드에서 보여주기만 하는 제품의 기존 이미지
    let boxArtItems = [];
    // 화면에서 지운 저장된 이미지 id — 저장 시 서버에서 삭제한다
    let removedBoxArtIds = [];
    // 드래그 중인 타일의 위치
    let dragBoxArtIndex = null;
    let onSaved = null;
    let mode = 'admin';
    // 검토 모드 상태 — 지금 보고 있는 요청과 페이지가 넘겨준 승인/반려 처리기
    let reviewRequest = null;
    let reviewHandlers = null;

    function init(options) {
        allCategories = options.categories || [];
        onSaved = options.onSaved || null;
        mode = options.mode || 'admin';
        applyMode();
        bindEvents();
    }

    function isRequestMode() {
        return mode === 'request';
    }

    function isReviewMode() {
        return mode === 'review';
    }

    function isAdminMode() {
        return mode === 'admin';
    }

    // 모드별로 안내 문구와 푸터 버튼만 갈아끼운다 (폼 구성은 어드민과 동일)
    function applyMode() {
        const notice = document.getElementById('product-modal-notice');
        if (notice) notice.style.display = isRequestMode() ? '' : 'none';
        const btnSave = document.getElementById('btn-product-save');
        btnSave.innerHTML = isRequestMode()
            ? '<i class="fa-solid fa-paper-plane"></i> 요청하기'
            : '<i class="fa-solid fa-floppy-disk"></i> 저장';
        btnSave.style.display = isReviewMode() ? 'none' : '';
        document.getElementById('btn-product-cancel').textContent = isReviewMode() ? '닫기' : '취소';
    }

    function refreshCategories(categories) {
        allCategories = categories;
        renderCategoryPicker();
    }

    // ---- Open / Close ----

    function openAdd(prefill) {
        editingProductId = null;
        editingProduct = null;
        document.getElementById('modal-product-title').textContent = isRequestMode() ? '제품 등록 요청' : '제품 추가';
        resetProductForm();
        if (prefill) fillProductForm(prefill);
        if (prefill && prefill.imageUrl) {
            boxArtItems = [{ url: prefill.imageUrl, thumbUrl: prefill.imageUrl, sourceUrl: prefill.imageUrl }];
            renderBoxArtList();
        }
        document.getElementById('modal-product').classList.add('active');
        PopupNav.open(close);
    }

    function openEdit(product) {
        editingProductId = product.id;
        editingProduct = product;
        document.getElementById('modal-product-title').textContent = isRequestMode() ? '제품 수정 요청' : '제품 수정';
        resetProductForm();
        fillProductForm(product);
        boxArtItems = boxArtItemsOf(product, isRequestMode());
        renderBoxArtList();
        document.getElementById('modal-product').classList.add('active');
        PopupNav.open(close);
    }

    function close() {
        document.getElementById('modal-product').classList.remove('active');
        PopupNav.close();
    }

    function isOpen() {
        return document.getElementById('modal-product').classList.contains('active');
    }

    // ---- 요청 검토 (review 모드) ----

    // 올라온 요청을 어드민 제품 폼 그대로 열어 확인/보정한다
    // handlers.onApprove(body) 는 승인 처리(서버 호출)를 맡고, 성공하면 팝업이 닫힌다
    // handlers.onReject() 는 반려 사유 입력 팝업을 띄우는 등 페이지 쪽 처리로 넘긴다
    function openReview(request, handlers) {
        reviewRequest = request;
        reviewHandlers = handlers || {};
        editingProductId = null;
        editingProduct = null;

        const pending = request.status === 'PENDING';
        const typeLabel = request.type === 'MODIFY' ? '수정' : '등록';
        document.getElementById('modal-product-title').textContent = `제품 ${typeLabel} 요청`;

        resetProductForm();
        fillProductForm(request.requested);
        boxArtItems = boxArtItemsOf(request.requested, true);
        renderBoxArtList();
        renderReviewMeta(request);

        // 승인된 수정 요청은 제품이 이미 요청 내용으로 바뀐 뒤라 '기존' 값이 비교 대상이 되지 않는다
        // (반려/취소는 제품이 그대로이므로 비교를 계속 보여준다)
        const current = (request.type === 'MODIFY' && request.status !== 'APPROVED') ? request.current : null;
        renderCurrentHints(current);
        renderCurrentBoxArt(current);

        const hasRequestedBoxArt = !!request.requested.boxArtThumbUrl;
        document.getElementById('product-modal-boxart-apply').style.display =
            (pending && hasRequestedBoxArt) ? '' : 'none';
        document.getElementById('field-apply-boxart').checked = hasRequestedBoxArt;
        // 검토 모드에서는 이미지를 새로 올릴 수 없으므로, 보여줄 이미지가 없으면 항목 자체를 감춘다
        const boxArtGroup = document.getElementById('boxart-list').closest('.form-group');
        boxArtGroup.style.display = (hasRequestedBoxArt || (current && current.boxArtThumbUrl)) ? '' : 'none';

        setFormDisabled(!pending);
        document.getElementById('btn-product-approve').style.display = pending ? '' : 'none';
        document.getElementById('btn-product-reject').style.display = pending ? '' : 'none';
        document.getElementById('modal-product').classList.add('active');
        PopupNav.open(close);
    }

    function renderReviewMeta(request) {
        // 격자(라벨 | 값 | 라벨 | 값)에 채워지므로 왼쪽 열 -> 오른쪽 열 순서로 나열한다
        const rows = [
            ['요청자', escHtml(request.requesterName || '(알 수 없음)')],
            ['상태', productRequestStatusHtml(request.status)],
            ['요청일시', formatRequestDateTime(request.createdAt)],
        ];
        if (request.processedAt) {
            const by = request.processedBy ? `${escHtml(request.processedBy)} · ` : '';
            rows.push(['처리', `${by}${formatRequestDateTime(request.processedAt)}`]);
        }
        const metaEl = document.getElementById('product-modal-meta');
        metaEl.innerHTML = rows
            .map(([label, value]) =>
                `<span class="req-meta-label">${label}</span><span class="req-meta-value">${value}</span>`)
            .join('');
        metaEl.style.display = '';

        const rejectEl = document.getElementById('product-modal-reject');
        if (request.status === 'REJECTED') {
            rejectEl.innerHTML = `<b>반려 사유</b><br>${escHtml(request.rejectReason || '-')}`;
            rejectEl.style.display = '';
        } else {
            rejectEl.style.display = 'none';
        }
    }

    // 입력칸과 기존 값을 이어 주는 표 — 항목별로 '기존' 값을 어느 form-group 아래에 붙일지 결정한다
    const REVIEW_HINT_FIELDS = [
        { key: 'grade', anchor: 'field-grade' },
        { key: 'modelNumber', anchor: 'field-model' },
        { key: 'name', anchor: 'field-name' },
        { key: 'release', anchor: 'field-release' },
        { key: 'price', anchor: 'field-price' },
        { key: 'series', anchor: 'field-series' },
        { key: 'sourceUrl', anchor: 'field-source' },
        { key: 'manualUrls', anchor: 'manual-url-list' },
        { key: 'category', anchor: 'selected-categories' },
    ];

    // 수정 요청에서 값이 달라지는 항목만 입력칸 아래에 '기존: ...' 을 덧붙이고 라벨을 강조한다
    function renderCurrentHints(current) {
        document.querySelectorAll('#form-product .req-from-hint').forEach(el => el.remove());
        document.querySelectorAll('#form-product .form-group.req-changed').forEach(el => el.classList.remove('req-changed'));
        if (!current) return;

        REVIEW_HINT_FIELDS.forEach(f => {
            const before = ProductRequestFields.textOf(current, f.key);
            const after = ProductRequestFields.textOf(reviewRequest.requested, f.key);
            if (before === after) return;
            const group = document.getElementById(f.anchor)?.closest('.form-group');
            if (!group) return;
            group.classList.add('req-changed');
            const hint = document.createElement('div');
            hint.className = 'req-from-hint';
            hint.innerHTML = `기존: <b>${before ? escHtml(before).replace(/\n/g, '<br>') : '없음'}</b>`;
            group.appendChild(hint);
        });
    }

    function renderCurrentBoxArt(current) {
        const el = document.getElementById('product-modal-boxart-current');
        if (!current || !current.boxArtThumbUrl) {
            el.style.display = 'none';
            el.innerHTML = '';
            return;
        }
        el.innerHTML = `<div class="req-boxart-item">
            <span class="req-boxart-label">기존 박스아트</span>
            <img src="${escHtml(current.boxArtThumbUrl)}" alt="기존 박스아트">
        </div>`;
        el.style.display = '';
    }

    // 이미 처리된 요청은 내용 확인만 가능하도록 폼을 잠근다
    function setFormDisabled(disabled) {
        const form = document.getElementById('form-product');
        form.classList.toggle('form-readonly', disabled);
        form.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = disabled; });
        document.getElementById('category-picker').style.display = disabled ? 'none' : '';
        if (disabled) document.getElementById('boxart-paste-area').style.display = 'none';
    }

    async function approveReview() {
        const body = collectBody();
        if (!body) return;
        const ok = await Confirm.show('요청을 승인하고 제품에 반영하시겠습니까?');
        if (!ok) return;

        body.applyBoxArt = document.getElementById('field-apply-boxart').checked;
        setReviewBusy(true);
        try {
            await reviewHandlers.onApprove(body);
            close();
        } catch (e) {
            // 실패 사유는 페이지 쪽에서 Toast 로 알리고, 다시 시도할 수 있게 팝업은 열어 둔다
        } finally {
            setReviewBusy(false);
        }
    }

    function setReviewBusy(busy) {
        const btnApprove = document.getElementById('btn-product-approve');
        btnApprove.disabled = busy;
        document.getElementById('btn-product-reject').disabled = busy;
        document.getElementById('btn-product-cancel').disabled = busy;
        document.getElementById('modal-product-close').disabled = busy;
        btnApprove.querySelector('i').className = busy ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-check';
    }

    // ---- Manual URLs (한 제품에 매뉴얼이 여러 개인 경우가 있어 입력칸을 동적으로 늘리고 줄인다) ----

    // 값이 없어도 빈 칸 하나는 남겨 둔다 — 입력할 곳이 사라지지 않게
    function renderManualUrls(urls) {
        const list = document.getElementById('manual-url-list');
        list.innerHTML = '';
        const values = urls && urls.length ? urls : [''];
        values.forEach(url => list.appendChild(manualUrlRow(url)));
    }

    function manualUrlRow(url) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px';

        const input = document.createElement('input');
        input.type = 'url';
        input.className = 'form-control manual-url-input';
        input.placeholder = 'https://...';
        input.value = url || '';
        row.appendChild(input);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-secondary btn-sm';
        removeBtn.title = '삭제';
        removeBtn.innerHTML = '<i class="fa-solid fa-minus"></i>';
        removeBtn.addEventListener('click', () => {
            const list = document.getElementById('manual-url-list');
            if (list.children.length > 1) {
                row.remove();
            } else {
                input.value = '';
            }
        });
        row.appendChild(removeBtn);
        return row;
    }

    function manualUrlValues() {
        return [...document.querySelectorAll('#manual-url-list .manual-url-input')]
            .map(input => input.value.trim())
            .filter(Boolean);
    }

    function resetProductForm() {
        document.getElementById('form-product').reset();
        // 검토 모드에서 감췄을 수 있으므로 박스아트 항목을 되돌린다
        document.getElementById('boxart-list').closest('.form-group').style.display = '';
        document.getElementById('field-currency').value = 'JPY';
        renderManualUrls([]);
        document.getElementById('selected-categories').innerHTML = '';
        boxArtItems = [];
        removedBoxArtIds = [];
        renderBoxArtList();
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
        renderManualUrls(p.manualUrls || []);
        document.getElementById('field-source').value = p.sourceUrl || '';
        document.getElementById('field-series').value = p.series || '';

        const container = document.getElementById('selected-categories');
        if (p.category) addCategoryChip(container, p.category);
    }

    // 제품(또는 요청 필드)의 박스아트를 목록 항목으로 바꾼다 — boxArts 가 없는 응답(요청 필드)은 대표 이미지 한 장만 쓴다
    function boxArtItemsOf(p, readonly) {
        const list = p.boxArts && p.boxArts.length
            ? p.boxArts.map(b => ({ id: b.id, url: b.url, thumbUrl: b.thumbUrl || b.url }))
            : (p.boxArtThumbUrl ? [{ url: p.boxArtUrl, thumbUrl: p.boxArtThumbUrl }] : []);
        return list.map(item => ({ ...item, readonly }));
    }

    function pendingBoxArtFile() {
        const item = boxArtItems.find(i => i.file);
        return item ? item.file : null;
    }

    function renderBoxArtList() {
        const list = document.getElementById('boxart-list');
        const pasteArea = document.getElementById('boxart-paste-area');
        const sortable = isAdminMode() && boxArtItems.length > 1;

        list.innerHTML = '';
        boxArtItems.forEach((item, index) => list.appendChild(boxArtTile(item, index, sortable)));
        list.style.display = boxArtItems.length ? '' : 'none';
        list.classList.toggle('sortable', sortable);

        // 어드민은 계속 추가할 수 있고, 요청 모드는 한 장만 첨부할 수 있으며, 검토 모드는 새로 붙여넣을 일이 없다
        const canAttach = isAdminMode() || (isRequestMode() && !pendingBoxArtFile());
        pasteArea.style.display = canAttach ? '' : 'none';
        document.getElementById('boxart-paste-text').textContent = isAdminMode()
            ? '이미지를 붙여넣기(Ctrl+V) 하거나 클릭해서 파일을 선택하세요 (여러 장 가능)'
            : '이미지를 붙여넣기(Ctrl+V) 하거나 클릭해서 파일을 선택하세요';
        document.getElementById('boxart-file-input').multiple = isAdminMode();
    }

    function boxArtTile(item, index, sortable) {
        const tile = document.createElement('div');
        tile.className = 'boxart-tile';

        const link = document.createElement('a');
        link.href = item.url || item.thumbUrl;
        link.target = '_blank';
        link.draggable = false;
        const img = document.createElement('img');
        img.className = 'boxart-thumb';
        img.src = item.thumbUrl;
        img.alt = `박스아트 ${index + 1}`;
        img.draggable = false;
        link.appendChild(img);
        tile.appendChild(link);

        if (sortable && index === 0) {
            const badge = document.createElement('span');
            badge.className = 'boxart-tile-badge';
            badge.textContent = '대표';
            tile.appendChild(badge);
        }

        // 요청 모드에서 보이는 제품의 기존 이미지는 지울 수 없다 — 새로 첨부해 제안만 할 수 있으므로
        if (!isReviewMode() && !item.readonly) {
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'boxart-tile-remove';
            removeBtn.title = '이미지 삭제';
            removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            removeBtn.addEventListener('click', () => removeBoxArt(index));
            tile.appendChild(removeBtn);
        }

        if (sortable) bindBoxArtDrag(tile, index);
        return tile;
    }

    // ---- Box art 순서 변경 (드래그 앤 드롭) ----

    function bindBoxArtDrag(tile, index) {
        tile.draggable = true;
        tile.addEventListener('dragstart', e => {
            dragBoxArtIndex = index;
            tile.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Firefox 는 데이터가 없으면 드래그를 시작하지 않는다
            e.dataTransfer.setData('text/plain', String(index));
        });
        tile.addEventListener('dragend', () => {
            dragBoxArtIndex = null;
            tile.classList.remove('dragging');
            clearBoxArtDropMarks();
        });
        tile.addEventListener('dragover', e => {
            if (dragBoxArtIndex === null) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const after = isDropAfter(tile, e);
            clearBoxArtDropMarks();
            if (index !== dragBoxArtIndex) tile.classList.add(after ? 'drop-after' : 'drop-before');
        });
        tile.addEventListener('drop', e => {
            if (dragBoxArtIndex === null) return;
            e.preventDefault();
            // 타일의 왼쪽 절반에 놓으면 앞에, 오른쪽 절반에 놓으면 뒤에 끼워 넣는다
            let to = isDropAfter(tile, e) ? index + 1 : index;
            const from = dragBoxArtIndex;
            if (from < to) to--;
            dragBoxArtIndex = null;
            if (from === to) {
                clearBoxArtDropMarks();
                return;
            }
            const [moved] = boxArtItems.splice(from, 1);
            boxArtItems.splice(to, 0, moved);
            renderBoxArtList();
        });
    }

    function isDropAfter(tile, e) {
        const rect = tile.getBoundingClientRect();
        return e.clientX > rect.left + rect.width / 2;
    }

    function clearBoxArtDropMarks() {
        document.querySelectorAll('#boxart-list .boxart-tile').forEach(el => el.classList.remove('drop-before', 'drop-after'));
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
            : (isRequestMode() ? 'fa-solid fa-paper-plane' : 'fa-solid fa-floppy-disk');
    }

    // 폼 입력값을 서버 요청 본문으로 모은다 — 형식이 맞지 않으면 Toast 를 띄우고 null 을 돌려준다
    // (저장/요청/승인이 모두 같은 폼을 쓰므로 수집도 한 곳에서 한다)
    function collectBody() {
        const name = document.getElementById('field-name').value.trim();
        if (!name) { Toast.error('제품명은 필수입니다.'); return null; }

        const releaseRaw = document.getElementById('field-release').value.trim();
        let releaseYear = null, releaseMonth = null;
        if (releaseRaw) {
            const m = releaseRaw.match(/^\d{4}\.\d{1,2}$/);
            if (!m) { Toast.error('발매년월은 YYYY.MM 형식으로 입력하세요.'); return null; }
            const parts = releaseRaw.split('.');
            releaseYear = parseInt(parts[0]);
            releaseMonth = parseInt(parts[1]);
        }

        const priceRaw = document.getElementById('field-price').value.trim();

        return {
            grade: document.getElementById('field-grade').value,
            modelNumber: document.getElementById('field-model').value.trim() || null,
            name,
            releaseYear,
            releaseMonth,
            // 가격을 비웠으면 통화도 함께 비운다
            currency: priceRaw ? document.getElementById('field-currency').value : null,
            price: priceRaw ? parseInt(priceRaw) : null,
            manualUrls: manualUrlValues(),
            sourceUrl: document.getElementById('field-source').value.trim() || null,
            series: document.getElementById('field-series').value.trim() || null,
            categoryId: getSelectedCategoryId(),
        };
    }

    async function saveProduct() {
        const body = collectBody();
        if (!body) return;

        if (isRequestMode()) {
            await saveRequest(body);
            return;
        }

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

            finalProduct = await saveBoxArts(finalProduct);

            Toast.success('저장되었습니다.');
            close();
            if (onSaved) onSaved(finalProduct, isNew);
        } finally {
            setSaving(false);
        }
    }

    // 화면에서 바꾼 박스아트(삭제 → 추가 → 순서)를 서버에 반영하고 마지막 제품 응답을 돌려준다
    // 하나가 실패해도 나머지는 계속 진행한다 (제품 정보는 이미 저장된 상태이므로)
    async function saveBoxArts(product) {
        const base = `/api/admin/products/${product.id}`;
        let latest = product;

        for (const id of removedBoxArtIds) {
            try {
                latest = await Api.delete(`${base}/box-art/${id}`);
            } catch (e) {
                Toast.error('이미지 삭제 실패: ' + e.message);
            }
        }
        removedBoxArtIds = [];

        // 새 이미지는 서버에서 맨 뒤에 붙으므로, 응답에 새로 생긴 id 를 해당 항목의 id 로 삼는다
        for (const item of boxArtItems) {
            if (item.id) continue;
            const knownIds = new Set((latest.boxArts || []).map(b => b.id));
            try {
                latest = item.file
                    ? await Api.upload(`${base}/box-art`, item.file)
                    : await Api.put(`${base}/box-art-url`, { url: item.sourceUrl });
                const added = (latest.boxArts || []).find(b => !knownIds.has(b.id));
                if (added) item.id = added.id;
            } catch (e) {
                Toast.error((item.file ? '이미지 업로드 실패: ' : '이미지 등록 실패: ') + e.message);
            }
        }

        const wantedIds = boxArtItems.map(i => i.id).filter(Boolean);
        const savedIds = (latest.boxArts || []).map(b => b.id);
        if (wantedIds.join(',') !== savedIds.join(',')) {
            try {
                latest = await Api.put(`${base}/box-art/order`, { ids: wantedIds });
            } catch (e) {
                Toast.error('이미지 순서 저장 실패: ' + e.message);
            }
        }
        return latest;
    }

    // ---- Save (요청 모드) ----

    // 요청 모드에서는 제품을 직접 만들거나 고치지 않고, 승인 대기 요청을 새로 만든다
    // (수정 요청도 대상 제품 id 를 실어 보낼 뿐 항상 새 요청이므로 POST)
    async function saveRequest(body) {
        const isModify = !!editingProductId;
        const boxArtFile = pendingBoxArtFile();
        if (isModify && !boxArtFile && comparable(body) === comparable(toBody(editingProduct))) {
            Toast.error('변경된 내용이 없습니다.');
            return;
        }

        setSaving(true);
        try {
            const created = await Api.post('/api/user/product-requests', {
                ...body,
                type: isModify ? 'MODIFY' : 'REGISTER',
                productId: isModify ? editingProductId : null,
            });
            if (boxArtFile) {
                try {
                    await Api.upload(`/api/user/product-requests/${created.id}/box-art`, boxArtFile);
                } catch (e) {
                    Toast.error('이미지 첨부 실패: ' + e.message);
                }
            }
            Toast.success('요청이 접수되었습니다. 관리자 확인 후 반영됩니다.');
            close();
            if (onSaved) onSaved(created, !isModify);
        } catch (e) {
            Toast.error(e.message);
        } finally {
            setSaving(false);
        }
    }

    function toBody(product) {
        return {
            grade: product.grade,
            modelNumber: product.modelNumber,
            name: product.name,
            releaseYear: product.releaseYear,
            releaseMonth: product.releaseMonth,
            currency: product.currency,
            price: product.price,
            manualUrls: product.manualUrls || [],
            sourceUrl: product.sourceUrl,
            series: product.series,
            categoryId: product.category ? product.category.id : null,
        };
    }

    // 빈 문자열/undefined 를 null 로 맞춰 비교한다 — 손대지 않은 값이 '바뀐 것'으로 보이지 않도록
    function comparable(body) {
        return JSON.stringify({
            grade: body.grade || null,
            modelNumber: body.modelNumber || null,
            name: body.name || null,
            releaseYear: body.releaseYear ?? null,
            releaseMonth: body.releaseMonth ?? null,
            currency: body.currency || null,
            price: body.price ?? null,
            manualUrls: body.manualUrls || [],
            sourceUrl: body.sourceUrl || null,
            series: body.series || null,
            categoryId: body.categoryId ?? null,
        });
    }

    // ---- Box art (추가 / 삭제) ----

    // 화면에서만 지운다 — 저장된 이미지는 저장 시점에 서버에서 삭제한다
    function removeBoxArt(index) {
        const [removed] = boxArtItems.splice(index, 1);
        if (!removed) return;
        if (removed.id) removedBoxArtIds.push(removed.id);
        if (removed.file) URL.revokeObjectURL(removed.thumbUrl);
        // 요청 모드에서 첨부를 취소하면 제품의 기존 이미지를 다시 보여준다
        if (isRequestMode() && !boxArtItems.length && editingProduct) {
            boxArtItems = boxArtItemsOf(editingProduct, true);
        }
        renderBoxArtList();
    }

    // 붙여넣기/파일선택으로 고른 이미지를 목록에 올린다 (업로드는 저장 시점에 수행)
    // 어드민은 맨 뒤에 계속 추가하고, 요청 모드는 한 장만 첨부하므로 기존 이미지 미리보기를 첨부 이미지로 바꿔 보여준다
    function attachBoxArtFiles(files) {
        if (isReviewMode()) return false;
        const images = [...files].filter(f => f && f.type.startsWith('image/'));
        if (!images.length) return false;
        const toItem = file => {
            const objectUrl = URL.createObjectURL(file);
            return { file, url: objectUrl, thumbUrl: objectUrl };
        };
        if (isAdminMode()) {
            boxArtItems.push(...images.map(toItem));
        } else {
            boxArtItems = [toItem(images[0])];
        }
        renderBoxArtList();
        return true;
    }

    // ---- Event bindings ----

    function bindEvents() {
        document.getElementById('btn-product-save').addEventListener('click', saveProduct);
        document.getElementById('btn-product-approve').addEventListener('click', approveReview);
        document.getElementById('btn-product-reject').addEventListener('click', () => {
            if (reviewHandlers && reviewHandlers.onReject) reviewHandlers.onReject(reviewRequest);
        });
        document.getElementById('btn-product-cancel').addEventListener('click', close);
        document.getElementById('modal-product-close').addEventListener('click', close);
        document.getElementById('btn-manual-add').addEventListener('click', () => {
            document.getElementById('manual-url-list').appendChild(manualUrlRow(''));
        });

        // 붙여넣기가 어려운 환경(모바일 등)을 위한 파일 선택 — 붙여넣기와 동일하게 처리한다
        const fileInput = document.getElementById('boxart-file-input');
        if (fileInput) {
            document.getElementById('boxart-paste-area').addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', () => {
                attachBoxArtFiles(fileInput.files);
                fileInput.value = '';
            });
        }

        document.addEventListener('paste', e => {
            if (!isOpen()) return;
            const items = e.clipboardData?.items;
            if (!items) return;
            // 같은 이미지가 여러 형식(png/jpeg 등)으로 함께 들어오는 경우가 있어 붙여넣기는 첫 이미지 한 장만 쓴다
            const image = [...items].find(item => item.type.startsWith('image/'));
            if (image) attachBoxArtFiles([image.getAsFile()]);
        });

        // 발매년월: blur 시 YYYY.MM 형식 검증
        document.getElementById('field-release').addEventListener('blur', () => {
            const el = document.getElementById('field-release');
            const v = el.value.trim();
            el.setCustomValidity(v && !/^\d{4}\.\d{1,2}$/.test(v) ? 'YYYY.MM 형식으로 입력하세요.' : '');
            el.reportValidity();
        });
    }

    return { init, refreshCategories, openAdd, openEdit, openReview, close, isOpen };
})();
