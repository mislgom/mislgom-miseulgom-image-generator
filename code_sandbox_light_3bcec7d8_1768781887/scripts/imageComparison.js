/**
 * 미슬곰 이미지 자동 생성기 v1.0 - 이미지 비교 모듈
 * 2-4개 이미지 선택 및 비교 뷰
 */

class ImageComparison {
    constructor() {
        this.selectedForComparison = [];
        this.MAX_COMPARE = 4;
    }

    /**
     * 비교할 이미지 추가
     */
    addToComparison(imageData) {
        if (this.selectedForComparison.length >= this.MAX_COMPARE) {
            window.UI.showToast(`최대 ${this.MAX_COMPARE}개까지만 비교할 수 있습니다.`, 'warning');
            return false;
        }
        
        // 이미 추가된 이미지인지 확인
        if (this.selectedForComparison.find(img => img.id === imageData.id)) {
            window.UI.showToast('이미 선택된 이미지입니다.', 'warning');
            return false;
        }
        
        this.selectedForComparison.push(imageData);
        window.UI.showToast(`비교 목록에 추가되었습니다 (${this.selectedForComparison.length}/${this.MAX_COMPARE})`, 'info');
        return true;
    }

    /**
     * 비교 모달 열기
     */
    openCompareModal() {
        if (this.selectedForComparison.length < 2) {
            window.UI.showToast('최소 2개 이상의 이미지를 선택해주세요.', 'warning');
            return;
        }
        
        const modal = document.getElementById('compare-modal');
        if (!modal) return;
        
        const compareLayout = modal.querySelector('.compare-layout');
        if (!compareLayout) return;
        
        // 비교 레이아웃 렌더링
        compareLayout.innerHTML = this.selectedForComparison.map((img, index) => `
            <div class="compare-item">
                <div class="compare-image-wrapper">
                    <img src="${img.imageUrl}" alt="${img.title}" class="compare-image">
                </div>
                <div class="compare-info">
                    <div class="compare-title">${img.title}</div>
                    <div class="compare-prompt">
                        <strong>프롬프트:</strong><br>
                        ${img.promptKr || '프롬프트 없음'}
                    </div>
                    ${img.modification ? `
                        <div class="compare-prompt" style="margin-top: 8px;">
                            <strong>수정사항:</strong><br>
                            ${img.modification}
                        </div>
                    ` : ''}
                </div>
                <button class="btn btn-secondary btn-small" style="width: 100%; margin-top: 8px;" onclick="window.imageComparison.removeFromComparison(${index})">
                    ❌ 제거
                </button>
            </div>
        `).join('');
        
        modal.classList.add('show');
    }

    /**
     * 비교 목록에서 제거
     */
    removeFromComparison(index) {
        if (index >= 0 && index < this.selectedForComparison.length) {
            this.selectedForComparison.splice(index, 1);
            
            if (this.selectedForComparison.length < 2) {
                // 2개 미만이면 모달 닫기
                window.UI.closeModal('compare-modal');
                window.UI.showToast('비교 모드가 종료되었습니다.', 'info');
            } else {
                // 모달 다시 열기 (업데이트)
                this.openCompareModal();
            }
        }
    }

    /**
     * 비교 목록 초기화
     */
    clearComparison() {
        this.selectedForComparison = [];
        window.UI.showToast('비교 목록이 초기화되었습니다.', 'info');
    }

    /**
     * 현재 비교 목록 가져오기
     */
    getComparisonList() {
        return this.selectedForComparison;
    }
}

// 전역으로 내보내기
window.ImageComparison = ImageComparison;
