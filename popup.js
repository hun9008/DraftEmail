// DraftMail Extension - Popup Script
console.log('🚀 DraftMail popup.js 시작');

// 전역 변수
let lastEmail = null;

// DOM 요소 선택 헬퍼
function $(id) {
  return document.getElementById(id);
}

// 메시지 전송 헬퍼
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || { ok: false, error: 'No response' });
    });
  });
}

function sendToActiveTab(message) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          resolve(response || { ok: false, error: 'No response' });
        });
      } else {
        resolve({ ok: false, error: 'No active tab' });
      }
    });
  });
}

// 상태 메시지 표시
function showStatus(message, type = 'info') {
  console.log(`📢 상태: ${message} (${type})`);
  const status = $('status');
  if (status) {
    status.textContent = message;
    status.className = `status ${type}`;
  } else {
    alert(`상태: ${message}`);
  }
}

// 미리보기 설정
function showPreview(email) {
  const preview = $('preview');
  if (preview && email?.subject && email?.body) {
    preview.innerHTML = `제목: ${email.subject}\n\n내용: ${email.body}`;
  } else if (preview) {
    preview.innerHTML = '';
  }
}

// 스타일 값 가져오기
function getSelectedStyles() {
  const checkboxes = document.querySelectorAll('.multiselect input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

// 모델 로드
async function loadModels() {
  console.log('📋 모델 로드 시작');
  
  const select = $('model');
  if (!select) {
    console.error('❌ 모델 선택 요소 없음');
    showStatus('❌ 모델 선택 요소를 찾을 수 없습니다', 'error');
    return;
  }

  console.log('✅ 모델 선택 요소 찾음');
  
  // 기본 옵션 추가
  select.innerHTML = '<option value="" disabled selected>모델을 선택하세요</option>';
  console.log('기본 옵션 추가됨');
  
  showStatus('🔄 Ollama 모델 로드 중...', 'info');
  
  // Ollama에서 실제 모델 가져오기
  try {
    console.log('Ollama API 호출 시작');
    const response = await sendMessage({ type: 'LIST_MODELS' });
    console.log('Ollama API 응답:', response);
    
    if (response?.ok && response.models?.length > 0) {
      console.log('실제 모델 발견, 모델 추가 시작');
      
      response.models.forEach((model, index) => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        select.appendChild(option);
        console.log(`실제 모델 ${index + 1} 추가: ${model.name}`);
      });
      
      console.log('실제 모델 추가 완료, select 자식 개수:', select.children.length);
      showStatus(`✅ ${response.models.length}개 모델 로드됨`, 'success');
    } else {
      console.log('실제 모델 없음, 테스트 모델 추가');
      
      // 테스트 모델 추가
      const testModels = [
        'llama3.2:latest',
        'qwen2.5:latest', 
        'gemma2:latest'
      ];
      
      testModels.forEach((name, index) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = `${name} (테스트)`;
        select.appendChild(option);
        console.log(`테스트 모델 ${index + 1} 추가: ${name}`);
      });
      
      showStatus('⚠️ Ollama 연결 실패. 테스트 모델 사용', 'warning');
    }
  } catch (error) {
    console.error('Ollama 연결 실패:', error);
    
    // 테스트 모델 추가
    const testModels = [
      'llama3.2:latest',
      'qwen2.5:latest', 
      'gemma2:latest'
    ];
    
    testModels.forEach((name, index) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = `${name} (테스트)`;
      select.appendChild(option);
      console.log(`테스트 모델 ${index + 1} 추가: ${name}`);
    });
    
    showStatus('⚠️ Ollama 연결 실패. 테스트 모델 사용', 'warning');
  }
  
  console.log('모델 로드 완료, 최종 select 자식 개수:', select.children.length);
}

