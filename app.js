/* ============================================================================
  Cal — persistent local state
  ============================================================================ */
const S = {
  goals:{k:2200,p:150,c:240,f:70},
  weight:70, heightCm:170, targetWeight:65, weekGoal:5,
  waterGoalLiters:2,
  apiKey:'',
  days:{},                  // 'YYYY-MM-DD' -> {meals:[], workout:null, water:0}
  reminders:[],             // recurring natural-language reminders
  mealReminderTimes:{Breakfast:'08:00',Lunch:'13:00',Dinner:'19:00',Snack:'16:00'},
  mealRemindersEnabled:false,
  weightReminder:{enabled:false,weekday:1,time:'09:00'},
  saved:[],                 // saved meals
  routines:[],              // saved workout routines
  recent:[],                // recent scans
  weights:[],               // {k, w}
  weekOffset:0,
  reportSeen:[],
  reportNotified:[],
  recapNotificationPermissionAsked:false,
  healthConnectEnabled:false,
  timer:{on:false, sec:0, id:null, type:null}
};
const STORAGE_KEY = 'cal-tracker-state-v2';

function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      goals:S.goals, weight:S.weight, heightCm:S.heightCm, targetWeight:S.targetWeight, weekGoal:S.weekGoal,
      waterGoalLiters:S.waterGoalLiters,
      apiKey:S.apiKey, days:S.days, saved:S.saved, routines:S.routines, recent:S.recent, weights:S.weights,
      weekOffset:S.weekOffset, healthConnectEnabled:S.healthConnectEnabled, reminders:S.reminders,
      mealReminderTimes:S.mealReminderTimes, mealRemindersEnabled:S.mealRemindersEnabled, reportSeen:S.reportSeen,
      reportNotified:S.reportNotified, recapNotificationPermissionAsked:S.recapNotificationPermissionAsked,
      weightReminder:S.weightReminder
    }));
    return true;
  }catch(e){
    console.warn('Cal could not save local data:', e);
    return false;
  }
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const saved = JSON.parse(raw);
    if(!saved || typeof saved !== 'object') return false;
    S.goals = {...S.goals, ...(saved.goals || {})};
    S.weight = Number(saved.weight) || S.weight;
    S.heightCm = Number(saved.heightCm) || S.heightCm;
    S.targetWeight = Number(saved.targetWeight) || S.targetWeight;
    S.weekGoal = Number(saved.weekGoal) || S.weekGoal;
    const savedWaterGoal=Number(saved.waterGoalLiters);
    S.waterGoalLiters=Number.isFinite(savedWaterGoal)&&savedWaterGoal>=0.25&&savedWaterGoal<=10
      ? Math.round(savedWaterGoal*4)/4 : 2;
    S.apiKey = typeof saved.apiKey === 'string' ? saved.apiKey : '';
    S.days = saved.days && typeof saved.days === 'object' ? saved.days : {};
    S.saved = Array.isArray(saved.saved) ? saved.saved.map(meal=>({
      ...meal,
      servingAmount:Number(meal.servingAmount)>0?Number(meal.servingAmount):1,
      servingUnit:['serving','g','ml','piece'].includes(meal.servingUnit)?meal.servingUnit:'serving'
    })) : [];
    S.routines = Array.isArray(saved.routines) ? saved.routines : [];
    S.recent = Array.isArray(saved.recent) ? saved.recent : [];
    S.weights = Array.isArray(saved.weights) ? saved.weights : [];
    S.weekOffset = Number(saved.weekOffset) || 0;
    S.reportSeen=Array.isArray(saved.reportSeen)?saved.reportSeen.filter(value=>typeof value==='string').slice(-200):[];
    S.reportNotified=Array.isArray(saved.reportNotified)?saved.reportNotified.filter(value=>typeof value==='string').slice(-200):[];
    S.recapNotificationPermissionAsked=saved.recapNotificationPermissionAsked===true;
    S.healthConnectEnabled = saved.healthConnectEnabled === true;
    S.reminders = Array.isArray(saved.reminders) ? saved.reminders.filter(r=>
      r&&Number.isInteger(r.id)&&typeof r.title==='string'&&typeof r.body==='string'&&
      Number.isInteger(r.hour)&&r.hour>=0&&r.hour<=23&&Number.isInteger(r.minute)&&r.minute>=0&&r.minute<=59&&
      ['daily','weekly'].includes(r.frequency)&&(!r.weekday||(Number.isInteger(r.weekday)&&r.weekday>=1&&r.weekday<=7))) : [];
    S.mealReminderTimes = {...S.mealReminderTimes, ...(saved.mealReminderTimes || {})};
    S.mealRemindersEnabled = saved.mealRemindersEnabled === true;
    if(saved.weightReminder&&typeof saved.weightReminder==='object'&&
       Number.isInteger(saved.weightReminder.weekday)&&saved.weightReminder.weekday>=1&&saved.weightReminder.weekday<=7&&
       /^([01]\d|2[0-3]):[0-5]\d$/.test(saved.weightReminder.time||'')){
      S.weightReminder={enabled:saved.weightReminder.enabled===true,weekday:saved.weightReminder.weekday,time:saved.weightReminder.time};
    }
    return true;
  }catch(e){
    console.warn('Cal could not load local data:', e);
    return false;
  }
}

function createBackup(){
  return {
    app:'mycal-ai',
    schemaVersion:1,
    exportedAt:new Date().toISOString(),
    data:{
      goals:S.goals, weight:S.weight, heightCm:S.heightCm, targetWeight:S.targetWeight, weekGoal:S.weekGoal,
      waterGoalLiters:S.waterGoalLiters,
      days:S.days, saved:S.saved, routines:S.routines, recent:S.recent, weights:S.weights, weekOffset:S.weekOffset,
      reminders:S.reminders, mealReminderTimes:S.mealReminderTimes, mealRemindersEnabled:S.mealRemindersEnabled,
      weightReminder:S.weightReminder, reportSeen:S.reportSeen
    }
  };
}

function validateBackup(backup){
  if(!backup || typeof backup !== 'object' || backup.schemaVersion !== 1) throw new Error('This JSON file is not a supported MyCal AI backup.');
  if(backup.app && backup.app !== 'mycal-ai') throw new Error('This backup belongs to a different app.');
  const data=backup.data && typeof backup.data === 'object' ? backup.data : backup;
  const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const isNumber=value=>typeof value==='number'&&Number.isFinite(value);
  if(!isRecord(data.goals)||!['k','p','c','f'].every(key=>isNumber(data.goals[key])&&data.goals[key]>0)) throw new Error('The backup has invalid nutrition goals.');
  if(!isNumber(data.weight)||data.weight<=0||!isNumber(data.heightCm)||data.heightCm<=0||
     !isNumber(data.targetWeight)||data.targetWeight<=0||!isNumber(data.weekGoal)||data.weekGoal<1||data.weekGoal>7) {
    throw new Error('The backup has invalid body or training goals.');
  }
  if(!isRecord(data.days)||!Array.isArray(data.saved)||!Array.isArray(data.routines)||
     !Array.isArray(data.recent)||!Array.isArray(data.weights)) {
    throw new Error('The backup is missing tracker history.');
  }
  if(data.reminders!==undefined&&(!Array.isArray(data.reminders)||data.reminders.some(reminder=>
    !isRecord(reminder)||!Number.isInteger(reminder.id)||typeof reminder.title!=='string'||typeof reminder.body!=='string'||
    !Number.isInteger(reminder.hour)||reminder.hour<0||reminder.hour>23||!Number.isInteger(reminder.minute)||reminder.minute<0||reminder.minute>59||
    !['daily','weekly'].includes(reminder.frequency)||(reminder.weekday!==null&&reminder.weekday!==undefined&&
      (!Number.isInteger(reminder.weekday)||reminder.weekday<1||reminder.weekday>7))))) {
    throw new Error('The backup contains invalid reminders.');
  }
  if(data.mealReminderTimes!==undefined&&(!isRecord(data.mealReminderTimes)||
    !['Breakfast','Lunch','Dinner','Snack'].every(type=>/^([01]\d|2[0-3]):[0-5]\d$/.test(data.mealReminderTimes[type])))) {
    throw new Error('The backup contains invalid meal reminder times.');
  }
  if(data.mealRemindersEnabled!==undefined&&typeof data.mealRemindersEnabled!=='boolean') {
    throw new Error('The backup contains invalid meal reminder settings.');
  }
  if(data.weightReminder!==undefined&&(!isRecord(data.weightReminder)||typeof data.weightReminder.enabled!=='boolean'||
    !Number.isInteger(data.weightReminder.weekday)||data.weightReminder.weekday<1||data.weightReminder.weekday>7||
    typeof data.weightReminder.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.weightReminder.time))) {
    throw new Error('The backup contains invalid weight reminder settings.');
  }
  if(data.waterGoalLiters!==undefined&&(!isNumber(data.waterGoalLiters)||data.waterGoalLiters<0.25||data.waterGoalLiters>10||
    Math.round(data.waterGoalLiters*4)!==data.waterGoalLiters*4)) {
    throw new Error('The backup contains an invalid water target.');
  }
  if(data.reportSeen!==undefined&&(!Array.isArray(data.reportSeen)||data.reportSeen.length>200||
    data.reportSeen.some(value=>typeof value!=='string'||value.length>40))) {
    throw new Error('The backup contains invalid recap history.');
  }
  for(const day of Object.values(data.days)){
    if(!isRecord(day)||!Array.isArray(day.meals)) throw new Error('The backup contains invalid daily records.');
  }
  return data;
}

function applyBackup(data){
  const previous={...S};
  const current=localStorage.getItem(STORAGE_KEY)||'';
  localStorage.setItem(STORAGE_KEY+'.backup',current);
  S.goals={...data.goals};
  S.weight=data.weight;
  S.heightCm=data.heightCm;
  S.targetWeight=data.targetWeight;
  S.weekGoal=data.weekGoal;
  S.waterGoalLiters=Number.isFinite(data.waterGoalLiters)?data.waterGoalLiters:2;
  S.days=data.days;
  S.saved=data.saved.map(meal=>({
    ...meal,
    servingAmount:Number(meal.servingAmount)>0?Number(meal.servingAmount):1,
    servingUnit:['serving','g','ml','piece'].includes(meal.servingUnit)?meal.servingUnit:'serving'
  }));
  S.routines=data.routines;
  S.recent=data.recent;
  S.weights=data.weights;
  S.weekOffset=Number.isFinite(data.weekOffset)?data.weekOffset:0;
  S.reportSeen=Array.isArray(data.reportSeen)?data.reportSeen.slice(-200):[];
  S.reportNotified=[];
  S.reminders=Array.isArray(data.reminders)?data.reminders:[];
  S.mealReminderTimes={Breakfast:'08:00',Lunch:'13:00',Dinner:'19:00',Snack:'16:00',...(data.mealReminderTimes||{})};
  S.mealRemindersEnabled=data.mealRemindersEnabled===true;
  S.weightReminder={enabled:false,weekday:1,time:'09:00',...(data.weightReminder||{})};
  if(!saveState()){
    Object.assign(S,previous);
    throw new Error('Could not save the imported backup on this device. Free up storage and try again.');
  }
}

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const StepAggregation = window.Capacitor?.registerPlugin?.('StepAggregation');
const BackupFiles = window.Capacitor?.registerPlugin?.('BackupFiles');
const AppUpdater = window.Capacitor?.registerPlugin?.('AppUpdater');
const MealCamera = window.Capacitor?.registerPlugin?.('MealCamera');
const LocalNotifications = window.capacitorLocalNotifications?.LocalNotifications;
const isAndroidApp = () => window.Capacitor?.getPlatform?.()==='android';
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dkey = d => { const x = new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };
const TODAY = () => dkey(new Date());
const localTimeValue = () => { const d=new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
function mealTimeLabel(value){
  const [hour,minute]=String(value||'').split(':').map(Number);
  if(!Number.isInteger(hour)||!Number.isInteger(minute)) return new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  return new Date(2000,0,1,hour,minute).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
}
function D(k){ if(!S.days[k]) S.days[k]={meals:[],workout:null,water:0,steps:0}; return S.days[k]; }
const today = () => D(TODAY());
const num = n => Math.round(n).toLocaleString('en-US');

let toastT;
function toast(msg){
  const t=$('#toast'); t.textContent=msg;
  clearTimeout(toastT);
  t.classList.remove('on');
  void t.offsetWidth;
  t.classList.add('on');
  toastT=setTimeout(()=>{
    t.classList.remove('on');
    setTimeout(()=>{ if(!t.classList.contains('on')) t.textContent=''; },350);
  },3000);
}

const GITHUB_LATEST_RELEASE = 'https://api.github.com/repos/mahesh-2007/Cal/releases/latest';
const UPDATE_SNOOZED_KEY = 'cal-update-snoozed';
let availableUpdate = null;

function parseVersion(version){
  const match=String(version||'').trim().match(/^v?(\d+(?:\.\d+){0,3})(?:[-+].*)?$/i);
  return match ? match[1].split('.').map(Number) : null;
}

function isVersionNewer(candidate,current){
  const next=parseVersion(candidate), installed=parseVersion(current);
  if(!next||!installed) return false;
  for(let i=0;i<Math.max(next.length,installed.length);i++){
    const difference=(next[i]||0)-(installed[i]||0);
    if(difference!==0) return difference>0;
  }
  return false;
}

function formatReleaseNotes(notes){
  return notes.split('\n').map(line=>line
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/^\s*[-*]\s+/, '• ')
    .replace(/^\s*\d+\.\s+/, '• ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')).join('\n');
}

async function checkForAppUpdate(){
  if(!isAndroidApp()||!AppUpdater) return;
  try{
    const current=await AppUpdater.getCurrentVersion();
    const response=await fetch(GITHUB_LATEST_RELEASE,{headers:{Accept:'application/vnd.github+json'}});
    if(!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
    const release=await response.json();
    if(release.draft||release.prerelease||!isVersionNewer(release.tag_name,current.versionName)) return;
    const apk=(release.assets||[]).find(asset=>
      typeof asset.name==='string'&&asset.name.toLowerCase()==='mycalai.apk'&&
      typeof asset.browser_download_url==='string'&&asset.browser_download_url.endsWith('.apk'));
    if(!apk) return;
    if(sessionStorage.getItem(UPDATE_SNOOZED_KEY)===release.tag_name) return;
    availableUpdate={tag:release.tag_name,url:apk.browser_download_url};
    $('#updateVersion').textContent=`${release.name||release.tag_name} · installed ${current.versionName}`;
    $('#updateNotes').textContent=typeof release.body==='string'&&release.body.trim()
      ? formatReleaseNotes(release.body.trim())
      : 'This release does not include update notes.';
    $('#updateBackdrop').style.display='grid';
  }catch(error){
    console.warn('Cal could not check for app updates:',error);
  }
}

$('#updateLater').onclick=()=>{
  if(availableUpdate) sessionStorage.setItem(UPDATE_SNOOZED_KEY,availableUpdate.tag);
  $('#updateBackdrop').style.display='none';
  showNextAutomaticRecap();
};
$('#updateNow').onclick=async()=>{
  if(!availableUpdate||!AppUpdater) return;
  const button=$('#updateNow');
  button.disabled=true;
  button.textContent='Preparing update…';
  try{
    const result=await AppUpdater.installUpdate({url:availableUpdate.url});
    if(result.permissionRequired){
      toast('Allow installs from Cal in Android settings, then tap Update now again.');
      button.disabled=false;
      button.textContent='Update now';
      return;
    }
    button.textContent='Opening installer…';
  }catch(error){
    toast(`Could not start the update: ${error instanceof Error?error.message:String(error)}`);
    button.disabled=false;
    button.textContent='Update now';
  }
};

/* ============================================================================
   FOOD DATABASE — 90 entries, macro-per-unit
   ============================================================================ */
const DB = [
  ['Chapati / Roti',104,3.1,18,2.5,'1 roti (40g)','roti chapati phulka indian bread'],
  ['White Rice',206,4.3,45,.4,'1 cup cooked','rice chawal steamed pulao'],
  ['Brown Rice',216,5,45,1.8,'1 cup cooked','brown rice'],
  ['Dal (toor/moong)',198,12,30,3,'1 bowl (200g)','dal daal lentil sambar curry'],
  ['Rajma',245,13,35,5,'1 bowl','rajma kidney beans curry'],
  ['Chole / Chana',260,12,38,6,'1 bowl','chole chana chickpea curry'],
  ['Paneer Butter Masala',438,18,16,34,'1 bowl (200g)','paneer butter masala shahi makhani'],
  ['Palak Paneer',330,16,12,24,'1 bowl','palak paneer spinach'],
  ['Butter Chicken',490,32,11,34,'1 bowl (250g)','butter chicken murgh makhani'],
  ['Chicken Biryani',520,28,62,18,'1 plate (350g)','biryani biriyani chicken rice'],
  ['Veg Biryani',420,9,66,13,'1 plate','veg biryani vegetable rice'],
  ['Naan',262,8,48,5,'1 piece','naan garlic tandoori bread'],
  ['Paratha',330,6,38,16,'1 piece','paratha parantha aloo'],
  ['Idli',58,2,12,.3,'1 idli','idli idly south indian'],
  ['Plain Dosa',133,3,22,4,'1 dosa','dosa dosai plain'],
  ['Masala Dosa',250,5,38,9,'1 dosa','masala dosa potato'],
  ['Sambar',120,6,16,3,'1 bowl','sambar lentil south indian'],
  ['Rasam',60,2,9,1.5,'1 bowl','rasam soup'],
  ['Poha',270,5,48,7,'1 plate','poha pohe flattened rice'],
  ['Upma',250,6,40,7,'1 plate','upma rava semolina'],
  ['Vada',160,5,15,9,'1 piece','vada medu vadai'],
  ['Grilled Chicken Breast',165,31,0,3.6,'100 g','grilled chicken breast plain lean'],
  ['Chicken Curry',290,26,8,17,'1 bowl','chicken curry gravy'],
  ['Tandoori Chicken',260,30,4,13,'200 g','tandoori chicken tikka'],
  ['Chicken Tikka',230,28,5,11,'150 g','chicken tikka dry'],
  ['Chicken Shawarma',480,32,42,20,'1 roll','shawarma roll wrap'],
  ['Boiled Egg',78,6.3,.6,5.3,'1 egg','egg eggs boiled anda'],
  ['Egg Omelette',200,14,2,15,'2-egg omelette','omelette omlet fried egg'],
  ['Egg Bhurji',230,13,4,18,'2 eggs','bhurji scrambled egg'],
  ['Fish Curry',240,24,7,13,'1 bowl','fish curry machli'],
  ['Grilled Fish',180,28,0,7,'150 g','grilled fish salmon'],
  ['Prawns',180,26,2,7,'150 g','prawns shrimp'],
  ['Soya Chunks',180,26,12,1,'100 g cooked','soya chunks meal maker'],
  ['Tofu',144,16,3,8,'150 g','tofu bean curd'],
  ['Curd / Yogurt',98,5.4,7.4,5.3,'1 bowl (150g)','curd yogurt dahi raita'],
  ['Greek Yogurt',130,20,8,.7,'170 g cup','greek yogurt protein'],
  ['Whey Shake',230,27,8,6,'1 scoop + milk','whey protein shake gym'],
  ['Protein Bar',210,20,22,7,'1 bar','protein bar'],
  ['Garden Salad',60,2.5,9,1.6,'1 bowl','salad green veg veggie'],
  ['Fruit Salad',120,1.5,30,.4,'1 bowl','fruit salad'],
  ['Mixed Veg Sabzi',150,4,18,7,'1 bowl','sabzi mixed veg vegetable'],
  ['Bhindi Fry',180,3,14,13,'1 bowl','bhindi okra ladyfinger'],
  ['Broccoli',55,3.7,11,.6,'1 cup','broccoli veg'],
  ['Boiled Potato',130,2.9,30,.2,'1 medium','potato aloo'],
  ['Sweet Potato',112,2,26,.1,'1 medium','sweet potato shakarkandi'],
  ['Banana',105,1.3,27,.4,'1 medium','banana kela'],
  ['Apple',95,.5,25,.3,'1 medium','apple seb'],
  ['Mango',201,2.8,50,1.3,'1 medium','mango aam'],
  ['Orange',62,1.2,15,.2,'1 medium','orange santra'],
  ['Watermelon',46,.9,12,.2,'1 bowl','watermelon tarbooz'],
  ['Almonds',164,6,6,14,'28 g','almonds badam nuts'],
  ['Peanut Butter',190,8,6,16,'2 tbsp','peanut butter'],
  ['Oats (cooked)',166,6,28,3.5,'1 cup','oats oatmeal porridge'],
  ['Oats + Milk + Honey',320,12,52,7,'1 bowl','oats milk honey breakfast'],
  ['Muesli / Granola',290,8,48,8,'60 g','muesli granola cereal'],
  ['White Bread',70,2.3,13,.9,'1 slice','bread toast slice white'],
  ['Brown Bread',75,3,13,1,'1 slice','brown bread multigrain'],
  ['Pizza Slice',285,12,36,10,'1 slice','pizza cheese margherita'],
  ['Veg Burger',380,12,48,15,'1 burger','burger veg aloo tikki'],
  ['Chicken Burger',520,26,44,25,'1 burger','burger chicken zinger'],
  ['French Fries',365,4,48,17,'medium serving','fries chips'],
  ['Samosa',262,4,30,14,'1 piece','samosa fried snack'],
  ['Pakora',315,7,30,19,'100 g','pakora bhaji fritters'],
  ['Maggi Noodles',400,9,56,15,'1 pack','maggi noodles instant ramen'],
  ['White Sauce Pasta',420,13,56,16,'1 plate','pasta white sauce alfredo'],
  ['Red Sauce Pasta',330,12,58,7,'1 plate','pasta red sauce marinara'],
  ['Veg Sandwich',290,9,40,10,'1 sandwich','sandwich veg grilled'],
  ['Veg Soup',90,3,14,2,'1 bowl','soup vegetable clear'],
  ['Whole Milk',149,8,12,8,'1 cup (244ml)','milk doodh whole'],
  ['Toned Milk',120,8,12,4,'1 cup','toned milk skim'],
  ['Tea with Milk',60,2,8,2,'1 cup','tea chai'],
  ['Black Coffee',5,.3,0,0,'1 cup','coffee black espresso'],
  ['Latte',150,8,12,7,'1 cup','latte cappuccino'],
  ['Green Tea',2,0,0,0,'1 cup','green tea'],
  ['Soft Drink',140,0,39,0,'330 ml can','coke cola soda pepsi'],
  ['Orange Juice',112,1.7,26,.5,'1 cup','orange juice'],
  ['Chocolate Bar',235,3,26,13,'40 g','chocolate candy dairy milk'],
  ['Ice Cream',270,5,31,14,'1 scoop','ice cream gelato'],
  ['Gulab Jamun',150,2,22,6,'1 piece','gulab jamun mithai sweet'],
  ['Rasgulla',125,2,26,2,'1 piece','rasgulla sweet'],
  ['Kheer',250,6,38,8,'1 bowl','kheer payasam rice pudding'],
  ['Cheese Slice',70,4.4,.5,5.6,'1 slice','cheese cheddar slice'],
  ['Paneer (raw)',265,18,3,20,'100 g','paneer cottage cheese raw'],
  ['Hummus',166,5,14,10,'2 tbsp','hummus chickpea dip'],
  ['Avocado',160,2,9,15,'half','avocado'],
  ['Corn',132,5,29,1.8,'1 cup','corn sweetcorn bhutta'],
  ['Dahi Vada',230,8,28,10,'2 pieces','dahi vada'],
  ['Chicken Soup',120,10,8,5,'1 bowl','chicken soup clear']
].map(a=>({n:a[0],k:a[1],p:a[2],c:a[3],f:a[4],u:a[5],tags:a[6]}));

const ALIAS = {roti:'Chapati / Roti',chapati:'Chapati / Roti',roti_:'Chapati / Roti',rice:'White Rice',chawal:'White Rice',
  dal:'Dal (toor/moong)',daal:'Dal (toor/moong)',curd:'Curd / Yogurt',dahi:'Curd / Yogurt',yogurt:'Curd / Yogurt',
  egg:'Boiled Egg',eggs:'Boiled Egg',anda:'Boiled Egg',chai:'Tea with Milk',coffee:'Black Coffee',
  soda:'Soft Drink',cola:'Soft Drink',coke:'Soft Drink',fries:'French Fries',chips:'French Fries',toast:'White Bread'};

function fuzzy(text){
  const q=' '+text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ')+' ';
  const toks=q.trim().split(' ').filter(t=>t.length>2);
  const hits=[];
  DB.forEach(f=>{
    const name=f.n.toLowerCase(), hay=name+' '+f.tags;
    let sc=0;
    toks.forEach(t=>{
      const a=ALIAS[t];
      if(a && f.n===a) sc+=14;
      if(name===t) sc+=12;
      if(name.startsWith(t)) sc+=9;
      else if(name.includes(t)) sc+=7;
      if(hay.includes(t)) sc+=3;
      if(new RegExp('\\b'+t.replace(/[.*+?^${}()|[\]\\]/g,'')+'\\b').test(hay)) sc+=2;
    });
    if(sc>0) hits.push({f,sc});
  });
  hits.sort((a,b)=>b.sc-a.sc);
  const seen=new Set(), out=[];
  for(const h of hits){ if(!seen.has(h.f.n)){ seen.add(h.f.n); out.push(h.f); } if(out.length>=6) break; }
  return out;
}
function qtyFor(text, name){
  const t=text.toLowerCase();
  // grams mentioned near a protein/dry item
  const gm=t.match(/(\d{2,4})\s*(?:g|gram|grams)\b/);
  if(gm && /chicken|paneer|fish|rice|prawn|soya|tofu|oats/i.test(name)) return Math.max(0.5, Math.min(6, parseFloat(gm[1])/100));
  const m=t.match(/(\d+\.?\d*)\s*(?:x|×)?\s*(?=[a-z])/);
  let q=1;
  if(/\bhalf|aadha\b/.test(t)) q=.5;
  if(/\bone\b|\ba\b/.test(t)) q=1;
  if(/\btwo\b|\bcouple\b/.test(t)) q=2;
  if(/\bthree\b/.test(t)) q=3;
  if(/\bfour\b/.test(t)) q=4;
  if(m){ const v=parseFloat(m[1]); if(v>0 && v<=10) q=v; }
  return q;
}
const FOOD_DISPLAY_NAMES = new Map([
  ['dal (toor/moong)','Dal'],
  ['chapati / roti','Roti'],
  ['curd / yogurt','Curd'],
  ['paneer (raw)','Paneer'],
  ['oats (cooked)','Oats'],
  ['white bread','Bread']
]);
function displayFoodName(name){
  const value=String(name||'').trim();
  const match=value.match(/^((?:\d+(?:\.\d+)?\s*[×x]\s*)?)(.*)$/i);
  const label=match?match[2]:value;
  return `${match?match[1]:''}${FOOD_DISPLAY_NAMES.get(label.toLowerCase())||label}`;
}
function displayMealName(name){
  return String(name||'Meal').split(/\s*,\s*/).map(displayFoodName).join(', ');
}
function mealNameKey(name){
  return String(name||'').split(/\s*,\s*/).map(part=>displayFoodName(part).toLowerCase()).filter(Boolean).sort().join(',');
}
/* ============================================================================
   GEMINI — real vision + text analysis (free tier)
   ============================================================================ */
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash'
];
let activeGeminiModel = null;
let geminiKeyVerified = false;

