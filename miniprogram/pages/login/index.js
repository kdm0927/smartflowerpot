import { setAuth } from '../../utils/auth';

Page({
  data: { uid:'', pw:'' },
  onUid(e){ this.setData({ uid: e.detail.value }); },
  onPw(e){ this.setData({ pw: e.detail.value }); },

  async login(){
    const { uid, pw } = this.data;
    if (!uid || !pw) { wx.showToast({ title:'입력하세요', icon:'none' }); return; }

    // 1) 서버 연동이 있으면 여기에 wx.request로 /auth/login 호출
    //    const res = await wx.request({...});
    //    const { token, role, patientId } = res.data;
    //    setAuth({ token, role, patientId });
    //    return this.route(role, patientId);

    // 2) 프로토타입용 하드코드 계정
    if (uid === 'nurse' && pw === 'nurse123') {
      setAuth({ token:'demo', role:'nurse' });
      return this.route('nurse');
    }
    if (uid === 'patient' && pw === 'patient123') {
      setAuth({ token:'demo', role:'patient', patientId: 'patient_001' });
      return this.route('patient', 'patient_001');
    }
    wx.showToast({ title:'로그인 실패', icon:'none' });
  },

  route(role, patientId){
    if (role === 'nurse') {
      wx.reLaunch({ url: '/pages/nurse/menu' });
    } else {
      const pid = patientId || 'patient_001';
      wx.reLaunch({ url: `/pages/index/index?patientId=${pid}` });
    }
  }
});
