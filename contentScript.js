// DraftMail Extension - Content Script
console.log('DraftMail contentScript.js 로드됨');

// Gmail 컴포즈 요소 찾기
function getActiveComposeElements() {
  console.log('Gmail 컴포즈 요소 검색 시작...');
  
  // 제목 필드 찾기
  const subjectSelectors = [
    'input[name="subjectbox"]',
    'input[aria-label*="제목"]',
    'input[aria-label*="Subject"]',
    'input[placeholder*="제목"]',
    'input[placeholder*="Subject"]',
    'input[data-original-title*="제목"]',
    'input[data-original-title*="Subject"]',
    'div[contenteditable="true"][aria-label*="제목"]',
    'div[contenteditable="true"][aria-label*="Subject"]',
    'div[contenteditable="true"][data-placeholder*="제목"]',
    'div[contenteditable="true"][data-placeholder*="Subject"]'
  ];
  
  let subject = null;
  for (const selector of subjectSelectors) {
    subject = document.querySelector(selector);
    if (subject) {
      console.log('제목 필드 발견:', selector);
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
    'div[aria-label*="Body"][contenteditable="true"]',
    'div[contenteditable="true"][data-placeholder*="메시지"]',
    'div[contenteditable="true"][data-placeholder*="Message"]',
    'div[contenteditable="true"][data-placeholder*="내용"]',
    'div[contenteditable="true"][data-placeholder*="Body"]',
    'div[contenteditable="true"][data-original-title*="메시지"]',
    'div[contenteditable="true"][data-original-title*="Message"]',
    'div[contenteditable="true"][data-original-title*="내용"]',
    'div[contenteditable="true"][data-original-title*="Body"]'
  ];
  
  let body = null;
  for (const selector of bodySelectors) {
    const bodies = Array.from(document.querySelectorAll(selector));
    if (bodies.length > 0) {
      // 가장 최근 포커스된 컴포즈 박스 추정
      body = bodies.sort((a,b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
      console.log('본문 필드 발견:', selector);
      break;
    }
  }
  
  // 수신자 필드 찾기
  const toField = findToField();
  
  console.log('컴포즈 요소 검색 결과:', { 
    subject: !!subject, 
    body: !!body, 
    toField: !!toField 
  });
  
  return { subject, body, toField };
}

// 수신자 필드 찾기
function findToField() {
  const toSelectors = [
    'input[aria-label="수신자"]',
    'input[aria-label*="받는 사람"]',
    'input[aria-label*="To"]',
    'input[placeholder*="받는 사람"]',
    'input[placeholder*="To"]',
    'input[name="to"]',
    'input.agP.aFw', // Gmail의 실제 클래스명
    'div[aria-label*="받는 사람"][contenteditable="true"]',
    'div[aria-label*="To"][contenteditable="true"]',
    'div[contenteditable="true"][data-placeholder*="받는 사람"]',
    'div[contenteditable="true"][data-placeholder*="To"]',
    'div[contenteditable="true"][data-original-title*="받는 사람"]',
    'div[contenteditable="true"][data-original-title*="To"]'
  ];
  
  for (const selector of toSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      console.log('수신자 필드 발견:', selector);
      return element;
    }
  }
  
  // 모든 input 요소 검사 (디버깅용)
  const allInputs = Array.from(document.querySelectorAll('input')).map(input => ({
    tagName: input.tagName,
    ariaLabel: input.getAttribute('aria-label'),
    placeholder: input.getAttribute('placeholder'),
    className: input.className
  }));
  
  console.log('수신자 필드를 찾을 수 없습니다. 사용 가능한 모든 input 요소:', allInputs);
  return null;
}

// 필드에 값 설정
function setFieldValue(element, value) {
  if (!element || !value) return;
  
  console.log('필드에 값 설정:', { element, value });
  
  element.focus();
  element.click();
  
  setTimeout(() => {
    if (element.tagName === 'INPUT') {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      
      for (let i = 0; i < value.length; i++) {
        element.value += value[i];
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new KeyboardEvent('keydown', { key: value[i], bubbles: true, cancelable: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: value[i], bubbles: true, cancelable: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: value[i], bubbles: true, cancelable: true }));
      }
      
      element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
      
    } else if (element.contentEditable === 'true' || element.getAttribute('role') === 'textbox') {
      element.textContent = '';
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      
      for (let i = 0; i < value.length; i++) {
        element.textContent += value[i];
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new KeyboardEvent('keydown', { key: value[i], bubbles: true, cancelable: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: value[i], bubbles: true, cancelable: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: value[i], bubbles: true, cancelable: true }));
      }
      
      element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
    }
    
    console.log('필드 값 설정 완료');
  }, 100);
}

