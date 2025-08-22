import { clearAuth } from '../../utils/auth';

Page(
  {
    // Navigation
    goStatus()  { wx.navigateTo({ url: '/pages/nurse/status' }); },
    goNoti() { wx.navigateTo({ url: '/pages/nurse/index' }); 
    },
    goFeedback() { wx.navigateTo({ url: '/pages/feedback/feedback' }); 
    },
    onLogout() {
      clearAuth();
      wx.reLaunch({ url: '/pages/login/index' });
    }
  }
);