const PROMPT = `You are a nutrition estimator. Analyze the food described or shown.
Return ONLY minified JSON, no markdown, no code fences, matching exactly:
{"isFood":true,"mealName":"string","confidence":"high|medium|low","items":[{"name":"string","quantity":"string","grams":number,"kcal":number,"protein":number,"carbs":number,"fat":number}],"total":{"kcal":number,"protein":number,"carbs":number,"fat":number},"note":"one short practical note about this meal"}
Rules: identify each distinct food separately. Estimate a realistic single serving. If the user provides a description with a photo, use it as additional context for ingredients, preparation and portion size; prioritize explicit quantities in the description when estimating.
Use precise portion units: drinks and liquids in ml (for example 250 ml), rice, curry, oats and meat in grams (for example 180 g), and countable foods such as idli, eggs, roti, dosa, naan and slices in pieces (for example 3 pieces). Put the same unit in quantity and use grams for the numeric grams field when applicable.
If the image clearly contains no food, set isFood false and items to [].
Numbers are integers except protein/carbs/fat which may have one decimal.`;

function parseJSON(txt){
  if(!txt) throw new Error('empty response');
  let s = txt.replace(/```json/gi,'').replace(/```/g,'').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if(a<0||b<0) throw new Error('no JSON found');
  return JSON.parse(s.slice(a,b+1));
}

async function geminiCall(parts, useKey){
  const body = JSON.stringify({
    contents:[{parts}],
    generationConfig:{temperature:0.2, responseMimeType:'application/json'}
  });
  let lastErr;
  for(const model of GEMINI_MODELS){
    try{
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(useKey)}`,
        {method:'POST', headers:{'Content-Type':'application/json'}, body}
      );
      const data = await r.json();
      if(data.error) throw new Error(data.error.message || 'API error');
      const txt = data.candidates?.[0]?.content?.parts?.map(p=>p.text).filter(Boolean).join('') || '';
      const parsed = parseJSON(txt);
      activeGeminiModel = model;
      geminiKeyVerified = true;
      renderApiStatus();
      return parsed;
    }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('all models failed');
}

async function analyzeRemote(imageB64, mime, text){
  if(!S.apiKey) throw new Error('no key');
  const parts = [{text: PROMPT + (text ? '\nUser description: '+text : '')}];
  if(imageB64) parts.push({inlineData:{mimeType: mime || 'image/jpeg', data: imageB64}});
  return await geminiCall(parts, S.apiKey);
}

/* ---------- offline fallback estimator ---------- */
const LOCAL_PLATES = [
  {items:[['Chicken Biryani',1]],note:'Rice-heavy plate detected. Biryani usually carries hidden oil — treat as an upper-bound estimate.'},
  {items:[['Chapati / Roti',2],['Dal (toor/moong)',1],['Curd / Yogurt',1]],note:'Thali-style plate: flatbread, lentil and dairy. A solid, balanced combination.'},
  {items:[['Grilled Chicken Breast',2],['White Rice',1],['Garden Salad',1]],note:'High-protein plate with a clean carb and veg — great post-training meal.'},
  {items:[['Egg Omelette',1],['Brown Bread',2]],note:'Breakfast-style plate. Add fruit or curd if protein is low for the day.'},
  {items:[['Paneer Butter Masala',1],['Naan',1]],note:'Curry plus bread is calorie-dense — rich in fat and carbs.'},
  {items:[['Pizza Slice',2]],note:'Baked flatbread detected. Two slices is roughly a light meal on its own.'},
  {items:[['Masala Dosa',1],['Sambar',1]],note:'South-Indian breakfast. Potato filling drives most of the carbs.'},
  {items:[['Oats + Milk + Honey',1],['Banana',1]],note:'Bowl with fruit — low fat, good slow carbs for the morning.'},
  {items:[['Chicken Burger',1],['French Fries',1]],note:'Fast-food plate. High in fat and refined carbs.'},
  {items:[['Red Sauce Pasta',1],['Garden Salad',1]],note:'Pasta bowl with greens. Watch the portion if you are cutting.'}
];
function localAnalyze(text){
  if(text){
    const hits = fuzzy(text);
    if(hits.length){
      const items = hits.slice(0,5).map(f=>{
        const q = qtyFor(text, f.n);
        const requested = text.match(/(\d{2,4})\s*(?:g|gram|grams)\b/i);
        const isCountable = /roti|naan|egg|dosa|idli|paratha|bread|slice|piece/i.test(f.u);
        const grams = requested && !isCountable ? parseFloat(requested[1]) : q*(isCountable ? 50 : 150);
        return {name:f.n, quantity:q===1?f.u:`${q} × ${f.u}`, grams:Math.round(grams),
                kcal:Math.round(f.k*q), protein:+(f.p*q).toFixed(1), carbs:+(f.c*q).toFixed(1), fat:+(f.f*q).toFixed(1)};
      });
      return totals(items, `Matched ${items.length} item${items.length>1?'s':''} from your description (offline estimator).`);
    }
    return localPlate(0, 'No confident match offline — showing a typical mixed plate. Connect a Gemini key for accurate recognition.');
  }
  return localPlate(Math.floor(Math.random()*LOCAL_PLATES.length));
}
function localPlate(i, noteOverride){
  const p = LOCAL_PLATES[i % LOCAL_PLATES.length];
  const items = p.items.map(([name,q])=>{
    const f = DB.find(x=>x.n===name) || DB[0];
    return {name:f.n, quantity:q===1?f.u:`${q} × ${f.u}`, grams:150,
            kcal:Math.round(f.k*q), protein:+(f.p*q).toFixed(1), carbs:+(f.c*q).toFixed(1), fat:+(f.f*q).toFixed(1)};
  });
  return totals(items, noteOverride || p.note);
}
function totals(items, note){
  const t = items.reduce((a,i)=>({kcal:a.kcal+i.kcal, protein:a.protein+i.protein, carbs:a.carbs+i.carbs, fat:a.fat+i.fat}),{kcal:0,protein:0,carbs:0,fat:0});
  return {mealName: items.map(i=>i.name).join(', '), items, total:t, note, confidence:'medium', isFood:items.length>0};
}
function portionText(item){
  const p = portionMeta(item);
  return `${p.value} ${p.unit}`;
}
function portionMeta(item){
  const name = String(item.name||'').toLowerCase();
  const quantity = String(item.quantity||'').trim();
  const number = quantity.match(/\d+(?:\.\d+)?/);
  const mlNumber = quantity.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  const isLiquid = /drink|juice|tea|coffee|shake|smoothie|lassi|soda|water/.test(name)
    || /(?:^|\s)(?:whole|toned|skim)?\s*milk$/.test(name);
  if(isLiquid){
    const value = Math.round(Number(item.basePortion || item.ml || (mlNumber && mlNumber[1]) || item.grams || 250) / 25) * 25;
    return {unit:'ml', value:Math.max(25,value), step:25, min:25};
  }
  if(/idli|egg|roti|chapati|naan|dosa|paratha|bread|slice|piece|vada|samosa|burger/.test(name)){
    const value = Math.max(1, Math.round(Number(item.basePortion || (number && number[0]) || 1)));
    return {unit:'pieces', value, step:1, min:1};
  }
  const value = Math.max(10, Math.round(Number(item.basePortion || item.grams || 150) / 10) * 10);
  return {unit:'g', value, step:10, min:10};
}
function resultTotals(){
  return result.items.reduce((a,x)=>({
    kcal:a.kcal+x.kcal*(x.qty||1),
    protein:a.protein+x.protein*(x.qty||1),
    carbs:a.carbs+x.carbs*(x.qty||1),
    fat:a.fat+x.fat*(x.qty||1)
  }),{kcal:0,protein:0,carbs:0,fat:0});
}
window.updatePortion = (i, raw) => {
  if(!result) return;
  const item = result.items[i], meta = portionMeta(item);
  const value = Math.max(meta.min, Number(raw) || meta.min);
  item.qty = value / meta.value;
  result.total = resultTotals();
  $('#portion'+i).textContent = `${Math.round(value)} ${meta.unit}`;
  $('#macro'+i).innerHTML = `<span class="p">P ${(item.protein*item.qty).toFixed(1)}g</span><span class="c">C ${(item.carbs*item.qty).toFixed(1)}g</span><span class="f">F ${(item.fat*item.qty).toFixed(1)}g</span>`;
  $('#resKcal').textContent = num(result.total.kcal);
  $('#ik'+i).textContent = num(item.kcal*item.qty);
}

/* ============================================================================
   RENDER — TODAY
   ============================================================================ */
function eaten(k){ const d=D(k); return d.meals.reduce((a,m)=>({kcal:a.kcal+m.kcal,protein:a.protein+m.protein,carbs:a.carbs+m.carbs,fat:a.fat+m.fat}),{kcal:0,protein:0,carbs:0,fat:0}); }
function streak(){
  let s=0;
  for(let i=0;i<400;i++){
    const d=new Date(); d.setDate(d.getDate()-i);
    const dd=S.days[dkey(d)];
    if(dd && (dd.workout || dd.meals.length)) s++;
    else if(i>0) break;
  }
  return s;
}
function setRing(el, val, max, circumference=194.8){
  const p = Math.max(0, Math.min(val/max, 1));
  el.style.strokeDashoffset = (circumference*(1-p)).toFixed(1);
}

function estimateActivityBurn(day){
  const weight=Number(S.weight);
  const bodyWeight=Number.isFinite(weight)&&weight>=30&&weight<=300?weight:70;
  const height=Number(S.heightCm);
  const heightCm=Number.isFinite(height)&&height>=100&&height<=250?height:170;
  const workout=day.workout;
  const minutes=Number(workout?.min);
  const intensity=Number(workout?.intensity);
  const duration=Number.isFinite(minutes)?Math.max(0,Math.min(minutes,600)):0;
  const effort=Number.isFinite(intensity)?Math.max(1,Math.min(intensity,2)):1.35;
  const met=3.5+(effort-1)*1.5;
  const workoutCalories=workout?met*3.5*bodyWeight/200*duration:0;
  const rawSteps=Number(day.steps);
  const steps=Number.isFinite(rawSteps)?Math.max(0,Math.min(rawSteps,200000)):0;
  const strideMeters=heightCm*.00415;
  const stepCalories=steps*strideMeters*bodyWeight*.5/1000;
  const workoutEstimate=Math.round(workoutCalories);
  const stepEstimate=Math.round(stepCalories);
  return {workout:workoutEstimate,steps:stepEstimate,total:workoutEstimate+stepEstimate};
}

function renderHome(){
  const k=TODAY(), d=D(k), t=eaten(k), g=S.goals;
  const remain = Math.max(0,Math.round(g.k-t.kcal));
  const over = Math.max(0,Math.round(t.kcal-g.k));

  $('#todayLabel').textContent = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  $('#heroRemain').textContent = num(remain);
  $('#heroSub').textContent = `${num(t.kcal)} / ${num(g.k)} kcal eaten`;
  $('#calorieOver').textContent = over ? `${num(over)} kcal over limit` : '';
  $('#calTargetLegend').textContent = `${num(g.k)} kcal`;
  setRing($('#rCalories'),t.kcal,g.k,314.16);
  const prog = $('#heroProg');
  prog.querySelector('.cal-eaten').style.width=`${Math.min(100,t.kcal/Math.max(g.k,1)*100)}%`;
  prog.classList.toggle('over',t.kcal>g.k);
  prog.setAttribute('aria-label',`${num(t.kcal)} calories eaten of ${num(g.k)}; ${num(remain)} remaining`);
  $('#calEatenLegend').textContent=`${num(t.kcal)} kcal`;

  $('#vP').textContent = Math.round(t.protein); setRing($('#rP'), t.protein, g.p);
  $('#vC').textContent = Math.round(t.carbs);   setRing($('#rC'), t.carbs, g.c);
  $('#vF').textContent = Math.round(t.fat);     setRing($('#rF'), t.fat, g.f);

  $('#sEat').textContent = num(t.kcal);
  $('#sTarget').textContent = num(g.k);
  $('#sRemain').textContent = num(remain);
  $('#sStreak').textContent = streak()+' d';
  $('#homeSteps').textContent = num(Number(d.steps)||0);
  const activityBurn=estimateActivityBurn(d);
  $('#activityBurnTotal').textContent=num(activityBurn.total);
  $('#workoutBurnEstimate').textContent=`${num(activityBurn.workout)} kcal`;
  $('#stepBurnEstimate').textContent=`${num(activityBurn.steps)} kcal`;
  renderHealthConnectStatus();
  const weightEntries=getWeightEntries();
  const latestWeight=weightEntries[weightEntries.length-1];
  const currentWeight=latestWeight?.w??S.weight;
  $('#homeWeightCurrent').innerHTML=`${currentWeight.toFixed(1)} <span class="meta">kg</span>`;
  $('#homeWeightDate').textContent=latestWeight
    ? new Date(`${latestWeight.k}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'})
    : 'No logs yet';

  // session card
  const box = $('#todaySessionCard');
  if(!d.workout){
    box.innerHTML = `<div class="card-hd"><div class="h5">Today's session</div><span class="badge bg-Rest sp">Rest</span></div>
      <p class="body" style="font-size:14px">Nothing logged yet. A ${suggestNext()} day fits your rotation.</p>
      <button class="btn pri full" style="margin-top:16px" onclick="go('train')">Log a workout</button>`;
  } else {
    const w = d.workout;
    box.innerHTML = `        <div class="card-hd"><div class="h5">Today's session</div><span class="badge bg-${workoutClass(w.type)} sp">${esc(w.type)}</span></div>
    <div class="lic"><span class="k">Duration</span><span class="v">${w.min} min</span></div>
    <div class="lic"><span class="k">Intensity</span><span class="v">${w.intensity}×</span></div>
      ${w.exercises?.length?`<p class="body" style="font-size:13px;margin-top:12px"><b>${w.exercises.length} exercise${w.exercises.length===1?'':'s'}:</b> ${w.exercises.map(x=>`${esc(x.name)} ${x.sets}×${x.reps} @ ${x.weight}kg`).join(' · ')}</p>`:''}
      ${w.notes?`<p class="body" style="font-size:13px;margin-top:12px">${esc(w.notes)}</p>`:''}
      <div class="btn-row" style="margin-top:16px">
        <button class="btn sm full" onclick="editTodayWorkout()">Edit</button>
        <button class="btn sm dan full" onclick="delWo()">Remove</button>
      </div>`;
  }

  // meals
  const ml = $('#mealCategories');
  const expandedType = ml.querySelector('details[open]')?.dataset.type;
  const mealTypes = ['Breakfast','Lunch','Dinner','Snack'];
  const groupedMeals = mealTypes.map(type=>({
    type,
    meals:d.meals.map((meal,index)=>({meal,index})).filter(({meal})=>{
      const normalizedType = String(meal.type||'Snack').toLowerCase();
      return normalizedType===type.toLowerCase() || (type==='Snack' && normalizedType==='quick add');
    })
  }));
  const otherMeals = d.meals.map((meal,index)=>({meal,index})).filter(({meal})=>{
    const type=String(meal.type||'Snack').toLowerCase();
    return !mealTypes.some(mealType=>mealType.toLowerCase()===type) && type!=='quick add';
  });
  if(otherMeals.length) groupedMeals.push({type:'Other',meals:otherMeals});

  ml.innerHTML = groupedMeals.map(({type,meals})=>{
    const totals=meals.reduce((sum,{meal})=>({
      kcal:sum.kcal+Number(meal.kcal||0),
      protein:sum.protein+Number(meal.protein||0),
      carbs:sum.carbs+Number(meal.carbs||0),
      fat:sum.fat+Number(meal.fat||0)
    }),{kcal:0,protein:0,carbs:0,fat:0});
    const rows=meals.length ? meals.map(({meal,index})=>{
      const saved=S.saved.some(item=>mealNameKey(item.name)===mealNameKey(meal.name));
      const displayName=displayMealName(meal.name);
      const macroBadge=(label,value,tone)=>`<span class="meal-macro ${tone}"><span class="label">${label}</span><span class="value">${Math.round(value)}g</span></span>`;
      return `
      <div class="row logged-meal">
        ${meal.img?`<img class="aw" src="${meal.img}" alt="">`:`<div class="aw" aria-hidden="true"></div>`}
        <div class="main">
          <div class="nm meal-name" title="${esc(displayName)}">${esc(displayName)}</div>
          <div class="meal-detail">${macroBadge('P',meal.protein,'p')}${macroBadge('C',meal.carbs,'c')}${macroBadge('F',meal.fat,'f')}</div>
          <div class="meal-meta">${meal.portion?`${esc(meal.portion)} · `:''}${esc(meal.type||'Snack')} · ${esc(meal.at||'')}${meal.src==='photo'?' · photo':meal.src==='text'?' · text':''}</div>
        </div>
        <div class="meal-calories"><div class="value">${num(meal.kcal)}</div><div class="unit">kcal</div></div>
        <div class="meal-actions">
          <button class="btn sm ghost meal-save${saved?' is-saved':''}" onclick="saveMeal(${index})" title="${saved?'Already saved':'Save meal'}" aria-label="${saved?'Already saved':'Save'} ${esc(meal.name)}" ${saved?'disabled':''}>${saved?'Saved':'Save'}</button>
          <button class="btn sm ghost" onclick="delMeal(${index})" title="Delete" aria-label="Delete ${esc(meal.name)}">✕</button>
        </div>
      </div>`;
    }).join('')
      : `<div class="empty"><div class="tx">Nothing logged for ${type.toLowerCase()} yet</div>
        <button class="btn sm" style="margin-top:10px" onclick="startMealScan('${type}')">+ Add ${type.toLowerCase()}</button></div>`;
    return `<details class="meal-group" data-type="${esc(type)}"${expandedType===type?' open':''}>
      <summary>
        <span class="meal-heading"><span class="meal-title">${esc(type)}</span><span class="meal-count">${meals.length} ${meals.length===1?'meal':'meals'}</span>
          <span class="meal-macros" aria-label="${Math.round(totals.protein)} grams protein, ${Math.round(totals.carbs)} grams carbs, ${Math.round(totals.fat)} grams fat">
            <span class="meal-macro p"><span class="label">P</span><span class="value">${Math.round(totals.protein)}g</span></span>
            <span class="meal-macro c"><span class="label">C</span><span class="value">${Math.round(totals.carbs)}g</span></span>
            <span class="meal-macro f"><span class="label">F</span><span class="value">${Math.round(totals.fat)}g</span></span>
          </span>
        </span>
        <span class="meal-kcal">${num(totals.kcal)} kcal</span>
      </summary>
      <div class="rows">${rows}</div>
    </details>`;
  }).join('');

  // water
  const gl = $('#glasses'); gl.innerHTML='';
  const waterServings=Math.ceil(S.waterGoalLiters*4);
  for(let i=0;i<waterServings;i++){
    const e=document.createElement('button');
    e.type='button';
    e.className='gl'+(i<d.water?' on':'');
    e.textContent = '';
    e.setAttribute('aria-label',`${i<d.water?'Logged':'Log'} water serving ${i+1} of ${waterServings}`);
    e.onclick=()=>{ d.water = (i+1===d.water)? i : i+1; saveState(); renderHome(); };
    gl.appendChild(e);
  }
  $('#waterTxt').textContent = `${(d.water*.25).toFixed(2)} / ${S.waterGoalLiters.toFixed(2)} L`;

  renderReminders();

  // quick AI note
  const leftP = Math.max(0, g.p - t.protein);
  let note = remain > 400 ? `You have ${num(remain)} kcal of headroom and ${Math.round(leftP)}g of protein to find. Lean on a protein-first plate.`
    : remain > 0 ? `Nearly there — ${num(remain)} kcal left. Keep the last meal protein and veg heavy.`
    : over > 0 ? `You're ${num(over)} kcal over target. Don't compensate by skipping meals tomorrow; just reduce calorie-dense snacks.`
      : `You've reached your calorie limit for today. Keep your routine steady and return to your usual target tomorrow.`;
  const mealNames = d.meals.map(m=>m.name).filter(Boolean);
  if(mealNames.length){
    const text=mealNames.join(', '), lower=text.toLowerCase();
    const foodFocus = /fruit|apple|banana|orange|mango|salad|veg|broccoli|spinach/.test(lower)
      ? 'You have some produce in the log, which helps cover fibre and a wider range of micronutrients.'
      : /milk|curd|yogurt|paneer|cheese|egg/.test(lower)
        ? 'Your meal choices include dairy or eggs, useful sources of calcium and several recovery nutrients.'
        : 'Add a colourful fruit or vegetable alongside the next meal for fibre and micronutrient variety.';
    note += ` Logged today: ${text}. ${foodFocus}`;
  }
  if(d.workout) note += ` ${d.workout.type} session logged (${d.workout.min} min). Next rotation: ${nextWorkoutType(d.workout.type)}.`;
  $('#quickNote').textContent = note;

  renderApiStatus();
}
window.delMeal = i => { today().meals.splice(i,1); renderAll(); toast('Meal removed'); };
window.delWo = () => { today().workout=null; renderAll(); toast('Workout removed'); };
window.saveMeal = i => {
  const m = {...today().meals[i]};
  m.name=displayMealName(m.name);
  delete m.img; delete m.at; delete m.src;
  if(S.saved.some(x=>mealNameKey(x.name)===mealNameKey(m.name))) { toast('Already in saved meals'); return; }
  S.saved.push({...m,servingAmount:Number(m.servingAmount)||1,servingUnit:m.servingUnit||'serving'}); renderAll(); toast('Saved to library');
};
window.go = v => switchView(v);

function renderApiStatus(){
  const el = $('#apiStatus'); if(!el) return;
  const saved=!!S.apiKey, connected=saved&&geminiKeyVerified;
  el.innerHTML = `<div class="gemini-credit"><span>Powered by Gemini</span><span class="gemini-dot${connected?' connected':''}" role="img" aria-label="${connected?'Connected':saved?'Key saved, not tested':'Not connected'}" title="${connected?'Connected':saved?'Key saved, not tested':'Not connected'}"></span></div>`;
  const coachStatus=$('#coachAiStatus');
  if(coachStatus) coachStatus.textContent=connected?'Gemini connected':saved?'Gemini key saved':'Personal coach';
  const kb=$('#keyBadge');
  if(kb){ kb.textContent = connected?'connected':saved?'saved':'not set'; kb.className = 'badge sp '+(connected?'bg-Pull':'bg-Rest'); }
  const guide=$('#keyGuide');
  if(guide) guide.hidden=connected;
}

function showKeyReminder(reason='',force=false){
  if(sessionStorage.getItem('cal-key-reminder-shown')==='yes'&&!force) return;
  if($('#updateBackdrop').style.display==='grid'||$('#recapBackdrop').style.display==='grid'){
    setTimeout(()=>showKeyReminder(reason,force),400);
    return;
  }
  if(reason){
    $('#keyReminderTitle').textContent='Update your Gemini key';
    $('#keyReminderMessage').textContent=`${reason} You can replace the key in Settings or continue using Cal without Gemini.`;
  }else if(S.apiKey){
    $('#keyReminderTitle').textContent='Check your Gemini key';
    $('#keyReminderMessage').textContent='A Gemini key is saved on this device, but has not been tested in this session. You can test or update it in Settings, or continue without AI.';
  }
  $('#keyReminderBackdrop').style.display='grid';
  sessionStorage.setItem('cal-key-reminder-shown','yes');
}

function isGeminiKeyError(error){
  return /api key|key not valid|invalid.{0,20}key|permission denied/i.test(
    error instanceof Error?error.message:String(error));
}

$('#openKeySettings').onclick=()=>{
  $('#keyReminderBackdrop').style.display='none';
  showNextAutomaticRecap();
  switchView('settings');
  setTimeout(()=>$('#keyIn').focus(),100);
};
$('#continueWithoutKey').onclick=()=>{
  $('#keyReminderBackdrop').style.display='none';
  showNextAutomaticRecap();
};

/* ============================================================================
   SCAN
   ============================================================================ */
let pendingImg = null, pendingMime = 'image/jpeg', result = null, mode = 'photo';

$('#modeBtn').onclick = () => {
  mode = mode==='photo' ? 'text' : 'photo';
  $('#photoMode').style.display = mode==='photo' ? 'block':'none';
  $('#textMode').style.display  = mode==='text'  ? 'block':'none';
  $('#modeBtn').textContent = mode==='photo' ? 'Text mode' : 'Photo mode';
};
$('#drop').onclick = () => $('#fileIn').click();
$('#camBtn').onclick = async() => {
  if(!isAndroidApp()||!MealCamera){ $('#camIn').click(); return; }
  const button=$('#camBtn');
  button.disabled=true;
  try{
    const photo=await MealCamera.capture();
    if(photo.cancelled) return;
    const binary=atob(photo.base64);
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    loadFile(new File([bytes],'meal-camera.jpg',{type:photo.mimeType||'image/jpeg'}));
  }catch(error){
    toast(`Could not open the camera: ${error instanceof Error?error.message:String(error)}`);
  }finally{
    button.disabled=false;
  }
};
$$('#fileIn,#camIn').forEach(i=>i.onchange=e=>loadFile(e.target.files[0]));
['dragover','dragenter'].forEach(ev=>$('#drop').addEventListener(ev,e=>{e.preventDefault();$('#drop').classList.add('over')}));
['dragleave','drop'].forEach(ev=>$('#drop').addEventListener(ev,e=>{e.preventDefault();$('#drop').classList.remove('over')}));
$('#drop').addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) loadFile(f); });

