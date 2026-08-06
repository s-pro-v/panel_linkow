document.addEventListener("DOMContentLoaded", () => {
  const KIT_THEME_KEY = "cyber-refactor-theme";
  const ACCOUNT_SETTINGS_KEY = "panel-github-settings";
  const AUTH_URL =
    "https://raw.githubusercontent.com/s-pro-v/json-lista/refs/heads/main/dev/auth.json";

  const defaults = {
    owner: "s-pro-v",
    repo: "json-lista",
    path: "linki/home.json",
    token: "",
    xorKey: "",
  };

  let cachedPatToken = null;
  let tokenSource = null;
  let encryptedPat = null;
  let editorRef = null;
  let currentFilePath = null;
  let editorBaseline = "";
  let repoTreePaths = [];
  let confirmResolver = null;

  const accountOverlay = document.getElementById("accountModalOverlay");
  const accountModal = document.getElementById("accountModal");
  const ghOwnerInput = document.getElementById("gh-owner");
  const ghRepoInput = document.getElementById("gh-repo");
  const ghPathInput = document.getElementById("gh-path");
  const ghTokenInput = document.getElementById("gh-token");
  const ghXorKeyInput = document.getElementById("gh-xor-key");
  const authStatus = document.getElementById("accountAuthStatus");
  const fetchAuthButton = document.getElementById("btn-fetch-auth");
  const decryptButton = document.getElementById("btn-decrypt-token");
  const tokenStatus = document.getElementById("accountTokenStatus");
  const accountOpStatus = document.getElementById("accountOpStatus");
  const statusToken = document.getElementById("statusToken");
  const statusLoad = document.getElementById("statusLoad");
  const statusSend = document.getElementById("statusSend");
  const statusMessage = document.getElementById("statusMessage");
  const themeButton = document.getElementById("btn-theme");
  const repoTreeEl = document.getElementById("repoTree");
  const repoTreeActivePath = document.getElementById("repoTreeActivePath");
  const editorFileLabel = document.getElementById("editorFileLabel");
  const refreshTreeButton = document.getElementById("btn-refresh-tree");
  const confirmOverlay = document.getElementById("confirmOverlay");
  const confirmModal = document.getElementById("confirmModal");
  const confirmTitle = document.getElementById("confirmModalTitle");
  const confirmMessage = document.getElementById("confirmModalMessage");
  const confirmCancel = document.getElementById("confirmModalCancel");
  const confirmOk = document.getElementById("confirmModalConfirm");
  const confirmClose = document.getElementById("confirmModalClose");
  const toastContainer = document.getElementById("toast-container");

  if (typeof IndustrialHUD !== "undefined") {
    IndustrialHUD.init("#app", { themeRoot: document.documentElement });
  }

  function closeDialog(result = false) {
    confirmOverlay?.classList.remove("active");
    confirmModal?.classList.remove("active", "is-notice");
    if (!confirmResolver) return;
    const resolve = confirmResolver;
    confirmResolver = null;
    resolve(result);
  }

  function showDialog(title, message, notice = false, type = "warning") {
    return new Promise((resolve) => {
      if (confirmResolver) confirmResolver(false);
      confirmResolver = resolve;
      if (confirmTitle) confirmTitle.textContent = title;
      if (confirmMessage) confirmMessage.textContent = message;
      confirmModal?.setAttribute("data-alert-type", type);
      confirmModal?.classList.toggle("is-notice", notice);
      confirmOverlay?.classList.add("active");
      confirmModal?.classList.add("active");
    });
  }

  function removeToast(el) {
    if (!el?.isConnected) return;
    el.classList.add("closing");
    setTimeout(() => el.remove(), 300);
  }

  // Powiadomienia idą na toasty, żeby nie blokowały drugim modalem po confirm
  function showNotice(title, message, level = "info") {
    if (typeof IndustrialHUD !== "undefined") {
      IndustrialHUD.toast(level, title, message, 4000);
      return Promise.resolve(true);
    }
    if (!toastContainer) {
      return showDialog(title, message, true, level);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${level}`;

    const header = document.createElement("div");
    header.className = "toast-header";

    const label = document.createElement("span");
    label.className = "toast-label";
    label.textContent = title;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast-close";
    close.setAttribute("aria-label", "Zamknij");
    close.innerHTML = '<i class="fas fa-times"></i>';
    close.addEventListener("click", () => removeToast(toast));

    const body = document.createElement("p");
    body.className = "toast-message";
    body.textContent = message;

    header.append(label, close);
    toast.append(header, body);
    toastContainer.appendChild(toast);

    setTimeout(() => toast.remove(), 5100);
    return Promise.resolve(true);
  }

  function showConfirm(title, message, type = "warning") {
    if (typeof IndustrialHUD !== "undefined") {
      return IndustrialHUD.confirm({ type, title, message });
    }
    return showDialog(title, message, false, type);
  }

  function sanitizeUrl(url) {
    try {
      if (!url) return "";
      const u = new URL(url);

      if (u.hostname === "github.com" && u.pathname.includes("/blob/")) {
        u.hostname = "raw.githubusercontent.com";
        u.pathname = u.pathname.replace("/blob/", "/");
      }

      if (u.hostname === "gist.github.com") {
        u.hostname = "gist.githubusercontent.com";
      }

      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function getSecretKey() {
    return atob("dzVn");
  }

  function xorDecode(b64Str, key) {
    const k = key || getSecretKey();
    try {
      const raw = atob(b64Str);
      let result = "";
      for (let i = 0; i < raw.length; i++) {
        result += String.fromCharCode(
          raw.charCodeAt(i) ^ k.charCodeAt(i % k.length),
        );
      }
      return result;
    } catch (e) {
      console.error("Failed to decode token:", e);
      return null;
    }
  }

  function loadAccountSettings() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(ACCOUNT_SETTINGS_KEY) || "{}",
      );
      return { ...defaults, ...saved };
    } catch {
      return { ...defaults };
    }
  }

  function saveAccountSettings(settings) {
    localStorage.setItem(ACCOUNT_SETTINGS_KEY, JSON.stringify(settings));
  }

  function setChipState(el, text, state = "") {
    if (!el) return;
    const chip = el.closest(".status-chip");
    const states = ["is-ok", "is-warn", "is-error", "is-busy"];
    el.textContent = text;
    el.classList.remove(...states);
    chip?.classList.remove(...states);
    if (state) {
      el.classList.add(state);
      chip?.classList.add(state);
    }
  }

  function getMessageState(message, fallback = "") {
    if (fallback) return fallback;
    if (/\b(fail|err|błąd)\b/i.test(message)) return "is-error";
    if (/\b(wait|warn|brak|anulowan|wpisz)\b/i.test(message)) return "is-warn";
    if (
      /…|\b(pobieranie|otwieranie|wysyłanie|przygotowanie)\b/i.test(message)
    ) {
      return "is-busy";
    }
    if (/\b(ok|aktywny|zapisano|zapisany|odświeżona)\b/i.test(message)) {
      return "is-ok";
    }
    return "";
  }

  function setSystemStatus({
    token,
    tokenState,
    load,
    loadState,
    send,
    sendState,
    message,
    messageState,
  } = {}) {
    if (token !== undefined) setChipState(statusToken, token, tokenState);
    if (load !== undefined) setChipState(statusLoad, load, loadState);
    if (send !== undefined) setChipState(statusSend, send, sendState);
    if (message !== undefined && statusMessage) {
      setChipState(
        statusMessage,
        message,
        getMessageState(
          message,
          messageState || tokenState || loadState || sendState,
        ),
      );
    }
    if (message !== undefined && accountOpStatus) {
      accountOpStatus.textContent = `Ostatnia operacja: ${message}`;
    }
  }

  function isValidGithubToken(token) {
    return (
      typeof token === "string" &&
      (token.startsWith("ghp_") ||
        token.startsWith("github_pat_") ||
        token.startsWith("gho_") ||
        token.startsWith("ghu_"))
    );
  }

  function updateTokenStatus(ready, source = tokenSource) {
    tokenSource = ready ? source : null;
    if (tokenStatus) {
      if (!ready) {
        tokenStatus.textContent = "Token: brak";
      } else if (source === "manual") {
        tokenStatus.textContent = "Token: OK (ręczny)";
      } else {
        tokenStatus.textContent = "Token: OK (linki_pat)";
      }
    }

    setSystemStatus({
      token: ready ? "OK" : "BRAK",
      tokenState: ready ? "is-ok" : "is-warn",
      message: ready
        ? `Token aktywny (${source === "manual" ? "ręczny" : "linki_pat"})`
        : "Brak tokena — pobierz linki_pat lub wpisz ręcznie",
    });
  }

  function fillAccountForm(settings) {
    if (ghOwnerInput) ghOwnerInput.value = settings.owner || defaults.owner;
    if (ghRepoInput) ghRepoInput.value = settings.repo || defaults.repo;
    if (ghPathInput) ghPathInput.value = settings.path || defaults.path;
    if (ghTokenInput) ghTokenInput.value = settings.token || "";
    if (ghXorKeyInput) ghXorKeyInput.value = settings.xorKey || "";
    updateTokenStatus(
      Boolean(settings.token || cachedPatToken),
      settings.token ? "manual" : tokenSource || "linki_pat",
    );
  }

  function readAccountForm() {
    return {
      owner: (ghOwnerInput?.value || defaults.owner).trim() || defaults.owner,
      repo: (ghRepoInput?.value || defaults.repo).trim() || defaults.repo,
      path: (ghPathInput?.value || defaults.path).trim() || defaults.path,
      token: (ghTokenInput?.value || "").trim(),
      xorKey: (ghXorKeyInput?.value || "").trim(),
    };
  }

  function openAccountModal() {
    fillAccountForm(loadAccountSettings());
    setAuthFetched(Boolean(encryptedPat));
    accountOverlay?.classList.add("active");
    accountModal?.classList.add("active");
    if (!encryptedPat) autoFetchAuth();
  }

  async function autoFetchAuth() {
    try {
      await fetchEncryptedPat();
      setAuthFetched(true);
      setSystemStatus({
        token: "WAIT",
        tokenState: "is-warn",
        message: "auth.json pobrany — wpisz hasło XOR",
      });
      if (accountModal?.classList.contains("active")) ghXorKeyInput?.focus();
    } catch (error) {
      setAuthFetched(false);
      setSystemStatus({
        token: "ERR",
        tokenState: "is-error",
        message: `Auth FAIL: ${error.message}`,
      });
    }
  }

  function closeAccountModal() {
    accountOverlay?.classList.remove("active");
    accountModal?.classList.remove("active");
  }

  function buildRawUrls(settings) {
    const path = String(settings.path || defaults.path).replace(/^\/+/, "");
    const owner = settings.owner || defaults.owner;
    const repo = settings.repo || defaults.repo;
    // CDN raw.githubusercontent.com trzyma plik ~5 min, więc doklejamy cache-buster
    const bust = `?t=${Date.now()}`;
    return {
      main: sanitizeUrl(
        `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}${bust}`,
      ),
      master: sanitizeUrl(
        `https://raw.githubusercontent.com/${owner}/${repo}/master/${path}${bust}`,
      ),
    };
  }

  // Bez nagłówków Cache-Control/Pragma — na raw.githubusercontent.com wywołują
  // preflight CORS, który kończy się błędem. Świeżość daje cache-buster w URL.
  const NO_CACHE_INIT = { cache: "no-store", headers: {} };

  async function fetchJsonFromApi(settings, token) {
    const owner = settings.owner || defaults.owner;
    const repo = settings.repo || defaults.repo;
    const path = String(settings.path || defaults.path).replace(/^\/+/, "");
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=main&t=${Date.now()}`;

    const res = await fetch(apiUrl, {
      ...NO_CACHE_INIT,
      headers: {
        ...NO_CACHE_INIT.headers,
        Accept: "application/vnd.github.raw+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      throw new Error(`API zwróciło ${res.status}`);
    }

    return JSON.parse(await res.text());
  }

  async function fetchJsonWithFallback(settings) {
    // Z tokenem czytamy przez API — omija cache CDN i zawsze zwraca HEAD gałęzi
    if (cachedPatToken || (settings.token || "").trim()) {
      try {
        const token = await getPatToken(settings);
        if (token) return await fetchJsonFromApi(settings, token);
      } catch (error) {
        console.warn(
          `Odczyt przez API nieudany (${error.message}). Fallback na raw.`,
        );
      }
    }

    const { main, master } = buildRawUrls(settings);
    console.log(`Próba pobrania danych z: ${main}`);

    const mainRes = await fetch(main, NO_CACHE_INIT);
    if (mainRes.ok) return mainRes.json();

    console.warn(
      `Błąd pobierania z main (${mainRes.status}). Próba z gałęzi master: ${master}`,
    );
    const masterRes = await fetch(master, NO_CACHE_INIT);
    if (!masterRes.ok) {
      throw new Error(
        `Nie znaleziono pliku w gałęziach main ani master (Status: ${masterRes.status})`,
      );
    }
    return masterRes.json();
  }

  function setAuthFetched(fetched) {
    if (authStatus) {
      authStatus.textContent = fetched
        ? "Auth: pobrano (linki_pat zaszyfrowany)"
        : "Auth: nie pobrano";
    }
    if (ghXorKeyInput) {
      ghXorKeyInput.disabled = !fetched;
      ghXorKeyInput.placeholder = fetched
        ? "wpisz hasło i kliknij DECRYPT"
        : "najpierw pobierz auth.json";
    }
    if (decryptButton) decryptButton.disabled = !fetched;
  }

  // Krok 1: pobranie zaszyfrowanego linki_pat
  async function fetchEncryptedPat() {
    setSystemStatus({
      token: "...",
      tokenState: "is-busy",
      message: "Pobieranie auth.json…",
    });

    const res = await fetch(`${AUTH_URL}?t=${Date.now()}`, NO_CACHE_INIT);
    if (!res.ok) {
      throw new Error(`Nie udało się pobrać auth.json (${res.status})`);
    }

    const data = await res.json();
    let patEncrypted = null;
    if (Array.isArray(data)) {
      const found = data.find((item) => item && item.linki_pat);
      if (found) patEncrypted = found.linki_pat;
    } else if (data?.linki_pat) {
      patEncrypted = data.linki_pat;
    }

    if (!patEncrypted) {
      throw new Error("Brak klucza linki_pat w auth.json");
    }

    encryptedPat = patEncrypted;
    return patEncrypted;
  }

  // Krok 2: odszyfrowanie pobranego linki_pat hasłem
  function decryptPat(settings) {
    if (!encryptedPat) {
      throw new Error("Najpierw pobierz auth.json.");
    }

    const key = String(settings.xorKey || "").trim();
    if (!key) {
      throw new Error("Wpisz hasło XOR.");
    }

    const decoded = xorDecode(encryptedPat, key);
    if (!decoded) {
      throw new Error("Nie udało się odszyfrować linki_pat.");
    }
    if (!isValidGithubToken(decoded)) {
      throw new Error("Błędne hasło — wynik nie jest tokenem GitHub.");
    }

    cachedPatToken = decoded;
    updateTokenStatus(true, "linki_pat");
    return decoded;
  }

  async function getPatToken(settings = loadAccountSettings()) {
    const manualToken = (settings.token || "").trim();
    if (manualToken) {
      cachedPatToken = manualToken;
      updateTokenStatus(true, "manual");
      if (!isValidGithubToken(manualToken)) {
        setSystemStatus({
          token: "WARN",
          tokenState: "is-warn",
          message: "Token ręczny ustawiony, ale format wygląda nietypowo",
        });
      }
      return manualToken;
    }

    if (cachedPatToken) {
      updateTokenStatus(true, tokenSource || "linki_pat");
      return cachedPatToken;
    }

    // Hasło już znane (zapisane) — pobierz i odszyfruj bez pytania
    if (String(settings.xorKey || "").trim()) {
      if (!encryptedPat) await fetchEncryptedPat();
      return decryptPat(settings);
    }

    updateTokenStatus(false);
    throw new Error(
      "Brak tokena — pobierz auth.json i odszyfruj hasłem w ustawieniach konta.",
    );
  }

  async function pushJsonToGithub(settings, payload, token) {
    const owner = settings.owner || defaults.owner;
    const repo = settings.repo || defaults.repo;
    const path = String(settings.path || defaults.path).replace(/^\/+/, "");
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    // sha musi być świeże, inaczej GitHub odrzuci zapis jako konflikt
    let sha;
    const metaRes = await fetch(`${apiUrl}?ref=main&t=${Date.now()}`, {
      ...NO_CACHE_INIT,
      headers: { ...headers, ...NO_CACHE_INIT.headers },
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      sha = meta.sha;
    } else if (metaRes.status !== 404) {
      const errText = await metaRes.text();
      throw new Error(
        `Nie udało się odczytać pliku z API (${metaRes.status}): ${errText}`,
      );
    }

    const body = {
      message: `panel: update ${path}`,
      content: btoa(
        unescape(encodeURIComponent(JSON.stringify(payload, null, 2))),
      ),
      branch: "main",
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`Wysyłka nieudana (${putRes.status}): ${errText}`);
    }

    return putRes.json();
  }

  function isEditorDirty() {
    if (!editorRef) return false;
    return editorRef.getValue() !== editorBaseline;
  }

  function markEditorClean(value = editorRef?.getValue() || "") {
    editorBaseline = value;
  }

  function setActiveFilePath(path) {
    currentFilePath = path || null;
    if (repoTreeActivePath) {
      repoTreeActivePath.textContent = path || "—";
      repoTreeActivePath.title = path || "";
    }
    if (editorFileLabel) {
      editorFileLabel.textContent = path
        ? path.split("/").pop()
        : "JSON Editor";
    }

    repoTreeEl?.querySelectorAll(".repo-tree-file.active").forEach((el) => {
      el.classList.remove("active");
    });
    if (path) {
      const active = repoTreeEl?.querySelector(
        `.repo-tree-file[data-path="${CSS.escape(path)}"]`,
      );
      active?.classList.add("active");
    }
  }

  function buildTreeNodes(paths) {
    const root = { name: "", children: new Map(), files: [] };

    for (const path of paths) {
      const parts = path.split("/").filter(Boolean);
      let node = root;
      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        if (isFile) {
          node.files.push({ name: part, path });
          return;
        }
        if (!node.children.has(part)) {
          node.children.set(part, {
            name: part,
            children: new Map(),
            files: [],
          });
        }
        node = node.children.get(part);
      });
    }

    return root;
  }

  function renderTreeNode(node, depth = 0) {
    const frag = document.createDocumentFragment();
    const folders = [...node.children.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));

    for (const folder of folders) {
      const wrap = document.createElement("div");
      wrap.className = "repo-tree-node open";
      wrap.style.setProperty("--depth", String(depth));

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "repo-tree-folder";
      btn.style.paddingLeft = `${0.55 + depth * 0.75}rem`;
      btn.innerHTML = `<i class="fas fa-folder"></i><i class="fas fa-folder-open"></i><span>${folder.name}</span>`;
      btn.addEventListener("click", () => {
        wrap.classList.toggle("open");
      });

      const kids = document.createElement("div");
      kids.className = "repo-tree-children";
      kids.appendChild(renderTreeNode(folder, depth + 1));

      wrap.appendChild(btn);
      wrap.appendChild(kids);
      frag.appendChild(wrap);
    }

    for (const file of files) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "repo-tree-file";
      btn.dataset.path = file.path;
      btn.style.paddingLeft = `${0.55 + depth * 0.75}rem`;
      btn.title = file.path;
      btn.innerHTML = `<i-icon class="repo-tree-json-icon" name="swagger" color="#ffb74d" size="18"></i-icon><span>${file.name}</span>`;
      if (file.path === currentFilePath) btn.classList.add("active");
      btn.addEventListener("click", () => {
        openRepoFile(file.path);
      });
      frag.appendChild(btn);
    }

    return frag;
  }

  function renderRepoTree(paths) {
    if (!repoTreeEl) return;
    repoTreeEl.innerHTML = "";
    if (!paths.length) {
      repoTreeEl.innerHTML =
        '<div class="repo-tree-empty">Brak plików w repozytorium.</div>';
      return;
    }
    repoTreeEl.appendChild(renderTreeNode(buildTreeNodes(paths)));
  }

  async function fetchRepoTree(settings = loadAccountSettings()) {
    const owner = settings.owner || defaults.owner;
    const repo = settings.repo || defaults.repo;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1&t=${Date.now()}`;
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    try {
      const token = cachedPatToken || (settings.token || "").trim();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (_) {}

    if (repoTreeEl) {
      repoTreeEl.innerHTML =
        '<div class="repo-tree-empty">Ładowanie drzewa…</div>';
    }

    const res = await fetch(apiUrl, { ...NO_CACHE_INIT, headers });
    if (!res.ok) {
      throw new Error(`Nie udało się pobrać drzewa (${res.status})`);
    }

    const data = await res.json();
    const paths = (data.tree || [])
      .filter((item) => item.type === "blob")
      .map((item) => item.path)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    repoTreePaths = paths;
    renderRepoTree(paths);
    setSystemStatus({
      message: `Drzewo OK — ${paths.length} plików (${owner}/${repo})`,
    });
    return paths;
  }

  async function openRepoFile(path, { force = false } = {}) {
    if (!path) return;
    if (!force && path === currentFilePath && !isEditorDirty()) return;

    if (!force && isEditorDirty()) {
      const confirmed = await showConfirm(
        "Niezapisane zmiany",
        `Masz niezapisane zmiany w ${currentFilePath || "edytorze"}. Otworzyć ${path} i porzucić je?`,
      );
      if (!confirmed) return;
    }

    const settings = {
      ...loadAccountSettings(),
      path,
    };
    saveAccountSettings(settings);
    if (ghPathInput) ghPathInput.value = path;

    setSystemStatus({
      load: "...",
      loadState: "is-busy",
      message: `Otwieranie ${path}…`,
    });

    try {
      const data = await fetchJsonWithFallback(settings);
      const text = JSON.stringify(data, null, 2);
      if (editorRef) {
        editorRef.setValue(text);
        markEditorClean(text);
      } else {
        editorBaseline = text;
      }
      setActiveFilePath(path);
      setSystemStatus({
        load: "OK",
        loadState: "is-ok",
        message: `OPEN OK — ${path}`,
      });
    } catch (error) {
      setSystemStatus({
        load: "ERR",
        loadState: "is-error",
        message: `OPEN FAIL: ${error.message}`,
      });
      await showNotice("Błąd otwarcia", error.message, "critical");
    }
  }

  function applyMonacoTheme(theme) {
    if (!window.monaco?.editor) return;

    if (typeof window.defineMonacoThemes === "function") {
      window.defineMonacoThemes();
    }

    const monacoTheme = theme === "light" ? "terminal-light" : "terminal-dark";
    monaco.editor.setTheme(monacoTheme);

    try {
      localStorage.setItem(KIT_THEME_KEY, theme === "light" ? "light" : "dark");
    } catch (_) {}
  }

  function applyTheme(theme) {
    const isLight = theme === "light";

    if (typeof IndustrialHUD !== "undefined") {
      IndustrialHUD.setTheme(!isLight);
    } else if (isLight) {
      document.documentElement.removeAttribute("theme");
    } else {
      document.documentElement.setAttribute("theme", "dark");
    }

    if (themeButton) {
      const label = themeButton.querySelector(".theme-toggle__label");
      const icon = themeButton.querySelector(".theme-toggle__icon");
      if (label) label.textContent = isLight ? "Ciemny" : "Jasny";
      if (icon) {
        icon.classList.toggle("fa-sun", !isLight);
        icon.classList.toggle("fa-moon", isLight);
      }
      const targetTheme = isLight ? "ciemny" : "jasny";
      themeButton.setAttribute("aria-label", `Włącz motyw ${targetTheme}`);
      themeButton.title = `Włącz motyw ${targetTheme}`;
      themeButton.setAttribute("aria-pressed", String(!isLight));
    }

    applyMonacoTheme(isLight ? "light" : "dark");
  }

  const savedTheme =
    localStorage.getItem("panel-theme") || localStorage.getItem(KIT_THEME_KEY);
  applyTheme(savedTheme === "light" ? "light" : "dark");

  const bootSettings = loadAccountSettings();
  fillAccountForm(bootSettings);
  setAuthFetched(false);
  setActiveFilePath(bootSettings.path || defaults.path);
  if (bootSettings.token) {
    cachedPatToken = bootSettings.token;
    updateTokenStatus(true, "manual");
  } else {
    // Krok 1 leci od razu w tle — po wpisaniu hasła zostaje tylko deszyfracja
    autoFetchAuth();
  }

  fetchRepoTree(bootSettings).catch(async (error) => {
    if (repoTreeEl) {
      repoTreeEl.innerHTML = `<div class="repo-tree-error">Drzewo FAIL: ${error.message}</div>`;
    }
    setSystemStatus({
      message: `Drzewo FAIL: ${error.message}`,
    });
  });

  refreshTreeButton?.addEventListener("click", async () => {
    try {
      await fetchRepoTree(loadAccountSettings());
      if (currentFilePath) setActiveFilePath(currentFilePath);
      await showNotice("Drzewo", "Lista plików odświeżona.", "success");
    } catch (error) {
      if (repoTreeEl) {
        repoTreeEl.innerHTML = `<div class="repo-tree-error">Drzewo FAIL: ${error.message}</div>`;
      }
      await showNotice("Błąd drzewa", error.message, "critical");
    }
  });

  themeButton?.addEventListener("click", () => {
    const current =
      typeof IndustrialHUD !== "undefined"
        ? IndustrialHUD.getTheme()
        : document.documentElement.getAttribute("theme") || "light";
    const nextTheme = current === "light" ? "dark" : "light";
    localStorage.setItem("panel-theme", nextTheme);
    applyTheme(nextTheme);
  });

  document
    .getElementById("btn-account")
    ?.addEventListener("click", openAccountModal);
  document
    .getElementById("accountModalClose")
    ?.addEventListener("click", closeAccountModal);
  accountOverlay?.addEventListener("click", closeAccountModal);
  confirmOk?.addEventListener("click", () => closeDialog(true));
  confirmCancel?.addEventListener("click", () => closeDialog(false));
  confirmClose?.addEventListener("click", () => closeDialog(false));
  confirmOverlay?.addEventListener("click", () => closeDialog(false));

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (confirmModal?.classList.contains("active")) {
      closeDialog(false);
      return;
    }
    closeAccountModal();
  });

  // Krok 1: pobierz auth.json (bez hasła)
  fetchAuthButton?.addEventListener("click", async () => {
    try {
      cachedPatToken = null;
      tokenSource = null;
      encryptedPat = null;
      setAuthFetched(false);

      await fetchEncryptedPat();
      setAuthFetched(true);
      updateTokenStatus(false);
      setSystemStatus({
        token: "WAIT",
        tokenState: "is-warn",
        message: "auth.json pobrany — wpisz hasło XOR",
      });
      ghXorKeyInput?.focus();
    } catch (error) {
      setAuthFetched(false);
      setSystemStatus({
        token: "ERR",
        tokenState: "is-error",
        message: `Auth FAIL: ${error.message}`,
      });
      await showNotice("Błąd pobierania", error.message, "critical");
    }
  });

  // Krok 2: odszyfruj hasłem i zapisz
  decryptButton?.addEventListener("click", async () => {
    try {
      const settings = readAccountForm();
      const token = decryptPat(settings);

      settings.token = token;
      if (ghTokenInput) ghTokenInput.value = token;
      saveAccountSettings(settings);
      setSystemStatus({
        token: "OK",
        tokenState: "is-ok",
        message: "Token odszyfrowany i zapisany lokalnie",
      });
      await showNotice(
        "Token zapisany",
        "Hasło XOR i odszyfrowany token zapisane lokalnie.",
        "success",
      );
    } catch (error) {
      updateTokenStatus(false);
      setSystemStatus({
        token: "ERR",
        tokenState: "is-error",
        message: `Deszyfracja FAIL: ${error.message}`,
      });
      await showNotice("Błąd deszyfracji", error.message, "critical");
    }
  });

  document
    .getElementById("btn-save-account")
    ?.addEventListener("click", async () => {
      const settings = readAccountForm();
      const confirmed = await showConfirm(
        "Zapisać ustawienia?",
        "Ustawienia konta (owner / repo / path / hasło XOR / token) zostaną zapisane lokalnie.",
      );
      if (!confirmed) return;

      saveAccountSettings(settings);
      if (settings.token) {
        cachedPatToken = settings.token;
        updateTokenStatus(true, "manual");
      } else if (cachedPatToken) {
        settings.token = cachedPatToken;
        saveAccountSettings(settings);
        updateTokenStatus(true, tokenSource || "linki_pat");
      } else if (!cachedPatToken) {
        updateTokenStatus(false);
      }
      setSystemStatus({
        message: "Ustawienia konta zapisane lokalnie",
      });
      await showNotice(
        "Zapisano",
        "Ustawienia konta zapisane lokalnie.",
        "success",
      );
      closeAccountModal();
    });

  // Enter na haśle XOR = odszyfruj
  ghXorKeyInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      decryptButton?.click();
    }
  });

  /* --- Zmiana tła z Nawigacji --- */
  const navPills = document.querySelectorAll(".nav-pill");
  const visualHeader = document.querySelector(".visual-header");

  navPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      if (pill.id === "btn-theme") return;

      navPills.forEach((p) => {
        if (p.id !== "btn-theme") p.classList.remove("active");
      });
      pill.classList.add("active");

      const newBg = pill.getAttribute("data-bg");
      if (newBg && visualHeader) {
        visualHeader.style.backgroundImage = newBg;
      }
    });
  });

  /* --- Inicjalizacja Monaco Editor --- */
  if (typeof require !== "undefined") {
    require.config({
      paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs",
      },
    });

    require(["vs/editor/editor.main"], function () {
      const editorContainer = document.getElementById("editor-container");
      if (!editorContainer) return;

      const editor = monaco.editor.create(editorContainer, {
        value:
          "[\n  // Kliknij plik po lewej albo 'Pobierz', aby wczytać JSON\n]",
        language: "json",
        automaticLayout: true,
      });
      editorRef = editor;
      markEditorClean(editor.getValue());

      if (
        window.MonacoEditorSettings &&
        typeof window.MonacoEditorSettings.init === "function"
      ) {
        window.MonacoEditorSettings.init(editor);
      } else {
        console.warn("Nie załadowano modułu window.MonacoEditorSettings.init");
      }

      applyMonacoTheme(
        (typeof IndustrialHUD !== "undefined"
          ? IndustrialHUD.getTheme()
          : document.documentElement.getAttribute("theme") || "light") ===
          "light"
          ? "light"
          : "dark",
      );

      function getCurrentJson() {
        try {
          return JSON.parse(editor.getValue());
        } catch (e) {
          showNotice(
            "Błąd JSON",
            "Błąd składni JSON! Popraw strukturę dokumentu.",
            "critical",
          );
          return null;
        }
      }

      function setJsonValue(obj) {
        editor.setValue(JSON.stringify(obj, null, 2));
      }

      function nameFromUrl(rawUrl) {
        const value = String(rawUrl || "").trim();
        if (!value) return " ";

        try {
          const parsed = new URL(
            /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`,
          );
          const host = parsed.hostname.replace(/^www\./i, "");

          if (/\.github\.io$/i.test(host)) {
            const segment = parsed.pathname.split("/").filter(Boolean)[0];
            if (segment) return decodeURIComponent(segment).toUpperCase();
          }

          return host.split(".")[0].toUpperCase() || " ";
        } catch {
          return " ";
        }
      }

      document
        .getElementById("btn-load")
        .addEventListener("click", async () => {
          try {
            if (isEditorDirty()) {
              const confirmed = await showConfirm(
                "Niezapisane zmiany",
                "Masz lokalne zmiany. Nadpisać edytor danymi z GitHub?",
              );
              if (!confirmed) return;
            }

            setSystemStatus({
              load: "...",
              loadState: "is-busy",
              message: "Pobieranie JSON z GitHub…",
            });
            const settings = loadAccountSettings();
            const data = await fetchJsonWithFallback(settings);
            setJsonValue(data);
            markEditorClean(editor.getValue());
            setActiveFilePath(settings.path);
            const count = Array.isArray(data) ? data.length : 1;
            setSystemStatus({
              load: "OK",
              loadState: "is-ok",
              message: `LOAD OK — wczytano ${count} elementów`,
            });
            await showNotice(
              "Załadowano",
              `Dane pobrane poprawnie (${count} elementów).`,
              "success",
            );
          } catch (error) {
            console.error("Krytyczny błąd ładowania:", error);
            setSystemStatus({
              load: "ERR",
              loadState: "is-error",
              message: `LOAD FAIL: ${error.message}`,
            });
            await showNotice("Błąd ładowania", error.message, "critical");
          }
        });

      document.getElementById("btn-add").addEventListener("click", () => {
        const data = getCurrentJson();
        if (data && Array.isArray(data)) {
          let maxNum = -1;
          for (const item of data) {
            const match = String(item?.id || "").match(/^RES_(\d+)$/i);
            if (match) {
              maxNum = Math.max(maxNum, Number(match[1]));
            }
          }

          const nextId = `RES_${String(maxNum + 1).padStart(3, "0")}`;
          const url = " ";

          data.push({
            id: nextId,
            name: nameFromUrl(url),
            url,
            type: " ",
            status: " ",
          });
          setJsonValue(data);
        }
      });

      document.getElementById("btn-remove").addEventListener("click", () => {
        const data = getCurrentJson();
        if (data && Array.isArray(data) && data.length > 0) {
          data.pop();
          setJsonValue(data);
        }
      });

      document.getElementById("btn-settings").addEventListener("click", () => {
        if (
          window.MonacoEditorSettings &&
          typeof window.MonacoEditorSettings.showSettings === "function"
        ) {
          window.MonacoEditorSettings.showSettings();
        } else {
          showNotice(
            "Ustawienia edytora",
            "Panel ustawień edytora nie jest dostępny.",
            "warning",
          );
        }
      });

      document
        .getElementById("btn-send")
        .addEventListener("click", async () => {
          const data = getCurrentJson();
          if (!data) return;

          if (Array.isArray(data)) {
            for (const item of data) {
              const currentName = String(item?.name || "").trim();
              const fromUrl = nameFromUrl(item?.url);
              if (!currentName && fromUrl.trim()) {
                item.name = fromUrl;
              }
              if (item?.url) {
                item.url = sanitizeUrl(item.url) || item.url;
              }
            }
            setJsonValue(data);
          }

          try {
            setSystemStatus({
              send: "...",
              sendState: "is-busy",
              message: "Przygotowanie wysyłki…",
            });

            const settings = loadAccountSettings();
            const token = await getPatToken(settings);
            if (!token) {
              throw new Error(
                "Brak tokena — pobierz linki_pat w ustawieniach konta.",
              );
            }

            const confirmed = await showConfirm(
              "Wysłać na GitHub?",
              `Plik ${settings.path} w ${settings.owner}/${settings.repo} zostanie nadpisany.`,
            );
            if (!confirmed) {
              setSystemStatus({
                send: "ABORT",
                sendState: "is-warn",
                message: "Wysyłka anulowana",
              });
              return;
            }

            setSystemStatus({
              send: "...",
              sendState: "is-busy",
              message: "Wysyłanie pliku przez GitHub API…",
            });

            const result = await pushJsonToGithub(settings, data, token);
            const commitSha =
              result?.commit?.sha?.slice(0, 7) ||
              result?.content?.sha?.slice(0, 7) ||
              "ok";

            markEditorClean(editor.getValue());
            setActiveFilePath(settings.path);
            await fetchRepoTree(settings).catch(() => {});

            setSystemStatus({
              send: "OK",
              sendState: "is-ok",
              message: `SEND OK — commit ${commitSha}`,
            });
            await showNotice(
              "Wysłano",
              `Plik zapisany na GitHubie. Commit: ${commitSha}`,
              "success",
            );
          } catch (error) {
            setSystemStatus({
              send: "ERR",
              sendState: "is-error",
              message: `SEND FAIL: ${error.message}`,
            });
            await showNotice("Błąd wysyłki", error.message, "critical");
          }
        });

      window.addEventListener("resize", () => {
        editor.layout();
      });
    });
  }
});
