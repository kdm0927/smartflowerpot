const DEMO_MODE = true;

const db = (wx.cloud && wx.cloud.database) ? wx.cloud.database() : null;
let OPENID = '';

Page({
  data:{
    today: new Date().toISOString().slice(0,10),
    role: 'patient',     // patient | carer
    roleLabel: 'patient',
    roomId: 'default',   // 같은 roomId면 서로 같은 투두 공유
    items: [],
    newText: '',
    _cloudReady:false
  },

  async onLoad(){
    await this.ensureOpenId();
    await this.loadRole();
    await this.loadRoom();
    await this.fetch();
  },

  // --- 입력/저장 ---
  onRoomInput(e){ this.setData({ roomId: e.detail.value.trim() }); },
  saveRoom(){
    const id = this.data.roomId || 'default';
    try{ wx.setStorageSync('ROOM_ID', id); }catch(_){}
    this.fetch();
  },
  onNewText(e){ this.setData({ newText: e.detail.value }); },

  // --- 추가 ---
  async addTodo(){
    const text = (this.data.newText||'').trim();
    if(!text) return wx.showToast({title:'내용을 입력해요', icon:'none'});
    const now = Date.now();

    if (DEMO_MODE || !this.data._cloudReady) {
      const item = {_id:'demo-'+now, text, done:false, doneByShort:'me', displayTime: fmt(now)};
      this.setData({ items: [item,...this.data.items], newText:'' });
      return;
    }

    try{
      await db.collection('todos').add({
        data:{
          roomId: this.data.roomId || 'default',
          text, done:false,
          ownerId: OPENID,
          canEdit: [OPENID],    // 최초 작성자는 편집 가능
          updatedAt: now
        }
      });
      this.setData({ newText:'' });
      this.fetch();
    }catch(e){
      wx.showToast({title:'추가 실패', icon:'none'});
    }
  },

  // --- 토글 ---
  async toggle(e){
    const id = e.currentTarget.dataset.id;
    if (DEMO_MODE || !this.data._cloudReady) {
      const items = this.data.items.map(it => it._id===id ? {...it, done:!it.done} : it);
      this.setData({ items });
      return;
    }

    try{
      // 낙관적 업데이트
      const items = this.data.items.slice();
      const idx = items.findIndex(it=>it._id===id);
      if (idx>=0) { items[idx].done = !items[idx].done; items[idx].doneByShort = short(OPENID); items[idx].displayTime = fmt(Date.now()); this.setData({ items }); }

      await db.collection('todos').doc(id).update({
        data:{
          done: db.command.not(true),  // true <-> false 토글
          doneBy: OPENID,
          updatedAt: Date.now()
        }
      });
    }catch(err){
      wx.showToast({title:'토글 실패', icon:'none'});
      this.fetch(); // 되돌림
    }
  },

  // --- 목록 ---
  async fetch(){
    if (DEMO_MODE || !this.data._cloudReady) {
      // 데모 3개
      const seed = [
        {_id:'d1', text:'아침 약 복용', done:false, doneByShort:'', displayTime: ''},
        {_id:'d2', text:'점심 20분 산책', done:true,  doneByShort:'CA', displayTime: fmt(Date.now()-3600e3)},
        {_id:'d3', text:'수분 섭취 1컵', done:false, doneByShort:'', displayTime: ''},
      ];
      this.setData({ items: seed });
      return;
    }

    const rid = this.data.roomId || 'default';
    const { data } = await db.collection('todos')
      .where({ roomId: rid, canEdit: db.command.in([OPENID]) })
      .orderBy('updatedAt','desc')
      .get();

    const list = (data||[]).map(d=>({
      _id: d._id,
      text: d.text,
      done: !!d.done,
      doneByShort: d.doneBy ? short(d.doneBy) : '',
      displayTime: d.updatedAt ? fmt(d.updatedAt) : ''
    }));
    this.setData({ items: list });
  },

  // --- 역할/방 로드 ---
  async loadRole(){
    if (DEMO_MODE || !this.data._cloudReady) {
      // 데모 기본: patient
      this.setData({ role:'patient', roleLabel:'patient' });
      return;
    }
    try{
      const doc = await db.collection('userRoles').doc(OPENID).get();
      const role = (doc?.data?.role) || 'patient';
      this.setData({ role, roleLabel: role });
    }catch(_){
      // 기본 patient로 생성
      try{
        await db.collection('userRoles').doc(OPENID).set({ data:{ role:'patient', ts:Date.now() } });
      }catch(__){}
      this.setData({ role:'patient', roleLabel:'patient' });
    }
    // 역할별 편집 권한은 canEdit 배열로 제어
  },

  async loadRoom(){
    let rid = 'default';
    try{ rid = wx.getStorageSync('ROOM_ID') || 'default'; }catch(_){}
    this.setData({ roomId: rid });
  },

  // --- OPENID & 클라우드 사용 가능 여부 ---
  async ensureOpenId(){
    try{
      const { result } = await wx.cloud.callFunction({ name:'quickstartFunctions', data:{ type:'getOpenId' } });
      OPENID = result?.openid || '';
      this.setData({ _cloudReady: !!(OPENID && db) });
    }catch(_){
      this.setData({ _cloudReady: false });
    }
  }
});

/* util */
function fmt(ts){
  const d=new Date(ts); const p=n=>n<10?'0'+n:n;
  return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function short(openid){ return (openid||'').slice(-2).toUpperCase(); }