function loadFile(file){
  if(!file || !file.type.startsWith('image/')) { toast('Please choose an image'); return; }
  pendingMime = file.type || 'image/jpeg';
  const fr = new FileReader();
  fr.onload = ev => {
    const img = new Image();
    img.onload = () => {
      // downscale so the inline payload stays well under limits
      const max = 1024;
      const scale = Math.min(1, max/Math.max(img.width,img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width*scale); cv.height = Math.round(img.height*scale);
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      const url = cv.toDataURL('image/jpeg', 0.82);
      pendingImg = url.split(',')[1];
      $('#prev').src = url; $('#prev').style.display='block';
      $('#scanBtn').disabled = false;
      toast('Photo ready — tap Analyze');
    };
    img.src = ev.target.result;
  };
  fr.readAsDataURL(file);
}

const STEPS = ['Uploading image','Detecting food items','Estimating portions','Calculating macros','Finalising estimate'];
async function runAnalyze(imageB64, text){
  const line = document.querySelector('#v-scan .ailine');
  const step = $('#scanStep') || $('#textStep');
  line.classList.add('run');
  let i = 0;
  step.textContent = STEPS[0]+'…';
  const tick = setInterval(()=>{ i=Math.min(i+1,STEPS.length-1); step.textContent = STEPS[i]+'…'; }, 420);

  try{
    let data;
    if(S.apiKey){
      data = await analyzeRemote(imageB64, pendingMime, text);
      if(data.isFood === false) throw new Error('NOT_FOOD');
      data.note = data.note || 'AI estimate — check portions against what you actually ate.';
    } else {
      await new Promise(r=>setTimeout(r,1500));
      data = localAnalyze(text);
      data.note = data.note + ' (Offline estimator — no API key set.)';
    }
    result = data;
    renderResult();
  }catch(e){
    if(e.message === 'NOT_FOOD'){
      toast('That does not look like food');
      step.textContent = 'No food detected in the image.';
    } else if(S.apiKey){
      toast('API failed — using offline estimator');
      if(isGeminiKeyError(e)){
        geminiKeyVerified=false;
        renderApiStatus();
        showKeyReminder('Gemini rejected the saved API key.',true);
      }
      result = localAnalyze(text);
      result.note = `Gemini call failed (${e.message}). Showing an offline estimate.`;
      renderResult();
    } else {
      step.textContent = e.message;
    }
  }finally{
    clearInterval(tick);
    line.classList.remove('run');
    setTimeout(()=>{ step.textContent=''; }, 1200);
  }
}
$('#scanBtn').onclick = () => {
  if(!pendingImg){ toast('Add a photo first'); return; }
  runAnalyze(pendingImg, $('#photoDescription').value.trim());
};
$('#textBtn').onclick = () => {
  const v = $('#textIn').value.trim();
  if(!v){ toast('Describe your meal first'); return; }
  runAnalyze(null, v);
};
$('#textIn').addEventListener('keydown', e => { if(e.key==='Enter') $('#textBtn').click(); });
$$('.chip.qp').forEach(c=>c.onclick=()=>{ mode='text';
  $('#photoMode').style.display='none'; $('#textMode').style.display='block'; $('#modeBtn').textContent='Photo mode';
  $('#textIn').value = c.dataset.q; runAnalyze(null, c.dataset.q);
});

function renderResult(){
  if(!result) return;
  result.items.forEach(item=>{ if(!item.basePortion) item.basePortion=portionMeta(item).value; });
  const c = $('#resultCard'); c.style.display='block';
  const t = result.total;
  const conf = result.confidence || 'medium';
  c.innerHTML = `
    <div class="card-hd"><div class="h4" style="font-size:18px">${esc(displayMealName(result.mealName||'Meal'))}</div>
      <span class="conf sp">${conf} confidence</span></div>
    <div class="ailine" style="width:100%;margin-bottom:18px;opacity:.65"></div>
    <div class="hero-row"><div class="h2 num" id="resKcal">${num(t.kcal)}</div><div class="unit">kcal total</div></div>
    <div class="f3" style="margin-top:16px">
      <div class="tile"><div class="lbl">Protein</div><div class="v" style="color:var(--p);font-size:22px">${t.protein.toFixed(1)}<small>g</small></div></div>
      <div class="tile"><div class="lbl">Carbs</div><div class="v" style="color:var(--c);font-size:22px">${t.carbs.toFixed(1)}<small>g</small></div></div>
      <div class="tile"><div class="lbl">Fat</div><div class="v" style="color:var(--f);font-size:22px">${t.fat.toFixed(1)}<small>g</small></div></div>
    </div>
    <div class="divider"></div>
    <div class="lbl" style="margin-bottom:10px">Detected items</div>
    <div class="rows">
      ${result.items.map((it,i)=>`
        <div class="row scan-result-item">
          <div class="aw" aria-hidden="true"></div>
          <div class="main">
              <div class="nm" style="font-size:15px">${esc(displayFoodName(it.name))}</div>
            <div class="ms" id="portion${i}">${esc(portionText(it))}</div>
            <div class="item-macros" id="macro${i}"><span class="p">P ${Number(it.protein*(it.qty||1)).toFixed(1)}g</span><span class="c">C ${Number(it.carbs*(it.qty||1)).toFixed(1)}g</span><span class="f">F ${Number(it.fat*(it.qty||1)).toFixed(1)}g</span></div>
          </div>
          <div class="portion-controls">
            <input class="portion-input" type="text" inputmode="decimal" value="${portionMeta(it).value}" aria-label="${esc(it.name)} portion" oninput="updatePortion(${i},this.value)">
            <span class="portion-unit">${portionMeta(it).unit}</span>
          </div>
          <div class="rt" style="margin-left:10px"><div class="v" id="ik${i}">${num(it.kcal*(it.qty||1))}</div><div class="u">kcal</div></div>
          <button class="btn ghost item-delete" title="Remove detected item" aria-label="Remove ${esc(it.name)}" onclick="removeDetected(${i})">×</button>
        </div>`).join('')}
    </div>
    ${result.note?`<div class="notice" style="margin-top:16px">${esc(result.note)}</div>`:''}
    <div class="btn-row" style="margin-top:18px">
      <button class="btn pri pill full" onclick="saveResult()">Add to selected day</button>
      <button class="btn full" id="saveResultButton" onclick="saveResultToLibrary()">Save meal</button>
      <button class="btn" onclick="discard()">Discard</button>
    </div>`;
  const saved = S.saved.some(m=>mealNameKey(m.name)===mealNameKey(resultMealName()));
  const saveButton = $('#saveResultButton');
  saveButton.textContent = saved ? 'Saved' : 'Save meal';
  saveButton.disabled = saved;
  c.scrollIntoView({behavior:'smooth',block:'nearest'});
}
window.removeDetected = i => {
  if(!result || !result.items[i]) return;
  result.items.splice(i,1);
  result.total = resultTotals();
  if(!result.items.length){ discard(); toast('All detected items removed'); return; }
  result.mealName = result.items.map(item=>displayFoodName(item.name)).join(', ');
  renderResult();
  toast('Detected item removed');
};
window.bump = (i, d) => {
  const it = result.items[i];
  const meta = portionMeta(it);
  const input = document.querySelectorAll('.portion-input')[i];
  const value = Math.max(meta.min, Number(input?.value || meta.value) + d*meta.step);
  if(input) input.value=value;
  it.qty = value / meta.value;
  const t = resultTotals();
  result.total = t;
  $('#ik'+i).textContent = num(it.kcal*it.qty);
  $('#resKcal').textContent = num(t.kcal);
};
window.discard = () => { $('#resultCard').style.display='none'; result=null; pendingImg=null; $('#prev').style.display='none'; $('#scanBtn').disabled=true; };
function resultMealName(){
  return result.items.map(i=>displayFoodName((i.qty&&i.qty!==1)?`${i.qty}× ${i.name}`:i.name)).join(', ') || displayMealName(result.mealName);
}
function resultMealData(){
  const t=result.total;
  return {
    name:resultMealName(), kcal:Math.round(t.kcal),
    protein:+t.protein.toFixed(1), carbs:+t.carbs.toFixed(1), fat:+t.fat.toFixed(1),
    type:$('#mealType').value
  };
}
window.saveResultToLibrary = () => {
  if(!result) return;
  const meal=resultMealData();
  if(S.saved.some(m=>mealNameKey(m.name)===mealNameKey(meal.name))){ toast('That meal is already saved'); return; }
  S.saved.push({...meal,servingAmount:1,servingUnit:'serving'});
  saveState(); renderLibrary();
  const button=$('#saveResultButton');
  if(button){ button.textContent='Saved'; button.disabled=true; }
  toast('Meal saved for quick add');
};
window.saveResult = () => {
  if(!result) return;
  const savedMeal=resultMealData();
  const meal = {
    ...savedMeal,
    img: pendingImg ? 'data:image/jpeg;base64,'+pendingImg : null,
    src: pendingImg ? 'photo':'text',
    at: mealTimeLabel($('#mealTime').value)
  };
  const logKey = $('#mealDate').value || TODAY();
  D(logKey).meals.push(meal);
  S.recent.unshift({...meal, img: meal.img}); S.recent = S.recent.slice(0,8);
  if(!pendingImg) $('#textIn').value='';
  discard(); renderAll();
  toast(`Added ${num(meal.kcal)} kcal to ${logKey===TODAY()?'today':nice(logKey)}`,'✓');
};

function renderRecent(){
  const r = $('#recentList'); if(!r) return;
  r.innerHTML = S.recent.length ? S.recent.map((m,i)=>`
    <div class="row">
      ${m.img?`<img class="aw" src="${m.img}">`:`<div class="aw" aria-hidden="true"></div>`}
      <div class="main"><div class="nm" style="font-size:15px">${esc(displayMealName(m.name))}</div>
        <div class="ms">${m.type||'Meal'} · ${m.at}${m.src==='photo'?' · photo':' · text'}</div></div>
      <div class="rt"><div class="v" style="font-size:16px">${num(m.kcal)}</div><div class="u">kcal</div></div>
    </div>`).join('')
    : `<div class="empty"><div class="tx">Scans appear here</div></div>`;
}

/* ============================================================================
   TRAIN
   ============================================================================ */
let pick = null;
let exerciseDraft = [];
let bodyMuscleCharts = [];
const WORKOUT_TYPES = ['Push','Pull','Legs','Upper Body','Lower Body'];
const WORKOUT_CLASS = {'Push':'Push','Pull':'Pull','Legs':'Legs','Upper Body':'Upper-Body','Lower Body':'Lower-Body'};
const workoutClass = type => WORKOUT_TYPES.includes(type) ? WORKOUT_CLASS[type] : 'Rest';
function nextWorkoutType(type){
  const index=WORKOUT_TYPES.indexOf(type);
  return WORKOUT_TYPES[(index+1)%WORKOUT_TYPES.length];
}
function normalizeExerciseName(name){
  return cleanExerciseName(name).toLowerCase();
}
function cleanExerciseName(name){
  return String(name||'').normalize('NFKC').replace(/[\s\uFEFF]+/g,' ').trim();
}
function renderRoutineList(){
  const list=$('#routineList');
  if(!list) return;
  list.innerHTML=S.routines.length ? S.routines.map((r,i)=>`<div class="routine-row"><div class="name">${esc(r.name)}</div><span class="meta">${esc(r.type)} · ${r.exercises.length} exercises</span><button class="btn sm" onclick="loadRoutine(${i})">Load</button><button class="btn sm ghost" onclick="deleteRoutine(${i})">Delete</button></div>`).join('') : '';
}
let editingRoutineIndex = null;
function renderExerciseDraft(){
  const box = $('#exerciseLog');
  if(!box) return;
  box.classList.toggle('on', !!pick);
  if(!pick) return;
  $('#exerciseHint').textContent = `${pick} · ${exerciseDraft.length} exercise${exerciseDraft.length===1?'':'s'}`;
  $('#exerciseList').innerHTML = exerciseDraft.length ? `<div class="exercise-row exercise-row-labels"><span>Exercise</span><span>Sets</span><span>Reps</span><span>kg</span><span></span></div>`+exerciseDraft.map((x,i)=>`
    <div class="exercise-row">
      <div class="name">${esc(x.name)}</div>
      <input type="number" min="1" step="1" value="${Number(x.sets)||1}" aria-label="${esc(x.name)} sets" onchange="updateExercise(${i},'sets',this.value)">
      <input type="number" min="1" step="1" value="${Number(x.reps)||1}" aria-label="${esc(x.name)} reps" onchange="updateExercise(${i},'reps',this.value)">
      <input type="number" min="0" step="0.5" value="${Number(x.weight)||0}" aria-label="${esc(x.name)} weight in kilograms" onchange="updateExercise(${i},'weight',this.value)">
      <button class="btn sm ghost" title="Remove exercise" aria-label="Remove ${esc(x.name)}" onclick="removeExercise(${i})">Delete</button>
    </div>`).join('') : '<div class="empty" style="padding:16px 0"><div class="tx">Add the exercises you performed</div></div>';
  $('#saveRoutine').textContent=editingRoutineIndex===null?'Save routine':'Update routine';
  renderRoutineList();
}
function addExercise(){
  const name=cleanExerciseName($('#exName').value), sets=Number($('#exSets').value), reps=Number($('#exReps').value), weight=Number($('#exWeight').value);
  if(!name || !sets || !reps || weight<0){ toast('Add exercise, sets, reps and weight'); return; }
  exerciseDraft.push({name,sets:Math.round(sets),reps:Math.round(reps),weight:+weight.toFixed(1)});
  ['exName','exSets','exReps','exWeight'].forEach(id=>$('#'+id).value='');
  renderExerciseDraft();
}
window.updateExercise = (i,key,raw) => {
  const value=Number(raw);
  if(!exerciseDraft[i]||!Number.isFinite(value)||value<0||(key!=='weight'&&value<1)){
    toast(key==='weight'?'Weight must be zero or more.':'Sets and reps must be at least one.');
    renderExerciseDraft();
    return;
  }
  exerciseDraft[i][key]=key==='weight'?Number(value.toFixed(1)):Math.round(value);
};
window.removeExercise = i => { exerciseDraft.splice(i,1); renderExerciseDraft(); };
window.loadRoutine = i => {
  const routine=S.routines[i];
  if(!routine) return;
  editingRoutineIndex=i;
  pick=routine.type; exerciseDraft=routine.exercises.map(x=>({...x,name:cleanExerciseName(x.name)}));
  $('#routineName').value=routine.name;
  $$('#splits .split-option').forEach(x=>x.classList.toggle('on',x.dataset.t===pick));
  renderExerciseDraft(); toast(`${routine.name} loaded`,'✓');
};
window.deleteRoutine = i => { S.routines.splice(i,1); saveState(); renderRoutineList(); toast('Routine removed'); };
$$('#splits .split-option').forEach(b=>b.onclick=()=>{
  pick = b.dataset.t;
  editingRoutineIndex=null;
  $('#routineName').value='';
  const current = today().workout;
  exerciseDraft = current && current.type===pick ? [...(current.exercises||[])] : [];
  $$('#splits .split-option').forEach(x=>x.classList.toggle('on', x===b));
  renderExerciseDraft();
});
$('#addExercise').onclick=addExercise;
$('#saveRoutine').onclick=()=>{
  const name=$('#routineName').value.trim() || `${pick||'Workout'} routine`;
  if(!pick || !exerciseDraft.length){ toast('Add exercises before saving a routine'); return; }
  if(S.routines.some((x,i)=>i!==editingRoutineIndex&&x.name.toLowerCase()===name.toLowerCase())){ toast('That routine already exists'); return; }
  const routine={name,type:pick,exercises:exerciseDraft.map(x=>({...x,name:cleanExerciseName(x.name)}))};
  if(editingRoutineIndex===null) S.routines.push(routine);
  else S.routines[editingRoutineIndex]=routine;
  editingRoutineIndex=null;
  $('#routineName').value=''; saveState(); renderExerciseDraft(); toast('Routine saved');
};
['exName','exSets','exReps','exWeight'].forEach(id=>$('#'+id).addEventListener('keydown',e=>{if(e.key==='Enter') addExercise();}));
$('#strengthExercise').onchange=renderStrength;
const fmtT = s => [Math.floor(s/3600), Math.floor(s%3600/60), s%60].map(v=>String(v).padStart(2,'0')).join(':');
$('#startBtn').onclick = () => {
  if(!pick){ toast('Pick a workout split first'); return; }
  if(S.timer.on) return;
  S.timer.on = true; S.timer.type = pick;
  $('#timerBox').classList.add('on');
  $('#startBtn').disabled = true; $('#pauseBtn').disabled = false;
  S.timer.id = setInterval(()=>{ S.timer.sec++; $('#tBig').textContent = fmtT(S.timer.sec); }, 1000);
  toast(`${pick} session started`);
};
$('#pauseBtn').onclick = () => {
  clearInterval(S.timer.id); S.timer.on = false;
  $('#timerBox').classList.remove('on');
  $('#startBtn').disabled = false; $('#pauseBtn').disabled = true;
  $('#startBtn').textContent = 'Resume';
};
$('#resetBtn').onclick = () => {
  clearInterval(S.timer.id); S.timer = {on:false, sec:0, id:null, type:pick};
  $('#tBig').textContent = '00:00:00'; $('#timerBox').classList.remove('on');
  $('#startBtn').disabled = false; $('#pauseBtn').disabled = true;
  $('#startBtn').textContent = 'Start';
};
$('#saveWo').onclick = () => {
  if(!pick){ toast('Choose a workout split'); return; }
  const manual = parseFloat($('#manMin').value);
  const mins = manual>0 ? manual : Math.round(S.timer.sec/60);
  if(!mins || mins<1){ toast('Start the timer or enter minutes'); return; }
  if(exerciseDraft.some(x=>!x.name.trim()||Number(x.sets)<1||Number(x.reps)<1||Number(x.weight)<0)){
    toast('Check each exercise name, set, rep, and weight before saving.');
    return;
  }
  const inten = parseFloat($('#intensity').value);
  const workout = {type:pick, min:Math.round(mins), intensity:inten, weightKg:S.weight, notes:$('#notes').value.trim(), exercises:exerciseDraft.map(x=>({...x,name:cleanExerciseName(x.name)})),
                   at:new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})};
  today().workout = workout;
  clearInterval(S.timer.id); S.timer={on:false,sec:0,id:null,type:pick};
  $('#tBig').textContent='00:00:00'; $('#timerBox').classList.remove('on');
  $('#manMin').value=''; $('#notes').value='';
  exerciseDraft=[]; editingRoutineIndex=null; $('#routineName').value=''; renderExerciseDraft();
  $('#startBtn').disabled=false; $('#pauseBtn').disabled=true; $('#startBtn').textContent='Start';
  renderAll();
  toast(`${pick} workout saved`);
};
window.editTodayWorkout=()=>{
  const workout=today().workout;
  if(!workout) return;
  pick=workout.type;
  editingRoutineIndex=null;
  exerciseDraft=(workout.exercises||[]).map(exercise=>({...exercise,name:cleanExerciseName(exercise.name)}));
  $('#manMin').value=workout.min;
  $('#intensity').value=String(workout.intensity||1.35);
  $('#notes').value=workout.notes||'';
  $('#routineName').value='';
  $$('#splits .split-option').forEach(option=>option.classList.toggle('on',option.dataset.t===pick));
  renderExerciseDraft();
  switchView('train');
};
function weekKeys(off){
  const b = new Date(); b.setDate(b.getDate()+off*7);
  const dow = (b.getDay()+6)%7;              // Monday = 0
  const mon = new Date(b); mon.setDate(b.getDate()-dow);
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return dkey(d); });
}
function renderTrain(){
  const d = today(), wk = weekKeys(0);
  const n = wk.filter(k=>S.days[k]&&S.days[k].workout).length;
  $('#wSess').textContent = d.workout ? d.workout.type : '—';
  $('#wDur').textContent  = (d.workout?d.workout.min:0)+' min';
  $('#wWeek').textContent = n+' / '+S.weekGoal;

  const rows = Object.keys(S.days).filter(k=>S.days[k].workout).sort().reverse().slice(0,12);
  $('#woHist').innerHTML = rows.length ? rows.map(k=>{
    const w = S.days[k].workout;
    return `<div class="row">
      <div class="aw" aria-hidden="true"></div>
      <div class="main"><div class="nm" style="font-size:15px">${esc(w.type)} day</div>
        <div class="ms">${nice(k)} · ${w.min} min · ${w.exercises?.length||0} exercises</div></div>
      <span class="badge bg-${workoutClass(w.type)}">${esc(w.type)}</span>
    </div>`;
  }).join('') : `<div class="empty"><div class="tx">No sessions yet</div></div>`;
  renderStrength();
}
function renderStrength(){
  const sessions = Object.keys(S.days).sort().flatMap(k=>{
    const w=S.days[k].workout;
    return w && w.exercises?.length ? w.exercises.map(x=>({...x,k,type:w.type})) : [];
  });
  const summary=$('#strengthSummary'), chart=$('#strengthChart');
  if(!sessions.length){
    $('#strengthExercise').innerHTML='<option>No exercise data</option>';
    summary.innerHTML='<div class="strength-empty">Add exercises to see strength trends</div>';
    chart.innerHTML='';
    updateMuscleMap([],0);
    return;
  }
  const exerciseNames=new Map();
  sessions.forEach(x=>{
    const key=normalizeExerciseName(x.name);
    if(key && !exerciseNames.has(key)) exerciseNames.set(key,cleanExerciseName(x.name));
  });
  const names=[...exerciseNames.keys()].sort((a,b)=>exerciseNames.get(a).localeCompare(exerciseNames.get(b)));
  const select=$('#strengthExercise'), previous=select.value;
  select.innerHTML=names.map(key=>`<option value="${esc(key)}">${esc(exerciseNames.get(key))}</option>`).join('');
  select.value=names.includes(previous)?previous:names[0];
  const selected=sessions.filter(x=>normalizeExerciseName(x.name)===select.value), sets=selected.reduce((a,x)=>a+x.sets,0), reps=selected.reduce((a,x)=>a+x.sets*x.reps,0);
  const volume=selected.reduce((a,x)=>a+x.sets*x.reps*x.weight,0);
  const best=selected.reduce((a,x)=>Math.max(a,x.weight*(1+x.reps/30)),0);
  const displayName=exerciseNames.get(select.value);
  updateMuscleMap(musclesForExercise(displayName),selected[0]?.sets);
  const byDay=new Map();
  selected.forEach(x=>{
    const value=x.weight*(1+x.reps/30);
    byDay.set(x.k,Math.max(byDay.get(x.k)||0,value));
  });
  const points=[...byDay].sort(([a],[b])=>a.localeCompare(b)).slice(-8);
  const values=points.map(([,value])=>value), low=Math.min(...values), high=Math.max(...values);
  const spread=Math.max(high-low,10), min=Math.max(0,low-spread*.2), max=high+spread*.2;
  const xFor=i=>28+i/Math.max(points.length-1,1)*284;
  const yFor=value=>112-(value-min)/Math.max(max-min,1)*78;
  const pointCoords=points.map(([,value],i)=>`${xFor(i)},${yFor(value)}`).join(' ');
  const dateLabels=points.map(([day],i)=>`<text x="${xFor(i)}" y="139" text-anchor="middle">${new Date(`${day}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</text>`).join('');
  const dots=points.map(([day,value],i)=>`<circle cx="${xFor(i)}" cy="${yFor(value)}" r="4" fill="var(--p)"><title>${new Date(`${day}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'})}: ${value.toFixed(1)} kg estimated 1RM</title></circle>`).join('');
  const trend=points.length>1?points[points.length-1][1]-points[0][1]:0;
  summary.innerHTML=`<div class="f3" style="gap:7px"><div class="tile"><div class="lbl">Sets</div><div class="v" style="font-size:20px">${sets}</div></div><div class="tile"><div class="lbl">Volume</div><div class="v" style="font-size:20px">${Math.round(volume).toLocaleString('en-US')}<small>kg</small></div></div><div class="tile"><div class="lbl">Est. 1RM</div><div class="v" style="font-size:20px">${best.toFixed(1)}<small>kg</small></div></div></div><div class="meta" style="margin-top:10px">${esc(displayName)} · ${trend>0?'+':''}${trend.toFixed(1)} kg estimated 1RM change</div>`;
  chart.innerHTML=`<svg viewBox="0 0 340 150" role="img" aria-label="Estimated one-rep max trend for ${esc(displayName)}">
    <line x1="24" x2="324" y1="34" y2="34" stroke="var(--divider)"/>
    <line x1="24" x2="324" y1="73" y2="73" stroke="var(--divider)"/>
    <line x1="24" x2="324" y1="112" y2="112" stroke="var(--divider)"/>
    <text x="20" y="37" text-anchor="end">${max.toFixed(0)}</text>
    <text x="20" y="115" text-anchor="end">${min.toFixed(0)}</text>
    ${points.length>1?`<polyline points="${pointCoords}" fill="none" stroke="var(--p)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`:''}
    ${dots}${dateLabels}
  </svg>`;
}
function musclesForExercise(name){
  const text=String(name||'').toLowerCase();
  const group=(name,pattern)=>({name,pattern:new RegExp(pattern)});
  let primary=[],secondary=[];
  if(/face.?pull/.test(text)){
    primary=[group('Rear deltoids','^deltoid-rear-'),group('Mid trapezius','^traps-mid-')];
    secondary=[group('Upper trapezius','^traps-upper-'),group('Biceps','^biceps-')];
  }else if(/lateral raise|upright row/.test(text)){
    primary=[group('Side deltoids','^shoulder-side-')];
    secondary=[group('Upper trapezius','^traps-upper-')];
  }else if(/shoulder press|overhead press|military press/.test(text)){
    primary=[group('Front deltoids','^shoulder-front-'),group('Side deltoids','^shoulder-side-')];
    secondary=[group('Triceps','^triceps-'),group('Upper chest','^chest-upper-')];
  }else if(/bench|chest press|push.?up|pec|chest fly|cable fly/.test(text)){
    primary=[group('Upper chest','^chest-upper-'),group('Lower chest','^chest-lower-')];
    secondary=[group('Front deltoids','^shoulder-front-'),group('Triceps','^triceps-')];
  }else if(/tricep|pushdown|skull.?crusher|close.?grip/.test(text)){
    primary=[group('Triceps','^triceps-')];
    secondary=[group('Forearm extensors','^forearm-extensors-')];
  }else if(/bicep|curl|chin.?up/.test(text)&&!/leg curl|hamstring curl/.test(text)){
    primary=[group('Biceps','^biceps-')];
    secondary=[group('Forearm flexors','^forearm-flexors-')];
  }else if(/deadlift|romanian|\brdl\b|good morning/.test(text)){
    primary=[group('Hamstrings','^hamstrings-'),group('Gluteus maximus','^gluteus-maximus-')];
    secondary=[group('Erector spinae','^lower-back-erectors-'),group('Lats','^lats-'),group('Trapezius','^traps-')];
  }else if(/leg curl|hamstring/.test(text)){
    primary=[group('Hamstrings','^hamstrings-')];
  }else if(/leg extension|squat|lunge|leg press|step.?up/.test(text)){
    primary=[group('Quadriceps','^quads-')];
    secondary=[group('Gluteus maximus','^gluteus-maximus-'),group('Hamstrings','^hamstrings-'),group('Adductors','^adductors-')];
  }else if(/hip thrust|glute bridge|glute/.test(text)){
    primary=[group('Gluteus maximus','^gluteus-maximus-')];
    secondary=[group('Hamstrings','^hamstrings-')];
  }else if(/calf|calves/.test(text)){
    primary=[group('Calves','^calves-')];
    secondary=[group('Tibialis anterior','^tibialis-anterior-')];
  }else if(/row|pull.?up|pulldown|lat/.test(text)){
    primary=[group('Lats','^lats-'),group('Mid trapezius','^traps-mid-')];
    secondary=[group('Rear deltoids','^deltoid-rear-'),group('Biceps','^biceps-'),group('Forearms','^forearm-')];
  }else if(/plank|crunch|sit.?up|ab|core|leg raise/.test(text)){
    primary=[group('Abdominals','^abs-'),group('Obliques','^obliques-')];
    secondary=[group('Hip flexors','^hip-flexor-')];
  }
  return {primary,secondary};
}
function updateMuscleMap(groups,setCount){
  const library=window.BodyMuscles;
  const summary=$('#muscleSummary');
  if(!library?.BodyChart){
    summary.innerHTML='<div class="muscle-group-title">Muscle map unavailable</div><div class="meta">Rebuild the web app to include its anatomy chart.</div>';
    return;
  }
  const mainIntensity=Math.min(9,6+Math.floor(Math.max(0,Number(setCount||0)-1)/2));
  const supportIntensity=Math.max(3,mainIntensity-3);
  const state={};
  const regions={primary:[],secondary:[]};
  for(const role of ['primary','secondary']){
    const intensity=role==='primary'?mainIntensity:supportIntensity;
    for(const group of groups[role]||[]){
      for(const muscle of Object.values(library.MUSCLE_MAP)){
        if(!group.pattern.test(muscle.id)) continue;
        state[muscle.id]={intensity,selected:true};
        const label=muscle.name.replace(/^(Left|Right) /,'').replace(/ (Left|Right)$/,'');
        if(!regions[role].some(item=>item.name===label)) regions[role].push({name:label,intensity});
      }
    }
  }
  if(!bodyMuscleCharts.length){
    bodyMuscleCharts=[
      new library.BodyChart($('#muscleFront'),{view:library.ViewSide.FRONT,bodyState:state,ariaLabel:'Front muscle map'}),
      new library.BodyChart($('#muscleBack'),{view:library.ViewSide.BACK,bodyState:state,ariaLabel:'Back muscle map'})
    ];
  }else{
    bodyMuscleCharts.forEach(chart=>chart.update({bodyState:state}));
  }
  const roleMarkup=(role,label)=>{
    const items=regions[role];
    return `<section><div class="muscle-group-title">${label}</div><div class="muscle-chips">${items.length?items.map(item=>`<span class="muscle-chip ${role}">${esc(item.name)} · ${item.intensity}/10</span>`).join(''):'<span class="meta">No mapped muscles</span>'}</div></section>`;
  };
  summary.innerHTML=`${roleMarkup('primary','Main muscles')}${roleMarkup('secondary','Supporting muscles')}`;
}
function nice(k){
  const t=new Date(), y=new Date(); y.setDate(y.getDate()-1);
  if(k===dkey(t)) return 'Today';
  if(k===dkey(y)) return 'Yesterday';
  return new Date(k+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
}
function suggestNext(){
  const past = Object.keys(S.days).filter(k=>S.days[k].workout && k<=TODAY()).sort().pop();
  if(!past) return 'Push';
  const t = S.days[past].workout.type;
  return nextWorkoutType(t);
}

/* ============================================================================
   WEEK
   ============================================================================ */
let stepsMonthOffset = 0;
let syncingHealthSteps = false;
window.shiftWeek = n => { S.weekOffset += n; renderWeek(); };
window.shiftStepMonth = n => {
  stepsMonthOffset += n;
  renderStepsCalendar();
};
window.selectStepDate = k => {
  if(k>TODAY()) return;
  $('#stepDate').value=k;
  $('#stepsIn').value='';
  updateStepDateDisplay();
  renderStepsCalendar();
};
function updateStepDateDisplay(){
  const k=$('#stepDate').value || TODAY(), steps=Number(D(k).steps)||0;
  $('#stepCurrent').textContent=`Current total: ${num(steps)} steps`;
}
function saveStepCount(additive){
  const k=$('#stepDate').value, count=Number($('#stepsIn').value);
  if(!k || k>TODAY()){ toast('Choose today or an earlier date'); return; }
  if($('#stepsIn').value==='' || !Number.isInteger(count) || count<0 || count>200000){ toast('Enter a valid step count'); return; }
  const day=D(k), previous=Number(day.steps)||0;
  day.steps=additive ? Math.min(200000,previous+count) : count;
  day.stepsSource='manual';
  $('#stepsIn').value='';
  renderAll(); updateStepDateDisplay();
  toast(additive?'Steps added to the daily total':'Daily step total saved','✓');
}
$('#stepDate').onchange=()=>{ $('#stepsIn').value=''; updateStepDateDisplay(); renderStepsCalendar(); };
$('#saveSteps').onclick=()=>saveStepCount(false);
$('#addSteps').onclick=()=>saveStepCount(true);

async function syncHealthSteps(requestAccess){
  if(syncingHealthSteps) return;
  const status=$('#healthStepsStatus');
  const button=$('#healthStepsConnect');
  const health=window.capacitorHealth?.Health;
  if(!health){
    status.textContent='Health Connect is available in the Android app';
    if(S.healthConnectEnabled){
      S.healthConnectEnabled=false;
      saveState(false);
      renderHealthConnectStatus();
    }
    if(requestAccess) toast('Open MyCal AI on Android to connect Health Connect');
    return;
  }

  syncingHealthSteps=true;
  if(requestAccess) button.disabled=true;
  try{
    const availability=await health.isAvailable();
    if(!availability.available){
      status.textContent=availability.reason||'Install or enable Health Connect to sync steps';
      S.healthConnectEnabled=false;
      saveState(false);
      renderHealthConnectStatus();
      if(requestAccess) toast(status.textContent);
      return;
    }

    const authorization=requestAccess
      ? await health.requestAuthorization({read:['steps']})
      : await health.checkAuthorization({read:['steps']});
    if(!authorization.readAuthorized.includes('steps')){
      S.healthConnectEnabled=false;
      saveState(false);
      renderHealthConnectStatus();
      status.textContent='Allow step access in Health Connect to sync steps';
      return;
    }

    S.healthConnectEnabled=true;
    renderHealthConnectStatus();
    const month=new Date();
    month.setDate(1);
    month.setHours(0,0,0,0);
    month.setMonth(month.getMonth()+stepsMonthOffset);
    const monthEnd=new Date(month.getFullYear(),month.getMonth()+1,1);
    const now=new Date();
    const historyLimit=new Date();
    historyLimit.setDate(historyLimit.getDate()-30);
    if(monthEnd<=historyLimit){
      status.textContent='Health Connect allows step history for the last 30 days';
      return;
    }
    const end=monthEnd>now?now:monthEnd;
    const start=month>historyLimit?month:historyLimit;
    const startKey=dkey(start), endKey=dkey(end);
    if(!StepAggregation) throw new Error('Update the Android app to enable step syncing');
    const {days}=await StepAggregation.readDailyTotals({
      startDate:start.toISOString(),
      endDate:end.toISOString()
    });
    const totals=new Map();
    days.forEach(day=>{
      const key=dkey(day.startDate);
      if(key<startKey||key>endKey) return;
      totals.set(key,Math.max(0,Number(day.steps)||0));
    });

    let changed=false;
    totals.forEach((count,key)=>{
      const day=D(key);
      if(day.stepsSource==='manual'||(Number(day.steps)>0&&day.stepsSource!=='healthConnect')) return;
      const imported=Math.min(200000,Math.round(count));
      if(day.steps!==imported||day.stepsSource!=='healthConnect'){
        day.steps=imported;
        day.stepsSource='healthConnect';
        changed=true;
      }
    });
    Object.entries(S.days).forEach(([key,day])=>{
      if(key>=startKey&&key<=endKey&&day.stepsSource==='healthConnect'&&!totals.has(key)){
        day.steps=0;
        changed=true;
      }
    });
    if(changed){ renderAll(); updateStepDateDisplay(); }
    else saveState(false);
    status.textContent=`Health Connect synced · ${new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`;
  }catch(error){
    console.warn('Could not sync steps from Health Connect:',error);
    status.textContent=error.message||'Could not sync Health Connect steps';
    if(requestAccess) toast(status.textContent);
  }finally{
    syncingHealthSteps=false;
    button.disabled=false;
  }
}

function renderHealthConnectStatus(){
  const actions=$('.home-step-actions');
  const dot=$('#stepsSyncDot');
  const label=$('#stepsSyncLabel');
  if(actions) actions.hidden=S.healthConnectEnabled;
  if(dot){
    dot.classList.toggle('connected',S.healthConnectEnabled);
    dot.setAttribute('aria-label',S.healthConnectEnabled?'Health Connect is connected':'Health Connect is not connected');
    dot.title=S.healthConnectEnabled?'Health Connect is connected':'Health Connect is not connected';
  }
  if(label) label.textContent=S.healthConnectEnabled?'Connected':'Manual';
}

$('#healthStepsConnect').onclick=()=>syncHealthSteps(true);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&S.healthConnectEnabled) syncHealthSteps(false);
});

function renderStepsCalendar(){
  const now=new Date(), month=new Date(now.getFullYear(),now.getMonth()+stepsMonthOffset,1,12);
  const year=month.getFullYear(), monthIndex=month.getMonth(), daysInMonth=new Date(year,monthIndex+1,0).getDate();
  const leading=(month.getDay()+6)%7, firstOfMonth=dkey(month), lastOfMonth=dkey(new Date(year,monthIndex,daysInMonth,12));
  $('#stepsMonthLabel').textContent=month.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  let total=0,logged=0;
  Object.keys(S.days).forEach(k=>{
    if(k<firstOfMonth || k>lastOfMonth) return;
    const steps=Number(S.days[k].steps)||0;
    if(steps>0){ total+=steps; logged++; }
  });
  $('#stepsMonthTotal').textContent=num(total);
  $('#stepsMonthDays').textContent=logged;
  const headings=['M','T','W','T','F','S','S'].map(day=>`<div class="day-head">${day}</div>`).join('');
  const blanks=Array.from({length:leading},()=>'<div class="step-day blank" aria-hidden="true"></div>').join('');
  const cells=Array.from({length:daysInMonth},(_,i)=>{
    const day=i+1, k=dkey(new Date(year,monthIndex,day,12)), steps=Number(S.days[k]?.steps)||0;
    const classes=['step-day',k===TODAY()?'today':'',k===$('#stepDate').value?'selected':''].filter(Boolean).join(' ');
    const count=steps>=10000?`${(steps/1000).toFixed(0)}k`:steps>=1000?`${(steps/1000).toFixed(1)}k`:String(steps||'—');
    return `<button class="${classes}" type="button" ${k>TODAY()?'disabled':''} title="${num(steps)} steps" onclick="selectStepDate('${k}')"><span class="sdn">${day}</span><span class="sdc">${count}</span></button>`;
  }).join('');
  $('#stepsCalendar').innerHTML=headings+blanks+cells;
}
function renderWeek(){
  const keys = weekKeys(S.weekOffset), names=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const tk = TODAY();
  $('#weekRange').textContent =
    `${new Date(keys[0]+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${new Date(keys[6]+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}`
    + (S.weekOffset===0 ? ' · current' : '');

  $('#weekStrip').innerHTML = keys.map((k,i)=>{
    const d = S.days[k];
    const t = d && d.workout ? d.workout.type : 'Rest';
    return `<div class="wd ${k===tk?'today':''}">
      <div class="dw">${names[i]}</div>
      <div class="dn">${new Date(k+'T12:00:00').getDate()}</div>
      <span class="dt ${t==='Rest'?'Rest':workoutClass(t)}">${t==='Rest'?'—':t==='Upper Body'?'UPPER':t==='Lower Body'?'LOWER':esc(t.toUpperCase())}</span>
      ${d&&d.workout?`<div class="min">${d.workout.min}m</div>`:''}
    </div>`;
  }).join('');

  const splitCounts=Object.fromEntries(WORKOUT_TYPES.map(type=>[type,0]));
  let min=0,kcal=0,logged=0;
  keys.forEach(k=>{
    const d = S.days[k]; if(!d) return;
    if(d.workout){ if(WORKOUT_TYPES.includes(d.workout.type)) splitCounts[d.workout.type]++; min+=d.workout.min; }
    if(d.meals.length){ kcal += eaten(k).kcal; logged++; }
  });
  $('#cP').textContent=splitCounts.Push; $('#cU').textContent=splitCounts.Pull; $('#cL').textContent=splitCounts.Legs;
  $('#cUpper').textContent=splitCounts['Upper Body']; $('#cLower').textContent=splitCounts['Lower Body'];
  $('#cR').textContent = 7-WORKOUT_TYPES.reduce((total,type)=>total+splitCounts[type],0); $('#cM').textContent = num(min);
  $('#cK').textContent = logged ? num(kcal/logged) : 0;

  const rows = keys.filter(k=>S.days[k]&&(S.days[k].workout||S.days[k].meals.length||S.days[k].steps)).reverse();
  $('#weekLog').innerHTML = rows.length ? rows.map(k=>{
    const d=S.days[k], w=d.workout, t=eaten(k);
    return `<div class="row">
      <div class="aw" aria-hidden="true"></div>
      <div class="main">
        <div class="nm" style="font-size:15px">${w?esc(w.type)+' day':d.meals.length?'Nutrition only':'Steps'} <span class="meta" style="font-weight:500">· ${nice(k)}</span></div>
        <div class="ms">${w?`${w.min} min · `:''}${d.steps?`${num(d.steps)} steps · `:''}${num(t.kcal)} kcal eaten</div>
      </div>
      ${w?`<span class="badge bg-${workoutClass(w.type)}">${w.min}m</span>`:''}
    </div>`;
  }).join('') : `<div class="empty"><div class="tx">Nothing logged this week</div></div>`;
  const completedDays=keys.filter(k=>k<=tk);
  const nutritionDays=completedDays.filter(k=>S.days[k]?.meals?.length);
  const onTarget=nutritionDays.filter(k=>Math.abs(eaten(k).kcal-S.goals.k)<=S.goals.k*.1).length;
  const proteinDays=nutritionDays.filter(k=>eaten(k).protein>=S.goals.p).length;
  const trainingDays=completedDays.filter(k=>S.days[k]?.workout).length;
  $('#insightCalories').textContent=nutritionDays.length?`${onTarget}/${nutritionDays.length}`:'—';
  $('#insightProtein').textContent=nutritionDays.length?`${proteinDays}/${nutritionDays.length}`:'—';
  $('#insightTraining').textContent=`${trainingDays}/${S.weekGoal}`;
  if(nutritionDays.length){
    const average=Math.round(nutritionDays.reduce((total,k)=>total+eaten(k).kcal,0)/nutritionDays.length);
    const difference=average-S.goals.k;
    const calorieText=difference===0?'right on your calorie goal':`${num(Math.abs(difference))} kcal ${difference>0?'above':'below'} your calorie goal`;
    $('#insightSummary').textContent=`Your average was ${num(average)} kcal across ${nutritionDays.length} logged ${nutritionDays.length===1?'day':'days'} — ${calorieText}. You reached your protein goal on ${proteinDays} ${proteinDays===1?'day':'days'} and logged ${trainingDays} ${trainingDays===1?'workout':'workouts'}.`;
  }else{
    $('#insightSummary').textContent=`Log nutrition to see calorie and protein trends. You logged ${trainingDays} ${trainingDays===1?'workout':'workouts'} so far this week.`;
  }
  renderStepsCalendar();
}

const RECAP_TYPES=['weekly','monthly','yearly'];
const RECAP_NOTIFICATION_IDS={weekly:701000,monthly:701001,yearly:701002};
let automaticRecapQueue=[];
let activeRecap=null;
let recapSlideIndex=0;
let recapNotificationSyncTimer=null;
function recapPeriod(kind,now=new Date()){
  const todayDate=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
  let start,end,key,title,kicker,heroLabel;
  if(kind==='weekly'){
    const weekdayOffset=(todayDate.getDay()+6)%7;
    start=new Date(todayDate); start.setDate(todayDate.getDate()-weekdayOffset-7);
    end=new Date(start); end.setDate(start.getDate()+6);
    key=dkey(start);
    title='Your week, replayed';
    kicker='YOUR WEEKLY RECAP';
    heroLabel='days you showed up';
  }else if(kind==='monthly'){
    start=new Date(todayDate.getFullYear(),todayDate.getMonth()-1,1,12);
    end=new Date(todayDate.getFullYear(),todayDate.getMonth(),0,12);
    key=`${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}`;
    title='Your month in motion';
    kicker='YOUR MONTHLY RECAP';
    heroLabel='days you showed up';
  }else if(kind==='yearly'){
    const year=todayDate.getFullYear()-1;
    start=new Date(year,0,1,12);
    end=new Date(year,11,31,12);
    key=String(year);
    title=`Your ${year} in motion`;
    kicker='YOUR YEARLY RECAP';
    heroLabel='days you showed up';
  }else{
    throw new Error(`Unknown recap period: ${kind}`);
  }
  const dateLabel=date=>date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const range=kind==='yearly'?String(start.getFullYear()):`${dateLabel(start)} – ${dateLabel(end)}`;
  return {kind,key,id:`${kind}:${key}`,start:dkey(start),end:dkey(end),title,kicker,heroLabel,range};
}
function recapSummary(period){
  const days=Object.entries(S.days).filter(([key])=>key>=period.start&&key<=period.end);
  const activeKeys=new Set();
  const meals=[];
  const mealCounts=new Map();
  const workoutCounts=new Map();
  let calories=0,protein=0,carbs=0,fat=0,mealDays=0,workouts=0,workoutMinutes=0,steps=0,stepDays=0,water=0,waterDays=0,proteinGoalDays=0;
  for(const [key,day] of days){
    const dayMeals=Array.isArray(day.meals)?day.meals:[];
    if(dayMeals.length){
      mealDays++;
      activeKeys.add(key);
      for(const meal of dayMeals){
        meals.push(meal);
        calories+=Number(meal.kcal)||0;
        protein+=Number(meal.protein)||0;
        carbs+=Number(meal.carbs)||0;
        fat+=Number(meal.fat)||0;
        const name=String(meal.name||'Meal').trim();
        const mealKey=name.toLocaleLowerCase();
        const previous=mealCounts.get(mealKey)||{name,count:0};
        mealCounts.set(mealKey,{name:previous.name,count:previous.count+1});
      }
      if(dayMeals.reduce((total,meal)=>total+(Number(meal.protein)||0),0)>=S.goals.p*.9) proteinGoalDays++;
    }
    if(day.workout){
      activeKeys.add(key);
      workouts++;
      workoutMinutes+=Math.max(0,Number(day.workout.min)||0);
      const type=String(day.workout.type||'Workout');
      workoutCounts.set(type,(workoutCounts.get(type)||0)+1);
    }
    const daySteps=Math.max(0,Number(day.steps)||0);
    steps+=daySteps;
    if(daySteps>0){ activeKeys.add(key); stepDays++; }
    water+=Math.max(0,Number(day.water)||0);
    if(Number(day.water)>0){ activeKeys.add(key); waterDays++; }
  }
  const weighIns=S.weights.filter(entry=>entry&&entry.k>=period.start&&entry.k<=period.end&&Number.isFinite(Number(entry.w)))
    .sort((a,b)=>a.k.localeCompare(b.k));
  weighIns.forEach(entry=>activeKeys.add(entry.k));
  const topMeals=[...mealCounts.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)).slice(0,3);
  const topWorkouts=[...workoutCounts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)).slice(0,3);
  const activeDays=activeKeys.size;
  const avgCalories=mealDays?Math.round(calories/mealDays):0;
  const leadMeal=topMeals[0];
  const leadWorkout=topWorkouts[0];
  let highlightTitle='You made room for your routine';
  let highlightText=`You logged activity on ${activeDays} ${activeDays===1?'day':'days'} this period. Every entry gives you a clearer picture of your habits.`;
  if(leadMeal){
    highlightTitle=leadMeal.count>1?`${leadMeal.name} was a repeat favorite`:`${leadMeal.name} made your recap`;
    highlightText=`You logged it ${leadMeal.count} ${leadMeal.count===1?'time':'times'}${leadWorkout?`, and ${leadWorkout.name} led your training with ${leadWorkout.count} ${leadWorkout.count===1?'session':'sessions'}`:''}.`;
  }else if(leadWorkout){
    highlightTitle=`${leadWorkout.name} led your training`;
    highlightText=`That split showed up ${leadWorkout.count} ${leadWorkout.count===1?'time':'times'} across ${workoutMinutes} training minutes.`;
  }else if(steps>0){
    highlightTitle='You kept moving';
    highlightText=`You recorded ${num(steps)} steps across the period.`;
  }
  if(mealDays&&proteinGoalDays){
    highlightText+=` You reached your protein target on ${proteinGoalDays} ${proteinGoalDays===1?'logged day':'logged days'}.`;
  }
  return {activeDays,mealCount:meals.length,mealDays,calories,avgCalories,protein,carbs,fat,proteinGoalDays,
    workouts,workoutMinutes,steps,stepDays,water,waterDays,weighIns,topMeals,topWorkouts,leadMeal,leadWorkout,
    highlightTitle,highlightText,hasActivity:activeKeys.size>0};
}
function recapCandidate(kind,now=new Date()){
  const period=recapPeriod(kind,now);
  return {...period,...recapSummary(period)};
}
function nextRecapBoundary(kind,now=new Date()){
  const date=new Date(now.getFullYear(),now.getMonth(),now.getDate(),9);
  if(kind==='weekly'){
    const daysUntilMonday=(8-date.getDay())%7||7;
    date.setDate(date.getDate()+daysUntilMonday);
  }else if(kind==='monthly'){
    date.setFullYear(date.getFullYear(),date.getMonth()+1,1);
  }else if(kind==='yearly'){
    date.setFullYear(date.getFullYear()+1,0,1);
  }else{
    throw new Error(`Unknown recap period: ${kind}`);
  }
  date.setHours(9,0,0,0);
  return date;
}
function recapNotificationCopy(report,upcoming=false){
  const details=upcoming
    ? 'Your meals, movement, and little wins will be ready to replay.'
    : report.kind==='weekly'
      ? `${num(report.workouts)} workouts, ${num(report.steps)} steps, ${num(report.mealCount)} meals. Your week has a story — tap to replay it.`
      : report.kind==='monthly'
        ? `${num(report.mealCount)} meals and ${num(report.workouts)} workouts made this month yours. Tap for the highlights.`
        : `A year of meals, movement, and milestones is ready to replay. See your ${report.key} story.`;
  const title=report.kind==='weekly'?'Your weekly wrap is ready'
    :report.kind==='monthly'?'Your monthly wrap is ready'
      :`Your ${report.key} year wrap is ready`;
  const taglines={
    weekly:'Seven days. Your kind of momentum.',
    monthly:'One month, a hundred little wins.',
    yearly:'A whole year, made of the days you showed up.'
  };
  return {title,body:`${taglines[report.kind]} ${details}`};
}
function recapNotificationForPeriod(kind,now=new Date()){
  const boundary=nextRecapBoundary(kind,now);
  const period=recapPeriod(kind,boundary);
  const report={...period,...recapSummary(period)};
  return {report,boundary,upcoming:true};
}
function syncRecapNotifications(){
  if(!LocalNotifications) return Promise.resolve();
  return (async()=>{
    const [pendingResult,deliveredResult]=await Promise.all([
      LocalNotifications.getPending(),
      LocalNotifications.getDeliveredNotifications()
    ]);
    const isRecapNotification=notification=>
      Object.values(RECAP_NOTIFICATION_IDS).includes(notification.id);
    const pending=pendingResult.notifications.filter(isRecapNotification);
    const delivered=deliveredResult.notifications.filter(isRecapNotification);
    const existing=[...delivered,...pending];
    const existingById=new Map(existing.map(notification=>[notification.id,notification]));
    const planned=[];
    const dueReports=[];
    for(const kind of RECAP_TYPES){
      const due=recapCandidate(kind);
      if(due.hasActivity&&!S.reportSeen.includes(due.id)&&
        (!S.reportNotified.includes(due.id)||existingById.get(RECAP_NOTIFICATION_IDS[kind])?.extra?.recapId===due.id)){
        dueReports.push(due);
        const existingDue=existingById.get(RECAP_NOTIFICATION_IDS[kind]);
        planned.push(existingDue?.extra?.recapId===due.id?existingDue:{
          id:RECAP_NOTIFICATION_IDS[kind],...recapNotificationCopy(due),
          channelId:'cal-recaps',extra:{recapId:due.id,kind},
          schedule:{at:new Date(Date.now()+5000)}
        });
        continue;
      }
      const next=recapNotificationForPeriod(kind);
      if(next.report.hasActivity&&!S.reportSeen.includes(next.report.id)){
        const existingNext=existingById.get(RECAP_NOTIFICATION_IDS[kind]);
        planned.push(existingNext?.extra?.recapId===next.report.id?existingNext:{
          id:RECAP_NOTIFICATION_IDS[kind],...recapNotificationCopy(next.report,true),
          channelId:'cal-recaps',extra:{recapId:next.report.id,kind},
          schedule:{at:next.boundary}
        });
      }
    }
    const isStale=notification=>!planned.some(item=>item.id===notification.id&&
      item.extra?.recapId===notification.extra?.recapId);
    const stalePending=pending.filter(isStale);
    const staleDelivered=delivered.filter(isStale);
    if(stalePending.length) await LocalNotifications.cancel({notifications:stalePending.map(notification=>({id:notification.id}))});
    if(staleDelivered.length) await LocalNotifications.removeDeliveredNotifications({notifications:staleDelivered});
    const toSchedule=planned.filter(notification=>!existingById.has(notification.id)||
      existingById.get(notification.id)?.extra?.recapId!==notification.extra?.recapId);
    if(toSchedule.length){
      let permission=await LocalNotifications.checkPermissions();
      if(permission.display!=='granted'&&!S.recapNotificationPermissionAsked){
        S.recapNotificationPermissionAsked=true;
        saveState();
        permission=await LocalNotifications.requestPermissions();
      }
      if(permission.display!=='granted') return;
      if(isAndroidApp()){
        await LocalNotifications.createChannel({
          id:'cal-recaps',name:'MyCal recaps',description:'Weekly, monthly, and yearly activity recaps',importance:4
        });
      }
      await LocalNotifications.schedule({notifications:toSchedule});
    }
    const newlyNotified=dueReports.filter(report=>!S.reportNotified.includes(report.id)&&
      planned.some(notification=>notification.extra?.recapId===report.id));
    if(newlyNotified.length){
      S.reportNotified=[...new Set([...S.reportNotified,...newlyNotified.map(report=>report.id)])].slice(-200);
      if(!saveState()) console.warn('Cal could not save which recap notifications were scheduled.');
    }
  })();
}
function queueRecapNotificationSync(){
  if(!LocalNotifications) return;
  clearTimeout(recapNotificationSyncTimer);
  recapNotificationSyncTimer=setTimeout(()=>{
    syncRecapNotifications().catch(error=>console.warn('Cal could not schedule recap notifications:',error));
  },500);
}
async function clearRecapNotification(recapId){
  if(!LocalNotifications) return;
  const [pending,delivered]=await Promise.all([
    LocalNotifications.getPending(),
    LocalNotifications.getDeliveredNotifications()
  ]);
  const pendingMatch=pending.notifications.filter(notification=>
    notification.extra?.recapId===recapId);
  if(pendingMatch.length) await LocalNotifications.cancel({notifications:pendingMatch.map(notification=>({id:notification.id}))});
  const deliveredMatch=delivered.notifications.filter(notification=>
    notification.extra?.recapId===recapId);
  if(deliveredMatch.length) await LocalNotifications.removeDeliveredNotifications({notifications:deliveredMatch});
}
function periodForRecapId(recapId){
  const match=/^(weekly|monthly|yearly):(.+)$/.exec(String(recapId||''));
  if(!match) return null;
  const [,kind,key]=match;
  let boundary;
  if(kind==='weekly'&&/^\d{4}-\d{2}-\d{2}$/.test(key)){
    const start=new Date(`${key}T12:00:00`);
    if(!Number.isFinite(start.getTime())) return null;
    boundary=new Date(start); boundary.setDate(boundary.getDate()+7);
  }else if(kind==='monthly'&&/^\d{4}-\d{2}$/.test(key)){
    const [year,month]=key.split('-').map(Number);
    if(month<1||month>12) return null;
    boundary=new Date(year,month,1,12);
  }else if(kind==='yearly'&&/^\d{4}$/.test(key)){
    boundary=new Date(Number(key)+1,0,1,12);
  }else{
    return null;
  }
  const period=recapPeriod(kind,boundary);
  return period.id===recapId?period:null;
}
function renderRecapLaunchers(){
  for(const kind of RECAP_TYPES){
    const button=$(`#open${kind[0].toUpperCase()+kind.slice(1)}Recap`);
    if(!button) continue;
    const report=recapCandidate(kind);
    button.disabled=!report.hasActivity;
    button.title=report.hasActivity?`Open ${report.range}`:'No logs in the latest completed period yet';
  }
}
function recapRanking(items,unit='logs'){
  return items.length?`<div class="recap-ranking">${items.map((item,index)=>`<div class="recap-rank"><span class="rank">${String(index+1).padStart(2,'0')}</span><span class="name">${esc(item.name)}</span><span class="count">${num(item.count)} ${item.count===1?unit.replace(/s$/,''):unit}</span></div>`).join('')}</div>`:
    '<div class="recap-empty">Nothing logged here yet. This card will fill in as you track your routine.</div>';
}
function recapSlide(report,index){
  const calorieText=report.mealDays?num(report.avgCalories):'—';
  const proteinPerMealDay=report.mealDays?Math.round(report.protein/report.mealDays):0;
  const waterLitres=(report.water*.25).toFixed(1);
  const weightChange=report.weighIns.length>1?Number(report.weighIns[report.weighIns.length-1].w)-Number(report.weighIns[0].w):null;
  const slideData=[
    {
      theme:'cover',
      kicker:report.kicker,
      title:report.title,
      subtitle:report.range,
      value:num(report.activeDays),
      label:'days you showed up',
      note:report.highlightText
    },
    {
      theme:'meals',
      kicker:'YOUR FOOD STORY',
      title:report.leadMeal&&report.leadMeal.count>1?`${report.leadMeal.name}, on repeat`:'Every meal tells a story',
      subtitle:`${num(report.mealCount)} meals across ${num(report.mealDays)} logged ${report.mealDays===1?'day':'days'}. Your intake is shown separately from activity.`,
      value:num(report.mealCount),
      label:'meals logged',
      stats:[[calorieText,'average kcal per logged day'],[`${num(Math.round(report.protein))} g`,'protein from logged meals']],
      section:'YOUR MOST LOGGED MEALS',
      content:recapRanking(report.topMeals)
    },
    {
      theme:'workouts',
      kicker:'YOUR TRAINING STORY',
      title:report.leadWorkout?`${report.leadWorkout.name} showed up`:'Your training, your pace',
      subtitle:`${num(report.workouts)} ${report.workouts===1?'session':'sessions'} added up to ${num(report.workoutMinutes)} minutes of training.`,
      value:num(report.workouts),
      label:'workout sessions',
      stats:[[num(report.workoutMinutes),'training minutes'],[report.workouts?`${num(Math.round(report.workoutMinutes/report.workouts))} min`:'—','average session']],
      section:'YOUR TRAINING MIX',
      content:recapRanking(report.topWorkouts,'sessions')
    },
    {
      theme:'steps',
      kicker:'YOUR MOVEMENT STORY',
      title:report.steps>=100000?'You covered serious ground':report.steps>0?'Small steps, real momentum':'Movement, at your pace',
      subtitle:`${num(report.steps)} steps recorded on ${num(report.stepDays)} ${report.stepDays===1?'day':'days'} in this period.`,
      value:num(report.steps),
      label:'steps recorded',
      stats:[[num(report.stepDays),'days with steps'],[report.stepDays?num(Math.round(report.steps/report.stepDays)):'—','average steps per logged day']],
      section:'A LITTLE PERSPECTIVE',
      content:`<div class="recap-note">${report.stepDays?`You logged steps on ${num(report.stepDays)} ${report.stepDays===1?'day':'days'}. Keep moving in a way that feels right for you.`:'No steps were recorded in this period. Your movement recap starts whenever you log them.'}</div>`
    },
    {
      theme:'macros',
      kicker:'YOUR NUTRITION MIX',
      title:'The macros behind your meals',
      subtitle:`Across ${num(report.mealCount)} logged meals. Daily averages below use logged meal days only.`,
      value:`${num(Math.round(proteinPerMealDay))} g`,
      label:'average protein per logged day',
      stats:[[report.mealDays?`${num(Math.round(report.carbs/report.mealDays))} g`:'—','average carbs per logged day'],[report.mealDays?`${num(Math.round(report.fat/report.mealDays))} g`:'—','average fat per logged day']],
      section:'TOTAL MACROS LOGGED',
      content:`<div class="recap-macro-grid"><div class="recap-macro protein"><div class="value">${num(Math.round(report.protein))} g</div><div class="label">Protein</div></div><div class="recap-macro carbs"><div class="value">${num(Math.round(report.carbs))} g</div><div class="label">Carbs</div></div><div class="recap-macro fat"><div class="value">${num(Math.round(report.fat))} g</div><div class="label">Fat</div></div></div><div class="recap-note">Protein target reached on ${num(report.proteinGoalDays)} ${report.proteinGoalDays===1?'logged day':'logged days'}. Nutrition values are estimates.</div>`
    },
    {
      theme:'habits',
      kicker:'YOUR EVERYDAY RHYTHM',
      title:'The little things add up',
      subtitle:report.highlightText,
      value:num(report.water),
      label:`glasses of water · ${waterLitres} L`,
      stats:[[num(report.waterDays),'days with water logged'],[num(report.weighIns.length),'weight check-ins']],
      section:'ONE MORE HIGHLIGHT',
      content:`<div class="recap-note">${weightChange===null?'Every check-in helps build your personal picture over time.':`Your logged weight changed ${weightChange>0?'+':''}${weightChange.toFixed(1)} kg between the first and last check-in. Weight naturally fluctuates; this is just a record of your entries.`}</div>`
    }
  ];
  const data=slideData[index];
  const stats=data.stats?.length?`<div class="recap-stat-grid">${data.stats.map(([value,label])=>`<div class="recap-stat"><div class="value">${esc(value)}</div><div class="label">${esc(label)}</div></div>`).join('')}</div>`:'';
  const detail=data.content?`<div class="recap-slide-section"><div class="recap-slide-section-title">${esc(data.section)}</div>${data.content}</div>`:'';
  const note=data.note?`<div class="recap-note">${esc(data.note)}</div>`:'';
  return `<article class="recap-slide ${data.theme}"><div><div class="recap-slide-kicker">${esc(data.kicker)}</div><h2 id="recapSlideTitle">${esc(data.title)}</h2><p class="recap-slide-sub">${esc(data.subtitle)}</p><div class="recap-big-stat"><strong>${esc(data.value)}</strong><span>${esc(data.label)}</span></div>${stats}${detail}</div>${note}</article>`;
}
function renderRecapSlide(){
  if(!activeRecap) return;
  const total=6;
  $('#recapStory').innerHTML=recapSlide(activeRecap,recapSlideIndex);
  $('#recapProgress').innerHTML=Array.from({length:total},(_,index)=>`<span class="${index<=recapSlideIndex?'done':''}"></span>`).join('');
  $('#recapPageDots').innerHTML=Array.from({length:total},(_,index)=>`<span class="${index===recapSlideIndex?'on':''}"></span>`).join('');
  $('#recapPageCount').textContent=`${recapSlideIndex+1} of ${total}`;
  $('#recapPrevious').disabled=recapSlideIndex===0;
  $('#recapNext').textContent=recapSlideIndex===total-1?'Finish':'Next';
  $('#recapStory').scrollTop=0;
}
function moveRecap(direction){
  if(!activeRecap) return;
  const next=recapSlideIndex+direction;
  if(next<0) return;
  if(next>=6){ closeRecap(); return; }
  recapSlideIndex=next;
  renderRecapSlide();
}
function openRecap(report){
  activeRecap=report;
  recapSlideIndex=0;
  renderRecapSlide();
  $('#recapBackdrop').style.display='grid';
  $('#recapBackdrop').setAttribute('aria-hidden','false');
  $('#recapCloseTop').focus();
}
function showNextAutomaticRecap(){
  if(!automaticRecapQueue.length) return;
  if(['updateBackdrop','keyReminderBackdrop','waterGoalBackdrop','savedMealBackdrop','recapBackdrop'].some(id=>$('#'+id)?.style.display==='grid')){
    setTimeout(showNextAutomaticRecap,700);
    return;
  }
  const report=automaticRecapQueue.shift();
  if(report&&!S.reportSeen.includes(report.id)&&report.hasActivity) openRecap(report);
  else showNextAutomaticRecap();
}
function closeRecap(){
  if(!activeRecap) return;
  const recapId=activeRecap.id;
  const wasSeen=S.reportSeen.includes(activeRecap.id);
  if(!wasSeen){
    S.reportSeen=[...S.reportSeen,activeRecap.id].slice(-200);
    if(!saveState()) toast('Recap closed, but its viewed status could not be saved.');
  }
  activeRecap=null;
  $('#recapBackdrop').style.display='none';
  $('#recapBackdrop').setAttribute('aria-hidden','true');
  clearRecapNotification(recapId).catch(error=>console.warn('Cal could not clear a viewed recap notification:',error));
  queueRecapNotificationSync();
  setTimeout(showNextAutomaticRecap,250);
}
function scheduleAutomaticRecaps(){
  automaticRecapQueue=['yearly','monthly','weekly'].map(kind=>recapCandidate(kind))
    .filter(report=>report.hasActivity&&!S.reportSeen.includes(report.id));
  if(automaticRecapQueue.length) setTimeout(showNextAutomaticRecap,1000);
}
function openLatestRecap(kind){
  const report=recapCandidate(kind);
  if(!report.hasActivity){
    toast('No logs in the latest completed period yet.');
    return;
  }
  openRecap(report);
}
function openRecapById(recapId){
  const period=periodForRecapId(recapId);
  if(!period) return;
  if(activeRecap?.id===recapId) return;
  const report={...period,...recapSummary(period)};
  if(report.hasActivity) openRecap(report);
}
function registerRecapNotificationActions(){
  if(!LocalNotifications) return;
  LocalNotifications.addListener('localNotificationActionPerformed',action=>{
    const recapId=action.notification.extra?.recapId;
    if(typeof recapId==='string') openRecapById(recapId);
  }).catch(error=>console.warn('Cal could not register recap notification actions:',error));
}
$('#recapPrevious').onclick=()=>moveRecap(-1);
$('#recapNext').onclick=()=>moveRecap(1);
$('#recapCloseTop').onclick=closeRecap;
$('#recapBackdrop').onclick=event=>{if(event.target===$('#recapBackdrop')) closeRecap();};
$('#openWeeklyRecap').onclick=()=>openLatestRecap('weekly');
$('#openMonthlyRecap').onclick=()=>openLatestRecap('monthly');
$('#openYearlyRecap').onclick=()=>openLatestRecap('yearly');
document.addEventListener('keydown',event=>{
  if($('#recapBackdrop').style.display!=='grid') return;
  if(event.key==='Escape') closeRecap();
  else if(event.key==='ArrowRight') moveRecap(1);
  else if(event.key==='ArrowLeft') moveRecap(-1);
});
let recapPointerStart=null;
$('#recapStory').addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse') return;
  recapPointerStart={x:event.clientX,y:event.clientY};
});
$('#recapStory').addEventListener('pointerup',event=>{
  if(!recapPointerStart) return;
  const deltaX=event.clientX-recapPointerStart.x;
  const deltaY=event.clientY-recapPointerStart.y;
  recapPointerStart=null;
  if(Math.abs(deltaX)>55&&Math.abs(deltaX)>Math.abs(deltaY)*1.3) moveRecap(deltaX<0?1:-1);
});

/* ============================================================================
   COACH — data-grounded reasoning
   ============================================================================ */
function renderCoach(){
  const k=TODAY(), d=today(), t=eaten(k), g=S.goals;
  const remain = Math.max(0,Math.round(g.k-t.kcal));
  const pLeft = Math.max(0, g.p - t.protein);
  const wk = weekKeys(0);
  const sessions = wk.filter(x=>S.days[x]&&S.days[x].workout).length;
  const mealNames = d.meals.map(m=>m.name).filter(Boolean);
  let trainLine = d.workout
    ? `You logged a <b>${d.workout.type}</b> session for ${d.workout.min} minutes. Next in the rotation is <b>${nextWorkoutType(d.workout.type)}</b>.`
    : `No session logged yet today. Based on your history, <b>${suggestNext()}</b> is next in the rotation.`;

  const caloriePct=Math.min(100,Math.round(t.kcal/Math.max(g.k,1)*100));
  const proteinPct=Math.min(100,Math.round(t.protein/Math.max(g.p,1)*100));
  const trainingPct=Math.min(100,Math.round(sessions/Math.max(S.weekGoal,1)*100));
  $('#coachDate').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();
  $('#coachGreeting').textContent=t.kcal===0?'Let’s set your day up well':remain>0?'You’re building a solid day':'A steady finish beats a perfect day';
  $('#coachMetrics').innerHTML=`
    <div class="coach-metric calories"><div class="value">${num(Math.max(0,remain))}</div><div class="label">kcal remaining</div><div class="coach-progress"><span style="width:${caloriePct}%"></span></div></div>
    <div class="coach-metric protein"><div class="value">${Math.round(t.protein)}<small style="font-size:11px;color:var(--t2)"> / ${g.p}g</small></div><div class="label">protein</div><div class="coach-progress"><span style="width:${proteinPct}%"></span></div></div>
    <div class="coach-metric training"><div class="value">${sessions}<small style="font-size:11px;color:var(--t2)"> / ${S.weekGoal}</small></div><div class="label">weekly sessions</div><div class="coach-progress"><span style="width:${trainingPct}%"></span></div></div>`;
  $('#briefing').innerHTML = `
    <b>${num(t.kcal)} kcal</b> logged toward your ${num(g.k)} kcal goal · <b>${Math.round(t.protein)}g protein</b> so far.<br>
    ${mealNames.length?`Meals logged: ${mealNames.map(esc).join(', ')}.`:'No meals logged yet. Add your first meal whenever you’re ready.'}
    <br>${trainLine}<br>
    Water: <b>${d.water}/8 glasses</b>.`;
  const focus=pLeft>0
    ? {icon:'',text:`Your next win: add about ${Math.round(pLeft)}g protein today. A protein-forward meal or snack can close the gap.`}
    : remain>150
      ? {icon:'',text:`You’re on track for protein. Use the remaining ${num(remain)} kcal for a satisfying meal with some vegetables.`}
      : {icon:'',text:'You’ve reached your calorie target for now. Keep your routine steady and check in again tomorrow.'};
  $('#coachFocus').innerHTML=`<span class="icon">${focus.icon}</span><div class="text"><b>Suggested next step</b><br>${focus.text}</div>`;
  $('#coachWeekSessions').textContent=`${sessions}/${S.weekGoal} sessions`;

  // 7-day bars
  const days = Array.from({length:7},(_,i)=>{ const x=new Date(); x.setDate(x.getDate()-(6-i)); return dkey(x); });
  const max = Math.max(...days.map(x=>eaten(x).kcal), g.k, 1);
  $('#bars').innerHTML = days.map(x=>{
    const v = eaten(x).kcal, w = S.days[x] && S.days[x].workout;
    return `<div class="b">
      <div class="bv">${v?Math.round(v):''}</div>
      <div class="bar ${w?'tr':''}" style="height:${Math.max(3, v/max*100)}%"></div>
      <div class="bl ${w?'tr':''}">${new Date(x+'T12:00:00').toLocaleDateString('en-US',{weekday:'narrow'})}</div>
    </div>`;
  }).join('');

  // insights
  const ins = [];
  const pPct = t.protein/g.p*100, kPct = t.kcal/g.k*100;
  ins.push([pPct>=90?'On':pPct>=60?'Low':'Low', pPct>=90?'Protein on target':pPct>=60?'Protein lagging':'Protein critical',
    `${Math.round(t.protein)}g of ${g.p}g (${Math.round(pPct)}%).` + (pPct<90?` Add about ${Math.ceil(pLeft/25)} protein servings.`:'')]);
  ins.push([kPct>110?'Over':kPct>=65?'On':'Low', kPct>110?'Over target':kPct>=65?'Calories balanced':'Under-eating',
    `${num(t.kcal)} kcal vs ${num(g.k)}. ${kPct>110?`${num(t.kcal-g.k)} over.`:`${num(Math.max(0,remain))} still available.`}`]);
  ins.push([sessions>=S.weekGoal?'On':'·', `${sessions}/${S.weekGoal} sessions`,
    sessions>=S.weekGoal?'Weekly training goal met.':`${S.weekGoal-sessions} to go.`]);
  // calorie density insight
  const meals = d.meals;
  if(meals.length){
    const densest = meals.slice().sort((a,b)=>b.kcal/Math.max(b.protein,1)-a.kcal/Math.max(a.protein,1))[0];
    ins.push(['Info','Densest item', `${esc(densest.name)} — ${num(densest.kcal)} kcal for ${Math.round(densest.protein)}g protein.`]);
  }
  $('#insights').innerHTML = ins.map(([ic,title,sub])=>`
    <div class="row" style="align-items:flex-start;padding:12px 0">
      <div class="aw" style="background:var(--surf2);width:34px;height:34px;border-radius:10px;font-size:14px">${ic}</div>
      <div class="main"><div class="nm" style="font-size:15px">${title}</div><div class="ms" style="white-space:normal">${sub}</div></div>
    </div>`).join('');

  // report card
  const daysLogged = wk.filter(x=>S.days[x]&&S.days[x].meals.length).length;
  const protDays = wk.filter(x=>S.days[x] && eaten(x).protein>=g.p*0.9).length;
  const score = Math.round(((sessions/Math.max(S.weekGoal,1))*40 + (daysLogged/7)*35 + (protDays/7)*25));
  $('#rcScore').textContent = score+' / 100';
  $('#reportCard').innerHTML = [
    ['Training consistency', `${sessions} / ${S.weekGoal} sessions`],
    ['Days logged', `${daysLogged} / 7`],
    ['Protein target days', `${protDays} / 7`],
    ['Split balance', splitBalance()],
    ['Grade', score>=85?'A — excellent':score>=70?'B — solid':score>=50?'C — inconsistent':'D — needs work']
  ].map(([k,v])=>`<div class="lic"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');

  renderRecapLaunchers();
  renderWeight();
}
function splitBalance(){
  const wk = weekKeys(0), c=Object.fromEntries(WORKOUT_TYPES.map(type=>[type,0]));
  wk.forEach(k=>{ const w=S.days[k]&&S.days[k].workout; if(w && WORKOUT_TYPES.includes(w.type)) c[w.type]++; });
  const vals=Object.values(c), max=Math.max(...vals), min=Math.min(...vals);
  if(max===0) return 'no data';
  return (max-min<=1) ? 'balanced' : `skewed (${c.Push}P/${c.Pull}U/${c.Legs}L/${c['Upper Body']}UB/${c['Lower Body']}LB)`;
}
function getWeightEntries(){
  const byDate=new Map();
  S.weights.forEach(entry=>{ if(entry&&entry.k&&Number.isFinite(Number(entry.w))) byDate.set(entry.k,{...entry,w:Number(entry.w)}); });
  return [...byDate.values()].sort((a,b)=>a.k.localeCompare(b.k));
}
function renderWeight(){
  const currentWeek = weekKeys(0);
  const loggedThisWeek = S.weights.some(x=>currentWeek.includes(x.k));
  const reminderDay=WEEKDAY_NAMES[S.weightReminder.weekday-1]||'Sunday';
  const isReminderDay = new Date().getDay()+1===S.weightReminder.weekday;
  const due = $('#weightDue');
  if(due){
    due.innerHTML = loggedThisWeek ? '<b>Weekly check complete.</b> Your weight is logged for this week.'
      : isReminderDay ? `<b>${reminderDay} check-in.</b> Log your weight today to update your weekly trend.`
      : `<b>Next check-in: ${reminderDay}.</b> Log weekly to keep your trend accurate.`;
    due.style.color = loggedThisWeek ? 'var(--ok)' : 'var(--warn)';
  }
  const allWeights=getWeightEntries();
  const w=allWeights.slice(-7);
  const latest=allWeights[allWeights.length-1];
  const previous=allWeights[allWeights.length-2];
  const currentWeight=latest?.w??S.weight;
  const toTarget=currentWeight-S.targetWeight;
  $('#weekWeightChange').textContent=latest&&previous
    ? `${latest.w-previous.w>=0?'+':''}${(latest.w-previous.w).toFixed(1)} kg`
    : 'Log again to compare';
  $('#weekWeightToTarget').textContent=toTarget===0?'At target':`${Math.abs(toTarget).toFixed(1)} kg ${toTarget>0?'above':'below'} target`;
  if(!w.length){
    $('#wtChart').innerHTML = `<p class="meta" style="font-size:12px">Log your weight to see your trend.</p>`;
    return;
  }
  const vals = w.map(x=>x.w), min = Math.min(...vals)-0.5, max = Math.max(...vals)+0.5;
  const chartW = 300, chartH = 80;
  const xFor=i=>20+(i/Math.max(w.length-1,1))*(chartW-40);
  const yFor=x=>64-((x.w-min)/Math.max(max-min,.1))*42;
  const points = w.map((x,i)=>`${xFor(i)},${yFor(x)}`).join(' ');
  const dateLabel=k=>new Date(k+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
  const fullDate=k=>new Date(k+'T12:00:00').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  $('#wtChart').innerHTML = `
    <svg viewBox="0 0 ${chartW} ${chartH}" role="img" aria-label="Weight trend graph">
      <polyline points="${points}" fill="none" stroke="var(--p)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${w.map((x,i)=>`<circle cx="${xFor(i)}" cy="${yFor(x)}" r="3.5" fill="var(--t1)"><title>${fullDate(x.k)}: ${x.w.toFixed(1)} kg</title></circle><text x="${xFor(i)}" y="${yFor(x)-8}" text-anchor="middle" fill="var(--t2)" font-size="9">${x.w.toFixed(1)}</text>`).join('')}
    </svg>
    <div class="weight-dates" aria-hidden="true">
      ${w.map(x=>`<span class="weight-date" title="${fullDate(x.k)}">${dateLabel(x.k)}</span>`).join('')}
    </div>`;
}
function logWeightValue(value){
  const v = parseFloat(value);
  if(!v || v<25 || v>300){ toast('Enter a valid weight'); return; }
  const todayEntries=S.weights.filter(entry=>entry.k===TODAY());
  if(todayEntries.length) S.weights.forEach(entry=>{ if(entry.k===TODAY()) entry.w=v; });
  else S.weights.push({k:TODAY(), w:v});
  if(S.weights.length>60) S.weights.shift();
  S.weight = v; $('#homeWeightInput').value=''; $('#setW').value = v; $('#bodyW').value = v;
  renderAll(); toast('Weight logged');
}
$('#homeWeightLog').onclick=()=>logWeightValue($('#homeWeightInput').value);

let quickMeals = [];
function renderLibrary(){
  $('#savedCount').textContent = S.saved.length ? S.saved.length+' saved' : '';
  $('#savedList').innerHTML = S.saved.length ? S.saved.map((m,i)=>`
    <div class="row saved-meal-row">
      <div class="aw" aria-hidden="true"></div>
      <div class="main"><div class="nm" style="font-size:15px">${esc(m.name)}</div>
        <div class="macmini"><span class="p">P ${Math.round(m.protein)}g</span> · <span class="c">C ${Math.round(m.carbs)}g</span> · <span class="f">F ${Math.round(m.fat)}g</span></div>
        <div class="meal-meta">Base portion: ${Number(m.servingAmount)||1} ${esc(m.servingUnit||'serving')}</div></div>
      <div class="rt"><div class="v" style="font-size:16px">${num(m.kcal)}</div><div class="u">kcal</div></div>
      <div class="saved-meal-actions">
        <label class="sr-only" for="savedAmount${i}">Portion amount to log</label>
        <input class="saved-portion" id="savedAmount${i}" type="number" min="0.1" step="${m.servingUnit==='piece'?'1':'0.1'}" value="${Number(m.servingAmount)||1}" aria-label="Portion amount to log for ${esc(m.name)}">
        <span class="saved-unit">${esc(m.servingUnit||'serving')}</span>
        <button class="btn sm" onclick="relog(${i})">Log</button>
      </div>
      <button class="btn sm ghost" onclick="editSavedMeal(${i})" aria-label="Edit ${esc(m.name)}">Edit</button>
      <button class="btn sm ghost" onclick="unsave(${i})" aria-label="Remove ${esc(m.name)}">Delete</button>
    </div>`).join('')
    : `<div class="empty"><div class="tx">Save any meal to add it here</div></div>`;

  // frequency across all logged days
  const freq = {};
  Object.values(S.days).forEach(d=>d.meals.forEach(m=>{
    const key = displayMealName(m.name);
    freq[key] = freq[key] || {n:key, count:0, kcal:m.kcal, p:m.protein, c:m.carbs, f:m.fat};
    freq[key].count++;
  }));
  quickMeals = Object.values(freq).sort((a,b)=>b.count-a.count).slice(0,6);
  $('#freqList').innerHTML = quickMeals.length ? quickMeals.map((m,i)=>{
    const saved = S.saved.some(x=>mealNameKey(x.name)===mealNameKey(m.n));
    return `
    <div class="row">
      <div class="aw" aria-hidden="true"></div>
      <div class="main"><div class="nm" style="font-size:15px">${esc(m.n)}</div>
        <div class="ms">logged ${m.count}× · ${num(m.kcal)} kcal</div></div>
      <button class="btn sm" title="Quick add" aria-label="Quick add ${esc(m.n)}" onclick="logQuickMeal(${i})">+</button>
      <button class="btn sm ghost" title="Save for later" aria-label="Save ${esc(m.n)}" onclick="saveQuickMeal(${i})" ${saved?'disabled':''}>${saved?'Saved':'Save'}</button>
    </div>`;
  }).join('') : `<div class="empty"><div class="tx">Log meals to build quick additions</div></div>`;
}
window.relog = i => {
  const m = S.saved[i];
  if(!m) return;
  const amount=Number($(`#savedAmount${i}`).value), baseAmount=Number(m.servingAmount)||1;
  if(!Number.isFinite(amount)||amount<=0||(m.servingUnit==='piece'&&!Number.isInteger(amount))){ toast('Enter a valid portion amount.'); return; }
  const factor=amount/baseAmount, unit=m.servingUnit||'serving';
  today().meals.push({
    name:m.name,kcal:Math.round(Number(m.kcal)*factor),
    protein:+(Number(m.protein||0)*factor).toFixed(1),carbs:+(Number(m.carbs||0)*factor).toFixed(1),fat:+(Number(m.fat||0)*factor).toFixed(1),
    img:null,type:m.type||'Snack',src:'saved',portion:`${amount} ${unit}`,servingAmount:amount,servingUnit:unit,
    at:new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})
  });
  renderAll(); toast(`Logged ${m.name}`);
};
window.relogItem = (n,k,p,c,f) => {
  today().meals.push({name:n, kcal:k, protein:p, carbs:c, fat:f, img:null, type:'Snack', src:'saved',
    at:new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})});
  renderAll(); toast(`Logged ${n}`,'✓');
};
window.logQuickMeal = i => {
  const m = quickMeals[i];
  if(!m) return;
  today().meals.push({name:m.n, kcal:m.kcal, protein:m.p, carbs:m.c, fat:m.f, img:null, type:'Quick add', src:'saved',
    at:new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})});
  renderAll(); toast(`Logged ${m.n}`,'✓');
};
window.saveQuickMeal = i => {
  const m = quickMeals[i];
  if(!m || S.saved.some(x=>mealNameKey(x.name)===mealNameKey(m.n))) return;
  S.saved.push({name:m.n, kcal:m.kcal, protein:m.p, carbs:m.c, fat:m.f, type:'Quick add',servingAmount:1,servingUnit:'serving'});
  saveState(); renderLibrary(); toast('Saved for quick add');
};
window.unsave = i => { S.saved.splice(i,1); saveState(); renderLibrary(); toast('Removed'); };
let savedMealEditIndex=null;
window.editSavedMeal=i=>{
  const meal=S.saved[i];
  if(!meal) return;
  savedMealEditIndex=i;
  $('#savedMealName').value=meal.name||'';
  $('#savedMealAmount').value=Number(meal.servingAmount)||1;
  $('#savedMealUnit').value=meal.servingUnit||'serving';
  $('#savedMealAmount').step=meal.servingUnit==='piece'?'1':'0.1';
  $('#savedMealKcal').value=Number(meal.kcal)||0;
  $('#savedMealProtein').value=Number(meal.protein)||0;
  $('#savedMealCarbs').value=Number(meal.carbs)||0;
  $('#savedMealFat').value=Number(meal.fat)||0;
  $('#savedMealBackdrop').style.display='grid';
  $('#savedMealName').focus();
};
$('#savedMealUnit').onchange=()=>{
  $('#savedMealAmount').step=$('#savedMealUnit').value==='piece'?'1':'0.1';
};
function closeSavedMealDialog(){ $('#savedMealBackdrop').style.display='none'; }
$('#cancelSavedMeal').onclick=closeSavedMealDialog;
$('#saveSavedMeal').onclick=()=>{
  const meal=S.saved[savedMealEditIndex];
  if(!meal) return;
  const name=$('#savedMealName').value.trim(), servingAmount=Number($('#savedMealAmount').value);
  const kcal=Number($('#savedMealKcal').value), protein=Number($('#savedMealProtein').value);
  const carbs=Number($('#savedMealCarbs').value), fat=Number($('#savedMealFat').value);
  if(!name||!Number.isFinite(servingAmount)||servingAmount<=0||
     ![kcal,protein,carbs,fat].every(value=>Number.isFinite(value)&&value>=0)){
    toast('Enter a meal name, positive portion, and valid nutrition values.');
    return;
  }
  if(S.saved.some((item,index)=>index!==savedMealEditIndex&&mealNameKey(item.name)===mealNameKey(name))){
    toast('A saved meal with that name already exists.');
    return;
  }
  const servingUnit=$('#savedMealUnit').value;
  if(servingUnit==='piece'&&!Number.isInteger(servingAmount)){
    toast('Piece portions must be whole numbers.');
    return;
  }
  const previous={...meal};
  Object.assign(meal,{
    name,kcal:Math.round(kcal),protein:+protein.toFixed(1),carbs:+carbs.toFixed(1),fat:+fat.toFixed(1),
    servingAmount:servingUnit==='piece'?servingAmount:+servingAmount.toFixed(2),servingUnit
  });
  if(!saveState()){
    Object.assign(meal,previous);
    toast('Could not save this meal on the device.');
    return;
  }
  savedMealEditIndex=null;
  closeSavedMealDialog();
  renderLibrary();
  toast('Saved meal updated');
};
$('#saveCustomMeal').onclick = () => {
  const name = $('#customMealName').value.trim();
  const kcal = parseFloat($('#customMealK').value);
  const protein = parseFloat($('#customMealP').value) || 0;
  const carbs = parseFloat($('#customMealC').value) || 0;
  const fat = parseFloat($('#customMealF').value) || 0;
  if(!name || !Number.isFinite(kcal) || kcal < 0){ toast('Add a meal name and calories'); return; }
  if(S.saved.some(m=>mealNameKey(m.name)===mealNameKey(name))){ toast('That meal is already saved'); return; }
  S.saved.push({name, kcal:Math.round(kcal), protein, carbs, fat, type:'Custom',servingAmount:1,servingUnit:'serving'});
  ['customMealName','customMealK','customMealP','customMealC','customMealF'].forEach(id=>$('#'+id).value='');
  saveState(); renderLibrary(); toast('Custom meal saved','✓');
};

