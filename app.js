import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore,collection,onSnapshot,addDoc,updateDoc,deleteDoc,doc,serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getAuth,signInWithPopup,signInWithRedirect,getRedirectResult,GoogleAuthProvider,signOut as fbSignOut,onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

emailjs.init("4sxaN9AuFTFe2l0zK");
const SVC="service_w9g32g7",TPL_NEW="template_4h4uxjh",TPL_REM="template_d8z2y4m";
const APP_URL=window.location.href;

// ADMINS
const ADMINS=["ahurtado@paraleloinmobiliaria.pe","gcurotto@paraleloinmobiliaria.pe","ecornejo@paraleloinmobiliaria.pe"];
const APROBADORES_VAC=["gcurotto@paraleloinmobiliaria.pe","ecornejo@paraleloinmobiliaria.pe"];

const TEAM_EMAILS={"Ana Paula Hurtado":"ahurtado@paraleloinmobiliaria.pe","Johan Galvez":"jgalvez@paraleloinmobiliaria.pe","Pablo Caillahua":"pcaillahua@paraleloinmobiliaria.pe","Gabriela Curotto":"gcurotto@paraleloinmobiliaria.pe","Diego David":"ddavid@paraleloinmobiliaria.pe","Eduardo Cornejo":"ecornejo@paraleloinmobiliaria.pe"};
const TEAM_NAMES={"ahurtado@paraleloinmobiliaria.pe":"Ana Paula Hurtado","jgalvez@paraleloinmobiliaria.pe":"Johan Galvez","pcaillahua@paraleloinmobiliaria.pe":"Pablo Caillahua","gcurotto@paraleloinmobiliaria.pe":"Gabriela Curotto","ddavid@paraleloinmobiliaria.pe":"Diego David","ecornejo@paraleloinmobiliaria.pe":"Eduardo Cornejo"};
const TEAM=Object.keys(TEAM_EMAILS);
const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CATS=['Comunicación interna','Diseño','Audiovisual','Publicidad exterior','Material impreso','Entrega/Minuta','Publicidad digital','Otros'];
const COLORS=['#E8261C','#E9A23B','#1BA572','#2E7DC4','#7A5CC0','#EC4899','#14B8A6'];
const DIAS={0:31,1:28,2:31,3:30,4:31,5:30,6:31,7:31,8:30,9:31,10:30,11:31};

const fbApp=initializeApp({apiKey:"AIzaSyDb5rQYu5_Ukf5AQ77zz8O6Si1MUdGcz_w",authDomain:"tdc-calendario-av.firebaseapp.com",projectId:"tdc-calendario-av",storageBucket:"tdc-calendario-av.firebasestorage.app",messagingSenderId:"393165602286",appId:"1:393165602286:web:702df05a4a4aa6ef3662ff",measurementId:"G-9NGVTJVFDQ"});
const db=getFirestore(fbApp);
const auth=getAuth(fbApp);

// Handle redirect result on page load
getRedirectResult(auth).then(result=>{
  if(result?.user){
    // Login successful via redirect - onAuthStateChanged will handle it
  }
}).catch(e=>{
  if(e.code!=='auth/no-current-user'){
    console.error('Redirect error:',e);
  }
});
const tasksCol=collection(db,"tareas_v2");
const grabsCol=collection(db,"grabaciones");
const proyectosCol=collection(db,"proyectos");
const notifsCol=collection(db,"notificaciones");

let tasks=[],grabs=[],proyectos=[],notifs=[],currentUser=null,anView='global',myFilter='mios',charts={};
let editTaskId=null,editGrabId=null,editProyId=null,unidProyId=null,prevTaskEstado=null;
let curY=new Date().getFullYear(),curM=new Date().getMonth();
let activeSection=1;

const $=id=>document.getElementById(id);
const fmtDate=s=>s?s.split('-').reverse().join('/'):'—';
const today=()=>new Date().toISOString().split('T')[0];
const diffDays=(a,b)=>Math.round((new Date(b)-new Date(a))/(864e5));
const initials=n=>n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
const isAdmin=()=>currentUser&&ADMINS.includes(currentUser.email);

function showToast(msg,icon='✓'){$('toastMsg').textContent=msg;$('toastIcon').textContent=icon;const t=$('toast');t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2800);}
function setSync(s){const dot=$('syncDot'),lbl=$('syncLabel');if(s==='ok'){dot.className='sync-dot';lbl.textContent='En vivo ●';}else if(s==='s'){dot.className='sync-dot s';lbl.textContent='Guardando...';}else{dot.className='sync-dot';dot.style.background='#EF4444';lbl.textContent='Sin conexión';}}

// CALENDAR POPUP
function buildCalLink(nombre,fecha){
  if(!fecha)return'#';
  const d=fecha.replace(/-/g,'');
  return`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('📋 TDC: '+nombre)}&dates=${d}/${d}&details=${encodeURIComponent('Ver tablero: '+APP_URL)}`;
}

window.showCalPopup=(nombre,fecha)=>{
  $('calPopupName').textContent=nombre;
  $('calPopupLink').href=buildCalLink(nombre,fecha);
  $('calPopup').style.display='block';
};
window.closeCalPopup=()=>{$('calPopup').style.display='none';};

// AUTH
window.signInWithGoogle=async()=>{
  const provider=new GoogleAuthProvider();
  provider.setCustomParameters({hd:'paraleloinmobiliaria.pe'});
  try{
    await signInWithPopup(auth,provider);
    // onAuthStateChanged maneja el resto al iniciar sesión correctamente
  }catch(e){
    $('loginScreen').style.display='flex';
    $('loadingScreen').style.display='none';
    if(e.code==='auth/popup-closed-by-user'||e.code==='auth/cancelled-popup-request')return;
    if(e.code==='auth/popup-blocked'){showToast('El navegador bloqueó la ventana. Permite ventanas emergentes e intenta de nuevo.','⚠️');return;}
    showToast('Error al iniciar sesión: '+e.message,'⚠️');
  }
};

window.signOut=async()=>{
  if(!confirm('¿Cerrar sesión?'))return;
  await fbSignOut(auth);
  $('appShell').style.display='none';
  $('loginScreen').style.display='flex';
};

onAuthStateChanged(auth,user=>{
  if(user){
    currentUser=user;
    $('loginScreen').style.display='none';
    $('loadingScreen').style.display='flex';
    $('loadingText').textContent='Cargando datos...';
    setupUser(user);
    loadData();
  } else {
    currentUser=null;
    $('appShell').style.display='none';
    $('loginScreen').style.display='flex';
    $('loadingScreen').style.display='none';
  }
});

function setupUser(user){
  const email=user.email||'';
  const fullName=TEAM_NAMES[email]||user.displayName||email;
  $('userName').textContent=fullName.split(' ')[0];
  $('userAvatarText').textContent=initials(fullName);
  $('myBannerName').textContent=fullName.split(' ')[0]+' '+(fullName.split(' ')[1]||'');
  if(isAdmin())$('adminBadge').style.display='flex';
  const myName=fullName;
  if(TEAM.includes(myName)){$('fMio').value=myName;myFilter='mios';}
  applyFilterVisibility();
}

function getUserFullName(){
  const email=currentUser?.email||'';
  return TEAM_NAMES[email]||currentUser?.displayName||'';
}

// DATA
function loadData(){
  let t1=false,t2=false;
  let appReady=false;
  function check(){
    if(t1&&t2&&!appReady){
      appReady=true;
      $('loadingScreen').style.display='none';
      $('appShell').style.display='block';
      setSync('ok');
      checkReminders();
    }
  }
  onSnapshot(tasksCol,snap=>{tasks=snap.docs.map(d=>({id:d.id,...d.data()}));t1=true;renderBoard();if(activeSection===3)renderAnalytics();check();},()=>{setSync('error');t1=true;check();});
  onSnapshot(grabsCol,snap=>{grabs=snap.docs.map(d=>({id:d.id,...d.data()}));t2=true;renderCal();check();},()=>{setSync('error');t2=true;check();});
  onSnapshot(proyectosCol,snap=>{proyectos=snap.docs.map(d=>({id:d.id,...d.data()}));renderProyectos();},()=>{});
  onSnapshot(notifsCol,snap=>{notifs=snap.docs.map(d=>({id:d.id,...d.data()}));renderNotifBadge();},()=>{});
}

// AVISOS / NOTIFICACIONES
function notifRelevante(n){
  const e=(currentUser?.email||'').toLowerCase();
  if(!e)return false;
  if((n.de||'').toLowerCase()===e)return false; // no me notifico a mí mismo
  if(n.scope==='todos')return true;
  if(n.scope==='admins')return isAdmin();
  return (n.scope||'').toLowerCase()===e;
}
function notifNoLeida(n){
  const e=(currentUser?.email||'').toLowerCase();
  return !((n.readBy||[]).map(x=>(x||'').toLowerCase()).includes(e));
}
function notifMios(){
  return notifs.filter(notifRelevante).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
}
function renderNotifBadge(){
  const b=$('notifBadge');if(!b)return;
  const n=notifMios().filter(notifNoLeida).length;
  b.textContent=n>9?'9+':n;
  b.style.display=n>0?'flex':'none';
}
function fmtNotifTime(ts){
  if(!ts?.seconds)return '';
  const d=new Date(ts.seconds*1000);
  return d.toLocaleDateString('es-PE',{day:'2-digit',month:'short'})+' · '+d.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});
}
window.openNotifs=async()=>{
  const list=$('notifList');const items=notifMios();
  if(!items.length){list.innerHTML='<div class="notif-empty">No tienes avisos por ahora.</div>';}
  else{
    list.innerHTML=items.map(n=>`
      <div class="notif-item${notifNoLeida(n)?' unread':''}"${n.link?` onclick="goNotif(${n.link})"`:''}>
        <div class="notif-ico">${n.icono||'🔔'}</div>
        <div class="notif-body">
          <div class="notif-title">${(n.titulo||'Aviso').replace(/</g,'&lt;')}</div>
          <div class="notif-msg">${(n.mensaje||'').replace(/</g,'&lt;')}</div>
          <div class="notif-time">${fmtNotifTime(n.createdAt)}</div>
        </div>
      </div>`).join('');
  }
  $('notifPanel').style.display='block';
  // marcar como leídas las relevantes no leídas
  const e=(currentUser?.email||'');
  const porLeer=items.filter(notifNoLeida);
  for(const n of porLeer){
    try{await updateDoc(doc(db,'notificaciones',n.id),{readBy:[...new Set([...(n.readBy||[]),e])]});}catch(err){}
  }
};
window.closeNotifs=()=>{$('notifPanel').style.display='none';};
window.goNotif=sec=>{closeNotifs();switchSection(sec);};

