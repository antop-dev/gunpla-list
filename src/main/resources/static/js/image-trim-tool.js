/* 이미지 여백 제거 도구 팝업 — admin.html 헤더의 "이미지 여백 제거" 버튼에서 열림
 * 업로드/붙여넣기/드롭 즉시 팝업을 닫고 화면 중앙 인디케이터를 표시하며 서버(ImageUtils.trimWhitespace)에서
 * 흰 여백을 잘라낸 뒤, 박스아트 미리보기와 동일한 라이트박스(openLightbox, admin.js)로 결과를 보여줌
 * 복사는 별도 버튼 없이 결과 이미지를 우클릭(브라우저 기본 "이미지 복사")하는 방식으로 처리
 */
const ImageTrimTool = (function () {
    let resultObjectUrl = null;

    function open() {
        document.getElementById('image-trim-file-input').value = '';
        document.getElementById('modal-image-trim').classList.add('active');
    }

    function close() {
        document.getElementById('modal-image-trim').classList.remove('active');
    }

    function showProcessing(show) {
        document.getElementById('image-trim-processing').classList.toggle('active', show);
    }

    // ---- Processing ----

    async function processFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            Toast.error('이미지 파일만 지원합니다.');
            return;
        }
        close();
        showProcessing(true);
        try {
            const blob = await requestTrim(file);
            if (resultObjectUrl) URL.revokeObjectURL(resultObjectUrl);
            resultObjectUrl = URL.createObjectURL(blob);
            window.openLightbox(resultObjectUrl);
        } catch (e) {
            Toast.error(e.message || '이미지 처리에 실패했습니다.');
        } finally {
            showProcessing(false);
        }
    }

    async function requestTrim(file) {
        const fd = new FormData();
        fd.append('file', file, file.name || 'image.png');
        const resp = await fetch(_url('/api/admin/image-tools/trim'), { method: 'POST', body: fd });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ message: 'Error' }));
            throw new Error(err.message || `HTTP ${resp.status}`);
        }
        return resp.blob();
    }

    // ---- Event bindings ----

    function bindEvents() {
        document.getElementById('btn-image-trim-tool').addEventListener('click', open);
        document.getElementById('modal-image-trim-close').addEventListener('click', close);

        // 팝업 바깥(오버레이) 클릭 시 닫기
        document.getElementById('modal-image-trim').addEventListener('click', e => {
            if (e.target.id === 'modal-image-trim') close();
        });

        // ESC 키로 닫기 (모달이 열려있을 때만)
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.getElementById('modal-image-trim').classList.contains('active')) {
                close();
            }
        });

        const drop = document.getElementById('image-trim-drop');
        const fileInput = document.getElementById('image-trim-file-input');
        drop.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) processFile(file);
        });
        drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
        drop.addEventListener('drop', e => {
            e.preventDefault();
            drop.classList.remove('dragover');
            const file = e.dataTransfer?.files?.[0];
            if (file) processFile(file);
        });

        // 모달이 열려있을 때만 붙여넣기 처리 (제품 팝업 등 다른 붙여넣기 영역과 충돌 방지)
        document.addEventListener('paste', e => {
            if (!document.getElementById('modal-image-trim').classList.contains('active')) return;
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) processFile(file);
                    break;
                }
            }
        });
    }

    document.addEventListener('DOMContentLoaded', bindEvents);

    return { open, close };
})();