/* ============================================================================
   ASK
   ============================================================================ */
function answer(q){
  const s = q.toLowerCase(), k=TODAY(), d=today(), t=eaten(k), g=S.goals;
  const remain = Math.max(0,Math.round(g.k-t.kcal)), pLeft = Math.round(g.p-t.protein);
  if(/focus|priorit|next step|improve today/.test(s))
    return pLeft>0 ? `A useful next step is a meal with protein: you have <b>${pLeft}g</b> left toward your ${g.p}g goal. Keep it simple and choose something you enjoy.`
      : `Protein is on track. You have about <b>${num(Math.max(0,remain))} kcal</b> remaining; build your next meal around a satisfying protein and a fruit or vegetable.`;
  if(/recover|rest|sore|fatigue|tired/.test(s))
    return `${d.workout?`You logged ${d.workout.type} today, so give those muscles time before repeating that split. `:'Keep training at a pace that feels sustainable. '}Recovery basics: hydrate (${d.water}/8 glasses logged), get a balanced meal, and prioritize sleep.`;
  if(/calorie|kcal|left|remain/.test(s))
    return `You've eaten <b>${num(t.kcal)} kcal</b> toward your ${num(g.k)} kcal daily limit. You have <b>${num(remain)} kcal</b> remaining. Workouts and steps do not increase the limit.`;
  if(/protein/.test(s))
    return t.protein>=g.p ? `Protein is done — <b>${Math.round(t.protein)}g</b> against a ${g.p}g target.`
      : `You're at <b>${Math.round(t.protein)}g</b> of ${g.p}g. <b>${pLeft}g</b> to go: a whey scoop (~25g), 200g curd (~11g) or three eggs (~19g).`;
  if(/steps?|walk|walking/.test(s))
    return `You've logged <b>${num(Number(d.steps)||0)} steps</b> today. Steps are tracked separately and do not add calories to your daily limit.`;
  if(/train|workout|gym|lift/.test(s))
    return d.workout ? `You already trained <b>${d.workout.type}</b> for ${d.workout.min} min. ${d.workout.min<30?'That is a shorter session — build volume at a pace that feels sustainable.':'Good duration range.'}`
      : `Nothing logged today. <b>${suggestNext()}</b> is next in your rotation — 45–60 min is the sweet spot.`;
  if(/week|split|push|pull|legs|upper|lower|balance/.test(s)){
    const wk=weekKeys(0), c=Object.fromEntries(WORKOUT_TYPES.map(type=>[type,0]));
    wk.forEach(x=>{ const w=S.days[x]&&S.days[x].workout; if(w && WORKOUT_TYPES.includes(w.type)) c[w.type]++; });
    const total=Object.values(c).reduce((sum,count)=>sum+count,0);
    return `This week: <b>Push ${c.Push}</b>, <b>Pull ${c.Pull}</b>, <b>Legs ${c.Legs}</b>, <b>Upper body ${c['Upper Body']}</b>, <b>Lower body ${c['Lower Body']}</b> — balance reads <b>${splitBalance()}</b>. ${total} of ${S.weekGoal} sessions done.`;
  }
  if(/meal|food|eat|hungry|snack|idea|recipe/.test(s))
    return remain>300 ? `With <b>${num(remain)} kcal</b> left: grilled chicken with rice and veg (~520 kcal, 40g protein), or 2 rotis with dal and curd (~450 kcal, 18g protein).`
      : remain>80 ? `Only <b>${num(remain)} kcal</b> left. Go light and protein-heavy: Greek yogurt with almonds (~290 kcal, 26g protein), or boiled eggs with cucumber.`
      : `You're at or over target. If genuinely hungry, prioritise protein and fibre — curd, salad, eggs — and skip the carbs.`;
  if(/water|hydrat/.test(s))
    return `Water is at <b>${d.water}/8</b> glasses (${(d.water*.25).toFixed(2)} L). ${d.water<6?'Add two glasses over the next hour.':'On track.'}`;
  if(/weight|goal|target|lose|lean/.test(s)){
    const w = S.weights.length ? S.weights[S.weights.length-1].w : S.weight;
    const toGo = w - S.targetWeight;
    return `You're at <b>${w.toFixed(1)} kg</b> with a target of ${S.targetWeight} kg — <b>${Math.abs(toGo).toFixed(1)} kg</b> to go (${toGo>0?'cutting':'gaining'}). Your daily calorie limit is ${num(g.k)} kcal.`;
  }
  return `Today: <b>${num(t.kcal)} kcal</b> eaten, <b>${num(remain)} kcal</b> remaining, protein <b>${Math.round(t.protein)}g / ${g.p}g</b>${d.workout?`, ${d.workout.type} session of ${d.workout.min} min`:', no workout yet'}. Workouts and steps do not change the calorie limit. Ask about protein, calories, the split, meal ideas or your weight goal.`;
}
const MEAL_REMINDER_ID = 700000;
const WEIGHT_REMINDER_ID = 700004;
const MEAL_REMINDER_TYPES = ['Breakfast','Lunch','Dinner','Snack'];
const WEEKDAYS = {sunday:1,monday:2,tuesday:3,wednesday:4,thursday:5,friday:6,saturday:7};
const WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function parseReminderCommand(text){
  if(/\b(tomorrow|today|once|one[- ]time)\b/i.test(text)){
    return {error:'Cal can currently schedule repeating daily or weekly reminders. Try “every Sunday at 9 AM”.'};
  }
  const weekdayMatch=text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  const weekday=weekdayMatch?WEEKDAYS[weekdayMatch[1].toLowerCase()]:null;
  const weekly=/\b(weekly|every\s+week|each\s+week)\b/i.test(text)||weekday!==null;
  const timeMatch=text.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\bat\s+(\d{1,2})(?::(\d{2}))?\b/i);
  let hour=9,minute=0;
  if(timeMatch){
    hour=Number(timeMatch[1]||timeMatch[4]);
    minute=Number(timeMatch[2]||timeMatch[5]||0);
    if(timeMatch[3]){
      const meridiem=timeMatch[3].toLowerCase();
      if(hour<1||hour>12||minute>59) return {error:'Use a valid time, such as 9 AM or 14:30.'};
      hour=(hour%12)+(meridiem==='pm'?12:0);
    }else if(hour>23||minute>59) return {error:'Use a valid time, such as 9 AM or 14:30.'};
  }

  let title=text.trim()
    .replace(/^(?:please\s+)?(?:remind|notify)(?:\s+me)?(?:\s+to)?\s*/i,'')
    .replace(/^set\s+(?:a\s+)?reminder(?:\s+to)?\s*/i,'')
    .replace(/\b(?:every|each)\s+(?=(?:week|day|weekend|weekday|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b)/gi,' ')
    .replace(/\b(?:week|day|weekend|weekday)\b/gi,' ')
    .replace(/\b(?:weekly|daily)\b/gi,' ')
    .replace(/\b(?:on\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,' ')
    .replace(/\b(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi,' ')
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\b/gi,' ')
    .replace(/^\s*(?:for|to)\s+/i,'')
    .replace(/\s+/g,' ').trim();
  if(!title) return {error:'Tell Cal what to remind you about.'};
  return {title,weekday:weekly?(weekday||1):null,frequency:weekly?'weekly':'daily',hour,minute};
}

function reminderSchedule(reminder){
  const on={hour:reminder.hour,minute:reminder.minute};
  if(reminder.frequency==='weekly') on.weekday=reminder.weekday||1;
  return {on,allowWhileIdle:true};
}

async function ensureReminderPermission(){
  if(!LocalNotifications) throw new Error('Notification support is unavailable. Rebuild and sync the Android app, then try again.');
  let permission=await LocalNotifications.checkPermissions();
  if(permission.display!=='granted') permission=await LocalNotifications.requestPermissions();
  if(permission.display!=='granted') throw new Error('Allow notifications in your device settings to receive reminders.');
  if(isAndroidApp()){
    let exactAlarm=await LocalNotifications.checkExactNotificationSetting();
    if(exactAlarm.exact_alarm!=='granted'){
      exactAlarm=await LocalNotifications.changeExactNotificationSetting();
    }
    if(exactAlarm.exact_alarm!=='granted') throw new Error('Allow Alarms & reminders in Android settings to receive reminders at the selected time.');
    await LocalNotifications.createChannel({
      id:'cal-reminders',name:'Cal reminders',description:'Meal and personal reminders',importance:4
    });
  }
}

async function cancelReminderNotifications(ids){
  if(!LocalNotifications||!ids.length) return;
  await LocalNotifications.cancel({notifications:ids.map(id=>({id}))});
}

async function syncReminderNotifications(previousIds=[]){
  const mealIds=MEAL_REMINDER_TYPES.map((_,index)=>MEAL_REMINDER_ID+index);
  const customIds=S.reminders.map(reminder=>reminder.id);
  const reminderIds=[...new Set([...previousIds,...mealIds,WEIGHT_REMINDER_ID,...customIds])];
  const notifications=[];
  if(S.mealRemindersEnabled){
    MEAL_REMINDER_TYPES.forEach((type,index)=>{
      const [hour,minute]=(S.mealReminderTimes[type]||'08:00').split(':').map(Number);
      notifications.push({id:MEAL_REMINDER_ID+index,title:`${type} reminder`,body:`It’s time to log your ${type.toLowerCase()}.`,
        channelId:'cal-reminders',schedule:{on:{hour,minute},allowWhileIdle:true}});
    });
  }
  S.reminders.forEach(reminder=>notifications.push({
    id:reminder.id,title:'MyCal AI reminder',body:reminder.body,channelId:'cal-reminders',
    schedule:reminderSchedule(reminder)
  }));
  if(S.weightReminder.enabled){
    const [hour,minute]=S.weightReminder.time.split(':').map(Number);
    notifications.push({id:WEIGHT_REMINDER_ID,title:'Time to track your weight',body:'Log your weight to keep your progress up to date.',
      channelId:'cal-reminders',schedule:{on:{weekday:S.weightReminder.weekday,hour,minute},allowWhileIdle:true}});
  }
  if(notifications.length) await ensureReminderPermission();
  await cancelReminderNotifications(reminderIds);
  if(!notifications.length) return;
  await LocalNotifications.schedule({notifications});
}

function reminderText(reminder){
  const time=mealTimeLabel(`${String(reminder.hour).padStart(2,'0')}:${String(reminder.minute).padStart(2,'0')}`);
  const day=Object.keys(WEEKDAYS).find(name=>WEEKDAYS[name]===reminder.weekday);
  const repeat=reminder.frequency==='weekly'
    ? `Every ${day?day[0].toUpperCase()+day.slice(1):'Sunday'}`
    : 'Every day';
  return `${repeat} · ${time}`;
}

function renderReminders(){
  const list=$('#reminderList');
  if(!list) return;
  MEAL_REMINDER_TYPES.forEach(type=>{
    const input=$(`#mealReminder${type}`);
    if(input&&document.activeElement!==input) input.value=S.mealReminderTimes[type]||'08:00';
  });
  $('#weightReminderDay').value=String(S.weightReminder.weekday);
  $('#weightReminderTime').value=S.weightReminder.time;
  $('#saveWeightReminder').textContent=S.weightReminder.enabled?'Update weight reminder':'Enable weight reminder';
  $('#disableWeightReminder').style.display=S.weightReminder.enabled?'block':'none';
  $('#weightReminderStatus').textContent=S.weightReminder.enabled
    ? `Repeats every ${WEEKDAY_NAMES[S.weightReminder.weekday-1]} at ${mealTimeLabel(S.weightReminder.time)}.`
    : 'No weekly weight reminder is set.';
  $('#saveMealReminders').textContent=S.mealRemindersEnabled?'Update daily reminders':'Enable daily reminders';
  $('#disableMealReminders').style.display=S.mealRemindersEnabled?'block':'none';
  list.innerHTML=S.reminders.length?S.reminders.map(reminder=>`
    <div class="row" style="gap:8px">
      <div class="main"><div class="nm" style="font-size:13px">${esc(reminder.title)}</div><div class="ms">${esc(reminderText(reminder))}</div></div>
      <button class="btn sm ghost" onclick="deleteReminder(${reminder.id})" aria-label="Delete reminder: ${esc(reminder.title)}">✕</button>
    </div>`).join(''):'<div class="meta" style="font-size:12px;padding:4px 0">No custom reminders yet.</div>';
}

async function addReminderFromCommand(text){
  const parsed=parseReminderCommand(text);
  if(parsed.error) throw new Error(parsed.error);
  await ensureReminderPermission();
  let id=Date.now()%1800000000+1000;
  const reservedIds=new Set([...MEAL_REMINDER_TYPES.map((_,index)=>MEAL_REMINDER_ID+index),WEIGHT_REMINDER_ID,...S.reminders.map(reminder=>reminder.id)]);
  while(reservedIds.has(id)) id=id>=1800001000?1000:id+1;
  const reminder={id,title:parsed.title,body:`Time to ${parsed.title}`,frequency:parsed.frequency,weekday:parsed.weekday,hour:parsed.hour,minute:parsed.minute};
  await LocalNotifications.schedule({notifications:[{
    id,title:'MyCal AI reminder',body:reminder.body,channelId:'cal-reminders',
    schedule:reminderSchedule(reminder)
  }]});
  S.reminders.push(reminder);
  if(!saveState()) throw new Error('The reminder could not be saved on this device.');
  renderReminders();
  return reminder;
}

window.deleteReminder=async id=>{
  try{
    await cancelReminderNotifications([id]);
    S.reminders=S.reminders.filter(reminder=>reminder.id!==id);
    saveState(); renderReminders(); toast('Reminder removed','✓');
  }catch(error){ toast(`Could not remove reminder: ${error.message}`); }
};

$('#saveMealReminders').onclick=async()=>{
  const times=Object.fromEntries(MEAL_REMINDER_TYPES.map(type=>[type,$(`#mealReminder${type}`).value]));
  if(Object.values(times).some(value=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))){
    toast('Choose a valid time for all four reminders'); return;
  }
  try{
    await ensureReminderPermission();
    const notifications=MEAL_REMINDER_TYPES.map((type,index)=>{
      const [hour,minute]=times[type].split(':').map(Number);
      return {id:MEAL_REMINDER_ID+index,title:`${type} reminder`,body:`It’s time to log your ${type.toLowerCase()}.`,
        channelId:'cal-reminders',schedule:{on:{hour,minute},allowWhileIdle:true}};
    });
    await cancelReminderNotifications(MEAL_REMINDER_TYPES.map((_,index)=>MEAL_REMINDER_ID+index));
    await LocalNotifications.schedule({notifications});
    S.mealReminderTimes=times; S.mealRemindersEnabled=true;
    if(!saveState()) throw new Error('Reminder settings could not be saved on this device.');
    renderReminders(); toast('Daily meal and snack reminders are on','✓');
  }catch(error){ toast(`Could not set reminders: ${error.message}`); }
};
$('#disableMealReminders').onclick=async()=>{
  try{
    await cancelReminderNotifications(MEAL_REMINDER_TYPES.map((_,index)=>MEAL_REMINDER_ID+index));
    S.mealRemindersEnabled=false; saveState(); renderReminders(); toast('Meal reminders are off');
  }catch(error){ toast(`Could not turn off reminders: ${error.message}`); }
};
$('#saveWeightReminder').onclick=async()=>{
  const weekday=Number($('#weightReminderDay').value);
  const time=$('#weightReminderTime').value;
  if(!Number.isInteger(weekday)||weekday<1||weekday>7||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){
    toast('Choose a valid day and time for your reminder'); return;
  }
  const previous={...S.weightReminder};
  try{
    await ensureReminderPermission();
    const [hour,minute]=time.split(':').map(Number);
    await cancelReminderNotifications([WEIGHT_REMINDER_ID]);
    await LocalNotifications.schedule({notifications:[{
      id:WEIGHT_REMINDER_ID,title:'Time to track your weight',body:'Log your weight to keep your progress up to date.',
      channelId:'cal-reminders',schedule:{on:{weekday,hour,minute},allowWhileIdle:true}
    }]});
    S.weightReminder={enabled:true,weekday,time};
    if(!saveState()){
      S.weightReminder=previous;
      await cancelReminderNotifications([WEIGHT_REMINDER_ID]);
      if(previous.enabled){
        const [oldHour,oldMinute]=previous.time.split(':').map(Number);
        await LocalNotifications.schedule({notifications:[{
          id:WEIGHT_REMINDER_ID,title:'Time to track your weight',body:'Log your weight to keep your progress up to date.',
          channelId:'cal-reminders',schedule:{on:{weekday:previous.weekday,hour:oldHour,minute:oldMinute},allowWhileIdle:true}
        }]});
      }
      throw new Error('The weight reminder could not be saved on this device.');
    }
    renderReminders(); toast('Weekly weight reminder is on','✓');
  }catch(error){ toast(`Could not set weight reminder: ${error.message}`); }
};
$('#disableWeightReminder').onclick=async()=>{
  const previous={...S.weightReminder};
  try{
    await cancelReminderNotifications([WEIGHT_REMINDER_ID]);
    S.weightReminder.enabled=false;
    if(!saveState()){
      S.weightReminder=previous;
      const [hour,minute]=previous.time.split(':').map(Number);
      await LocalNotifications.schedule({notifications:[{
        id:WEIGHT_REMINDER_ID,title:'Time to track your weight',body:'Log your weight to keep your progress up to date.',
        channelId:'cal-reminders',schedule:{on:{weekday:previous.weekday,hour,minute},allowWhileIdle:true}
      }]});
      throw new Error('The reminder setting could not be saved on this device.');
    }
    renderReminders(); toast('Weight reminder is off');
  }catch(error){ toast(`Could not turn off reminder: ${error.message}`); }
};

