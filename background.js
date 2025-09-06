// DraftMail Extension - Background Script
console.log('🚀 DraftMail background.js 시작');

// Ollama 모델 목록 가져오기
async function getOllamaModels() {
  try {
    console.log('📋 Ollama 모델 목록 요청');
    const response = await fetch('http://localhost:11434/api/tags');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Ollama 응답:', data);
    
    if (!data.models || data.models.length === 0) {
      return { ok: false, error: '설치된 모델이 없습니다' };
    }
    
    return { ok: true, models: data.models };
  } catch (error) {
    console.error('Ollama 연결 실패:', error);
    return { ok: false, error: `Ollama 서버 연결 실패: ${error.message}` };
  }
}

// 스타일을 한국어로 변환
function translateStyles(styles) {
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
function authenticateGmail() {
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

// Gmail 메시지 검색
async function searchGmailMessages(query, token) {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=3`,
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
    console.error('Gmail 검색 실패:', error);
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
    console.log('✍️ 이메일 생성 요청:', payload);
    
    const { model, category, notes, styles, language, useGmailAPI } = payload;
    
    // Gmail API로 fewshots 가져오기
    let gmailFewshots = [];
    if (useGmailAPI) {
      try {
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
      } catch (error) {
        console.log('Gmail API 사용 실패:', error);
      }
    }
    
    // 프롬프트 생성
    const styleGuidance = translateStyles(styles);
    const fewshotsText = gmailFewshots
      .map(fs => `제목: ${fs.subject}\n내용: ${fs.text}`)
      .join('\n\n');
    
    const prompt = `다음 조건에 따라 이메일을 작성해주세요:

상대: ${category}
내용: ${notes}
스타일: ${styleGuidance}
언어: ${language}

${fewshotsText ? `참고할 이메일 예시:\n${fewshotsText}\n\n` : ''}위 조건에 맞는 이메일을 작성해주세요. 제목과 내용을 분리해서 답변해주세요.`;

    console.log('Ollama API 호출:', { model, promptLength: prompt.length });
    
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
      const errorText = await response.text();
      console.error('Ollama API 오류:', { status: response.status, error: errorText });
      throw new Error(`Ollama API 오류 ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Ollama 응답:', data);
    
    if (data.error) {
      throw new Error(`Ollama 오류: ${data.error}`);
    }
    
    const content = data.message?.content || '';
    console.log('생성된 내용:', content);
    
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
    
    const email = {
      subject: subject.trim(),
      body: body.trim()
    };
    
    console.log('최종 이메일:', email);
    
    return {
      ok: true,
      email: email
    };
    
  } catch (error) {
    console.error('이메일 생성 실패:', error);
    return { ok: false, error: error.message };
  }
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background 메시지 수신:', message.type);
  
  if (message.type === 'LIST_MODELS') {
    console.log('LIST_MODELS 요청 처리 시작');
    getOllamaModels().then(response => {
      console.log('LIST_MODELS 응답:', response);
      sendResponse(response);
    }).catch(error => {
      console.error('LIST_MODELS 처리 실패:', error);
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }
  
  if (message.type === 'GENERATE_EMAIL') {
    console.log('GENERATE_EMAIL 요청 처리 시작');
    generateEmail(message.payload).then(response => {
      console.log('GENERATE_EMAIL 응답:', response);
      sendResponse(response);
    }).catch(error => {
      console.error('GENERATE_EMAIL 처리 실패:', error);
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }
  
  // content script로 전달
  return false;
});

console.log('✅ Background script 초기화 완료');