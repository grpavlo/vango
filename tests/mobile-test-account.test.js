const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=require('./load-mobile-module.cjs');
const React=require('../mobile-app/node_modules/react');

function authHarness({metadata={},failRole=false}={}) {
  const states=[],refs=[],writes=[],calls=[];
  let index=0,refIndex=0,auth;
  const hooks={...React,useState:initial=>{
    const i=index++; if(!(i in states)) states[i]=initial;
    return [states[i],value=>{states[i]=value}];
  },useRef:initial=>{const i=refIndex++;return refs[i]||(refs[i]={current:initial})},useCallback:fn=>fn,useEffect:()=>{}};
  const storage={async setItem(k,v){writes.push([k,v])},async multiRemove(){},async removeItem(){}};
  const flow={getState:()=>null,dismissBlocked(){}};
  const module=load('src/AuthContext.js',{
    react:hooks,'./personalStorage':{__esModule:true,default:storage,pausePersonalStorage(){}},
    '@react-native-async-storage/async-storage':storage,
    './accountDeletionFlow':{createAccountDeletionFlow:()=>flow,isDeletionLocked:()=>false},
    './accountDeletionApi':{},'./clearPersonalData':{},'./callbackRegistry':{clearCallbacks(){}},
    './notifications':{},'./notificationCenter':{async setNotificationCenterUser(){},pauseNotificationStorage(){}},
    './api':{async apiFetch(url){calls.push(url);if(url==='/auth/role'&&failRole)throw Error('Offline');
      return {id:1,role:url==='/auth/role'?'DRIVER':'BOTH',...metadata}},isAccountSessionUnavailable:()=>false},
  });
  function render(){index=0;refIndex=0;auth=module.AuthProvider({children:null}).props.value;return auth}
  return {render,writes,calls};
}

test('driver questionnaire is skipped only with server-confirmed test profile readiness',async()=>{
  for(const metadata of [{isTestAccount:true,demoDriverProfileReady:true},{isTestAccount:true,demoDriverProfileReady:false},
    {isTestAccount:false,demoDriverProfileReady:true},{}]) {
    const h=authHarness({metadata});await h.render().login('token','BOTH',metadata);
    await h.render().selectRole('DRIVER',true);
    const auth=h.render();assert.equal(auth.role,'DRIVER');
    assert.equal(auth.needsProfileSetup,!(metadata.isTestAccount&&metadata.demoDriverProfileReady));
    assert.equal(auth.isTestAccount,metadata.isTestAccount===true);
    await auth.logout();assert.equal(h.render().isTestAccount,false);
  }
});

test('failed role request keeps local role and questionnaire state unchanged; retry remains possible',async()=>{
  const h=authHarness({failRole:true});await h.render().login('token','BOTH');
  for(let i=0;i<2;i++)await assert.rejects(h.render().selectRole('DRIVER',true),/Offline/);
  assert.equal(h.render().role,null);assert.equal(h.render().needsProfileSetup,false);
  assert.equal(h.writes.some(([key])=>key==='role'),false);
});

test('notice is shown for authenticated test identity and disappears for normal accounts or logout',()=>{
  for(const auth of [{token:'t',isTestAccount:true},{token:'t',isTestAccount:false},{token:null,isTestAccount:true}]) {
    const module=load('src/components/TestAccountNotice.js',{
      react:React,'react-native':{View:'View',Text:'Text',StyleSheet:{create:v=>v}},
      'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:44,bottom:0,left:0,right:0}),SafeAreaInsetsContext:React.createContext({})},
      '../AuthContext':{useAuth:()=>auth},
    });
    const node=module.default({children:'navigation'});
    if(auth.token&&auth.isTestAccount) {
      assert.equal(node.props.children[0].props.children[0].props.children,'Тестовий акаунт');
      assert.equal(node.props.children[1].props.value.top,0);
      assert.equal(node.props.children[0].props.style[1].paddingTop,52);
    } else assert.equal(node,'navigation');
  }
});
