// DraftMail Extension - Background Script
console.log('DraftMail background.js 로드됨');

// Ollama 모델 목록 가져오기
async function listOllamaModels() {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      throw new Error(`Ollama API 오류: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.models || data.models.length === 0) {
      return { ok: false, error: '설치된 모델이 없습니다' };
    }
    
    return { ok: true, models: data.models };
  } catch (error) {
    console.error('Ollama 모델 목록 가져오기 실패:', error);
    return { ok: false, error: 'Ollama 서버에 연결할 수 없습니다' };
  }
}

// 스타일을 가이드 텍스트로 변환
function stylesToGuidance(styles) {
  const styleMap = {
    'formal': '격식적이고 정중한 톤',
    'friendly': '친근하고 따뜻한 톤',
    'concise': '간결하고 핵심적인 내용',
    'persuasive': '설득력 있고 논리적인 내용',
    'apologetic': '사과하는 마음이 담긴 톤',
    'assertive': '단호하고 확신에 찬 톤'
  };
  
  return styles.map(style => styleMap[style] || style).join(', ');
}

// Gmail API 인증
async function authenticateGmail() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve({ ok: true, token });
      }
    });
  });
}

// Gmail API로 메시지 검색
async function searchGmailMessages(query, token) {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=5`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Gmail API 오류: ${response.status}`);
    }
    
    const data = await response.json();
    return { ok: true, messages: data.messages || [] };
  } catch (error) {
    console.error('Gmail 메시지 검색 실패:', error);
    return { ok: false, error: error.message };
  }
}

// Gmail 메시지 내용 가져오기
async function getGmailMessage(messageId, token) {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Gmail API 오류: ${response.status}`);
    }
    
    const data = await response.json();
    return { ok: true, message: data };
  } catch (error) {
    console.error('Gmail 메시지 가져오기 실패:', error);
    return { ok: false, error: error.message };
  }
}

// 이메일 생성
async function generateEmail(payload) {
  try {
    const { model, category, notes, styles, language, useGmailAPI, threadFewshots } = payload;
    
    // Gmail API로 fewshots 가져오기
    let gmailFewshots = [];
    if (useGmailAPI) {
      const authResult = await authenticateGmail();
      if (authResult.ok) {
        const searchQuery = `from:me to:${category} subject:${notes.split(' ')[0]}`;
        const searchResult = await searchGmailMessages(searchQuery, authResult.token);
        
        if (searchResult.ok && searchResult.messages.length > 0) {
          for (const message of searchResult.messages.slice(0, 2)) {
            const messageResult = await getGmailMessage(message.id, authResult.token);
            if (messageResult.ok) {
              const messageData = messageResult.message;
              const subject = messageData.payload.headers.find(h => h.name === 'Subject')?.value || '';
              const body = messageData.payload.body?.data ? 
                atob(messageData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/')) : '';
              
              if (subject && body) {
                gmailFewshots.push({ subject, text: body.slice(0, 1000) });
              }
            }
          }
        }
      }
    }
    
    // 프롬프트 생성
    const styleGuidance = stylesToGuidance(styles);
    const fewshotsText = [...threadFewshots, ...gmailFewshots]
      .map(fs => `제목: ${fs.subject}\n내용: ${fs.text}`)
      .join('\n\n');
    
    const prompt = `다음 조건에 따라 이메일을 작성해주세요:

상대: ${category}
내용: ${notes}
스타일: ${styleGuidance}
언어: ${language}

${fewshotsText ? `참고할 이메일 예시:\n${fewshotsText}\n\n` : ''}위 조건에 맞는 이메일을 작성해주세요. 제목과 내용을 분리해서 답변해주세요.`;

    // Ollama API 호출
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API 오류: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.message?.content || '';
    
    // 제목과 내용 분리
    const lines = content.split('\n').filter(line => line.trim());
    let subject = '';
    let body = '';
    
    let currentSection = '';
    for (const line of lines) {
      if (line.includes('제목:') || line.includes('Subject:')) {
        subject = line.replace(/^(제목:|Subject:)\s*/, '').trim();
        currentSection = 'subject';
      } else if (line.includes('내용:') || line.includes('Content:') || line.includes('Body:')) {
        currentSection = 'body';
        const bodyStart = line.replace(/^(내용:|Content:|Body:)\s*/, '').trim();
        if (bodyStart) {
          body += bodyStart + '\n';
        }
      } else if (currentSection === 'body') {
        body += line + '\n';
      } else if (currentSection === 'subject' && !subject) {
        subject = line.trim();
      }
    }
    
    // 제목이나 내용이 없으면 전체를 내용으로 사용
    if (!subject && !body) {
      body = content;
    } else if (!subject) {
      subject = '제목 없음';
    } else if (!body) {
      body = content;
    }
    
    return {
      ok: true,
      email: {
        subject: subject.trim(),
        body: body.trim()
      }
    };
    
  } catch (error) {
    console.error('이메일 생성 실패:', error);
    return { ok: false, error: error.message };
  }
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'LIST_MODELS') {
    listOllamaModels().then(sendResponse);
    return true;
  }
  
  if (msg?.type === 'GENERATE_EMAIL') {
    generateEmail(msg.payload).then(sendResponse);
    return true;
  }
  
  if (msg?.type === 'GET_THREAD_FEWSHOTS') {
    // content script에서 처리
    return false;
  }
  
  if (msg?.type === 'INSERT_EMAIL') {
    // content script에서 처리
    return false;
  }
});

console.log('DraftMail background.js 초기화 완료');