// NAV
window.switchSection=n=>{
  activeSection=n;
  [1,2,3,4,5,6,7,8].forEach(i=>{$(`navTab${i}`).className='nav-tab'+(i===n?' active':'');$(`sec${i}`).className='section'+(i===n?' active':'');});
  if(n===3)renderAnalytics();
  if(n===4){const f=$('kpisFrame');if(f&&!f.src)f.src=f.dataset.src;}
  if(n===5){const f=$('contenidoFrame');if(f&&!f.src)f.src=f.dataset.src;}
  if(n===6)renderProyectos();
  if(n===7){const f=$('vacacionesFrame');if(f&&!f.src){
    const email=(currentUser?.email||'').toLowerCase();
    const esAprob=APROBADORES_VAC.includes(email);
    if(esAprob){f.src='vacaciones-admin.html';}
    else{const nm=getUserFullName();f.src=f.dataset.src+(nm?'#member='+encodeURIComponent(nm):'');}
  }}
  if(n===8){const f=$('inventarioFrame');if(f&&!f.src)f.src=f.dataset.src;}
};

// Oscurecer todo el tablero (incluido el sidebar) cuando un iframe abre un modal
window.addEventListener('message',e=>{
  if(!e.data||e.data.type!=='iframeModal')return;
  const dim=$('frameDim');let fr=null;
  document.querySelectorAll('iframe').forEach(f=>{if(f.contentWindow===e.source)fr=f;});
  if(e.data.open){if(dim)dim.style.display='block';if(fr){fr.style.position='relative';fr.style.zIndex='260';}}
  else{if(dim)dim.style.display='none';if(fr){fr.style.zIndex='';fr.style.position='';}}
});

// BOARD FILTERS
function applyFilterVisibility(){
  const bf=$('boardFilters');if(bf)bf.style.display=myFilter==='mios'?'none':'contents';
  const tb=$('boardToolbar');if(tb)tb.style.display=myFilter==='mios'?'none':'flex';
}
window.setMyFilter=v=>{
  myFilter=v;
  $('btnTodos').className='my-filter-btn'+(v==='todos'?' active':'');
  $('btnMios').className='my-filter-btn'+(v==='mios'?' active':'');
  $('fMio').value=v==='mios'?getUserFullName():'';
  applyFilterVisibility();
  renderBoard();
};

function filteredTasks(){
  const fE=$('fMio').value,fM=$('fMes').value,fP=$('fPri').value,fC=$('fCat').value;
  return tasks.filter(t=>{
    if(fE&&!(t.encargados||[]).includes(fE))return false;
    if(fM!==''&&t.fechaSol){const d=new Date(t.fechaSol+'T00:00:00');if(d.getMonth()!==parseInt(fM))return false;}
    if(fP&&t.prioridad!==fP)return false;
    if(fC&&t.categoria!==fC)return false;
    return true;
  });
}
window.clearF=()=>{['fMio','fMes','fPri','fCat'].forEach(id=>$(id).value='');myFilter='todos';$('btnTodos').className='my-filter-btn active';$('btnMios').className='my-filter-btn';applyFilterVisibility();renderBoard();};

function renderBoard(){
  const fevs=filteredTasks();
  const pend=fevs.filter(t=>t.estado==='Pendiente'),proc=fevs.filter(t=>t.estado==='En Proceso'),comp=fevs.filter(t=>t.estado==='Completada'||t.estado==='Cancelada');
  $('cPend').textContent=tasks.filter(t=>t.estado==='Pendiente').length;
  $('cProc').textContent=tasks.filter(t=>t.estado==='En Proceso').length;
  $('cComp').textContent=tasks.filter(t=>t.estado==='Completada').length;
  $('cCanc').textContent=tasks.filter(t=>t.estado==='Cancelada').length;
  $('bPend').textContent=pend.length;$('bProc').textContent=proc.length;$('bComp').textContent=comp.length;
  renderCol('colPend',pend);renderCol('colProc',proc);renderCol('colComp',comp);
}
window.renderBoard=renderBoard;

function renderCol(id,items){
  const col=$(id);col.innerHTML='';
  if(!items.length){col.innerHTML='<div class="col-empty">No hay tareas aquí</div>';return;}
  const po={Alta:0,Media:1,Baja:2};
  items.sort((a,b)=>(po[a.prioridad]||1)-(po[b.prioridad]||1));
  items.forEach(t=>col.appendChild(buildCard(t)));
}

function buildCard(t){
  const card=document.createElement('div');card.className='card';
  const myName=getUserFullName();
  if((t.encargados||[]).includes(myName))card.classList.add('mine');
  const tom=new Date();tom.setDate(tom.getDate()+1);const tomStr=tom.toISOString().split('T')[0];
  const venceMañana=t.fechaEnt===tomStr&&t.estado!=='Completada'&&t.estado!=='Cancelada';
  const vencido=t.fechaEnt<today()&&t.estado!=='Completada'&&t.estado!=='Cancelada';
  const pc=t.prioridad==='Alta'?'p-a':t.prioridad==='Media'?'p-m':'p-b';
  const dc=vencido||venceMañana?'d-ent vence':t.estado==='Completada'?'d-ent ok':'d-ent norm';
  const encUnicos=[...new Set(t.encargados||[])];
  const encs=encUnicos.map(e=>{const parts=e.split(' ');const label=parts[0]+(parts[1]?' '+parts[1][0]+'.':'');return`<span class="enc-chip${e===myName?' me':''}">${label}</span>`;}).join('');
  const calUrl=buildCalLink(t.nombre,t.fechaEnt);
  card.innerHTML=`
    ${(venceMañana||vencido)?'<div class="vence-dot"></div>':''}
    <div class="card-top"><div class="card-name">${t.nombre||'Sin título'}</div><span class="pri-badge ${pc}">${t.prioridad||'—'}</span></div>
    <div class="card-cat">${t.categoria||'Sin categoría'}${t.origenGrabacion?' 📹':''}</div>    ${t.estado==='Cancelada'&&t.cancelReason?`<div class="cancel-r">❌ ${t.cancelReason}</div>`:''}
    <div class="card-meta">
      <div class="card-meta-row"><svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>${t.area||'—'}</div>
      <div class="card-meta-row"><svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M2 14c0-3 2.686-6 6-6s6 3 6 6" stroke="currentColor" stroke-width="1.5"/></svg>Solicita: ${t.solicita||'—'}</div>
    </div>
    <div class="card-encs">${encs}</div>
    <div class="card-dates"><span class="d-sol">📅 ${fmtDate(t.fechaSol)}</span><span class="${dc}">${vencido?'⚠️':'🕐'} ${fmtDate(t.fechaEnt)}</span></div>
    <div class="card-actions">
      <button class="btn-edit" onclick="openEditTask('${t.id}')">Editar</button>
      <a href="${calUrl}" target="_blank" class="btn-gcal" title="Agendar en Google Calendar">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Agendar
      </a>
      <button class="btn-del" onclick="deleteTask('${t.id}','${(t.nombre||'').replace(/'/g,"\\'")}')">🗑</button>
    </div>`;
  return card;
}

// TASK MODAL
window.openTaskModal=()=>{
  editTaskId=null;prevTaskEstado=null;
  $('taskMTitle').textContent='Nueva Tarea';
  $('tNombre').value='';$('tArea').value='';$('tSolicita').value='';
  $('tCat').value='';$('tPri').value='';$('tEst').value='Pendiente';
  $('tFechaSol').value=today();$('tFechaEnt').value='';$('tDesc').value='';$('tCancelReason').value='';
  document.querySelectorAll('#taskEncWrap .enc-opt').forEach(b=>b.classList.remove('sel'));
  const myName=getUserFullName();
  document.querySelectorAll('#taskEncWrap .enc-opt').forEach(b=>{if(b.dataset.name===myName)b.classList.add('sel');});
  $('tCancelBox').style.display='none';
  $('taskModal').style.display='block';
  setTimeout(()=>$('tNombre').focus(),100);
};
window.openEditTask=id=>{
  editTaskId=id;const t=tasks.find(x=>x.id===id)||{};
  prevTaskEstado=t.estado||null;
  $('taskMTitle').textContent='Editar Tarea';
  $('tNombre').value=t.nombre||'';$('tArea').value=t.area||'';$('tSolicita').value=t.solicita||'';
  $('tCat').value=t.categoria||'';$('tPri').value=t.prioridad||'';$('tEst').value=t.estado||'Pendiente';
  $('tFechaSol').value=t.fechaSol||today();$('tFechaEnt').value=t.fechaEnt||'';
  $('tDesc').value=t.descripcion||'';$('tCancelReason').value=t.cancelReason||'';
  document.querySelectorAll('#taskEncWrap .enc-opt').forEach(b=>b.classList.toggle('sel',(t.encargados||[]).includes(b.dataset.name)));
  $('tCancelBox').style.display=t.estado==='Cancelada'?'block':'none';
  $('taskModal').style.display='block';
};
window.closeTaskModal=()=>{$('taskModal').style.display='none';editTaskId=null;prevTaskEstado=null;};
window.toggleEnc=btn=>btn.classList.toggle('sel');
window.checkTCancel=()=>{$('tCancelBox').style.display=$('tEst').value==='Cancelada'?'block':'none';};

