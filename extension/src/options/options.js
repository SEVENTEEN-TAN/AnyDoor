// 使用方法：打开扩展设置页面，自动检查登录状态并显示对应视图
// 说明：实现Tab切换、站点管理、账号管理、组管理功能

import { me, logout, listBundles, importBundle, updateShareMode, deleteBundle, removeReference, changePassword, createSubAccount, listSubAccounts, listMainAccounts, getUserDetails, createMainAccount, getUserSubAccounts, getUserGroups, toggleSubAccountStatus, deleteSubAccount, toggleMainAccountStatus, deleteMainAccount, toggleUserSubAccountStatus, deleteUserSubAccount, getUserBundles, getBundleDetail, updateBundle, getGroupMembers, addGroupMember, removeGroupMember, getGroupBundles, closeReference, listShares, getShareUsers, removeShareUser } from "../lib/api.js";
import { CONFIG } from "../config.js";

// ========== 全局变量 ==========
let currentUser = null;
let allBundles = [];
let userGroups = []; // 用户的组列表
let elements = {};

// ========== Tab切换管理 ==========
function initTabs() {
  // 只选择主Tab导航栏中的按钮，排除详情视图中的Tab
  const mainTabsContainer = document.querySelector(".tabs:not(.detail-tabs)");
  if (!mainTabsContainer) return;

  const tabButtons = mainTabsContainer.querySelectorAll(".tab-button");
  const tabPanes = document.querySelectorAll(".container > .tab-content > .tab-pane");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;
      if (!tabName) return; // 如果没有 data-tab 属性，直接返回

      // 移除所有active状态
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabPanes.forEach((pane) => pane.classList.remove("active"));

      // 添加当前tab的active状态
      button.classList.add("active");
      const targetPane = document.getElementById(`tab-${tabName}`);
      if (targetPane) {
        targetPane.classList.add("active");
      }

      // 加载对应tab的数据
      loadTabData(tabName);
    });
  });
}

function loadTabData(tabName) {
  switch (tabName) {
    case "sites":
      loadSites();
      break;
    case "account":
      loadAccount();
      break;
    case "groups":
      loadGroups();
      break;
    case "admin":
      loadAdminUsers();
      break;
  }
}

// ========== 站点管理 ==========

async function loadSites() {
  try {
    // 先加载用户的组列表
    await loadUserGroupsForSites();

    const response = await listBundles();
    allBundles = response.bundles || [];

    // 分类Bundle
    const myBundles = allBundles.filter((b) => b.type === "OWNER");
    const importedBundles = allBundles.filter((b) => b.type === "IMPORTED");

    // 渲染我的站点
    renderMySites(myBundles);

    // 渲染已导入的站点
    renderImportedSites(importedBundles);
  } catch (error) {
    console.error("Load sites error:", error);
    showMessage("message-sites", `加载站点失败：${error.message}`, "error");
  }
}

// 加载用户的组列表（用于站点管理）
async function loadUserGroupsForSites() {
  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/group/my`, {
      headers: {
        satoken: await getToken(),
      },
    });

    if (response.ok) {
      const data = await response.json();
      userGroups = data.groups || [];
    } else {
      userGroups = [];
    }
  } catch (error) {
    console.error("Load user groups error:", error);
    userGroups = [];
  }
}

function renderMySites(bundles) {
  const container = elements.mySitesList;

  if (bundles.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 48px 24px; color: #9ca3af;">
          <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">📦</div>
          <div style="font-size: 16px; margin-bottom: 8px;">您还没有上传任何站点</div>
          <div style="font-size: 14px;">在浏览器扩展中点击"上传"按钮可创建新站点</div>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = bundles
    .map(
      (bundle) => {
        const expireDate = new Date(bundle.expireAt).toLocaleString("zh-CN");
        
        // 生成组下拉框选项
        let groupOptions = '<option value="">默认组</option>';
        userGroups.forEach(group => {
          const selected = bundle.groupId === group.id ? 'selected' : '';
          groupOptions += `<option value="${group.id}" ${selected}>${group.groupName}</option>`;
        });
        
        // 调试日志
        if (bundle.groupId) {
          console.log(`[Bundle] ${bundle.name} -> groupId: ${bundle.groupId}, 匹配的组:`, userGroups.find(g => g.id === bundle.groupId)?.groupName || '未找到');
        }
        
        return `
    <tr data-id="${bundle.id}">
      <td class="col-name" title="${bundle.name}">${bundle.name}</td>
      <td class="col-host" title="${bundle.host}">${bundle.host}</td>
      <td class="col-share">
        <select class="group-select" data-id="${bundle.id}">
          ${groupOptions}
        </select>
      </td>
      <td class="col-expire" title="${expireDate}">${expireDate}</td>
      <td class="col-share">
        <select class="share-mode-select" data-id="${bundle.id}">
          <option value="PRIVATE" ${bundle.shareMode === "PRIVATE" ? "selected" : ""}>🔐 个人</option>
          <option value="GROUP_ONLY" ${bundle.shareMode === "GROUP_ONLY" ? "selected" : ""}>🔒 仅组内</option>
          <option value="PUBLIC" ${bundle.shareMode === "PUBLIC" ? "selected" : ""}>🌐 公开</option>
        </select>
      </td>
      <td class="col-actions">
        <button class="btn btn-primary btn-small view-detail" data-id="${bundle.id}">👁️ 详情</button>
        <button class="btn btn-primary btn-small edit-site" data-id="${bundle.id}">✏️ 编辑</button>
        <button class="btn btn-primary btn-small copy-share-link" data-id="${bundle.id}">📋 复制</button>
        <button class="btn btn-success btn-small manage-shares" data-id="${bundle.id}" data-name="${bundle.name}">🔗 分享列表</button>
        <button class="btn btn-danger btn-small delete-site" data-id="${bundle.id}">🗑️ 删除</button>
      </td>
    </tr>
  `;
      }
    )
    .join("");

  // 绑定事件
  container.querySelectorAll(".group-select").forEach((select) => {
    select.addEventListener("change", handleGroupChange);
  });

  container.querySelectorAll(".share-mode-select").forEach((select) => {
    select.addEventListener("change", handleShareModeChange);
  });

  container.querySelectorAll(".view-detail").forEach((btn) => {
    btn.addEventListener("click", handleViewDetail);
  });

  container.querySelectorAll(".edit-site").forEach((btn) => {
    btn.addEventListener("click", handleEditSite);
  });

  container.querySelectorAll(".copy-share-link").forEach((btn) => {
    btn.addEventListener("click", handleCopyShareLink);
  });

  container.querySelectorAll(".manage-shares").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const bundleId = e.target.dataset.id;
      const bundleName = e.target.dataset.name;
      handleManageShares(bundleId, bundleName);
    });
  });

  container.querySelectorAll(".delete-site").forEach((btn) => {
    btn.addEventListener("click", handleDeleteSite);
  });
}

function renderImportedSites(bundles) {
  const container = elements.importedSitesList;

  if (bundles.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 48px 24px; color: #9ca3af;">
          <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">📥</div>
          <div style="font-size: 16px; margin-bottom: 8px;">您还没有导入任何站点</div>
          <div style="font-size: 14px;">点击下方的"导入新站点"卡片可导入分享链接</div>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = bundles
    .map(
      (bundle) => {
        const expireDate = new Date(bundle.expireAt).toLocaleString("zh-CN");
        return `
    <tr data-id="${bundle.id}">
      <td class="col-name" title="${bundle.name}">${bundle.name}</td>
      <td class="col-host" title="${bundle.host}">${bundle.host}</td>
      <td class="col-host" title="${bundle.ownerId}">${bundle.ownerId}</td>
      <td class="col-expire" title="${expireDate}">${expireDate}</td>
      <td class="col-actions">
        <button class="btn btn-danger btn-small remove-imported" data-id="${bundle.id}">🗑️ 移除</button>
      </td>
    </tr>
  `;
      }
    )
    .join("");

  // 绑定事件
  container.querySelectorAll(".remove-imported").forEach((btn) => {
    btn.addEventListener("click", handleRemoveImported);
  });
}

// 处理所属组变更
async function handleGroupChange(event) {
  const select = event.target;
  const bundleId = select.dataset.id;
  const newGroupId = select.value || null;
  const oldValue = select.value;

  select.disabled = true;

  try {
    // 获取当前Bundle信息
    const bundle = allBundles.find((b) => b.id === bundleId);
    if (!bundle) {
      throw new Error("Bundle不存在");
    }

    // 计算剩余天数
    const now = Date.now();
    const remainingMs = bundle.expireAt - now;
    const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    // 调用更新API
    const response = await updateBundle(bundleId, {
      name: bundle.name,
      description: bundle.description,
      tags: bundle.tags,
      shareMode: bundle.shareMode,
      groupId: newGroupId,
      expireDays: remainingDays,
    });

    if (response.ok) {
      const groupName = newGroupId ? userGroups.find(g => g.id === newGroupId)?.groupName || "未知组" : "默认组";
      showMessage("message-sites", `✅ 已将站点移动到 ${groupName}`, "success");

      // 更新缓存
      bundle.groupId = newGroupId;
    } else {
      select.value = oldValue;
      showMessage("message-sites", `❌ 更新失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Update group error:", error);
    select.value = oldValue;
    showMessage("message-sites", `❌ 更新异常：${error.message || "未知错误"}`, "error");
  } finally {
    select.disabled = false;
  }
}

