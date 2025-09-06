// DraftMail Extension - Popup Script
console.log('DraftMail popup.js 로드됨');

// DOM 요소 선택 헬퍼
const $ = (selector) => document.querySelector(selector);

// 전역 변수
let lastEmail = null;
let cachedSignature = '';
let autoAppendSignature = false;

// 메시지 전송 헬퍼
async function sendMessage(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

async function sendToActiveTab(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  return new Promise(resolve => chrome.tabs.sendMessage(tab.id, msg, resolve));
}

// 상태 메시지 표시
function setStatus(message, type = 'info') {
  console.log('상태 메시지:', message, type);
  const status = document.getElementById('status');
  if (status) {
    status.textContent = message;
    status.className = `status ${type}`;
  } else {
    console.error('상태 요소를 찾을 수 없습니다');
    alert(`상태: ${message}`);
  }
}

// 미리보기 설정
function setPreview(email) {
  const preview = document.getElementById('preview');
  if (!preview || !email || !email.subject || !email.body) {
    if (preview) preview.innerHTML = '';
    return;
  }
  
  preview.innerHTML = `제목: ${email.subject}\n\n내용: ${email.body}`;
}

// 스타일 체크박스 값 가져오기
function getStyles() {
  return Array.from(document.querySelectorAll('.multiselect input[type="checkbox"]:checked'))
    .map(x => x.value);
}

// 모델 목록 로드
async function loadModels() {
  console.log('모델 로드 시작');
  try {
    const resp = await sendMessage({ type: 'LIST_MODELS' });
    const select = document.getElementById('model');
    if (!select) {
      console.error('모델 선택 요소를 찾을 수 없습니다');
      return;
    }
    
    select.innerHTML = '';
    
    if (resp?.ok && resp.models?.length > 0) {
      resp.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        select.appendChild(option);
      });
      console.log('모델 로드 완료:', resp.models.length, '개');
    } else {
      const option = document.createElement('option');
      option.value = 'no-models';
      option.textContent = '설치된 모델이 없습니다';
      select.appendChild(option);
      console.log('설치된 모델이 없습니다');
    }
  } catch (error) {
    console.error('모델 로드 실패:', error);
    setStatus('모델 로드 실패: ' + error.message, 'error');
  }
}

// 스레드 fewshots 가져오기
async function getThreadFewshots() {
  try {
    const resp = await sendToActiveTab({ type: 'GET_THREAD_FEWSHOTS' });
    return resp?.fewshots || [];
  } catch (error) {
    console.log('스레드 fewshots 가져오기 실패:', error);
    return [];
  }
}

// 이메일 생성
async function generate() {
  console.log('이메일 생성 시작');
  
  const modelSelect = document.getElementById('model');
  const notesInput = document.getElementById('notes');
  
  if (!modelSelect || !notesInput) {
    console.error('필수 요소를 찾을 수 없습니다');
    setStatus('페이지 로드 오류', 'error');
    return;
  }
  
  const selectedModel = modelSelect.value;
  const notes = notesInput.value.trim();
  
  if (!selectedModel || selectedModel.includes('오류:') || selectedModel.includes('설치된 모델이 없습니다')) {
    setStatus('유효한 모델을 선택해주세요.', 'error');
    return;
  }
  
  if (!notes) {
    setStatus('메모를 입력해주세요.', 'error');
    return;
  }
  
  // 이전 데이터 정리
  lastEmail = null;
  const preview = document.getElementById('preview');
  if (preview) preview.innerHTML = '';
  
  setStatus('AI가 이메일을 생성하고 있습니다...', 'info');
  
  // 설정값 불러오기
  const settings = await chrome.storage.sync.get({
    defaultStyles: [],
    signature: '',
    autoAppendSignature: false
  });
  
  cachedSignature = settings.signature || '';
  autoAppendSignature = !!settings.autoAppendSignature;
  
  // 카테고리 처리
  const categorySelect = document.getElementById('category');
  const customCategory = document.getElementById('customCategory');
  const category = categorySelect.value === 'custom' ? 
    (customCategory ? customCategory.value.trim() : '') : 
    categorySelect.value;
  
  const payload = {
    model: selectedModel,
    category: category,
    notes: notes,
    styles: Array.from(new Set([...(settings.defaultStyles || []), ...getStyles()])),
    language: document.getElementById('language').value,
    useGmailAPI: document.getElementById('useGmailAPI').checked,
    threadFewshots: await getThreadFewshots()
  };
  
  try {
    const resp = await sendMessage({ type: 'GENERATE_EMAIL', payload });
    if (!resp?.ok) {
      setStatus('오류: ' + (resp?.error || 'unknown'), 'error');
      return;
    }
    
    lastEmail = resp.email;
    setPreview(resp.email);
    
    // 저장
    await chrome.storage.local.set({ 
      lastGeneratedEmail: resp.email,
      emailGeneratedAt: Date.now(),
      category: category,
      customCategory: customCategory ? customCategory.value.trim() : '',
      notes: notes,
      styles: getStyles(),
      language: document.getElementById('language').value,
      useGmailAPI: document.getElementById('useGmailAPI').checked
    });
    
    // Gmail 페이지 확인
    const isGmail = await checkIfGmailPage();
    if (isGmail) {
      setStatus('✅ 이메일 생성 완료! "Gmail에 삽입"을 눌러주세요.', 'success');
    } else {
      setStatus('✅ 이메일 생성 완료! Gmail 페이지로 이동합니다...', 'success');
      setTimeout(() => openGmailCompose(), 1500);
    }
    
    // 선호 모델 저장
    chrome.storage.sync.set({ prefModel: payload.model });
    
  } catch (error) {
    console.error('이메일 생성 실패:', error);
    setStatus('❌ 생성 실패: ' + error.message, 'error');
  }
}