// 이메일 생성
async function generateEmail() {
  console.log('✍️ 이메일 생성 시작');
  
  const modelSelect = $('model');
  const notesInput = $('notes');
  
  if (!modelSelect || !notesInput) {
    showStatus('❌ 페이지 로드 오류', 'error');
    return;
  }
  
  const selectedModel = modelSelect.value;
  const notes = notesInput.value.trim();
  
  if (!selectedModel) {
    showStatus('❌ 모델을 선택해주세요', 'error');
    return;
  }
  
  if (!notes) {
    showStatus('❌ 메모를 입력해주세요', 'error');
    return;
  }
  
  // UI 초기화
  lastEmail = null;
  showPreview(null);
  showStatus('🤖 AI가 이메일을 생성하고 있습니다...', 'info');
  
  // 설정 수집
  const categorySelect = $('category');
  const customCategory = $('customCategory');
  const category = categorySelect.value === 'custom' ? 
    (customCategory?.value.trim() || '') : 
    categorySelect.value;
  
  const payload = {
    model: selectedModel,
    category: category,
    notes: notes,
    styles: getSelectedStyles(),
    language: $('language').value,
    useGmailAPI: $('useGmailAPI').checked
  };
  
  console.log('생성 요청:', payload);
  
  try {
    const response = await sendMessage({ type: 'GENERATE_EMAIL', payload });
    console.log('생성 응답:', response);
    
    if (response?.ok && response.email) {
      lastEmail = response.email;
      showPreview(response.email);
      showStatus('✅ 이메일 생성 완료!', 'success');
      
      // 데이터 저장
      chrome.storage.local.set({
        lastGeneratedEmail: response.email,
        emailGeneratedAt: Date.now(),
        ...payload
      });
      
      // Gmail 페이지 확인
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url?.includes('mail.google.com')) {
          showStatus('✅ Gmail에서 "삽입" 버튼을 눌러주세요', 'success');
        } else {
          showStatus('✅ Gmail 페이지로 이동합니다...', 'success');
          setTimeout(() => openGmail(), 1500);
        }
      });
      
    } else {
      showStatus(`❌ 생성 실패: ${response?.error || '알 수 없는 오류'}`, 'error');
    }
  } catch (error) {
    console.error('생성 오류:', error);
    showStatus(`❌ 생성 실패: ${error.message}`, 'error');
  }
}

// Gmail 열기
function openGmail() {
  chrome.tabs.create({ url: 'https://mail.google.com/mail/u/0/#compose' }, (tab) => {
    if (lastEmail) {
      showStatus('Gmail 열림. 자동 삽입 시도 중...', 'info');
      
      // 탭 로드 완료 후 삽입 시도
      const checkTab = () => {
        chrome.tabs.get(tab.id, (tabInfo) => {
          if (tabInfo.status === 'complete') {
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { type: 'INSERT_EMAIL', payload: lastEmail }, (response) => {
                if (response?.ok) {
                  showStatus('🎉 Gmail에 자동 삽입 완료!', 'success');
                } else {
                  showStatus('❌ 자동 삽입 실패. 수동으로 삽입해주세요', 'error');
                }
              });
            }, 2000);
          } else {
            setTimeout(checkTab, 500);
          }
        });
      };
      checkTab();
    }
  });
}

// Gmail에 삽입
async function insertToGmail() {
  console.log('📧 Gmail 삽입 시작');
  
  if (!lastEmail) {
    showStatus('❌ 먼저 초안을 생성해주세요', 'error');
    return;
  }
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url?.includes('mail.google.com')) {
      showStatus('Gmail 페이지가 아닙니다. Gmail을 열어서 자동 삽입합니다...', 'info');
      setTimeout(() => openGmail(), 1000);
      return;
    }
    
    showStatus('Gmail에 삽입 중...', 'info');
    
    chrome.tabs.sendMessage(tabs[0].id, { type: 'INSERT_EMAIL', payload: lastEmail }, (response) => {
      if (response?.ok) {
        showStatus('🎉 Gmail에 삽입 완료!', 'success');
        
        // UI 초기화
        lastEmail = null;
        showPreview(null);
        $('notes').value = '';
        
        // 체크박스 초기화
        document.querySelectorAll('.multiselect input[type="checkbox"]').forEach(cb => cb.checked = false);
        
      } else {
        showStatus(`❌ 삽입 실패: ${response?.error || '알 수 없는 오류'}`, 'error');
      }
    });
  });
}

