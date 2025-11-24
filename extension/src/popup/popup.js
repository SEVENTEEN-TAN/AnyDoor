// 使用方法：打开扩展 Popup，自动检查登录状态并显示对应视图
// 说明：实现登录、上传、同步功能，支持Bundle下拉选择和设置页面

import { login, logout, me, listBundles, importBundle, importByToken, updateShareMode, checkBundleExists } from "../lib/api.js";
import { CONFIG } from "../config.js";

// ========== 全局变量 ==========
let currentUser = null;
let elements = {};

// ========== 视图管理 ==========
function showView(viewName) {
  const views = {
    login: elements.loginView,
    main: elements.mainView,
  };

  Object.keys(views).forEach((key) => {
    views[key].classList.remove("active");
  });
  if (views[viewName]) {
    views[viewName].classList.add("active");
  }
}

// ========== 登录处理 ==========
async function handleLogin() {
  const username = elements.usernameInput.value.trim();
  const password = elements.passwordInput.value.trim();

  if (!username || !password) {
    showMessage(elements.loginMessage, "请输入用户名和密码", "error");
    return;
  }

  // 显示加载状态
  setButtonLoading(elements.btnLogin, true, "登录中...");
  hideMessage(elements.loginMessage);

  try {
    // 调用登录 API
    const result = await login(username, password);

    if (result && result.token) {
      showMessage(elements.loginMessage, "登录成功！", "success");
      // 延迟跳转，让用户看到成功提示
      setTimeout(async () => {
        await checkAuthAndShowView();
      }, 500);
    } else {
      showMessage(elements.loginMessage, "登录失败，请检查用户名和密码", "error");
      setButtonLoading(elements.btnLogin, false);
    }
  } catch (error) {
    console.error("Login error:", error);
    showMessage(elements.loginMessage, `登录失败：${error.message || "网络错误"}`, "error");
    setButtonLoading(elements.btnLogin, false);
  }
}

// ========== 退出登录 ==========
async function handleLogout() {
  if (!confirm("确定要退出登录吗？")) return;

  try {
    await logout();
    await chrome.storage.sync.remove("token");
    currentUser = null;
    showView("login");
    showMessage(elements.loginMessage, "已退出登录", "info");
  } catch (error) {
    console.error("Logout error:", error);
  }
}

// ========== 打开设置页面（新Tab）==========
function handleOpenSettings() {
  // 打开设置页面（新Tab）
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/options/options.html")
  });
}

// ========== 加载 Bundle 列表 ==========
async function loadBundleList() {
  elements.bundleSelect.innerHTML = '<option value="">正在加载...</option>';

  try {
    // 调用后端 API 获取列表
    const response = await listBundles();
    const bundles = response.bundles || [];

    if (bundles.length === 0) {
      elements.bundleSelect.innerHTML = '<option value="">暂无可用的 Bundle</option>';
      return;
    }

    // 按类型分组
    const myBundles = bundles.filter(b => b.type === 'OWNER');
    const groupBundles = bundles.filter(b => b.type === 'GROUP_SHARED');
    const globalBundles = bundles.filter(b => b.type === 'PUBLIC');
    const importedBundles = bundles.filter(b => b.type === 'IMPORTED');

    // 构建选项
    let optionsHTML = '<option value="">-- 请选择站点 --</option>';

    // 我的 Bundle
    if (myBundles.length > 0) {
      optionsHTML += '<optgroup label="🔑 我的 Bundle">';
      myBundles.forEach(b => {
        optionsHTML += `<option value="${b.id}">${b.name} (${b.host})</option>`;
      });
      optionsHTML += '</optgroup>';
    }

    // 组内共享
    if (groupBundles.length > 0) {
      optionsHTML += '<optgroup label="👥 组内共享">';
      groupBundles.forEach(b => {
        optionsHTML += `<option value="${b.id}">${b.name} by ${b.ownerId} (${b.host})</option>`;
      });
      optionsHTML += '</optgroup>';
    }

    // 全局共享
    if (globalBundles.length > 0) {
      optionsHTML += '<optgroup label="🌐 全局共享">';
      globalBundles.forEach(b => {
        optionsHTML += `<option value="${b.id}">${b.name} (${b.host})</option>`;
      });
      optionsHTML += '</optgroup>';
    }

    // 已导入
    if (importedBundles.length > 0) {
      optionsHTML += '<optgroup label="📥 已导入">';
      importedBundles.forEach(b => {
        optionsHTML += `<option value="${b.id}">${b.name} (${b.host})</option>`;
      });
      optionsHTML += '</optgroup>';
    }

    elements.bundleSelect.innerHTML = optionsHTML;
  } catch (error) {
    console.error("Load bundle list error:", error);
    elements.bundleSelect.innerHTML = '<option value="">加载失败，请重试</option>';
  }
}