window.saveTask=async()=>{
  const nombre=$('tNombre').value.trim(),area=$('tArea').value.trim(),solicita=$('tSolicita').value.trim();
  const categoria=$('tCat').value,prioridad=$('tPri').value,estado=$('tEst').value;
  const fechaSol=$('tFechaSol').value,fechaEnt=$('tFechaEnt').value;
  const cancelReason=$('tCancelReason').value.trim();
  const encargados=[...document.querySelectorAll('#taskEncWrap .enc-opt.sel')].map(b=>b.dataset.name);
  if(!nombre){$('tNombre').focus();showToast('El nombre es obligatorio','⚠️');return;}
  if(!area){$('tArea').focus();showToast('El área es obligatoria','⚠️');return;}
  if(!solicita){$('tSolicita').focus();showToast('Quién solicita es obligatorio','⚠️');return;}
  if(!categoria){showToast('Selecciona una categoría','⚠️');return;}
  if(!encargados.length){showToast('Selecciona al menos un encargado','⚠️');return;}
  if(!prioridad){showToast('Selecciona una prioridad','⚠️');return;}
  if(!fechaSol||!fechaEnt){showToast('Las fechas son obligatorias','⚠️');return;}
  if(estado==='Cancelada'&&!cancelReason){$('tCancelReason').focus();showToast('El motivo de cancelación es obligatorio','⚠️');return;}
  const wasCompleted=prevTaskEstado!=='Completada'&&estado==='Completada';
  const isNew=!editTaskId;
  const btn=$('btnSaveTask');btn.disabled=true;btn.textContent='Guardando...';setSync('s');
  const data={nombre,area,solicita,categoria,encargados,prioridad,estado,fechaSol,fechaEnt,
    descripcion:$('tDesc').value,cancelReason:estado==='Cancelada'?cancelReason:'',updatedAt:serverTimestamp()};
  try{
    if(isNew){data.createdAt=serverTimestamp();const ref=await addDoc(tasksCol,data);sendNewEmails({...data,encargados},ref.id);}
    else{await updateDoc(doc(db,'tareas_v2',editTaskId),data);}
    window.closeTaskModal();
    showToast(isNew?'Tarea creada ✓':'Tarea actualizada ✓');
    if(isNew)setTimeout(()=>window.showCalPopup(nombre,fechaEnt),400);
    if(wasCompleted)setTimeout(()=>showCompletionBanner(nombre),400);
  }catch(e){showToast('Error al guardar','⚠️');setSync('error');}
  btn.disabled=false;btn.textContent='Guardar tarea';
};

window.deleteTask=async(id,nombre)=>{
  if(!confirm(`¿Eliminar "${nombre}"?`))return;
  setSync('s');try{await deleteDoc(doc(db,'tareas_v2',id));showToast('Eliminada','🗑');}catch(e){showToast('Error','⚠️');}
};

// GRAB FILTERS
function filteredGrabs(){
  const fM=$('cfMes').value,fT=$('cfTipo').value,fE=$('cfEst').value,fR=$('cfResp').value;
  return grabs.filter(g=>{
    if(fM!==''&&g.fecha){const d=new Date(g.fecha+'T00:00:00');if(d.getMonth()!==parseInt(fM))return false;}
    if(fT&&g.tipo!==fT)return false;
    if(fE&&g.estado!==fE)return false;
    if(fR&&!(g.responsables||[]).includes(fR))return false;
    return true;
  });
}
window.clearCF=()=>{['cfMes','cfTipo','cfEst','cfResp'].forEach(id=>$(id).value='');renderCal();};

function stKey(s){if(s==='Confirmado')return'conf';if(s==='En progreso')return'prog';if(s==='Cancelado')return'canc';return'pend';}
function daysInMonth(y,m){if(m===1&&((y%4===0&&y%100!==0)||y%400===0))return 29;return DIAS[m];}