const coachConversation=[];
function renderCoachConversation(){
  $('#askOut').innerHTML=coachConversation.map(message=>
    `<div class="coach-message ${message.role}">${esc(message.text)}</div>`).join('');
}
function addCoachWater(){
  const d=today();
  if(d.water>=Math.ceil(S.waterGoalLiters*4)){ toast('Daily water goal complete','✓'); return; }
  d.water++;
  renderAll();
  toast('Glass of water logged','✓');
}
$('#askBtn').onclick = async() => {
  const input=$('#askIn'), button=$('#askBtn');
  const question=input.value.trim();
  if(!question) return;
  input.value='';
  coachConversation.push({role:'user',text:question});
  renderCoachConversation();
  input.disabled=true; button.disabled=true; button.textContent='…';
  try{
    if(/\b(remind|notify|notification)\b/i.test(question)){
      try{
        const reminder=await addReminderFromCommand(question);
        coachConversation.push({role:'assistant',text:`Reminder set: ${reminder.title} · ${reminderText(reminder)}.`});
      }catch(error){
        coachConversation.push({role:'error',text:`I couldn’t set that reminder: ${error.message}`});
      }
    }else if(S.apiKey){
      const k=TODAY(), d=today(), totals=eaten(k), week=weekKeys(0);
      const context={
        date:k,
        goals:{calories:S.goals.k,proteinGrams:S.goals.p,carbsGrams:S.goals.c,fatGrams:S.goals.f},
        today:{
          calories:Math.round(totals.kcal),proteinGrams:Math.round(totals.protein),carbsGrams:Math.round(totals.carbs),fatGrams:Math.round(totals.fat),
          steps:Number(d.steps)||0,waterGlasses:d.water,meals:d.meals.map(meal=>({name:meal.name,calories:meal.kcal,proteinGrams:meal.protein})),
          workout:d.workout?{type:d.workout.type,minutes:d.workout.min}:null
        },
        weeklySessions:week.filter(day=>S.days[day]?.workout).length,
        weeklySessionGoal:S.weekGoal,
        currentWeightKg:S.weights.length?S.weights[S.weights.length-1].w:S.weight,
        targetWeightKg:S.targetWeight
      };
      const reply=await geminiCall([{text:`You are Cal, a supportive nutrition and fitness coach. Answer the user's question with practical advice grounded in the supplied tracker context. Be concise (under 130 words), non-judgmental, and do not claim estimates are medical facts. If information is missing, say so. Return only JSON in this shape: {"reply":"your answer"}.\nTracker context: ${JSON.stringify(context)}\nUser question: ${question}`}],S.apiKey);
      if(typeof reply.reply!=='string'||!reply.reply.trim()) throw new Error('Gemini returned an empty coach response.');
      coachConversation.push({role:'assistant',text:reply.reply.trim().slice(0,1800)});
    }else{
      coachConversation.push({role:'assistant',text:answer(question).replace(/<[^>]*>/g,'')});
    }
  }catch(error){
    console.warn('Cal coach request failed:',error);
    if(S.apiKey&&isGeminiKeyError(error)){
      geminiKeyVerified=false;
      renderApiStatus();
      showKeyReminder('Gemini rejected the saved API key.',true);
    }
    coachConversation.push({role:'error',text:`Gemini could not respond: ${error instanceof Error?error.message:String(error)}`});
    coachConversation.push({role:'assistant',text:`Offline coach: ${answer(question).replace(/<[^>]*>/g,'')}`});
  }finally{
    input.disabled=false; button.disabled=false; button.textContent='Ask';
    renderCoachConversation();
    input.focus();
  }
};
$('#askIn').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#askBtn').click(); });
$$('.chip.aq').forEach(c=>c.onclick=()=>{ $('#askIn').value=c.textContent; $('#askBtn').click(); });

