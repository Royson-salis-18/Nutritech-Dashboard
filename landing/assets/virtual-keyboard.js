;(function () {
  if (document.getElementById('virtual-kb-container')) return;

  var activeInput = null;
  var shifted = false;
  var capsLock = false;

  /* ── Container ── */
  var container = document.createElement('div');
  container.id = 'virtual-kb-container';
  Object.assign(container.style, {
    position:       'fixed',
    left:           '0',
    right:          '0',
    bottom:         '0',
    zIndex:         '1500',
    background:     'rgba(2,6,23,0.97)',
    borderTop:      '1px solid rgba(148,163,184,0.2)',
    backdropFilter: 'blur(8px)',
    padding:        '8px 10px 14px',
    display:        'none',
    boxShadow:      '0 -4px 30px rgba(0,0,0,0.4)'
  });

  /* ── Top bar (field label + hide button) ── */
  var bar = document.createElement('div');
  Object.assign(bar.style, {
    maxWidth:      '900px',
    margin:        '0 auto 8px',
    display:       'flex',
    alignItems:    'center',
    justifyContent:'space-between'
  });

  var fieldLabel = document.createElement('span');
  fieldLabel.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;font-family:monospace';
  fieldLabel.textContent = '';

  var hideBtn = document.createElement('button');
  hideBtn.textContent = 'HIDE ✕';
  Object.assign(hideBtn.style, {
    background:   '#1e293b',
    color:        '#94a3b8',
    border:       '1px solid #334155',
    padding:      '5px 12px',
    borderRadius: '8px',
    fontSize:     '11px',
    fontWeight:   '700',
    cursor:       'pointer',
    fontFamily:   'monospace',
    letterSpacing:'0.08em'
  });
  hideBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
  hideBtn.addEventListener('click', function () {
    container.style.display = 'none';
    if (activeInput) activeInput.blur();
    activeInput = null;
  });
  bar.appendChild(fieldLabel);
  bar.appendChild(hideBtn);
  container.appendChild(bar);

  /* ── Key grid ── */
  var grid = document.createElement('div');
  Object.assign(grid.style, {
    maxWidth:             '900px',
    margin:               '0 auto',
    display:              'grid',
    gridTemplateColumns:  'repeat(10, minmax(0, 1fr))',
    gap:                  '6px',
    userSelect:           'none'
  });
  container.appendChild(grid);

  /* Key style helper */
  function styleKey(el, type) {
    Object.assign(el.style, {
      textAlign:   'center',
      padding:     '13px 0',
      border:      '1px solid #1e293b',
      borderRadius:'9px',
      fontWeight:  '700',
      fontFamily:  'system-ui, -apple-system, Inter, sans-serif',
      fontSize:    '14px',
      cursor:      'pointer',
      transition:  'background 0.1s, color 0.1s',
      lineHeight:  '1'
    });
    if (type === 'normal') {
      el.style.background = '#0d1829';
      el.style.color = '#e2e8f0';
    } else if (type === 'action') {
      el.style.background = '#1e293b';
      el.style.color = '#94a3b8';
      el.style.fontSize = '11px';
    } else if (type === 'primary') {
      el.style.background = 'linear-gradient(135deg, #34d399, #059669)';
      el.style.color = '#000';
      el.style.fontSize = '12px';
    } else if (type === 'space') {
      el.style.background = '#172033';
      el.style.color = '#94a3b8';
      el.style.fontSize = '12px';
    } else if (type === 'shift-on') {
      el.style.background = 'rgba(52,211,153,0.15)';
      el.style.color = '#34d399';
      el.style.border = '1px solid rgba(52,211,153,0.3)';
    }
  }

  /* ── Key definitions ── */
  var ROWS = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L','@'],
    ['Z','X','C','V','B','N','M','.','-','_'],
  ];

  var BOTTOM_ROW = ['SHIFT','SPACE','⌫','NEXT'];
  var SPANS = { SPACE: 4, NEXT: 2, '⌫': 2, SHIFT: 2 };

  var shiftKeyEl = null;
  var nextKeyEl = null;
  var allLetterEls = [];

  function updateShiftVisual() {
    if (!shiftKeyEl) return;
    if (shifted || capsLock) {
      styleKey(shiftKeyEl, 'shift-on');
      shiftKeyEl.textContent = capsLock ? 'CAPS' : 'SHIFT ⇧';
    } else {
      styleKey(shiftKeyEl, 'action');
      shiftKeyEl.textContent = 'SHIFT ⇧';
    }
  }

  function updateNextKey() {
    if (!nextKeyEl || !activeInput) return;
    var type = (activeInput.getAttribute('type') || 'text').toLowerCase();
    if (type === 'email') {
      nextKeyEl.textContent = 'NEXT →';
      styleKey(nextKeyEl, 'action');
      nextKeyEl.style.gridColumn = 'span 2';
    } else if (type === 'password') {
      nextKeyEl.textContent = 'SIGN IN ✓';
      styleKey(nextKeyEl, 'primary');
      nextKeyEl.style.gridColumn = 'span 2';
    } else {
      nextKeyEl.textContent = 'DONE';
      styleKey(nextKeyEl, 'action');
      nextKeyEl.style.gridColumn = 'span 2';
    }
  }

  function getCharForKey(k) {
    var isLetter = k.length === 1 && k >= 'A' && k <= 'Z';
    if (!isLetter) return k.toLowerCase(); // symbols, numbers stay as-is but lowercase
    // For email: always lowercase. For password/text: respect shift/caps
    if (activeInput) {
      var inputType = (activeInput.getAttribute('type') || 'text').toLowerCase();
      if (inputType === 'password' || inputType === 'text') {
        return (shifted || capsLock) ? k.toUpperCase() : k.toLowerCase();
      }
    }
    // Default (email): lowercase
    return k.toLowerCase();
  }

  function insertChar(ch) {
    if (!activeInput) return;
    var s = activeInput.selectionStart != null ? activeInput.selectionStart : activeInput.value.length;
    var e = activeInput.selectionEnd != null ? activeInput.selectionEnd : s;
    activeInput.value = activeInput.value.slice(0, s) + ch + activeInput.value.slice(e);
    activeInput.selectionStart = activeInput.selectionEnd = s + ch.length;
    activeInput.dispatchEvent(new Event('input',  { bubbles: true }));
    activeInput.dispatchEvent(new Event('change', { bubbles: true }));
    // Auto-unshift after single keystroke (not caps lock)
    if (shifted && !capsLock) {
      shifted = false;
      updateShiftVisual();
      refreshLetterDisplay();
    }
  }

  function refreshLetterDisplay() {
    allLetterEls.forEach(function (pair) {
      var k = pair.k, el = pair.el;
      var isLetter = k.length === 1 && k >= 'A' && k <= 'Z';
      if (!isLetter) return;
      // For password inputs show uppercase when shifted
      if (activeInput) {
        var t = (activeInput.getAttribute('type') || 'text').toLowerCase();
        if (t === 'password' || t === 'text') {
          el.textContent = (shifted || capsLock) ? k.toUpperCase() : k.toLowerCase();
          return;
        }
      }
      el.textContent = k.toLowerCase();
    });
  }

  function onKeyPress(k, el) {
    if (!activeInput) return;
    if (k === '⌫') {
      var s = activeInput.selectionStart != null ? activeInput.selectionStart : activeInput.value.length;
      var e2 = activeInput.selectionEnd != null ? activeInput.selectionEnd : s;
      if (s === e2 && s > 0) {
        activeInput.value = activeInput.value.slice(0, s - 1) + activeInput.value.slice(e2);
        activeInput.selectionStart = activeInput.selectionEnd = s - 1;
      } else if (s !== e2) {
        activeInput.value = activeInput.value.slice(0, s) + activeInput.value.slice(e2);
        activeInput.selectionStart = activeInput.selectionEnd = s;
      }
      activeInput.dispatchEvent(new Event('input',  { bubbles: true }));
    } else if (k === 'SPACE') {
      insertChar(' ');
    } else if (k === 'SHIFT ⇧' || k === 'CAPS' || k === 'SHIFT') {
      // Double-tap = caps lock
      if (shifted && !capsLock) {
        capsLock = true; shifted = false;
      } else if (capsLock) {
        capsLock = false; shifted = false;
      } else {
        shifted = true;
      }
      updateShiftVisual();
      refreshLetterDisplay();
    } else if (k === 'NEXT →' || k === 'SIGN IN ✓' || k === 'DONE' || k === 'NEXT') {
      var inputType = (activeInput.getAttribute('type') || 'text').toLowerCase();
      if (inputType === 'email') {
        // Find next input and focus it
        var allInputs = Array.from(document.querySelectorAll('input, textarea'));
        var idx = allInputs.indexOf(activeInput);
        var nextInput = idx >= 0 ? allInputs[idx + 1] : null;
        if (nextInput) {
          nextInput.focus();
        } else {
          container.style.display = 'none';
          activeInput.blur();
          activeInput = null;
        }
      } else if (inputType === 'password') {
        // Try to submit the form
        var form = activeInput.closest('form') || document.querySelector('form') || document.querySelector('#login-form');
        container.style.display = 'none';
        activeInput.blur();
        activeInput = null;
        if (form) {
          var submitBtn = form.querySelector('[type="submit"], button[class*="submit"]');
          if (submitBtn) submitBtn.click();
          else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        } else {
          // Try clicking the submit button by common IDs
          var btn = document.getElementById('submit-btn') || document.getElementById('loginBtn');
          if (btn) btn.click();
        }
      } else {
        container.style.display = 'none';
        if (activeInput) activeInput.blur();
        activeInput = null;
      }
    } else {
      insertChar(getCharForKey(k));
    }
  }

  /* Build all key rows */
  ROWS.forEach(function (row) {
    row.forEach(function (k) {
      var el = document.createElement('div');
      var isLetter = k.length === 1 && k >= 'A' && k <= 'Z';
      el.textContent = isLetter ? k.toLowerCase() : k;
      styleKey(el, 'normal');
      el.addEventListener('mousedown', function (e) { e.preventDefault(); });
      el.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
      var keyRef = k;
      el.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onKeyPress(keyRef, el); });
      el.addEventListener('touchend', function (e) { e.preventDefault(); e.stopPropagation(); onKeyPress(keyRef, el); });
      if (isLetter) allLetterEls.push({ k: k, el: el });
      grid.appendChild(el);
    });
  });

  /* Bottom row */
  BOTTOM_ROW.forEach(function (k) {
    var el = document.createElement('div');
    var span = SPANS[k] || 1;
    if (span > 1) el.style.gridColumn = 'span ' + span;

    if (k === 'SHIFT') {
      el.textContent = 'SHIFT ⇧';
      styleKey(el, 'action');
      shiftKeyEl = el;
    } else if (k === 'SPACE') {
      el.textContent = 'SPACE';
      styleKey(el, 'space');
    } else if (k === '⌫') {
      el.textContent = '⌫';
      styleKey(el, 'action');
    } else if (k === 'NEXT') {
      el.textContent = 'NEXT →';
      styleKey(el, 'action');
      nextKeyEl = el;
    }

    el.addEventListener('mousedown', function (e) { e.preventDefault(); });
    el.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    var keyRef = k;
    el.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      // For shift, pass the current text
      if (keyRef === 'SHIFT') onKeyPress(shiftKeyEl.textContent, el);
      else if (keyRef === 'NEXT') onKeyPress(nextKeyEl ? nextKeyEl.textContent : 'NEXT', el);
      else onKeyPress(keyRef, el);
    });
    el.addEventListener('touchend', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (keyRef === 'SHIFT') onKeyPress(shiftKeyEl.textContent, el);
      else if (keyRef === 'NEXT') onKeyPress(nextKeyEl ? nextKeyEl.textContent : 'NEXT', el);
      else onKeyPress(keyRef, el);
    });
    grid.appendChild(el);
  });

  /* Show keyboard on focus */
  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.classList && t.classList.contains('no-virtual-keyboard')) return;
    var tag = t.tagName;
    var type = ((t.getAttribute && t.getAttribute('type')) || '').toLowerCase();
    var textual = tag === 'TEXTAREA' || (tag === 'INPUT' && (!type || ['text','search','email','number','password','url','tel'].indexOf(type) !== -1));
    if (textual) {
      activeInput = t;
      // Update field label
      var lbl = t.previousElementSibling || t.parentElement && t.parentElement.previousElementSibling;
      fieldLabel.textContent = type === 'email' ? 'EMAIL ADDRESS' : type === 'password' ? 'PASSWORD' : '';
      document.body.appendChild(container);
      container.style.display = 'block';
      refreshLetterDisplay();
      updateNextKey();
    }
  });

  /* Hide on outside click */
  document.addEventListener('click', function (e) {
    if (!container.contains(e.target) && e.target !== activeInput) {
      container.style.display = 'none';
    }
  });
})();
