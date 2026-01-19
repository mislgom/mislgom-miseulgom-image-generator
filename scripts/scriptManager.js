/**
 * 미슬곰 이미지 자동 생성기 v1.0 - 대본 관리 모듈
 * 파트별 대본 입력, 파트 수 선택, 탭 전환, AI 분석
 */

const ScriptManager = {
    // 상태 관리
    state: {
        partCount: 5, // 기본 5개 파트
        currentPart: 'intro',
        scripts: {
            intro: ''
        },
        analysisResult: null,
        isAnalyzed: false
    },

    // 초기화
    init() {
        console.log('📄 ScriptManager 초기화 시작');
        console.log('현재 시간:', new Date().toLocaleTimeString());
        console.log('document.readyState:', document.readyState);
        
        // 요소 존재 확인
        const modernUploadBtn = document.getElementById('modern-upload-btn');
        const fileInput = document.getElementById('script-file-input');
        console.log('버튼 존재:', !!modernUploadBtn, modernUploadBtn);
        console.log('파일입력 존재:', !!fileInput, fileInput);
        
        this.attachEventListeners();
        this.initPartCount();
        this.initCharCounter();
        
        console.log('📄 ScriptManager 초기화 완료');
    },

    // 이벤트 리스너 등록
    attachEventListeners() {
        // 파트 수 선택
        const partCountSelect = document.getElementById('part-count');
        if (partCountSelect) {
            partCountSelect.addEventListener('change', (e) => {
                this.updatePartCount(parseInt(e.target.value));
            });
        }

        // 파트 탭 클릭
        const tabs = document.querySelectorAll('.script-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const part = tab.dataset.part;
                this.switchTab(part);
            });
        });

        // 대본 입력 (글자 수 카운터)
        const textareas = document.querySelectorAll('.script-textarea');
        textareas.forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                this.updateCharCount(e.target);
                this.saveScript(e.target);
            });
        });

        // 종합 대본 분석 버튼
        const analyzeBtn = document.getElementById('analyze-script-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                this.analyzeAllScripts();
            });
        }

        // 파일 업로드 관련 요소
        const fileInput = document.getElementById('script-file-input');
        const uploadFullScriptBtn = document.getElementById('upload-full-script-btn');

        // 🆕 전체 대본 올리기 버튼 (항상 보임)
        if (uploadFullScriptBtn && fileInput) {
            uploadFullScriptBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('📤 전체 대본 올리기 버튼 클릭됨');
                fileInput.click();
            });
            console.log('✅ 전체 대본 올리기 버튼 이벤트 리스너 등록 완료');
        }

        // 파일 선택 후 처리
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                console.log('📁 파일 선택됨:', e.target.files);
                const file = e.target.files?.[0];
                if (file) {
                    console.log('✅ 파일 처리 시작:', file.name);
                    this.handleFileUpload(file);
                }
            });
        }

        // 🆕 파트별 개별 드래그 앤 드롭
        this.attachPartDropListeners();
    },

    // 파트별 드래그앤드롭 이벤트 리스너 등록
    attachPartDropListeners() {
        // Intro 패널
        this.attachDropToPanel('intro');

        // Part 1~10 패널
        for (let i = 1; i <= 10; i++) {
            this.attachDropToPanel(i.toString());
        }
    },

    // 개별 패널에 드래그앤드롭 이벤트 등록
    attachDropToPanel(part) {
        const panel = document.querySelector(`.script-panel[data-part="${part}"]`);
        if (!panel) return;

        const textarea = panel.querySelector('.script-textarea');
        if (!textarea) return;

        panel.addEventListener('dragover', (e) => {
            // 🔧 현재 활성화된 패널만 드롭 허용
            if (!panel.classList.contains('active')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            panel.classList.add('drag-over');
        });

        panel.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            panel.classList.remove('drag-over');
        });

        panel.addEventListener('drop', async (e) => {
            // 🔧 현재 활성화된 패널만 드롭 허용
            if (!panel.classList.contains('active')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            panel.classList.remove('drag-over');

            const file = e.dataTransfer?.files?.[0];
            if (!file) return;

            if (file.type !== 'text/plain') {
                UI.showToast('TXT 파일만 업로드 가능합니다', 'error');
                return;
            }

            try {
                UI.showToast(`${part === 'intro' ? 'Intro' : 'Part ' + part} 대본 읽는 중...`, 'info');

                // 파일 읽기
                const text = await this.readFile(file);

                // 해당 파트 textarea에 입력
                textarea.value = text;
                this.updateCharCount(textarea);
                this.saveScript(textarea);

                UI.showToast(`✅ ${part === 'intro' ? 'Intro' : 'Part ' + part}에 대본이 입력되었습니다`, 'success');

                console.log(`📄 파트별 업로드 완료: ${part}`);

            } catch (error) {
                console.error('❌ 파일 읽기 오류:', error);
                UI.showToast('파일 읽기 중 오류가 발생했습니다', 'error');
            }
        });
    },

    // 파트 수 초기화
    initPartCount() {
        this.updatePartCount(this.state.partCount);
    },

    // 글자 수 카운터 초기화
    initCharCounter() {
        const textareas = document.querySelectorAll('.script-textarea');
        textareas.forEach(textarea => {
            this.updateCharCount(textarea);
        });
    },

    // 파트 수 업데이트
    updatePartCount(count) {
        this.state.partCount = count;

        const tabsContainer = document.getElementById('script-tabs');
        const contentContainer = document.getElementById('script-content');

        if (!tabsContainer || !contentContainer) return;

        // 기존 탭과 패널 제거 (Intro 제외)
        const existingTabs = tabsContainer.querySelectorAll('.script-tab:not([data-part="intro"])');
        const existingPanels = contentContainer.querySelectorAll('.script-panel:not([data-part="intro"])');
        
        existingTabs.forEach(tab => tab.remove());
        existingPanels.forEach(panel => panel.remove());

        // 새로운 탭과 패널 생성
        for (let i = 1; i <= count; i++) {
            // 탭 생성
            const tab = document.createElement('button');
            tab.className = 'script-tab';
            tab.dataset.part = i.toString();
            tab.textContent = `Part ${i}`;
            tab.addEventListener('click', () => {
                this.switchTab(i.toString());
            });
            tabsContainer.appendChild(tab);

            // 패널 생성
            const panel = document.createElement('div');
            panel.className = 'script-panel';
            panel.dataset.part = i.toString();
            panel.innerHTML = `
                <div class="script-editor">
                    <textarea
                        id="script-part-${i}"
                        class="script-textarea"
                        placeholder="💡 Part ${i} 대본을 입력하세요... (최대 10,000자)

📁 이 영역에 파일을 드래그하면 Part ${i}에만 입력됩니다
📤 전체 대본을 올리려면 상단의 '전체 대본 올리기' 버튼을 사용하세요"
                        maxlength="10000"
                    ></textarea>
                    <div class="script-footer">
                        <span class="char-count">
                            <span id="char-count-${i}">0</span> / 10,000자
                        </span>
                    </div>
                </div>
            `;
            contentContainer.appendChild(panel);

            // textarea 이벤트 등록
            const textarea = panel.querySelector('.script-textarea');
            if (textarea) {
                textarea.addEventListener('input', (e) => {
                    this.updateCharCount(e.target);
                    this.saveScript(e.target);
                });
            }

            // 🆕 드래그앤드롭 이벤트 등록
            this.attachDropToPanel(i.toString());
        }

        console.log(`📝 파트 수 변경: ${count}개`);
    },

    // 탭 전환
    switchTab(part) {
        this.state.currentPart = part;

        // 탭 활성화
        const tabs = document.querySelectorAll('.script-tab');
        tabs.forEach(tab => {
            if (tab.dataset.part === part) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // 패널 표시
        const panels = document.querySelectorAll('.script-panel');
        panels.forEach(panel => {
            if (panel.dataset.part === part) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    },

    // 글자 수 업데이트
    updateCharCount(textarea) {
        const id = textarea.id;
        const part = id.replace('script-', '').replace('part-', '');
        const countSpan = document.getElementById(`char-count-${part}`);
        
        if (countSpan) {
            const length = textarea.value.length;
            countSpan.textContent = length.toLocaleString();

            // 경고 색상
            if (length > 9500) {
                countSpan.style.color = 'var(--error-color)';
            } else if (length > 9000) {
                countSpan.style.color = 'var(--warning-color)';
            } else {
                countSpan.style.color = 'var(--text-secondary)';
            }
        }
    },

    // 대본 저장 (state)
    saveScript(textarea) {
        const id = textarea.id;
        const part = id.replace('script-', '').replace('part-', '');
        this.state.scripts[part] = textarea.value;
    },

    // 전체 대본 분석
    async analyzeAllScripts() {
        try {
            // 입력된 대본 확인
            const scripts = this.getAllScripts();
            
            if (Object.keys(scripts).length === 0) {
                UI.showToast('대본을 입력해주세요', 'error');
                return;
            }

            UI.showToast('AI가 대본을 분석 중입니다...', 'info');
            UI.showLoading('대본 분석 중...');

            // AI 분석 (API 호출 또는 로컬 분석)
            const analysisResult = await this.performAnalysis(scripts);

            this.state.analysisResult = analysisResult;
            this.state.isAnalyzed = true;

            UI.hideLoading();

            // 분석 결과 모달 표시
            this.showAnalysisModal(analysisResult);

            console.log('📊 대본 분석 완료:', analysisResult);

        } catch (error) {
            console.error('❌ 대본 분석 오류:', error);
            UI.hideLoading();
            UI.showToast('대본 분석 중 오류가 발생했습니다', 'error');
        }
    },

    // AI 분석 수행 - v2.0 (등장인물 + 장면 수)
    async performAnalysis(scripts) {
        console.log('🤖 대본 분석 시작...');
        
        // Gemini API 사용 (폴백: 규칙 기반)
        try {
            const result = await API.analyzeScriptWithGemini(scripts);
            console.log('✅ 대본 분석 완료:', result);
            
            // 🆕 등장인물 자동 추출 (CharacterManager로 전달)
            if (result.characters && result.characters.length > 0) {
                console.log(`👥 등장인물 ${result.characters.length}명 자동 추출됨`);
                
                // CharacterManager에 등장인물 설정
                CharacterManager.state.characters = result.characters.map(char => ({
                    name: char.name,
                    nameEn: char.nameEn,
                    descriptionKo: char.descriptionKo,
                    descriptionEn: char.descriptionEn,
                    description: char.descriptionEn,  // 기존 호환성
                    ethnicity: CharacterManager.state.currentEthnicity,
                    style: CharacterManager.state.currentStyle
                }));
                
                CharacterManager.renderCharacters();
                
                // 등장인물 생성 버튼 활성화
                const generateBtn = document.getElementById('generate-characters-btn');
                if (generateBtn) {
                    generateBtn.disabled = false;
                }
                
                UI.showToast(`✅ ${result.characters.length}명의 등장인물 자동 추출 완료!`, 'success');
            }
            
            // 장면 수 데이터만 반환 (기존 UI 호환성)
            return result.scenes || result;
            
        } catch (error) {
            console.error('❌ 분석 실패, 규칙 기반 사용:', error);
            const fallbackResult = API.analyzeScriptRuleBased(scripts);
            
            // 규칙 기반의 경우 기본 등장인물 설정
            if (fallbackResult.characters) {
                CharacterManager.state.characters = fallbackResult.characters.map(char => ({
                    ...char,
                    ethnicity: CharacterManager.state.currentEthnicity,
                    style: CharacterManager.state.currentStyle
                }));
                CharacterManager.renderCharacters();
            }
            
            return fallbackResult.scenes || fallbackResult;
        }
    },

    // 분석 결과 모달 표시
    showAnalysisModal(result) {
        const modal = document.getElementById('image-count-modal');
        const listContainer = document.getElementById('part-analysis-list');

        if (!modal || !listContainer) return;

        // 리스트 생성
        listContainer.innerHTML = '';

        for (const [part, data] of Object.entries(result)) {
            const partName = part === 'intro' ? 'Intro (콜드오픈)' : `Part ${part}`;
            
            const item = document.createElement('div');
            item.className = 'part-analysis-item';
            item.dataset.part = part;

            item.innerHTML = `
                <div class="part-analysis-header">
                    <span class="part-name">${partName}</span>
                    <span class="part-char-count">${data.charCount.toLocaleString()}자</span>
                </div>
                <div class="image-count-options">
                    <div class="image-count-option" data-type="total">
                        <div class="option-label">전체 장면</div>
                        <div class="option-count">${data.totalScenes}</div>
                    </div>
                    <div class="image-count-option selected" data-type="important">
                        <div class="option-label">중요 장면</div>
                        <div class="option-count">${data.importantScenes}</div>
                    </div>
                    <div class="image-count-option" data-type="minimal">
                        <div class="option-label">최소 장면</div>
                        <div class="option-count">${data.minimalScenes}</div>
                    </div>
                </div>
                <div class="custom-count-input">
                    <label>직접 입력:</label>
                    <input type="number" min="1" max="100" value="${data.importantScenes}" class="custom-count" data-part="${part}">
                </div>
            `;

            // 옵션 선택 이벤트
            const options = item.querySelectorAll('.image-count-option');
            options.forEach(option => {
                option.addEventListener('click', () => {
                    options.forEach(o => o.classList.remove('selected'));
                    option.classList.add('selected');

                    const type = option.dataset.type;
                    const count = type === 'total' ? data.totalScenes : 
                                  type === 'important' ? data.importantScenes : 
                                  data.minimalScenes;

                    const input = item.querySelector('.custom-count');
                    if (input) {
                        input.value = count;
                    }

                    this.state.analysisResult[part].selectedCount = count;
                });
            });

            // 직접 입력 이벤트
            const input = item.querySelector('.custom-count');
            if (input) {
                input.addEventListener('change', (e) => {
                    const value = parseInt(e.target.value) || 1;
                    this.state.analysisResult[part].selectedCount = value;

                    // 옵션 선택 해제
                    options.forEach(o => o.classList.remove('selected'));
                });
            }

            listContainer.appendChild(item);
        }

        // 확인 버튼
        const confirmBtn = document.getElementById('confirm-image-count-btn');
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                this.confirmImageCount();
            };
        }

        // 🆕 모달 닫기 버튼
        const closeBtn = modal.querySelector('.modal-close');
        const backdrop = modal.querySelector('.modal-backdrop');

        const closeModal = () => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        };

        if (closeBtn) {
            closeBtn.onclick = closeModal;
        }

        if (backdrop) {
            backdrop.onclick = closeModal;
        }

        // 모달 표시
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    // 이미지 수 확인
    confirmImageCount() {
        const modal = document.getElementById('image-count-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }

        UI.showToast('✅ 이미지 수가 설정되었습니다', 'success');

        // 등장인물 추출
        CharacterManager.extractCharactersFromAllScripts(this.getAllScripts());

        // 등장인물 생성 버튼 활성화
        const generateBtn = document.getElementById('generate-characters-btn');
        if (generateBtn) {
            generateBtn.disabled = false;
        }

        console.log('✅ 이미지 수 확정:', this.state.analysisResult);
    },

    // 파일 업로드 처리
    async handleFileUpload(file) {
        try {
            UI.showToast('대본 파일을 읽는 중...', 'info');

            const text = await this.readFile(file);
            
            // 파트 자동 분할
            const parts = this.splitIntoParts(text);

            // 각 파트에 대본 입력
            for (const part of parts) {
                const partKey = part.partNumber === 0 ? 'intro' : part.partNumber.toString();
                const textarea = document.getElementById(
                    part.partNumber === 0 ? 'script-intro' : `script-part-${part.partNumber}`
                );

                if (textarea) {
                    textarea.value = part.content;
                    this.updateCharCount(textarea);
                    this.saveScript(textarea);
                }
            }

            UI.showToast(`✅ ${parts.length}개 파트로 자동 분할되었습니다`, 'success');

            console.log('📄 파일 업로드 완료:', {
                fileName: file.name,
                parts: parts.length
            });

        } catch (error) {
            console.error('❌ 파일 업로드 오류:', error);
            UI.showToast('파일 업로드 중 오류가 발생했습니다', 'error');
        }
    },

    // 파일 읽기
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file, 'UTF-8');
        });
    },

    // 파트 자동 분할
    splitIntoParts(text) {
        const parts = [];
        
        // 파트 구분 패턴 (한글, 영문, 일본어)
        const partPatterns = [
            /(?:^|\n)\s*={2,}\s*파트\s*(\d+)\s*={2,}\s*\n/gi,
            /(?:^|\n)\s*\[파트\s*(\d+)\]\s*\n/gi,
            /(?:^|\n)\s*파트\s*(\d+)\s*[:：]\s*\n/gi,
            /(?:^|\n)\s*파트(\d+)\s*\n/gi,
            /(?:^|\n)\s*Part\s*(\d+)\s*[:：]?\s*\n/gi,
            /(?:^|\n)\s*\[Part\s*(\d+)\]\s*\n/gi,
            /(?:^|\n)\s*={2,}\s*パート\s*(\d+)\s*={2,}\s*\n/gi,
            /(?:^|\n)\s*\[パート\s*(\d+)\]\s*\n/gi,
            /(?:^|\n)\s*パート\s*(\d+)\s*[:：]\s*\n/gi,
            /(?:^|\n)\s*パート(\d+)\s*\n/gi,
        ];

        // 모든 파트 구분자 찾기
        const markers = [];
        
        partPatterns.forEach(pattern => {
            let match;
            const regex = new RegExp(pattern);
            while ((match = regex.exec(text)) !== null) {
                markers.push({
                    index: match.index,
                    length: match[0].length,
                    partNumber: parseInt(match[1])
                });
            }
        });

        // 인덱스 순으로 정렬
        markers.sort((a, b) => a.index - b.index);

        // 중복 제거
        const uniqueMarkers = [];
        let lastIndex = -1;
        markers.forEach(marker => {
            if (marker.index !== lastIndex) {
                uniqueMarkers.push(marker);
                lastIndex = marker.index;
            }
        });

        // 파트가 없으면 전체를 Intro로
        if (uniqueMarkers.length === 0) {
            parts.push({
                partNumber: 0, // Intro
                content: text.trim()
            });
        } else {
            // 파트별로 분할
            uniqueMarkers.forEach((marker, index) => {
                const start = marker.index + marker.length;
                const end = index < uniqueMarkers.length - 1 
                    ? uniqueMarkers[index + 1].index 
                    : text.length;
                
                const content = text.substring(start, end).trim();
                
                if (content.length > 0) {
                    parts.push({
                        partNumber: marker.partNumber,
                        content: content
                    });
                }
            });
        }

        return parts;
    },

    // 모든 대본 가져오기
    getAllScripts() {
        const scripts = {};

        // Intro
        const introTextarea = document.getElementById('script-intro');
        if (introTextarea && introTextarea.value.trim()) {
            scripts.intro = introTextarea.value;
        }

        // Part 1 ~ N
        for (let i = 1; i <= this.state.partCount; i++) {
            const textarea = document.getElementById(`script-part-${i}`);
            if (textarea && textarea.value.trim()) {
                scripts[i.toString()] = textarea.value;
            }
        }

        return scripts;
    },

    // 대본이 업로드되었는지 확인
    isUploaded() {
        const scripts = this.getAllScripts();
        return Object.keys(scripts).length > 0;
    },

    // 상태 저장
    saveState() {
        return {
            partCount: this.state.partCount,
            currentPart: this.state.currentPart,
            scripts: this.getAllScripts(),
            analysisResult: this.state.analysisResult,
            isAnalyzed: this.state.isAnalyzed
        };
    },

    // 상태 복원
    loadState(state) {
        if (state) {
            this.state.partCount = state.partCount || 5;
            this.state.currentPart = state.currentPart || 'intro';
            this.state.analysisResult = state.analysisResult;
            this.state.isAnalyzed = state.isAnalyzed || false;

            // 파트 수 설정
            const partCountSelect = document.getElementById('part-count');
            if (partCountSelect) {
                partCountSelect.value = this.state.partCount;
            }
            this.updatePartCount(this.state.partCount);

            // 대본 복원
            if (state.scripts) {
                for (const [part, text] of Object.entries(state.scripts)) {
                    const textarea = part === 'intro' 
                        ? document.getElementById('script-intro')
                        : document.getElementById(`script-part-${part}`);
                    
                    if (textarea) {
                        textarea.value = text;
                        this.updateCharCount(textarea);
                    }
                }
            }

            // 분석 완료 상태면 버튼 활성화
            if (this.state.isAnalyzed) {
                const generateBtn = document.getElementById('generate-characters-btn');
                if (generateBtn) {
                    generateBtn.disabled = false;
                }
            }
        }
    },

};

// 전역 함수로 노출
window.ScriptManager = ScriptManager;
