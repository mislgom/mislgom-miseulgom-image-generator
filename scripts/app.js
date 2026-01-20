/**
 * 미슬곰 이미지 자동 생성기 v2.0.1 - 메인 애플리케이션
 * 모든 모듈을 통합하고 초기화
 */

// 전역 앱 상태
const App = {
    version: '2.0.1',
    projectName: '새 프로젝트',
    isDemoMode: true,

    // 초기화
    async init() {
        console.log('🐻 미슬곰 이미지 생성기 v3.0 시작');
        console.log(`📅 ${new Date().toLocaleString()}`);

        try {
            // 로그인 확인
            if (!this.checkAuth()) {
                return;
            }

            // 사용자 정보 표시
            await this.displayUserInfo();

            // 모듈 초기화
            await this.initModules();

            // 이미지 생성 API 설정 로드
            API.loadImageApiSettings();

            // 이벤트 리스너 등록
            this.attachEventListeners();

            // 프로젝트 복원
            this.restoreLastProject();

            // 백엔드 연결 확인
            await this.checkBackendConnection();

            console.log('✅ 애플리케이션 초기화 완료');

        } catch (error) {
            console.error('❌ 초기화 오류:', error);
            UI.showToast('초기화 중 오류가 발생했습니다', 'error');
        }
    },

    // 로그인 확인
    checkAuth() {
        const token = localStorage.getItem('auth_token');
        const username = localStorage.getItem('username');

        if (!token || !username) {
            console.log('⚠️ 로그인 필요 - 로그인 페이지로 이동');
            window.location.href = '/login.html';
            return false;
        }

        console.log(`✅ 인증됨: ${username}`);
        return true;
    },

    // 사용자 정보 표시
    async displayUserInfo() {
        const username = localStorage.getItem('username');
        const role = localStorage.getItem('role');
        const token = localStorage.getItem('auth_token');

        // 헤더에 사용자 정보 추가
        const header = document.querySelector('.header');
        if (!header) return;

        // 기존 사용자 정보 제거
        const existingUserInfo = header.querySelector('.user-info');
        if (existingUserInfo) {
            existingUserInfo.remove();
        }

        // 사용자 정보 컨테이너 생성
        const userInfoDiv = document.createElement('div');
        userInfoDiv.className = 'user-info';
        userInfoDiv.style.cssText = 'display: flex; align-items: center; gap: 16px; margin-left: auto;';

        // 오늘 사용량 가져오기
        let quotaText = '';
        try {
            const response = await fetch('/api/user/quota', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                quotaText = `<span style="color: var(--text-secondary); font-size: 14px;">오늘 ${data.used}/100</span>`;
            }
        } catch (error) {
            console.warn('할당량 조회 실패:', error);
        }

        userInfoDiv.innerHTML = `
            <span style="color: var(--text-primary); font-weight: 500;">${username}</span>
            ${quotaText}
            ${role === 'admin' ? '<a href="/admin.html" style="color: var(--primary-color); text-decoration: none; font-size: 14px;">👑 관리자</a>' : ''}
            <button id="logout-btn" class="btn btn-secondary" style="padding: 6px 12px; font-size: 14px;">로그아웃</button>
        `;

        // header-right 끝에 사용자 정보 추가
        const headerRight = header.querySelector('.header-right');
        if (headerRight) {
            headerRight.appendChild(userInfoDiv);
        } else {
            header.appendChild(userInfoDiv);
        }

        // 로그아웃 버튼 이벤트
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }
    },

    // 로그아웃
    logout() {
        if (confirm('로그아웃 하시겠습니까?')) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('username');
            localStorage.removeItem('role');
            console.log('👋 로그아웃됨');
            window.location.href = '/login.html';
        }
    },

    // 모듈 초기화
    async initModules() {
        console.log('📦 모듈 초기화 중...');

        // API 모듈
        if (window.API) {
            console.log('✅ API 모듈 로드됨');
        }

        // UI 모듈
        if (window.UI) {
            UI.init();
            console.log('✅ UI 모듈 초기화됨');
        }

        // 프로젝트 관리 모듈
        if (window.ProjectManager) {
            ProjectManager.init();
            console.log('✅ ProjectManager 초기화됨');
        }

        // 대본 관리 모듈
        if (window.ScriptManager) {
            ScriptManager.init();
            console.log('✅ ScriptManager 초기화됨');
        }

        // 등장인물 관리 모듈
        if (window.CharacterManager) {
            CharacterManager.init();
            console.log('✅ CharacterManager 초기화됨');
        }

        // 스토리보드 관리 모듈
        if (window.StoryboardManager) {
            StoryboardManager.init();
            console.log('✅ StoryboardManager 초기화됨');
        }

        // 🆕 이미지 라이트박스 모듈
        if (window.ImageLightbox) {
            ImageLightbox.init();
            console.log('✅ ImageLightbox 초기화됨');
        }

        console.log('📦 모든 모듈 초기화 완료');
    },

    // 이벤트 리스너 등록
    attachEventListeners() {
        console.log('🔗 이벤트 리스너 등록 중...');

        // 프로젝트 메뉴 버튼
        const projectMenuBtn = document.getElementById('project-menu-btn');
        const projectMenu = document.getElementById('project-menu');
        
        if (projectMenuBtn && projectMenu) {
            projectMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                projectMenu.classList.toggle('active');
            });

            // 메뉴 외부 클릭 시 닫기
            document.addEventListener('click', (e) => {
                if (!projectMenu.contains(e.target) && e.target !== projectMenuBtn) {
                    projectMenu.classList.remove('active');
                }
            });

            // 메뉴 아이템 클릭
            const menuItems = projectMenu.querySelectorAll('.menu-item');
            menuItems.forEach(item => {
                item.addEventListener('click', () => {
                    const action = item.dataset.action;
                    this.handleProjectAction(action);
                    projectMenu.classList.remove('active');
                });
            });
        }

        // API 설정 버튼
        const apiSettingsBtn = document.getElementById('api-settings-btn');
        if (apiSettingsBtn) {
            apiSettingsBtn.addEventListener('click', () => {
                this.openApiSettingsModal();
            });
        }

        // 다크 모드 토글
        const darkModeBtn = document.getElementById('dark-mode-toggle');
        if (darkModeBtn) {
            darkModeBtn.addEventListener('click', () => {
                this.toggleDarkMode();
            });
        }

        // 도움말 버튼
        const helpBtn = document.getElementById('help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                this.openHelpModal();
            });
        }

        // Gemini API 키 입력
        const geminiApiKeyInput = document.getElementById('gemini-api-key');
        if (geminiApiKeyInput) {
            // 저장된 API 키 불러오기
            const savedApiKey = localStorage.getItem('gemini_api_key');
            if (savedApiKey) {
                geminiApiKeyInput.value = savedApiKey;
                API.GEMINI_API_KEY = savedApiKey;
            }

            // API 키 변경 시 저장
            geminiApiKeyInput.addEventListener('change', (e) => {
                const apiKey = e.target.value.trim();
                if (apiKey) {
                    localStorage.setItem('gemini_api_key', apiKey);
                    API.GEMINI_API_KEY = apiKey;
                    console.log('✅ Gemini API 키 저장됨');
                    UI.showToast('Gemini API 키가 저장되었습니다', 'success');
                } else {
                    localStorage.removeItem('gemini_api_key');
                    API.GEMINI_API_KEY = '';
                    console.log('ℹ️ Gemini API 키 제거됨');
                }
            });
        }
        
        // Stable Diffusion 재연결 버튼
        const sdReconnectBtn = document.getElementById('sd-reconnect-btn');
        if (sdReconnectBtn) {
            sdReconnectBtn.addEventListener('click', () => {
                console.log('🔄 Stable Diffusion 재연결 시도...');
                this.checkSDConnection();
            });
        }

        // 대본 분석 버튼
        const analyzeBtn = document.getElementById('analyze-script-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                ScriptManager.analyzeAllScripts();
            });
        }

        // 모달 닫기 버튼
        const modalCloseBtns = document.querySelectorAll('.modal-close, .modal-backdrop');
        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });

        // 이미지 상세 모달 내부 버튼
        const modalDownloadBtn = document.getElementById('modal-download-btn');
        const modalRegenerateBtn = document.getElementById('modal-regenerate-btn');
        const modalEditApplyBtn = document.getElementById('modal-edit-apply-btn');

        if (modalDownloadBtn) {
            modalDownloadBtn.addEventListener('click', () => {
                this.handleModalDownload();
            });
        }

        if (modalRegenerateBtn) {
            modalRegenerateBtn.addEventListener('click', () => {
                this.handleModalRegenerate();
            });
        }

        if (modalEditApplyBtn) {
            modalEditApplyBtn.addEventListener('click', () => {
                this.handleModalEditApply();
            });
        }

        // 프롬프트 탭 전환
        const promptTabs = document.querySelectorAll('.prompt-tab');
        promptTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                promptTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const lang = tab.dataset.lang;
                const promptKo = document.getElementById('modal-prompt-ko');
                const promptEn = document.getElementById('modal-prompt-en');

                if (lang === 'ko') {
                    if (promptKo) promptKo.style.display = 'block';
                    if (promptEn) promptEn.style.display = 'none';
                } else {
                    if (promptKo) promptKo.style.display = 'none';
                    if (promptEn) promptEn.style.display = 'block';
                }
            });
        });

        // 프로젝트명 입력
        const projectNameInput = document.getElementById('project-name-input');
        if (projectNameInput) {
            projectNameInput.addEventListener('change', (e) => {
                this.projectName = e.target.value;
                this.updateProjectName();
                this.autoSave();
            });
        }

        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            // ESC: 모달 닫기
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // 전역 드래그앤드롭 차단 (브라우저가 파일을 직접 여는 것 방지)
        window.addEventListener('dragover', (e) => {
            e.preventDefault();
        }, false);

        window.addEventListener('drop', (e) => {
            e.preventDefault();
        }, false);

        console.log('✅ 이벤트 리스너 등록 완료');
    },

    // 프로젝트 액션 처리
    handleProjectAction(action) {
        switch (action) {
            case 'new':
                this.newProject();
                break;
            case 'save':
                this.saveProject();
                break;
            case 'load':
                this.openProjectListModal();
                break;
            case 'export':
                this.exportProject();
                break;
            case 'import':
                this.importProject();
                break;
            default:
                console.warn('알 수 없는 액션:', action);
        }
    },

    // 새 프로젝트
    newProject() {
        if (confirm('새 프로젝트를 만들시겠습니까? 저장하지 않은 내용은 사라집니다.')) {
            this.projectName = '새 프로젝트';
            
            // 모든 모듈 초기화
            ScriptManager.clearScript();
            CharacterManager.state.characters = [];
            CharacterManager.renderCharacters();
            StoryboardManager.state.scenes = [];
            StoryboardManager.renderScenes();

            this.updateProjectName();
            UI.showToast('새 프로젝트가 생성되었습니다', 'success');
        }
    },

    // 프로젝트 저장
    saveProject() {
        try {
            const projectData = {
                name: this.projectName,
                version: this.version,
                savedAt: Date.now(),
                script: ScriptManager.saveState(),
                characters: CharacterManager.saveState(),
                storyboard: StoryboardManager.saveState()
            };

            ProjectManager.saveProject(projectData);
            UI.showToast('프로젝트가 저장되었습니다', 'success');

        } catch (error) {
            console.error('❌ 저장 오류:', error);
            UI.showToast('저장 중 오류가 발생했습니다', 'error');
        }
    },

    // 프로젝트 불러오기
    loadProject(projectData) {
        try {
            this.projectName = projectData.name;
            
            // 모듈 상태 복원
            if (projectData.script) {
                ScriptManager.loadState(projectData.script);
            }
            
            if (projectData.characters) {
                CharacterManager.loadState(projectData.characters);
            }
            
            if (projectData.storyboard) {
                StoryboardManager.loadState(projectData.storyboard);
            }

            this.updateProjectName();
            UI.showToast('프로젝트를 불러왔습니다', 'success');

        } catch (error) {
            console.error('❌ 불러오기 오류:', error);
            UI.showToast('불러오기 중 오류가 발생했습니다', 'error');
        }
    },

    // 프로젝트 내보내기 (JSON)
    exportProject() {
        try {
            const projectData = {
                name: this.projectName,
                version: this.version,
                exportedAt: Date.now(),
                script: ScriptManager.saveState(),
                characters: CharacterManager.saveState(),
                storyboard: StoryboardManager.saveState()
            };

            const jsonStr = JSON.stringify(projectData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `${this.projectName}_${Date.now()}.json`;
            link.click();

            URL.revokeObjectURL(url);
            UI.showToast('프로젝트를 내보냈습니다', 'success');

        } catch (error) {
            console.error('❌ 내보내기 오류:', error);
            UI.showToast('내보내기 중 오류가 발생했습니다', 'error');
        }
    },

    // 프로젝트 가져오기 (JSON)
    importProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const projectData = JSON.parse(text);

                this.loadProject(projectData);
                UI.showToast('프로젝트를 가져왔습니다', 'success');

            } catch (error) {
                console.error('❌ 가져오기 오류:', error);
                UI.showToast('가져오기 중 오류가 발생했습니다', 'error');
            }
        });

        input.click();
    },

    // 프로젝트 목록 모달 열기
    openProjectListModal() {
        const modal = document.getElementById('project-list-modal');
        if (!modal) return;

        // 프로젝트 목록 렌더링
        const projects = ProjectManager.getAllProjects();
        const listContainer = modal.querySelector('#project-list');

        if (projects.length === 0) {
            listContainer.innerHTML = '<div class="empty-state"><p>저장된 프로젝트가 없습니다</p></div>';
        } else {
            listContainer.innerHTML = '';
            projects.forEach((project, index) => {
                const item = document.createElement('div');
                item.className = 'project-item';
                item.innerHTML = `
                    <div class="project-info">
                        <h4>${project.name}</h4>
                        <p>${new Date(project.savedAt).toLocaleString()}</p>
                    </div>
                    <div class="project-actions">
                        <button class="btn-icon-small" title="불러오기" data-index="${index}">📂</button>
                        <button class="btn-icon-small" title="삭제" data-index="${index}" data-action="delete">🗑️</button>
                    </div>
                `;

                const loadBtn = item.querySelector('[data-index]:not([data-action])');
                const deleteBtn = item.querySelector('[data-action="delete"]');

                if (loadBtn) {
                    loadBtn.addEventListener('click', () => {
                        this.loadProject(project);
                        modal.classList.remove('active');
                        document.body.style.overflow = '';
                    });
                }

                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => {
                        if (confirm('이 프로젝트를 삭제하시겠습니까?')) {
                            ProjectManager.deleteProject(index);
                            this.openProjectListModal(); // 다시 열기
                        }
                    });
                }

                listContainer.appendChild(item);
            });
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    // 도움말 모달 열기
    openHelpModal() {
        const modal = document.getElementById('help-modal');
        if (!modal) return;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    // 모든 모달 닫기
    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    },

    // 다크 모드 토글
    toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        document.body.classList.toggle('light-mode');

        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDark ? 'true' : 'false');

        const btn = document.getElementById('dark-mode-toggle');
        if (btn) {
            btn.textContent = isDark ? '🌙' : '☀️';
        }
    },

    // 프로젝트명 업데이트
    updateProjectName() {
        const nameDisplay = document.getElementById('current-project-name');
        const nameInput = document.getElementById('project-name-input');

        if (nameDisplay) {
            nameDisplay.textContent = this.projectName;
        }

        if (nameInput) {
            nameInput.value = this.projectName;
        }
    },

    // 대본 분석
    async analyzeScript() {
        try {
            if (!ScriptManager.isUploaded()) {
                UI.showToast('먼저 대본을 업로드하세요', 'error');
                return;
            }

            UI.showToast('대본 분석 중...', 'info');

            // 등장인물 추출
            const scriptText = ScriptManager.getRawText();
            CharacterManager.extractCharactersFromScript(scriptText);

            UI.showToast('✅ 대본 분석 완료!', 'success');

        } catch (error) {
            console.error('❌ 분석 오류:', error);
            UI.showToast('분석 중 오류가 발생했습니다', 'error');
        }
    },

    // 모달 다운로드 처리
    handleModalDownload() {
        const modal = document.getElementById('image-detail-modal');
        const type = modal?.dataset.type;
        const id = modal?.dataset.id;
        const index = modal?.dataset.index;

        if (type === 'character' && index !== undefined) {
            const character = CharacterManager.state.characters[parseInt(index)];
            if (character) {
                CharacterManager.downloadCharacterImage(character);
            }
        } else if (type === 'scene' && id) {
            const scene = StoryboardManager.state.scenes.find(s => s.id === id);
            if (scene) {
                StoryboardManager.downloadSceneImage(scene);
            }
        }
    },

    // 모달 재생성 처리
    async handleModalRegenerate() {
        const modal = document.getElementById('image-detail-modal');
        const type = modal?.dataset.type;
        const id = modal?.dataset.id;
        const index = modal?.dataset.index;

        if (type === 'character' && index !== undefined) {
            await CharacterManager.regenerateCharacter(parseInt(index));
        } else if (type === 'scene' && id) {
            await StoryboardManager.regenerateScene(id);
        }

        this.closeAllModals();
    },

    // 모달 수정 적용 처리 - v3.0 (히스토리 저장)
    async handleModalEditApply() {
        const modal = document.getElementById('image-detail-modal');
        const type = modal?.dataset.type;
        const index = modal?.dataset.index;
        const id = modal?.dataset.id;

        const editRequest = document.getElementById('modal-edit-request');
        if (!editRequest || !editRequest.value.trim()) {
            UI.showToast('수정 요청사항을 입력하세요', 'error');
            return;
        }

        const editText = editRequest.value.trim();

        const modalImage = document.getElementById('modal-image');
        const promptEn = document.getElementById('modal-prompt-en');
        const promptKo = document.getElementById('modal-prompt-ko');

        if (!modalImage || !modalImage.src || !promptEn) {
            UI.showToast('이미지 또는 프롬프트를 찾을 수 없습니다', 'error');
            return;
        }

        const currentImageUrl = modalImage.src;
        const originalPrompt = promptEn.value;
        const editPrompt = `${originalPrompt}, ${editText}`;

        UI.showToast('이미지 수정 중... (img2img)', 'info');

        try {
            const resolution = CharacterManager.getResolutionFromAspectRatio(
                CharacterManager.state.currentAspectRatio
            );

            // img2img로 이미지 수정
            const editedImageUrl = await API.editImageLocal(
                currentImageUrl,
                editPrompt,
                resolution.width,
                resolution.height
            );

            // ✅ 타입별 데이터 저장 및 히스토리 추가
            if (type === 'character' && index !== undefined) {
                const character = CharacterManager.state.characters[parseInt(index)];

                // 히스토리 추가
                const version = (character.history?.length || 0) + 1;
                if (!character.history) character.history = [];
                character.history.push({
                    version: version,
                    imageUrl: editedImageUrl,
                    promptKo: `수정됨: ${editText}`,
                    promptEn: editPrompt,
                    timestamp: Date.now()
                });

                // 메인 이미지 업데이트
                character.imageUrl = editedImageUrl;
                character.promptEn = editPrompt;

                // UI 업데이트
                CharacterManager.renderCharacters();
                CharacterManager.renderCharacterHistory(character);

            } else if (type === 'scene' && id) {
                const scene = StoryboardManager.state.scenes.find(s => s.id === id);

                // 히스토리 추가
                const version = (scene.history?.length || 0) + 1;
                if (!scene.history) scene.history = [];
                scene.history.push({
                    version: version,
                    imageUrl: editedImageUrl,
                    promptKo: `수정됨: ${editText}`,
                    promptEn: editPrompt,
                    timestamp: Date.now()
                });

                // 메인 이미지 업데이트
                scene.imageUrl = editedImageUrl;
                scene.promptEn = editPrompt;

                // UI 업데이트
                StoryboardManager.renderScenes();
                StoryboardManager.renderSceneHistory(scene);
            }

            // 모달 이미지 및 프롬프트 업데이트
            modalImage.src = editedImageUrl;
            promptEn.value = editPrompt;
            if (promptKo) promptKo.value = `수정됨: ${editText}`;

            UI.showToast('✅ 이미지 수정 완료!', 'success');
            editRequest.value = '';

        } catch (error) {
            console.error('❌ 이미지 수정 실패:', error);
            UI.showToast(`이미지 수정 실패: ${error.message}`, 'error');
        }
    },

    // 자동 저장
    autoSave() {
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this.saveProject();
        }, 3000); // 3초 후 자동 저장
    },

    // 마지막 프로젝트 복원
    restoreLastProject() {
        const darkMode = localStorage.getItem('darkMode');
        if (darkMode === 'false') {
            this.toggleDarkMode();
        }

        // 마지막 프로젝트 복원 시도
        const lastProject = ProjectManager.getLastProject();
        if (lastProject) {
            console.log('📂 마지막 프로젝트 복원:', lastProject.name);
            this.loadProject(lastProject);
        }
    },

    // 백엔드 연결 확인
    async checkBackendConnection() {
        try {
            const isConnected = await API.checkHealth();
            if (isConnected) {
                console.log('✅ 백엔드 연결됨');
                this.isDemoMode = false;
            } else {
                console.warn('⚠️ 백엔드 연결 실패 - 데모 모드');
                this.isDemoMode = true;
            }
        } catch (error) {
            console.warn('⚠️ 백엔드 연결 실패 - 데모 모드:', error.message);
            this.isDemoMode = true;
        }
        
    },

    // ========== API 설정 모달 ==========

    /**
     * API 설정 모달 열기
     */
    async openApiSettingsModal() {
        const modal = document.getElementById('api-settings-modal');
        if (!modal) return;

        // 탭 설정
        const aiStudioTab = modal.querySelector('[data-type="ai_studio"]');
        const vertexTab = modal.querySelector('[data-type="vertex_ai"]');
        const apiKeyInput = document.getElementById('api-key-input');
        const projectIdInput = document.getElementById('project-id-input');
        const projectIdGroup = document.getElementById('project-id-group');

        // 기본값 설정
        aiStudioTab.classList.add('active');
        vertexTab.classList.remove('active');
        projectIdGroup.style.display = 'none';
        apiKeyInput.value = '';
        projectIdInput.value = '';

        // Gemini API 키 입력 필드 (대본 분석용)
        const geminiApiKeyInput = document.getElementById('gemini-api-key-input');
        const savedGeminiKey = localStorage.getItem('gemini_api_key');
        if (geminiApiKeyInput) {
            geminiApiKeyInput.value = savedGeminiKey || '';
        }

        // 서버에서 현재 설정 로드
        try {
            const token = localStorage.getItem('auth_token');
            if (token) {
                const response = await fetch('/api/user/settings', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const settings = await response.json();

                    if (settings.apiType === 'vertex_ai') {
                        aiStudioTab.classList.remove('active');
                        vertexTab.classList.add('active');
                        projectIdGroup.style.display = 'block';
                    }

                    // 프로젝트 ID만 표시 (API 키는 서버에서 반환하지 않음)
                    if (settings.projectId) {
                        projectIdInput.value = settings.projectId;
                    }

                    // API 키는 보안상 플레이스홀더만 표시
                    if (settings.hasApiKey) {
                        apiKeyInput.placeholder = '기존 API 키가 설정되어 있습니다';
                    }
                }
            }
        } catch (error) {
            console.warn('설정 로드 실패:', error);
        }

        // 상태 표시 업데이트
        await this.updateApiStatusDisplay();

        // 탭 클릭 이벤트
        aiStudioTab.addEventListener('click', () => {
            aiStudioTab.classList.add('active');
            vertexTab.classList.remove('active');
            projectIdGroup.style.display = 'none';
        });

        vertexTab.addEventListener('click', () => {
            aiStudioTab.classList.remove('active');
            vertexTab.classList.add('active');
            projectIdGroup.style.display = 'block';
        });

        // 저장 버튼
        const saveBtn = document.getElementById('save-api-settings-btn');
        // geminiApiKeyInput은 위에서 이미 선언됨 (line 745)

        saveBtn.onclick = async () => {
            const apiType = modal.querySelector('.api-tab.active').dataset.type;
            const apiKey = apiKeyInput.value.trim();
            const projectId = projectIdInput.value.trim();
            const geminiApiKey = geminiApiKeyInput ? geminiApiKeyInput.value.trim() : '';

            if (!apiKey) {
                UI.showToast('API 키를 입력해주세요', 'error');
                return;
            }

            if (apiType === 'vertex_ai' && !projectId) {
                UI.showToast('Vertex AI 사용 시 Project ID가 필요합니다', 'error');
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = '💾 저장 중...';

            try {
                // 이미지 생성 API 설정 저장
                await API.saveImageApiSettings(apiType, apiKey, projectId);

                // Gemini API 키 저장 (대본 분석용)
                if (geminiApiKey) {
                    localStorage.setItem('gemini_api_key', geminiApiKey);
                    API.GEMINI_API_KEY = geminiApiKey;
                    console.log('✅ Gemini API 키 저장됨');
                } else {
                    localStorage.removeItem('gemini_api_key');
                    API.GEMINI_API_KEY = '';
                }

                this.updateApiStatusDisplay();
                UI.showToast('✅ API 설정이 저장되었습니다', 'success');
                modal.style.display = 'none';
            } catch (error) {
                UI.showToast('❌ 저장 실패: ' + error.message, 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 저장';
            }
        };

        // 연결 테스트 버튼
        const testBtn = document.getElementById('test-api-connection-btn');
        testBtn.onclick = async () => {
            const apiType = modal.querySelector('.api-tab.active').dataset.type;
            const apiKey = apiKeyInput.value.trim();
            const projectId = projectIdInput.value.trim();

            if (!apiKey) {
                UI.showToast('API 키를 입력해주세요', 'error');
                return;
            }

            testBtn.disabled = true;
            testBtn.textContent = '🔄 테스트 중...';

            try {
                // 임시로 설정하고 테스트
                API.IMAGE_API_TYPE = apiType;
                API.IMAGE_API_KEY = apiKey;
                API.IMAGE_PROJECT_ID = projectId;

                const testResult = await API.generateImageLocal({
                    prompt: 'A simple test image',
                    aspectRatio: '1:1'
                });

                if (testResult) {
                    UI.showToast('✅ API 연결 성공!', 'success');
                    document.getElementById('api-test-result').style.display = 'block';
                    document.getElementById('api-test-result').innerHTML = '<p class="success">✅ 연결 성공! API가 정상적으로 작동합니다.</p>';
                }
            } catch (error) {
                UI.showToast('❌ API 연결 실패: ' + error.message, 'error');
                document.getElementById('api-test-result').style.display = 'block';
                document.getElementById('api-test-result').innerHTML = `<p class="error">❌ 연결 실패: ${error.message}</p>`;
            } finally {
                testBtn.disabled = false;
                testBtn.textContent = '🔌 연결 테스트';
            }
        };

        // 모달 닫기
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };

        modal.style.display = 'flex';
    },

    /**
     * API 상태 표시 업데이트
     */
    async updateApiStatusDisplay() {
        const statusDisplay = document.getElementById('api-status-display');
        if (!statusDisplay) return;

        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                statusDisplay.innerHTML = '<p class="status-not-configured">⚠️ 로그인이 필요합니다</p>';
                return;
            }

            const response = await fetch('/api/user/settings', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('설정 로드 실패');
            }

            const settings = await response.json();

            if (settings.apiType && settings.hasApiKey) {
                const apiName = settings.apiType === 'ai_studio' ? 'AI Studio' : 'Vertex AI';
                statusDisplay.innerHTML = `
                    <p class="status-configured">✅ ${apiName} 연결됨</p>
                    <p class="status-detail">API 키가 설정되어 있습니다</p>
                    ${settings.projectId ? `<p class="status-detail">Project ID: ${settings.projectId}</p>` : ''}
                `;
            } else {
                statusDisplay.innerHTML = '<p class="status-not-configured">⚠️ API 키가 설정되지 않았습니다</p>';
            }
        } catch (error) {
            console.error('API 상태 표시 업데이트 실패:', error);
            statusDisplay.innerHTML = '<p class="status-not-configured">⚠️ API 키가 설정되지 않았습니다</p>';
        }
    }
};

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// 전역 함수로 노출
window.App = App;
