const {test} = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-mobile-module.cjs');
const {createAccountDeletionFlow, DELETION_STORAGE_KEY, isDeletionLocked} = load('src/accountDeletionFlow.js');
const plain = value => JSON.parse(JSON.stringify(value));
function deferred() {let resolve, reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};}
function store(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {data,getItem:async key=>data.get(key)||null,setItem:async(key,value)=>data.set(key,value),
    removeItem:async key=>data.delete(key),getAllKeys:async()=>[...data.keys()],
    multiRemove:async keys=>keys.forEach(key=>data.delete(key))};
}
function harness({storage = store({token:'old-token',reservedPhones:'private-phone'}),request = async()=>({status:'deleted'}),cleanup}={}) {
  const sessions=[],completions=[],states=[];let calls=0,cleanups=0;
  const flow=createAccountDeletionFlow({storage,request:async token=>{calls++;return request(token)},
    cleanup:async()=>{cleanups++;if(cleanup)await cleanup();else await storage.multiRemove(['token','reservedPhones'])},
    onSession:token=>sessions.push(token),onComplete:message=>completions.push(message)});
  flow.subscribe(state=>states.push(state));
  return {flow,storage,sessions,completions,states,get calls(){return calls},get cleanups(){return cleanups}};
}

test('double confirmation submits only once; no cleanup/success before server confirmation',async()=>{
  const pending=deferred(),h=harness({request:()=>pending.promise});
  const first=h.flow.begin('old-token'),second=h.flow.begin('old-token');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.calls,1);assert.equal(h.cleanups,0);assert.equal(h.completions.length,0);
  assert.equal(isDeletionLocked(h.flow.getState()),true);assert.ok(h.storage.data.has(DELETION_STORAGE_KEY));
  pending.resolve({status:'deleted'});await Promise.all([first,second]);
  assert.equal(h.cleanups,1);assert.equal(h.completions.length,1);assert.equal(h.flow.getState(),null);
  assert.equal(h.storage.data.has('reservedPhones'),false);assert.equal(h.storage.data.has(DELETION_STORAGE_KEY),false);
});

test('active orders keep the account/caches intact and expose a return to order management',async()=>{
  const h=harness({request:async()=>{throw Object.assign(Error('Завершіть активні замовлення'),{code:'ACTIVE_ORDERS',orders:[{id:7,status:'DELIVERED'}]})}});
  await h.flow.begin('old-token');
  assert.equal(h.flow.getState().phase,'blocked');assert.equal(isDeletionLocked(h.flow.getState()),false);
  assert.deepEqual(plain(h.flow.getState().orders),[{id:7,status:'DELIVERED'}]);
  assert.equal(h.cleanups,0);assert.equal(h.completions.length,0);assert.equal(h.storage.data.get('token'),'old-token');
  assert.equal(h.storage.data.has(DELETION_STORAGE_KEY),false);assert.equal(h.sessions.at(-1),null);
  assert.match(h.flow.getState().message,/активні замовлення/);
  assert.match(h.flow.getState().message,/Завершіть або скасуйте/);
  assert.match(h.flow.getState().message,/акаунт не видалено/);
});

test('deletion failures explain session, access, connection and request limits separately',async()=>{
  for(const [status,message,expected] of [[401,'expired',/Сеанс завершився/],
    [403,'forbidden',/Доступ до акаунта обмежено/],
    [undefined,'network',/Перевірте інтернет/],
    [429,'Забагато спроб видалення. Зачекайте кілька хвилин і повторіть запит.',/Зачекайте/]]){
    const h=harness({request:async()=>{throw Object.assign(Error(message),{status})}});
    await h.flow.begin('old-token');assert.match(h.flow.getState().message,expected);
    assert.equal(h.completions.length,0);assert.equal(h.cleanups,0);
  }
});

