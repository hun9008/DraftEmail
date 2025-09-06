const $ = s => document.querySelector(s);

function getCheckedValues(rootSel) {
  return Array.from(document.querySelectorAll(`${rootSel} input[type="checkbox"]:checked`)).map(x => x.value);
}
function setCheckedValues(rootSel, values=[]) {
  const set = new Set(values);
  document.querySelectorAll(`${rootSel} input[type="checkbox"]`).forEach(x => { x.checked = set.has(x.value); });
}

async function load() {
  const st = await chrome.storage.sync.get({
    defaultLanguage: '한국어',
    myName: '',
    myProfile: '',
    signature: '',
    autoAppendSignature: false,
    defaultStyles: []
  });
  $('#defaultLanguage').value = st.defaultLanguage;
  $('#myName').value = st.myName;
  $('#myProfile').value = st.myProfile;
  $('#signature').value = st.signature;
  $('#autoAppendSignature').checked = !!st.autoAppendSignature;
  setCheckedValues('.multiselect', st.defaultStyles);
}

async function save() {
  const data = {
    defaultLanguage: $('#defaultLanguage').value,
    myName: $('#myName').value.trim(),
    myProfile: $('#myProfile').value.trim(),
    signature: $('#signature').value,
    autoAppendSignature: $('#autoAppendSignature').checked,
    defaultStyles: getCheckedValues('.multiselect')
  };
  await chrome.storage.sync.set(data);
  $('#status').textContent = '저장되었습니다.';
  setTimeout(()=> $('#status').textContent = '', 1500);
}

async function resetAll() {
  await chrome.storage.sync.clear();
  await load();
  $('#status').textContent = '초기화되었습니다.';
  setTimeout(()=> $('#status').textContent = '', 1500);
}

$('#save').addEventListener('click', save);
$('#reset').addEventListener('click', resetAll);
load();