// 저장된 데이터 복원
async function restoreData() {
  try {
    const data = await chrome.storage.local.get([
      'lastGeneratedEmail', 
      'emailGeneratedAt',
      'category',
      'customCategory',
      'notes',
      'styles',
      'language',
      'useGmailAPI'
    ]);
    
    // 24시간 이내 데이터만 복원
    if (data.lastGeneratedEmail && data.emailGeneratedAt && 
        (Date.now() - data.emailGeneratedAt) < 24 * 60 * 60 * 1000) {
      
      lastEmail = data.lastGeneratedEmail;
      showPreview(data.lastGeneratedEmail);
      
      // 입력 필드 복원
      if (data.category) {
        $('category').value = data.category;
        if (data.category === 'custom' && data.customCategory) {
          $('customCategory').style.display = 'block';
          $('customCategory').value = data.customCategory;
        }
      }
      
      if (data.notes) $('notes').value = data.notes;
      if (data.language) $('language').value = data.language;
      if (data.useGmailAPI !== undefined) $('useGmailAPI').checked = data.useGmailAPI;
      
      if (data.styles) {
        data.styles.forEach(style => {
          const checkbox = document.querySelector(`input[value="${style}"]`);
          if (checkbox) checkbox.checked = true;
        });
      }
      
      showStatus('이전 데이터 복원됨', 'info');
      
      // Gmail 페이지에서 자동 삽입 시도
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url?.includes('mail.google.com')) {
          setTimeout(() => insertToGmail(), 2000);
        } else {
          setTimeout(() => openGmail(), 1000);
        }
      });
      
      return true;
    }
  } catch (error) {
    console.error('데이터 복원 실패:', error);
  }
  return false;
}

// 모든 입력 초기화
function resetAll() {
  console.log('🔄 모든 입력 초기화');
  
  lastEmail = null;
  showPreview(null);
  
  // 입력 필드 초기화
  $('model').selectedIndex = 0;
  $('category').value = '교수님';
  $('customCategory').style.display = 'none';
  $('customCategory').value = '';
  $('notes').value = '';
  $('language').value = '한국어';
  $('useGmailAPI').checked = false;
  $('appendSignature').checked = false;
  
  // 체크박스 초기화
  document.querySelectorAll('.multiselect input[type="checkbox"]').forEach(cb => cb.checked = false);
  
  // 저장된 데이터 삭제
  chrome.storage.local.remove([
    'lastGeneratedEmail',
    'emailGeneratedAt',
    'category',
    'customCategory',
    'notes',
    'styles',
    'language',
    'useGmailAPI'
  ]);
  
  showStatus('✅ 모든 입력이 초기화되었습니다', 'success');
}

// 이벤트 리스너 설정
function setupEvents() {
  console.log('🔗 이벤트 리스너 설정');
  
  // 버튼 이벤트
  $('refreshModels')?.addEventListener('click', loadModels);
  $('generate')?.addEventListener('click', generateEmail);
  $('insert')?.addEventListener('click', insertToGmail);
  $('reset')?.addEventListener('click', resetAll);
  $('openOptions')?.addEventListener('click', () => chrome.runtime.openOptionsPage());
  
  // 카테고리 변경 이벤트
  $('category')?.addEventListener('change', function() {
    const customInput = $('customCategory');
    if (this.value === 'custom') {
      customInput.style.display = 'block';
      customInput.focus();
    } else {
      customInput.style.display = 'none';
      customInput.value = '';
    }
  });
}

// 초기화
async function init() {
  console.log('🚀 초기화 시작');
  
  try {
    console.log('이벤트 리스너 설정');
    setupEvents();
    
    console.log('모델 로드 시작');
    await loadModels();
    
    console.log('데이터 복원 시작');
    await restoreData();
    
    showStatus('DraftMail 준비 완료!', 'info');
    console.log('✅ 초기화 완료');
  } catch (error) {
    console.error('초기화 실패:', error);
    showStatus('초기화 실패: ' + error.message, 'error');
  }
}

// 실행
console.log('📱 스크립트 로드됨');

// 즉시 실행
console.log('즉시 초기화 실행');
init();

// DOM 로드 후 재실행 (안전장치)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded - 재초기화');
    init();
  });
}

// 추가 안전장치 - 2초 후 모델 확인
setTimeout(() => {
  console.log('안전장치 실행 - 모델 상태 확인');
  const select = $('model');
  console.log('select 요소:', select);
  console.log('select 자식 개수:', select?.children.length);
  
  if (select && select.children.length <= 1) {
    console.log('⚠️ 모델이 로드되지 않음, 강제 로드');
    loadModels();
  } else if (select && select.children.length > 1) {
    console.log('✅ 모델이 정상적으로 로드됨');
  }
}, 2000);