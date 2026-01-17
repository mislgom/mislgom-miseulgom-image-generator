/**
 * 미슬곰 이미지 자동 생성기 v1.0 - 프로젝트 관리 모듈
 * LocalStorage 기반 프로젝트 저장/불러오기
 */

const ProjectManager = {
    storageKey: 'miseulgom_projects',
    currentProjectKey: 'miseulgom_current_project',

    // 초기화
    init() {
        console.log('💾 ProjectManager 초기화');
    },

    // 프로젝트 저장
    saveProject(projectData) {
        try {
            // 현재 프로젝트로 설정
            localStorage.setItem(this.currentProjectKey, JSON.stringify(projectData));

            // 프로젝트 목록에 추가
            const projects = this.getAllProjects();
            
            // 같은 이름의 프로젝트가 있으면 업데이트
            const existingIndex = projects.findIndex(p => p.name === projectData.name);
            
            if (existingIndex >= 0) {
                projects[existingIndex] = projectData;
            } else {
                projects.push(projectData);
            }

            // 저장
            localStorage.setItem(this.storageKey, JSON.stringify(projects));

            console.log('💾 프로젝트 저장됨:', projectData.name);
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