test('pending files are not success; retry reaches server confirmation',async()=>{
  let count=0;const h=harness({request:async()=>({status:count++?'deleted':'cleanup_pending'})});
  await h.flow.begin('old-token');assert.equal(h.flow.getState().phase,'pending');assert.equal(h.cleanups,0);
  assert.equal(h.completions.length,0);await h.flow.retry();assert.equal(h.calls,2);assert.equal(h.completions.length,1);
});

test('lost response survives restart and retries the same self-deletion without restoring the account UI',async()=>{
  const first=harness({request:async()=>{throw Error('offline')}});await first.flow.begin('old-token');
  assert.equal(first.flow.getState().phase,'retry');assert.equal(first.completions.length,0);
  const reboot=harness({storage:first.storage});await reboot.flow.restore();
  assert.equal(isDeletionLocked(reboot.flow.getState()),true);assert.equal(reboot.flow.getState().token,'old-token');
  assert.equal(reboot.calls,0);await reboot.flow.retry();assert.equal(reboot.completions.length,1);
});

test('local cleanup failure persists server confirmation; restart retries cleanup without another DELETE',async()=>{
  const h=harness({cleanup:async()=>{throw Error('disk unavailable')}});await h.flow.begin('old-token');
  assert.equal(h.flow.getState().phase,'local_cleanup');assert.equal(h.completions.length,0);
  assert.equal(JSON.parse(h.storage.data.get(DELETION_STORAGE_KEY)).phase,'local_cleanup');
  const reboot=harness({storage:h.storage});await reboot.flow.restore();await reboot.flow.retry();
  assert.equal(reboot.calls,0);assert.equal(reboot.cleanups,1);assert.equal(reboot.completions.length,1);
});

test('cannot start destruction when progress cannot be persisted',async()=>{
  const storage=store();storage.setItem=async()=>{throw Error('full')};const h=harness({storage});
  await h.flow.begin('old-token');assert.equal(h.calls,0);assert.equal(h.flow.getState().phase,'blocked');
});

test('failure clearing the progress journal after ACTIVE_ORDERS remains retryable',async()=>{
  const storage=store();storage.removeItem=async()=>{throw Error('disk failure')};
  const h=harness({storage,request:async()=>{throw Object.assign(Error('active'),{code:'ACTIVE_ORDERS'})}});
  await h.flow.begin('old-token');assert.equal(h.flow.getState().phase,'retry');assert.equal(h.completions.length,0);
});

test('expired authentication never reports a deletion success',async()=>{
  const h=harness({request:async()=>{throw Object.assign(Error('expired'),{status:401})}});
  await h.flow.begin('old-token');assert.equal(h.flow.getState().phase,'auth_required');assert.equal(h.completions.length,0);
  await h.flow.exitUnconfirmed();assert.match(h.completions[0],/не підтверджене/);
});

test('restored uncertain deletion can exit without claiming success or sending another DELETE',async()=>{
  const storage=store({token:'old-token',reservedPhones:'private',
    [DELETION_STORAGE_KEY]:JSON.stringify({token:'old-token',phase:'requesting'})});
  const h=harness({storage});await h.flow.restore();await h.flow.exitUnconfirmed();
  assert.equal(h.calls,0);assert.equal(h.flow.getState(),null);
  assert.equal(storage.data.size,0);assert.equal(h.sessions.at(-1),null);
  assert.match(h.completions[0],/не підтверджене/);
});

test('non-JSON server errors preserve status and never confirm deletion',async()=>{
  for(const status of [401,403,404,405,503]){
    const client=load('src/accountDeletionApi.js',{'./api':{API_URL:'http://test.invalid/api'}},
      {fetch:async()=>({ok:false,status,json:async()=>{throw new SyntaxError('HTML')}})});
    const h=harness({request:client.requestAccountDeletion});await h.flow.begin('old-token');
    assert.equal(h.flow.getState().phase,[401,403].includes(status)?'auth_required':'retry');
    assert.equal(h.cleanups,0);assert.equal(h.completions.length,0);
    if(status===404||status===405)assert.match(h.flow.getState().message,/оновлення API/);
    if(status===503)assert.match(h.flow.getState().message,/недоступне на сервері/);
  }
});