function renderCal(){
  $('monthLabel').textContent=MESES[curM]+' '+curY;
  const ml=$('grabListMonth');if(ml)ml.textContent='· '+MESES[curM]+' '+curY;
  const body=$('calBody');body.innerHTML='';
  const first=new Date(curY,curM,1).getDay(),total=daysInMonth(curY,curM);
  const t=new Date();const tInfo={y:t.getFullYear(),m:t.getMonth(),d:t.getDate()};
  const fg=filteredGrabs();
  for(let i=0;i<first;i++){const e=document.createElement('div');e.className='cell empty';body.appendChild(e);}
  for(let d=1;d<=total;d++){
    const cell=document.createElement('div');
    const isToday=tInfo.y===curY&&tInfo.m===curM&&tInfo.d===d;
    const dow=(first+d-1)%7;
    cell.className='cell'+(isToday?' today':(dow===0||dow===6)?' weekend':'');
    const ds=curY+'-'+String(curM+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const numDiv=document.createElement('div');numDiv.className='cnum';
    if(isToday){const inn=document.createElement('div');inn.className='cnum-today';inn.textContent=d;numDiv.appendChild(inn);}
    else numDiv.textContent=d;
    cell.appendChild(numDiv);
    fg.filter(g=>g.fecha===ds).slice(0,3).forEach(g=>{
      const ch=document.createElement('div');ch.className='chip c-'+stKey(g.estado);
      ch.textContent=g.nombre||g.tipo||'Grabación';
      ch.onclick=e2=>{e2.stopPropagation();openEditGrab(g.id);};
      cell.appendChild(ch);
    });
    cell.onclick=()=>openGrabModal(ds);
    body.appendChild(cell);
  }
  renderGrabList();
}
window.renderCal=renderCal;
window.changeMonth=dir=>{curM+=dir;if(curM>11){curM=0;curY++;}if(curM<0){curM=11;curY--;}renderCal();};

function renderGrabList(){
  const tbody=$('grabList');tbody.innerHTML='';
  const fg=filteredGrabs().filter(g=>{
    if(!g.fecha)return false;
    const d=new Date(g.fecha+'T00:00:00');
    return d.getFullYear()===curY&&d.getMonth()===curM;
  });
  if(!fg.length){tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:2rem;font-size:12px;">No hay grabaciones en '+MESES[curM]+' '+curY+'</td></tr>';return;}
  [...fg].sort((a,b)=>a.fecha>b.fecha?1:-1).forEach(g=>{
    const badges={pend:'background:#FCF3E3;color:#B07410',conf:'background:#E7F6EF;color:#1BA572',prog:'background:#EAF1F8;color:#2E5B8A',canc:'background:#FFE9E6;color:#C4140C'};
    const bstyle=badges[stKey(g.estado)]||badges.pend;
    const resps=(g.responsables||[]).map(r=>`<span style="font-size:10px;background:var(--steel-soft);color:var(--steel);padding:3px 8px;border-radius:20px;font-weight:600;">${r.split(' ')[0]}</span>`).join(' ');
    const calUrl=buildCalLink(g.nombre,g.fecha);
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td style="padding:9px 12px;border-bottom:1px solid var(--gray2);font-weight:600;">${g.nombre||'—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid var(--gray2);white-space:nowrap;">${fmtDate(g.fecha)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid var(--gray2);">${g.hora||'—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid var(--gray2);">${g.tipo||'—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid var(--gray2);">${g.participante||'—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid var(--gray2);">${g.locacion||'—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid var(--gray2);">${resps||'—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid var(--gray2);"><span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;${bstyle}">${g.estado}</span></td>
      <td style="padding:9px 12px;border-bottom:1px solid var(--gray2);white-space:nowrap;">
        <button onclick="openEditGrab('${g.id}')" style="background:var(--gray);border:none;border-radius:5px;padding:4px 8px;font-size:10px;font-weight:600;cursor:pointer;margin-right:4px;">Editar</button>
        <a href="${calUrl}" target="_blank" style="background:none;border:1px solid var(--gray2);border-radius:5px;padding:3px 7px;font-size:10px;font-weight:600;color:var(--muted);text-decoration:none;margin-right:4px;">📅</a>
        <button onclick="deleteGrab('${g.id}','${(g.nombre||'').replace(/'/g,"\\'")}')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:2px 4px;">🗑</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// GRAB MODAL
window.openGrabModal=(dateStr)=>{
  editGrabId=null;
  $('grabMTitle').textContent='Nueva Grabación';
  $('gNombre').value='';$('gFecha').value=dateStr||'';$('gHora').value='';
  $('gTipo').value='';$('gEst').value='Pendiente';$('gPart').value='';
  $('gProps').value='';$('gLoc').value='';$('gEq').value='';
  document.querySelectorAll('#grabEncWrap .enc-opt').forEach(b=>b.classList.remove('sel'));
  $('grabModal').style.display='block';
  setTimeout(()=>$('gNombre').focus(),100);
};
window.openEditGrab=id=>{
  editGrabId=id;const g=grabs.find(x=>x.id===id)||{};
  $('grabMTitle').textContent='Editar Grabación';
  $('gNombre').value=g.nombre||'';$('gFecha').value=g.fecha||'';$('gHora').value=g.hora||'';
  $('gTipo').value=g.tipo||'';$('gEst').value=g.estado||'Pendiente';$('gPart').value=g.participante||'';
  $('gProps').value=g.props||'';$('gLoc').value=g.locacion||'';$('gEq').value=g.equipos||'';
  document.querySelectorAll('#grabEncWrap .enc-opt').forEach(b=>b.classList.toggle('sel',(g.responsables||[]).includes(b.dataset.name)));
  $('grabModal').style.display='block';
};
window.closeGrabModal=()=>{$('grabModal').style.display='none';editGrabId=null;};
window.toggleGrabEnc=btn=>btn.classList.toggle('sel');

window.saveGrab=async()=>{
  const nombre=$('gNombre').value.trim(),fecha=$('gFecha').value;
  if(!nombre||!fecha){showToast('Nombre y fecha son obligatorios','⚠️');return;}
  const responsables=[...document.querySelectorAll('#grabEncWrap .enc-opt.sel')].map(b=>b.dataset.name);
  const btn=$('btnSaveGrab');btn.disabled=true;btn.textContent='Guardando...';setSync('s');
  const data={nombre,fecha,hora:$('gHora').value,tipo:$('gTipo').value,estado:$('gEst').value,
    participante:$('gPart').value,props:$('gProps').value,locacion:$('gLoc').value,
    equipos:$('gEq').value,responsables,updatedAt:serverTimestamp()};
  const isNew=!editGrabId;
  try{
    if(isNew){
      data.createdAt=serverTimestamp();
      await addDoc(grabsCol,data);
      // Crear tarea automática en el tablero de pendientes
      const tareaData={
        nombre:nombre,
        area:'Grabaciones',
        solicita:getUserFullName()||'Equipo TDC',
        categoria:'Audiovisual',
        encargados:responsables.length?responsables:[getUserFullName()||'Equipo TDC'],
        prioridad:'Media',
        estado:'Pendiente',
        fechaSol:today(),
        fechaEnt:fecha,
        descripcion:'Grabación agendada: '+(($('gTipo').value)||'—')+' · Locación: '+(($('gLoc').value)||'—'),
        cancelReason:'',
        origenGrabacion:true,
        updatedAt:serverTimestamp()
      };
      const tareaRef=await addDoc(tasksCol,tareaData);
      console.log('Tarea creada desde grabación:',tareaRef.id);
      if(responsables.length)sendNewEmails({...tareaData,encargados:responsables},tareaRef.id);
    }
    else{await updateDoc(doc(db,'grabaciones',editGrabId),data);}
    window.closeGrabModal();
    showToast(isNew?'Grabación creada y agregada al tablero ✓':'Grabación actualizada ✓');
    if(isNew)setTimeout(()=>window.showCalPopup(nombre,fecha),400);
    renderCal();
  }catch(e){showToast('Error al guardar','⚠️');setSync('error');}
  btn.disabled=false;btn.textContent='Guardar grabación';
};

window.deleteGrab=async(id,nombre)=>{
  if(!confirm(`¿Eliminar "${nombre}"?`))return;
  setSync('s');try{await deleteDoc(doc(db,'grabaciones',id));showToast('Eliminada','🗑');renderCal();}catch(e){showToast('Error','⚠️');}
};

// PROYECTOS (CUADRO MATRIZ)
const PROY_ESTADO_CLASS={'En planos':'pe-planos','Preventa':'pe-preventa','En construcción':'pe-constr','Entrega inmediata':'pe-entrega','Entregado':'pe-entregado'};
const esc=s=>(s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function filteredProyectos(){
  const q=($('pfBuscar').value||'').trim().toLowerCase();
  const fE=$('pfEstado').value,fP=$('pfPri').value;
  return proyectos.filter(p=>{
    if(fE&&p.estado!==fE)return false;
    if(fP&&p.prioridad!==fP)return false;
    if(q){
      const hay=[p.comercial,p.tecnico,p.direccion,p.respNombre].map(x=>(x||'').toLowerCase()).join(' ');
      if(!hay.includes(q))return false;
    }
    return true;
  });
}
window.clearPF=()=>{$('pfBuscar').value='';$('pfEstado').value='';$('pfPri').value='';renderProyectos();};

function renderProyectos(){
  if(!$('proyList'))return;
  const adminEdit=isAdmin();
  ['btnNewProy','btnSeedProy','btnLoadUnid'].forEach(id=>{const b=$(id);if(b)b.style.display=adminEdit?'':'none';});
  $('pTotal').textContent=proyectos.length;
  $('pPrev').textContent=proyectos.filter(p=>p.estado==='Preventa').length;
  $('pConstr').textContent=proyectos.filter(p=>p.estado==='En construcción').length;
  $('pEntr').textContent=proyectos.filter(p=>p.estado==='Entrega inmediata').length;
  const tbody=$('proyList');tbody.innerHTML='';
  const list=filteredProyectos();
  if(!list.length){tbody.innerHTML='<tr><td colspan="10" class="proy-empty">No hay proyectos que coincidan. Crea uno con «Nuevo Proyecto».</td></tr>';return;}
  const po={Alta:0,Media:1,Baja:2};
  [...list].sort((a,b)=>(po[a.prioridad]??1)-(po[b.prioridad]??1)||(a.comercial||'').localeCompare(b.comercial||'')).forEach(p=>{
    const pc=p.prioridad==='Alta'?'p-a':p.prioridad==='Media'?'p-m':'p-b';
    const ec=PROY_ESTADO_CLASS[p.estado]||'pe-planos';
    const tel=(p.respTel||'').trim(),mail=(p.respMail||'').trim();
    const telLink=tel?`<a href="tel:${esc(tel.replace(/\s/g,''))}">📞 ${esc(tel)}</a>`:'';
    const mailLink=mail?`<a href="mailto:${esc(mail)}">✉️ ${esc(mail)}</a>`:'';
    const resp=(p.respNombre||tel||mail)?`<div class="proy-resp"><span class="pr-name">${esc(p.respNombre||'—')}</span>${telLink}${mailLink}</div>`:'<span style="color:var(--muted)">—</span>';
    const uds=p.unidades||[];
    const totU=uds.length||parseInt(p.totalUnidades)||0;
    const dispU=uds.filter(u=>u.estado==='Disponible').length;
    let unidCell;
    if(uds.length){
      const pct=totU?Math.round((dispU/totU)*100):0;
      unidCell=`<div class="unid-cell">
        <span class="unid-count"><span class="${dispU>0?'uc-disp':'uc-zero'}">${dispU}</span> / ${totU} disp.</span>
        <div class="unid-bar"><div class="unid-bar-fill" style="width:${pct}%;${dispU===0?'background:var(--red)':''}"></div></div>
        <button class="btn-unid" onclick="openUnidModal('${p.id}')">${adminEdit?'Ver / editar':'Ver'}</button>
      </div>`;
    }else{
      unidCell=`<div class="unid-cell">
        <span class="unid-count" style="color:var(--muted);font-weight:600;">${totU?totU+' und. (sin cargar)':'—'}</span>
        ${adminEdit?`<button class="btn-unid" onclick="openUnidModal('${p.id}')">+ Agregar</button>`:''}
      </div>`;
    }
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><div class="proy-name">${esc(p.comercial||'Sin nombre')}</div>${p.tecnico?`<div class="proy-tech">${esc(p.tecnico)}</div>`:''}</td>
      <td><span class="proy-badge ${ec}">${esc(p.estado||'—')}</span></td>
      <td><span class="pri-badge ${pc}">${esc(p.prioridad||'—')}</span></td>
      <td><span class="proy-num">${esc(p.metraje||'—')}</span></td>
      <td><span class="proy-num">${esc(p.pisos||'—')}</span></td>
      <td>${unidCell}</td>
      <td><div class="proy-precios">${p.precios?esc(p.precios):'—'}</div></td>
      <td><div class="proy-dir">${esc(p.direccion||'—')}</div></td>
      <td>${resp}</td>
      <td class="proy-acts">
        ${adminEdit?`<button class="btn-edit" onclick="openEditProy('${p.id}')">Editar</button>
        <button class="btn-del" onclick="deleteProy('${p.id}','${(p.comercial||'').replace(/'/g,"\\'")}')">🗑</button>`:'<span style="color:var(--text-faint);font-size:11px;">Solo lectura</span>'}
      </td>`;
    tbody.appendChild(tr);
  });
}
window.renderProyectos=renderProyectos;

const RESPONSABLES_PROY={
  'Fabiola Trebejo':{tel:'912 456 165',mail:'ftrebejo@taller.pe'},
  'Carmelina Castro':{tel:'924 323 094',mail:'ccastro@taller.pe'},
  'Mónica Zegarra':{tel:'906 388 988',mail:'mzegarra@taller.pe'}
};
window.onRespChange=()=>{
  const v=$('pRespSel').value;
  if(v==='__otro'){
    $('pRespNombreRow').style.display='block';
    $('pRespNombre').value='';$('pRespTel').value='';$('pRespMail').value='';
    setTimeout(()=>$('pRespNombre').focus(),50);
  }else if(v&&RESPONSABLES_PROY[v]){
    $('pRespNombreRow').style.display='none';
    $('pRespNombre').value=v;
    $('pRespTel').value=RESPONSABLES_PROY[v].tel;
    $('pRespMail').value=RESPONSABLES_PROY[v].mail;
  }else{
    $('pRespNombreRow').style.display='none';
    $('pRespNombre').value='';$('pRespTel').value='';$('pRespMail').value='';
  }
};
function fillProy(p){
  $('pComercial').value=p.comercial||'';$('pTecnico').value=p.tecnico||'';
  $('pEstado').value=p.estado||'En planos';$('pPrioridad').value=p.prioridad||'Media';
  $('pMetraje').value=p.metraje||'';$('pPisos').value=p.pisos||'';
  $('pTotalUnid').value=p.totalUnidades||'';$('pAnio').value=p.anio||'';
  $('pDireccion').value=p.direccion||'';$('pTipologias').value=p.tipologias||'';
  $('pPrecios').value=p.precios||'';$('pDescripcion').value=p.descripcion||'';
  $('pRespNombre').value=p.respNombre||'';
  $('pRespTel').value=p.respTel||'';$('pRespMail').value=p.respMail||'';
  // sincroniza el selector de responsable
  const nombre=p.respNombre||'';
  if(nombre&&RESPONSABLES_PROY[nombre]){$('pRespSel').value=nombre;$('pRespNombreRow').style.display='none';}
  else if(nombre){$('pRespSel').value='__otro';$('pRespNombreRow').style.display='block';}
  else{$('pRespSel').value='';$('pRespNombreRow').style.display='none';}
}
const guardAdmin=()=>{if(!isAdmin()){showToast('Solo los administradores pueden editar','🔒');return false;}return true;};
window.openProyModal=()=>{
  if(!guardAdmin())return;
  editProyId=null;
  $('proyMTitle').textContent='Nuevo Proyecto';
  fillProy({});
  $('proyModal').style.display='block';
  setTimeout(()=>$('pComercial').focus(),100);
};
window.openEditProy=id=>{
  if(!guardAdmin())return;
  editProyId=id;const p=proyectos.find(x=>x.id===id)||{};
  $('proyMTitle').textContent='Editar Proyecto';
  fillProy(p);
  $('proyModal').style.display='block';
};
window.closeProyModal=()=>{$('proyModal').style.display='none';editProyId=null;};

window.saveProy=async()=>{
  if(!guardAdmin())return;
  const comercial=$('pComercial').value.trim();
  if(!comercial){$('pComercial').focus();showToast('El nombre comercial es obligatorio','⚠️');return;}
  const btn=$('btnSaveProy');btn.disabled=true;btn.textContent='Guardando...';setSync('s');
  const data={
    comercial,tecnico:$('pTecnico').value.trim(),estado:$('pEstado').value,prioridad:$('pPrioridad').value,
    metraje:$('pMetraje').value.trim(),pisos:$('pPisos').value.trim(),totalUnidades:$('pTotalUnid').value.trim(),
    anio:$('pAnio').value.trim(),direccion:$('pDireccion').value.trim(),tipologias:$('pTipologias').value.trim(),
    precios:$('pPrecios').value.trim(),descripcion:$('pDescripcion').value.trim(),
    respNombre:$('pRespNombre').value.trim(),respTel:$('pRespTel').value.trim(),respMail:$('pRespMail').value.trim(),
    updatedAt:serverTimestamp()
  };
  const isNew=!editProyId;
  try{
    if(isNew){data.createdAt=serverTimestamp();await addDoc(proyectosCol,data);}
    else{await updateDoc(doc(db,'proyectos',editProyId),data);}
    window.closeProyModal();
    showToast(isNew?'Proyecto creado ✓':'Proyecto actualizado ✓');
    setSync('ok');
  }catch(e){showToast('Error al guardar','⚠️');setSync('error');}
  btn.disabled=false;btn.textContent='Guardar proyecto';
};

window.deleteProy=async(id,nombre)=>{
  if(!guardAdmin())return;
  if(!confirm(`¿Eliminar el proyecto "${nombre}"?`))return;
  setSync('s');try{await deleteDoc(doc(db,'proyectos',id));showToast('Proyecto eliminado','🗑');setSync('ok');}catch(e){showToast('Error','⚠️');setSync('error');}
};

// UNIDADES (DEPARTAMENTOS) POR PROYECTO
const UNID_ESTADOS=['Disponible','Reservado','Vendido'];
function unidRowHTML(u={}){
  const e=u.estado&&UNID_ESTADOS.includes(u.estado)?u.estado:'Disponible';
  const opts=UNID_ESTADOS.map(s=>`<option${s===e?' selected':''}>${s}</option>`).join('');
  return `<tr>
    <td><input class="u-cod" value="${esc(u.codigo||'')}" placeholder="LC-101"/></td>
    <td><input class="u-tip" value="${esc(u.tipologia||'')}" placeholder="Flat / Dúplex"/></td>
    <td><input class="u-area" value="${esc(u.area||'')}" placeholder="80 m²"/></td>
    <td><input class="u-dorm" value="${esc(u.dorm||'')}" placeholder="2"/></td>
    <td><select class="u-vista"><option value=""${!u.vista?' selected':''}>—</option><option${u.vista==='Exterior'?' selected':''}>Exterior</option><option${u.vista==='Interior'?' selected':''}>Interior</option></select></td>
    <td class="u-estac-cell"><input type="checkbox" class="u-estac"${u.estacionamiento?' checked':''} title="¿Cuenta con estacionamiento?"/></td>
    <td><input class="u-precio" value="${esc(u.precio||'')}" placeholder="S/ 717,500"/></td>
    <td><select class="u-est st-${e}" onchange="this.className='u-est st-'+this.value;refreshUnidSummary();">${opts}</select></td>
    <td><button class="unid-rm" onclick="this.closest('tr').remove();refreshUnidSummary();" title="Eliminar">🗑</button></td>
  </tr>`;
}
function refreshUnidSummary(){
  const rows=[...document.querySelectorAll('#unidList tr')];
  const cnt={Disponible:0,Reservado:0,Vendido:0};
  rows.forEach(r=>{const v=r.querySelector('.u-est')?.value;if(cnt[v]!==undefined)cnt[v]++;});
  $('unidSummary').innerHTML=
    `<span><span class="us-dot" style="background:var(--green)"></span>Disponibles: <strong>${cnt.Disponible}</strong></span>`+
    `<span><span class="us-dot" style="background:var(--yellow)"></span>Reservados: <strong>${cnt.Reservado}</strong></span>`+
    `<span><span class="us-dot" style="background:var(--red)"></span>Vendidos: <strong>${cnt.Vendido}</strong></span>`+
    `<span style="margin-left:auto;color:var(--muted)">Total: <strong>${rows.length}</strong></span>`;
}
window.refreshUnidSummary=refreshUnidSummary;
window.addUnidRow=(u)=>{
  const empty=$('unidList').querySelector('.unid-empty-row');if(empty)empty.remove();
  $('unidList').insertAdjacentHTML('beforeend',unidRowHTML(u&&u.target?{}:u));
  refreshUnidSummary();
};
window.openUnidModal=id=>{
  unidProyId=id;const p=proyectos.find(x=>x.id===id)||{};
  const ro=!isAdmin();
  $('unidProyName').textContent=(p.comercial||'Proyecto')+(ro?' (solo lectura)':'');
  const tbody=$('unidList');tbody.innerHTML='';
  (p.unidades||[]).forEach(u=>tbody.insertAdjacentHTML('beforeend',unidRowHTML(u)));
  if(!tbody.children.length)tbody.innerHTML=`<tr class="unid-empty-row"><td colspan="9" class="unid-empty">Aún no hay unidades${ro?'.':'. Usa «+ Agregar unidad» para crearlas.'}</td></tr>`;
  refreshUnidSummary();
  // permisos: no-admin solo visualiza
  $('btnSaveUnid').style.display=ro?'none':'';
  document.querySelector('#unidModal .btn-add-unid').style.display=ro?'none':'';
  $('btnCancelUnid').textContent=ro?'Cerrar':'Cancelar';
  if(ro){
    document.querySelectorAll('#unidList input,#unidList select').forEach(el=>{el.disabled=true;});
    document.querySelectorAll('#unidList .unid-rm').forEach(b=>{b.style.display='none';});
  }
  $('unidModal').style.display='block';
};
window.closeUnidModal=()=>{$('unidModal').style.display='none';unidProyId=null;};
window.saveUnid=async()=>{
  if(!guardAdmin())return;
  if(!unidProyId)return;
  const unidades=[...document.querySelectorAll('#unidList tr')].filter(r=>!r.classList.contains('unid-empty-row')).map(r=>({
    codigo:r.querySelector('.u-cod').value.trim(),
    tipologia:r.querySelector('.u-tip').value.trim(),
    area:r.querySelector('.u-area').value.trim(),
    dorm:r.querySelector('.u-dorm').value.trim(),
    vista:r.querySelector('.u-vista').value.trim(),
    estacionamiento:r.querySelector('.u-estac').checked,
    precio:r.querySelector('.u-precio').value.trim(),
    estado:r.querySelector('.u-est').value
  })).filter(u=>u.codigo||u.tipologia||u.area||u.precio);
  const btn=$('btnSaveUnid');btn.disabled=true;btn.textContent='Guardando...';setSync('s');
  try{
    await updateDoc(doc(db,'proyectos',unidProyId),{unidades,updatedAt:serverTimestamp()});
    window.closeUnidModal();showToast('Unidades actualizadas ✓');setSync('ok');
  }catch(e){showToast('Error al guardar','⚠️');setSync('error');}
  btn.disabled=false;btn.textContent='Guardar unidades';
};

// SEED: cargar los 5 proyectos desde las fichas
const SEED_PROYECTOS=[
  {comercial:'Las Moras',tecnico:'LM 2',estado:'En construcción',prioridad:'Media',anio:'2026',pisos:'5',totalUnidades:'12',metraje:'121 m² - 300 m²',tipologias:'Flats y dúplex · 2 – 3 dorm',direccion:'Ca. Las Moras 315, Miraflores',precios:'S/ 717,500 - S/ 1 470,000',descripcion:'Las Moras, en Miraflores, es un edificio de 5 pisos con 12 departamentos (flats y dúplex desde 121 m² hasta 300 m²), ubicado frente al parque Francisco García Calderón. Combina vistas privilegiadas, entorno natural y cercanía a servicios, ofreciendo una vida tranquila sin perder conexión con la ciudad.',unidades:[]},
  {comercial:'Boloña 675',tecnico:'A3',estado:'Preventa',prioridad:'Alta',anio:'2025',pisos:'7',totalUnidades:'16',metraje:'100 m² - 278 m²',tipologias:'Flats y dúplex · 2 – 3 dorm',direccion:'Av. Roca y Boloña 675, Miraflores',precios:'$ 219,000 - $ 489,000',descripcion:'Boloña 675, en Miraflores, es un edificio de 7 pisos con 16 departamentos (flats y dúplex desde 100 m² hasta 278 m²), diseñados para una vida moderna y confortable, con altos estándares de calidad. Su ubicación equilibra seguridad y conectividad.',unidades:[]},
  {comercial:'Cochrane 366',tecnico:'LC',estado:'En construcción',prioridad:'Alta',anio:'2025',pisos:'9',totalUnidades:'32',metraje:'80 m² - 189 m²',tipologias:'Flats y dúplex · 2 – 3 dorm',direccion:'Ca. Lord Cochrane 366, Miraflores',precios:'S/ 717,500 - S/ 1 470,000',descripcion:'Cochrane 366, en Miraflores, es un edificio de 9 pisos y 32 departamentos (flats y dúplex desde 80 m² hasta 230 m²), pensado para una vida cómoda y caminable: parques cerca y lugares del día a día como Pastelería San Antonio, Wong Óvalo Gutiérrez y Cineplanet Alcázar.',unidades:[{codigo:'LC-101',tipologia:'Dúplex',area:'189 m²',dorm:'3',vista:'Exterior',precio:'S/ 1 470,000',estado:'Disponible'}]},
  {comercial:'Castilla',tecnico:'PC',estado:'Entregado',prioridad:'Baja',anio:'2024',pisos:'4',totalUnidades:'10',metraje:'80 m² - 189 m²',tipologias:'Flats y dúplex · 2 – 3 dorm',direccion:'Ca. Pedro Venturo 423, Miraflores',precios:'$ 380,000',descripcion:'Castilla, en Miraflores, es un edificio con 10 departamentos (flats y dúplex desde 80 m² hasta 189 m²). Cada espacio fue diseñado con acabados exclusivos y materiales seleccionados por su durabilidad y elegancia.',unidades:[]},
  {comercial:'Two Flex One',tecnico:'AQ',estado:'Entregado',prioridad:'Baja',anio:'2024',pisos:'5',totalUnidades:'18',metraje:'93 m² - 248 m²',tipologias:'Flats y dúplex · 2 – 3 dorm',direccion:'Ca. Antequera 611, San Isidro',precios:'S/ 896,400 - S/ 1 184,400',descripcion:'Two Flex One, en San Isidro, es un edificio de 5 pisos con 18 departamentos (flats y dúplex desde 93 m² hasta 248 m²), diseñado para un estilo de vida vinculado a la dinámica corporativa. En el corazón financiero y rodeado de parques.',unidades:[]},
  {comercial:'Las Moras 3',tecnico:'LM 3',estado:'Preventa',prioridad:'Alta',anio:'2026',pisos:'5',totalUnidades:'14',metraje:'145 m² - 371 m²',tipologias:'Flats, dúplex y tríplex · 3 – 5 dorm',direccion:'Ca. Las Moras, Miraflores',precios:'$ 366,000 - $ 779,000',descripcion:'Las Moras 3, en Miraflores — nueva etapa con flats, dúplex y tríplex desde 145 m² hasta 371 m². (Verificar dirección y datos en ficha oficial.)',unidades:[]}
];
window.seedProyectos=async()=>{
  if(!guardAdmin())return;
  const existentes=new Set(proyectos.map(p=>(p.comercial||'').toLowerCase()));
  const faltan=SEED_PROYECTOS.filter(p=>!existentes.has(p.comercial.toLowerCase()));
  if(!faltan.length){showToast('Los proyectos ya están cargados','ℹ️');return;}
  if(!confirm(`Se crearán ${faltan.length} proyecto(s): ${faltan.map(p=>p.comercial).join(', ')}. ¿Continuar?`))return;
  const btn=$('btnSeedProy');btn.disabled=true;btn.textContent='Cargando...';setSync('s');
  try{
    for(const p of faltan){await addDoc(proyectosCol,{...p,respNombre:'',respTel:'',respMail:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});}
    showToast(`${faltan.length} proyecto(s) cargado(s) ✓`);setSync('ok');
  }catch(e){showToast('Error al cargar (revisa permisos de Firestore)','⚠️');setSync('error');}
  btn.disabled=false;btn.textContent='⬇ Cargar proyectos iniciales';
};

// UNIDADES desde listas de precios (extraídas de los PDF). Estado: LIBRE→Disponible, SEPARADO→Reservado, VENDIDO→Vendido
const UNITS_BY_PROYECTO={
  "Cochrane 366": [{codigo:"S01",tipologia:"Flat",area:"201 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"101",tipologia:"Dúplex",area:"189 m²",dorm:"3 + Escritorio",vista:"Exterior",precio:"S/ 1.470.000,00",estado:"Disponible"},{codigo:"102",tipologia:"Flat",area:"87.5 m²",dorm:"2",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"103",tipologia:"Flat",area:"80 m²",dorm:"2",vista:"Interior",precio:"S/ 717.500,00",estado:"Disponible"},{codigo:"201",tipologia:"Flat",area:"115 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"202",tipologia:"Flat",area:"112 m²",dorm:"3",vista:"Exterior",precio:"S/ 1.085.000,00",estado:"Disponible"},{codigo:"203",tipologia:"Flat",area:"80 m²",dorm:"2",vista:"Interior",precio:"",estado:"Vendido"},{codigo:"204",tipologia:"Dúplex",area:"88 m²",dorm:"2",vista:"Interior",precio:"",estado:"Reservado"},{codigo:"301",tipologia:"Flat",area:"115 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"302",tipologia:"Flat",area:"112 m²",dorm:"3",vista:"Exterior",precio:"S/ 1.102.500,00",estado:"Disponible"},{codigo:"303",tipologia:"Flat",area:"80 m²",dorm:"2",vista:"Interior",precio:"",estado:"Vendido"},{codigo:"401",tipologia:"Flat",area:"115 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"402",tipologia:"Flat",area:"112 m²",dorm:"3",vista:"Exterior",precio:"S/ 1.102.500,00",estado:"Disponible"},{codigo:"403",tipologia:"Flat",area:"80 m²",dorm:"2",vista:"Interior",precio:"S/ 724.500,00",estado:"Disponible"},{codigo:"404",tipologia:"Dúplex",area:"84 m²",dorm:"2",vista:"Interior",precio:"",estado:"Vendido"},{codigo:"501",tipologia:"Flat",area:"115 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"502",tipologia:"Flat",area:"112 m²",dorm:"3",vista:"Exterior",precio:"S/ 1.102.500,00",estado:"Disponible"},{codigo:"503",tipologia:"Flat",area:"80 m²",dorm:"2",vista:"Interior",precio:"",estado:"Vendido"},{codigo:"601",tipologia:"Flat",area:"115 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"602",tipologia:"Flat",area:"110 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"603",tipologia:"Flat",area:"80 m²",dorm:"2",vista:"Interior",precio:"",estado:"Vendido"},{codigo:"604",tipologia:"Dúplex",area:"84 m²",dorm:"2",vista:"Interior",precio:"",estado:"Vendido"},{codigo:"701",tipologia:"Flat",area:"115 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"702",tipologia:"Flat",area:"112 m²",dorm:"3",vista:"Exterior",precio:"S/ 1.120.000,00",estado:"Disponible"},{codigo:"703",tipologia:"Flat",area:"120 m²",dorm:"3 + Escritorio",vista:"Interior",precio:"S/ 1.067.500,00",estado:"Disponible"},{codigo:"801",tipologia:"Flat",area:"115 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"802",tipologia:"Flat",area:"112 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"803",tipologia:"Flat",area:"80 m²",dorm:"2",vista:"Interior",precio:"",estado:"Vendido"},{codigo:"804",tipologia:"Tríplex",area:"108 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"901",tipologia:"Dúplex",area:"230 m²",dorm:"3 + Estar",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"902",tipologia:"Dúplex",area:"227.02 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"903",tipologia:"Dúplex",area:"157 m²",dorm:"2 + Estar",vista:"Interior",precio:"S/ 1.102.500,00",estado:"Disponible"}],
  "Boloña 675": [{codigo:"S01",tipologia:"Flat",area:"119 m²",dorm:"2",vista:"Exterior",precio:"$ 219.000,00",estado:"Disponible"},{codigo:"S02",tipologia:"Flat",area:"118 m²",dorm:"2",vista:"Exterior",precio:"$ 225.000,00",estado:"Disponible"},{codigo:"101",tipologia:"Flat",area:"121 m²",dorm:"3",vista:"Exterior",precio:"$ 245.900,00",estado:"Disponible"},{codigo:"102",tipologia:"Flat",area:"100 m²",dorm:"2+ Escritorio",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"201",tipologia:"Flat",area:"139 m²",dorm:"3+ Escritorio",vista:"Exterior",precio:"$ 280.100,00",estado:"Disponible"},{codigo:"202",tipologia:"Flat",area:"139 m²",dorm:"3+ Escritorio",vista:"Exterior",precio:"$ 280.100,00",estado:"Disponible"},{codigo:"301",tipologia:"Flat",area:"139 m²",dorm:"3+ Escritorio",vista:"Exterior",precio:"$ 285.700,00",estado:"Disponible"},{codigo:"302",tipologia:"Flat",area:"139 m²",dorm:"3+ Escritorio",vista:"Exterior",precio:"$ 285.700,00",estado:"Disponible"},{codigo:"401",tipologia:"Flat",area:"139 m²",dorm:"3+ Escritorio",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"402",tipologia:"Flat",area:"139 m²",dorm:"3+ Escritorio",vista:"Exterior",precio:"$ 291.300,00",estado:"Disponible"},{codigo:"501",tipologia:"Flat",area:"139 m²",dorm:"3+ Escritorio",vista:"Exterior",precio:"$ 296.900,00",estado:"Disponible"},{codigo:"502",tipologia:"Flat",area:"139 m²",dorm:"3+ Escritorio",vista:"Exterior",precio:"$ 296.900,00",estado:"Disponible"},{codigo:"601",tipologia:"Flat",area:"139 m²",dorm:"3+ Escritorio",vista:"Exterior",precio:"$ 302.500,00",estado:"Disponible"},{codigo:"602",tipologia:"Flat",area:"139 m²",dorm:"3+ Escritorio",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"701",tipologia:"Dúplex",area:"278 m²",dorm:"4+ Escritorio",vista:"Exterior",precio:"$ 489.000,00",estado:"Disponible"},{codigo:"702",tipologia:"Dúplex",area:"278 m²",dorm:"4+ Escritorio",vista:"Exterior",precio:"$ 489.000,00",estado:"Disponible"}],
  "Las Moras": [{codigo:"S01",tipologia:"Flat",area:"125 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Reservado"},{codigo:"S02",tipologia:"Flat",area:"169 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"101",tipologia:"Flat",area:"121 m²",dorm:"2 + 1 Escritorio",vista:"Exterior",precio:"$ 314.600,00",estado:"Disponible"},{codigo:"102",tipologia:"Flat",area:"140 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"201",tipologia:"Flat",area:"139 m²",dorm:"3",vista:"Exterior",precio:"$ 361.400,00",estado:"Disponible"},{codigo:"202",tipologia:"Flat",area:"164 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"301",tipologia:"Flat",area:"150 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Reservado"},{codigo:"302",tipologia:"Flat",area:"150 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"401",tipologia:"Flat",area:"139 m²",dorm:"3",vista:"Exterior",precio:"$ 361.400,00",estado:"Disponible"},{codigo:"402",tipologia:"Flat",area:"164 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"501",tipologia:"Dúplex",area:"300 m²",dorm:"3 + 1 Escritorio",vista:"Exterior",precio:"$ 600.000,00",estado:"Disponible"},{codigo:"502",tipologia:"Dúplex",area:"300 m²",dorm:"3 + 1 Escritorio",vista:"Exterior",precio:"",estado:"Vendido"}],
  "Castilla": [{codigo:"S01",tipologia:"Flat",area:"127 m²",dorm:"3",vista:"",precio:"",estado:"Vendido"},{codigo:"S02",tipologia:"Flat",area:"174 m²",dorm:"3",vista:"",precio:"",estado:"Reservado"},{codigo:"101",tipologia:"",area:"114 m²",dorm:"",vista:"",precio:"",estado:"Vendido"},{codigo:"102",tipologia:"",area:"150 m²",dorm:"",vista:"",precio:"",estado:"Vendido"},{codigo:"201",tipologia:"",area:"150 m²",dorm:"",vista:"",precio:"",estado:"Vendido"},{codigo:"202",tipologia:"",area:"150 m²",dorm:"",vista:"",precio:"",estado:"Vendido"},{codigo:"301",tipologia:"",area:"135 m²",dorm:"",vista:"",precio:"",estado:"Vendido"},{codigo:"302",tipologia:"",area:"163 m²",dorm:"",vista:"",precio:"",estado:"Vendido"},{codigo:"401",tipologia:"",area:"300 m²",dorm:"",vista:"",precio:"",estado:"Vendido"},{codigo:"402",tipologia:"",area:"300 m²",dorm:"",vista:"",precio:"",estado:"Vendido"}],
  "Two Flex One": [{codigo:"101",tipologia:"Flat",area:"148 m²",dorm:"2",vista:"Interior",precio:"",estado:"Vendido"},{codigo:"102",tipologia:"Dúplex",area:"131 m²",dorm:"3",vista:"Exterior",precio:"S/ 943.200,00",estado:"Disponible"},{codigo:"103",tipologia:"Dúplex",area:"136 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"104",tipologia:"Dúplex",area:"142 m²",dorm:"2",vista:"Exterior",precio:"S/ 896.400,00",estado:"Disponible"},{codigo:"201",tipologia:"Flat",area:"93 m²",dorm:"2",vista:"Interior",precio:"",estado:"Vendido"},{codigo:"202",tipologia:"Flat",area:"70 m²",dorm:"1",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"203",tipologia:"Flat",area:"108 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"204",tipologia:"Dúplex",area:"110 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"301",tipologia:"Flat",area:"93 m²",dorm:"2",vista:"Interior",precio:"",estado:"Vendido"},{codigo:"302",tipologia:"Flat",area:"70 m²",dorm:"2",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"303",tipologia:"Flat",area:"121 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"401",tipologia:"Flat",area:"93 m²",dorm:"2",vista:"Interior",precio:"",estado:"Vendido"},{codigo:"402",tipologia:"Flat",area:"70 m²",dorm:"2",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"403",tipologia:"Flat",area:"108 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"404",tipologia:"Tríplex",area:"164 m²",dorm:"3",vista:"Exterior",precio:"S/ 1.112.400,00",estado:"Disponible"},{codigo:"501",tipologia:"Dúplex",area:"186 m²",dorm:"3",vista:"Interior",precio:"S/ 1.184.400,00",estado:"Disponible"},{codigo:"502",tipologia:"Dúplex",area:"140 m²",dorm:"2",vista:"Exterior",precio:"",estado:"Vendido"},{codigo:"503",tipologia:"Dúplex",area:"248 m²",dorm:"3",vista:"Exterior",precio:"",estado:"Vendido"}],
  "Las Moras 3": [{codigo:"S01",tipologia:"Flat",area:"178 m²",dorm:"3",vista:"Exterior",precio:"$385.000",estado:"Disponible"},{codigo:"S02",tipologia:"Dúplex",area:"305 m²",dorm:"4 + Escritorio",vista:"Exterior",precio:"$638.000",estado:"Disponible"},{codigo:"101",tipologia:"Flat",area:"145 m²",dorm:"3",vista:"Exterior",precio:"$366.000",estado:"Disponible"},{codigo:"102",tipologia:"Flat",area:"150 m²",dorm:"3",vista:"Exterior",precio:"$379.000",estado:"Disponible"},{codigo:"201",tipologia:"Flat",area:"150 m²",dorm:"3",vista:"Exterior",precio:"$385.000",estado:"Disponible"},{codigo:"202",tipologia:"Flat",area:"185 m²",dorm:"4",vista:"Exterior",precio:"$477.000",estado:"Disponible"},{codigo:"203",tipologia:"Dúplex",area:"146 m²",dorm:"3",vista:"Exterior",precio:"$376.000",estado:"Disponible"},{codigo:"301",tipologia:"Flat",area:"150 m²",dorm:"3",vista:"Exterior",precio:"$392.000",estado:"Disponible"},{codigo:"302",tipologia:"Flat",area:"185 m²",dorm:"4",vista:"Exterior",precio:"$485.000",estado:"Disponible"},{codigo:"401",tipologia:"Flat",area:"150 m²",dorm:"3",vista:"Exterior",precio:"$399.000",estado:"Disponible"},{codigo:"402",tipologia:"Flat",area:"185 m²",dorm:"4",vista:"Exterior",precio:"$494.000",estado:"Disponible"},{codigo:"403",tipologia:"Tríplex",area:"219 m²",dorm:"3",vista:"Exterior",precio:"$520.000",estado:"Disponible"},{codigo:"501",tipologia:"Dúplex",area:"299 m²",dorm:"4",vista:"Exterior",precio:"$629.000",estado:"Disponible"},{codigo:"502",tipologia:"Dúplex",area:"371 m²",dorm:"5",vista:"Exterior",precio:"$779.000",estado:"Disponible"}]
};
window.loadUnidadesPrecios=async()=>{
  if(!guardAdmin())return;
  const objetivo=proyectos.filter(p=>UNITS_BY_PROYECTO[p.comercial]);
  if(!objetivo.length){showToast('Primero crea los proyectos (Cargar proyectos iniciales)','ℹ️');return;}
  const resumen=objetivo.map(p=>`${p.comercial} (${UNITS_BY_PROYECTO[p.comercial].length})`).join(', ');
  if(!confirm(`Se reemplazarán las unidades de: ${resumen}.\n\nEsto sobrescribe lo que tengan cargado. ¿Continuar?`))return;
  const btn=$('btnLoadUnid');btn.disabled=true;btn.textContent='Cargando...';setSync('s');
  let n=0;
  try{
    for(const p of objetivo){
      await updateDoc(doc(db,'proyectos',p.id),{unidades:UNITS_BY_PROYECTO[p.comercial],updatedAt:serverTimestamp()});
      n++;
    }
    showToast(`Unidades cargadas en ${n} proyecto(s) ✓`);setSync('ok');
  }catch(e){showToast('Error al cargar (revisa permisos de Firestore)','⚠️');setSync('error');}
  btn.disabled=false;btn.textContent='⬇ Cargar unidades (precios)';
};

// EMAILS
const emailsSentLocal=new Set();

async function sendNewEmails(t,taskId){
  if(!taskId)return;
  const cal=buildCalLink(t.nombre,t.fechaEnt);
  const encargados=[...new Set(t.encargados||[])];
  for(const enc of encargados){
    const key=taskId+'_'+enc;
    if(emailsSentLocal.has(key))continue;
    emailsSentLocal.add(key);
    const em=TEAM_EMAILS[enc];if(!em)continue;
    try{
      await emailjs.send(SVC,TPL_NEW,{
        to_email:em,encargado:enc,task_name:t.nombre,
        area:t.area,solicitante:t.solicita,prioridad:t.prioridad,
        fecha_entrega:fmtDate(t.fechaEnt),app_url:APP_URL,
        google_calendar_link:cal
      });
    }catch(e){console.error('Email error:',e);}
  }
}

const remindersSentLocal=new Set();

function checkReminders(){
  const tom=new Date();tom.setDate(tom.getDate()+1);const ts=tom.toISOString().split('T')[0];
  tasks.filter(t=>t.fechaEnt===ts&&t.estado!=='Completada'&&t.estado!=='Cancelada'&&!t.reminderSent).forEach(async t=>{
    if(remindersSentLocal.has(t.id))return;
    remindersSentLocal.add(t.id);
    await updateDoc(doc(db,'tareas_v2',t.id),{reminderSent:true});
    for(const enc of(t.encargados||[])){const em=TEAM_EMAILS[enc];if(!em)continue;
      try{await emailjs.send(SVC,TPL_REM,{to_email:em,encargado:enc,task_name:t.nombre,area:t.area,prioridad:t.prioridad,fecha_entrega:fmtDate(t.fechaEnt),app_url:APP_URL,google_calendar_link:buildCalLink(t.nombre,t.fechaEnt)});}catch(e){console.error(e);}
    }
  });
}

// COMPLETION BANNER
let bannerTimer=null;
function showCompletionBanner(nombre){
  $('compTaskName').textContent='"'+nombre+'"';
  const b=$('compBanner');b.classList.add('show');
  const p=$('compProg');p.style.transition='none';p.style.width='100%';
  setTimeout(()=>{p.style.transition='width 6s linear';p.style.width='0%';},50);
  clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>closeBanner(),6300);
}
window.closeBanner=()=>{$('compBanner').classList.remove('show');clearTimeout(bannerTimer);};

// ANALYTICS
const anSel=$('anMes');MESES.forEach((m,i)=>{const o=document.createElement('option');o.value=i;o.textContent=m;anSel.appendChild(o);});anSel.value=new Date().getMonth();

window.setAnView=v=>{
  anView=v;
  $('vGlobal').className='view-btn'+(v==='global'?' active':'');
  $('vPersonal').className='view-btn'+(v==='personal'?' active':'');
  // Admin selector solo en vista personal
  if(v==='personal'&&isAdmin()){$('adminPersonaSel').style.display='flex';}
  else{$('adminPersonaSel').style.display='none';}
  if(v==='global')$('personalCard').style.display='none';
  renderAnalytics();
};

window.renderAnalytics=()=>{
  const mes=parseInt($('anMes').value),year=parseInt($('anYear').value);
  const myName=getUserFullName();

  // Determine whose data to show
  let viewName=myName;
  if(anView==='personal'){
    if(isAdmin()){
      const sel=$('anPersona').value;
      viewName=sel||myName;
    } else {
      viewName=myName;
    }
  }

  let mt=tasks.filter(t=>{if(!t.fechaSol)return false;const d=new Date(t.fechaSol+'T00:00:00');return d.getMonth()===mes&&d.getFullYear()===year;});
  if(anView==='personal'){
    mt=mt.filter(t=>(t.encargados||[]).includes(viewName));
    const all=tasks.filter(t=>(t.encargados||[]).includes(viewName));
    $('personalCard').style.display='flex';
    $('anAvatar').textContent=initials(viewName);
    $('anName').textContent=viewName;
    $('psTot').textContent=all.length;
    $('psComp').textContent=all.filter(t=>t.estado==='Completada').length;
    $('psPend').textContent=all.filter(t=>t.estado==='Pendiente'||t.estado==='En Proceso').length;
    $('encChartTitle').textContent='📊 Estado de tareas de '+viewName.split(' ')[0];
  } else {
    $('personalCard').style.display='none';
    $('encChartTitle').textContent='👥 Tareas por encargado';
  }

  const comp=mt.filter(t=>t.estado==='Completada');
  const pend=mt.filter(t=>t.estado==='Pendiente'||t.estado==='En Proceso');
  const canc=mt.filter(t=>t.estado==='Cancelada');
  $('anTotal').textContent=mt.length;
  $('anSub').textContent=MESES[mes]+' '+year+(anView==='personal'?' · '+viewName.split(' ')[0]:'');
  $('anComp').textContent=comp.length;$('anEarly').textContent=comp.length+' de '+mt.length;
  $('anPend').textContent=pend.length;$('anCanc').textContent=canc.length;

  const teamToShow=anView==='personal'?[viewName]:TEAM;
  if(anView==='personal'){
    const estados=['Pendiente','En Proceso','Completada','Cancelada'];
    mkBar('chartEnc',estados,estados.map(e=>mt.filter(t=>t.estado===e).length),['#E8261C','#E9A23B','#1BA572','#5B7088']);
  } else {
    mkBar('chartEnc',TEAM.map(e=>e.split(' ')[0]),TEAM.map(e=>mt.filter(t=>(t.encargados||[]).includes(e)).length),COLORS);
  }
  mkDona('chartCat',CATS.map(c=>c.length>16?c.slice(0,16)+'…':c),CATS.map(c=>mt.filter(t=>t.categoria===c).length));
  const aMap={};mt.forEach(t=>{if(t.area)aMap[t.area]=(aMap[t.area]||0)+1;});
  const aKeys=Object.keys(aMap).sort((a,b)=>aMap[b]-aMap[a]).slice(0,6);
  mkBar('chartArea',aKeys,aKeys.map(k=>aMap[k]),['#2E5B8A']);
  const sMap={};mt.forEach(t=>{if(t.solicita)sMap[t.solicita]=(sMap[t.solicita]||0)+1;});
  const sKeys=Object.keys(sMap).sort((a,b)=>sMap[b]-sMap[a]).slice(0,6);
  mkBar('chartSol',sKeys,sKeys.map(k=>sMap[k]),['#1BA572']);

  const rt=$('rankTime');rt.innerHTML='';
  teamToShow.forEach(enc=>{
    const ec=tasks.filter(t=>(t.encargados||[]).includes(enc)&&t.estado==='Completada'&&t.fechaSol&&t.fechaEnt);
    if(!ec.length)return;
    const dias=ec.map(t=>diffDays(t.fechaSol,t.fechaEnt));
    const prom=Math.round(dias.reduce((a,b)=>a+b,0)/dias.length);
    rt.innerHTML+=`<tr><td><strong>${enc.split(' ')[0]} ${enc.split(' ')[1]||''}</strong></td><td style="font-weight:700">${ec.length}</td><td style="font-weight:700">${prom}d</td><td style="color:var(--green);font-weight:700">${ec.length}</td></tr>`;
  });
  if(!rt.children.length)rt.innerHTML='<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:1rem;">Sin completadas este período</td></tr>';

  const rp=$('rankPend');rp.innerHTML='';
  const pendBase=tasks.filter(t=>t.estado==='Pendiente'||t.estado==='En Proceso');
  const filtPend=anView==='personal'?pendBase.filter(t=>(t.encargados||[]).includes(viewName)):pendBase;
  const maxP=Math.max(...teamToShow.map(e=>filtPend.filter(t=>(t.encargados||[]).includes(e)).length),1);
  teamToShow.forEach(enc=>{
    const n=filtPend.filter(t=>(t.encargados||[]).includes(enc)).length;
    const pct=Math.round((n/maxP)*100);
    rp.innerHTML+=`<tr><td><strong>${enc.split(' ')[0]}</strong></td><td style="font-weight:700;color:${n>3?'var(--red)':'var(--text)'}">${n}</td><td><div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div></td></tr>`;
  });
  if(!rp.children.length)rp.innerHTML='<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:1rem;">Sin pendientes</td></tr>';
};

function mkBar(id,labels,data,colors){
  if(charts[id])charts[id].destroy();
  const ctx=$(id).getContext('2d');
  charts[id]=new Chart(ctx,{type:'bar',data:{labels,datasets:[{data,backgroundColor:colors.length>1?colors:data.map(()=>colors[0]),borderRadius:6,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'rgba(0,0,0,.05)'}},x:{grid:{display:false},ticks:{font:{size:10}}}}}});
}
function mkDona(id,labels,data){
  if(charts[id])charts[id].destroy();
  const ctx=$(id).getContext('2d');
  charts[id]=new Chart(ctx,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:COLORS,borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:10},boxWidth:12}}}}});
}

document.addEventListener('keydown',e=>{if(e.key==='Escape'){window.closeTaskModal();window.closeGrabModal();window.closeProyModal();window.closeUnidModal();window.closeNotifs();window.closeBanner();window.closeCalPopup();}});
