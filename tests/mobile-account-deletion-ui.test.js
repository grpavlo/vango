const {test} = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-mobile-module.cjs');
const React = require('../mobile-app/node_modules/react');
const hooks = {...React, useState:initial=>[initial,()=>{}],useLayoutEffect:fn=>fn(),useEffect:()=>{},useCallback:fn=>fn};
const colors = load('src/components/Colors.js');
const native = {View:'View',ScrollView:'ScrollView',ActivityIndicator:'Spinner',Image:'Image',StyleSheet:{create:styles=>styles}};
function elements(node,result=[]) {
  if(Array.isArray(node)) node.forEach(child=>elements(child,result));
  else if(node&&typeof node==='object'&&node.props){result.push(node);elements(node.props.children,result)}
  return result;
}
function renderDeletion(auth,navigation={setOptions(){},canGoBack:()=>true,goBack(){},replace(){},navigate(){}}){
  const module=load('src/screens/DeleteAccountScreen.js',{
    react:hooks,'react-native':native,'@expo/vector-icons':{Ionicons:'Icon'},
    '../components/Screen':'Screen','../components/AppText':'Text','../components/AppButton':'Button',
    '../components/Colors':colors,'../AuthContext':{useAuth:()=>auth},
    '../accountDeletionFlow':load('src/accountDeletionFlow.js'),
  });
  return elements(module.default({navigation}));
}
const buttons=nodes=>nodes.filter(node=>node.type==='Button');

test('all mobile roles see explicit deletion confirmation and cancellation',async()=>{
  for(const role of ['DRIVER','CUSTOMER','BOTH','ADMIN',null]){
    let confirmations=0,cancellations=0;
    const nodes=renderDeletion({role,accountDeletion:null,beginAccountDeletion:async()=>{confirmations++},dismissBlockedDeletion(){}},
      {setOptions(){},canGoBack:()=>true,goBack(){cancellations++}});
    const controls=buttons(nodes);
    await controls.find(node=>node.props.title==='Видалити назавжди').props.onPress();
    assert.equal(confirmations,1,role);assert.equal(cancellations,0);
    controls.find(node=>node.props.title==='Скасувати').props.onPress();assert.equal(cancellations,1);
  }
});

test('pending screen offers status retry without showing a successful deletion or destructive double action',async()=>{
  let retries=0;const nodes=renderDeletion({accountDeletion:{phase:'pending',message:'Очікування'},retryAccountDeletion:async()=>{retries++}});
  assert.deepEqual(buttons(nodes).map(node=>node.props.title),['Перевірити завершення','До входу']);
  await buttons(nodes)[0].props.onPress();assert.equal(retries,1);
  assert.equal(nodes.some(node=>node.props.children==='Акаунт видалено'),false);
});

test('restored and failed deletion screens always offer an exit to login',async()=>{
  for(const phase of ['retry','pending','auth_required','local_cleanup']){
    let exits=0;
    const nodes=renderDeletion({accountDeletion:{phase,message:'Не підтверджено'},exitUnconfirmedDeletion:async()=>{exits++}});
    await buttons(nodes).find(node=>node.props.title==='До входу').props.onPress();
    assert.equal(exits,1,phase);
  }
});

test('request in progress does not expose another destructive action or back gesture',()=>{
  let options;const nodes=renderDeletion({accountDeletion:{phase:'requesting'}},{setOptions:value=>{options=value}});
  assert.equal(buttons(nodes).length,0);assert.equal(options.gestureEnabled,false);
  assert.ok(nodes.some(node=>node.type==='Spinner'));
});

test('active-order response opens the selected order and cancel works even after navigator recovery',()=>{
  for(const [role,needsProfileSetup,destination] of [['CUSTOMER',false,'Main'],[null,false,'Role'],['DRIVER',true,'RoleProfile']]){
    const calls=[];const nodes=renderDeletion({role,needsProfileSetup,accountDeletion:{phase:'blocked',orders:[{id:17,status:'DELIVERED'}]},dismissBlockedDeletion:()=>calls.push('dismiss')},
      {setOptions(){},canGoBack:()=>false,replace:route=>calls.push(route),navigate:(route,params)=>calls.push([route,params.orderId])});
    buttons(nodes).find(node=>node.props.title.startsWith('Замовлення №17')).props.onPress();
    assert.deepEqual(calls.slice(0,2),['dismiss',['OrderDetail',17]]);
    buttons(nodes).find(node=>node.props.title==='Скасувати').props.onPress();assert.equal(calls.at(-1),destination);
  }
});

test('deletion remains available in Settings while profile data is still loading',()=>{
  for(const role of ['DRIVER','CUSTOMER','BOTH','ADMIN']){
    const navigations=[];
    const module=load('src/screens/SettingsScreen.js',{
      react:hooks,'react-native':native,'@expo/vector-icons':{Ionicons:'Icon'},
      '@react-navigation/native':{useFocusEffect(){}},'../components/AppButton':'Button',
      '../AuthContext':{useAuth:()=>({role,token:'test'})},'../components/RoleSwitch':'RoleSwitch',
      '../components/AppText':'Text','../api':{apiFetch(){},HOST_URL:'http://test.invalid'},
      '../components/ListItem':'ListItem','../components/Colors':colors,
      '../components/ProfileCardSkeleton':'Skeleton','../components/HeaderActions':'Header',
      '../../app.json':{expo:{version:'test'}},
    });
    const nodes=elements(module.default({navigation:{setOptions(){},navigate:route=>navigations.push(route)}}));
    const item=nodes.find(node=>node.type==='ListItem'&&node.props.title==='Видалити акаунт');
    assert.ok(item,role);item.props.onPress();assert.deepEqual(navigations,['DeleteAccount']);
  }
});

test('registration and unfinished profile screens expose deletion without first completing a profile',()=>{
  for(const role of [null,'DRIVER','CUSTOMER']){
    const destinations=[];
    const dependencies={react:hooks,'react-native':native,'../AuthContext':{useAuth:()=>({role})},
      '../components/AppButton':'Button','../components/RoleSwitch':'RoleSwitch',
      './EditCustomerProfileScreen':'CustomerProfile','./EditProfile':'DriverProfile'};
    const filename=role?'src/screens/RoleProfileWrapper.js':'src/screens/RoleScreen.js';
    const module=load(filename,dependencies);
    const nodes=elements(module.default({navigation:{navigate:route=>destinations.push(route)}}));
    buttons(nodes).find(node=>node.props.title==='Видалити акаунт').props.onPress();
    assert.deepEqual(destinations,['DeleteAccount']);
  }
});