// ========== Mock 数据已移除 ==========

// ========== 上传功能 ==========
let uploadData = null; // 缓存采集的数据
let existingBundle = null; // 缓存已存在的 Bundle 信息

async function handleUpload() {
  elements.uploadResult.textContent = "";

  try {
    // 1. 获取当前Tab信息
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      elements.uploadResult.textContent = "❌ 无法获取当前标签页";
      return;
    }

    const tab = tabs[0];
    const tabTitle = tab.title || "未命名站点";
    const tabUrl = new URL(tab.url);

    // 2. 开始采集数据
    elements.uploadResult.textContent = "🔄 正在采集数据...";
    const res = await send({ type: "upload-collect" });  // 仅采集，不上传

    if (!res.ok) {
      elements.uploadResult.textContent = `❌ 采集失败：${res.error}`;
      return;
    }

    // 3. 缓存采集的数据
    uploadData = {
      host: res.host,
      etld1: res.etld1,
      cookies: res.cookies,
      storage: res.storage,
    };

    // 4. 检查是否已存在相同 Host 的 Bundle
    try {
      const checkRes = await checkBundleExists(res.host);
      if (checkRes.exists && checkRes.bundles && checkRes.bundles.length > 0) {
        // 发现已存在，显示选择对话框
        // 默认取第一个（最近更新的）
        existingBundle = checkRes.bundles[0];
        showChoiceDialog(existingBundle.name);
        elements.uploadResult.textContent = "";
        return;
      }
    } catch (e) {
      console.warn("Check exists failed, ignore:", e);
    }

    // 5. 如果不存在，继续常规流程
    continueUploadProcess(tabTitle, res.cookies);

  } catch (error) {
    console.error("Upload prepare error:", error);
    elements.uploadResult.textContent = `❌ 准备上传失败：${error.message || "未知错误"}`;
  }
}

function continueUploadProcess(defaultName, cookies) {
  // 计算Cookie最大过期天数
  const maxDays = calculateMaxCookieExpireDays(cookies);

  // 加载用户组列表
  loadUserGroups().then(() => {
    // 显示上传对话框
    showUploadDialog(defaultName, maxDays);
    elements.uploadResult.textContent = "";
  });
}

// 计算Cookie最大过期天数
function calculateMaxCookieExpireDays(cookies) {
  if (!cookies || cookies.length === 0) return 7;

  const now = Date.now();
  let maxExpireTime = 0;

  for (const cookie of cookies) {
    if (cookie.expirationDate) {
      const expireTime = cookie.expirationDate * 1000; // 转换为毫秒
      if (expireTime > maxExpireTime) {
        maxExpireTime = expireTime;
      }
    }
  }

  if (maxExpireTime === 0) return 7; // 都是Session Cookie，默认7天

  const diffMs = maxExpireTime - now;
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  return Math.max(1, Math.min(diffDays, 365)); // 限制在1-365天
}

