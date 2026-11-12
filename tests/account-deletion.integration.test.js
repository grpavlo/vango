const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const databaseUrl = process.env.ACCOUNT_DELETION_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Set ACCOUNT_DELETION_TEST_DATABASE_URL to the disposable /tmp test cluster');
const parsed = new URL(databaseUrl);
if (parsed.pathname !== '/vango_account_deletion_test' || parsed.username !== 'vango_deletion_test' ||
    !/^\/tmp\/vango-account-deletion\.[A-Za-z0-9]+$/.test(parsed.searchParams.get('host') || '')) {
  throw new Error('Refusing to use any database except the isolated account-deletion test cluster');
}
require('dotenv').config = () => ({ parsed: {} });
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = 'account-deletion-test-only';
// Never contact external providers in these tests.
const express = require('express');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const { Sequelize } = require('sequelize');
const db = require('../src/config/db');
const User = require('../src/models/user');
const Order = require('../src/models/order');
const DriverProfile = require('../src/models/driverProfile');
const Favorite = require('../src/models/favorite');
const SavedSearch = require('../src/models/savedSearch');
const SupportQuestion = require('../src/models/supportQuestion');
const Notification = require('../src/models/notification');
const Rating = require('../src/models/rating');
const Transaction = require('../src/models/transaction');
const OrderResponse = require('../src/models/orderResponse');
const SearchEvent = require('../src/models/orderRouteSearchEvent');
const PortalAdmin = require('../src/models/portalAdmin');
const Job = require('../src/models/accountDeletionJob');
const UserUpload = require('../src/models/userUpload');
const { beginUploadWriter, closeUploadWriters } = require('../src/services/uploadWriter');
const migration = require('../src/migrations/20261111000000-account-deletion');
const deletion = require('../src/services/accountDeletion');
const uploads = require('../src/utils/uploadFiles');
const codes = require('../src/services/authCodes');
const { authenticate, authorize } = require('../src/middlewares/auth');
const { requireDispatcher } = require('../src/utils/dispatcherAccess');
const testAccounts = require('../src/services/testAccount');
const { upload } = require('../src/middlewares/upload');
const { authenticateAdminAccess } = require('../src/middlewares/adminAuth');
const { setupWebSocket } = require('../src/ws');
const namespace = `account-deletion-test-${randomUUID()}`;
const testDirectory = path.resolve(__dirname, '../uploads', namespace);
const app = express(); app.use(express.json());
app.use('/api/auth', require('../src/routes/authRoutes'));
app.use('/api/admin/auth', require('../src/routes/adminAuthRoutes'));
app.use('/api', require('../src/routes/driverProfileRoutes'));
app.use('/api/orders', require('../src/routes/orderRoutes'));
app.use('/demo-assets', express.static(path.resolve(__dirname, '../assets/demo-account')));
app.get('/api/dispatcher-check', authenticate, requireDispatcher, (_req,res)=>res.json({ok:true}));
app.get('/api/authorize-check', authenticate, authorize(['ADMIN']), (_req,res)=>res.json({ok:true}));
app.post('/test-upload', authenticate, upload.single('photo'), (req,res)=>res.json({url:`/uploads/${req.file.filename}`}));
app.get('/api/admin-check', authenticateAdminAccess, (_req, res) => res.json({ok: true}));
app.use(`/uploads/${namespace}`, express.static(testDirectory));
app.use((error, req, res, next) => res.status(500).json({code: 'TEST_ERROR'}));
let server, base, wss;
const token = user => jwt.sign({id: user.id}, process.env.JWT_SECRET, { expiresIn: '1h' });
async function request(url, authToken, body, method = 'DELETE') {
  const result = await fetch(base + url, { method, headers: {
    ...(authToken ? {Authorization: `Bearer ${authToken}`} : {}),
    ...(body ? {'Content-Type': 'application/json'} : {}),
  }, body: body ? JSON.stringify(body) : undefined });
  const text = await result.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: result.status, body: data };
}
async function user(extra = {}) {
  return User.create({ name: 'Private Name', email: `${randomUUID()}@test.invalid`,
    password: 'private-password', role: 'BOTH', ...extra });
}
async function order(customerId, extra = {}) {
  const future = new Date(Date.now() + 86400000);
  return Order.create({customerId, pickupLocation: 'Private address A', dropoffLocation: 'Private address B',
    cargoType: 'Private cargo text', pickupLat: 49, pickupLon: 30, price: 900,
    loadFrom: future, loadTo: future, unloadFrom: future, unloadTo: future, ...extra});
}
async function file(name) {
  await fs.writeFile(path.join(testDirectory, name), 'isolated-test-image');
  return `/uploads/${namespace}/${name}`;
}
before(async () => {
  // Destructive setup is guarded above and never reads .env.
  await db.sync({force: true});
  await db.getQueryInterface().removeColumn('users', 'deletedAt');
  await db.getQueryInterface().dropTable('accountDeletionJobs');
  await db.getQueryInterface().removeColumn('userUploads', 'writerLockKey');
  await migration.up(db.getQueryInterface(), Sequelize);
  await migration.up(db.getQueryInterface(), Sequelize); // deployment can retry safely
  await fs.mkdir(testDirectory, {recursive: true});
  server = http.createServer(app); wss = setupWebSocket(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (wss) { for (const client of wss.clients) client.terminate(); await new Promise(resolve => wss.close(resolve)); }
  if (server) await new Promise(resolve => server.close(resolve));
  await closeUploadWriters();
  await db.close();
  await fs.rm(testDirectory, {recursive: true, force: true});
});

test('requires authentication and explicit self confirmation; rejects target overrides', async () => {
  const a = await user(), b = await user();
  assert.equal((await request('/api/auth/me', null, {confirm: true})).status, 401);
  assert.equal((await request('/api/auth/me', token(a), {confirm: true, userId: b.id})).status, 400);
  assert.equal((await request(`/api/auth/me?userId=${b.id}`, token(a), {confirm: true})).status, 400);
  assert.equal((await request('/api/auth/me', token(a), {})).status, 400);
  assert.equal((await request(`/api/auth/me/${b.id}`, token(a), {confirm: true})).status, 404);
  assert.equal((await a.reload()).deletedAt, null);
  assert.equal((await b.reload()).deletedAt, null);
});

test('all active statuses block both customer and assigned driver without partial deletion', async () => {
  const other = await user();
  for (const side of ['customerId', 'driverId']) for (const status of ['CREATED','PENDING','ACCEPTED','IN_PROGRESS','DELIVERED']) {
    const account = await user({role: side === 'driverId' ? 'DRIVER' : 'CUSTOMER'});
    const o = await order(other.id, {[side]: account.id, status});
    const result = await request('/api/auth/me', token(account), {confirm: true});
    assert.equal(result.status, 409, `${side}/${status}`);
    assert.equal(result.body.code, 'ACTIVE_ORDERS');
    assert.deepEqual(result.body.orders, [{id: o.id, status}]);
    assert.equal((await account.reload()).deletedAt, null);
    assert.equal(await Job.count({where: {userId: account.id}}), 0);
    await o.update({status: 'CANCELLED'});
  }
});

test('deletes private records/files, anonymizes history, retains money, revokes HTTP/admin/OTP', async () => {
  const photo = await file('private.jpg'), historyPhoto = await file('history.jpg');
  const otherPhoto = await file('unrelated.jpg');
  const account = await user({phone: '+380991234567', balance: 500, pushToken: 'private-push', pushConsent: true,
    firstName: 'Private', lastName: 'Name', selfiePhoto: photo, isAdmin: true, isDispatcher: true});
  const other = await user({selfiePhoto: otherPhoto});
  const admin = await PortalAdmin.create({name: 'Private', email: account.email, phone: '0991234567', password: 'private'});
  const adminToken = jwt.sign({type: 'portal-admin', portalAdminId: admin.id}, process.env.JWT_SECRET);
  const done = await order(account.id, {driverId: other.id, status: 'COMPLETED', photos: [photo],
    history: [{status:'COMPLETED',at:new Date().toISOString(),changedById:account.id,photos:[historyPhoto],comment:'Private Name'},
      {status:'PRICE_UPDATED',fromPrice:800,toPrice:900,changedById:account.id}]});
  const driverDone = await order(other.id, {driverId: account.id, status: 'COMPLETED'});
  const reserved = await order(other.id, {reservedBy: account.id, candidateDriverId: account.id,
    reservedUntil: new Date(), candidateUntil: new Date(), status: 'PENDING'});
  const unaffected = await order(other.id, {photos:[otherPhoto], history: [{status:'CREATED',label:'Keep me'}]});
  const money = await Transaction.create({orderId: driverDone.id, driverId: account.id, amount: 900, serviceFee: 18});
  await DriverProfile.create({userId: account.id, inn:'private-tax', passportNumber:'private-passport',passportPhotoMain:photo});
  await SupportQuestion.create({userId: account.id,question:'private-question',photos:[photo]});
  await Favorite.create({customerId: other.id,driverId: account.id});
  await Favorite.create({customerId: account.id,driverId: other.id});
  await SavedSearch.create({driverId: account.id,pickupCity:'private',lat:49,lon:30,radius:20});
  await Notification.create({userId: account.id,title:'private'});
  await Notification.create({userId: other.id,title:'Private Name',data:{orderId:String(done.id)}});
  await OrderResponse.create({orderId: reserved.id,driverId: account.id});
  await SearchEvent.create({orderId: reserved.id,driverId: account.id,dayKey:'2026-11-11'});
  const rating = await Rating.create({orderId:done.id,fromUserId:account.id,toUserId:other.id,rating:4,comment:'Private Name'});
  codes.set(account.phone, '123456');
  const auth = token(account);
  const result = await request('/api/auth/me', auth, {confirm:true});
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(result.body.status,'deleted');
  assert.equal(result.body.externalCopies,'operator_review_required');
  const tombstone = await account.reload();
  assert.ok(tombstone.deletedAt); assert.equal(tombstone.name,'Акаунт видалено');
  for(const field of ['phone','city','firstName','lastName','patronymic','selfiePhoto','pushToken','groupId']) assert.equal(tombstone[field],null,field);
  assert.notEqual(tombstone.email,admin.email); assert.notEqual(tombstone.password,'private-password');
  assert.equal(tombstone.isAdmin,false);assert.equal(tombstone.isDispatcher,false); assert.equal(tombstone.balance,500);
  assert.equal((await money.reload()).amount,900); assert.equal(money.serviceFee,18);
  assert.equal((await rating.reload()).rating,4);assert.equal(rating.comment,null);
  for(const [model,where] of [[DriverProfile,{userId:account.id}],[SupportQuestion,{userId:account.id}],
    [SavedSearch,{driverId:account.id}],[OrderResponse,{driverId:account.id}],[SearchEvent,{driverId:account.id}],
    [Favorite,{driverId:account.id}],[Favorite,{customerId:account.id}],[PortalAdmin,{id:admin.id}]]) assert.equal(await model.count({where}),0,model.name);
  assert.equal(await Notification.count({where:{userId:account.id}}),0);
  assert.equal(await Notification.count({where:{userId:other.id}}),0);
  assert.equal((await done.reload()).pickupLocation,'Акаунт видалено');assert.equal(done.pickupLat,null);assert.deepEqual(done.photos,[]);
  assert.ok(!JSON.stringify(done.history).includes('Private'));assert.ok(!JSON.stringify(done.history).includes('/uploads/'));
  assert.equal(done.history[1].toPrice,900);
  await reserved.reload();assert.equal(reserved.status,'CREATED');assert.equal(reserved.reservedBy,null);assert.equal(reserved.candidateDriverId,null);assert.equal(reserved.history.at(-1).status,'CREATED');
  assert.deepEqual((await unaffected.reload()).photos,[otherPhoto]);assert.equal(unaffected.history[0].label,'Keep me');
  assert.equal((await other.reload()).selfiePhoto,otherPhoto);
  assert.equal(codes.get('+380991234567'),null);
  assert.equal((await request('/api/auth/me',auth,null,'GET')).status,401);
  assert.equal((await request('/api/admin-check',adminToken,null,'GET')).status,401);
  assert.equal((await fetch(base+photo)).status,404);assert.equal((await fetch(base+historyPhoto)).status,404);
  assert.equal((await fetch(base+otherPhoto)).status,200);
  assert.equal((await request('/api/auth/me',auth,{confirm:true})).status,200);
  // Stale in-flight writes cannot restore profile data or assign a deleted driver.
  await assert.rejects(User.update({phone:'380991234567'},{where:{id:account.id}}));
  await assert.rejects(DriverProfile.create({userId:account.id,inn:'restored'}));
  await assert.rejects(unaffected.update({driverId:account.id,status:'ACCEPTED'}));
});

test('transaction failure preserves credentials, dependencies and files for a safe retry', async () => {
  const photo = await file('rollback.jpg'), account = await user({selfiePhoto:photo});
  await DriverProfile.create({userId:account.id,passportPhotoMain:photo});
  const original = Favorite.destroy; Favorite.destroy = async () => {throw Error('injected database failure')};
  let response; try {response=await request('/api/auth/me',token(account),{confirm:true})} finally {Favorite.destroy=original}
  assert.equal(response.status,503);assert.equal((await account.reload()).deletedAt,null);
  assert.equal(await DriverProfile.count({where:{userId:account.id}}),1);
  assert.equal((await fetch(base+photo)).status,200);assert.equal(await Job.count({where:{userId:account.id}}),0);
  assert.equal((await deletion.deleteOwnAccount(account.id)).status,'deleted');
});

test('file failure reports pending, revokes access, then worker/repeated request completes', async () => {
  const photo=await file('pending.jpg'),account=await user({selfiePhoto:photo});const auth=token(account);
  const original=uploads.deleteUploadByUrl; uploads.deleteUploadByUrl=async()=>{throw Error('injected disk failure')};
  let result;try{result=await request('/api/auth/me',auth,{confirm:true})}finally{uploads.deleteUploadByUrl=original}
  assert.equal(result.status,202);assert.equal(result.body.status,'cleanup_pending');
  assert.equal((await request('/api/auth/me',auth,null,'GET')).status,401);
  assert.equal((await Job.findByPk(account.id)).completedAt,null);
  await deletion.retryPendingDeletions();
  assert.equal((await fetch(base+photo)).status,404);assert.deepEqual((await Job.findByPk(account.id)).pendingFiles,[]);
  assert.equal((await request('/api/auth/me',auth,{confirm:true})).body.status,'deleted');
});

test('simultaneous retries finish once and preserve financial balance', async () => {
  const account=await user({balance:-125});const auth=token(account);
  const responses=await Promise.all([request('/api/auth/me',auth,{confirm:true}),request('/api/auth/me',auth,{confirm:true})]);
  assert.deepEqual(responses.map(r=>r.status),[200,200]);
  assert.equal(await Job.count({where:{userId:account.id}}),1);assert.equal((await account.reload()).balance,-125);
});

test('a concurrent authenticated assignment cannot create an active order after deletion', async () => {
  const account=await user(),other=await user(),o=await order(other.id);
  let unlock;const gate=new Promise(resolve=>{unlock=resolve});let locked;
  const acquired=new Promise(resolve=>{locked=resolve});
  const removing=db.transaction(async transaction=>{
    await User.findByPk(account.id,{transaction,lock:transaction.LOCK.UPDATE});locked();await gate;
    await User.update({deletedAt:new Date(),blocked:true},{where:{id:account.id},transaction});
  });
  await acquired;
  const assignment=Order.update({driverId:account.id,status:'ACCEPTED'},{where:{id:o.id}});
  // Register the rejection handler before releasing the lock.
  const rejected=assert.rejects(assignment);unlock();await removing;await rejected;
  assert.equal((await o.reload()).driverId,null);
});

test('deletion closes an already authenticated WebSocket and rejects reconnect', async () => {
  const other=await user(),account=await user();await order(other.id);
  const ws=new WebSocket(base.replace('http','ws')+'/api/orders/stream',{headers:{Authorization:`Bearer ${token(account)}`}});
  await once(ws,'message',{signal:AbortSignal.timeout(5000)});
  const closed=once(ws,'close',{signal:AbortSignal.timeout(5000)});
  assert.equal((await request('/api/auth/me',token(account),{confirm:true})).status,200);
  assert.equal((await closed)[0],4001);
  const reconnect=new WebSocket(base.replace('http','ws')+'/api/orders/stream',{headers:{Authorization:`Bearer ${token(account)}`}});
  await once(reconnect,'close',{signal:AbortSignal.timeout(5000)});
});

test('in-flight registered uploads keep deletion pending until the writer finishes', async () => {
  const account=await user(),auth=token(account);
  const url=`/uploads/${namespace}/in-flight.jpg`;
  const writer=await beginUploadWriter(account.id,url);
  const upload=writer.manifest;
  await assert.rejects(upload.update({writerLockKey:'0'}),error=>error.original?.code==='23514');
  await upload.reload();
  const result=await request('/api/auth/me',auth,{confirm:true});
  assert.equal(result.status,202);
  await deletion.retryPendingDeletions();
  assert.equal((await Job.findByPk(account.id)).completedAt,null);
  // Simulate the file opening only after the first deletion attempt.
  await fs.writeFile(path.join(testDirectory,'in-flight.jpg'),'late upload');
  await writer.finish();
  await deletion.retryPendingDeletions();
  assert.equal((await fetch(base+url)).status,404);
  assert.equal(await UserUpload.count({where:{userId:account.id}}),0);
  assert.equal((await request('/api/auth/me',auth,{confirm:true})).status,200);
  await assert.rejects(UserUpload.create({userId:account.id,url:`/uploads/${namespace}/forbidden.jpg`}));
});

test('late notifications cannot restore a deleted participant snapshot in another inbox', async () => {
  const account=await user(),other=await user(),o=await order(account.id,{status:'COMPLETED',driverId:other.id});
  await deletion.deleteOwnAccount(account.id);
  await assert.rejects(Notification.create({userId:other.id,title:'Private Name',data:{orderId:o.id}}));
});

test('new uploads are registered and removed even when no profile/order references them', async () => {
  const account=await user();
  const form=new FormData();form.append('photo',new Blob(['isolated-upload'],{type:'image/jpeg'}),'sample.jpg');
  const result=await fetch(base+'/test-upload',{method:'POST',headers:{Authorization:`Bearer ${token(account)}`},body:form});
  assert.equal(result.status,200);const {url}=await result.json();
  // This one fixture is written by the real multer storage, outside the fixture subdirectory.
  try {
    const record=await UserUpload.findOne({where:{userId:account.id,url}});
    assert.ok(record);assert.equal(record.uploading,false);
    assert.equal((await deletion.deleteOwnAccount(account.id)).status,'deleted');
    await assert.rejects(fs.access(path.resolve(__dirname,'..',url.slice(1))),{code:'ENOENT'});
  } finally { await uploads.deleteUploadByUrl(url); }
});

test('without the migration guard, deletion fails closed without altering the account', async () => {
  const account=await user();
  await db.query('DROP TRIGGER guard_deleted_user ON users');
  try {
    assert.equal((await request('/api/auth/me',token(account),{confirm:true})).status,503);
    assert.equal((await account.reload()).deletedAt,null);
  } finally { await migration.up(db.getQueryInterface(),Sequelize); }
});

test('a new registration with the same phone never restores deleted account data', async () => {
  const phone='380992345678',account=await user({phone,balance:250});
  await deletion.deleteOwnAccount(account.id);
  codes.set(phone,'654321');
  const result=await request('/api/auth/verify-code',null,{phone,code:'654321'},'POST');
  assert.equal(result.status,200);assert.notEqual(result.body.id,account.id);
  const fresh=await User.findByPk(result.body.id);assert.equal(fresh.balance,0);assert.equal(fresh.selfiePhoto,null);
  assert.equal((await account.reload()).balance,250);
});

test('both parties may delete sequentially without losing historical amounts or restoring private data', async () => {
  const customer=await user(),driver=await user();
  const o=await order(customer.id,{driverId:driver.id,status:'COMPLETED',finalPrice:725});
  await Rating.create({orderId:o.id,fromUserId:customer.id,toUserId:driver.id,rating:5,comment:'Private Name'});
  assert.equal((await deletion.deleteOwnAccount(customer.id)).status,'deleted');
  assert.equal((await deletion.deleteOwnAccount(driver.id)).status,'deleted');
  assert.equal((await o.reload()).finalPrice,725);assert.equal(o.pickupLocation,'Акаунт видалено');
  assert.equal((await customer.reload()).name,'Акаунт видалено');assert.equal((await driver.reload()).name,'Акаунт видалено');
});

test('mobile deletion flow reaches real server confirmation and clears isolated device data for every role', async () => {
  const loadMobile = require('./load-mobile-module.cjs');
  const {createAccountDeletionFlow} = loadMobile('src/accountDeletionFlow.js');
  const client = loadMobile('src/accountDeletionApi.js', {'./api': {API_URL: `${base}/api`}}, {fetch});
  for (const role of ['DRIVER', 'CUSTOMER', 'BOTH', 'ADMIN']) {
    const account = await user({role, balance: 125});
    const auth = token(account);
    const device = new Map([['token', auth], ['role', role], ['reservedPhones', 'isolated-private-phone']]);
    const storage = {getItem: async key => device.get(key) || null, setItem: async (key,value) => device.set(key,value), removeItem: async key => device.delete(key)};
    const notices = [];
    const flow = createAccountDeletionFlow({storage, request: client.requestAccountDeletion,
      cleanup: async () => {device.delete('token');device.delete('role');device.delete('reservedPhones')},
      onSession() {}, onComplete: notice => notices.push(notice)});
    await flow.begin(auth);
    assert.equal(flow.getState(), null, role);assert.equal(notices.length, 1, role);
    assert.equal(device.size, 0, role);assert.ok((await account.reload()).deletedAt, role);
    assert.equal(account.balance, 125);assert.equal((await request('/api/auth/me', auth, null, 'GET')).status, 401);
  }
});

test('mobile flow recovers a lost real server response without reporting premature success', async () => {
  const loadMobile = require('./load-mobile-module.cjs');
  const {createAccountDeletionFlow} = loadMobile('src/accountDeletionFlow.js');
  let loseResponse = true;
  const client = loadMobile('src/accountDeletionApi.js', {'./api': {API_URL: `${base}/api`}}, {
    fetch: async (...args) => {const response = await fetch(...args);if (loseResponse) {loseResponse=false;throw Error('lost response')}return response},
  });
  const account = await user();const device = new Map();let completed = 0, cleanups = 0;
  const storage = {getItem:async key=>device.get(key)||null,setItem:async(key,value)=>device.set(key,value),removeItem:async key=>device.delete(key)};
  const options = {storage,request:client.requestAccountDeletion,cleanup:async()=>{cleanups++},onSession(){},onComplete(){completed++}};
  const flow = createAccountDeletionFlow(options);await flow.begin(token(account));
  assert.ok((await account.reload()).deletedAt);assert.equal(completed,0);assert.equal(cleanups,0);
  assert.equal(flow.getState().phase,'retry');
  const restarted = createAccountDeletionFlow(options);await restarted.restore();await restarted.retry();
  assert.equal(completed,1);assert.equal(cleanups,1);assert.equal(device.size,0);
});

test('a stale history snapshot cannot restore a deleted actor or photo reference', async () => {
  const customer=await user(),driver=await user();
  const o=await order(customer.id,{status:'PENDING',candidateDriverId:driver.id,reservedBy:driver.id,
    history:[{status:'PENDING',at:new Date().toISOString(),changedById:driver.id,uploadedBy:driver.id,photos:['/uploads/isolated-missing-review.jpg']}]});
  const stale=await Order.findByPk(o.id);
  await deletion.deleteOwnAccount(driver.id);
  stale.history=[...stale.history,{status:'PRICE_UPDATED',at:new Date().toISOString(),toPrice:200,changedById:customer.id}];
  await assert.rejects(stale.save({fields:['history']}),error=>error.original?.code==='23514');
  const current=await Order.findByPk(o.id);
  assert.equal(current.candidateDriverId,null);
  assert.ok(!current.history.some(entry=>entry.changedById===driver.id||entry.uploadedBy===driver.id||entry.photos?.length));
  // A fresh, valid edit from the remaining customer still works.
  current.history=[...current.history,{status:'PRICE_UPDATED',at:new Date().toISOString(),toPrice:200,changedById:customer.id}];
  await current.save();
  assert.equal((await current.reload()).history.at(-1).toPrice,200);
  // The guard also covers bulk SQL updates and legacy string-shaped actor IDs.
  await assert.rejects(Order.update({history:[{status:'PENDING',uploadedBy:String(driver.id)}]},{where:{id:o.id}}),error=>error.original?.code==='23514');
});

test('an abandoned legacy manifest is recovered automatically without a live writer', async () => {
  const account=await user(),url=await file('abandoned-legacy.jpg');
  await UserUpload.create({userId:account.id,url,uploading:true});
  assert.equal((await deletion.deleteOwnAccount(account.id)).status,'deleted');
  assert.equal(await UserUpload.count({where:{userId:account.id}}),0);
  assert.equal((await fetch(base+url)).status,404);
});

test('a killed upload process releases its lock and worker finishes deleting its partial file', async () => {
  const {fork}=require('node:child_process');
  const account=await user(),url=`/uploads/${namespace}/crashed-process.jpg`;
  const child=fork(path.join(__dirname,'fixtures/upload-writer-child.cjs'),[],{
    env:{...process.env,ACCOUNT_DELETION_TEST_DATABASE_URL:databaseUrl},stdio:['ignore','ignore','pipe','ipc'],
  });
  let stderr='';child.stderr.on('data',data=>{stderr+=data});
  try {
    const ready=once(child,'message',{signal:AbortSignal.timeout(5000)});
    child.send({userId:account.id,url});
    const [message]=await ready;assert.equal(message.ready,true,stderr);
    const blocked=await deletion.deleteOwnAccount(account.id);assert.equal(blocked.status,'cleanup_pending');
    // A stale timestamp is not evidence that a still-locked writer is dead.
    await UserUpload.update({updatedAt:new Date('2020-01-01')},{where:{userId:account.id},silent:true});
    await deletion.retryPendingDeletions();assert.equal((await Job.findByPk(account.id)).completedAt,null);
    const exited=once(child,'exit');child.kill('SIGKILL');await exited;
    for(let i=0;i<20;i++){
      await deletion.retryPendingDeletions();
      if((await Job.findByPk(account.id)).completedAt)break;
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.ok((await Job.findByPk(account.id)).completedAt);
    assert.equal((await fetch(base+url)).status,404);
    assert.equal((await deletion.deleteOwnAccount(account.id)).status,'deleted');
  } finally { if(child.exitCode===null&&!child.signalCode)child.kill('SIGKILL'); }
});

test('an aborted multipart upload releases its writer lock and its partial file can be deleted', async () => {
  const account=await user();
  const boundary=`test-${randomUUID()}`;
  const target=new URL(base+'/test-upload');
  const uploadRequest=http.request(target,{method:'POST',headers:{
    Authorization:`Bearer ${token(account)}`,'Content-Type':`multipart/form-data; boundary=${boundary}`,
  }});
  uploadRequest.on('error',()=>{});
  uploadRequest.write(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="partial.jpg"\r\nContent-Type: image/jpeg\r\n\r\npartial-file`);
  let manifest;
  try {
    for(let i=0;i<100;i++){
      manifest=await UserUpload.findOne({where:{userId:account.id}});
      if(manifest)break;
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.ok(manifest,'upload registered before abort');
    uploadRequest.destroy();
    for(let i=0;i<100;i++){
      await manifest.reload();
      if(!manifest.uploading)break;
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(manifest.uploading,false);
    assert.equal((await deletion.deleteOwnAccount(account.id)).status,'deleted');
    await assert.rejects(fs.access(path.resolve(__dirname,'..',manifest.url.slice(1))),{code:'ENOENT'});
  } finally {
    uploadRequest.destroy();
    if(manifest)await uploads.deleteUploadByUrl(manifest.url);
  }
});


test('review account gets a complete demo profile and no privileged access, including old tokens', async () => {
  const demo = await user({phone: '+380000000001', role: 'ADMIN', isAdmin: true, isDispatcher: true});
  const portal = await PortalAdmin.create({name: 'Test portal', email: demo.email, password: await require('bcryptjs').hash('demo-password', 4), active: true});
  const old = token(demo);
  const oldPortal = jwt.sign({portalAdminId: portal.id, type:'portal-admin'}, process.env.JWT_SECRET);
  // Guards work even before startup/login has repaired stored privileges.
  for(const route of ['/api/admin-check','/api/authorize-check','/api/dispatcher-check']) {
    assert.equal((await request(route, old, null, 'GET')).status,403,route);
  }
  assert.equal((await request('/api/orders/my?role=ADMIN',old,null,'GET')).status,403);
  assert.equal((await request('/api/admin/auth/login',null,{email:demo.email,password:'demo-password'},'POST')).status,400);
  assert.equal((await request('/api/admin-check',oldPortal,null,'GET')).status,401);
  assert.equal((await request('/api/admin/auth/me',oldPortal,null,'GET')).status,401);
  assert.equal((await request('/api/admin/auth/verify-code',null,{phone:'380000000001',code:'111111'},'POST')).status,400);
  const login = await request('/api/auth/verify-code',null,{phone:'0000000001',code:'111111'},'POST');
  assert.equal(login.status,200); assert.equal(login.body.isAdmin,false);
  assert.equal(login.body.isTestAccount,true); assert.equal(login.body.demoDriverProfileReady,true);
  assert.equal(login.body.role,'BOTH');
  await demo.reload(); await portal.reload();
  assert.equal(demo.isDispatcher,false); assert.equal(portal.active,false);
  let profile = await DriverProfile.findOne({where:{userId:demo.id}});
  assert.equal(profile.status,'DRAFT'); assert.equal(profile.passportNumber,'DEMO-PASSPORT');
  for(const field of ['innDocPhoto','passportPhotoMain','passportPhotoRegistration','driverLicensePhoto',
    'vehicleTechPhoto','carPhotoFrontRight','carPhotoRearLeft','carPhotoInterior','selfiePhoto']) {
    const asset = await fetch(base+profile[field]); assert.equal(asset.status,200,field);
    assert.equal(Buffer.from(await asset.arrayBuffer()).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  }
  const role = await request('/api/auth/role',old,{role:'DRIVER'},'PUT');
  assert.equal(role.status,200); assert.equal(role.body.demoDriverProfileReady,true);
  assert.equal((await request('/api/driver-profile/me',old,null,'GET')).body.passportNumber,'DEMO-PASSPORT');
  const edited = await request('/api/driver-profile/me',old,{carModel:'Edited demo van'},'PUT');
  assert.equal(edited.status,200); assert.equal(edited.body.carModel,'Edited demo van');
  const repeat = await request('/api/auth/verify-code',null,{phone:'380000000001',code:'111111'},'POST');
  assert.equal(repeat.body.role,'DRIVER');
  await profile.reload(); assert.equal(profile.carModel,'Edited demo van');
  const me = await request('/api/auth/me',old,null,'GET');
  assert.equal(me.body.isTestAccount,true); assert.equal(me.body.hasPortalAdminAccess,false);
  const bootstrap = require('../src/services/portalAdmins');
  const keys = ['PORTAL_ADMIN_EMAIL','PORTAL_ADMIN_PHONE','PORTAL_ADMIN_PASSWORD'];
  const previous = keys.map(key=>process.env[key]);
  try {
    process.env.PORTAL_ADMIN_EMAIL=demo.email; process.env.PORTAL_ADMIN_PHONE='380000000001';
    process.env.PORTAL_ADMIN_PASSWORD='unused';
    assert.equal(await bootstrap.ensurePortalAdminFromEnv(),null);
    await bootstrap.syncPortalAdminsFromLegacyUsers();
    await portal.reload(); assert.equal(portal.active,false);
  } finally { keys.forEach((key,i)=>{ if(previous[i]===undefined)delete process.env[key];else process.env[key]=previous[i]; }); }
  assert.equal((await request('/api/auth/switch-to-admin',old,{},'POST')).status,404);
  const change = await request('/api/auth/profile',old,{name:'Demo',phone:'380991112233'},'PUT');
  assert.equal(change.status,400);
  const emailChange = await request('/api/auth/profile',old,{name:'Demo',phone:demo.phone,email:'someone@test.invalid'},'PUT');
  assert.equal(emailChange.status,400);
  // Deletion removes the profile, shared neutral assets remain available, new login creates a fresh demo identity.
  assert.equal((await request('/api/auth/me',old,{confirm:true})).status,200);
  const fresh = await request('/api/auth/verify-code',null,{phone:'380000000001',code:'111111'},'POST');
  assert.equal(fresh.status,200); assert.notEqual(fresh.body.id,demo.id);
  assert.equal(fresh.body.demoDriverProfileReady,true);
  assert.equal((await request('/api/auth/me',fresh.body.token,{confirm:true})).status,200);
});

test('ordinary users cannot claim reserved identity or metadata and normal admin access remains available', async () => {
  const ordinary = await user({phone:'380991234567'});
  assert.equal((await request('/api/auth/register',null,{name:'Claim',email:'claim@test.invalid',password:'unused',phone:'380000000001'},'POST')).status,400);
  for(const route of ['/api/auth/profile','/api/auth/customer-profile']) {
    const response = await request(route, token(ordinary),{name:'Claim',firstName:'Claim',phone:'0000000001',isTestAccount:true},route.endsWith('customer-profile')?'POST':'PUT');
    assert.equal(response.status,400,route);
  }
  const role = await request('/api/auth/role',token(ordinary),{role:'DRIVER',isTestAccount:true,demoDriverProfileReady:true},'PUT');
  assert.equal(role.body.isTestAccount,false); assert.equal(role.body.demoDriverProfileReady,false);
  assert.equal(await DriverProfile.findOne({where:{userId:ordinary.id}}),null);
  const admin = await user({phone:'380991234568',isAdmin:true,isDispatcher:true});
  for(const route of ['/api/admin-check','/api/authorize-check','/api/dispatcher-check']) {
    assert.equal((await request(route,token(admin),null,'GET')).status,200,route);
  }
  const portal = await PortalAdmin.create({name:'Normal admin',email:admin.email,password:'unused',active:true});
  const portalToken = jwt.sign({portalAdminId:portal.id,type:'portal-admin'},process.env.JWT_SECRET);
  assert.equal((await request('/api/admin-check',portalToken,null,'GET')).status,200);
  const { ensureDefaultUserAccess } = require('../src/services/defaultUserAccess');
  await ensureDefaultUserAccess(); await admin.reload();
  assert.equal(admin.isAdmin,true); assert.equal(admin.isDispatcher,true);
});