// Gmail 페이지 확인
async function checkIfGmailPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.url?.includes('mail.google.com');
  } catch {
    return false;
  }
}

// Gmail 컴포즈 열기
async function openGmailCompose() {
  try {
    const tab = await chrome.tabs.create({ url: 'https://mail.google.com/mail/u/0/#compose' });
    
    if (lastEmail) {
      setStatus('Gmail 컴포즈 페이지를 열었습니다. 자동으로 이메일을 삽입합니다...', 'info');
      
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { type: 'INSERT_EMAIL', payload: lastEmail })
              .then(resp => {
                if (resp?.ok) {
                  setStatus('🎉 Gmail에 성공적으로 삽입되었습니다!', 'success');
                } else {
                  setStatus('❌ 자동 삽입 실패: ' + (resp?.error || '알 수 없는 오류'), 'error');
                }
              })
              .catch(error => {
                console.error('자동 삽입 실패:', error);
                setStatus('❌ 자동 삽입 실패: ' + error.message, 'error');
              });
          }, 3000);
        }
      });
    } else {
      setStatus('Gmail 컴포즈 페이지를 열었습니다. 먼저 초안을 생성해주세요.', 'info');
    }
  } catch (error) {
    setStatus('❌ Gmail 열기 실패: ' + error.message, 'error');
  }
}

// Gmail에 삽입
async function insertIntoGmail() {
  console.log('Gmail 삽입 시작');
  
  if (!lastEmail) {
    setStatus('먼저 초안을 생성해주세요.', 'warning');
    return;
  }
  
  const isGmail = await checkIfGmailPage();
  if (!isGmail) {
    setStatus('Gmail 페이지가 아닙니다. Gmail을 열어서 자동 삽입합니다...', 'info');
    setTimeout(() => openGmailCompose(), 1000);
    return;
  }
  
  // 서명 추가
  const wantSig = document.getElementById('appendSignature').checked || autoAppendSignature;
  const email = { ...lastEmail };
  if (wantSig && cachedSignature) {
    email.body = `${email.body}\n\n${cachedSignature}`;
  }
  
  try {
    setStatus('Gmail에 삽입 중...', 'info');
    const resp = await sendToActiveTab({ type: 'INSERT_EMAIL', payload: email });
    
    if (resp?.ok) {
      setStatus('🎉 Gmail에 성공적으로 삽입되었습니다!', 'success');
      
      // UI 초기화
      lastEmail = null;
      const preview = document.getElementById('preview');
      if (preview) preview.innerHTML = '';
      
      // 입력 필드 초기화
      const notesInput = document.getElementById('notes');
      if (notesInput) notesInput.value = '';
      
      const categorySelect = document.getElementById('category');
      if (categorySelect) categorySelect.value = '교수님';
      
      const customCategory = document.getElementById('customCategory');
      if (customCategory) {
        customCategory.style.display = 'none';
        customCategory.value = '';
      }
      
      const languageSelect = document.getElementById('language');
      if (languageSelect) languageSelect.value = '한국어';
      
      const useGmailAPI = document.getElementById('useGmailAPI');
      if (useGmailAPI) useGmailAPI.checked = false;
      
      // 스타일 체크박스 초기화
      document.querySelectorAll('.multiselect input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
      });
      
    } else {
      const errorMsg = resp?.error || '알 수 없는 오류';
      setStatus('❌ 삽입 실패: ' + errorMsg, 'error');
    }
  } catch (error) {
    setStatus('❌ 삽입 실패: ' + error.message, 'error');
  }
}

