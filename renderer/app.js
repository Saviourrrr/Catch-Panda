const WELCOME_MESSAGES = [
  "What are we catching today?",
  "Ready to sniff out some AI?",
  "On the hunt for fakes.",
  "Truth detector, online.",
  "Let's catch something.",
  "AI content? Not on our watch.",
  "Detective panda standing by.",
  "On morning watch.",
  "Manifesting bamboo right now...",
  "Mondays, am i right?",
  "Grab a cup of coffee and lets begin!",
  "Tonights the night.",
  "Ol'reliable!",
  "Its one of those days.",
  "Your stars are good today!",
  "You know me. Lets start.",
  "How do i look today?",
  "Quite the traffic today ay?",
  "Goodmorning. Goodevening. Goodnight.",
];

const screens = {
  home:       document.getElementById('screen-home'),
  processing: document.getElementById('screen-processing'),
  results:    document.getElementById('screen-results'),
};

const panels = {
  info:       document.getElementById('panel-info'),
  keybind:    document.getElementById('panel-keybind'),
  hive:       document.getElementById('panel-hive'),
  copyleaks:  document.getElementById('panel-copyleaks'),
};

const els = {
  welcomeMsg:          document.getElementById('welcome-msg'),
  btnScreenshot:       document.getElementById('btn-screenshot'),
  btnLucky:            document.getElementById('btn-lucky'),
  btnDarkMode:         document.getElementById('btn-darkmode'),
  btnKeybind:          document.getElementById('btn-keybind'),
  btnInfo:             document.getElementById('btn-info'),
  btnCloseInfo:        document.getElementById('btn-close-info'),
  btnOpenHive:         document.getElementById('btn-open-hive'),
  btnOpenCopyleaks:    document.getElementById('btn-open-copyleaks'),
  btnCloseKeybind:     document.getElementById('btn-close-keybind'),
  currentKeybindDisp:  document.getElementById('current-keybind-display'),
  btnCloseHive:        document.getElementById('btn-close-hive'),
  inputHiveKey:        document.getElementById('input-hive-key'),
  btnSaveHive:         document.getElementById('btn-save-hive'),
  btnCloseCopyleaks:   document.getElementById('btn-close-copyleaks'),
  inputCopyleaksEmail: document.getElementById('input-copyleaks-email'),
  inputCopyleaksKey:   document.getElementById('input-copyleaks-key'),
  btnSaveCopyleaks:    document.getElementById('btn-save-copyleaks'),
  textResultLabel:     document.getElementById('text-result-label'),
  textBarTrack:        document.getElementById('text-bar-track'),
  textNoResult:        document.getElementById('text-no-result'),
  textNoKey:           document.getElementById('text-no-key'),
  textPercent:         document.getElementById('text-percent'),
  textBar:             document.getElementById('text-bar'),
  imageResultLabel:    document.getElementById('image-result-label'),
  imageBarTrack:       document.getElementById('image-bar-track'),
  imageNoKey:          document.getElementById('image-no-key'),
  imagePercent:        document.getElementById('image-percent'),
  imageBar:            document.getElementById('image-bar'),
  btnDetectMore:       document.getElementById('btn-detect-more'),
  btnGoBack:           document.getElementById('btn-go-back'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function openPanel(name) {
  Object.values(panels).forEach(p => p.classList.add('hidden'));
  panels[name].classList.remove('hidden');
}

function closeAllPanels() {
  Object.values(panels).forEach(p => p.classList.add('hidden'));
}

function applyTheme(isDark) {
  document.body.classList.toggle('dark', isDark);
  els.btnDarkMode.textContent = isDark ? 'Light Mode' : 'Dark Mode';
} //isDark is a true/false value

let isDark = localStorage.getItem('darkMode') === 'true';
applyTheme(isDark); //stores theme

els.btnDarkMode.addEventListener('click', () => {
  isDark = !isDark;
  localStorage.setItem('darkMode', isDark);
  applyTheme(isDark);
});

function setRandomWelcome() {
  els.welcomeMsg.textContent = WELCOME_MESSAGES[
    Math.floor(Math.random() * WELCOME_MESSAGES.length)
  ];
}
setRandomWelcome();

els.btnLucky.addEventListener('click', () => {
  els.welcomeMsg.textContent = WELCOME_MESSAGES[
    Math.floor(Math.random() * WELCOME_MESSAGES.length)
  ];
});

els.btnInfo.addEventListener('click', () => openPanel('info'));
els.btnCloseInfo.addEventListener('click', closeAllPanels);

let listeningForKey = false;

els.btnKeybind.addEventListener('click', async () => {
  const currentKey = await window.electronAPI.getKeybind();
  els.currentKeybindDisp.textContent = currentKey;
  openPanel('keybind');
  listeningForKey = true;
});

els.btnCloseKeybind.addEventListener('click', () => {
  listeningForKey = false;
  closeAllPanels();
});

//capture the key press while panel is open
document.addEventListener('keydown', (e) => {
  if (!listeningForKey) return;
  e.preventDefault();

  //adds readable parts to the string from keybind
  const parts = [];
  if (e.ctrlKey  && e.key !== 'Control') parts.push('Ctrl');
  if (e.altKey   && e.key !== 'Alt')     parts.push('Alt');
  if (e.shiftKey && e.key !== 'Shift')   parts.push('Shift');
  const key = e.code === 'Space' ? 'Space' : (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  parts.push(key);

  const combo = parts.join('+');
  window.electronAPI.setKeybind(combo);
  els.currentKeybindDisp.textContent = combo;

  listeningForKey = false;
  closeAllPanels();
});

els.btnOpenHive.addEventListener('click', async () => {
  //puts saved key
  const { hiveKey } = await window.electronAPI.getKeys();
  els.inputHiveKey.value = hiveKey;
  openPanel('hive');
});

els.btnCloseHive.addEventListener('click', closeAllPanels);

els.btnSaveHive.addEventListener('click', () => {
  const key = els.inputHiveKey.value.trim();
  window.electronAPI.setHiveKey(key);
  closeAllPanels();
});


els.btnOpenCopyleaks.addEventListener('click', async () => {
  const { copyleaksKey, copyleaksEmail } = await window.electronAPI.getKeys();
  els.inputCopyleaksKey.value   = copyleaksKey;
  els.inputCopyleaksEmail.value = copyleaksEmail;
  openPanel('copyleaks');
});

els.btnCloseCopyleaks.addEventListener('click', closeAllPanels);

els.btnSaveCopyleaks.addEventListener('click', () => {
  const key   = els.inputCopyleaksKey.value.trim();
  const email = els.inputCopyleaksEmail.value.trim();
  window.electronAPI.setCopyleaksKeys(key, email);
  closeAllPanels();
});

els.btnScreenshot.addEventListener('click', () => {
  closeAllPanels();
  window.electronAPI.activateDetectiveMode();
});

//listener for main.js to start processing
window.electronAPI.onStartProcessing((data) => {
  showScreen('processing');
  runDetection(data);
});

//overlay cancel
window.electronAPI.onDetectiveCancelled(() => {
  showScreen('home');
});

//result screen buttons
els.btnGoBack.addEventListener('click', () => {
  showScreen('home');
  setRandomWelcome(); //refreshes welcome msg
});

els.btnDetectMore.addEventListener('click', () => {
  window.electronAPI.activateDetectiveMode();
});

async function runDetection(data) {
  const { imageData } = data;
  const { textScore, imageScore } = await window.electronAPI.runDetection(imageData);
  showResults(textScore, imageScore);
}


//remove existing bars color and adds apropriae color bars when results are shown
function applyBarColor(barEl, score) {
  barEl.classList.remove('bar-low', 'bar-mid', 'bar-high');
  if      (score < 33) barEl.classList.add('bar-low'); //green
  else if (score < 66) barEl.classList.add('bar-mid'); //yellow
  else                 barEl.classList.add('bar-high'); //red
}

//bar animation and coloring
function showResults(textScore, imageScore) {
  showScreen('results');
  els.textResultLabel.style.display = 'none';
  els.textBarTrack.style.display    = 'none';
  els.textNoResult.style.display    = 'none';
  els.textNoKey.style.display       = 'none';

  if (textScore === 'no-key') {
    els.textNoKey.style.display = 'block';
  } else if (textScore === null) {
    els.textNoResult.style.display = 'block';
  } else {
    els.textResultLabel.style.display = '';
    els.textBarTrack.style.display    = '';
    els.textPercent.textContent = textScore;
    applyBarColor(els.textBar, textScore);
    requestAnimationFrame(() => {
      els.textBar.style.width = `${textScore}%`;
    });
  }

  els.imageResultLabel.style.display = 'none';
  els.imageBarTrack.style.display    = 'none';
  els.imageNoKey.style.display       = 'none';

  if (imageScore === 'no-key') {
    els.imageNoKey.style.display = 'block';
  } else {
    els.imageResultLabel.style.display = '';
    els.imageBarTrack.style.display    = '';
    els.imagePercent.textContent = imageScore;
    applyBarColor(els.imageBar, imageScore);
    requestAnimationFrame(() => {
      els.imageBar.style.width = `${imageScore}%`;
    });
  }
}