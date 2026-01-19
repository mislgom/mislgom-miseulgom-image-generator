/**
 * 미슬곰 이미지 자동 생성기 v1.0 - UI 관리 모듈
 * Toast 알림, 진행률, 모달 등 UI 요소 관리
 */

const UI = {
    // 초기화
    init() {
        console.log('🎨 UI 모듈 초기화');
        this.createToastContainer();
    },

    // Toast 컨테이너 생성
    createToastContainer() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    },

    // Toast 알림 표시
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // 아이콘 선택
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // 애니메이션
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // 자동 제거
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    },

    // 진행률 표시
    showProgress(title, current, total) {
        const section = document.getElementById('progress-section');
        const titleEl = document.getElementById('progress-title');
        const percentageEl = document.getElementById('progress-percentage');
        const fillEl = document.getElementById('progress-fill');
        const textEl = document.getElementById('progress-text');

        if (section) {
            section.style.display = 'block';
        }

        if (titleEl) {
            titleEl.textContent = title;
        }

        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

        if (percentageEl) {
            percentageEl.textContent = `${percentage}%`;
        }

        if (fillEl) {
            fillEl.style.width = `${percentage}%`;
        }

        if (textEl) {
            textEl.textContent = `${current} / ${total}`;
        }
    },

    // 진행률 업데이트
    updateProgress(current, total) {
        const percentageEl = document.getElementById('progress-percentage');
        const fillEl = document.getElementById('progress-fill');
        const textEl = document.getElementById('progress-text');

        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

        if (percentageEl) {
            percentageEl.textContent = `${percentage}%`;
        }

        if (fillEl) {
            fillEl.style.width = `${percentage}%`;
        }

        if (textEl) {
            textEl.textContent = `${current} / ${total}`;
        }
    },

    // 진행률 숨기기
    hideProgress() {
        const section = document.getElementById('progress-section');
        if (section) {
            section.style.display = 'none';
        }
    },

    // 로딩 오버레이 표시
    showLoading(message = '처리 중...') {
        let overlay = document.getElementById('loading-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <p class="loading-message">${message}</p>
            `;
            document.body.appendChild(overlay);
        } else {
            const messageEl = overlay.querySelector('.loading-message');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }

        overlay.style.display = 'flex';
    },

    // 로딩 오버레이 숨기기
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    },

    // 확인 대화상자
    confirm(message, onConfirm, onCancel) {
        const result = window.confirm(message);
        if (result && onConfirm) {
            onConfirm();
        } else if (!result && onCancel) {
            onCancel();
        }
        return result;
    },

    // 프롬프트 대화상자
    prompt(message, defaultValue = '', onConfirm) {
        const result = window.prompt(message, defaultValue);
        if (result && onConfirm) {
            onConfirm(result);
        }
        return result;
    },

    // 모달 열기
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    // 모달 닫기
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    // 모든 모달 닫기
    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    },

    // 버튼 활성화/비활성화
    setButtonEnabled(buttonId, enabled) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = !enabled;
        }
    },

    // 요소 표시/숨기기
    toggleElement(elementId, show) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = show ? 'block' : 'none';
        }
    },

    // 텍스트 업데이트
    updateText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    },

    // HTML 업데이트
    updateHTML(elementId, html) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = html;
        }
    },

    // 값 업데이트
    updateValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.value = value;
        }
    },

    // 클래스 추가
    addClass(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add(className);
        }
    },

    // 클래스 제거
    removeClass(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove(className);
        }
    },

    // 클래스 토글
    toggleClass(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.toggle(className);
        }
    },

    // 스크롤 최상단으로
    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    },

    // 요소로 스크롤
    scrollToElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    },

    // 입력 포커스
    focusElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.focus();
        }
    },

    // 엘리먼트 블러
    blurElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.blur();
        }
    },

    // 애니메이션 클래스 추가 (일시적)
    animateElement(elementId, animationClass, duration = 1000) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add(animationClass);
            setTimeout(() => {
                element.classList.remove(animationClass);
            }, duration);
        }
    },

    // 로딩 상태 설정
    setLoading(elementId, loading) {
        const element = document.getElementById(elementId);
        if (element) {
            if (loading) {
                element.classList.add('loading');
                element.disabled = true;
            } else {
                element.classList.remove('loading');
                element.disabled = false;
            }
        }
    },

    // 에러 메시지 표시
    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            let errorEl = element.querySelector('.error-message');
            if (!errorEl) {
                errorEl = document.createElement('div');
                errorEl.className = 'error-message';
                element.appendChild(errorEl);
            }
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    },

    // 에러 메시지 숨기기
    hideError(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            const errorEl = element.querySelector('.error-message');
            if (errorEl) {
                errorEl.style.display = 'none';
            }
        }
    }
};

// 전역 함수로 노출
window.UI = UI;