/* ============================================================================
   KEY + SETTINGS
   ============================================================================ */
function exportBackup(){
  const filename=`mycal-ai-backup-${TODAY()}.json`;
  const content=JSON.stringify(createBackup(),null,2);
  if(new Blob([content]).size>10*1024*1024){
    toast('Backup files must be smaller than 10 MB.');
    return;
  }
  if(isAndroidApp()){
    BackupFiles.save({filename,content})
      .then(result=>toast(result.cancelled?'Backup not saved':'JSON backup saved',result.cancelled?'':'✓'))
      .catch(error=>toast('Could not save backup: '+error.message));
    return;
  }
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;
  link.download=filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('JSON backup downloaded','✓');
}

async function importBackupText(text){
  if(text.length>10*1024*1024) throw new Error('Backup files must be smaller than 10 MB.');
  let backup;
  try{ backup=JSON.parse(text); }
  catch{ throw new Error('The selected file is not valid JSON.'); }
  const data=validateBackup(backup);
  if(!window.confirm('Replace this device’s tracker data with the selected backup? Your AI key and Health Connect permission will stay unchanged.')) return false;
  const previousReminderIds=[...S.reminders.map(reminder=>reminder.id),...MEAL_REMINDER_TYPES.map((_,index)=>MEAL_REMINDER_ID+index),WEIGHT_REMINDER_ID];
  applyBackup(data);
  try{ await syncReminderNotifications(previousReminderIds); }
  catch(error){ toast(`Backup imported, but reminders could not be restored: ${error.message}`); }
  renderAll();
  $('#gK').value=S.goals.k; $('#gP').value=S.goals.p; $('#gC').value=S.goals.c; $('#gF').value=S.goals.f;
  $('#bodyW').value=S.weight; $('#setW').value=S.weight; $('#setTW').value=S.targetWeight; $('#setH').value=S.heightCm;
  toast('Backup imported','✓');
  return true;
}