test('client sends confirmed self DELETE and preserves ACTIVE_ORDERS details',async()=>{
  let captured;
  const client=load('src/accountDeletionApi.js',{'./api':{API_URL:'http://test.invalid/api'}},{fetch:async(url,options)=>{
    captured={url,options};return {ok:false,status:409,json:async()=>({code:'ACTIVE_ORDERS',message:'active',orders:[{id:3}]})};
  }});
  await assert.rejects(client.requestAccountDeletion('private-token'),error=>error.status===409&&error.orders[0].id===3);
  assert.equal(captured.url,'http://test.invalid/api/auth/me');assert.equal(captured.options.method,'DELETE');
  assert.equal(captured.options.headers.Authorization,'Bearer private-token');assert.deepEqual(JSON.parse(captured.options.body),{confirm:true});
});

test('client accepts only an explicit matching completion/pending status and scope',async()=>{
  for(const [status,body,valid] of [[200,{status:'deleted',scope:'application_data'},true],
    [202,{status:'cleanup_pending',scope:'application_data'},true],[200,{success:true},false],
    [202,{status:'deleted',scope:'application_data'},false],[200,{status:'deleted',scope:'unknown'},false]]){
    const client=load('src/accountDeletionApi.js',{'./api':{API_URL:'http://test.invalid/api'}},{fetch:async()=>({ok:true,status,json:async()=>body})});
    if(valid)assert.equal((await client.requestAccountDeletion('t')).status,body.status);
    else await assert.rejects(client.requestAccountDeletion('t'));
  }
});

test('late API 401 cannot interrupt deletion; background requests with the old session are stopped',async()=>{
  const pending=deferred();let requests=0,logouts=0;
  const api=load('src/api.js',{}, {fetch:async()=>{requests++;return pending.promise}});
  api.setUnauthorizedHandler(()=>{logouts++});
  const inFlight=api.apiFetch('/auth/me',{headers:{Authorization:'Bearer old'}});
  api.setAccountDeletionToken('old');
  await assert.rejects(api.apiFetch('/orders',{headers:{Authorization:'Bearer old'}}),e=>e.code==='ACCOUNT_DELETION_IN_PROGRESS');
  pending.resolve({ok:false,status:401,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({message:'expired'})});
  await assert.rejects(inFlight);assert.equal(requests,1);assert.equal(logouts,0);
});

test('paused personal storage drains old writes and rejects late cache recreation',async()=>{
  const data=store(),pending=deferred();data.setItem=async(key,value)=>{await pending.promise;data.data.set(key,value)};
  const storage=load('src/personalStorage.js',{'@react-native-async-storage/async-storage':data});
  const oldWrite=storage.default.setItem('location','private');storage.pausePersonalStorage(true);
  await storage.default.setItem('reservedPhones','late');assert.equal(data.data.has('reservedPhones'),false);
  let drained=false;const draining=storage.drainPersonalStorage().then(()=>{drained=true});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(drained,false);
  pending.resolve();await oldWrite;await draining;
  await data.multiRemove(await data.getAllKeys());await storage.default.setItem('location','restored');assert.equal(data.data.size,0);
});