// Gmail 컴포즈 대기
async function waitForGmailCompose(maxAttempts = 15, delay = 500) {
  for (let i = 0; i < maxAttempts; i++) {
    const { subject, body, toField } = getActiveComposeElements();
    if (subject && body) {
      console.log(`Gmail 컴포즈 요소 발견 (시도 ${i + 1}/${maxAttempts})`);
      return { subject, body, toField };
    }
    
    console.log(`Gmail 컴포즈 요소 대기 중... (시도 ${i + 1}/${maxAttempts})`);
    
    // 매 3번째 시도마다 작성창 열기 시도
    if (i % 3 === 0) {
      console.log('Gmail 작성창이 열려있지 않습니다. 새로 열기 시도...');
      try {
        const composeButton = document.querySelector('[gh="cm"]') || 
                             document.querySelector('[data-action="compose"]') ||
                             document.querySelector('div[role="button"][aria-label*="작성"], div[role="button"][aria-label*="Compose"]') ||
                             document.querySelector('div[role="button"][aria-label*="New message"]') ||
                             document.querySelector('div[role="button"][aria-label*="Compose"]') ||
                             document.querySelector('div[gh="cm"]');
        
        if (composeButton) {
          console.log('Gmail 작성 버튼을 찾았습니다. 클릭합니다...');
          composeButton.click();
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          console.log('Gmail 작성 버튼을 찾을 수 없습니다.');
        }
      } catch (error) {
        console.error('Gmail 작성창 열기 실패:', error);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.warn('Gmail 컴포즈 요소를 찾을 수 없습니다. 최대 시도 횟수 초과');
  return getActiveComposeElements();
}

// 스레드 fewshots 추출
function extractThreadFewshots(limit = 2) {
  const selector = 'div[role="listitem"] div[dir="ltr"]';
  const nodes = Array.from(document.querySelectorAll(selector));
  const texts = nodes.slice(-limit).map(n => n.innerText || n.textContent || '');
  return texts.filter(t => t.trim()).map((t, i) => ({ 
    subject: `(thread message ${i+1})`, 
    text: t.slice(0, 2000) 
  }));
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'INSERT_EMAIL') {
    (async () => {
      try {
        const { subject, body } = msg.payload || {};
        console.log('Gmail 삽입 시도:', { subject, body });
        
        // Gmail 컴포즈 요소가 준비될 때까지 대기
        const { subject: subjEl, body: bodyEl, toField } = await waitForGmailCompose();
        
        let success = true;
        let errorMessage = '';
        
        // 제목 설정
        if (subject && subjEl) {
          try {
            setFieldValue(subjEl, subject);
            console.log('제목 삽입 완료:', subject);
          } catch (error) {
            console.error('제목 삽입 실패:', error);
            errorMessage += '제목 필드 없음. ';
            success = false;
          }
        } else {
          console.warn('제목 필드를 찾을 수 없습니다');
          errorMessage += '제목 필드 없음. ';
          success = false;
        }
        
        // 본문 설정
        if (body && bodyEl) {
          try {
            setFieldValue(bodyEl, body);
            console.log('본문 삽입 완료');
          } catch (error) {
            console.error('본문 삽입 실패:', error);
            errorMessage += '본문 필드 없음. ';
            success = false;
          }
        } else {
          console.warn('본문 필드를 찾을 수 없습니다');
          errorMessage += '본문 필드 없음. ';
          success = false;
        }
        
        // 수신자 설정 (선택사항)
        if (toField) {
          try {
            // 수신자 필드에 포커스만 주고 사용자가 직접 입력하도록 함
            toField.focus();
            toField.click();
            console.log('수신자 필드에 포커스 설정 완료');
          } catch (error) {
            console.error('수신자 필드 포커스 실패:', error);
          }
        } else {
          console.log('수신자 필드를 찾을 수 없습니다 (선택사항)');
        }
        
        if (success) {
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: errorMessage.trim() });
        }
        
      } catch (error) {
        console.error('Gmail 삽입 중 예외 발생:', error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true; // 비동기 응답을 위해 true 반환
  }
  
  if (msg?.type === 'GET_THREAD_FEWSHOTS') {
    try {
      const fewshots = extractThreadFewshots();
      sendResponse({ fewshots });
    } catch (error) {
      console.error('스레드 fewshots 추출 실패:', error);
      sendResponse({ fewshots: [] });
    }
    return true;
  }
});

console.log('DraftMail contentScript.js 초기화 완료');