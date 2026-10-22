/* 제품 바리에이션 구성도(가계도) 공용 렌더러 — Drawflow(/vendor/drawflow) 위에 제품 카드와 원본 → 바리에이션 화살표를 그린다
 * - 관리자 편집 화면(admin-variations.js): mode 'edit' — 카드 이동/연결/삭제
 * - 사용자 구성도 팝업(user.js): mode 'view' — 화면 이동/확대만
 * 카드 상하좌우 네 변에 연결점이 있다. 원본 카드의 한 변(출력)에서 바리에이션 카드 아무 곳에나 끌어 놓으면,
 * 바리에이션 카드의 반대쪽 변(입력)으로 들어가는 화살표가 된다 — 예) A 오른쪽 → B 왼쪽 = A 에서 B 로 바리에이션
 * Drawflow 포트 번호: output_1~4 / input_1~4 = 위·오른쪽·아래·왼쪽 (DIRECTIONS 순서)
 * 연결선 좌표를 카드 DOM 위치로 계산하므로, 컨테이너가 화면에 보이는 상태에서 load() 를 호출해야 한다
 * common.js(escHtml, formatReleaseDate) 다음에 로드한다
 */
const VariationTree = (function () {
    const NODE_CLASS = 'vt-node';
    // 화살표 방향 = 원본 카드에서 나가는 변 (서버 VariationLinkDirection 과 같은 값)
    const DIRECTIONS = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
    const SIDE_VECTORS = { UP: [0, -1], RIGHT: [1, 0], DOWN: [0, 1], LEFT: [-1, 0] };
    // 카드 변에서 꺾이기 전까지 곧게 뻗는 길이
    const STUB = 24;
    // 자동 정렬 간격 (카드 폭은 variation-tree.css 의 .vt-node 와 맞춘다)
    const NODE_WIDTH = 220;
    const H_GAP = 40;
    // 세로 간격은 화살표가 중간에서 꺾일 공간까지 포함
    const V_GAP = 70;
    const FIT_PADDING = 40;

    const outputClass = direction => `output_${DIRECTIONS.indexOf(direction) + 1}`;
    const inputClass = direction => `input_${(DIRECTIONS.indexOf(direction) + 2) % 4 + 1}`;
    const directionOf = outputCls => DIRECTIONS[Number(outputCls.replace('output_', '')) - 1];
    const sideOfInput = inputCls => DIRECTIONS[Number(inputCls.replace('input_', '')) - 1];

    // 화살표 머리 — 연결선마다 svg 가 따로 생기므로 문서에 한 번만 정의해 두고 CSS marker-end 로 참조한다
    function ensureArrowMarker() {
        if (document.getElementById('vt-arrow')) return;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.position = 'absolute';
        svg.innerHTML = `
            <defs>
                <marker id="vt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="12" markerHeight="12"
                        markerUnits="userSpaceOnUse" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" class="vt-arrow-head"></path>
                </marker>
            </defs>`;
        document.body.appendChild(svg);
    }

    // 두 변 사이를 직각으로 잇는 경로 — 각 변에서 STUB 만큼 곧게 나온 뒤, 가로/세로로 꺾어 만난다
    function orthogonalPath(start, startSide, end, endSide) {
        const [sdx, sdy] = SIDE_VECTORS[startSide];
        const [edx, edy] = SIDE_VECTORS[endSide];
        const s1 = [start[0] + sdx * STUB, start[1] + sdy * STUB];
        const e1 = [end[0] + edx * STUB, end[1] + edy * STUB];
        const startHorizontal = sdx !== 0;
        const endHorizontal = edx !== 0;
        const points = [start, s1];
        if (startHorizontal && endHorizontal) {
            const midX = (s1[0] + e1[0]) / 2;
            points.push([midX, s1[1]], [midX, e1[1]]);
        } else if (!startHorizontal && !endHorizontal) {
            const midY = (s1[1] + e1[1]) / 2;
            points.push([s1[0], midY], [e1[0], midY]);
        } else if (startHorizontal) {
            points.push([e1[0], s1[1]]);
        } else {
            points.push([s1[0], e1[1]]);
        }
        points.push(e1, end);
        return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
    }

    // 포트 가운데의 캔버스 좌표 (확대 비율을 되돌려 계산)
    function portCenter(editor, port) {
        const canvasRect = editor.precanvas.getBoundingClientRect();
        const rect = port.getBoundingClientRect();
        return [
            (rect.x - canvasRect.x) / editor.zoom + port.offsetWidth / 2,
            (rect.y - canvasRect.y) / editor.zoom + port.offsetHeight / 2,
        ];
    }

    // Drawflow 가 그린 연결선(svg) 하나를 변 방향에 맞는 직각 경로로 다시 그린다
    // svg 클래스: connection node_in_{입력 노드} node_out_{출력 노드} output_N input_M
    function redrawConnection(editor, svg) {
        const [, inNode, outNode, outCls, inCls] = svg.classList;
        const outPort = editor.precanvas.querySelector(`#${outNode.replace('node_out_', '')} .outputs .${outCls}`);
        const inPort = editor.precanvas.querySelector(`#${inNode.replace('node_in_', '')} .inputs .${inCls}`);
        const path = svg.querySelector('.main-path');
        if (!outPort || !inPort || !path) return;
        path.setAttribute('d', orthogonalPath(portCenter(editor, outPort), directionOf(outCls), portCenter(editor, inPort), sideOfInput(inCls)));
    }

    function create(container, { mode = 'view' } = {}) {
        ensureArrowMarker();
        const editor = new Drawflow(container);
        editor.editor_mode = mode;
        editor.zoom_min = 0.2;
        editor.zoom_max = 2;
        // 출력점에서 끌어 카드 아무 곳에나 놓으면 연결한다 (입력점은 숨겨 두고 아래 connectionCreated 에서 반대쪽 변으로 옮긴다)
        editor.force_first_input = true;
        // 끌고 있는 동안의 임시 선은 직선, 연결이 끝난 선은 redrawConnection 이 변 방향에 맞게 다시 그린다
        editor.createCurvature = (sx, sy, ex, ey) => ` M ${sx} ${sy} L ${ex} ${ey}`;
        const originalUpdate = editor.updateConnectionNodes.bind(editor);
        editor.updateConnectionNodes = id => {
            originalUpdate(id);
            editor.precanvas.querySelectorAll(`.connection.node_in_${id}, .connection.node_out_${id}`)
                .forEach(svg => redrawConnection(editor, svg));
        };
        // 우클릭 삭제(×) 대신 선택하면 뜨는 휴지통 버튼(enableTrashButtons)으로 지운다 — start() 가 이 함수를 bind 하므로 그 전에 바꾼다
        editor.contextmenu = e => e.preventDefault();
        editor.start();
        // start() 가 붙이는 parent-drawflow 가 첫 번째 클래스여야 한다 — Drawflow 는 classList[0] 으로 화면 이동(보기 모드) 여부를 판단한다
        container.classList.add('vt-board');
        container.classList.toggle('vt-readonly', mode !== 'edit');

        if (mode === 'edit') enableTrashButtons(editor);

        // 입력 변을 출력 변의 반대쪽으로 맞추고, 같은 두 카드 사이에 이미 있던 화살표는 새 방향으로 바꾼다
        editor.on('connectionCreated', conn => {
            if (isNormalized(conn)) {
                removeOtherLinks(editor, conn);
                return;
            }
            editor.removeSingleConnection(conn.output_id, conn.input_id, conn.output_class, conn.input_class);
            editor.addConnection(conn.output_id, conn.input_id, conn.output_class, inputClass(directionOf(conn.output_class)));
        });
        return editor;
    }

    // 선택한 카드(오른쪽 위 바깥)와 화살표(가운데)에 빨간 휴지통 버튼을 띄우고, 누르면 지운다
    // Drawflow 의 선택 이벤트는 node_selected 등 상태를 바꾸기 전에 오는 경우가 있어 다음 틱에 상태를 읽어 버튼을 다시 그린다
    function enableTrashButtons(editor) {
        function trashButton(onClick) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'vt-trash';
            btn.title = '삭제';
            btn.setAttribute('aria-label', '삭제');
            btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            // Drawflow 가 mousedown 으로 선택/드래그를 시작하지 않도록 막고, 클릭만 직접 처리한다
            ['mousedown', 'touchstart', 'pointerdown'].forEach(type => btn.addEventListener(type, e => e.stopPropagation()));
            btn.addEventListener('click', e => {
                e.stopPropagation();
                onClick();
            });
            return btn;
        }

        function sync() {
            editor.precanvas.querySelectorAll('.vt-trash').forEach(el => el.remove());
            const node = editor.node_selected;
            if (node?.isConnected) {
                node.appendChild(trashButton(() => {
                    editor.removeNodeId(node.id);
                    editor.node_selected = null;
                    sync();
                }));
            }
            const path = editor.connection_selected;
            if (path?.isConnected) {
                const mid = path.getPointAtLength(path.getTotalLength() / 2);
                const btn = trashButton(() => {
                    editor.removeConnection();
                    editor.connection_selected = null;
                    sync();
                });
                btn.classList.add('vt-trash-link');
                btn.style.left = `${mid.x}px`;
                btn.style.top = `${mid.y}px`;
                editor.precanvas.appendChild(btn);
            }
        }

        ['nodeSelected', 'nodeUnselected', 'connectionSelected', 'connectionUnselected', 'nodeRemoved', 'connectionRemoved']
            .forEach(event => editor.on(event, () => setTimeout(sync)));
    }

    // 출력 변과 입력 변이 마주 보는(정리된) 연결인지 — 정리 전 임시 연결 이벤트는 편집 화면에서 무시한다
    function isNormalized(conn) {
        return conn.input_class === inputClass(directionOf(conn.output_class));
    }

    function removeOtherLinks(editor, conn) {
        const node = editor.getNodeFromId(conn.output_id);
        Object.entries(node.outputs).forEach(([cls, output]) => {
            if (cls === conn.output_class) return;
            output.connections
                .filter(c => String(c.node) === String(conn.input_id))
                .forEach(c => editor.removeSingleConnection(conn.output_id, conn.input_id, cls, c.output));
        });
    }

    // 공유 페이지(share.html) 카드와 같은 구성 — 순번/매뉴얼 링크는 빼고, 보유 여부를 이미지 위에 표시한다
    function cardHtml(product, { current = false, owned = false } = {}) {
        const imageUrl = product.boxArtUrl || product.boxArtThumbUrl;
        const image = imageUrl
            ? `<img src="${escHtml(imageUrl)}" alt="${escHtml(product.name)}" loading="lazy" draggable="false">`
            : `<div class="vt-card-noimage">NO IMAGE</div>`;
        const release = formatReleaseDate(product.releaseYear, product.releaseMonth);
        const meta = [
            release ? `<div><dt>발매</dt><dd>${escHtml(release)}</dd></div>` : '',
            product.series ? `<div><dt>출연작</dt><dd>${escHtml(product.series)}</dd></div>` : '',
        ].join('');
        return `
            <div class="vt-card${current ? ' vt-card-current' : ''}">
                <div class="vt-card-image">
                    ${image}
                    ${owned ? '<span class="vt-card-owned"><i class="fa-solid fa-check"></i> 보유</span>' : ''}
                </div>
                <div class="vt-card-body">
                    <div class="vt-card-head">
                        <span class="chip vt-grade" data-grade="${escHtml(product.grade || '')}">${escHtml(product.grade || '')}</span>
                        ${product.modelNumber ? `<span class="vt-model">${escHtml(product.modelNumber)}</span>` : ''}
                    </div>
                    <div class="vt-name">${escHtml(product.name)}</div>
                    ${meta ? `<dl class="vt-meta">${meta}</dl>` : ''}
                </div>
            </div>`;
    }

    // 제품 카드 하나를 추가하고 Drawflow 노드 ID 를 돌려준다 (포트 4개씩: 위·오른쪽·아래·왼쪽)
    function addProduct(editor, product, x, y, options = {}) {
        return editor.addNode('product', 4, 4, x, y, NODE_CLASS, { productId: product.id }, cardHtml(product, options));
    }

    // 보드(VariationResponseDto)를 그린다 — 기존 내용은 지운다. productId → 노드 ID Map 을 돌려준다
    // options.currentProductId: 강조할 제품, options.ownedProductIds: 보유 표시할 제품 Set
    // 박스아트 영역은 3:2 고정 비율이라 이미지가 늦게 떠도 카드 높이(= 연결점 위치)가 바뀌지 않는다
    function load(editor, variation, { currentProductId = null, ownedProductIds = null } = {}) {
        editor.clear();
        // clear() 는 선택 상태를 지우지 않아 지워진 카드/선을 계속 가리키므로 직접 비운다
        editor.node_selected = null;
        editor.connection_selected = null;
        const nodeIds = new Map();
        variation.nodes.forEach(({ product, x, y }) => {
            const options = { current: product.id === currentProductId, owned: !!ownedProductIds?.has(product.id) };
            nodeIds.set(product.id, addProduct(editor, product, x, y, options));
        });
        variation.links.forEach(({ parentProductId, childProductId, direction }) => {
            const parent = nodeIds.get(parentProductId);
            const child = nodeIds.get(childProductId);
            const dir = DIRECTIONS.includes(direction) ? direction : 'DOWN';
            if (parent != null && child != null) editor.addConnection(parent, child, outputClass(dir), inputClass(dir));
        });
        return nodeIds;
    }

    function nodeData(editor) {
        return editor.export().drawflow.Home.data;
    }

    // 저장 API 본문 형태로 변환 — 화살표는 출력(원본) 쪽 노드 기준으로 모으고, 나가는 변을 방향으로 저장한다
    function toSaveData(editor) {
        const data = nodeData(editor);
        const nodes = [];
        const links = [];
        Object.values(data).forEach(node => {
            nodes.push({ productId: node.data.productId, x: Math.round(node.pos_x), y: Math.round(node.pos_y) });
            Object.entries(node.outputs).forEach(([cls, output]) => {
                output.connections.forEach(conn => {
                    const child = data[conn.node];
                    if (child) {
                        links.push({ parentProductId: node.data.productId, childProductId: child.data.productId, direction: directionOf(cls) });
                    }
                });
            });
        });
        return { nodes, links };
    }

    // 원본 → 바리에이션 관계가 순환하는지 검사 (서버에서도 한 번 더 검사한다)
    function hasCycle(links) {
        const children = new Map();
        links.forEach(({ parentProductId, childProductId }) => {
            if (!children.has(parentProductId)) children.set(parentProductId, []);
            children.get(parentProductId).push(childProductId);
        });
        const state = new Map(); // 1 = 방문 중, 2 = 완료
        function visit(id) {
            if (state.get(id) === 1) return true;
            if (state.get(id) === 2) return false;
            state.set(id, 1);
            if ((children.get(id) || []).some(visit)) return true;
            state.set(id, 2);
            return false;
        }
        return [...children.keys()].some(visit);
    }

    function nodeElement(editor, nodeId) {
        return editor.precanvas.querySelector(`#node-${nodeId}`);
    }

    // 카드 좌표를 바꾸고 연결선을 다시 그린다 (Drawflow 데이터와 DOM 위치를 함께 맞춘다)
    function moveNode(editor, nodeId, x, y) {
        const node = editor.drawflow.drawflow.Home.data[nodeId];
        node.pos_x = x;
        node.pos_y = y;
        const el = nodeElement(editor, nodeId);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        editor.updateConnectionNodes(`node-${nodeId}`);
    }

    // 가계도 자동 정렬 — 원본을 위, 바리에이션을 아래에 놓는 트리로 정렬하고, 화살표도 모두 아래 방향으로 바꾼다
    // 첫 번째로 들어오는 원본을 트리 부모로 삼고(나머지 원본의 화살표는 그대로 이어진다), 부모는 자식들 가로 가운데에 놓는다
    // 형제 순서는 발매년월 → 이름 순 (일반판 → 나중에 나온 바리에이션 순으로 읽히도록)
    function autoLayout(editor, productMap) {
        const data = nodeData(editor);
        const ids = Object.keys(data).map(Number);
        if (ids.length === 0) return;

        const releaseKey = id => {
            const p = productMap.get(data[id].data.productId);
            return (p?.releaseYear || 9999) * 100 + (p?.releaseMonth || 0);
        };
        const byRelease = (a, b) => releaseKey(a) - releaseKey(b)
            || String(productMap.get(data[a].data.productId)?.name).localeCompare(String(productMap.get(data[b].data.productId)?.name));

        // 모든 화살표를 아래 → 위 변으로 다시 잇는다 (같은 두 카드 사이 중복은 create() 의 정리 로직이 막는다)
        const links = [];
        Object.entries(data).forEach(([id, node]) => {
            Object.entries(node.outputs).forEach(([cls, output]) => {
                output.connections.forEach(c => links.push({ from: Number(id), to: Number(c.node), outCls: cls, inCls: c.output }));
            });
        });
        links.forEach(l => {
            if (l.outCls === outputClass('DOWN')) return;
            editor.removeSingleConnection(l.from, l.to, l.outCls, l.inCls);
            editor.addConnection(l.from, l.to, outputClass('DOWN'), inputClass('DOWN'));
        });

        const treeParent = new Map();
        const treeChildren = new Map(ids.map(id => [id, []]));
        links.forEach(({ from, to }) => {
            if (treeParent.has(to)) return;
            treeParent.set(to, from);
            treeChildren.get(from).push(to);
        });
        treeChildren.forEach(children => children.sort(byRelease));
        const roots = ids.filter(id => !treeParent.has(id)).sort(byRelease);

        const heights = new Map(ids.map(id => [id, nodeElement(editor, id)?.offsetHeight || 200]));
        const rowHeight = Math.max(...heights.values()) + V_GAP;

        const visited = new Set();
        let cursorX = 0;
        // 리프는 왼쪽부터 차례로 놓고, 부모는 자식들 가로 가운데 위에 놓는다 (같은 세대는 같은 줄)
        function place(id, depth) {
            visited.add(id);
            const children = treeChildren.get(id).filter(c => !visited.has(c));
            let x;
            if (children.length === 0) {
                x = cursorX;
                cursorX += NODE_WIDTH + H_GAP;
            } else {
                const xs = children.map(c => place(c, depth + 1));
                x = (xs[0] + xs[xs.length - 1]) / 2;
            }
            moveNode(editor, id, x, depth * rowHeight);
            return x;
        }
        roots.forEach(id => place(id, 0));
        // 순환 등으로 루트에서 닿지 않은 카드는 맨 오른쪽에 놓는다
        ids.filter(id => !visited.has(id)).forEach(id => place(id, 0));
    }

    // 보드 전체가 화면에 들어오도록 확대 비율과 위치를 맞춘다 (100% 보다 크게 키우지는 않는다)
    // Drawflow 는 precanvas 에 translate + scale 을 걸고, scale 의 기준점은 precanvas 가운데(transform-origin 기본값)다
    function fit(editor) {
        const els = [...editor.precanvas.querySelectorAll('.drawflow-node')];
        if (els.length === 0) {
            setTransform(editor, 1, 0, 0);
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        els.forEach(el => {
            minX = Math.min(minX, el.offsetLeft);
            minY = Math.min(minY, el.offsetTop);
            maxX = Math.max(maxX, el.offsetLeft + el.offsetWidth);
            maxY = Math.max(maxY, el.offsetTop + el.offsetHeight);
        });
        const width = editor.precanvas.clientWidth;
        const height = editor.precanvas.clientHeight;
        const zoom = Math.max(editor.zoom_min, Math.min(1,
            (width - FIT_PADDING * 2) / (maxX - minX),
            (height - FIT_PADDING * 2) / (maxY - minY)));
        // 보드 중심(bx, by)이 화면 중심(cx, cy)에 오도록: cx + (bx - cx) * zoom + tx = cx
        const cx = width / 2, cy = height / 2;
        const bx = (minX + maxX) / 2, by = (minY + maxY) / 2;
        setTransform(editor, zoom, (cx - bx) * zoom, (cy - by) * zoom);
    }

    function setTransform(editor, zoom, x, y) {
        editor.zoom = zoom;
        editor.zoom_last_value = zoom;
        editor.canvas_x = x;
        editor.canvas_y = y;
        editor.precanvas.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    }

    // 지금 보이는 화면의 가운데 좌표 (캔버스 좌표계) — 새 카드를 놓을 위치
    function viewCenter(editor) {
        const width = editor.precanvas.clientWidth;
        const height = editor.precanvas.clientHeight;
        const cx = width / 2, cy = height / 2;
        return {
            x: cx - editor.canvas_x / editor.zoom - NODE_WIDTH / 2,
            y: cy - editor.canvas_y / editor.zoom - 120,
        };
    }

    // 확대/축소/맞춤 버튼 — 컨테이너 안 오른쪽 아래에 붙인다 (Ctrl + 휠, 핀치로도 확대할 수 있다)
    function addZoomControls(editor, container) {
        const box = document.createElement('div');
        box.className = 'vt-zoom';
        box.innerHTML = `
            <button type="button" data-zoom="in" title="확대" aria-label="확대"><i class="fa-solid fa-plus"></i></button>
            <button type="button" data-zoom="out" title="축소" aria-label="축소"><i class="fa-solid fa-minus"></i></button>
            <button type="button" data-zoom="fit" title="전체 보기" aria-label="전체 보기"><i class="fa-solid fa-expand"></i></button>`;
        // Drawflow 가 컨테이너의 pointerdown 으로 화면 이동을 시작하므로 버튼 위에서는 막는다
        box.addEventListener('pointerdown', e => e.stopPropagation());
        box.addEventListener('mousedown', e => e.stopPropagation());
        box.addEventListener('touchstart', e => e.stopPropagation());
        box.addEventListener('click', e => {
            const action = e.target.closest('[data-zoom]')?.dataset.zoom;
            if (action === 'in') editor.zoom_in();
            else if (action === 'out') editor.zoom_out();
            else if (action === 'fit') fit(editor);
        });
        container.appendChild(box);
    }

    return { create, load, addProduct, toSaveData, hasCycle, isNormalized, autoLayout, fit, viewCenter, addZoomControls, nodeData };
})();