test('local cleanup clears account storage, notification caches, callbacks and temporary photos but keeps its journal until the end',async()=>{
  const storage=store({token:'private',reservedPhones:'private',location:'private',
    'notification-center:v1:user:5':'private','order-updates:v3:DRIVER:t':'private',
    'city-offer-template:city':'private',[DELETION_STORAGE_KEY]:'recovery'});
  const effects=[];
  const module=load('src/clearPersonalData.js',{
    '@react-native-async-storage/async-storage':storage,
    'expo-file-system':{cacheDirectory:'file:///isolated-cache/',getInfoAsync:async()=>({exists:true}),
      readDirectoryAsync:async()=>['ImagePicker','photo.jpg'],deleteAsync:async uri=>effects.push(uri)},
    'expo-notifications':{cancelAllScheduledNotificationsAsync:async()=>effects.push('scheduled'),dismissAllNotificationsAsync:async()=>effects.push('delivered')},
    './accountDeletionFlow':{DELETION_STORAGE_KEY},'./personalStorage':{drainPersonalStorage:async()=>effects.push('drained')},
    './notificationCenter':{resetNotificationCenter:()=>effects.push('notification-memory')},'./callbackRegistry':{clearCallbacks:()=>effects.push('callbacks')},
  });
  await module.clearPersonalData();assert.deepEqual([...storage.data.keys()],[DELETION_STORAGE_KEY]);
  assert.deepEqual(effects,['drained','notification-memory','callbacks','scheduled','delivered','file:///isolated-cache/ImagePicker','file:///isolated-cache/photo.jpg']);
});

test('deleted avatar never renders a cached old photograph',()=>{
  const identity=load('src/accountIdentity.js');const React=require('../mobile-app/node_modules/react');
  const module=load('src/components/AccountAvatar.js',{'react':React,'react-native':{Image:'Image'},
    '@expo/vector-icons':{Ionicons:'Icon'},'../accountIdentity':identity,'./Colors':{colors:{gray500:'gray',green:'green'}}});
  const element=module.default({account:{name:'Акаунт видалено'},photoUri:'private-old-photo',size:48});
  assert.equal(element.type,'Icon');assert.equal(element.props.name,'ban-outline');assert.equal(element.props.source,undefined);
});

test('old in-flight 401 after cleanup cannot log out a newly signed-in account',async()=>{
  const pending=deferred();let logouts=0;
  const api=load('src/api.js',{}, {fetch:async()=>pending.promise});
  api.setUnauthorizedHandler(()=>{logouts++});
  const inFlight=api.apiFetch('/auth/me',{headers:{Authorization:'Bearer old-session'}});
  api.setAccountDeletionToken('old-session');api.retireAccountDeletionToken('old-session');api.setAccountDeletionToken(null);
  pending.resolve({ok:false,status:401,headers:{get:()=>''},text:async()=>''});
  await assert.rejects(inFlight);assert.equal(logouts,0);
});

test('an unreadable deletion journal never silently opens the normal account UI',async()=>{
  const storage=store();storage.getItem=async()=>{throw Error('unavailable')};const h=harness({storage});
  await h.flow.restore();assert.equal(isDeletionLocked(h.flow.getState()),true);
  assert.equal(h.flow.getState().phase,'auth_required');assert.equal(h.completions.length,0);
});

test('an old order-cache callback cannot recreate private state after deletion and a new login',async()=>{
  const gate=deferred(),data=store();let generation=0;
  data.getItem=async()=>{await gate.promise;return null};
  const module=load('src/orderUpdates.js',{'./personalStorage':{default:data,__esModule:true,getPersonalStorageGeneration:()=>generation}});
  const reconcile=module.reconcileOrderUpdates('DRIVER','old-token',[{id:5,status:'CREATED',createdAt:'2026-11-11T00:00:00Z'}]);
  generation++;gate.resolve();await reconcile;assert.equal(data.data.size,0);
});

test('a delayed notification cannot be copied into a newly logged-in account',async()=>{
  const data=store(),gate=deferred();let wait=false;
  const originalGet=data.getItem;data.getItem=async key=>{if(wait){wait=false;await gate.promise}return originalGet(key)};
  const center=load('src/notificationCenter.js',{'./personalStorage':data});
  await center.setNotificationCenterUser('old-user');wait=true;
  const oldNotification=center.addStoredNotification({id:'old',content:{title:'Private old user'}});
  await new Promise(resolve=>setImmediate(resolve));
  center.pauseNotificationStorage(true);center.resetNotificationCenter();center.pauseNotificationStorage(false);
  await center.setNotificationCenterUser('new-user');gate.resolve();
  assert.equal(await oldNotification,null);assert.equal(data.data.size,0);
});