// 处理分享模式变更
async function handleShareModeChange(event) {
  const select = event.target;
  const bundleId = select.dataset.id;
  const newShareMode = select.value;
  const oldValue = select.options[select.selectedIndex === 0 ? 1 : 0].value;

  select.disabled = true;

  try {
    const response = await updateShareMode(bundleId, newShareMode);

    if (response.ok) {
      showMessage("message-sites", `✅ ${response.message || "分享模式已更新"}`, "success");

      // 更新缓存
      const bundle = allBundles.find((b) => b.id === bundleId);
      if (bundle) {
        bundle.shareMode = newShareMode;
      }
    } else {
      select.value = oldValue;
      showMessage("message-sites", `❌ 更新失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Update share mode error:", error);
    select.value = oldValue;
    showMessage("message-sites", `❌ 更新异常：${error.message || "未知错误"}`, "error");
  } finally {
    select.disabled = false;
  }
}

// 处理复制分享链接
async function handleCopyShareLink(event) {
  const button = event.target;
  const bundleId = button.dataset.id;
  
  // 获取Bundle信息
  const bundle = allBundles.find((b) => b.id === bundleId);
  const siteName = bundle ? bundle.name : "未知站点";
  
  const shareLink = `${CONFIG.baseUrl}/share?bundleId=${bundleId}`;
  const shareText = `【${siteName}】\n${shareLink}`;

  try {
    await navigator.clipboard.writeText(shareText);
    const originalText = button.textContent;
    button.textContent = "✅ 已复制！";
    button.disabled = true;

    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 2000);

    showMessage("message-sites", "✅ 分享链接已复制到剪贴板（含站点名称）", "success");
  } catch (error) {
    console.error("Copy failed:", error);
    showMessage("message-sites", "❌ 复制失败，请手动复制", "error");
  }
}

// 处理删除站点
async function handleDeleteSite(event) {
  const button = event.target;
  const bundleId = button.dataset.id;

  // 查询分享信息
  const shareInfo = await fetchShareInfo(bundleId);
  
  // 构建确认消息
  let message = '确定要删除这个站点吗？\n\n';
  
  if (shareInfo.activeCount > 0) {
    message += `⚠️ 警告：此站点有 ${shareInfo.activeCount} 个活跃的分享链接，` +
               `已被 ${shareInfo.userCount} 个用户导入。\n\n` +
               `删除后，所有分享将自动失效，被分享人将无法继续使用该站点。\n\n`;
  }
  
  message += '此操作不可撤销！';

  if (!confirm(message)) {
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "删除中...";

  try {
    const response = await deleteBundle(bundleId);

    if (response.ok) {
      showMessage("message-sites", `✅ ${response.message || "站点已删除"}`, "success");
      loadSites();
    } else {
      showMessage("message-sites", `❌ 删除失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Delete site error:", error);
    showMessage("message-sites", `❌ 删除异常：${error.message || "未知错误"}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 处理查看详情
async function handleViewDetail(event) {
  const button = event.target;
  const bundleId = button.dataset.id;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "加载中...";

  try {
    const bundle = await getBundleDetail(bundleId);

    // 填充详情对话框
    elements.detailId.textContent = bundle.id;
    elements.detailName.textContent = bundle.name;
    elements.detailHost.textContent = bundle.host;
    elements.detailShareMode.textContent =
      bundle.shareMode === "PRIVATE" ? "🔐 私有" :
      bundle.shareMode === "GROUP_ONLY" ? "🔒 仅组内" : "🌐 公开";
    elements.detailDescription.textContent = bundle.description || "无";
    elements.detailTags.textContent = bundle.tags || "无";
    elements.detailCreatedAt.textContent = new Date(bundle.createdAt).toLocaleString("zh-CN");
    elements.detailExpireAt.textContent = new Date(bundle.expireAt).toLocaleString("zh-CN");

    // 显示对话框
    elements.detailDialog.classList.add("show");
  } catch (error) {
    console.error("View detail error:", error);
    showMessage("message-sites", `❌ 获取详情失败：${error.message || "未知错误"}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 关闭详情对话框
function hideDetailDialog() {
  elements.detailDialog.classList.remove("show");
}

// 处理编辑站点
async function handleEditSite(event) {
  const button = event.target;
  const bundleId = button.dataset.id;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "加载中...";

  try {
    // 获取Bundle详情
    const bundle = await getBundleDetail(bundleId);

    // 填充编辑对话框
    elements.editBundleId.value = bundle.id;
    elements.editName.value = bundle.name;
    elements.editDescription.value = bundle.description || "";
    elements.editTags.value = bundle.tags || "";
    elements.editShareMode.value = bundle.shareMode;

    // 加载组列表
    await loadEditGroupOptions();

    // 设置当前组
    elements.editGroup.value = bundle.groupId || "";

    // 计算剩余天数
    const now = Date.now();
    const remainingMs = bundle.expireAt - now;
    const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    elements.editExpire.value = remainingDays;

    // 显示对话框
    elements.editDialog.classList.add("show");
  } catch (error) {
    console.error("Edit site error:", error);
    showMessage("message-sites", `❌ 加载编辑信息失败：${error.message || "未知错误"}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 加载编辑对话框的组选项
async function loadEditGroupOptions() {
  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/group/my`, {
      headers: {
        satoken: await getToken(),
      },
    });

    if (response.ok) {
      const data = await response.json();
      const groups = data.groups || [];

      let optionsHTML = '<option value="">默认组</option>';
      groups.forEach(g => {
        optionsHTML += `<option value="${g.id}">${g.groupName}</option>`;
      });

      elements.editGroup.innerHTML = optionsHTML;
    }
  } catch (error) {
    console.error("Load groups error:", error);
  }
}

// 关闭编辑对话框
function hideEditDialog() {
  elements.editDialog.classList.remove("show");
}

// 确认编辑
async function handleConfirmEdit() {
  const bundleId = elements.editBundleId.value;
  const name = elements.editName.value.trim();
  const description = elements.editDescription.value.trim();
  const tags = elements.editTags.value.trim();
  const shareMode = elements.editShareMode.value;
  const groupId = elements.editGroup.value;
  const expireDays = parseInt(elements.editExpire.value, 10);

  if (!name) {
    showMessage("message-sites", "❌ Bundle名称不能为空", "error");
    return;
  }

  if (expireDays < 1 || expireDays > 365) {
    showMessage("message-sites", "❌ 有效期必须在1-365天之间", "error");
    return;
  }

  elements.btnConfirmEdit.disabled = true;
  elements.btnConfirmEdit.textContent = "保存中...";

  try {
    const response = await updateBundle(bundleId, {
      name,
      description,
      tags,
      shareMode,
      groupId,
      expireDays
    });

    if (response.ok) {
      hideEditDialog();
      showMessage("message-sites", `✅ ${response.message || "保存成功"}`, "success");
      loadSites();
    } else {
      showMessage("message-sites", `❌ 保存失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Update bundle error:", error);
    showMessage("message-sites", `❌ 保存异常：${error.message || "未知错误"}`, "error");
  } finally {
    elements.btnConfirmEdit.disabled = false;
    elements.btnConfirmEdit.textContent = "保存";
  }
}


// 处理移除已导入站点
async function handleRemoveImported(event) {
  const button = event.target;
  const bundleId = button.dataset.id;
  const bundle = allBundles.find(b => b.id === bundleId);

  const confirmed = confirm(
    `确定要关闭此站点吗？\n\n` +
    `站点：${bundle ? bundle.name : bundleId}\n\n` +
    `关闭后将从列表中移除，但可以重新导入。`
  );

  if (!confirmed) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "关闭中...";

  try {
    const response = await closeReference(bundleId);

    if (response.ok) {
      showSuccess('✅ 站点已关闭');
      await loadSites();
    } else {
      showError('❌ ' + (response.error || '关闭失败'));
    }
  } catch (error) {
    console.error("Close reference error:", error);
    showError('❌ 关闭异常：' + error.message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// ========== 账号管理 ==========
async function loadAccount() {
  try {
    const response = await listSubAccounts();

    // 兼容两种响应字段名
    const subaccounts = response.subAccounts || response.subaccounts || [];

    if (subaccounts.length > 0) {
      // 渲染子账号列表
      elements.subaccountsList.innerHTML = subaccounts
        .map(
          (account) => {
            // 处理所属组显示
            const groupsText = account.groupNames && account.groupNames.length > 0
              ? account.groupNames.join(', ')
              : '无';
            
            // 转义HTML以防止XSS
            const escapeHtml = (str) => {
              const div = document.createElement('div');
              div.textContent = str || '';
              return div.innerHTML;
            };
            
            // 存储完整的账号数据供编辑使用
            const accountData = JSON.stringify({
              userId: account.userId,
              username: account.username,
              groupNames: account.groupNames || []
            }).replace(/"/g, '&quot;');
            
            return `
        <tr>
          <td>${escapeHtml(account.username)}</td>
          <td>${escapeHtml(groupsText)}</td>
          <td>${new Date(account.createdAt).toLocaleString("zh-CN")}</td>
          <td>${account.status === "ACTIVE" ? "✅ 正常" : "❌ 已禁用"}</td>
          <td>
            <button class="btn btn-primary btn-small edit-subaccount" 
                    data-account='${accountData}'>
              ✏️ 编辑
            </button>
            <button class="btn ${account.status === "ACTIVE" ? "btn-secondary" : "btn-success"} btn-small toggle-subaccount" data-id="${account.userId}">
              ${account.status === "ACTIVE" ? "🚫 停用" : "✅ 启用"}
            </button>
            <button class="btn btn-danger btn-small delete-subaccount" data-id="${account.userId}" data-username="${escapeHtml(account.username)}">🗑️ 删除</button>
          </td>
        </tr>
      `;
          }
        )
        .join("");

      // 绑定事件
      elements.subaccountsList.querySelectorAll(".edit-subaccount").forEach((btn) => {
        btn.addEventListener("click", handleEditSubAccount);
      });
      elements.subaccountsList.querySelectorAll(".toggle-subaccount").forEach((btn) => {
        btn.addEventListener("click", handleToggleSubAccount);
      });
      elements.subaccountsList.querySelectorAll(".delete-subaccount").forEach((btn) => {
        btn.addEventListener("click", handleDeleteSubAccount);
      });
    } else {
      // 显示空状态或开发中提示
      elements.subaccountsList.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #9ca3af; padding: 24px;">
            ${response.message || "📝 暂无子账号"}
          </td>
        </tr>
      `;
    }
  } catch (error) {
    console.error("Load subaccounts error:", error);
    elements.subaccountsList.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: #9ca3af; padding: 24px;">
          ❌ 加载失败：${error.message || "未知错误"}
        </td>
      </tr>
    `;
  }
}

// 处理切换子账号状态
async function handleToggleSubAccount(event) {
  const button = event.target;
  const subAccountId = button.dataset.id;

  button.disabled = true;
  const originalText = button.textContent;

  try {
    const response = await toggleSubAccountStatus(subAccountId);

    if (response.ok) {
      showMessage("message-subaccounts", `✅ ${response.message || "状态已更新"}`, "success");
      loadAccount();
    } else {
      showMessage("message-subaccounts", `❌ 操作失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Toggle subaccount error:", error);
    showMessage("message-subaccounts", `❌ 操作异常：${error.message || "未知错误"}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 处理删除子账号
async function handleDeleteSubAccount(event) {
  const button = event.target;
  const subAccountId = button.dataset.id;
  const username = button.dataset.username;

  // 显示级联删除警告
  const confirmed = confirm(
    `确定要删除子账号 "${username}" 吗?\n\n` +
    `⚠️ 警告: 此操作将同时删除该子账号的所有关联数据:\n` +
    `- 该子账号创建的所有站点\n` +
    `- 该子账号分享或导入的所有站点\n` +
    `- 所有站点的 Cookie 数据\n` +
    `- 该子账号的组关联关系\n\n` +
    `此操作不可撤销!`
  );

  if (!confirmed) {
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "删除中...";

  try {
    // 使用新的 DELETE API 并添加 cascade=true 参数
    const response = await fetch(
      `${CONFIG.baseUrl}/api/auth/subaccount/${subAccountId}?cascade=true`,
      {
        method: 'DELETE',
        headers: {
          satoken: await getToken(),
        },
      }
    );

    const data = await response.json();

    if (response.ok && data.ok) {
      const message = data.deletedBundlesCount > 0
        ? `子账号已删除，同时删除了 ${data.deletedBundlesCount} 个站点`
        : '子账号已删除';
      showMessage("message-subaccounts", `✅ ${message}`, "success");
      loadAccount();
    } else {
      showMessage("message-subaccounts", `❌ 删除失败：${data.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Delete subaccount error:", error);
    showMessage("message-subaccounts", `❌ 删除异常：${error.message || "未知错误"}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 处理编辑子账号
async function handleEditSubAccount(event) {
  const button = event.target;
  const accountData = JSON.parse(button.dataset.account);
  const subAccountId = accountData.userId;
  const currentGroupNames = accountData.groupNames || [];

  // 设置对话框数据
  document.getElementById('edit-subaccount-id').value = subAccountId;
  document.getElementById('edit-subaccount-password').value = '';
  
  // 加载组列表
  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/group/my`, {
      headers: {
        satoken: await getToken(),
      },
    });

    if (response.ok) {
      const data = await response.json();
      const groups = data.groups || [];
      
      const groupSelect = document.getElementById('edit-subaccount-group');
      groupSelect.innerHTML = '';
      
      // 找到当前子账号所属的第一个组
      let currentGroupId = null;
      if (currentGroupNames.length > 0) {
        const currentGroup = groups.find(g => g.groupName === currentGroupNames[0]);
        if (currentGroup) {
          currentGroupId = currentGroup.id;
        }
      }
      
      // 填充组选项，并选中当前组
      groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.groupName;
        if (group.id === currentGroupId) {
          option.selected = true;
        }
        groupSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Load groups error:', error);
  }

  // 显示对话框
  document.getElementById('edit-subaccount-dialog').classList.add('show');
}

// 确认编辑子账号
async function confirmEditSubAccount() {
  const subAccountId = document.getElementById('edit-subaccount-id').value;
  const password = document.getElementById('edit-subaccount-password').value.trim();
  const groupId = document.getElementById('edit-subaccount-group').value;

  // 验证密码（如果填写了）
  if (password && password.length < 6) {
    showMessage("message-subaccounts", "❌ 密码至少需要6位", "error");
    return;
  }

  // 验证组ID
  if (!groupId) {
    showMessage("message-subaccounts", "❌ 请选择所属组", "error");
    return;
  }

  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/auth/subaccount/${subAccountId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        satoken: await getToken(),
      },
      body: JSON.stringify({
        password: password || null,
        groupId: groupId
      }),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      showMessage("message-subaccounts", `✅ ${data.message || "子账号信息更新成功"}`, "success");
      document.getElementById('edit-subaccount-dialog').classList.remove('show');
      loadAccount();
    } else {
      showMessage("message-subaccounts", `❌ 更新失败：${data.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error('Edit subaccount error:', error);
    showMessage("message-subaccounts", `❌ 更新异常：${error.message || "未知错误"}`, "error");
  }
}

// 取消编辑子账号
function cancelEditSubAccount() {
  document.getElementById('edit-subaccount-dialog').classList.remove('show');
}

// 修改密码
async function handleChangePassword() {
  const currentPassword = elements.currentPassword.value.trim();
  const newPassword = elements.newPassword.value.trim();
  const confirmPassword = elements.confirmPassword.value.trim();

  if (!currentPassword || !newPassword || !confirmPassword) {
    showMessage("message-password", "❌ 请填写所有密码字段", "error");
    return;
  }

  if (newPassword.length < 6) {
    showMessage("message-password", "❌ 新密码至少需要6位", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showMessage("message-password", "❌ 两次输入的新密码不一致", "error");
    return;
  }

  elements.btnChangePassword.disabled = true;
  elements.btnChangePassword.textContent = "修改中...";

  try {
    const response = await changePassword(currentPassword, newPassword);

    if (response.ok) {
      showMessage("message-password", `✅ ${response.message || "密码修改成功"}`, "success");
      // 清空输入
      elements.currentPassword.value = "";
      elements.newPassword.value = "";
      elements.confirmPassword.value = "";
    } else {
      showMessage("message-password", `❌ 修改失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Change password error:", error);
    showMessage("message-password", `❌ 修改异常：${error.message || "未知错误"}`, "error");
  } finally {
    elements.btnChangePassword.disabled = false;
    elements.btnChangePassword.textContent = "修改密码";
  }
}

// 创建子账号
async function showSubaccountDialog() {
  elements.subaccountUsername.value = "";
  elements.subaccountPassword.value = "";

  // 加载组列表
  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/group/my`, {
      headers: {
        satoken: await getToken(),
      },
    });

    if (response.ok) {
      const data = await response.json();
      const groups = data.groups || [];

      // 填充组选择下拉框
      elements.subaccountGroup.innerHTML = '<option value="">默认组</option>';
      groups.forEach(group => {
        const option = document.createElement("option");
        option.value = group.id;
        option.textContent = group.groupName;
        elements.subaccountGroup.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Load groups error:", error);
  }

  elements.subaccountDialog.classList.add("show");
}

function hideSubaccountDialog() {
  elements.subaccountDialog.classList.remove("show");
}

async function handleConfirmSubaccount() {
  const username = elements.subaccountUsername.value.trim();
  const password = elements.subaccountPassword.value.trim();
  const groupId = elements.subaccountGroup.value; // 获取选中的组ID

  if (!username || !password) {
    showMessage("message-subaccounts", "❌ 请填写用户名和密码", "error");
    return;
  }

  if (password.length < 6) {
    showMessage("message-subaccounts", "❌ 密码至少需要6位", "error");
    return;
  }

  elements.btnConfirmSubaccount.disabled = true;
  elements.btnConfirmSubaccount.textContent = "创建中...";

  try {
    const response = await createSubAccount(username, password, null, groupId);

    if (response.ok) {
      hideSubaccountDialog();
      showMessage("message-subaccounts", `✅ ${response.message || "子账号创建成功"}`, "success");
      loadAccount();
    } else {
      showMessage("message-subaccounts", `❌ 创建失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Create subaccount error:", error);
    showMessage("message-subaccounts", `❌ 创建异常：${error.message || "未知错误"}`, "error");
  } finally {
    elements.btnConfirmSubaccount.disabled = false;
    elements.btnConfirmSubaccount.textContent = "创建";
  }
}

// ========== 组管理 ==========
async function loadGroups() {
  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/group/my`, {
      headers: {
        satoken: await getToken(),
      },
    });

    if (response.ok) {
      const data = await response.json();
      const groups = data.groups || [];
      renderGroups(groups);
    } else {
      elements.groupsList.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 48px 24px; color: #9ca3af;">
            <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">❌</div>
            <div style="font-size: 16px;">加载组列表失败</div>
          </td>
        </tr>
      `;
    }
  } catch (error) {
    console.error("Load groups error:", error);
    elements.groupsList.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 48px 24px; color: #9ca3af;">
          <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">👥</div>
          <div style="font-size: 16px; margin-bottom: 8px;">您还没有创建任何组</div>
          <div style="font-size: 14px;">点击上方的"创建新组"按钮可创建组</div>
        </td>
      </tr>
    `;
  }
}

function renderGroups(groups) {
  const container = elements.groupsList;

  if (groups.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 48px 24px; color: #9ca3af;">
          <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">👥</div>
          <div style="font-size: 16px; margin-bottom: 8px;">您还没有创建任何组</div>
          <div style="font-size: 14px;">点击上方的"创建新组"按钮可创建组</div>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = groups
    .map(
      (group) => `
    <tr data-id="${group.id}">
      <td class="col-name" title="${group.groupName}">${group.groupName}</td>
      <td class="col-host" title="${group.description || "无"}">${group.description || "-"}</td>
      <td>${group.memberCount || 0}</td>
      <td>${group.bundleCount || 0}</td>
      <td class="col-actions">
        <button class="btn btn-primary btn-small edit-group" data-id="${group.id}" data-name="${group.groupName}" data-description="${group.description || ""}">✏️ 编辑</button>
        <button class="btn btn-primary btn-small manage-group" data-id="${group.id}">⚙️ 管理</button>
        <button class="btn btn-danger btn-small delete-group" data-id="${group.id}" data-name="${group.groupName}">🗑️ 删除</button>
      </td>
    </tr>
  `
    )
    .join("");

  // 绑定事件
  container.querySelectorAll(".edit-group").forEach((btn) => {
    btn.addEventListener("click", handleEditGroup);
  });

  container.querySelectorAll(".manage-group").forEach((btn) => {
    btn.addEventListener("click", handleManageGroup);
  });

  container.querySelectorAll(".delete-group").forEach((btn) => {
    btn.addEventListener("click", handleDeleteGroup);
  });
}

// 创建组
function showGroupDialog() {
  elements.groupName.value = "";
  elements.groupDescription.value = "";
  elements.groupDialog.classList.add("show");
}

function hideGroupDialog() {
  elements.groupDialog.classList.remove("show");
}

async function handleConfirmGroup() {
  const groupName = elements.groupName.value.trim();
  const description = elements.groupDescription.value.trim();

  if (!groupName) {
    showMessage("message-groups", "❌ 请输入组名称", "error");
    return;
  }

  elements.btnConfirmGroup.disabled = true;
  elements.btnConfirmGroup.textContent = "创建中...";

  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/group/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        satoken: await getToken(),
      },
      body: JSON.stringify({
        groupName,
        description: description || null,
      }),
    });

    if (response.ok) {
      hideGroupDialog();
      showMessage("message-groups", "✅ 组创建成功", "success");
      loadGroups();
    } else {
      const data = await response.json();
      showMessage("message-groups", `❌ 创建失败：${data.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Create group error:", error);
    showMessage("message-groups", `❌ 创建异常：${error.message || "未知错误"}`, "error");
  } finally {
    elements.btnConfirmGroup.disabled = false;
    elements.btnConfirmGroup.textContent = "创建";
  }
}

// 编辑组
async function handleEditGroup(event) {
  const button = event.target;
  const groupId = button.dataset.id;
  const groupName = button.dataset.name;
  const description = button.dataset.description;

  // 填充编辑对话框
  elements.editGroupId.value = groupId;
  elements.editGroupName.value = groupName;
  elements.editGroupDescription.value = description;

  // 显示对话框
  showEditGroupDialog();
}

function showEditGroupDialog() {
  elements.editGroupDialog.classList.add("show");
}

function hideEditGroupDialog() {
  elements.editGroupDialog.classList.remove("show");
}

async function handleConfirmEditGroup() {
  const groupId = elements.editGroupId.value;
  const groupName = elements.editGroupName.value.trim();
  const description = elements.editGroupDescription.value.trim();

  if (!groupName) {
    showMessage("message-groups", "❌ 组名称不能为空", "error");
    return;
  }

  elements.btnConfirmEditGroup.disabled = true;
  elements.btnConfirmEditGroup.textContent = "保存中...";

  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/group/${groupId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        satoken: await getToken(),
      },
      body: JSON.stringify({
        groupName,
        description: description || null,
      }),
    });

    if (response.ok) {
      hideEditGroupDialog();
      showMessage("message-groups", "✅ 组信息已更新", "success");
      loadGroups();
    } else {
      const data = await response.json();
      showMessage("message-groups", `❌ 更新失败：${data.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Edit group error:", error);
    showMessage("message-groups", `❌ 更新异常：${error.message || "未知错误"}`, "error");
  } finally {
    elements.btnConfirmEditGroup.disabled = false;
    elements.btnConfirmEditGroup.textContent = "保存";
  }
}

// 管理组成员
async function handleManageGroup(event) {
  const button = event.target;
  const groupId = button.dataset.id;

  // 获取组名称
  const groupRow = button.closest('tr');
  const groupName = groupRow.querySelector('.col-name').textContent;

  // 设置组ID和组名
  elements.manageGroupId.value = groupId;
  elements.manageGroupName.textContent = groupName;

  // 显示对话框
  elements.manageGroupDialog.classList.add('show');

  // 加载成员列表
  await loadGroupMembers(groupId);

  // 加载站点列表
  await loadGroupBundles(groupId);
}

// Tab 切换
function handleManageTabSwitch(event) {
  const button = event.target;
  const tabName = button.dataset.manageTab;

  // 移除所有 active 状态
  document.querySelectorAll('[data-manage-tab]').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.manage-tab-pane').forEach(pane => {
    pane.style.display = 'none';
    pane.classList.remove('active');
  });

  // 添加当前 tab 的 active 状态
  button.classList.add('active');
  const targetPane = document.getElementById(`manage-tab-${tabName}`);
  if (targetPane) {
    targetPane.style.display = 'block';
    targetPane.classList.add('active');
  }
}

// 关闭组管理对话框
function hideManageGroupDialog() {
  elements.manageGroupDialog.classList.remove('show');
}

// 显示添加成员对话框
function showAddMemberDialog() {
  const groupId = elements.manageGroupId.value;
  elements.addMemberGroupId.value = groupId;
  elements.addMemberUsername.value = '';
  elements.addMemberRole.value = 'MEMBER';
  elements.addMemberDialog.classList.add('show');
}

// 隐藏添加成员对话框
function hideAddMemberDialog() {
  elements.addMemberDialog.classList.remove('show');
}

// 加载组成员列表
async function loadGroupMembers(groupId) {
  try {
    const response = await getGroupMembers(groupId);
    renderGroupMembers(response.members || []);
  } catch (error) {
    console.error('Load group members error:', error);
    elements.manageMembersList.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 24px; color: #ef4444;">
          ❌ 加载失败：${error.message || '未知错误'}
        </td>
      </tr>
    `;
  }
}

// 从组中移除站点
async function handleRemoveBundleFromGroup(event) {
  const button = event.target;
  const bundleId = button.dataset.bundleId;
  const groupId = elements.manageGroupId.value;

  if (!confirm('确定要将此站点从组中移除吗？\n\n站点将转为私有模式，组内其他成员将无法访问。')) {
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = '移除中...';

  try {
    // 获取当前Bundle信息
    const bundle = allBundles.find(b => b.id === bundleId);
    if (!bundle) {
      throw new Error('Bundle不存在');
    }

    // 计算剩余天数
    const now = Date.now();
    const remainingMs = bundle.expireAt - now;
    const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    // 调用更新API，将groupId设置为null，shareMode改为PRIVATE
    const response = await updateBundle(bundleId, {
      name: bundle.name,
      description: bundle.description,
      tags: bundle.tags,
      shareMode: 'PRIVATE',
      groupId: null,
      expireDays: remainingDays,
    });

    if (response.ok) {
      showMessage('message-groups', '✅ 站点已从组中移除', 'success');
      // 刷新站点列表
      await loadGroupBundles(groupId);
      // 刷新主站点列表
      await loadSites();
    } else {
      showMessage('message-groups', `❌ 移除失败：${response.error || '未知错误'}`, 'error');
    }
  } catch (error) {
    console.error('Remove bundle from group error:', error);
    showMessage('message-groups', `❌ 移除异常：${error.message || '未知错误'}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 移除成员
async function handleRemoveMember(event) {
  const button = event.target;
  const userId = button.dataset.userId;
  const groupId = elements.manageGroupId.value;

  if (!confirm('确定要移除这个成员吗？')) {
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = '移除中...';

  try {
    const response = await removeGroupMember(groupId, userId);

    if (response.ok) {
      showMessage('message-groups', `✅ ${response.message || '成员已移除'}`, 'success');
      // 刷新成员列表
      await loadGroupMembers(groupId);
    } else {
      showMessage('message-groups', `❌ 移除失败：${response.error || '未知错误'}`, 'error');
    }
  } catch (error) {
    console.error('Remove member error:', error);
    showMessage('message-groups', `❌ 移除异常：${error.message || '未知错误'}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 确认添加成员
async function handleConfirmAddMember() {
  const groupId = elements.addMemberGroupId.value;
  const username = elements.addMemberUsername.value.trim();
  const roleInGroup = elements.addMemberRole.value;

  if (!username) {
    showMessage('message-groups', '❌ 用户名不能为空', 'error');
    return;
  }

  elements.btnConfirmAddMember.disabled = true;
  elements.btnConfirmAddMember.textContent = '添加中...';

  try {
    const response = await addGroupMember(groupId, username, roleInGroup);

    if (response.ok) {
      hideAddMemberDialog();
      showMessage('message-groups', `✅ ${response.message || '成员添加成功'}`, 'success');
      // 刷新成员列表
      await loadGroupMembers(groupId);
    } else {
      showMessage('message-groups', `❌ 添加失败：${response.error || '未知错误'}`, 'error');
    }
  } catch (error) {
    console.error('Add member error:', error);
    showMessage('message-groups', `❌ 添加异常：${error.message || '未知错误'}`, 'error');
  } finally {
    elements.btnConfirmAddMember.disabled = false;
    elements.btnConfirmAddMember.textContent = '添加';
  }
}

// 渲染组成员列表
function renderGroupMembers(members) {
  const container = elements.manageMembersList;
  const currentUserId = currentUser?.userId;

  if (members.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 48px 24px; color: #9ca3af;">
          <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">👥</div>
          <div style="font-size: 16px; margin-bottom: 8px;">暂无成员</div>
          <div style="font-size: 14px;">点击上方的"添加成员"按钮可添加成员</div>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = members.map(member => {
    const joinedDate = new Date(member.joinedAt).toLocaleString('zh-CN');
    const roleText = member.roleInGroup === 'OWNER' ? '👑 组主' : 
                     member.roleInGroup === 'ADMIN' ? '🛡️ 管理员' : '👤 成员';
    
    // 不能移除组主账号
    const canRemove = member.roleInGroup !== 'OWNER';
    
    return `
      <tr>
        <td>${member.username}</td>
        <td>${roleText}</td>
        <td title="${joinedDate}">${joinedDate}</td>
        <td>
          ${canRemove ? `<button class="btn btn-danger btn-small remove-member" data-user-id="${member.userId}">🗑️ 移除</button>` : '-'}
        </td>
      </tr>
    `;
  }).join('');

  // 绑定移除按钮事件
  container.querySelectorAll('.remove-member').forEach(btn => {
    btn.addEventListener('click', handleRemoveMember);
  });
}

// 加载组内站点列表
async function loadGroupBundles(groupId) {
  try {
    const response = await getGroupBundles(groupId);
    renderGroupBundles(response.bundles || []);
  } catch (error) {
    console.error('Load group bundles error:', error);
    elements.manageBundlesList.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 24px; color: #ef4444;">
          ❌ 加载失败：${error.message || '未知错误'}
        </td>
      </tr>
    `;
  }
}

// 渲染组内站点列表
function renderGroupBundles(bundles) {
  const container = elements.manageBundlesList;
  const currentUserId = currentUser?.userId;

  if (bundles.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 48px 24px; color: #9ca3af;">
          <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">📦</div>
          <div style="font-size: 16px; margin-bottom: 8px;">组内暂无站点</div>
          <div style="font-size: 14px;">在站点管理中将站点添加到组即可在此查看</div>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = bundles.map(bundle => {
    const expireDate = new Date(bundle.expireAt).toLocaleString('zh-CN');
    
    // 只有站点所有者可以从组中移除站点
    const isOwner = bundle.ownerId === currentUserId;
    
    return `
      <tr>
        <td class="col-name" title="${bundle.name}">${bundle.name}</td>
        <td class="col-host" title="${bundle.host}">${bundle.host}</td>
        <td>${bundle.ownerName}</td>
        <td class="col-expire" title="${expireDate}">${expireDate}</td>
        <td class="col-actions">
          ${isOwner ? `<button class="btn btn-danger btn-small remove-bundle-from-group" data-bundle-id="${bundle.id}">🗑️ 从组中移除</button>` : '-'}
        </td>
      </tr>
    `;
  }).join('');

  // 绑定移除按钮事件
  container.querySelectorAll('.remove-bundle-from-group').forEach(btn => {
    btn.addEventListener('click', handleRemoveBundleFromGroup);
  });
}

// 删除组
async function handleDeleteGroup(event) {
  const button = event.target;
  const groupId = button.dataset.id;
  const groupName = button.dataset.name;

  // 获取组成员数量
  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/group/${groupId}/members`, {
      headers: {
        satoken: await getToken(),
      },
    });

    let memberCount = 0;
    if (response.ok) {
      const data = await response.json();
      memberCount = data.members?.length || 0;
    }

    // 填充删除确认对话框
    elements.deleteGroupId.value = groupId;
    elements.deleteGroupName.textContent = groupName;
    elements.deleteMemberCount.textContent = memberCount;

    // 显示确认对话框
    showDeleteGroupDialog();
  } catch (error) {
    console.error("Get group members error:", error);
    // 即使获取成员数失败，也显示删除对话框
    elements.deleteGroupId.value = groupId;
    elements.deleteGroupName.textContent = groupName;
    elements.deleteMemberCount.textContent = "未知";
    showDeleteGroupDialog();
  }
}

function showDeleteGroupDialog() {
  elements.deleteGroupDialog.classList.add("show");
}

function hideDeleteGroupDialog() {
  elements.deleteGroupDialog.classList.remove("show");
}

async function handleConfirmDeleteGroup() {
  const groupId = elements.deleteGroupId.value;

  elements.btnConfirmDeleteGroup.disabled = true;
  elements.btnConfirmDeleteGroup.textContent = "删除中...";

  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/group/${groupId}`, {
      method: "DELETE",
      headers: {
        satoken: await getToken(),
      },
    });

    if (response.ok) {
      const data = await response.json();
      hideDeleteGroupDialog();
      showMessage(
        "message-groups",
        `✅ 组已删除（移除了 ${data.affectedMembers || 0} 个成员，更新了 ${data.affectedBundles || 0} 个 Bundle）`,
        "success"
      );
      loadGroups();
    } else {
      const data = await response.json();
      showMessage("message-groups", `❌ 删除失败：${data.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Delete group error:", error);
    showMessage("message-groups", `❌ 删除异常：${error.message || "未知错误"}`, "error");
  } finally {
    elements.btnConfirmDeleteGroup.disabled = false;
    elements.btnConfirmDeleteGroup.textContent = "确认删除";
  }
}

// ========== 工具函数 ==========
async function getToken() {
  const data = await chrome.storage.sync.get("token");
  return data.token || "";
}

function showMessage(elementId, text, type = "info") {
  const element = document.getElementById(elementId);
  element.textContent = text;
  element.className = `message show ${type}`;

  // 3秒后自动隐藏
  setTimeout(() => {
    element.className = "message";
  }, 3000);
}

/**
 * 显示成功消息（用于分享管理等全局提示）
 */
function showSuccess(message) {
  // 创建临时提示元素
  const toast = document.createElement('div');
  toast.className = 'toast toast-success';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(toast);
  
  // 3秒后自动移除
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

/**
 * 显示错误消息（用于分享管理等全局提示）
 */
function showError(message) {
  // 创建临时提示元素
  const toast = document.createElement('div');
  toast.className = 'toast toast-error';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ef4444;
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(toast);
  
  // 3秒后自动移除
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

/**
 * 格式化日期时间戳
 */
function formatDate(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN');
}

// 退出登录
async function handleLogout() {
  if (!confirm("确定要退出登录吗？")) return;

  try {
    await logout();
    await chrome.storage.sync.remove("token");
    currentUser = null;
    window.location.href = chrome.runtime.getURL("src/popup/popup.html");
  } catch (error) {
    console.error("Logout error:", error);
  }
}

// ========== 初始化和认证检查 ==========
async function checkAuthAndInit() {
  try {
    const userInfo = await me();

    if (userInfo && userInfo.userId) {
      currentUser = userInfo;
      elements.userInfo.textContent = `当前用户：${userInfo.username}`;

      // 根据用户角色控制Tab可见性
      const accountTabBtn = document.getElementById("tab-account-btn");
      const groupsTabBtn = document.getElementById("tab-groups-btn");
      const adminTabBtn = document.getElementById("tab-admin-btn");

      if (userInfo.role === "GLOBAL_ADMIN") {
        // 全局管理员：显示所有Tab
        if (accountTabBtn) accountTabBtn.style.display = "block";
        if (groupsTabBtn) groupsTabBtn.style.display = "block";
        if (adminTabBtn) adminTabBtn.style.display = "block";
      } else if (userInfo.role === "GROUP_OWNER") {
        // 主账号：显示账号管理和组管理，隐藏全局管理
        if (accountTabBtn) accountTabBtn.style.display = "block";
        if (groupsTabBtn) groupsTabBtn.style.display = "block";
        if (adminTabBtn) adminTabBtn.style.display = "none";
      } else {
        // 子账号（NORMAL_USER）：只显示站点管理
        if (accountTabBtn) accountTabBtn.style.display = "none";
        if (groupsTabBtn) groupsTabBtn.style.display = "none";
        if (adminTabBtn) adminTabBtn.style.display = "none";
      }

      // 初始化Tab切换
      initTabs();

      // 加载默认Tab数据（站点管理）
      loadSites();
    } else {
      // 未登录，跳转到popup登录
      window.location.href = chrome.runtime.getURL("src/popup/popup.html");
    }
  } catch (error) {
    console.error("Auth check error:", error);
    // 登录失败，跳转到popup
    window.location.href = chrome.runtime.getURL("src/popup/popup.html");
  }
}

// ========== 绑定事件 ==========
function bindEvents() {
  // 头部
  elements.btnLogout.addEventListener("click", handleLogout);

  // 账号管理
  elements.btnChangePassword.addEventListener("click", handleChangePassword);
  elements.btnCreateSubaccount.addEventListener("click", showSubaccountDialog);
  elements.btnCancelSubaccount.addEventListener("click", hideSubaccountDialog);
  elements.btnConfirmSubaccount.addEventListener("click", handleConfirmSubaccount);
  elements.btnCancelEditSubaccount.addEventListener("click", cancelEditSubAccount);
  elements.btnConfirmEditSubaccount.addEventListener("click", confirmEditSubAccount);

  // 组管理
  elements.btnCreateGroup.addEventListener("click", showGroupDialog);
  elements.btnCancelGroup.addEventListener("click", hideGroupDialog);
  elements.btnConfirmGroup.addEventListener("click", handleConfirmGroup);

  // 编辑组对话框
  elements.btnCancelEditGroup.addEventListener("click", hideEditGroupDialog);
  elements.btnConfirmEditGroup.addEventListener("click", handleConfirmEditGroup);

  // 删除组确认对话框
  elements.btnCancelDeleteGroup.addEventListener("click", hideDeleteGroupDialog);
  elements.btnConfirmDeleteGroup.addEventListener("click", handleConfirmDeleteGroup);

  // 组管理对话框
  elements.btnCloseManageGroup.addEventListener("click", hideManageGroupDialog);
  elements.btnAddMember.addEventListener("click", showAddMemberDialog);

  // 添加成员对话框
  elements.btnCancelAddMember.addEventListener("click", hideAddMemberDialog);
  elements.btnConfirmAddMember.addEventListener("click", handleConfirmAddMember);

  // 组管理对话框 Tab 切换
  document.querySelectorAll('[data-manage-tab]').forEach(btn => {
    btn.addEventListener('click', handleManageTabSwitch);
  });

  // 管理员管理
  if (elements.btnCreateMainAccount) {
    elements.btnCreateMainAccount.addEventListener("click", showMainAccountDialog);
    elements.btnCancelMainAccount.addEventListener("click", hideMainAccountDialog);
    elements.btnConfirmMainAccount.addEventListener("click", handleConfirmMainAccount);
  }
  if (elements.btnBackToList) {
    elements.btnBackToList.addEventListener("click", backToAdminList);
  }

  // 详情对话框
  if (elements.btnCloseDetail) {
    elements.btnCloseDetail.addEventListener("click", hideDetailDialog);
  }

  // 编辑对话框
  if (elements.btnCancelEdit) {
    elements.btnCancelEdit.addEventListener("click", hideEditDialog);
  }
  if (elements.btnConfirmEdit) {
    elements.btnConfirmEdit.addEventListener("click", handleConfirmEdit);
  }
}

// ========== 全局管理（仅管理员）==========
let currentViewingUserId = null; // 保存当前查看的用户ID

async function loadAdminUsers() {
  try {
    const response = await listMainAccounts();

    if (response.users && response.users.length > 0) {
      renderAdminUsers(response.users);
    } else {
      elements.adminUsersList.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 48px 24px; color: #9ca3af;">
            <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">👤</div>
            <div style="font-size: 16px; margin-bottom: 8px;">暂无主账号</div>
            <div style="font-size: 14px;">点击上方的\"创建主账号\"按钮可创建</div>
          </td>
        </tr>
      `;
    }
  } catch (error) {
    console.error("Load admin users error:", error);
    elements.adminUsersList.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: #9ca3af; padding: 24px;">
          ❌ 加载失败：${error.message || "未知错误"}
        </td>
      </tr>
    `;
  }
}

function renderAdminUsers(users) {
  const container = elements.adminUsersList;

  container.innerHTML = users
    .map((user) => {
      const createdDate = new Date(user.createdAt).toLocaleString("zh-CN");
      const roleText = user.role === "GLOBAL_ADMIN" ? "🛡️ 管理员" : user.role === "GROUP_OWNER" ? "👑 主账号" : "👤 普通";
      const statusText = user.status === "ACTIVE" ? "✅ 正常" : "❌ 已禁用";

      return `
    <tr data-id="${user.userId}">
      <td class="col-name" title="${user.username}">${user.username}</td>
      <td class="col-host" title="${user.email || "-"}">${user.email || "-"}</td>
      <td>${roleText}</td>
      <td>${statusText}</td>
      <td class="col-expire" title="${createdDate}">${createdDate}</td>
      <td class="col-actions">
        <button class="btn btn-primary btn-small view-user-detail" data-id="${user.userId}">👁️ 查看</button>
        <button class="btn ${user.status === "ACTIVE" ? "btn-secondary" : "btn-success"} btn-small toggle-main-account" data-id="${user.userId}">
          ${user.status === "ACTIVE" ? "🚫 停用" : "✅ 启用"}
        </button>
        <button class="btn btn-danger btn-small delete-main-account" data-id="${user.userId}">🗑️ 删除</button>
      </td>
    </tr>
  `;
    })
    .join("");

  // 绑定事件
  container.querySelectorAll(".view-user-detail").forEach((btn) => {
    btn.addEventListener("click", handleViewUserDetail);
  });
  container.querySelectorAll(".toggle-main-account").forEach((btn) => {
    btn.addEventListener("click", handleToggleMainAccount);
  });
  container.querySelectorAll(".delete-main-account").forEach((btn) => {
    btn.addEventListener("click", handleDeleteMainAccount);
  });
}

// 处理切换主账号状态
async function handleToggleMainAccount(event) {
  const button = event.target;
  const userId = button.dataset.id;

  if (!confirm("确定要切换该主账号的状态吗？该操作会影响主账号及其所有子账号！")) {
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;

  try {
    const response = await toggleMainAccountStatus(userId);

    if (response.ok) {
      showMessage("message-admin", `✅ ${response.message || "状态已更新"}`, "success");
      loadAdminUsers();
    } else {
      showMessage("message-admin", `❌ 操作失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Toggle main account error:", error);
    showMessage("message-admin", `❌ 操作异常：${error.message || "未知错误"}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 处理删除主账号
async function handleDeleteMainAccount(event) {
  const button = event.target;
  const userId = button.dataset.id;

  if (!confirm("确定要删除该主账号吗？该操作会删除主账号及其所有子账号，且无法恢复！")) {
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "删除中...";

  try {
    const response = await deleteMainAccount(userId);

    if (response.ok) {
      showMessage("message-admin", `✅ ${response.message || "主账号已删除"}`, "success");
      loadAdminUsers();
    } else {
      showMessage("message-admin", `❌ 删除失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Delete main account error:", error);
    showMessage("message-admin", `❌ 删除异常：${error.message || "未知错误"}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function handleViewUserDetail(event) {
  const button = event.target;
  const userId = button.dataset.id;
  currentViewingUserId = userId; // 保存当前查看的用户ID

  try {
    const response = await getUserDetails(userId);

    if (response && response.userId) {
      const stats = response.stats || {};

      // 隐藏列表视图，显示详情视图
      document.getElementById("admin-list-view").style.display = "none";
      document.getElementById("admin-detail-view").style.display = "block";

      // 填充用户基本信息
      document.getElementById("detail-user-name").textContent = response.username;
      document.getElementById("detail-user-id").textContent = `用户 ID: ${response.userId}`;

      // 角色显示
      const roleText = response.role === "GLOBAL_ADMIN" ? "🛡️ 全局管理员" :
                       response.role === "GROUP_OWNER" ? "👑 主账号" : "👤 普通用户";
      document.getElementById("detail-user-role").textContent = roleText;

      // 基本信息
      document.getElementById("detail-user-email").textContent = response.email || "未设置";
      document.getElementById("detail-user-status").textContent = response.status === "ACTIVE" ? "✅ 正常" : "❌ 已禁用";
      document.getElementById("detail-user-created").textContent = new Date(response.createdAt).toLocaleString("zh-CN");

      // 统计信息
      document.getElementById("detail-bundle-count").textContent = stats.bundleCount || 0;
      document.getElementById("detail-member-count").textContent = stats.memberCount || 0;

      // 初始化详情页面的Tab切换
      initDetailTabs();

      // 加载默认Tab（站点管理）
      loadDetailTabData("bundles");
    } else {
      showMessage("message-admin", "❌ 未能获取用户详情", "error");
    }
  } catch (error) {
    console.error("Get user details error:", error);
    showMessage("message-admin", `❌ 获取用户详情失败：${error.message || "未知错误"}`, "error");
  }
}

// 初始化详情页面的Tab切换（只绑定一次）
let detailTabsInitialized = false;

function initDetailTabs() {
  if (detailTabsInitialized) return; // 已经初始化过，直接返回

  // 使用更精确的选择器，只选择详情视图中的Tab
  const tabButtons = document.querySelectorAll("#admin-detail-view .detail-tab-button");
  const tabPanes = document.querySelectorAll("#admin-detail-view .detail-tab-pane");

  // 如果找不到Tab按钮，说明DOM还没准备好，不设置标志，允许重试
  if (tabButtons.length === 0) {
    console.warn("Detail tab buttons not found, will retry on next call");
    return;
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.detailTab;
      if (!tabName) return; // 防御性检查

      // 移除所有active状态
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabPanes.forEach((pane) => pane.classList.remove("active"));

      // 添加当前tab的active状态
      button.classList.add("active");
      const targetPane = document.getElementById(`detail-tab-${tabName}`);
      if (targetPane) {
        targetPane.classList.add("active");
      }

      // 加载对应tab的数据
      loadDetailTabData(tabName);
    });
  });

  detailTabsInitialized = true;
  console.log("Detail tabs initialized successfully");
}

// 加载详情Tab数据
function loadDetailTabData(tabName) {
  if (!currentViewingUserId) return;

  switch (tabName) {
    case "bundles":
      loadUserBundles(currentViewingUserId);
      break;
    case "accounts":
      loadUserSubAccounts(currentViewingUserId);
      break;
    case "groups":
      loadUserGroups(currentViewingUserId);
      break;
  }
}

async function loadUserBundles(userId) {
  const container = document.getElementById("detail-bundles-list");

  try {
    // 管理员专用API：获取指定用户的所有Bundle（不受分享模式限制）
    const response = await getUserBundles(userId);

    // 使用返回的bundles
    const userBundles = response.bundles || [];

    if (userBundles.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 48px 24px; color: #9ca3af;">
            <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">📦</div>
            <div style="font-size: 16px;">该用户还没有创建任何 Bundle</div>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = userBundles
      .map((bundle) => {
        const expireDate = new Date(bundle.expireAt).toLocaleString("zh-CN");
        const createdDate = new Date(bundle.createdAt || Date.now()).toLocaleString("zh-CN");
        const shareModeText = bundle.shareMode === "PRIVATE" ? "🔐 个人" :
                              bundle.shareMode === "GROUP_ONLY" ? "🔒 组内" : "🌐 公开";

        return `
          <tr>
            <td class="col-name" title="${bundle.name}">${bundle.name}</td>
            <td class="col-host" title="${bundle.host}">${bundle.host}</td>
            <td>${shareModeText}</td>
            <td class="col-expire" title="${expireDate}">${expireDate}</td>
            <td class="col-expire" title="${createdDate}">${createdDate}</td>
            <td class="col-actions">
              <button class="btn btn-danger btn-small admin-delete-bundle" data-id="${bundle.id}">🗑️ 删除</button>
            </td>
          </tr>
        `;
      })
      .join("");

    // 绑定删除事件
    container.querySelectorAll(".admin-delete-bundle").forEach((btn) => {
      btn.addEventListener("click", handleAdminDeleteBundle);
    });
  } catch (error) {
    console.error("Load user bundles error:", error);
    container.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: #ef4444; padding: 24px;">
          ❌ 加载失败：${error.message || "未知错误"}
        </td>
      </tr>
    `;
  }
}

// 管理员删除Bundle
async function handleAdminDeleteBundle(event) {
  const button = event.target;
  const bundleId = button.dataset.id;

  if (!confirm("确定要删除该用户的这个站点吗？删除后将无法恢复！")) {
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "删除中...";

  try {
    const response = await deleteBundle(bundleId);

    if (response.ok) {
      showMessage("message-admin-detail", `✅ ${response.message || "站点已删除"}`, "success");
      loadUserBundles(currentViewingUserId);
      // 刷新统计数据
      const userDetails = await getUserDetails(currentViewingUserId);
      if (userDetails && userDetails.stats) {
        document.getElementById("detail-bundle-count").textContent = userDetails.stats.bundleCount || 0;
      }
    } else {
      showMessage("message-admin-detail", `❌ 删除失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Admin delete bundle error:", error);
    showMessage("message-admin-detail", `❌ 删除异常：${error.message || "未知错误"}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 加载用户的子账号列表
async function loadUserSubAccounts(userId) {
  const container = document.getElementById("detail-subaccounts-list");

  try {
    // 调用管理员API查询指定用户的子账号
    const response = await getUserSubAccounts(userId);

    if (response.subaccounts && response.subaccounts.length > 0) {
      container.innerHTML = response.subaccounts
        .map(
          (account) => `
        <tr>
          <td>${account.username}</td>
          <td>${new Date(account.createdAt).toLocaleString("zh-CN")}</td>
          <td>${account.status === "ACTIVE" ? "✅ 正常" : "❌ 已禁用"}</td>
          <td>
            <button class="btn ${account.status === "ACTIVE" ? "btn-secondary" : "btn-success"} btn-small toggle-user-subaccount" data-user-id="${userId}" data-id="${account.userId}">
              ${account.status === "ACTIVE" ? "🚫 停用" : "✅ 启用"}
            </button>
            <button class="btn btn-danger btn-small delete-user-subaccount" data-user-id="${userId}" data-id="${account.userId}">🗑️ 删除</button>
          </td>
        </tr>
      `
        )
        .join("");

      // 绑定事件
      container.querySelectorAll(".toggle-user-subaccount").forEach((btn) => {
        btn.addEventListener("click", handleToggleUserSubAccount);
      });
      container.querySelectorAll(".delete-user-subaccount").forEach((btn) => {
        btn.addEventListener("click", handleDeleteUserSubAccount);
      });
    } else {
      container.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: #9ca3af; padding: 24px;">
            ${response.message || "📝 该用户暂无子账号"}
          </td>
        </tr>
      `;
    }
  } catch (error) {
    console.error("Load user subaccounts error:", error);
    container.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: #ef4444; padding: 24px;">
          ❌ 加载失败：${error.message || "未知错误"}
        </td>
      </tr>
    `;
  }
}

// 处理切换用户子账号状态（管理员操作）
async function handleToggleUserSubAccount(event) {
  const button = event.target;
  const userId = button.dataset.userId;
  const subAccountId = button.dataset.id;

  button.disabled = true;
  const originalText = button.textContent;

  try {
    const response = await toggleUserSubAccountStatus(userId, subAccountId);

    if (response.ok) {
      showMessage("message-admin-detail", `✅ ${response.message || "状态已更新"}`, "success");
      loadUserSubAccounts(userId);
    } else {
      showMessage("message-admin-detail", `❌ 操作失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Toggle user subaccount error:", error);
    showMessage("message-admin-detail", `❌ 操作异常：${error.message || "未知错误"}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 处理删除用户子账号（管理员操作）
async function handleDeleteUserSubAccount(event) {
  const button = event.target;
  const userId = button.dataset.userId;
  const subAccountId = button.dataset.id;

  if (!confirm("确定要删除该用户的这个子账号吗？删除后将无法恢复！")) {
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "删除中...";

  try {
    const response = await deleteUserSubAccount(userId, subAccountId);

    if (response.ok) {
      showMessage("message-admin-detail", `✅ ${response.message || "子账号已删除"}`, "success");
      loadUserSubAccounts(userId);
    } else {
      showMessage("message-admin-detail", `❌ 删除失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Delete user subaccount error:", error);
    showMessage("message-admin-detail", `❌ 删除异常：${error.message || "未知错误"}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 加载用户的组列表
async function loadUserGroups(userId) {
  const container = document.getElementById("detail-groups-list");

  try {
    // 调用管理员API查询指定用户的组
    const response = await getUserGroups(userId);

    if (!response || !response.groups) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #ef4444; padding: 24px;">
            ❌ 获取组列表失败
          </td>
        </tr>
      `;
      return;
    }

    const groups = response.groups || [];

    if (groups.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 48px 24px; color: #9ca3af;">
            <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">👥</div>
            <div style="font-size: 16px;">该用户还没有创建任何组</div>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = groups
      .map(
        (group) => `
      <tr data-id="${group.id}">
        <td class="col-name" title="${group.groupName}">${group.groupName}</td>
        <td class="col-host" title="${group.description || "无"}">${group.description || "-"}</td>
        <td>${group.memberCount || 0}</td>
        <td>${group.bundleCount || 0}</td>
        <td>${new Date(group.createdAt || Date.now()).toLocaleString("zh-CN")}</td>
        <td class="col-actions">
          <button class="btn btn-primary btn-small manage-user-group" data-id="${group.id}">⚙️ 管理</button>
          <button class="btn btn-danger btn-small delete-user-group" data-id="${group.id}">🗑️ 删除</button>
        </td>
      </tr>
    `
      )
      .join("");

    // 绑定事件
    container.querySelectorAll(".manage-user-group").forEach((btn) => {
      btn.addEventListener("click", handleManageUserGroup);
    });

    container.querySelectorAll(".delete-user-group").forEach((btn) => {
      btn.addEventListener("click", handleAdminDeleteGroup);
    });
  } catch (error) {
    console.error("Load user groups error:", error);
    container.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: #ef4444; padding: 24px;">
          ❌ 加载异常：${error.message || "未知错误"}
        </td>
      </tr>
    `;
  }
}

// 管理员管理用户的组
async function handleManageUserGroup(event) {
  const button = event.target;
  const groupId = button.dataset.id;

  // 获取组名称
  const groupRow = button.closest('tr');
  const groupName = groupRow.querySelector('.col-name').textContent;

  // 设置组ID和组名
  elements.manageGroupId.value = groupId;
  elements.manageGroupName.textContent = groupName;

  // 显示对话框
  elements.manageGroupDialog.classList.add('show');

  // 加载成员列表
  await loadGroupMembers(groupId);

  // 加载站点列表
  await loadGroupBundles(groupId);
}

// 管理员删除用户的组
async function handleAdminDeleteGroup(event) {
  const button = event.target;
  const groupId = button.dataset.id;

  if (!confirm("确定要删除该用户的这个组吗？删除后组内的成员和共享将会被移除！")) {
    return;
  }

  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/group/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        satoken: await getToken(),
      },
      body: JSON.stringify({ groupId }),
    });

    if (response.ok) {
      showMessage("message-admin-detail", "✅ 组已删除", "success");
      loadUserGroups(currentViewingUserId);
      // 刷新统计数据
      const userDetails = await getUserDetails(currentViewingUserId);
      if (userDetails && userDetails.stats) {
        document.getElementById("detail-member-count").textContent = userDetails.stats.memberCount || 0;
      }
    } else {
      const data = await response.json();
      showMessage("message-admin-detail", `❌ 删除失败：${data.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Admin delete group error:", error);
    showMessage("message-admin-detail", `❌ 删除异常：${error.message || "未知错误"}`, "error");
  }
}

function backToAdminList() {
  // 清除当前查看的用户ID
  currentViewingUserId = null;

  // 重置Tab状态为第一个Tab（使用精确选择器）
  const tabButtons = document.querySelectorAll("#admin-detail-view .detail-tab-button");
  const tabPanes = document.querySelectorAll("#admin-detail-view .detail-tab-pane");

  tabButtons.forEach((btn, index) => {
    if (index === 0) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  tabPanes.forEach((pane, index) => {
    if (index === 0) {
      pane.classList.add("active");
    } else {
      pane.classList.remove("active");
    }
  });

  // 显示列表视图，隐藏详情视图
  document.getElementById("admin-list-view").style.display = "block";
  document.getElementById("admin-detail-view").style.display = "none";
}

function showMainAccountDialog() {
  elements.mainAccountUsername.value = "";
  elements.mainAccountPassword.value = "";
  elements.mainAccountEmail.value = "";
  elements.mainAccountDialog.classList.add("show");
}

function hideMainAccountDialog() {
  elements.mainAccountDialog.classList.remove("show");
}

async function handleConfirmMainAccount() {
  const username = elements.mainAccountUsername.value.trim();
  const password = elements.mainAccountPassword.value.trim();
  const email = elements.mainAccountEmail.value.trim() || null;

  if (!username || !password) {
    showMessage("message-admin", "❌ 请填写用户名和密码", "error");
    return;
  }

  if (password.length < 6) {
    showMessage("message-admin", "❌ 密码至少需要6位", "error");
    return;
  }

  elements.btnConfirmMainAccount.disabled = true;
  elements.btnConfirmMainAccount.textContent = "创建中...";

  try {
    const response = await createMainAccount(username, password, email);

    if (response.ok) {
      hideMainAccountDialog();
      showMessage("message-admin", `✅ ${response.message || "主账号创建成功"}`, "success");
      loadAdminUsers();
    } else {
      showMessage("message-admin", `❌ 创建失败：${response.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("Create main account error:", error);
    showMessage("message-admin", `❌ 创建异常：${error.message || "未知错误"}`, "error");
  } finally {
    elements.btnConfirmMainAccount.disabled = false;
    elements.btnConfirmMainAccount.textContent = "创建";
  }
}

// ========== 初始化 ==========
async function init() {
  // 获取所有 DOM 元素
  elements = {
    // 头部
    userInfo: document.getElementById("user-info"),
    btnLogout: document.getElementById("btn-logout"),

    // 站点管理
    mySitesList: document.getElementById("my-sites-list"),
    importedSitesList: document.getElementById("imported-sites-list"),

    // 账号管理
    currentPassword: document.getElementById("current-password"),
    newPassword: document.getElementById("new-password"),
    confirmPassword: document.getElementById("confirm-password"),
    btnChangePassword: document.getElementById("btn-change-password"),
    btnCreateSubaccount: document.getElementById("btn-create-subaccount"),
    subaccountsList: document.getElementById("subaccounts-list"),

    // 子账号对话框
    subaccountDialog: document.getElementById("subaccount-dialog"),
    subaccountUsername: document.getElementById("subaccount-username"),
    subaccountPassword: document.getElementById("subaccount-password"),
    subaccountGroup: document.getElementById("subaccount-group"),
    btnCancelSubaccount: document.getElementById("btn-cancel-subaccount"),
    btnConfirmSubaccount: document.getElementById("btn-confirm-subaccount"),

    // 编辑子账号对话框
    editSubaccountDialog: document.getElementById("edit-subaccount-dialog"),
    editSubaccountId: document.getElementById("edit-subaccount-id"),
    editSubaccountPassword: document.getElementById("edit-subaccount-password"),
    editSubaccountGroup: document.getElementById("edit-subaccount-group"),
    btnCancelEditSubaccount: document.getElementById("btn-cancel-edit-subaccount"),
    btnConfirmEditSubaccount: document.getElementById("btn-confirm-edit-subaccount"),

    // 组管理
    groupsList: document.getElementById("groups-list"),
    btnCreateGroup: document.getElementById("btn-create-group"),

    // 创建组对话框
    groupDialog: document.getElementById("group-dialog"),
    groupName: document.getElementById("group-name"),
    groupDescription: document.getElementById("group-description"),
    btnCancelGroup: document.getElementById("btn-cancel-group"),
    btnConfirmGroup: document.getElementById("btn-confirm-group"),

    // 编辑组对话框
    editGroupDialog: document.getElementById("edit-group-dialog"),
    editGroupId: document.getElementById("edit-group-id"),
    editGroupName: document.getElementById("edit-group-name"),
    editGroupDescription: document.getElementById("edit-group-description"),
    btnCancelEditGroup: document.getElementById("btn-cancel-edit-group"),
    btnConfirmEditGroup: document.getElementById("btn-confirm-edit-group"),

    // 删除组确认对话框
    deleteGroupDialog: document.getElementById("delete-group-dialog"),
    deleteGroupId: document.getElementById("delete-group-id"),
    deleteGroupName: document.getElementById("delete-group-name"),
    deleteMemberCount: document.getElementById("delete-member-count"),
    btnCancelDeleteGroup: document.getElementById("btn-cancel-delete-group"),
    btnConfirmDeleteGroup: document.getElementById("btn-confirm-delete-group"),

    // 组管理对话框
    manageGroupDialog: document.getElementById("manage-group-dialog"),
    manageGroupId: document.getElementById("manage-group-id"),
    manageGroupName: document.getElementById("manage-group-name"),
    manageMembersList: document.getElementById("manage-members-list"),
    manageBundlesList: document.getElementById("manage-bundles-list"),
    btnCloseManageGroup: document.getElementById("btn-close-manage-group"),
    btnAddMember: document.getElementById("btn-add-member"),

    // 添加成员对话框
    addMemberDialog: document.getElementById("add-member-dialog"),
    addMemberGroupId: document.getElementById("add-member-group-id"),
    addMemberUsername: document.getElementById("add-member-username"),
    addMemberRole: document.getElementById("add-member-role"),
    btnCancelAddMember: document.getElementById("btn-cancel-add-member"),
    btnConfirmAddMember: document.getElementById("btn-confirm-add-member"),

    // 管理员管理
    adminUsersList: document.getElementById("admin-users-list"),
    btnCreateMainAccount: document.getElementById("btn-create-main-account"),
    btnBackToList: document.getElementById("btn-back-to-list"),

    // 创建主账号对话框
    mainAccountDialog: document.getElementById("main-account-dialog"),
    mainAccountUsername: document.getElementById("main-account-username"),
    mainAccountPassword: document.getElementById("main-account-password"),
    mainAccountEmail: document.getElementById("main-account-email"),
    btnCancelMainAccount: document.getElementById("btn-cancel-main-account"),
    btnConfirmMainAccount: document.getElementById("btn-confirm-main-account"),

    // 详情对话框
    detailDialog: document.getElementById("detail-dialog"),
    detailId: document.getElementById("detail-id"),
    detailName: document.getElementById("detail-name"),
    detailHost: document.getElementById("detail-host"),
    detailShareMode: document.getElementById("detail-share-mode"),
    detailDescription: document.getElementById("detail-description"),
    detailTags: document.getElementById("detail-tags"),
    detailCreatedAt: document.getElementById("detail-created-at"),
    detailExpireAt: document.getElementById("detail-expire-at"),
    btnCloseDetail: document.getElementById("btn-close-detail"),

    // 编辑对话框
    editDialog: document.getElementById("edit-dialog"),
    editBundleId: document.getElementById("edit-bundle-id"),
    editName: document.getElementById("edit-name"),
    editDescription: document.getElementById("edit-description"),
    editTags: document.getElementById("edit-tags"),
    editShareMode: document.getElementById("edit-share-mode"),
    editGroup: document.getElementById("edit-group"),
    editExpire: document.getElementById("edit-expire"),
    btnCancelEdit: document.getElementById("btn-cancel-edit"),
    btnConfirmEdit: document.getElementById("btn-confirm-edit"),
  };

  // 绑定事件
  bindEvents();

  // 检查认证状态并初始化
  await checkAuthAndInit();
}

// 启动
init();


// ========== 缓存清理功能 ==========

// 处理缓存清理按钮点击
async function handleCacheCleanup() {
  try {
    // 显示加载状态
    showMessage("message-cache-cleanup", "⏳ 正在扫描孤立数据...", "info");
    
    // 调用预览 API
    const response = await fetch(`${CONFIG.baseUrl}/api/auth/admin/cache/preview`, {
      headers: {
        satoken: await getToken(),
      },
    });

    const data = await response.json();

    if (response.ok) {
      // 检查是否有孤立数据
      const totalOrphaned = data.orphanedSitesCount + data.orphanedUsersCount + data.orphanedGroupsCount;
      
      if (totalOrphaned === 0) {
        showMessage("message-cache-cleanup", "✅ 系统数据正常，无需清理", "success");
        return;
      }

      // 显示预览数据
      document.getElementById('orphaned-sites-count').textContent = data.orphanedSitesCount;
      document.getElementById('orphaned-users-count').textContent = data.orphanedUsersCount;
      document.getElementById('orphaned-groups-count').textContent = data.orphanedGroupsCount;

      // 显示确认对话框
      document.getElementById('cache-cleanup-dialog').classList.add('show');
      
      // 清除消息
      showMessage("message-cache-cleanup", "", "");
    } else {
      showMessage("message-cache-cleanup", `❌ 预览失败：${data.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error('Cache cleanup preview error:', error);
    showMessage("message-cache-cleanup", `❌ 预览异常：${error.message || "未知错误"}`, "error");
  }
}

// 确认执行清理
async function confirmCacheCleanup() {
  const btnConfirm = document.getElementById('btn-confirm-cleanup');
  btnConfirm.disabled = true;
  btnConfirm.textContent = "清理中...";

  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/auth/admin/cache/cleanup`, {
      method: 'POST',
      headers: {
        satoken: await getToken(),
      },
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      // 关闭对话框
      document.getElementById('cache-cleanup-dialog').classList.remove('show');
      
      // 显示成功消息
      const message = `清理完成！删除了 ${data.deletedSitesCount} 个站点、${data.deletedUsersCount} 个用户、${data.deletedGroupsCount} 个组`;
      showMessage("message-cache-cleanup", `✅ ${message}`, "success");
    } else {
      showMessage("message-cache-cleanup", `❌ 清理失败：${data.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error('Cache cleanup error:', error);
    showMessage("message-cache-cleanup", `❌ 清理异常：${error.message || "未知错误"}`, "error");
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.textContent = "确认清理";
  }
}

// 取消清理
function cancelCacheCleanup() {
  document.getElementById('cache-cleanup-dialog').classList.remove('show');
}

// 绑定缓存清理相关事件
document.getElementById('btn-cache-cleanup')?.addEventListener('click', handleCacheCleanup);
document.getElementById('btn-confirm-cleanup')?.addEventListener('click', confirmCacheCleanup);
document.getElementById('btn-cancel-cleanup')?.addEventListener('click', cancelCacheCleanup);

// ========== 分享管理功能 ==========

/**
 * 打开分享管理对话框
 */
async function handleManageShares(bundleId, bundleName) {
  elements.shareBundleId.value = bundleId;
  elements.shareBundleName.textContent = bundleName;
  
  // 显示对话框
  elements.shareManagementDialog.classList.add('show');
  
  // 加载分享列表
  await loadShareList(bundleId);
}

/**
 * 加载分享列表
 */
async function loadShareList(bundleId) {
  const tbody = elements.shareList;
  
  // 显示加载状态
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #6b7280;"><div style="display: inline-block; animation: spin 1s linear infinite; width: 20px; height: 20px; border: 2px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%;"></div> 加载中...</td></tr>';
  
  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/bundle/${bundleId}/shares`, {
      headers: {
        satoken: await getToken(),
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      renderShareList(data.shares || []);
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || '加载分享列表失败';
      showError(errorMsg);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #ef4444;">❌ ${errorMsg}</td></tr>`;
    }
  } catch (error) {
    console.error('Load shares error:', error);
    const errorMsg = error.message || '网络错误，请检查连接';
    showError('加载分享列表异常：' + errorMsg);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #ef4444;">❌ 加载异常：${errorMsg}</td></tr>`;
  }
}

/**
 * 渲染分享列表
 */
function renderShareList(shares) {
  const tbody = elements.shareList;
  tbody.innerHTML = '';
  
  if (shares.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #9ca3af;">暂无分享记录</td></tr>';
    return;
  }
  
  shares.forEach(share => {
    const tr = document.createElement('tr');
    
    const shareLink = `${CONFIG.baseUrl}/share?token=${share.shareToken}`;
    const statusText = share.status === 'ACTIVE' ? '✅ 活跃' : '❌ 已撤销';
    const statusClass = share.status === 'ACTIVE' ? 'status-active' : 'status-revoked';
    // 使用实际用户数量而不是导入次数
    const actualUserCount = share.actualUserCount || 0;
    const usedCountText = actualUserCount > 0 ? `${actualUserCount} 人` : '0 人';
    
    tr.innerHTML = `
      <td>
        <input type="text" value="${shareLink}" readonly style="width: 100%; padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 4px;" />
      </td>
      <td>${formatDate(share.createdAt)}</td>
      <td>
        <span style="cursor: ${actualUserCount > 0 ? 'pointer' : 'default'}; color: ${actualUserCount > 0 ? '#3b82f6' : '#6b7280'};">
          ${usedCountText}
        </span>
        ${actualUserCount > 0 ? 
          `<button class="btn btn-small btn-primary view-users-btn" data-share-id="${share.id}" style="margin-left: 8px;">👥 查看</button>` : 
          ''}
      </td>
      <td><span class="${statusClass}">${statusText}</span></td>
      <td>
        <button class="btn btn-small btn-secondary copy-share-btn" data-link="${shareLink}">📋 复制</button>
        ${share.status === 'ACTIVE' ? 
          `<button class="btn btn-small btn-warning revoke-share-btn" data-share-id="${share.id}">🚫 撤销</button>` : 
          ''}
        <button class="btn btn-small btn-danger delete-share-btn" data-share-id="${share.id}">🗑️ 删除</button>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  // 绑定复制按钮事件
  tbody.querySelectorAll('.copy-share-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const link = e.target.dataset.link;
      copyShareLink(link);
    });
  });
  
  // 绑定撤销按钮事件
  tbody.querySelectorAll('.revoke-share-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const shareId = e.target.dataset.shareId;
      revokeShare(shareId, e.target);
    });
  });
  
  // 绑定删除按钮事件
  tbody.querySelectorAll('.delete-share-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const shareId = e.target.dataset.shareId;
      deleteShare(shareId, e.target);
    });
  });
  
  // 绑定查看使用者按钮事件
  tbody.querySelectorAll('.view-users-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const shareId = e.target.dataset.shareId;
      viewShareUsers(shareId);
    });
  });
}

/**
 * 创建分享链接
 */
async function createShare() {
  const bundleId = elements.shareBundleId.value;
  const button = elements.btnCreateShare;
  
  // 禁用按钮防止重复提交
  if (button.disabled) return;
  
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = '创建中...';
  
  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/bundle/${bundleId}/share`, {
      method: 'POST',
      headers: {
        satoken: await getToken(),
      },
    });
    
    if (response.ok) {
      showSuccess('✅ 分享链接创建成功');
      await loadShareList(bundleId);
    } else {
      const error = await response.json().catch(() => ({}));
      const errorMsg = error.error || '创建失败';
      showError('❌ ' + errorMsg);
    }
  } catch (error) {
    console.error('Create share error:', error);
    const errorMsg = error.message || '网络错误';
    showError('❌ 创建异常：' + errorMsg);
  } finally {
    // 恢复按钮状态
    button.disabled = false;
    button.textContent = originalText;
  }
}

/**
 * 复制分享链接
 */
function copyShareLink(link) {
  navigator.clipboard.writeText(link).then(() => {
    showSuccess('分享链接已复制');
  }).catch(() => {
    showError('复制失败');
  });
}

/**
 * 撤销分享（让分享链接失效，但保留记录）
 */
async function revokeShare(shareId, buttonElement) {
  const confirmed = confirm(
    '确定要撤销此分享链接吗？\n\n' +
    '⚠️ 警告：撤销后，所有通过此链接导入的用户将无法继续使用该站点。\n\n' +
    '分享记录会保留，但状态会变为"已撤销"。'
  );
  
  if (!confirmed) return;
  
  // 如果传入了按钮元素，禁用它
  let button = buttonElement;
  let originalText = '';
  if (button) {
    if (button.disabled) return;
    button.disabled = true;
    originalText = button.textContent;
    button.textContent = '撤销中...';
  }
  
  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/bundle/share/${shareId}`, {
      method: 'DELETE',
      headers: {
        satoken: await getToken(),
      },
    });
    
    if (response.ok) {
      showSuccess('✅ 分享已撤销');
      const bundleId = elements.shareBundleId.value;
      await loadShareList(bundleId);
    } else {
      const error = await response.json().catch(() => ({}));
      const errorMsg = error.error || '撤销失败';
      showError('❌ ' + errorMsg);
    }
  } catch (error) {
    console.error('Revoke share error:', error);
    const errorMsg = error.message || '网络错误';
    showError('❌ 撤销异常：' + errorMsg);
  } finally {
    // 恢复按钮状态
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

/**
 * 删除分享记录（彻底删除）
 */
async function deleteShare(shareId, buttonElement) {
  const confirmed = confirm(
    '确定要删除此分享记录吗？\n\n' +
    '⚠️ 警告：此操作将彻底删除分享记录，无法恢复！\n\n' +
    '如果只是想让分享失效，建议使用"撤销"功能。'
  );
  
  if (!confirmed) return;
  
  // 如果传入了按钮元素，禁用它
  let button = buttonElement;
  let originalText = '';
  if (button) {
    if (button.disabled) return;
    button.disabled = true;
    originalText = button.textContent;
    button.textContent = '删除中...';
  }
  
  try {
    // 调用删除 API（需要后端实现真正的删除接口）
    const response = await fetch(`${CONFIG.baseUrl}/api/bundle/share/${shareId}/delete`, {
      method: 'DELETE',
      headers: {
        satoken: await getToken(),
      },
    });
    
    if (response.ok) {
      showSuccess('✅ 分享记录已删除');
      const bundleId = elements.shareBundleId.value;
      await loadShareList(bundleId);
    } else {
      const error = await response.json().catch(() => ({}));
      const errorMsg = error.error || '删除失败';
      showError('❌ ' + errorMsg);
    }
  } catch (error) {
    console.error('Delete share error:', error);
    const errorMsg = error.message || '网络错误';
    showError('❌ 删除异常：' + errorMsg);
  } finally {
    // 恢复按钮状态
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

/**
 * 查看分享使用者列表
 */
async function viewShareUsers(shareId) {
  // 保存当前分享ID
  elements.currentShareId.value = shareId;
  
  // 显示对话框
  elements.shareUsersDialog.classList.add('show');
  
  // 加载使用者列表
  await loadShareUsers(shareId);
}

/**
 * 加载分享使用者列表
 */
async function loadShareUsers(shareId) {
  const tbody = elements.shareUsersList;
  
  // 显示加载状态
  tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #6b7280;"><div style="display: inline-block; animation: spin 1s linear infinite; width: 20px; height: 20px; border: 2px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%;"></div> 加载中...</td></tr>';
  
  try {
    const response = await getShareUsers(shareId);
    
    if (response.users) {
      renderShareUsers(response.users);
    } else {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #9ca3af;">暂无使用者</td></tr>';
    }
  } catch (error) {
    console.error('Load share users error:', error);
    const errorMsg = error.message || '网络错误';
    showError('❌ 加载使用者列表失败：' + errorMsg);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ef4444;">❌ 加载失败：${errorMsg}</td></tr>`;
  }
}

/**
 * 渲染分享使用者列表
 */
function renderShareUsers(users) {
  const tbody = elements.shareUsersList;
  tbody.innerHTML = '';
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #9ca3af;">暂无使用者</td></tr>';
    return;
  }
  
  users.forEach(user => {
    const tr = document.createElement('tr');
    
    const statusText = user.isVisible ? '✅ 活跃' : '❌ 已关闭';
    const statusClass = user.isVisible ? 'status-active' : 'status-revoked';
    
    tr.innerHTML = `
      <td>${user.username || user.userId}</td>
      <td>${formatDate(user.importedAt)}</td>
      <td><span class="${statusClass}">${statusText}</span></td>
      <td>
        ${user.isVisible ? 
          `<button class="btn btn-small btn-danger remove-user-btn" data-user-id="${user.userId}">🚫 移除</button>` : 
          '<span style="color: #9ca3af;">已移除</span>'}
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  // 绑定移除按钮事件
  tbody.querySelectorAll('.remove-user-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = e.target.dataset.userId;
      removeUserAccess(userId, e.target);
    });
  });
}

/**
 * 移除用户的分享访问权限
 */
async function removeUserAccess(userId, buttonElement) {
  const confirmed = confirm(
    '确定要移除该用户的访问权限吗？\n\n' +
    '移除后，该用户将无法继续使用此站点。'
  );
  
  if (!confirmed) return;
  
  const shareId = elements.currentShareId.value;
  let button = buttonElement;
  
  if (button) {
    if (button.disabled) return;
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = '移除中...';
  }
  
  try {
    const response = await removeShareUser(shareId, userId);
    
    if (response.ok) {
      showSuccess('✅ 用户访问权限已移除');
      // 重新加载使用者列表
      await loadShareUsers(shareId);
      // 同时刷新分享列表（更新使用次数）
      const bundleId = elements.shareBundleId.value;
      await loadShareList(bundleId);
    } else {
      const errorMsg = response.error || '移除失败';
      showError('❌ ' + errorMsg);
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  } catch (error) {
    console.error('Remove user access error:', error);
    const errorMsg = error.message || '网络错误';
    showError('❌ 移除异常：' + errorMsg);
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

// 将函数暴露到全局作用域，以便 HTML 中的 onclick 可以调用
window.handleManageShares = handleManageShares;
window.copyShareLink = copyShareLink;
window.revokeShare = revokeShare;

// 初始化分享管理相关元素
elements.shareManagementDialog = document.getElementById('share-management-dialog');
elements.shareBundleId = document.getElementById('share-bundle-id');
elements.shareBundleName = document.getElementById('share-bundle-name');
elements.shareList = document.getElementById('share-list');
elements.btnCreateShare = document.getElementById('btn-create-share');
elements.btnCloseShareDialog = document.getElementById('btn-close-share-dialog');

// 初始化分享使用者对话框元素
elements.shareUsersDialog = document.getElementById('share-users-dialog');
elements.currentShareId = document.getElementById('current-share-id');
elements.shareUsersList = document.getElementById('share-users-list');
elements.btnCloseShareUsersDialog = document.getElementById('btn-close-share-users-dialog');

// 添加事件监听器
if (elements.btnCreateShare) {
  elements.btnCreateShare.addEventListener('click', createShare);
}

if (elements.btnCloseShareDialog) {
  elements.btnCloseShareDialog.addEventListener('click', () => {
    elements.shareManagementDialog.classList.remove('show');
  });
}

if (elements.btnCloseShareUsersDialog) {
  elements.btnCloseShareUsersDialog.addEventListener('click', () => {
    elements.shareUsersDialog.classList.remove('show');
  });
}

// 点击遮罩层关闭对话框
if (elements.shareManagementDialog) {
  elements.shareManagementDialog.addEventListener('click', (e) => {
    if (e.target === elements.shareManagementDialog) {
      elements.shareManagementDialog.classList.remove('show');
    }
  });
}

if (elements.shareUsersDialog) {
  elements.shareUsersDialog.addEventListener('click', (e) => {
    if (e.target === elements.shareUsersDialog) {
      elements.shareUsersDialog.classList.remove('show');
    }
  });
}

/**
 * 查询站点的分享信息
 */
async function fetchShareInfo(bundleId) {
  try {
    const response = await listShares(bundleId);
    
    if (response.shares) {
      const activeShares = response.shares.filter(s => s.status === 'ACTIVE');
      const userCount = activeShares.reduce((sum, s) => sum + (s.usedCount || 0), 0);
      
      return {
        activeCount: activeShares.length,
        userCount: userCount,
      };
    }
  } catch (error) {
    console.error('Fetch share info error:', error);
  }
  
  return { activeCount: 0, userCount: 0 };
}
