(function () {
  var d = document,
    $ = function (i) {
      return d.getElementById(i);
    };
  // skrypt ładowany jest w <head>, więc d.body nie istnieje w chwili startu
  function b() {
    return d.body || d.documentElement;
  }
  if ($("L0")) return;
  var S = d.currentScript;
  if (!S)
    for (var T = d.getElementsByTagName("script"), i = T.length; i--; )
      if ((T[i].src || "").toLowerCase().indexOf("lks-guard") >= 0) {
        S = T[i];
        break;
      }

  var C = (window.LKS_GUARD = window.LKS_GUARD || {}),
    H =
      C.HUB_URL ||
      (S && S.getAttribute("data-lks-hub")) ||
      "https://s-pro-v.github.io/guard/",
    SK =
      C.SESSION_KEY ||
      (S && S.getAttribute("data-lks-session-key")) ||
      "lks_vault_auth",
    SDK =
      C.SESSION_DATE_KEY ||
      (S && S.getAttribute("data-lks-session-date-key")) ||
      "lks_vault_auth_date",
    B64 =
      C.MASTER_KEY_B64 ||
      (S && S.getAttribute("data-lks-key-b64")) ||
      "YWRtaW4xMjM=",
    KEY;
  try {
    KEY = C.MASTER_KEY != null ? String(C.MASTER_KEY) : atob(B64);
  } catch (e) {
    KEY = "";
  }

  // -- ZAKTUALIZOWANY KOD CSS (CIEMNY MOTYW Z PRZYCIEMNIONYM TŁEM) --
  var css =
    ":root{--bg-panel:rgba(18,18,18,.9);--border-main:#333;--accent:#ff4900;--accent-ok:#09b83e;--text-main:#f0f0f0;--text-muted:#777;--font-stack:'JetBrains Mono','Courier New',monospace}body *{visibility:hidden!important}#L0,#L0 *{visibility:visible!important}body.lks-guard-passed *{visibility:visible!important}#L0{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background-image:linear-gradient(rgba(10,10,10,.8),rgba(10,10,10,.8)),url('https://raw.githubusercontent.com/s-pro-v/img/refs/heads/main/G%20img/lks.png');background-size:cover;background-position:center;font:11px var(--font-stack);transition:opacity .4s ease,visibility .4s ease}#L0.d{opacity:0;visibility:hidden!important;pointer-events:none}#L1{position:relative;max-width:90vw;min-width:320px;padding:32px 48px;background-color:var(--bg-panel);border:2px solid var(--border-main);border-top:4px solid var(--accent);box-shadow:0 10px 30px rgba(0,0,0,.5),inset 0 0 0 4px var(--bg-panel),inset 0 0 0 5px var(--border-main);font-family:var(--font-stack);text-align:left;text-transform:uppercase;color:var(--text-main);backdrop-filter:blur(4px);transition:all .3s ease}#L1::before,#L1::after{content:'';position:absolute;width:12px;height:12px;border:2px solid var(--accent);z-index:2;transition:border-color .3s ease}#L1::before{top:6px;left:6px;border-right:none;border-bottom:none}#L1::after{bottom:6px;right:6px;border-left:none;border-top:none}#L2{margin:0 0 10px;font-size:20px;font-weight:900;letter-spacing:.05em;color:var(--text-main);display:flex;align-items:center;gap:10px;border-bottom:2px solid var(--border-main);padding-bottom:10px;transition:all .3s ease}#L2::before{content:'!';display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:var(--accent);color:#fff;font-size:14px;clip-path:polygon(50% 0,0 100%,100% 100%);transition:all .3s ease}#L3{margin:0 0 18px;font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.12em}#L3::before{content:'SYS_MSG: ';color:var(--border-main)}.L{display:flex;gap:6px;justify-content:flex-start;margin:18px 0 0;padding-top:14px;border-top:1px dashed var(--border-main)}.L b{width:18px;height:6px;background:transparent;border:1px solid var(--border-main);animation:scan 1s infinite steps(1)}.L b:nth-child(1){animation-delay:0s}.L b:nth-child(2){animation-delay:.2s}.L b:nth-child(3){animation-delay:.4s}.L b:nth-child(4){animation-delay:.6s}.L b:nth-child(5){animation-delay:.8s}@keyframes scan{0%,100%{background:transparent}50%{background:var(--accent);border-color:var(--accent);box-shadow:0 0 5px var(--accent)}}#L1.ok{border-color:var(--border-main);border-top-color:var(--accent-ok)}#L1.ok #L2{color:var(--text-main)}#L1.ok #L2::before{content:'OK';background:var(--accent-ok);color:#fff;clip-path:polygon(0 0,100% 0,100% 100%,0 100%);width:24px;height:16px;font-size:10px}#L1.ok .L b{animation:none;background:var(--accent-ok);border-color:var(--accent-ok);box-shadow:0 0 5px var(--accent-ok)}#L3:empty::before{content:'SYS_MSG: ACCESS_GRANTED';color:var(--accent-ok)}#L1.er{border-color:var(--accent);border-top-color:var(--accent);box-shadow:0 10px 30px rgba(255,73,0,.2),inset 0 0 0 4px var(--bg-panel),inset 0 0 0 5px var(--accent)}#L1.er::before,#L1.er::after{border-color:var(--accent)}#L1.er #L2{color:var(--accent);border-bottom-color:var(--accent)}#L1.er #L3{color:var(--accent)}#L1.er #L3::before{content:'ERR_CODE: '}#L1.er .L b{animation:none;background:var(--accent);border-color:var(--accent);opacity:.6}";
  css +=
    "#L1.ok #L3{color:var(--accent-ok)}#L1.ok #L3::before{content:'SYS_MSG: ';color:#fff}#L1.ok #L3:empty::after{content:'ACCESS_GRANTED';color:var(--accent-ok)}#L6{margin-top:12px;text-align:right;font-size:10px;font-weight:700;color:var(--text-main);letter-spacing:.08em}#L4{height:4px;margin-top:4px;overflow:hidden;background:var(--border-main)}#L5{width:0;height:100%;background:linear-gradient(90deg,#e53935 0%,#fbc02d 50%,var(--accent-ok) 100%)}#L1.ok #L5{animation:lks-load 2.65s linear forwards}#L1.er #L5{animation:none;background:var(--accent)}@keyframes lks-load{0%{width:0}25%{width:25%}31%{width:25%}65%{width:65%}80%{width:65%}100%{width:100%}}";
  css +=
    "#L1.ok .L b{transform-origin:left;will-change:transform,opacity;animation-timing-function:steps(2,end);animation-iteration-count:infinite}#L1.ok .L b:nth-child(1){animation-name:srv-a;animation-duration:.63s;animation-delay:-.18s}#L1.ok .L b:nth-child(2){animation-name:srv-b;animation-duration:.91s;animation-delay:-.54s}#L1.ok .L b:nth-child(3){animation-name:srv-c;animation-duration:.74s;animation-delay:-.31s}#L1.ok .L b:nth-child(4){animation-name:srv-b;animation-duration:1.13s;animation-delay:-.77s}#L1.ok .L b:nth-child(5){animation-name:srv-a;animation-duration:.82s;animation-delay:-.43s}@keyframes srv-a{0%,100%{opacity:.25;transform:scaleX(.3);box-shadow:none}38%{opacity:1;transform:scaleX(1);box-shadow:0 0 7px var(--accent-ok)}72%{opacity:.55;transform:scaleX(.65)}}@keyframes srv-b{0%,100%{opacity:.45;transform:scaleX(.55)}24%{opacity:.2;transform:scaleX(.25)}58%{opacity:1;transform:scaleX(1);box-shadow:0 0 9px var(--accent-ok)}84%{opacity:.7;transform:scaleX(.8)}}@keyframes srv-c{0%,100%{opacity:.2;transform:scaleX(.2)}18%{opacity:.85;transform:scaleX(.75)}46%{opacity:.35;transform:scaleX(.4)}68%{opacity:1;transform:scaleX(1);box-shadow:0 0 6px var(--accent-ok)}}";
  css +=
    "#L0{user-select:none;-webkit-user-select:none}#L0.d *{visibility:hidden!important}";
  // --------------------------------------------------

  function sty() {
    if ($("Z")) return;
    var f = d.createElement("link");
    f.rel = "stylesheet";
    f.href =
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap";
    (d.head || d.documentElement).appendChild(f);
    var s = d.createElement("style");
    s.id = "Z";
    s.textContent = css;
    (d.head || d.documentElement).appendChild(s);
  }
  function hubOk() {
    if (!d.referrer) return 0;
    try {
      var o = H.split("/").slice(0, 3).join("/");
      return o && d.referrer.indexOf(o) === 0;
    } catch (e) {
      return 0;
    }
  }
  function sessOk() {
    var t = new Date().toDateString(),
      x = localStorage.getItem(SK),
      y = localStorage.getItem(SDK);
    if (x === "VALID" && y !== t) {
      localStorage.removeItem(SK);
      localStorage.removeItem(SDK);
      return 0;
    }
    return x === "VALID" && y === t;
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function updateNavStatus(state, label, status) {
    var n = $("lks-nav-status");
    if (!n) return;
    n.setAttribute("data-lks-state", state || "wait");
    var l = n.querySelector(".nav-pill__lks-label"),
      s = n.querySelector(".nav-pill__lks-status");
    if (l && label) l.textContent = label;
    if (s && status) s.textContent = status;
  }
  var clockId = 0;
  function startNavClock() {
    if (clockId) return;
    function tick() {
      var t = new Date(),
        dd = $("lks-nav-date"),
        tt = $("lks-nav-time");
      if (dd)
        dd.textContent =
          pad(t.getDate()) + "." + pad(t.getMonth() + 1) + "." + t.getFullYear();
      if (tt) {
        tt.textContent =
          pad(t.getHours()) + ":" + pad(t.getMinutes()) + ":" + pad(t.getSeconds());
        tt.setAttribute("datetime", t.toISOString());
      }
    }
    tick();
    clockId = setInterval(tick, 1000);
  }
  function setSt(x, w) {
    var p = $("L1"),
      a = $("L2"),
      s = $("L3");
    if (p) p.classList.remove("er");
    if (w) {
      if (p) p.classList.add("ok");
      if (a) a.textContent = "OK";
      if (s) s.textContent = x || "";
    } else if (s && x) s.textContent = x;
  }
  function hide() {
    var e = b();
    e.classList.add("lks-guard-passed");
    e.classList.remove("lks-page-loading");
    var o = $("L0");
    if (o) o.classList.add("d");
  }
  function redir(e) {
    var o = $("L0"),
      p = $("L1"),
      a = $("L2"),
      s = $("L3");
    if (o) {
      b().classList.remove("lks-guard-passed");
      b().classList.add("lks-page-loading");
      o.classList.remove("d");
    }
    updateNavStatus("stop", "STOP", e ? "SESJA" : "BRAK");
    if (p) {
      p.classList.remove("ok");
      p.classList.add("er");
    }
    if (a) a.textContent = "STOP";
    if (s) s.textContent = e ? "Sesja→hub" : "Brak→hub";
    var g = H || location.origin + "/",
      u = location.origin + location.pathname;
    setTimeout(function () {
      location.href =
        g +
        (g.indexOf("?") >= 0 ? "&" : "?") +
        "return_url=" +
        encodeURIComponent(u);
    }, 1400);
  }
  function watch() {
    function k() {
      if (!d.hidden && !sessOk()) redir(1);
    }
    setInterval(k, 45e3);
    d.addEventListener("visibilitychange", function () {
      if (!d.hidden) k();
    });
  }
  function go() {
    setSt("", 1);
    var bar = $("L5"),
      pct = $("L6"),
      done = 0;
    function finish() {
      if (done) return;
      done = 1;
      if (pct) pct.textContent = "100%";
      hide();
      updateNavStatus("ok", "OK", "SESJA");
      startNavClock();
      watch();
    }
    function showProgress(start) {
      var elapsed = Math.min((performance.now() - start) / 2650, 1),
        value;
      if (elapsed < 0.25) value = elapsed * 100;
      else if (elapsed < 0.31) value = 25;
      else if (elapsed < 0.65) value = 25 + ((elapsed - 0.31) / 0.34) * 40;
      else if (elapsed < 0.8) value = 65;
      else value = 65 + ((elapsed - 0.8) / 0.2) * 35;
      if (pct) pct.textContent = Math.min(100, Math.round(value)) + "%";
      if (!done && elapsed < 1)
        requestAnimationFrame(function () {
          showProgress(start);
        });
    }
    showProgress(performance.now());
    if (bar) bar.addEventListener("animationend", finish, { once: true });
    // animationend nie odpali się przy wyłączonych animacjach / w tle karty
    setTimeout(finish, bar ? 3200 : 0);
  }

  function run() {
    var q = new URLSearchParams(location.search);
    if (q.get("lks_logout") === "1") {
      localStorage.removeItem(SK);
      localStorage.removeItem(SDK);
      location.replace(H || location.origin + "/");
      return;
    }
    var v = btoa(KEY + "_" + new Date().getDate()),
      n = q.get("auth");
    if (n && n === v && hubOk()) {
      localStorage.setItem(SK, "VALID");
      localStorage.setItem(SDK, new Date().toDateString());
      history.replaceState({}, d.title, location.origin + location.pathname);
      go();
      return;
    }
    if (sessOk()) {
      go();
      return;
    }
    redir(0);
  }

  function mount() {
    try {
      build();
    } catch (e) {
      // awaria guardu nie może zostawić strony ukrytej przez `body *{visibility:hidden}`
      hide();
      throw e;
    }
  }

  function build() {
    sty();
    var e = b();
    e.classList.add("lks-page-loading");
    var o = d.createElement("div");
    o.id = "L0";
    o.innerHTML =
      '<div id="L1"><p id="L2">LKS</p><p id="L3">Czekaj…</p><div class="L"><b></b><b></b><b></b><b></b><b></b></div><div id="L6">0%</div><div id="L4"><div id="L5"></div></div></div>';
    e.appendChild(o);
    startNavClock();
    run();
  }

  C.sessOk = sessOk;
  C.updateNavStatus = updateNavStatus;
  C.startNavClock = startNavClock;

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
