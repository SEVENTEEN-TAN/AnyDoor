// 使用方法：直接从 popup 调用下列 API，baseUrl 从配置文件读取。
// 说明：MVP 封装 fetch，token 从 chrome.storage.sync 读取。

import { CONFIG } from "../config.js";

export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ token: "" }, (data) => {
      resolve({ baseUrl: CONFIG.baseUrl, token: data.token });
    });
  });
}

async function request(path, { method = "GET", body } = {}) {
  const { baseUrl, token } = await getSettings();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["satoken"] = token;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    const err = new Error("Not Login");
    err.code = 401;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`HTTP ${res.status}: ${text}`);
    err.code = res.status;
    throw err;
  }
  return res.json().catch(() => ({}));
}

export async function login(username, password) {
  const data = await request("/api/auth/login", { method: "POST", body: { username, password } });
  if (data && data.token) {
    await chrome.storage.sync.set({ token: data.token });
  }
  return data;
}

export function getBlacklist() {
  return request(`/api/blacklist`);
}

export function uploadBundle(payload) {
  return request(`/api/bundle/upload`, { method: "POST", body: payload });
}

export function writeback(bundleId) {
  return request(`/api/bundle/writeback`, { method: "POST", body: { bundleId } });
}

export function me() {
  return request(`/api/auth/me`);
}

export function logout() {
  return request(`/api/auth/logout`, { method: "POST" });
}

export function listBundles() {
  return request(`/api/bundle/list`);
}

export function importBundle(bundleId) {
  return request(`/api/bundle/import`, { method: "POST", body: { bundleId } });
}

export function updateShareMode(bundleId, shareMode) {
  return request(`/api/bundle/update-share-mode`, { method: "POST", body: { bundleId, shareMode } });
}

export function deleteBundle(bundleId) {
  return request(`/api/bundle/delete`, { method: "POST", body: { bundleId } });
}

export function removeReference(bundleId) {
  return request(`/api/bundle/remove-reference`, { method: "POST", body: { bundleId } });
}

export function changePassword(currentPassword, newPassword) {
  return request(`/api/auth/change-password`, { method: "POST", body: { currentPassword, newPassword } });
}

export function createSubAccount(username, password, email, groupId) {
  return request(`/api/auth/create-subaccount`, { method: "POST", body: { username, password, email, groupId } });
}

export function listSubAccounts() {
  return request(`/api/auth/subaccounts`);
}

// 管理员API
export function listMainAccounts() {
  return request(`/api/auth/admin/users`);
}

export function getUserDetails(userId) {
  return request(`/api/auth/admin/user/${userId}`);
}

export function createMainAccount(username, password, email) {
  return request(`/api/auth/admin/create-main-account`, { method: "POST", body: { username, password, email } });
}

// 管理员查询指定用户的子账号
export function getUserSubAccounts(userId) {
  return request(`/api/auth/admin/user/${userId}/subaccounts`);
}

// 管理员查询指定用户的组
export function getUserGroups(userId) {
  return request(`/api/auth/admin/user/${userId}/groups`);
}

// 子账号管理 - 切换状态（停用/启用）
export function toggleSubAccountStatus(subAccountId) {
  return request(`/api/auth/subaccount/toggle-status`, { method: "POST", body: { subAccountId } });
}

// 子账号管理 - 删除
export function deleteSubAccount(subAccountId) {
  return request(`/api/auth/subaccount/delete`, { method: "POST", body: { subAccountId } });
}

// 管理员 - 切换主账号状态（连带子账号）
export function toggleMainAccountStatus(userId) {
  return request(`/api/auth/admin/user/toggle-status`, { method: "POST", body: { userId } });
}

// 管理员 - 删除主账号（连带子账号）
export function deleteMainAccount(userId) {
  return request(`/api/auth/admin/user/delete`, { method: "POST", body: { userId } });
}