// 저장된 이메일 복원
async function restoreLastEmail() {
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
    
    // 24시간 이내에 생성된 이메일만 복원
    if (data.lastGeneratedEmail && data.emailGeneratedAt && 
        (Date.now() - data.emailGeneratedAt) < 24 * 60 * 60 * 1000) {
      
      lastEmail = data.lastGeneratedEmail;
      
      // 입력 정보 복원
      if (data.category) {
        const categorySelect = document.getElementById('category');
        if (categorySelect) {
          if (data.category === 'custom' || data.customCategory) {
            categorySelect.value = 'custom';
            const customCategory = document.getElementById('customCategory');
            if (customCategory) {
              customCategory.style.display = 'block';
              if (data.customCategory) customCategory.value = data.customCategory;
            }
          } else {
            categorySelect.value = data.category;
          }
        }
      }
      
      if (data.notes) {
        const notesInput = document.getElementById('notes');
        if (notesInput) notesInput.value = data.notes;
      }
      
      if (data.language) {
        const languageSelect = document.getElementById('language');
        if (languageSelect) languageSelect.value = data.language;
      }
      
      if (data.useGmailAPI !== undefined) {
        const useGmailAPI = document.getElementById('useGmailAPI');
        if (useGmailAPI) useGmailAPI.checked = data.useGmailAPI;
      }
      
      // 스타일 체크박스 복원
      if (data.styles && Array.isArray(data.styles)) {
        document.querySelectorAll('.multiselect input[type="checkbox"]').forEach(checkbox => {
          checkbox.checked = data.styles.includes(checkbox.value);
        });
      }
      
      setPreview(data.lastGeneratedEmail);
      setStatus('이전에 생성된 이메일을 복원했습니다.', 'info');
      
      // Gmail 페이지인지 확인하고 자동 삽입 시도
      const isGmail = await checkIfGmailPage();
      if (isGmail) {
        setStatus('Gmail 페이지에서 이메일을 자동 삽입합니다...', 'info');
        setTimeout(() => insertIntoGmail(), 2000);
      } else {
        setStatus('Gmail 페이지로 이동하여 자동 삽입합니다...', 'info');
        setTimeout(() => openGmailCompose(), 1000);
      }
      return true;
    }
  } catch (error) {
    console.log('저장된 이메일 복원 실패:', error);
  }
  return false;
}

// 초기화
async function initializePopup() {
  console.log('팝업 초기화 시작');
  
  try {
    await loadModels();
    await restoreLastEmail();
    
    // Gmail이 아닌 페이지에서 이메일이 복원되지 않은 경우
    const isGmail = await checkIfGmailPage();
    const preview = document.getElementById('preview');
    const hasPreview = preview && preview.textContent.trim();
    
    if (!isGmail && !hasPreview) {
      setStatus('Gmail에서 사용하거나 "초안 생성" 버튼을 눌러주세요.', 'info');
    }
    
    console.log('팝업 초기화 완료');
  } catch (error) {
    console.error('팝업 초기화 실패:', error);
    setStatus('초기화 실패: ' + error.message, 'error');
  }
}

// 이벤트 리스너 설정
function setupEventListeners() {
  console.log('이벤트 리스너 설정 시작');
  
  // 새로고침 버튼
  const refreshBtn = document.getElementById('refreshModels');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadModels);
    console.log('새로고침 버튼 이벤트 리스너 설정');
  }
  
  // 생성 버튼
  const generateBtn = document.getElementById('generate');
  if (generateBtn) {
    generateBtn.addEventListener('click', generate);
    console.log('생성 버튼 이벤트 리스너 설정');
  }
  
  // 삽입 버튼
  const insertBtn = document.getElementById('insert');
  if (insertBtn) {
    insertBtn.addEventListener('click', insertIntoGmail);
    console.log('삽입 버튼 이벤트 리스너 설정');
  }
  
  // 설정 버튼
  const optionsBtn = document.getElementById('openOptions');
  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
    console.log('설정 버튼 이벤트 리스너 설정');
  }
  
  // 카테고리 선택 이벤트
  const categorySelect = document.getElementById('category');
  if (categorySelect) {
    categorySelect.addEventListener('change', function() {
      const customInput = document.getElementById('customCategory');
      if (this.value === 'custom') {
        if (customInput) {
          customInput.style.display = 'block';
          customInput.focus();
        }
      } else {
        if (customInput) {
          customInput.style.display = 'none';
          customInput.value = '';
        }
      }
    });
    console.log('카테고리 선택 이벤트 리스너 설정');
  }
  
  console.log('이벤트 리스너 설정 완료');
}

// 메인 실행
console.log('스크립트 실행 시작');

// 즉시 실행
setupEventListeners();
initializePopup();

console.log('스크립트 로드 완료');