/**
 * 미슬곰 이미지 자동 생성기 v1.1 - 프로젝트 관리 모듈
 * LocalStorage 기반 프로젝트 저장/불러오기
 * v1.1: projectId(불변 식별자) 추가 - 캐릭터 외형 일관성/프로젝트 분리용
 */

const ProjectManager = {
    storageKey: 'miseulgom_projects',
    currentProjectKey: 'miseulgom_current_project',

    // 초기화
    init() {
        console.log('💾 ProjectManager 초기화');
    },

    // 불변 projectId 생성 (프로젝트당 1회만 호출)
    generateProjectId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // fallback: 브라우저가 randomUUID를 지원하지 않는 경우
        return 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    },

    // 프로젝트 저장
    saveProject(projectData) {
        try {
            // projectId가 없으면 새로 생성 (최초 저장 시 1회)
            if (!projectData.projectId) {
                projectData.projectId = this.generateProjectId();
                console.log('🆔 새 projectId 생성:', projectData.projectId);
            }

            // 현재 프로젝트로 설정
            localStorage.setItem(this.currentProjectKey, JSON.stringify(projectData));

            // 프로젝트 목록에 추가
            const projects = this.getAllProjects();

            // projectId 기준으로 기존 프로젝트 찾기 (이름 변경에도 동일 프로젝트 인식)
            let existingIndex = projects.findIndex(p => p.projectId && p.projectId === projectData.projectId);

            // projectId로 못 찾으면 이름으로 폴백 (기존 데이터 호환)
            if (existingIndex < 0) {
                existingIndex = projects.findIndex(p => !p.projectId && p.name === projectData.name);
            }

            if (existingIndex >= 0) {
                projects[existingIndex] = projectData;
            } else {
                projects.push(projectData);
            }

            // 저장
            localStorage.setItem(this.storageKey, JSON.stringify(projects));

            console.log('💾 프로젝트 저장됨:', projectData.name, '(id:', projectData.projectId, ')');
            return true;

        } catch (error) {
            console.error('❌ 프로젝트 저장 오류:', error);
            throw error;
        }
    },

    // 모든 프로젝트 가져오기
    getAllProjects() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ 프로젝트 목록 읽기 오류:', error);
            return [];
        }
    },

    // 마지막 프로젝트 가져오기
    getLastProject() {
        try {
            const data = localStorage.getItem(this.currentProjectKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('❌ 마지막 프로젝트 읽기 오류:', error);
            return null;
        }
    },

    // 프로젝트 삭제
    deleteProject(index) {
        try {
            const projects = this.getAllProjects();
            
            if (index >= 0 && index < projects.length) {
                projects.splice(index, 1);
                localStorage.setItem(this.storageKey, JSON.stringify(projects));
                console.log('🗑️ 프로젝트 삭제됨');
                return true;
            }

            return false;

        } catch (error) {
            console.error('❌ 프로젝트 삭제 오류:', error);
            throw error;
        }
    }
};

// 전역 함수로 노출
window.ProjectManager = ProjectManager;