async function importBackupFile(file){
  try{
    if(file.size>10*1024*1024) throw new Error('Backup files must be smaller than 10 MB.');
    await importBackupText(await file.text());
  }catch(error){
    toast('Could not import backup: '+error.message);
  }
}

$('#exportBackup').onclick=exportBackup;
$('#importBackup').onclick=async()=>{
  if(isAndroidApp()){
    try{
      const result=await BackupFiles.open();
      if(!result.cancelled) await importBackupText(result.content);
    }catch(error){
      toast('Could not import backup: '+error.message);
    }
    return;
  }
  $('#backupFile').click();
};
$('#backupFile').onchange=event=>{
  const file=event.target.files?.[0];
  if(file) importBackupFile(file);
  event.target.value='';
};

$('#saveKey').onclick = () => {
  const v = $('#keyIn').value.trim();
  if(v!==S.apiKey) geminiKeyVerified=false;
  S.apiKey = v;
  saveState();
  renderApiStatus();
  toast(v ? 'Gemini key saved for this tab' : 'Key cleared');
};
$('#testKey').onclick = async () => {
  const v = $('#keyIn').value.trim() || S.apiKey;
  if(!v){ toast('Paste a key first'); return; }
  $('#keyStep').innerHTML = '<span class="spin"></span> Testing…';
  try{
    const r = await geminiCall([{text:'Reply with only this JSON: {"ok":true}'}], v);
    if(r && r.ok){ S.apiKey = v; geminiKeyVerified=true; saveState(); renderApiStatus(); $('#keyStep').textContent = 'Key works — photo analysis enabled.'; toast('Gemini connected','✓'); }
    else throw new Error('unexpected response');
  }catch(e){
    $('#keyStep').textContent = '';
    toast('Key test failed: '+e.message);
    if(isGeminiKeyError(e)){
      geminiKeyVerified=false;
      renderApiStatus();
      showKeyReminder('Google rejected that API key.',true);
    }
  }
};
function closeWaterGoalDialog(){
  $('#waterGoalBackdrop').style.display='none';
}
$('#editWaterGoal').onclick=()=>{
  $('#waterGoalLiters').value=S.waterGoalLiters;
  $('#waterGoalBackdrop').style.display='grid';
  $('#waterGoalLiters').focus();
};
$('#cancelWaterGoal').onclick=closeWaterGoalDialog;
$('#saveWaterGoal').onclick=()=>{
  const value=Number($('#waterGoalLiters').value);
  if(!Number.isFinite(value)||value<0.25||value>10||Math.round(value*4)!==value*4){
    toast('Choose a water goal from 0.25 to 10 litres in 0.25-litre steps.');
    return;
  }
  const previous=S.waterGoalLiters;
  S.waterGoalLiters=value;
  if(!saveState()){
    S.waterGoalLiters=previous;
    toast('Could not save the water target on this device.');
    return;
  }
  renderHome();
  closeWaterGoalDialog();
  toast(`Daily water target set to ${value.toFixed(2)} L`,'✓');
};
$('#saveGoals').onclick = () => {
  S.goals = {k:+$('#gK').value||2200, p:+$('#gP').value||150, c:+$('#gC').value||240, f:+$('#gF').value||70};
  renderAll(); toast('Goals saved','✓');
};
$('#saveBody').onclick = () => {
  S.weight = +$('#setW').value||70; S.targetWeight = +$('#setTW').value||65;
  S.heightCm = Math.min(250,Math.max(100,+$('#setH').value||170));
  $('#bodyW').value = S.weight;
  renderAll(); toast('Body data saved','✓');
};
$('#bodyW').onchange = e => { S.weight = +e.target.value||70; $('#setW').value = S.weight; renderAll(); };
$('#weekGoal').onchange = e => { S.weekGoal = +e.target.value||5; renderAll(); };
$('#resetAll').onclick = async() => {
  try{
    await cancelReminderNotifications([...S.reminders.map(reminder=>reminder.id),...MEAL_REMINDER_TYPES.map((_,index)=>MEAL_REMINDER_ID+index),WEIGHT_REMINDER_ID]);
  }catch(error){ toast(`Could not cancel reminders: ${error.message}`); return; }
  S.days={}; S.saved=[]; S.routines=[]; S.recent=[]; S.weights=[]; S.weekOffset=0; S.reportSeen=[];
  S.reminders=[]; S.mealRemindersEnabled=false; S.weightReminder={enabled:false,weekday:1,time:'09:00'};
  saveState(); renderAll(); toast('Data cleared');
};