// 管理员 - 切换指定用户的子账号状态
export function toggleUserSubAccountStatus(userId, subAccountId) {
  return request(`/api/auth/admin/user/${userId}/subaccount/toggle-status`, { method: "POST", body: { subAccountId } });
}

// 管理员 - 删除指定用户的子账号
export function deleteUserSubAccount(userId, subAccountId) {
  return request(`/api/auth/admin/user/${userId}/subaccount/delete`, { method: "POST", body: { subAccountId } });
}

// 管理员 - 查询指定用户的所有Bundle
export function getUserBundles(userId) {
  return request(`/api/auth/admin/user/${userId}/bundles`);
}

// 获取当前用户的组列表
export function getMyGroups() {
  return request(`/api/group/my`);
}

// 获取Bundle详情
export function getBundleDetail(bundleId) {
  return request(`/api/bundle/detail/${bundleId}`);
}

// 更新Bundle信息
export function updateBundle(bundleId, data) {
  return request(`/api/bundle/update`, {
    method: "POST",
    body: {
      bundleId,
      name: data.name,
      description: data.description,
      tags: data.tags,
      shareMode: data.shareMode,
      groupId: data.groupId,
      expireDays: data.expireDays
    }
  });
}

// 更新组信息
export function updateGroup(groupId, groupName, description) {
  return request(`/api/group/${groupId}`, {
    method: "PUT",
    body: { groupName, description }
  });
}

// 删除组
export function deleteGroup(groupId) {
  return request(`/api/group/${groupId}`, {
    method: "DELETE"
  });
}

// 获取组详情
export function getGroupById(groupId) {
  return request(`/api/group/${groupId}`);
}

// 获取组成员数量
export function getGroupMemberCount(groupId) {
  return request(`/api/group/${groupId}/members`).then(res => res.members?.length || 0);
}

// 查询组成员列表
export function getGroupMembers(groupId) {
  return request(`/api/group/${groupId}/members`);
}

// 添加组成员
export function addGroupMember(groupId, username, roleInGroup) {
  return request(`/api/group/${groupId}/member`, {
    method: "POST",
    body: { username, roleInGroup }
  });
}

// 移除组成员
export function removeGroupMember(groupId, userId) {
  return request(`/api/group/${groupId}/member/${userId}`, {
    method: "DELETE"
  });
}

// 查询组内站点列表
export function getGroupBundles(groupId) {
  return request(`/api/group/${groupId}/bundles`);
}

// ========== 分享管理 API ==========

// 通过 share_token 导入站点
export function importByToken(shareToken) {
  return request('/api/bundle/import-by-token', {
    method: 'POST',
    body: { shareToken }
  });
}

// 创建分享记录
export function createShare(bundleId) {
  return request(`/api/bundle/${bundleId}/share`, {
    method: 'POST'
  });
}

// 查询分享列表
export function listShares(bundleId) {
  return request(`/api/bundle/${bundleId}/shares`);
}

// 撤销分享
export function revokeShare(shareId) {
  return request(`/api/bundle/share/${shareId}`, {
    method: 'DELETE'
  });
}

// 获取分享使用者列表
export function getShareUsers(shareId) {
  return request(`/api/bundle/share/${shareId}/users`);
}

// 移除特定用户的分享访问权限
export function removeShareUser(shareId, userId) {
  return request(`/api/bundle/share/${shareId}/user/${userId}`, {
    method: 'DELETE'
  });
}

// 关闭已导入的站点
export function closeReference(bundleId) {
  return request(`/api/bundle/${bundleId}/reference`, {
    method: 'DELETE'
  });
}

// 检查 Host 是否已存在
export function checkBundleExists(host) {
  return request(`/api/bundle/check-exists?host=${encodeURIComponent(host)}`);
}

// 快速更新 Bundle
export function quickUpdateBundle(payload) {
  return request(`/api/bundle/quick-update`, {
    method: 'POST',
    body: payload
  });
}
