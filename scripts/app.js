/**
 * 미슬곰 이미지 자동 생성기 v2.0.5 - 메인 애플리케이션
 * 모든 모듈을 통합하고 초기화
 * v2.0.5: 컨테이너 체크 강화 + 모듈별 예외 격리 + API 의존 순서 정리
 */

// 전역 앱 상태
const App = {
    version: '2.0.5',
    projectName: '새 프로젝트',
    currentProjectId: null, // 불변 프로젝트 식별자 (캐릭터 외형 분리용)
    projectStyle: null,  // 프로젝트 스타일 (외부 주입용)
    autoSaveTimer: null, // 자동 저장 타이머

    // 초기화
    async init() {
    // 🔒 중복 초기화 방지
    if (this._initialized) {
        console.warn('⚠️ App.init() already called. Skipping.');
        return;
    }
    this._initialized = true;

    console.log(`🐻 미슬곰 이미지 생성기 v${this.version} 시작`);
    console.log(`📅 ${new Date().toLocaleString()}`);

    try {
        // 로그인 확인
        if (!this.checkAuth()) {
            return;
        }

            // 사용자 정보 표시
            await this.displayUserInfo();

            // ✅ API 모듈 먼저 확인 및 설정 (다른 모듈보다 선행)
            await this.initApiModule();

            // 모듈 초기화 (API 설정 완료 후)
            await this.initModules();

            // 이벤트 리스너 등록
            this.attachEventListeners();

            // 프로젝트 복원
            this.restoreLastProject();

            // 백엔드 연결 확인
            await this.checkBackendConnection();

            console.log('✅ 애플리케이션 초기화 완료');

        } catch (error) {
            console.error('❌ 초기화 오류:', error);
            if (window.UI?.showToast) {
                window.UI.showToast('초기화 중 오류가 발생했습니다', 'error');
            }
        }
    },

    // ✅ API 모듈 선행 초기화
    async initApiModule() {
        if (!window.API) {
            console.warn('⚠️ API 모듈이 로드되지 않음 - 일부 기능 제한');
            return;
        }

        console.log('✅ API 모듈 로드됨');

        // 이미지 생성 API 설정 로드
        if (window.API.loadImageApiSettings) {
            window.API.loadImageApiSettings();
        }

        // Gemini API 키 로드 (대본 분석용)
        const savedGeminiKey = localStorage.getItem('gemini_api_key');
        if (savedGeminiKey) {
            window.API.GEMINI_API_KEY = savedGeminiKey;
            console.log('✅ Gemini API 키 로드됨');
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

    // 모듈 초기화 (예외 격리 + 컨테이너 체크 강화)
    async initModules() {
        console.log('📦 모듈 초기화 중...');

        // ✅ UI 모듈 (컨테이너 불필요)
        try {
            if (window.UI?.init) {
                window.UI.init();
                console.log('✅ UI 모듈 초기화됨');
            }
        } catch (error) {
            console.error('❌ UI 모듈 초기화 실패:', error);
        }

        // ✅ 프로젝트 관리 모듈 (컨테이너 불필요)
        try {
            if (window.ProjectManager?.init) {
                window.ProjectManager.init();
                console.log('✅ ProjectManager 초기화됨');
            }
        } catch (error) {
            console.error('❌ ProjectManager 초기화 실패:', error);
        }

        // ✅ 대본 관리 모듈 (컨테이너 불필요)
        try {
            if (window.ScriptManager?.init) {
                window.ScriptManager.init();
                console.log('✅ ScriptManager 초기화됨');
            }
        } catch (error) {
            console.error('❌ ScriptManager 초기화 실패:', error);
        }

// ✅ 등장인물 관리 모듈 (컨테이너 필수, null-safe)
try {
    if (window.CharacterManager?.init) {
        // ⚠️ 렌더 결과물이 아닌, 고정 루트 컨테이너만 탐색
        const characterContainer =
            document.getElementById('character-panel') ||
            document.getElementById('characters-container') ||
            document.getElementById('character-list-container');

        if (!characterContainer) {
            console.warn('⚠️ CharacterManager 컨테이너를 찾지 못해 초기화를 건너뜁니다');
            console.warn(
                '   → HTML에 #character-panel 또는 #characters-container 또는 #character-list-container 가 필요합니다'
            );
        } else {
            window.CharacterManager.init(characterContainer, {
                projectStyle: this.projectStyle ?? null,
                onCharacterSelect: (character) => {
                    console.log('[App] 캐릭터 선택됨:', character?.name ?? '(unknown)');
                },
                onCharacterUpdate: (character) => {
                    console.log('[App] 캐릭터 업데이트됨:', character?.name ?? '(unknown)');
                    this.autoSave();
                }
            });

            console.log(
                '✅ CharacterManager 초기화됨 (container:',
                characterContainer.id ||
                    characterContainer.className ||
                    'unknown',
                ')'
            );
        }
    }
} catch (error) {
    console.error('❌ CharacterManager 초기화 중 예외 발생:', error);
}

        // ✅ 스토리보드 관리 모듈 (컨테이너 필수)
        try {
            if (window.StoryboardManager?.init) {
                // 고정 루트 컨테이너만 찾기 (렌더 결과물 제외)
                const storyboardContainer = document.getElementById('storyboard-panel')
                    || document.getElementById('storyboard-container')
                    || document.getElementById('storyboard-list-container');
                
                if (!storyboardContainer) {
                    console.warn('⚠️ StoryboardManager 컨테이너를 찾을 수 없음');
                    console.warn('   → #storyboard-panel, #storyboard-container, #storyboard-list-container 중 하나가 HTML에 필요합니다');
                } else {
                    window.StoryboardManager.init(storyboardContainer);
                    console.log('✅ StoryboardManager 초기화됨 (container:', storyboardContainer.id || storyboardContainer.className, ')');
                }
            }
        } catch (error) {
            console.error('❌ StoryboardManager 초기화 실패:', error);
        }

        // ✅ 이미지 라이트박스 모듈 (컨테이너 불필요)
        try {
            if (window.ImageLightbox?.init) {
                window.ImageLightbox.init();
                console.log('✅ ImageLightbox 초기화됨');
            }
        } catch (error) {
            console.error('❌ ImageLightbox 초기화 실패:', error);
        }

        console.log('📦 모듈 초기화 완료');
        
        // ✅ 초기화 결과 검증 로그
        this.logInitializationStatus();
    },

    // ✅ 초기화 상태 검증 로그
    logInitializationStatus() {
        console.log('--- 초기화 상태 검증 ---');
        console.log('CharacterManager.container:', window.CharacterManager?.container ? '✅ OK' : '❌ NULL');
        console.log('StoryboardManager.container:', window.StoryboardManager?.container ? '✅ OK' : '❌ NULL');
        console.log('API 모듈:', window.API ? '✅ OK' : '❌ 없음');
        console.log('UI 모듈:', window.UI ? '✅ OK' : '❌ 없음');
        console.log('------------------------');
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
                if (window.API) {
                    window.API.GEMINI_API_KEY = savedApiKey;
                }
            }

            // API 키 변경 시 저장
            geminiApiKeyInput.addEventListener('change', (e) => {
                const apiKey = e.target.value.trim();
                if (apiKey) {
                    localStorage.setItem('gemini_api_key', apiKey);
                    if (window.API) {
                        window.API.GEMINI_API_KEY = apiKey;
                    }
                    console.log('✅ Gemini API 키 저장됨');
                    if (window.UI?.showToast) {
                        window.UI.showToast('Gemini API 키가 저장되었습니다', 'success');
                    }
                } else {
                    localStorage.removeItem('gemini_api_key');
                    if (window.API) {
                        window.API.GEMINI_API_KEY = '';
                    }
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

          // ✅ 등장인물 생성 버튼 이벤트 연결
        const generateCharactersBtn = document.getElementById('generate-characters-btn');
        if (generateCharactersBtn) {
            generateCharactersBtn.addEventListener('click', () => {
                if (window.CharacterManager?.generateAllImages) {
                    window.CharacterManager.generateAllImages();
                } else {
                    console.error('CharacterManager.generateAllImages를 찾을 수 없습니다');
                }
            });
        }

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
            case 'reset':
                this.resetAll();
                break;
            default:
                console.warn('알 수 없는 액션:', action);
        }
    },

    // 전체 초기화 (모든 데이터 삭제)
    resetAll() {
        if (confirm('모든 데이터를 초기화하시겠습니까?\n\n저장된 프로젝트, 대본, 등장인물, 스토리보드가 모두 삭제됩니다.\n(API 키 설정은 유지됩니다)')) {
            // 프로젝트 상태 초기화
            this.projectName = '새 프로젝트';
            this.currentProjectId = window.ProjectManager?.generateProjectId
                ? window.ProjectManager.generateProjectId()
                : crypto.randomUUID();

            // CharacterManager 초기화
            if (window.CharacterManager?.setProjectId) {
                window.CharacterManager.setProjectId(this.currentProjectId);
            }
            if (window.CharacterManager?.reset) {
                window.CharacterManager.reset();
            } else if (window.CharacterManager?.setCharacters) {
                window.CharacterManager.setCharacters([]);
            }

            // ScriptManager 초기화
            if (window.ScriptManager?.resetAnalysis) {
                window.ScriptManager.resetAnalysis();
            }

            // StoryboardManager 초기화
            if (window.StoryboardManager?.reset) {
                window.StoryboardManager.reset();
            } else if (window.StoryboardManager?.state) {
                window.StoryboardManager.state.scenes = [];
                if (window.StoryboardManager.render) {
                    window.StoryboardManager.render();
                }
            }

            // IndexedDB 이미지 데이터 삭제
            if (window.ImageStore?.clear) {
                window.ImageStore.clear();
            }

            // localStorage에서 프로젝트 관련 데이터 삭제 (API 키는 유지)
            localStorage.removeItem('lastProject');
            localStorage.removeItem('projects');

            this.updateProjectName();

            if (window.UI?.showToast) {
                window.UI.showToast('모든 데이터가 초기화되었습니다', 'success');
            }
            console.log('🔄 전체 초기화 완료');
        }
    },

    // 새 프로젝트
    newProject() {
        if (confirm('새 프로젝트를 만들시겠습니까? 저장하지 않은 내용은 사라집니다.')) {
            this.projectName = '새 프로젝트';

            // 새 프로젝트에 불변 projectId 부여
            this.currentProjectId = window.ProjectManager?.generateProjectId
                ? window.ProjectManager.generateProjectId()
                : crypto.randomUUID();

            // CharacterManager에 새 projectId 전달
            if (window.CharacterManager?.setProjectId) {
                window.CharacterManager.setProjectId(this.currentProjectId);
            }

            // 모든 모듈 초기화 (안전가드 적용)
            if (window.ScriptManager?.resetAnalysis) {
                window.ScriptManager.resetAnalysis();
            }
            
            if (window.CharacterManager) {
                if (window.CharacterManager.reset) {
                    window.CharacterManager.reset();
                } else {
                    // reset 메서드가 없으면 setCharacters 우선 (정규화/일관성 유지)
                    if (window.CharacterManager.setCharacters) {
                        window.CharacterManager.setCharacters([]);
                    } else if (window.CharacterManager.state) {
                        // 최후 폴백: 직접 대입 (가능하면 이 경로로 오지 않도록)
                        window.CharacterManager.state.characters = [];
                    }

                    if (window.CharacterManager.render) {
                        window.CharacterManager.render();
                    } else if (window.CharacterManager.renderCharacters) {
                        window.CharacterManager.renderCharacters();
                    }
                }
            }
            
            if (window.StoryboardManager) {
                if (window.StoryboardManager.reset) {
                    window.StoryboardManager.reset();
                } else {
                    if (window.StoryboardManager.state) {
                        window.StoryboardManager.state.scenes = [];
                    }
                    if (window.StoryboardManager.render) {
                        window.StoryboardManager.render();
                    } else if (window.StoryboardManager.renderScenes) {
                        window.StoryboardManager.renderScenes();
                    }
                }
            }

            this.updateProjectName();
            if (window.UI?.showToast) {
                window.UI.showToast('새 프로젝트가 생성되었습니다', 'success');
            }
        }
    },

    // 프로젝트 저장 (안전가드 적용)
    saveProject() {
        try {
            // projectId가 없으면 새로 생성 (최초 저장 시)
            if (!this.currentProjectId) {
                this.currentProjectId = window.ProjectManager?.generateProjectId
                    ? window.ProjectManager.generateProjectId()
                    : crypto.randomUUID();
            }

            const projectData = {
                name: this.projectName,
                projectId: this.currentProjectId,
                version: this.version,
                savedAt: Date.now(),
                // 안전가드: saveState 메서드 존재 여부 확인
                script: window.ScriptManager?.saveState ? window.ScriptManager.saveState() : null,
                characters: window.CharacterManager?.saveState ? window.CharacterManager.saveState() : this._getCharactersFallback(),
                storyboard: window.StoryboardManager?.saveState ? window.StoryboardManager.saveState() : this._getStoryboardFallback()
            };

            if (window.ProjectManager?.saveProject) {
                window.ProjectManager.saveProject(projectData);
            } else {
                // ProjectManager 없으면 localStorage에 직접 저장
                localStorage.setItem('lastProject', JSON.stringify(projectData));
            }
            
            if (window.UI?.showToast) {
                window.UI.showToast('프로젝트가 저장되었습니다', 'success');
            }

        } catch (error) {
            console.error('❌ 저장 오류:', error);
            if (window.UI?.showToast) {
                window.UI.showToast('저장 중 오류가 발생했습니다', 'error');
            }
        }
    },

    // CharacterManager saveState 폴백 (imageBase64 제외)
    _getCharactersFallback() {
        if (window.CharacterManager?.state?.characters) {
            const stripped = window.CharacterManager.state.characters.map(char => {
                const { imageBase64, imageUrl, ...rest } = char;
                return {
                    ...rest,
                    hasImage: !!(imageBase64 || (imageUrl && imageUrl.startsWith('data:'))),
                    imageUrl: null,
                    imageBase64: null
                };
            });
            return {
                characters: stripped,
                selectedCharacter: window.CharacterManager.state.selectedCharacter || null
            };
        }
        return null;
    },

    // StoryboardManager saveState 폴백 (imageBase64 제외)
    _getStoryboardFallback() {
        if (window.StoryboardManager?.state?.scenes) {
            const stripped = window.StoryboardManager.state.scenes.map(scene => {
                const { imageBase64, imageUrl, ...rest } = scene;
                return {
                    ...rest,
                    hasImage: !!(imageBase64 || (imageUrl && imageUrl.startsWith('data:'))),
                    imageUrl: null,
                    imageBase64: null
                };
            });
            return { scenes: stripped };
        }
        return null;
    },

    // 프로젝트 불러오기 (안전가드 적용)
    loadProject(projectData) {
        try {
            this.projectName = projectData.name;

            // projectId 복원 (기존 프로젝트에 없으면 새로 부여 후 유지)
            if (projectData.projectId) {
                this.currentProjectId = projectData.projectId;
            } else {
                this.currentProjectId = window.ProjectManager?.generateProjectId
                    ? window.ProjectManager.generateProjectId()
                    : crypto.randomUUID();
                projectData.projectId = this.currentProjectId;
            }

            // CharacterManager에 projectId 전달
            if (window.CharacterManager?.setProjectId) {
                window.CharacterManager.setProjectId(this.currentProjectId);
            }

            // 모듈 상태 복원 (안전가드 적용)
            if (projectData.script && window.ScriptManager?.loadState) {
                window.ScriptManager.loadState(projectData.script);
            }
            
            if (projectData.characters && window.CharacterManager) {
                if (window.CharacterManager.loadState) {
                    window.CharacterManager.loadState(projectData.characters);
                } else {
                    // loadState 없으면 직접 복원
                    this._loadCharactersFallback(projectData.characters);
                }
            }
            
            if (projectData.storyboard && window.StoryboardManager) {
                if (window.StoryboardManager.loadState) {
                    window.StoryboardManager.loadState(projectData.storyboard);
                } else {
                    // loadState 없으면 직접 복원
                    this._loadStoryboardFallback(projectData.storyboard);
                }
            }

            this.updateProjectName();
            if (window.UI?.showToast) {
                window.UI.showToast('프로젝트를 불러왔습니다', 'success');
            }

        } catch (error) {
            console.error('❌ 불러오기 오류:', error);
            if (window.UI?.showToast) {
                window.UI.showToast('불러오기 중 오류가 발생했습니다', 'error');
            }
        }
    },

    // CharacterManager loadState 폴백
_loadCharactersFallback(data) {
    const cm = window.CharacterManager;
    if (!cm) return;

    // data.characters 배열 보장
    const chars = Array.isArray(data?.characters) ? data.characters : [];
    const selected = data?.selectedCharacter || null;

    // ✅ setCharacters()를 우선 사용하여 id/imageStatus/seed 등 정규화
    if (typeof cm.setCharacters === 'function') {
        cm.setCharacters(chars);
        if (cm.state) {
            cm.state.selectedCharacter = selected;
            cm.state.isGenerating = false;
        }
        cm.render?.();
        return;
    }

    // 최후 폴백 (가능하면 이 분기로 오지 않게 해야 함)
    if (!cm.state) {
        cm.state = { characters: [], selectedCharacter: null, isGenerating: false };
    }
    cm.state.characters = chars;
    cm.state.selectedCharacter = selected;
    cm.state.isGenerating = false;
    cm.render?.();
    cm.renderCharacters?.();
},

    // StoryboardManager loadState 폴백
    _loadStoryboardFallback(data) {
        if (window.StoryboardManager?.state && data?.scenes) {
            window.StoryboardManager.state.scenes = data.scenes;
            
            if (window.StoryboardManager.render) {
                window.StoryboardManager.render();
            } else if (window.StoryboardManager.renderScenes) {
                window.StoryboardManager.renderScenes();
            }
        }
    },

    // 프로젝트 내보내기 (JSON) - 이미지 포함 (파일 저장이므로 용량 제한 없음)
    exportProject() {
        try {
            // 내보내기는 파일 저장이므로 이미지 데이터 포함 (localStorage와 달리 용량 무제한)
            const characters = window.CharacterManager?.state?.characters
                ? { characters: window.CharacterManager.state.characters, selectedCharacter: window.CharacterManager.state.selectedCharacter }
                : null;
            const storyboard = window.StoryboardManager?.state
                ? { scenes: window.StoryboardManager.state.scenes, currentPart: window.StoryboardManager.state.currentPart, totalScenes: window.StoryboardManager.state.totalScenes }
                : null;

            const projectData = {
                name: this.projectName,
                projectId: this.currentProjectId,
                version: this.version,
                exportedAt: Date.now(),
                script: window.ScriptManager?.saveState ? window.ScriptManager.saveState() : null,
                characters: characters,
                storyboard: storyboard
            };

            const jsonStr = JSON.stringify(projectData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `${this.projectName}_${Date.now()}.json`;
            link.click();

            URL.revokeObjectURL(url);
            if (window.UI?.showToast) {
                window.UI.showToast('프로젝트를 내보냈습니다', 'success');
            }

        } catch (error) {
            console.error('❌ 내보내기 오류:', error);
            if (window.UI?.showToast) {
                window.UI.showToast('내보내기 중 오류가 발생했습니다', 'error');
            }
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
                if (window.UI?.showToast) {
                    window.UI.showToast('프로젝트를 가져왔습니다', 'success');
                }

            } catch (error) {
                console.error('❌ 가져오기 오류:', error);
                if (window.UI?.showToast) {
                    window.UI.showToast('가져오기 중 오류가 발생했습니다', 'error');
                }
            }
        });

        input.click();
    },

    // 프로젝트 목록 모달 열기
    openProjectListModal() {
        const modal = document.getElementById('project-list-modal');
        if (!modal) return;

        // 프로젝트 목록 렌더링
        const projects = window.ProjectManager?.getAllProjects ? window.ProjectManager.getAllProjects() : [];
        const listContainer = modal.querySelector('#project-list');

        if (!listContainer) return;

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
                            if (window.ProjectManager?.deleteProject) {
                                window.ProjectManager.deleteProject(index);
                            }
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

    // 대본 분석 - deprecated
    async analyzeScript() {
        console.warn('⚠️ App.analyzeScript()는 deprecated. ScriptManager.analyzeAllScripts() 사용');
        if (window.ScriptManager?.analyzeAllScripts) {
            await window.ScriptManager.analyzeAllScripts();
        }
    },

    // 모달 다운로드 처리
    handleModalDownload() {
        const modal = document.getElementById('image-detail-modal');
        const type = modal?.dataset.type;
        const id = modal?.dataset.id;
        const index = modal?.dataset.index;

        if (type === 'character' && index !== undefined && window.CharacterManager) {
            const characters = window.CharacterManager.state?.characters || window.CharacterManager.getCharacters?.() || [];
            const character = characters[parseInt(index)];
            if (character && window.CharacterManager.downloadCharacterImage) {
                window.CharacterManager.downloadCharacterImage(character);
            }
        } else if (type === 'scene' && id && window.StoryboardManager) {
            const scenes = window.StoryboardManager.state?.scenes || [];
            const scene = scenes.find(s => s.id === id);
            if (scene && window.StoryboardManager.downloadSceneImage) {
                window.StoryboardManager.downloadSceneImage(scene);
            }
        }
    },

    // 모달 재생성 처리
    async handleModalRegenerate() {
        const modal = document.getElementById('image-detail-modal');
        const type = modal?.dataset.type;
        const id = modal?.dataset.id;
        const index = modal?.dataset.index;

        if (type === 'character' && index !== undefined && window.CharacterManager) {
            if (window.CharacterManager.regenerateCharacter) {
                await window.CharacterManager.regenerateCharacter(parseInt(index));
            } else if (window.CharacterManager.generateCharacterImage) {
                const characters = window.CharacterManager.state?.characters || window.CharacterManager.getCharacters?.() || [];
                const character = characters[parseInt(index)];
                if (character) {
                    await window.CharacterManager.generateCharacterImage(character.id);
                }
            }
        } else if (type === 'scene' && id && window.StoryboardManager) {
            if (window.StoryboardManager.regenerateScene) {
                await window.StoryboardManager.regenerateScene(id);
            }
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
            if (window.UI?.showToast) {
                window.UI.showToast('수정 요청사항을 입력하세요', 'error');
            }
            return;
        }

        const editText = editRequest.value.trim();

        const modalImage = document.getElementById('modal-image');
        const promptEn = document.getElementById('modal-prompt-en');
        const promptKo = document.getElementById('modal-prompt-ko');

        if (!modalImage || !modalImage.src || !promptEn) {
            if (window.UI?.showToast) {
                window.UI.showToast('이미지 또는 프롬프트를 찾을 수 없습니다', 'error');
            }
            return;
        }

        const originalPrompt = promptEn.value;

        if (window.UI?.showToast) {
            window.UI.showToast('이미지 수정 중...', 'info');
        }

        try {
            // 타입별로 기존 seed 정보 가져오기
            let existingSeed = null;
            let existingImageBase64 = null;
            
            if (type === 'character' && index !== undefined && window.CharacterManager) {
                const characters = window.CharacterManager.state?.characters || window.CharacterManager.getCharacters?.() || [];
                const character = characters[parseInt(index)];
                existingSeed = character?.seed;
                existingImageBase64 = character?.imageBase64;
            } else if (type === 'scene' && id && window.StoryboardManager) {
                const scenes = window.StoryboardManager.state?.scenes || [];
                const scene = scenes.find(s => s.id === id);
                existingSeed = scene?.seed;
                existingImageBase64 = scene?.imageBase64;
            }

            // text-to-image 방식으로 이미지 수정 (기존 이미지 참조)
            if (!window.API?.editImageLocal) {
                throw new Error('API.editImageLocal이 정의되지 않았습니다');
            }

            const editedImageUrl = await window.API.editImageLocal(
                originalPrompt,
                editText,
                {
                    aspectRatio: window.CharacterManager?.state?.currentAspectRatio || '1:1',
                    seed: existingSeed,
                    keepSeed: !!editText,
                    imageBase64: existingImageBase64
                }
            );

            // 최종 프롬프트 (히스토리 기록용)
            const finalPrompt = editText
                ? `${originalPrompt}. Additional modification: ${editText}`
                : originalPrompt;

            // 새 이미지의 imageBase64 추출
            const newImageBase64 = editedImageUrl.startsWith('data:image/')
                ? editedImageUrl.replace(/^data:image\/\w+;base64,/, '')
                : null;

            // 타입별 데이터 저장 및 히스토리 추가
            if (type === 'character' && index !== undefined && window.CharacterManager) {
                const characters = window.CharacterManager.state?.characters || [];
                const character = characters[parseInt(index)];

                if (character) {
                    // 히스토리 추가
                    const version = (character.history?.length || 0) + 1;
                    if (!character.history) character.history = [];
                    character.history.push({
                        version: version,
                        imageUrl: editedImageUrl,
                        promptKo: `수정됨: ${editText}`,
                        promptEn: finalPrompt,
                        timestamp: Date.now()
                    });

                    // 메인 이미지 업데이트
                    character.imageUrl = editedImageUrl;
                    character.imageBase64 = newImageBase64;
                    character.promptEn = finalPrompt;

                    // IndexedDB에 수정된 이미지 저장
                    if (window.ImageStore && newImageBase64) {
                        window.ImageStore.saveImage(character.id, newImageBase64, editedImageUrl)
                            .catch(err => console.warn('[App] IndexedDB 캐릭터 이미지 저장 실패:', err));
                    }

                    // UI 업데이트
                    if (window.CharacterManager.render) {
                        window.CharacterManager.render();
                    } else if (window.CharacterManager.renderCharacters) {
                        window.CharacterManager.renderCharacters();
                    }
                    
                    if (window.CharacterManager.renderCharacterHistory) {
                        window.CharacterManager.renderCharacterHistory(character);
                    }
                }

            } else if (type === 'scene' && id && window.StoryboardManager) {
                const scenes = window.StoryboardManager.state?.scenes || [];
                const scene = scenes.find(s => s.id === id);

                if (scene) {
                    // 히스토리 추가
                    const version = (scene.history?.length || 0) + 1;
                    if (!scene.history) scene.history = [];
                    scene.history.push({
                        version: version,
                        imageUrl: editedImageUrl,
                        promptKo: `수정됨: ${editText}`,
                        promptEn: finalPrompt,
                        timestamp: Date.now()
                    });

                    // 메인 이미지 업데이트
                    scene.imageUrl = editedImageUrl;
                    scene.imageBase64 = newImageBase64;
                    scene.promptEn = finalPrompt;

                    // IndexedDB에 수정된 이미지 저장
                    if (window.ImageStore && newImageBase64) {
                        window.ImageStore.saveImage(scene.id, newImageBase64, editedImageUrl)
                            .catch(err => console.warn('[App] IndexedDB 장면 이미지 저장 실패:', err));
                    }

                    // UI 업데이트
                    if (window.StoryboardManager.render) {
                        window.StoryboardManager.render();
                    } else if (window.StoryboardManager.renderScenes) {
                        window.StoryboardManager.renderScenes();
                    }
                    
                    if (window.StoryboardManager.renderSceneHistory) {
                        window.StoryboardManager.renderSceneHistory(scene);
                    }
                }
            }

            // 모달 이미지 및 프롬프트 업데이트
            modalImage.src = editedImageUrl;
            promptEn.value = finalPrompt;
            if (promptKo) promptKo.value = `수정됨: ${editText}`;

            if (window.UI?.showToast) {
                window.UI.showToast('✅ 이미지 수정 완료!', 'success');
            }
            editRequest.value = '';

        } catch (error) {
            console.error('❌ 이미지 수정 실패:', error);
            if (window.UI?.showToast) {
                window.UI.showToast(`이미지 수정 실패: ${error.message}`, 'error');
            }
        }
    },

    // 자동 저장
    autoSave() {
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this.saveProject();
        }, 3000);
    },

    // 마지막 프로젝트 복원
    restoreLastProject() {
        const darkMode = localStorage.getItem('darkMode');
        if (darkMode === 'false') {
            this.toggleDarkMode();
        }

        // 마지막 프로젝트 복원 시도
        let lastProject = null;
        
        if (window.ProjectManager?.getLastProject) {
            lastProject = window.ProjectManager.getLastProject();
        } else {
            // ProjectManager 없으면 localStorage에서 직접 로드
            const savedProject = localStorage.getItem('lastProject');
            if (savedProject) {
                try {
                    lastProject = JSON.parse(savedProject);
                } catch (e) {
                    console.warn('마지막 프로젝트 파싱 실패:', e);
                }
            }
        }

        if (lastProject) {
            console.log('📂 마지막 프로젝트 복원:', lastProject.name);
            this.loadProject(lastProject);
        }
    },

    // 백엔드 연결 확인
    async checkBackendConnection() {
        try {
            const isConnected = window.API?.checkHealth ? await window.API.checkHealth() : false;

            if (isConnected) {
                console.log('✅ 백엔드 연결됨');
            } else {
                console.warn('⚠️ 백엔드 연결 실패 - 이미지 생성 기능 제한');
            }
        } catch (error) {
            console.warn('⚠️ 백엔드 연결 실패:', error.message);
        }
    },

    // ========== API 설정 모달 ==========

    /**
     * API 설정 모달 열기
     */
    async openApiSettingsModal() {
        const modal = document.getElementById('api-settings-modal');
        if (!modal) return;

        // 모든 탭 버튼
        const allTabs = modal.querySelectorAll('.api-tab');
        const vertexAiTab = modal.querySelector('[data-type="vertex_ai"]');
        const scriptAnalysisTab = modal.querySelector('[data-type="script_analysis"]');

        // 모든 폼 섹션
        const vertexAiForm = document.getElementById('vertex-ai-form');
        const scriptAnalysisForm = document.getElementById('script-analysis-form');

        // 탭 전환 함수
        const switchTab = (activeTab) => {
            // 모든 탭 비활성화
            allTabs.forEach(tab => tab.classList.remove('active'));
            // 선택한 탭 활성화
            activeTab.classList.add('active');

            // 모든 폼 숨기기
            if (vertexAiForm) vertexAiForm.style.display = 'none';
            if (scriptAnalysisForm) scriptAnalysisForm.style.display = 'none';

            // 선택한 폼 표시
            const tabType = activeTab.dataset.type;
            if (tabType === 'vertex_ai' && vertexAiForm) vertexAiForm.style.display = 'block';
            if (tabType === 'script_analysis' && scriptAnalysisForm) scriptAnalysisForm.style.display = 'block';
        };

        // 탭 클릭 이벤트
        allTabs.forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab));
        });

        // 기존 설정 로드
        await this.loadApiSettings();

        // 각 API별 저장 버튼 설정
        this.setupVertexAiSaveButton();
        this.setupGeminiSaveButton();

        // 각 API별 테스트 버튼 설정
        this.setupVertexAiTestButton();
        this.setupGeminiTestButton();

        // 상태 표시 업데이트
        await this.updateApiStatusDisplay();

        // 모달 닫기
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
            };
        }

        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };

        // 기본 탭 표시 (Vertex AI)
        if (vertexAiTab) {
            switchTab(vertexAiTab);
        }

        modal.style.display = 'flex';
    },

    // 기존 설정 로드
    async loadApiSettings() {
        const token = localStorage.getItem('auth_token');

        // 이미지 생성 API 설정 로드
        try {
            if (token) {
                const response = await fetch('/api/user/settings', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const settings = await response.json();

                    // Vertex AI Project ID 표시
                    const projectIdInput = document.getElementById('vertex-ai-project-id');
                    if (settings.projectId && projectIdInput) {
                        projectIdInput.value = settings.projectId;
                    }
                }
            }
        } catch (error) {
            console.warn('이미지 API 설정 로드 실패:', error);
        }

        // 대본 분석 API 설정 로드 (localStorage)
        const savedGeminiKey = localStorage.getItem('gemini_api_key');
        const geminiInput = document.getElementById('gemini-api-key-input');
        if (savedGeminiKey && geminiInput) {
            geminiInput.value = savedGeminiKey;
        }
    },

    // Vertex AI 저장 버튼
    setupVertexAiSaveButton() {
        const saveBtn = document.getElementById('save-vertex-ai-btn');
        if (!saveBtn) return;
        
        saveBtn.onclick = async () => {
            const projectIdInput = document.getElementById('vertex-ai-project-id');
            const projectId = projectIdInput ? projectIdInput.value.trim() : '';

            if (!projectId) {
                if (window.UI?.showToast) {
                    window.UI.showToast('Project ID를 입력해주세요', 'error');
                }
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = '💾 저장 중...';

            try {
                if (window.API?.saveImageApiSettings) {
                    await window.API.saveImageApiSettings('vertex_ai', 'service_account', projectId);
                }
                await this.updateApiStatusDisplay();
                if (window.UI?.showToast) {
                    window.UI.showToast('✅ Vertex AI 설정이 저장되었습니다', 'success');
                }
            } catch (error) {
                if (window.UI?.showToast) {
                    window.UI.showToast('❌ 저장 실패: ' + error.message, 'error');
                }
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 저장';
            }
        };
    },

    // Gemini 저장 버튼
    setupGeminiSaveButton() {
        const saveBtn = document.getElementById('save-gemini-btn');
        if (!saveBtn) return;
        
        saveBtn.onclick = () => {
            const geminiInput = document.getElementById('gemini-api-key-input');
            const geminiApiKey = geminiInput ? geminiInput.value.trim() : '';

            if (geminiApiKey) {
                localStorage.setItem('gemini_api_key', geminiApiKey);
                if (window.API) {
                    window.API.GEMINI_API_KEY = geminiApiKey;
                }
                if (window.UI?.showToast) {
                    window.UI.showToast('✅ Gemini API 키가 저장되었습니다', 'success');
                }
                console.log('✅ Gemini API 키 저장됨');
            } else {
                localStorage.removeItem('gemini_api_key');
                if (window.API) {
                    window.API.GEMINI_API_KEY = '';
                }
                if (window.UI?.showToast) {
                    window.UI.showToast('✅ Gemini API 키가 제거되었습니다', 'info');
                }
            }

            // 상태 표시 업데이트
            this.updateGeminiApiStatus();
        };
    },

    // Vertex AI 테스트 버튼
    setupVertexAiTestButton() {
        const testBtn = document.getElementById('test-vertex-ai-btn');
        const resultDiv = document.getElementById('vertex-ai-test-result');
        if (!testBtn) return;

        testBtn.onclick = async () => {
            const projectIdInput = document.getElementById('vertex-ai-project-id');
            const projectId = projectIdInput ? projectIdInput.value.trim() : '';

            if (!projectId) {
                if (window.UI?.showToast) {
                    window.UI.showToast('Project ID를 입력해주세요', 'error');
                }
                return;
            }

            testBtn.disabled = true;
            testBtn.textContent = '🔄 테스트 중...';
            if (resultDiv) resultDiv.style.display = 'none';

            try {
                // Project ID 형식 검증
                if (!/^[a-z0-9\-]+$/.test(projectId)) {
                    throw new Error('Project ID 형식이 올바르지 않습니다. 소문자, 숫자, 하이픈(-)만 사용 가능합니다.');
                }

                if (window.UI?.showToast) {
                    window.UI.showToast('✅ Project ID 형식 검증 완료', 'success');
                }
                if (resultDiv) {
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '<p style="color: #10b981;">✅ Project ID 형식이 올바릅니다. 저장 후 이미지 생성 시 서버의 Service Account 키로 인증됩니다.</p>';
                }
            } catch (error) {
                if (window.UI?.showToast) {
                    window.UI.showToast('❌ 테스트 실패', 'error');
                }
                if (resultDiv) {
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = `<p style="color: #ef4444;">❌ 실패: ${error.message}</p>`;
                }
            } finally {
                testBtn.disabled = false;
                testBtn.textContent = '🔌 연결 테스트';
            }
        };
    },

    // Gemini 테스트 버튼
    setupGeminiTestButton() {
        const testBtn = document.getElementById('test-gemini-btn');
        const resultDiv = document.getElementById('gemini-test-result');
        if (!testBtn) return;

        testBtn.onclick = async () => {
            const geminiInput = document.getElementById('gemini-api-key-input');
            const geminiApiKey = geminiInput ? geminiInput.value.trim() : '';

            if (!geminiApiKey) {
                if (window.UI?.showToast) {
                    window.UI.showToast('API 키를 입력해주세요', 'error');
                }
                return;
            }

            testBtn.disabled = true;
            testBtn.textContent = '🔄 테스트 중...';
            if (resultDiv) resultDiv.style.display = 'none';

            try {
                // Gemini API 테스트
                const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
                const response = await fetch(testUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'Hello' }] }]
                    })
                });

                if (response.ok) {
                    if (window.UI?.showToast) {
                        window.UI.showToast('✅ API 연결 성공!', 'success');
                    }
                    if (resultDiv) {
                        resultDiv.style.display = 'block';
                        resultDiv.innerHTML = '<p style="color: #10b981;">✅ 연결 성공! Gemini API가 정상적으로 작동합니다.</p>';
                    }
                } else {
                    const errorData = await response.json().catch(() => ({ error: { message: '알 수 없는 오류' } }));
                    const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
                    throw new Error(`${errorMsg} (상태 코드: ${response.status})`);
                }
            } catch (error) {
                if (window.UI?.showToast) {
                    window.UI.showToast('❌ API 연결 실패', 'error');
                }
                if (resultDiv) {
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = `<p style="color: #ef4444;">❌ 연결 실패: ${error.message}</p>`;
                }
            } finally {
                testBtn.disabled = false;
                testBtn.textContent = '🔌 연결 테스트';
            }
        };
    },

    /**
     * API 상태 표시 업데이트
     */
    async updateApiStatusDisplay() {
        await this.updateVertexAiStatus();
        this.updateGeminiApiStatus();
    },

    /**
     * Vertex AI 상태 표시 업데이트
     */
    async updateVertexAiStatus() {
        const statusDisplay = document.getElementById('vertex-ai-status-display');
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
                statusDisplay.innerHTML = `
                    <p class="status-configured">✅ Vertex AI 연결됨</p>
                    <p class="status-detail">이미지 생성용 API</p>
                    ${settings.projectId ? `<p class="status-detail">Project ID: ${settings.projectId}</p>` : ''}
                `;
            } else {
                statusDisplay.innerHTML = '<p class="status-not-configured">⚠️ Vertex AI 설정 필요</p>';
            }
        } catch (error) {
            console.error('Vertex AI 상태 표시 업데이트 실패:', error);
            statusDisplay.innerHTML = '<p class="status-not-configured">⚠️ Vertex AI 설정 필요</p>';
        }
    },

    /**
     * Gemini API 상태 표시 업데이트
     */
    updateGeminiApiStatus() {
        const statusDisplay = document.getElementById('gemini-api-status-display');
        if (!statusDisplay) return;

        const geminiApiKey = localStorage.getItem('gemini_api_key');

        if (geminiApiKey && geminiApiKey.trim()) {
            statusDisplay.innerHTML = `
                <p class="status-configured">✅ AI Studio 연결됨</p>
                <p class="status-detail">대본 분석용 Gemini API</p>
            `;
        } else {
            statusDisplay.innerHTML = `
                <p class="status-not-configured">⚠️ Gemini API 키 미설정</p>
                <p class="status-detail">규칙 기반 분석 사용 중</p>
            `;
        }
    }
};

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// 전역 함수로 노출
window.App = App;

// 🔥 전역 에러 캐치 (운영 안전망)
window.addEventListener('error', (e) => {
    console.error('🔥 Global Error:', e.error || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('🔥 Unhandled Promise Rejection:', e.reason);
});