/* ============================================================================
   NAV
   ============================================================================ */
function switchView(v){
  $$('.view').forEach(s=>s.classList.toggle('on', s.id==='v-'+v));
  $$('#seg button').forEach(b=>b.classList.toggle('on', b.dataset.v===v));
  $$('#tabbar .tb').forEach(b=>b.classList.toggle('on', b.dataset.v===v));
  if(v==='week') renderWeek();
  if(v==='coach') renderCoach();
  if(v==='train') renderTrain();
  if(v==='library') renderLibrary();
  window.scrollTo({top:0,behavior:'smooth'});
}
function startMealScan(type){
  $('#mealType').value=type==='Other'?'Snack':type;
  $('#mealDate').value=TODAY();
  $('#mealTime').value=localTimeValue();
  switchView('scan');
}
$$('#seg button, #tabbar .tb').forEach(b=>b.onclick=()=>switchView(b.dataset.v));
$('#fabScan').onclick = () => { switchView('scan'); setTimeout(()=>$('#camBtn').focus(),200); };

if(!loadState()) saveState();

function renderAll(){ renderHome(); renderTrain(); renderWeek(); renderRecent(); renderCoach(); renderLibrary(); renderApiStatus(); renderReminders(); saveState(); queueRecapNotificationSync(); }
renderAll();
$('#gK').value=S.goals.k; $('#gP').value=S.goals.p; $('#gC').value=S.goals.c; $('#gF').value=S.goals.f;
$('#bodyW').value=S.weight; $('#setW').value=S.weight; $('#setTW').value=S.targetWeight; $('#setH').value=S.heightCm;
$('#mealDate').value=TODAY(); $('#mealDate').max=TODAY(); $('#mealTime').value=localTimeValue();
$('#stepDate').value=TODAY(); $('#stepDate').max=TODAY(); updateStepDateDisplay(); renderStepsCalendar();
switchView('home');
scheduleAutomaticRecaps();
registerRecapNotificationActions();
if(S.healthConnectEnabled) syncHealthSteps(false);
checkForAppUpdate();
if(!S.apiKey) setTimeout(()=>showKeyReminder(),600);
