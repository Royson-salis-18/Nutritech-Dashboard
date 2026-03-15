import os
from flask import Flask, send_from_directory, jsonify, request, session, redirect, render_template_string
import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LANDING_DIR = os.path.join(BASE_DIR, "landing")
ASSETS_DIR = os.path.join(LANDING_DIR, "assets")

app = Flask(__name__)
app.secret_key = "mite-nutritech-2026-secret-key"

SUPABASE_URL = "https://ciosgjvbflsnrkhbriqh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpb3NnanZiZmxzbnJraGJyaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTMxNzcsImV4cCI6MjA4Njk2OTE3N30.srqPJAD4P92O9MykAfaLklWYV_iZo11WlIAlDDamXiM"

LOGIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NutriTech — Sign In</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #050a14; --card: #0d1520; --sur: #0a1018;
    --bdr: rgba(255,255,255,0.08); --acc: #22d3ee; --acc2: #818cf8;
    --off: #f43f5e; --muted: #64748b; --text: #f1f5f9;
    --mono: 'Space Mono', monospace; --font: 'Inter', sans-serif;
  }
  html, body { min-height: 100vh; font-family: var(--font); background: var(--bg); color: var(--text); display: flex; align-items: center; justify-content: center; }
  body::before { content: ''; position: fixed; inset: 0; background: radial-gradient(ellipse 80% 60% at 20% 10%, rgba(34,211,238,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(129,140,248,0.06) 0%, transparent 60%); pointer-events: none; z-index: 0; }
  body::after { content: ''; position: fixed; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 32px 32px; pointer-events: none; z-index: 0; }
  .card { position: relative; z-index: 1; background: var(--card); border: 1px solid var(--bdr); border-radius: 1.5rem; padding: 2.5rem 2rem; width: 100%; max-width: 400px; box-shadow: 0 0 60px rgba(34,211,238,0.04); }
  .logo { font-family: var(--mono); font-size: 10px; color: var(--muted); letter-spacing: 3px; text-transform: uppercase; margin-bottom: 6px; }
  .logo span { color: var(--acc); }
  h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 4px; }
  .sub { font-size: 0.85rem; color: var(--muted); margin-bottom: 2rem; }
  label { font-family: var(--mono); font-size: 10px; color: var(--muted); letter-spacing: 1px; display: block; margin-bottom: 6px; }
  input { width: 100%; background: var(--sur); border: 1px solid var(--bdr); color: var(--text); border-radius: 8px; padding: 11px 14px; font-family: var(--font); font-size: 14px; outline: none; transition: border-color .2s; margin-bottom: 1.1rem; }
  input:focus { border-color: var(--acc); }
  button { width: 100%; padding: 13px; border-radius: 8px; border: none; background: linear-gradient(135deg, var(--acc), var(--acc2)); color: #050a14; font-family: var(--mono); font-size: 12px; font-weight: 700; cursor: pointer; letter-spacing: 1px; transition: opacity .2s; }
  button:hover { opacity: .85; }
  button:disabled { opacity: .4; cursor: not-allowed; }
  .err { color: var(--off); font-family: var(--mono); font-size: 11px; margin-top: 12px; text-align: center; min-height: 16px; }
  .spin { display: none; text-align: center; margin-top: 12px; font-family: var(--mono); font-size: 11px; color: var(--muted); }
  .back { display: block; text-align: center; margin-top: 1.5rem; font-family: var(--mono); font-size: 11px; color: var(--muted); text-decoration: none; letter-spacing: 1px; cursor: pointer; }
  .back:hover { color: var(--acc); }
  #osk { position: fixed; bottom: 0; left: 0; width: 100%; background: #0a1018; border-top: 1px solid var(--bdr); padding: 10px 6px 14px; display: none; z-index: 9999; touch-action: manipulation; user-select: none; }
  #osk.show { display: block; }
  .osk-row { display: flex; justify-content: center; gap: 4px; margin-bottom: 4px; }
  .osk-key { background: #141c20; color: #d4e8f0; border: 1px solid #1e2d33; border-radius: 7px; height: 44px; min-width: 32px; flex: 1; max-width: 54px; font-size: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background .1s; }
  .osk-key:active { background: rgba(34,211,238,0.15); border-color: var(--acc); color: var(--acc); }
  .osk-wide { max-width: 72px; flex: 1.6; font-size: 12px; color: var(--acc); }
  .osk-space { max-width: 220px; flex: 5; font-size: 12px; }
  .osk-shift-on { background: rgba(34,211,238,0.15) !important; border-color: var(--acc) !important; color: var(--acc) !important; }
  #osk-hide-btn { display: flex; justify-content: flex-end; margin-bottom: 4px; }
  #osk-hide { background: #1e2d33; color: var(--acc); border: 1px solid #1e2d33; border-radius: 6px; padding: 4px 14px; font-size: 12px; font-family: var(--mono); cursor: pointer; letter-spacing: 1px; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">NutriTech <span>//</span> Experiment Entry</div>
  <h1>Sign In</h1>
  <p class="sub">Authenticate to access the experiment entry portal</p>
  <label>EMAIL</label>
  <input type="email" id="email" placeholder="you@example.com" autocomplete="off">
  <label>PASSWORD</label>
  <input type="password" id="password" placeholder="••••••••" autocomplete="off">
  <button id="loginBtn" onclick="doLogin()">SIGN IN →</button>
  <div class="err" id="err"></div>
  <div class="spin" id="spin">Authenticating...</div>
  <a class="back" onclick="history.back()">← BACK TO HOME</a>
</div>

<div id="osk">
  <div id="osk-hide-btn"><div id="osk-hide">▼ HIDE</div></div>
  <div class="osk-row" id="osk-r0"></div>
  <div class="osk-row" id="osk-r1"></div>
  <div class="osk-row" id="osk-r2"></div>
  <div class="osk-row" id="osk-r3"></div>
  <div class="osk-row" id="osk-r4"></div>
</div>

<script>
const SUPABASE_URL = "https://ciosgjvbflsnrkhbriqh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpb3NnanZiZmxzbnJraGJyaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTMxNzcsImV4cCI6MjA4Njk2OTE3N30.srqPJAD4P92O9MykAfaLklWYV_iZo11WlIAlDDamXiM";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

(function () {
  var activeInput = null, shifted = false;
  var rows = {
    normal:  [['1','2','3','4','5','6','7','8','9','0'],['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l'],['z','x','c','v','b','n','m']],
    shifted: [['!','@','#','$','%','^','&','*','(',')'],['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['Z','X','C','V','B','N','M']]
  };
  function insertAt(ch) {
    if (!activeInput) return;
    var el = activeInput, s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s;
    el.value = el.value.slice(0, s) + ch + el.value.slice(e);
    el.selectionStart = el.selectionEnd = s + ch.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (shifted) { shifted = false; renderKeys(); }
  }
  function tap(fn) { return function (ev) { ev.preventDefault(); fn(); }; }
  var shiftBtn;
  function renderKeys() {
    var layout = shifted ? rows.shifted : rows.normal;
    for (var i = 0; i < 4; i++) {
      var row = document.getElementById('osk-r' + i);
      row.innerHTML = '';
      (function (rl) {
        rl.forEach(function (ch) {
          var k = document.createElement('div'); k.className = 'osk-key'; k.textContent = ch;
          k.addEventListener('touchend', tap(function () { insertAt(ch); }), { passive: false });
          row.appendChild(k);
        });
      })(layout[i]);
    }
    var bot = document.getElementById('osk-r4'); bot.innerHTML = '';
    function addKey(label, cls, fn) {
      var k = document.createElement('div'); k.className = 'osk-key' + (cls ? ' ' + cls : ''); k.textContent = label;
      k.addEventListener('touchend', tap(fn), { passive: false }); bot.appendChild(k); return k;
    }
    shiftBtn = addKey('⇧ Shift', 'osk-wide', function () { shifted = !shifted; shiftBtn.classList.toggle('osk-shift-on', shifted); renderKeys(); });
    if (shifted) shiftBtn.classList.add('osk-shift-on');
    addKey('.', '', function () { insertAt('.'); });
    addKey('@', '', function () { insertAt('@'); });
    addKey('_', '', function () { insertAt('_'); });
    addKey('-', '', function () { insertAt('-'); });
    addKey('Space', 'osk-space', function () { insertAt(' '); });
    addKey('⌫', 'osk-wide', function () {
      if (!activeInput) return;
      var el = activeInput, s = el.selectionStart, e = el.selectionEnd;
      if (s == null) { s = el.value.length; e = s; }
      if (s === e && s > 0) { el.value = el.value.slice(0, s-1) + el.value.slice(e); el.selectionStart = el.selectionEnd = s-1; }
      else if (s !== e) { el.value = el.value.slice(0, s) + el.value.slice(e); el.selectionStart = el.selectionEnd = s; }
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    addKey('Next ↵', 'osk-wide', function () {
      if (activeInput && activeInput.id === 'email') { document.getElementById('password').focus(); }
      else { hideOSK(); doLogin(); }
    });
  }
  function showOSK() { document.getElementById('osk').classList.add('show'); }
  function hideOSK() { document.getElementById('osk').classList.remove('show'); }
  renderKeys();
  document.getElementById('osk-hide').addEventListener('touchend', tap(hideOSK), { passive: false });
  ['email', 'password'].forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('focus', function () { activeInput = el; showOSK(); });
    el.addEventListener('touchstart', function () { activeInput = el; }, { passive: true });
  });
})();

document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('email').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('password').focus(); });

async function doLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('err');
  const spin = document.getElementById('spin');
  err.textContent = '';
  if (!email || !password) { err.textContent = 'Enter email and password'; return; }
  btn.disabled = true; spin.style.display = 'block';
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { err.textContent = error.message; btn.disabled = false; spin.style.display = 'none'; return; }
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: data.session.access_token })
    });
    const result = await res.json();
    if (result.ok) {
      window.location.href = 'https://nutritech-rpi-dashboard.onrender.com';
    } else {
      err.textContent = result.error || 'Auth failed';
      btn.disabled = false; spin.style.display = 'none';
    }
  } catch (e) {
    err.textContent = 'Network error. Try again.';
    btn.disabled = false; spin.style.display = 'none';
  }
}
</script>
</body>
</html>"""


@app.route("/")
def index():
    return send_from_directory(LANDING_DIR, "index.html")

@app.route("/dashboard")
def dashboard():
    return redirect("https://nutritech-rpi-dashboard.onrender.com/")

@app.route("/login")
def login_page():
    return render_template_string(LOGIN_HTML)

@app.route("/entry")
def entry():
    return redirect("/login")

@app.route("/assets/<path:filename>")
def assets(filename: str):
    return send_from_directory(ASSETS_DIR, filename)

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/api/auth", methods=["POST"])
def api_auth():
    token = request.json.get("access_token")
    if not token:
        return jsonify({"error": "No token"}), 400
    try:
        r = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_KEY},
            timeout=5
        )
        if r.status_code == 200:
            user = r.json()
            session["user"] = {"email": user.get("email"), "id": user.get("id")}
            session.permanent = True
            return jsonify({"ok": True, "email": user.get("email")})
        return jsonify({"error": "Invalid token"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
