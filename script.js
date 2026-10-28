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
  let rawAuthData = null;
  let editorRef = null;
  let currentFilePath = null;
  let editorBaseline = "";
  let repoTreePaths = [];
  let confirmResolver = null;

  const FALLBACK_REPO_FILES = [
    "card.json",
    "dev/auth.json",
    "grafik.json",
    "html.json",
    "linki/home.json",
    "linki/linki.json",
    "main.json",
    "mobile-grafik.json",
    "mobile-w.json",
    "norma.json",
    "note_hub.json",
    "notes.json",
    "opisy.json",
    "pass.json",
    "terminal.json",
    "tools.json",
    "w5g.json",
  ];

  const accountOverlay = document.getElementById("accountModalOverlay");
  const accountModal = document.getElementById("accountModal");
  const templateOverlay = document.getElementById("templateModalOverlay");
  const templateModal = document.getElementById("templateModal");
  const templateStatus = document.getElementById("templateModalStatus");
  const dynamicFieldsContainer = document.getElementById("dynamicFieldsContainer");
  const kvFieldsContainer = document.getElementById("kvFieldsContainer");
  const rawFieldsContainer = document.getElementById("rawFieldsContainer");
  const tplKvKey = document.getElementById("tpl-kv-key");
  const tplKvVal = document.getElementById("tpl-kv-val");
  const tplRawJson = document.getElementById("tpl-raw-json");
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
      const settings = loadAccountSettings();
      const xorKey = String(settings.xorKey || "").trim() || getSecretKey();
      try {
        const token = decryptPat({ ...settings, xorKey });
        settings.token = token;
        if (!settings.xorKey) settings.xorKey = xorKey;
        saveAccountSettings(settings);
        if (ghTokenInput) ghTokenInput.value = token;
        if (ghXorKeyInput) ghXorKeyInput.value = xorKey;
      } catch (decErr) {
        setSystemStatus({
          token: "WAIT",
          tokenState: "is-warn",
          message: "auth.json pobrany — wpisz hasło XOR",
        });
      }
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

  function nextHomeId(list = []) {
    let maxNum = -1;
    for (const item of list) {
      const match = String(item?.id || "").match(/^RES_(\d+)$/i);
      if (match) maxNum = Math.max(maxNum, Number(match[1]));
    }
    return `RES_${String(maxNum + 1).padStart(3, "0")}`;
  }

  function detectSchemaKeys(list) {
    if (!Array.isArray(list) || list.length === 0) return [];
    const keySet = new Set();
    for (let i = 0; i < Math.min(list.length, 30); i++) {
      const item = list[i];
      if (item && typeof item === "object" && !Array.isArray(item)) {
        Object.keys(item).forEach((k) => keySet.add(k));
      }
    }
    return Array.from(keySet);
  }

  function getEditableTarget(data) {
    if (!data || typeof data !== "object") return null;

    if (Array.isArray(data)) {
      return {
        root: data,
        list: data,
        kind: "array",
        schemaKeys: detectSchemaKeys(data),
      };
    }

    const candidateArrayProps = [
      "nodes",
      "workers",
      "items",
      "list",
      "links",
      "elements",
    ];
    for (const prop of candidateArrayProps) {
      if (Array.isArray(data[prop])) {
        return {
          root: data,
          list: data[prop],
          kind: "nested_array",
          propName: prop,
          schemaKeys: detectSchemaKeys(data[prop]),
        };
      }
    }

    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val)) {
        return {
          root: data,
          list: val,
          kind: "nested_array",
          propName: key,
          schemaKeys: detectSchemaKeys(val),
        };
      }
    }

    return {
      root: data,
      kind: "object",
      keys: Object.keys(data),
    };
  }

  function addDynamicFieldRow(key, target, defaultValue = "") {
    if (!dynamicFieldsContainer) return;

    const row = document.createElement("div");
    row.className = "modal-field dynamic-field-row";

    const header = document.createElement("div");
    header.className = "modal-field-header";

    const labelSpan = document.createElement("span");
    labelSpan.textContent = key;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "field-del-btn";
    delBtn.title = "Usuń to pole z formularza";
    delBtn.innerHTML = '<i class="fas fa-times"></i>';
    delBtn.addEventListener("click", () => row.remove());

    header.appendChild(labelSpan);
    header.appendChild(delBtn);

    const btnBg = document.createElement("div");
    btnBg.className = "btn-bg w-full";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "hud-input";
    input.dataset.key = key;
    input.placeholder = `opcjonalne: wpisz ${key}`;

    if (defaultValue) {
      input.value = defaultValue;
    } else if (key === "id" && target && (currentFilePath || "").includes("home")) {
      input.value = nextHomeId(target.list);
    } else if (key === "date") {
      input.placeholder = "np. " + new Date().toISOString().slice(0, 10);
    } else if (key === "url") {
      input.placeholder = "https://...";
    }

    btnBg.appendChild(input);
    row.appendChild(header);
    row.appendChild(btnBg);
    dynamicFieldsContainer.appendChild(row);
  }

  function renderDynamicForm(target) {
    if (!dynamicFieldsContainer) return;
    dynamicFieldsContainer.innerHTML = "";

    const autoDesc = document.getElementById("tplAutoDesc");
    const fileName = currentFilePath
      ? currentFilePath.split("/").pop()
      : "plik";

    if (target.kind === "object") {
      if (autoDesc) autoDesc.textContent = `Właściwość obiektu (${fileName})`;
      return;
    }

    let keys = target.schemaKeys || [];
    if (keys.length === 0) {
      if (fileName.includes("home")) {
        keys = ["id", "name", "url", "type", "status"];
      } else if (fileName.includes("linki")) {
        keys = ["id", "name", "url"];
      } else if (fileName.includes("card")) {
        keys = ["url", "title", "description"];
      } else if (fileName.includes("notes") || fileName.includes("terminal")) {
        keys = ["name", "content", "date", "mode"];
      } else {
        keys = ["id", "name", "value"];
      }
    }

    if (autoDesc) {
      autoDesc.textContent = `${keys.length} wykrytych pól (${fileName})`;
    }

    keys.forEach((key) => {
      addDynamicFieldRow(key, target);
    });

    if (templateStatus) {
      templateStatus.textContent = `Plik: ${currentFilePath || fileName} (${target.kind === "nested_array" ? `właściwość "${target.propName}"` : "tablica główna"})`;
    }
  }

  function syncTemplateFields(selected) {
    const mode =
      selected ||
      document.querySelector('input[name="item-template"]:checked')?.value ||
      "auto";

    if (dynamicFieldsContainer) dynamicFieldsContainer.hidden = mode !== "auto";
    if (kvFieldsContainer) kvFieldsContainer.hidden = mode !== "kv";
    if (rawFieldsContainer) rawFieldsContainer.hidden = mode !== "raw";

    const addWrapper = document.getElementById("btn-add-field-wrapper");
    if (addWrapper) addWrapper.hidden = mode !== "auto";

    if (templateStatus) {
      if (mode === "auto") {
        templateStatus.textContent = `Tryb: Dopasuj do pliku (${currentFilePath || "bieżący plik"})`;
      } else if (mode === "kv") {
        templateStatus.textContent = "Tryb: Klucz / Wartość";
      } else if (mode === "raw") {
        templateStatus.textContent = "Tryb: Własny JSON";
      }
    }
  }

  function openTemplateModal() {
    let data;
    try {
      data = JSON.parse(editorRef?.getValue?.() || "null");
    } catch {
      showNotice(
        "Błąd JSON",
        "Popraw błędy składni JSON przed dodaniem elementu.",
        "critical",
      );
      return;
    }

    const target = getEditableTarget(data);
    if (!target) {
      showNotice(
        "Dodaj element",
        "Dokument musi być poprawną tablicą lub obiektem JSON.",
        "warning",
      );
      return;
    }

    const fileName = currentFilePath
      ? currentFilePath.split("/").pop()
      : "plik";
    const modalTitle = document.getElementById("templateModalTitle");
    if (modalTitle) {
      modalTitle.innerHTML = `<i class="fas fa-plus text-highlight"></i> Dodaj do ${fileName}`;
    }

    const autoRadio = document.querySelector(
      'input[name="item-template"][value="auto"]',
    );
    const kvRadio = document.querySelector(
      'input[name="item-template"][value="kv"]',
    );

    if (target.kind === "object") {
      if (kvRadio) kvRadio.checked = true;
      syncTemplateFields("kv");
      if (tplKvKey) tplKvKey.value = "";
      if (tplKvVal) tplKvVal.value = "";
    } else {
      if (autoRadio) autoRadio.checked = true;
      renderDynamicForm(target);
      syncTemplateFields("auto");
    }

    if (tplRawJson) tplRawJson.value = "";

    templateOverlay?.classList.add("active");
    templateModal?.classList.add("active");

    setTimeout(() => {
      if (target.kind === "object") {
        tplKvKey?.focus();
      } else {
        const first = dynamicFieldsContainer?.querySelector("input");
        first?.focus();
      }
    }, 50);
  }

  function closeTemplateModal() {
    templateOverlay?.classList.remove("active");
    templateModal?.classList.remove("active");
  }

  function collectModalItem(target) {
    const mode =
      document.querySelector('input[name="item-template"]:checked')?.value ||
      "auto";

    if (mode === "raw") {
      const rawText = tplRawJson?.value.trim();
      if (!rawText) throw new Error("Wklej lub wpisz fragment JSON.");
      try {
        return JSON.parse(rawText);
      } catch (e) {
        throw new Error("Błąd składni JSON: " + e.message);
      }
    }

    if (mode === "kv") {
      const key = tplKvKey?.value.trim();
      const val = tplKvVal?.value.trim();
      if (!key) throw new Error("Podaj nazwę klucza.");
      if (val === "") throw new Error("Podaj wartość klucza.");
      let parsedVal = val;
      if (val === "true") parsedVal = true;
      else if (val === "false") parsedVal = false;
      else if (val === "null") parsedVal = null;
      else if (
        (val.startsWith("{") && val.endsWith("}")) ||
        (val.startsWith("[") && val.endsWith("]"))
      ) {
        try {
          parsedVal = JSON.parse(val);
        } catch (e) {}
      }
      return { [key]: parsedVal };
    }

    // Tryb auto (ze schematu pliku):
    if (target.kind === "object") {
      const key = tplKvKey?.value.trim();
      const val = tplKvVal?.value.trim();
      if (!key) throw new Error("Podaj nazwę klucza.");
      let parsedVal = val;
      if (val === "true") parsedVal = true;
      else if (val === "false") parsedVal = false;
      else if (val === "null") parsedVal = null;
      else if (
        (val.startsWith("{") && val.endsWith("}")) ||
        (val.startsWith("[") && val.endsWith("]"))
      ) {
        try {
          parsedVal = JSON.parse(val);
        } catch (e) {}
      }
      return { [key]: parsedVal };
    }

    // Dla tablic: "nie dodawaj tego czego niema" — TYLKO niepuste pola!
    const inputs =
      dynamicFieldsContainer?.querySelectorAll(
        "input[data-key], textarea[data-key]",
      ) || [];
    const item = {};
    let filledCount = 0;

    inputs.forEach((input) => {
      const key = input.dataset.key;
      const rawVal = input.value.trim();
      if (rawVal !== "") {
        let parsedVal = rawVal;
        if (key === "url") {
          parsedVal = sanitizeUrl(rawVal) || rawVal;
        } else if (rawVal === "true") {
          parsedVal = true;
        } else if (rawVal === "false") {
          parsedVal = false;
        } else if (rawVal === "null") {
          parsedVal = null;
        } else if (
          (rawVal.startsWith("{") && rawVal.endsWith("}")) ||
          (rawVal.startsWith("[") && rawVal.endsWith("]"))
        ) {
          try {
            parsedVal = JSON.parse(rawVal);
          } catch (e) {}
        }
        item[key] = parsedVal;
        filledCount++;
      }
    });

    if (filledCount === 0) {
      throw new Error(
        "Wypełnij przynajmniej jedno pole. Puste pola nie są dodawane.",
      );
    }

    return item;
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
    const owner = settings.owner || defaults.owner;
    const repo = settings.repo || defaults.repo;
    const path = String(settings.path || defaults.path).replace(/^\/+/, "");

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

    try {
      const mainRes = await fetch(main, NO_CACHE_INIT);
      if (mainRes.ok) return await mainRes.json();
    } catch (e) {
      console.warn(`Błąd sieci z main: ${e.message}`);
    }

    console.warn(
      `Błąd pobierania z main. Próba z gałęzi master: ${master}`,
    );
    try {
      const masterRes = await fetch(master, NO_CACHE_INIT);
      if (masterRes.ok) return await masterRes.json();
    } catch (e) {
      console.warn(`Błąd sieci z master: ${e.message}`);
    }

    // Fallback: jsDelivr CDN
    try {
      const cdnUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/${path}?t=${Date.now()}`;
      const cdnRes = await fetch(cdnUrl, NO_CACHE_INIT);
      if (cdnRes.ok) return await cdnRes.json();
    } catch (e) {
      console.warn(`Błąd sieci z jsDelivr CDN: ${e.message}`);
    }

    throw new Error(
      `Nie znaleziono pliku ${path} w gałęziach main ani master.`,
    );
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

  // Krok 1: pobranie zaszyfrowanego tokena z auth.json
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
    rawAuthData = data;
    let patEncrypted = null;
    const preferredKeys = [
      "json_up",
      "note_manager",
      "terminal_pat",
      "notech_pat",
      "mobile_pat",
      "cyber_data",
      "linki_pat",
      "sys_pat",
    ];

    if (Array.isArray(data)) {
      for (const key of preferredKeys) {
        const found = data.find((item) => item && item[key]);
        if (found) {
          patEncrypted = found[key];
          break;
        }
      }
    } else if (data && typeof data === "object") {
      for (const key of preferredKeys) {
        if (data[key]) {
          patEncrypted = data[key];
          break;
        }
      }
    }

    if (!patEncrypted) {
      throw new Error("Brak klucza tokena w auth.json");
    }

    encryptedPat = patEncrypted;
    return patEncrypted;
  }

  // Krok 2: odszyfrowanie pobranego tokena hasłem
  function decryptPat(settings) {
    if (!encryptedPat && !rawAuthData) {
      throw new Error("Najpierw pobierz auth.json.");
    }

    const key = String(settings.xorKey || "").trim() || getSecretKey();
    const candidateKeys = [
      "json_up",
      "note_manager",
      "terminal_pat",
      "notech_pat",
      "mobile_pat",
      "cyber_data",
      "linki_pat",
      "sys_pat",
    ];

    let decoded = null;
    let usedSource = "auth.json";

    if (rawAuthData && typeof rawAuthData === "object") {
      for (const cand of candidateKeys) {
        const enc = Array.isArray(rawAuthData)
          ? rawAuthData.find((it) => it && it[cand])?.[cand]
          : rawAuthData[cand];
        if (enc) {
          const test = xorDecode(enc, key);
          if (isValidGithubToken(test)) {
            decoded = test;
            usedSource = cand;
            encryptedPat = enc;
            break;
          }
        }
      }
    }

    if (!decoded && encryptedPat) {
      decoded = xorDecode(encryptedPat, key);
    }

    if (!decoded) {
      throw new Error("Nie udało się odszyfrować tokena.");
    }
    if (!isValidGithubToken(decoded)) {
      throw new Error("Błędne hasło — wynik nie jest tokenem GitHub.");
    }

    cachedPatToken = decoded;
    updateTokenStatus(true, usedSource);
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

    if (repoTreeEl) {
      repoTreeEl.querySelectorAll(".repo-tree-file.active").forEach((el) => {
        el.classList.remove("active");
        el.closest(".btn-bg")?.classList.remove("active");
      });
      if (path) {
        const active = repoTreeEl.querySelector(
          `.repo-tree-file[data-path="${CSS.escape(path)}"]`
        );
        if (active) {
          active.classList.add("active");
          active.closest(".btn-bg")?.classList.add("active");
          let parentNode = active.closest(".repo-tree-node");
          while (parentNode) {
            parentNode.classList.add("open");
            parentNode = parentNode.parentElement?.closest(".repo-tree-node");
          }
        }
      }
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
      a.name.localeCompare(b.name)
    );
    const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));

    // Każdy FOLDER w kasecie .btn-bg
    for (const folder of folders) {
      const wrap = document.createElement("div");
      wrap.className = "repo-tree-node open";

      const btnBg = document.createElement("div");
      btnBg.className = "btn-bg w-full";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "repo-tree-folder";
      btn.style.paddingLeft = `${0.5 + depth * 0.65}rem`;
      btn.innerHTML = `<i class="fas fa-folder"></i><i class="fas fa-folder-open"></i><span>${folder.name}</span>`;
      btn.addEventListener("click", () => wrap.classList.toggle("open"));

      btnBg.appendChild(btn);

      const kids = document.createElement("div");
      kids.className = "repo-tree-children";
      kids.appendChild(renderTreeNode(folder, depth + 1));

      wrap.appendChild(btnBg);
      wrap.appendChild(kids);
      frag.appendChild(wrap);
    }

    // Każdy PLIK w kasecie .btn-bg
    for (const file of files) {
      const btnBg = document.createElement("div");
      btnBg.className = "btn-bg w-full";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "repo-tree-file";
      btn.dataset.path = file.path;
      btn.style.paddingLeft = `${0.5 + depth * 0.65}rem`;
      btn.title = file.path;
      btn.innerHTML = `<i-icon class="repo-tree-json-icon" name="swagger" color="#f36c00" size="16"></i-icon><span>${file.name}</span>`;

      if (file.path === currentFilePath) {
        btn.classList.add("active");
        btnBg.classList.add("active");
      }

      btn.addEventListener("click", () => openRepoFile(file.path));

      btnBg.appendChild(btn);
      frag.appendChild(btnBg);
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
    const branches = ["main", "master"];

    if (repoTreeEl) {
      repoTreeEl.innerHTML =
        '<div class="repo-tree-empty"><i class="fas fa-spinner fa-spin"></i> Ładowanie drzewa…</div>';
    }

    let token = cachedPatToken || (settings.token || "").trim();
    if (!token && (settings.xorKey || encryptedPat || rawAuthData)) {
      try {
        token = await getPatToken(settings);
      } catch (e) {
        // brak tokena nie blokuje drzewa dla publicznych repozytoriów
      }
    }

    let paths = null;
    let lastError = null;

    // 1. Próba pobrania przez GitHub API git trees
    async function tryFetchGitHubTree(branch, authToken) {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1&t=${Date.now()}`;
      const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      return fetch(apiUrl, { ...NO_CACHE_INIT, headers });
    }

    for (const branch of branches) {
      try {
        let res = null;
        if (token) {
          res = await tryFetchGitHubTree(branch, token);
          if (res.status === 401) {
            console.warn("Drzewo repo: token zwrócił 401. Próba bez autoryzacji...");
            res = await tryFetchGitHubTree(branch, "");
          }
        } else {
          res = await tryFetchGitHubTree(branch, "");
        }

        if (res && res.ok) {
          const data = await res.json();
          if (Array.isArray(data.tree) && data.tree.length > 0) {
            paths = data.tree
              .filter((item) => item.type === "blob")
              .map((item) => item.path)
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b));
            if (paths.length > 0) break;
          }
        } else if (res) {
          lastError = new Error(`GitHub API HTTP ${res.status}`);
        }
      } catch (err) {
        lastError = err;
      }
    }

    // 2. Fallback: jsDelivr Data API (brak limitów rate-limit, natychmiastowe dla publicznych repo)
    if (!paths || !paths.length) {
      for (const branch of branches) {
        try {
          const cdnUrl = `https://data.jsdelivr.com/v1/packages/gh/${owner}/${repo}@${branch}?structure=flat&t=${Date.now()}`;
          const cdnRes = await fetch(cdnUrl, NO_CACHE_INIT);
          if (cdnRes.ok) {
            const cdnData = await cdnRes.json();
            if (Array.isArray(cdnData.files) && cdnData.files.length > 0) {
              paths = cdnData.files
                .map((f) => String(f.name || "").replace(/^\/+/, ""))
                .filter((p) => Boolean(p) && !p.startsWith(".git"))
                .sort((a, b) => a.localeCompare(b));
              if (paths.length > 0) {
                console.log(`Drzewo repozytorium pobrane przez CDN jsDelivr (${paths.length} plików)`);
                break;
              }
            }
          }
        } catch (cdnErr) {
          console.warn("jsDelivr tree fallback nieudany:", cdnErr);
        }
      }
    }

    // 3. Fallback: wbudowana lista plików dla domyślnego repozytorium
    if ((!paths || !paths.length) && owner === defaults.owner && repo === defaults.repo) {
      console.warn("Użyto statycznej listy plików repozytorium jako fallback.");
      paths = [...FALLBACK_REPO_FILES].sort((a, b) => a.localeCompare(b));
    }

    if (!paths || !paths.length) {
      const errMsg = lastError ? lastError.message : "Brak danych drzewa";
      if (repoTreeEl) {
        repoTreeEl.innerHTML = `<div class="repo-tree-error">Drzewo FAIL: ${errMsg}</div>`;
      }
      throw new Error(`Nie udało się pobrać drzewa (${errMsg})`);
    }

    repoTreePaths = paths;
    renderRepoTree(paths);
    if (currentFilePath) {
      setActiveFilePath(currentFilePath);
    }
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
    } catch (_) { }
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
    const icon = refreshTreeButton.querySelector("i");
    try {
      refreshTreeButton.disabled = true;
      icon?.classList.add("fa-spin");
      refreshTreeButton.classList.add("is-busy");
      await fetchRepoTree(loadAccountSettings());
      if (currentFilePath) setActiveFilePath(currentFilePath);
      await showNotice("Drzewo", "Lista plików odświeżona.", "success");
    } catch (error) {
      if (repoTreeEl) {
        repoTreeEl.innerHTML = `<div class="repo-tree-error">Drzewo FAIL: ${error.message}</div>`;
      }
      await showNotice("Błąd drzewa", error.message, "critical");
    } finally {
      icon?.classList.remove("fa-spin");
      refreshTreeButton.classList.remove("is-busy");
      refreshTreeButton.disabled = false;
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
  document
    .getElementById("templateModalClose")
    ?.addEventListener("click", closeTemplateModal);
  document
    .getElementById("btn-cancel-template")
    ?.addEventListener("click", closeTemplateModal);
  templateOverlay?.addEventListener("click", closeTemplateModal);
  document.querySelectorAll('input[name="item-template"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      syncTemplateFields(radio.value);
    });
  });

  document
    .getElementById("btn-add-custom-field")
    ?.addEventListener("click", () => {
      const key = prompt("Podaj nazwę nowego pola (klucza):");
      if (!key) return;
      const cleanKey = key.trim().replace(/\s+/g, "_");
      if (!cleanKey) return;
      addDynamicFieldRow(cleanKey, null);
      const added = dynamicFieldsContainer?.querySelector(
        `input[data-key="${CSS.escape(cleanKey)}"]`,
      );
      added?.focus();
    });
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
    if (templateModal?.classList.contains("active")) {
      closeTemplateModal();
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
        if (!data) return;
        const target = getEditableTarget(data);
        if (!target) {
          showNotice(
            "Dodaj element",
            "Nieobsługiwany format dokumentu. Dokument musi być tablicą lub obiektem JSON.",
            "warning",
          );
          return;
        }
        openTemplateModal();
      });

      document
        .getElementById("btn-confirm-template")
        ?.addEventListener("click", async () => {
          try {
            const data = getCurrentJson();
            if (!data) return;

            const target = getEditableTarget(data);
            if (!target) {
              throw new Error("Dokument musi być poprawną tablicą lub obiektem JSON.");
            }

            const item = collectModalItem(target);
            if (!item) return;

            if (target.kind === "array" || target.kind === "nested_array") {
              target.list.push(item);
            } else if (target.kind === "object") {
              if (item && typeof item === "object" && !Array.isArray(item)) {
                Object.assign(target.root, item);
              } else {
                throw new Error("Nieprawidłowy format elementu dla obiektu.");
              }
            }

            setJsonValue(target.root);
            closeTemplateModal();
            setSystemStatus({
              message: `Dodano element do ${currentFilePath || "dokumentu"}`,
              messageState: "is-ok",
            });
            await showNotice(
              "Dodano element",
              `Zaktualizowano ${currentFilePath || "dokument"}.`,
              "success",
            );
          } catch (error) {
            await showNotice("Dodaj element", error.message, "warning");
          }
        });

      document.getElementById("btn-remove").addEventListener("click", () => {
        const data = getCurrentJson();
        if (!data) return;
        const target = getEditableTarget(data);
        if (!target) {
          showNotice("Usuń element", "Brak danych do usunięcia.", "warning");
          return;
        }

        if (target.kind === "array" || target.kind === "nested_array") {
          if (target.list.length === 0) {
            showNotice("Usuń element", "Tablica jest już pusta.", "warning");
            return;
          }
          target.list.pop();
          setJsonValue(target.root);
          showNotice(
            "Usunięto element",
            `Usunięto ostatni element (${target.list.length} pozostało).`,
            "info",
          );
        } else if (target.kind === "object") {
          const keys = Object.keys(target.root);
          if (keys.length === 0) {
            showNotice("Usuń element", "Obiekt jest pusty.", "warning");
            return;
          }
          const lastKey = keys[keys.length - 1];
          delete target.root[lastKey];
          setJsonValue(target.root);
          showNotice(
            "Usunięto właściwość",
            `Usunięto klucz "${lastKey}".`,
            "info",
          );
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
            await fetchRepoTree(settings).catch(() => { });

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
