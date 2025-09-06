// DraftMail Extension - Content Script
console.log('🚀 DraftMail contentScript.js 시작');

// Gmail 컴포즈 요소 찾기
function findComposeElements() {
  console.log('🔍 Gmail 컴포즈 요소 검색');
  
  // 제목 필드 찾기
  const subjectSelectors = [
    'input[name="subjectbox"]',
    'input[aria-label*="제목"]',
    'input[aria-label*="Subject"]',
    'input[placeholder*="제목"]',
    'input[placeholder*="Subject"]',
    'div[contenteditable="true"][aria-label*="제목"]',
    'div[contenteditable="true"][aria-label*="Subject"]'
  ];
  
  let subject = null;
  for (const selector of subjectSelectors) {
    subject = document.querySelector(selector);
    if (subject) {
      console.log('✅ 제목 필드 발견:', selector);
      break;
    }
  }
  
  // 본문 필드 찾기
  const bodySelectors = [
    'div[aria-label][contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[aria-label*="메시지"][contenteditable="true"]',
    'div[aria-label*="Message"][contenteditable="true"]',
    'div[aria-label*="내용"][contenteditable="true"]',
    'div[aria-label*="Body"][contenteditable="true"]'
  ];
  
  let body = null;
  for (const selector of bodySelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      // 가장 최근 포커스된 컴포즈 박스 선택
      body = Array.from(elements).sort((a, b) => 
        b.getBoundingClientRect().top - a.getBoundingClientRect().top
      )[0];
      console.log('✅ 본문 필드 발견:', selector);
      break;
    }
  }
  
  console.log('컴포즈 요소 검색 결과:', { subject: !!subject, body: !!body });
  return { subject, body };
}

// 필드에 값 설정
function setFieldValue(element, value) {
  if (!element || !value) return;
  
  console.log('📝 필드에 값 설정:', { element, value });
  
  element.focus();
  element.click();
  
  setTimeout(() => {
    if (element.tagName === 'INPUT') {
      // INPUT 요소 처리
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      
      // 문자별로 입력 시뮬레이션
      for (let i = 0; i < value.length; i++) {
        element.value += value[i];
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new KeyboardEvent('keydown', { key: value[i], bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: value[i], bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: value[i], bubbles: true }));
      }
      
      element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
      
    } else if (element.contentEditable === 'true' || element.getAttribute('role') === 'textbox') {
      // contenteditable 요소 처리
      element.textContent = '';
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      
      // 문자별로 입력 시뮬레이션
      for (let i = 0; i < value.length; i++) {
        element.textContent += value[i];
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new KeyboardEvent('keydown', { key: value[i], bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: value[i], bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: value[i], bubbles: true }));
      }
      
      element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
    }
    
    console.log('✅ 필드 값 설정 완료');
  }, 100);
}

// Gmail 컴포즈 대기
async function waitForCompose(maxAttempts = 10, delay = 500) {
  for (let i = 0; i < maxAttempts; i++) {
    const { subject, body } = findComposeElements();
    if (subject && body) {
      console.log(`✅ Gmail 컴포즈 요소 발견 (시도 ${i + 1}/${maxAttempts})`);
      return { subject, body };
    }
    
    console.log(`⏳ Gmail 컴포즈 요소 대기 중... (시도 ${i + 1}/${maxAttempts})`);
    
    // 첫 번째 시도에서 작성창이 없으면 새로 열기 시도
    if (i === 0) {
      console.log('📝 Gmail 작성창이 열려있지 않습니다. 새로 열기 시도...');
      try {
        const composeButton = document.querySelector('[gh="cm"]') || 
                             document.querySelector('[data-action="compose"]') ||
                             document.querySelector('div[role="button"][aria-label*="작성"]') ||
                             document.querySelector('div[role="button"][aria-label*="Compose"]');
        
        if (composeButton) {
          console.log('✅ Gmail 작성 버튼 발견. 클릭합니다...');
          composeButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.log('❌ Gmail 작성 버튼을 찾을 수 없습니다.');
        }
      } catch (error) {
        console.error('Gmail 작성창 열기 실패:', error);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.warn('❌ Gmail 컴포즈 요소를 찾을 수 없습니다. 최대 시도 횟수 초과');
  return findComposeElements();
}

// 스레드 fewshots 추출
function extractThreadFewshots(limit = 2) {
  try {
    const selector = 'div[role="listitem"] div[dir="ltr"]';
    const nodes = Array.from(document.querySelectorAll(selector));
    const texts = nodes.slice(-limit).map(n => n.innerText || n.textContent || '');
    return texts.filter(t => t.trim()).map((t, i) => ({ 
      subject: `(thread message ${i+1})`, 
      text: t.slice(0, 2000) 
    }));
  } catch (error) {
    console.error('스레드 fewshots 추출 실패:', error);
    return [];
  }
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Content script 메시지 수신:', message.type);
  
  if (message.type === 'INSERT_EMAIL') {
    (async () => {
      try {
        const { subject, body } = message.payload || {};
        console.log('📧 Gmail 삽입 시도:', { subject, body });
        
        // Gmail 컴포즈 요소가 준비될 때까지 대기
        const { subject: subjEl, body: bodyEl } = await waitForCompose();
        
        let success = true;
        let errorMessage = '';
        
        // 제목 설정
        if (subject && subjEl) {
          try {
            setFieldValue(subjEl, subject);
            console.log('✅ 제목 삽입 완료:', subject);
          } catch (error) {
            console.error('❌ 제목 삽입 실패:', error);
            errorMessage += '제목 필드 없음. ';
            success = false;
          }
        } else {
          console.warn('❌ 제목 필드를 찾을 수 없습니다');
          errorMessage += '제목 필드 없음. ';
          success = false;
        }
        
        // 본문 설정
        if (body && bodyEl) {
          try {
            setFieldValue(bodyEl, body);
            console.log('✅ 본문 삽입 완료');
          } catch (error) {
            console.error('❌ 본문 삽입 실패:', error);
            errorMessage += '본문 필드 없음. ';
            success = false;
          }
        } else {
          console.warn('❌ 본문 필드를 찾을 수 없습니다');
          errorMessage += '본문 필드 없음. ';
          success = false;
        }
        
        if (success) {
          console.log('🎉 Gmail 삽입 성공');
          sendResponse({ ok: true });
        } else {
          console.log('❌ Gmail 삽입 실패:', errorMessage);
          sendResponse({ ok: false, error: errorMessage.trim() });
        }
        
      } catch (error) {
        console.error('❌ Gmail 삽입 중 예외 발생:', error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true; // 비동기 응답을 위해 true 반환
  }
  
  if (message.type === 'GET_THREAD_FEWSHOTS') {
    try {
      const fewshots = extractThreadFewshots();
      console.log('📋 스레드 fewshots 추출:', fewshots.length, '개');
      sendResponse({ fewshots });
    } catch (error) {
      console.error('❌ 스레드 fewshots 추출 실패:', error);
      sendResponse({ fewshots: [] });
    }
    return true;
  }
  
  return false;
});

console.log('✅ Content script 초기화 완료');