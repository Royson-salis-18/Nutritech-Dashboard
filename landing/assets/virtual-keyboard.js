;(function () {
  if (document.getElementById('keyboard-container') || document.getElementById('virtual-kb-container')) return;
  var activeInput = null;
  var container = document.createElement('div');
  container.id = 'virtual-kb-container';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.right = '0';
  container.style.bottom = '0';
  container.style.zIndex = '1500';
  container.style.background = 'rgba(2,6,23,0.95)';
  container.style.borderTop = '1px solid rgba(148,163,184,0.2)';
  container.style.backdropFilter = 'blur(6px)';
  container.style.padding = '8px 10px 12px';
  container.style.display = 'none';

  var bar = document.createElement('div');
  bar.style.maxWidth = '900px';
  bar.style.margin = '0 auto 8px';
  bar.style.display = 'flex';
  bar.style.justifyContent = 'flex-end';
  var hideBtn = document.createElement('button');
  hideBtn.textContent = 'HIDE KEYBOARD';
  hideBtn.style.background = '#1e293b';
  hideBtn.style.color = '#94a3b8';
  hideBtn.style.border = '1px solid #334155';
  hideBtn.style.padding = '6px 12px';
  hideBtn.style.borderRadius = '8px';
  hideBtn.style.fontSize = '12px';
  hideBtn.style.fontWeight = '700';
  hideBtn.style.cursor = 'pointer';
  hideBtn.onclick = function () {
    container.style.display = 'none';
    if (activeInput) activeInput.blur();
    activeInput = null;
  };
  bar.appendChild(hideBtn);
  container.appendChild(bar);

  var grid = document.createElement('div');
  grid.style.maxWidth = '900px';
  grid.style.margin = '0 auto';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(10, minmax(0, 1fr))';
  grid.style.gap = '8px';
  grid.style.userSelect = 'none';
  container.appendChild(grid);

  var keys = [
    '1','2','3','4','5','6','7','8','9','0',
    'Q','W','E','R','T','Y','U','I','O','P',
    'A','S','D','F','G','H','J','K','L','@',
    'Z','X','C','V','B','N','M','.','_', '-',
    'SPACE','BACKSPACE','DONE'
  ];

  function onKeyPress(key) {
    if (!activeInput) return;
    if (key === 'BACKSPACE') {
      activeInput.value = activeInput.value.slice(0, -1);
    } else if (key === 'SPACE') {
      activeInput.value += ' ';
    } else if (key === 'DONE') {
      container.style.display = 'none';
      activeInput.blur();
      activeInput = null;
    } else {
      var ch = key.length === 1 ? key.toLowerCase() : '';
      activeInput.value += ch;
    }
    var ev1 = new Event('input', { bubbles: true });
    var ev2 = new Event('change', { bubbles: true });
    activeInput.dispatchEvent(ev1);
    activeInput.dispatchEvent(ev2);
  }

  keys.forEach(function (k) {
    var el = document.createElement('div');
    el.textContent = k;
    el.style.textAlign = 'center';
    el.style.padding = '12px 0';
    el.style.border = '1px solid #334155';
    el.style.borderRadius = '10px';
    el.style.background = k === 'SPACE' ? '#0ea5e9' : '#0b1220';
    el.style.color = k === 'SPACE' ? '#0b1220' : '#e2e8f0';
    el.style.fontWeight = '800';
    el.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif';
    el.style.cursor = 'pointer';
    if (k === 'SPACE') el.style.gridColumn = 'span 3';
    if (k === 'BACKSPACE' || k === 'DONE') el.style.gridColumn = 'span 2';
    el.addEventListener('mousedown', function (e) { e.preventDefault(); });
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      onKeyPress(k);
    });
    grid.appendChild(el);
  });

  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.classList && t.classList.contains('no-virtual-keyboard')) return;
    var tag = t.tagName;
    var type = (t.getAttribute && (t.getAttribute('type') || '')).toLowerCase();
    var isTextual = tag === 'TEXTAREA' || tag === 'INPUT' && (!type || ['text','search','email','number','password','url','tel'].indexOf(type) !== -1);
    if (isTextual) {
      activeInput = t;
      document.body.appendChild(container);
      container.style.display = 'block';
    }
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!container.contains(t) && t !== activeInput) {
      container.style.display = 'none';
    }
  });
})(); 
