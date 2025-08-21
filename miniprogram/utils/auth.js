const KEY = 'auth';

export function setAuth({ token, role, patientId }) {
  wx.setStorageSync(KEY, { token, role, patientId });
}

export function getAuth() {
  return wx.getStorageSync(KEY) || null;
}

export function clearAuth() {
  wx.removeStorageSync(KEY);
}

export function requireRole(targetRole) {
  const a = getAuth();
  if (!a || a.role !== targetRole) {
    wx.reLaunch({ url: '/pages/login/index' });
    return false;
  }
  return true;
}