// 加载用户组列表
async function loadUserGroups() {
  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/group/my`, {
      headers: {
        "satoken": await getToken(),
      },
    });

    if (response.ok) {
      const data = await response.json();
      const groups = data.groups || [];

      // 填充组下拉框
      let optionsHTML = '<option value="">默认组</option>';
      groups.forEach(g => {
        optionsHTML += `<option value="${g.id}">${g.groupName}</option>`;
      });

      elements.uploadGroup.innerHTML = optionsHTML;
    } else {
      elements.uploadGroup.innerHTML = '<option value="">默认组</option>';
    }
  } catch (error) {
    console.error("Load groups error:", error);
    elements.uploadGroup.innerHTML = '<option value="">默认组</option>';
  }
}

// 获取token
async function getToken() {
  const data = await chrome.storage.sync.get("token");
  return data.token || "";
}

// 显示上传对话框
function showUploadDialog(defaultName, suggestedDays) {
  elements.uploadName.value = defaultName;
  elements.uploadExpire.value = suggestedDays;
  elements.suggestedDays.textContent = suggestedDays;
  elements.uploadDesc.value = "";
  elements.uploadTags.value = "";

  elements.uploadDialog.classList.add("show");
}

// 隐藏上传对话框
function hideUploadDialog() {
  elements.uploadDialog.classList.remove("show");
  uploadData = null;
}

// 确认上传
async function handleConfirmUpload() {
  const name = elements.uploadName.value.trim();
  const groupId = elements.uploadGroup.value || null;
  const shareMode = elements.uploadShareMode.value || "GROUP_ONLY";
  const expireDays = parseInt(elements.uploadExpire.value, 10);
  const description = elements.uploadDesc.value.trim() || null;
  const tags = elements.uploadTags.value.trim() || null;

  if (!name) {
    alert("请输入Bundle名称");
    return;
  }

  if (!uploadData) {
    alert("数据丢失，请重新采集");
    hideUploadDialog();
    return;
  }

  // 禁用按钮
  elements.btnConfirmUpload.disabled = true;
  elements.btnConfirmUpload.textContent = "上传中...";

  try {
    const response = await send({
      type: "upload-confirm",
      name,
      groupId,
      shareMode,
      description,
      tags,
      expireDays,
      ...uploadData,
    });

    if (response.ok) {
      hideUploadDialog();

      const shareText = shareMode === "PUBLIC" ? "🌐 全局公开" : "🔒 仅组内可见";

      const resultText = `✅ 上传成功！\n\n` +
        `📦 名称：${response.name}\n` +
        `📋 同步码：${response.bundleId}\n` +
        `📊 Cookie 数量：${response.count} 个\n` +
        `${shareText}\n` +
        `⏰ 过期时间：${new Date(response.expireAt).toLocaleString("zh-CN")}\n\n` +
        `💡 提示：已添加到您的Bundle列表，可在设置页面管理分享`;
      elements.uploadResult.textContent = resultText;

      // 刷新 Bundle 列表
      await loadBundleList();
    } else {
      alert(`上传失败：${response.error}`);
    }
  } catch (error) {
    console.error("Upload error:", error);
    alert(`上传异常：${error.message || "未知错误"}`);
  } finally {
    elements.btnConfirmUpload.disabled = false;
    elements.btnConfirmUpload.textContent = "确认上传";
  }
}

// ========== 同步功能 ==========
async function handleSync() {
  const bundleId = elements.bundleSelect.value;

  if (!bundleId) {
    elements.syncResult.textContent = "❌ 请选择要同步的站点";
    return;
  }

  if (!confirm("⚠️ 警告\n\n同步将清空当前站点的所有数据：\n• Cookie\n• localStorage\n• sessionStorage\n• IndexedDB\n• Cache Storage\n• Service Worker\n\n然后写入同步的数据。\n\n确定要继续吗？")) {
    return;
  }

  elements.syncResult.textContent = "";
  setButtonLoading(elements.btnSync, true, "同步中...");

  try {
    const res = await send({ type: "writeback", bundleId });

    if (res.ok) {
      const statusIcon = res.fullSync ? "✅" : "⚠️";
      const resultText = `${statusIcon} ${res.message}\n\n` +
        `📦 Cookie：\n` +
        `   预期：${res.cookies.expected} 个\n` +
        `   实际：${res.cookies.actual} 个\n` +
        `   匹配：${res.cookies.match ? "是 ✅" : "否 ❌"}\n\n` +
        `💾 Storage：\n` +
        `   localStorage：${res.storage.localStorage} 个\n` +
        `   sessionStorage：${res.storage.sessionStorage} 个\n\n` +
        `${res.fullSync ? "✨ 站点状态已完整恢复！\n页面将自动刷新..." : "⚠️ 部分数据可能未同步\n请查看控制台日志"}`;

      elements.syncResult.textContent = resultText;
    } else {
      elements.syncResult.textContent = `❌ 同步失败：${res.error}\n\n${JSON.stringify(res.details || [], null, 2)}`;
    }
  } catch (error) {
    console.error("Sync error:", error);
    elements.syncResult.textContent = `❌ 同步异常：${error.message || "未知错误"}`;

    // 检查是否是登录过期
    if (error.code === 401) {
      elements.syncResult.textContent += "\n\n⚠️ 登录已过期，请重新登录";
      setTimeout(() => {
        showView("login");
        showMessage(elements.loginMessage, "登录已过期，请重新登录", "error");
      }, 1500);
    }
  } finally {
    setButtonLoading(elements.btnSync, false);
  }
}

// ========== 导入功能 ==========
function showImportDialog() {
  elements.importInput.value = "";
  elements.importDialog.classList.add("show");
}

function hideImportDialog() {
  elements.importDialog.classList.remove("show");
}

async function handleConfirmImport() {
  const input = elements.importInput.value.trim();

  if (!input) {
    alert("请输入 Bundle ID 或分享链接");
    return;
  }

  let shareToken = null;
  let bundleId = null;

  // 1. 尝试解析为 URL
  if (input.startsWith("http://") || input.startsWith("https://")) {
    try {
      const url = new URL(input);
      // 优先提取 token（新格式）
      shareToken = url.searchParams.get("token");
      if (!shareToken) {
        // 如果没有 token，提取 bundleId（旧格式）
        bundleId = url.searchParams.get("bundleId") || url.pathname.split("/").pop();
      }
    } catch (e) {
      alert("无效的分享链接");
      return;
    }
  } else {
    // 2. 如果输入包含【】格式，提取链接
    const bracketMatch = input.match(/【.*?】\s*(https?:\/\/[^\s]+)/);
    if (bracketMatch) {
      try {
        const url = new URL(bracketMatch[1]);
        shareToken = url.searchParams.get("token");
        if (!shareToken) {
          bundleId = url.searchParams.get("bundleId") || url.pathname.split("/").pop();
        }
      } catch (e) {
        alert("无效的分享链接");
        return;
      }
    } else {
      // 3. 纯 bundleId
      bundleId = input;
    }
  }

  if (!shareToken && !bundleId) {
    alert("无法识别 Bundle ID 或分享令牌");
    return;
  }

  elements.btnConfirmImport.disabled = true;
  elements.btnConfirmImport.textContent = "导入中...";

  try {
    let response;

    if (shareToken) {
      // 使用新的 token 导入接口
      response = await importByToken(shareToken);
    } else {
      // 使用旧的 bundleId 导入接口（向后兼容）
      response = await importBundle(bundleId);
    }

    if (response.ok) {
      hideImportDialog();
      alert(`✅ ${response.message || "导入成功"}`);
      // 刷新 Bundle 列表
      await loadBundleList();
    } else {
      alert(`❌ 导入失败：${response.error || "未知错误"}`);
    }
  } catch (error) {
    console.error("Import error:", error);
    alert(`❌ 导入异常：${error.message || "未知错误"}`);
  } finally {
    elements.btnConfirmImport.disabled = false;
    elements.btnConfirmImport.textContent = "确认导入";
  }
}

// ========== 工具函数 ==========
function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function showMessage(element, text, type = "info") {
  element.textContent = text;
  element.className = `message show ${type}`;
}

function hideMessage(element) {
  element.className = "message";
}

function setButtonLoading(button, loading, text = null) {
  const btnText = button.querySelector(".btn-text");

  if (loading) {
    button.disabled = true;
    if (text) btnText.textContent = text;
    // 添加加载动画
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    button.insertBefore(spinner, btnText);
  } else {
    button.disabled = false;
    // 移除加载动画
    const spinner = button.querySelector(".spinner");
    if (spinner) spinner.remove();
    // 恢复原文本
    const originalTexts = {
      [elements.btnLogin]: "登录",
      [elements.btnUpload]: "上传",
      [elements.btnSync]: "同步",
    };
    if (originalTexts[button]) {
      btnText.textContent = originalTexts[button];
    }
  }
}

// ========== 初始化和认证检查 ==========
async function checkAuthAndShowView() {
  try {
    // 检查登录状态
    const userInfo = await me();

    if (userInfo && userInfo.userId) {
      // 已登录，显示主功能视图
      currentUser = userInfo.userId;
      elements.userName.textContent = userInfo.username;
      showView("main");

      // 加载 Bundle 列表
      await loadBundleList();
    } else {
      // 未登录，显示登录视图
      showView("login");
    }
  } catch (error) {
    console.error("Auth check error:", error);

    // 登录失败或未登录，显示登录视图
    showView("login");

    // 如果是 401 错误，不显示错误提示，让用户正常登录
    if (error.code === 401) {
      console.log("未登录，显示登录页面");
    }
  }
}

// ========== 选择对话框 ==========
function showChoiceDialog(bundleName) {
  elements.choiceBundleName.textContent = bundleName;
  elements.choiceDialog.classList.add("show");
}

function hideChoiceDialog() {
  elements.choiceDialog.classList.remove("show");
  existingBundle = null;
}

async function handleQuickUpdate() {
  if (!existingBundle || !uploadData) return;

  // 禁用按钮
  elements.btnChoiceUpdate.disabled = true;
  elements.btnChoiceUpdate.textContent = "更新中...";

  try {
    const response = await send({
      type: "quick-update",
      bundleId: existingBundle.id,
      ...uploadData
    });

    if (response.ok) {
      const savedBundle = existingBundle;
      hideChoiceDialog();

      const resultText = `✅ 更新成功！\n\n` +
        `📦 名称：${savedBundle.name}\n` +
        `⏰ 更新时间：${new Date().toLocaleString("zh-CN")}\n` +
        `💡 提示：Cookie 和 Storage 已更新，有效期已延长`;
      elements.uploadResult.textContent = resultText;

      // 刷新列表并选中更新的 Bundle
      await loadBundleList();
      setTimeout(() => {
        elements.bundleSelect.value = savedBundle.id;
      }, 500);
    } else {
      alert(`更新失败：${response.error}`);
      elements.btnChoiceUpdate.disabled = false;
      elements.btnChoiceUpdate.textContent = "🔄 更新现有 (推荐)";
    }
  } catch (error) {
    console.error("Quick update error:", error);
    alert(`更新异常：${error.message || "未知错误"}`);
    elements.btnChoiceUpdate.disabled = false;
    elements.btnChoiceUpdate.textContent = "🔄 更新现有 (推荐)";
  }
}

function handleChoiceNew() {
  hideChoiceDialog();
  // 继续常规流程
  continueUploadProcess(uploadData.host, uploadData.cookies);
}

// ========== 绑定事件 ==========
function bindEvents() {
  // 登录视图
  elements.btnLogin.addEventListener("click", handleLogin);
  elements.usernameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
  });
  elements.passwordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
  });

  // 功能视图
  elements.btnLogout.addEventListener("click", handleLogout);
  elements.btnSettings.addEventListener("click", handleOpenSettings);
  elements.btnImport.addEventListener("click", showImportDialog);
  elements.btnUpload.addEventListener("click", handleUpload);
  elements.btnSync.addEventListener("click", handleSync);

  // 上传对话框
  elements.btnCancelUpload.addEventListener("click", hideUploadDialog);
  elements.btnConfirmUpload.addEventListener("click", handleConfirmUpload);

  // 导入对话框
  elements.btnCancelImport.addEventListener("click", hideImportDialog);
  elements.btnConfirmImport.addEventListener("click", handleConfirmImport);

  // 选择对话框
  if (elements.choiceDialog) {
    elements.btnChoiceUpdate.addEventListener("click", handleQuickUpdate);
    elements.btnChoiceNew.addEventListener("click", handleChoiceNew);
    elements.btnChoiceCancel.addEventListener("click", hideChoiceDialog);
  }
}

// ========== 初始化 ==========
async function init() {
  // 获取所有 DOM 元素
  elements = {
    // 视图
    loginView: document.getElementById("login-view"),
    mainView: document.getElementById("main-view"),

    // 登录视图
    usernameInput: document.getElementById("username"),
    passwordInput: document.getElementById("password"),
    btnLogin: document.getElementById("btn-login"),
    loginMessage: document.getElementById("login-message"),

    // 功能视图
    userName: document.getElementById("user-name"),
    btnLogout: document.getElementById("btn-logout"),
    btnSettings: document.getElementById("btn-settings"),
    btnImport: document.getElementById("btn-import"),
    btnUpload: document.getElementById("btn-upload"),
    btnSync: document.getElementById("btn-sync"),
    bundleSelect: document.getElementById("bundle-select"),
    uploadResult: document.getElementById("upload-result"),
    syncResult: document.getElementById("sync-result"),

    // 上传对话框
    uploadDialog: document.getElementById("upload-dialog"),
    uploadName: document.getElementById("upload-name"),
    uploadGroup: document.getElementById("upload-group"),
    uploadShareMode: document.getElementById("upload-share-mode"),
    uploadExpire: document.getElementById("upload-expire"),
    suggestedDays: document.getElementById("suggested-days"),
    uploadDesc: document.getElementById("upload-desc"),
    uploadTags: document.getElementById("upload-tags"),
    btnCancelUpload: document.getElementById("btn-cancel-upload"),
    btnConfirmUpload: document.getElementById("btn-confirm-upload"),

    // 导入对话框
    importDialog: document.getElementById("import-dialog"),
    importInput: document.getElementById("import-input"),
    btnCancelImport: document.getElementById("btn-cancel-import"),
    btnConfirmImport: document.getElementById("btn-confirm-import"),

    // 选择对话框
    choiceDialog: document.getElementById("choice-dialog"),
    choiceBundleName: document.getElementById("choice-bundle-name"),
    btnChoiceUpdate: document.getElementById("btn-choice-update"),
    btnChoiceNew: document.getElementById("btn-choice-new"),
    btnChoiceCancel: document.getElementById("btn-choice-cancel"),
  };

  // 绑定事件
  bindEvents();

  // 检查认证状态
  await checkAuthAndShowView();
}

// 启动
init();
