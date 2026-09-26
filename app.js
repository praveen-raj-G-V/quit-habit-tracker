import{createClient}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import{SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}from"./config.js";

const s=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

let S={
  user:null,
  habits:[],       // non-archived habits shown in the picker
  allHabits:[],     // every habit, used on the Habits tab
  active:null,
  events:[],
  busy:false        // guards against double-tap while a request is in flight
};

const $=x=>document.getElementById(x);
const D=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const startOfDay=d=>{let x=new Date(d);x.setHours(0,0,0,0);return x};
const dayDiff=(a,b)=>Math.round((startOfDay(b)-startOfDay(a))/86400000);

function toast(x){
  $("toast").textContent=x;
  $("toast").style.display="block";
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>$("toast").style.display="none",1800)
}

function H(){
  return S.allHabits.find(x=>x.id===S.active)
}

function pendingEvent(){
  return S.events.find(e=>e.event_type==="urge"&&e.outcome_status==="pending")
}

function C(k){
  let e=S.events.filter(x=>D(new Date(x.created_at))===k);
  return{
    u:e.filter(x=>x.event_type==="urge").length,
    r:e.filter(x=>x.event_type==="urge"&&x.outcome_status==="resisted").length,
    a:e.filter(x=>x.event_type==="urge"&&x.outcome_status==="acted").length,
    p:e.filter(x=>x.event_type==="urge"&&x.outcome_status==="pending").length
  }
}

// Consecutive days (ending today) since the last "acted" event.
// No acted events ever -> streak runs from the habit's creation date.
function streakDays(){
  let h=H();
  if(!h)return 0;

  let acted=S.events
    .filter(e=>e.outcome_status==="acted")
    .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

  let start=acted.length?new Date(acted[0].created_at):new Date(h.created_at);

  return Math.max(0,dayDiff(start,new Date()))
}

async function load(){
  let{data:{user}}=await s.auth.getUser();

  S.user=user;
  $("user").textContent=user?.email||"Not signed in";

  if(!user){
    $("auth").classList.remove("hidden");
    $("app").classList.add("hidden");
    return
  }

  $("auth").classList.add("hidden");
  $("app").classList.remove("hidden");

  let{data}=await s.from("habits").select("*").order("created_at");

  S.allHabits=data||[];
  S.habits=S.allHabits.filter(h=>!h.archived);

  if(!S.active||!S.habits.find(h=>h.id===S.active)){
    S.active=S.habits[0]?.id||null
  }

  await events();
  render()
}

async function events(){
  if(!S.active){
    S.events=[];
    return
  }

  let{data,error}=await s
    .from("habit_events")
    .select("*")
    .eq("habit_id",S.active)
    .order("created_at",{ascending:false})
    .limit(5000);

  if(error)toast(error.message);

  S.events=data||[]
}

async function urge(){
  if(S.busy)return;

  if(!S.active){
    toast("Add a habit first");
    return
  }

  if(pendingEvent()){
    toast("Resolve the current urge first");
    return
  }

  S.busy=true;
  render();

  let{error}=await s.from("habit_events").insert({
    user_id:S.user.id,
    habit_id:S.active,
    event_type:"urge",
    outcome_status:"pending"
  });

  S.busy=false;

  if(error)toast(error.message);
  else{
    await events();
    toast("Urge recorded")
  }

  render()
}

async function outcome(x){
  if(S.busy)return;

  let p=pendingEvent();

  if(!p){
    toast("Record an urge first");
    return
  }

  S.busy=true;
  render();

  let note=$("note").value.trim().slice(0,200);

  let{error}=await s
    .from("habit_events")
    .update({outcome_status:x,note:note||null})
    .eq("id",p.id)
    .eq("user_id",S.user.id);

  S.busy=false;

  if(error)toast(error.message);
  else{
    await events();
    toast(x==="resisted"?"Resisted — nice work":"Acted — logged")
  }

  render()
}

function render(){
  let h=H();
  let c=C(D(new Date()));
  let p=pendingEvent();

  $("habitName").textContent=h?.name||"Create a habit";

  habitSelect();

  $("goalText").textContent=
    h?.daily_goal
      ?`Goal: ${h.daily_goal} urges or fewer today`
      :"";

  let streak=h?streakDays():0;
  $("streakLine").textContent=
    !h?"":streak>0
      ?`${streak} day${streak===1?"":"s"} since you last acted on it`
      :"Log a resist to start a streak";

  $("count").textContent=c.u;
  $("uCount").textContent=c.u;
  $("rCount").textContent=c.r;
  $("aCount").textContent=c.a;
  $("pCount").textContent=c.p;

  $("pendingBox").classList.toggle("hidden",!p);
  if(!p)endConfirm();
  $("urge").disabled=S.busy||!h||!!p;
  $("resist").disabled=$("acted").disabled=S.busy||!p;

  if(!p)$("note").value="";

  history();
  habits();
  progress()
}

function history(){
  $("historyList").innerHTML=
    S.events.length
      ?S.events.slice(0,150).map(e=>{
          let d=new Date(e.created_at);
          let x=
            e.outcome_status==="pending"
              ?"Pending"
              :e.outcome_status==="resisted"
                ?"Resisted"
                :e.outcome_status==="acted"
                  ?"Acted"
                  :"Urge";

          return`<div class="event">
            <div class="eventMain">
              <span class="pill ${
                x==="Resisted"?"good":x==="Acted"?"bad":x==="Pending"?"pending":""
              }">${x}</span>
              ${e.note?`<span class="eventNote" title="${escapeHtml(e.note)}">${escapeHtml(e.note)}</span>`:""}
            </div>
            <span class="eventTime muted">${d.toLocaleDateString()} ${d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
          </div>`
        }).join("")
      :"<div class='muted small'>No activity yet.</div>"
}

function escapeHtml(t){
  return t.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))
}

function habitSelect(){
  let q=$("habitSelect");

  if(!q)return;

  q.innerHTML="";

  if(!S.habits.length){
    q.innerHTML='<option value="">No habits yet</option>';
    q.disabled=true;
    return
  }

  S.habits.forEach(h=>{
    let option=document.createElement("option");

    option.value=h.id;
    option.textContent=h.name;

    if(h.id===S.active)option.selected=true;

    q.appendChild(option)
  });

  q.disabled=false
}

function habits(){
  $("habitList").innerHTML=
    S.allHabits.length
      ?S.allHabits.map(h=>
          `<div class="habitrow">
            <button class="nameBtn" data-h="${h.id}" ${h.archived?'style="opacity:.5"':""}>
              ${h.id===S.active?"✓ ":""}${escapeHtml(h.name)}${h.archived?" (archived)":""}
            </button>
            <div class="rowActions">
              <button class="iconBtn" data-arch="${h.id}">${h.archived?"Unarchive":"Archive"}</button>
            </div>
          </div>`
        ).join("")
      :"<div class='muted small'>No habits yet — add one above.</div>";

  document.querySelectorAll("[data-h]").forEach(b=>
    b.onclick=async()=>{
      let h=S.allHabits.find(x=>x.id===b.dataset.h);
      if(h?.archived){toast("Unarchive this habit first");return}
      S.active=b.dataset.h;
      await events();
      render()
    }
  );

  document.querySelectorAll("[data-arch]").forEach(b=>
    b.onclick=async()=>{
      let h=S.allHabits.find(x=>x.id===b.dataset.arch);

      let{error}=await s
        .from("habits")
        .update({archived:!h.archived})
        .eq("id",h.id)
        .eq("user_id",S.user.id);

      if(error){toast(error.message);return}

      h.archived=!h.archived;
      S.habits=S.allHabits.filter(x=>!x.archived);

      if(S.active===h.id&&h.archived){
        S.active=S.habits[0]?.id||null;
        await events()
      }

      render();
      toast(h.archived?"Habit archived":"Habit restored")
    }
  )
}

function progress(){
  let ds=[];

  for(let i=29;i>=0;i--){
    let d=new Date();
    d.setDate(d.getDate()-i);

    ds.push({d:D(d),...C(D(d))})
  }

  let total=ds.reduce((a,x)=>a+x.u,0);
  let r=ds.reduce((a,x)=>a+x.r,0);
  let a=ds.reduce((a,x)=>a+x.a,0);

  $("kpis").innerHTML=`
    <div class="kpi"><b>${total}</b><span>Urges / 30 days</span></div>
    <div class="kpi"><b>${(total/30).toFixed(1)}</b><span>Average / day</span></div>
    <div class="kpi"><b>${total?Math.round(r/total*100):0}%</b><span>Resisted share</span></div>
    <div class="kpi"><b>${a}</b><span>Acted / 30 days</span></div>
  `;

  let W=700,H2=230,P=26,
      m=Math.max(1,...ds.map(x=>x.r+x.a));

  let bw=(W-2*P)/30*.6;

  let bars=ds.map((x,i)=>{
    let cx=P+i*(W-2*P)/29;
    let rh=x.r/m*(H2-2*P-14);
    let ah=x.a/m*(H2-2*P-14);
    let base=H2-P;

    return`
      <g>
        <rect x="${cx-bw/2}" y="${base-rh-ah}" width="${bw}" height="${rh}" fill="var(--sage,#3f6b52)" rx="1.5"></rect>
        <rect x="${cx-bw/2}" y="${base-ah}" width="${bw}" height="${ah}" fill="var(--clay,#a3453a)" rx="1.5"></rect>
        <title>${x.d}: ${x.r} resisted, ${x.a} acted</title>
      </g>
    `
  }).join("");

  $("chart").innerHTML=`
    <svg viewBox="0 0 ${W} ${H2}">
      <line x1="${P}" y1="${H2-P}" x2="${W-P}" y2="${H2-P}" stroke="var(--line,#ddd)"></line>
      ${bars}
    </svg>
  `
}

function exportCsv(){
  if(!S.events.length){toast("No events to export");return}

  let rows=[["date_time","event_type","outcome_status","note"]];

  S.events.forEach(e=>{
    rows.push([
      new Date(e.created_at).toISOString(),
      e.event_type,
      e.outcome_status,
      (e.note||"").replace(/"/g,'""')
    ])
  });

  let csv=rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
  let blob=new Blob([csv],{type:"text/csv"});
  let url=URL.createObjectURL(blob);
  let a=document.createElement("a");

  a.href=url;
  a.download=`${(H()?.name||"habit").replace(/\s+/g,"_")}_events.csv`;
  a.click();
  URL.revokeObjectURL(url)
}

// --- distraction: breathing pacer + mini games (also usable standalone) ---
let distract={timer:null,secondsLeft:60,bubbleTimer:null,score:0,standalone:false};

function openDistract(standalone){
  distract.standalone=!!standalone;
  distract.secondsLeft=60;
  distract.score=0;
  $("bubbleScore").textContent="0";
  $("bubbleArea").innerHTML="";
  $("distractTimer").textContent="0:60";
  $("closeDistract").textContent=distract.standalone?"Close":"I'm ready — back to check-in";
  $("distractModal").classList.remove("hidden");

  breathWord();
  distract.wordTimer=setInterval(breathWord,4000);

  distract.timer=setInterval(()=>{
    distract.secondsLeft--;
    let m=Math.floor(distract.secondsLeft/60),sec=distract.secondsLeft%60;
    $("distractTimer").textContent=`${m}:${String(sec).padStart(2,"0")}`;
    if(distract.secondsLeft<=0)closeDistract()
  },1000);

  spawnBubbles()
}

function breathWord(){
  let phase=Math.floor(Date.now()/1000)%8<4;
  $("breathWord").textContent=phase?"Breathe in":"Breathe out"
}

function spawnBubbles(){
  clearInterval(distract.bubbleTimer);

  distract.bubbleTimer=setInterval(()=>{
    let area=$("bubbleArea");
    if(!area||area.children.length>6)return;

    let size=30+Math.random()*34;
    let b=document.createElement("button");

    b.className="bubble";
    b.style.width=b.style.height=`${size}px`;
    b.style.left=`${Math.random()*(area.clientWidth-size)}px`;
    b.style.top=`${Math.random()*(area.clientHeight-size)}px`;
    b.setAttribute("aria-label","Pop bubble");

    b.onclick=()=>{
      distract.score++;
      $("bubbleScore").textContent=distract.score;
      b.remove()
    };

    area.appendChild(b);

    setTimeout(()=>b.remove(),2600)
  },550)
}

function closeDistract(){
  clearInterval(distract.timer);
  clearInterval(distract.wordTimer);
  clearInterval(distract.bubbleTimer);
  $("distractModal").classList.add("hidden")
}

$("openDistract").onclick=openDistract;
$("closeDistract").onclick=closeDistract;

document.querySelectorAll(".modalTab").forEach(tab=>
  tab.onclick=()=>{
    document.querySelectorAll(".modalTab").forEach(t=>t.classList.remove("active"));
    document.querySelectorAll(".distractView").forEach(v=>v.classList.add("hidden"));
    tab.classList.add("active");
    $(tab.dataset.view).classList.remove("hidden");

    if(tab.dataset.view==="puzzleView")newPuzzleRound();
    if(tab.dataset.view==="groundView")renderGround()
  }
);

// --- color-match puzzle ---
let puzzle={score:0};
const SWATCHES=[
  {name:"Red",hex:"#c0453a"},{name:"Blue",hex:"#3a5fc0"},
  {name:"Green",hex:"#3f8a5e"},{name:"Yellow",hex:"#d1a02e"},
  {name:"Purple",hex:"#7a4fb0"},{name:"Orange",hex:"#d1752e"}
];

function newPuzzleRound(){
  let pick=arr=>arr[Math.floor(Math.random()*arr.length)];
  let target=pick(SWATCHES);
  let others=SWATCHES.filter(s=>s.name!==target.name)
    .sort(()=>Math.random()-.5).slice(0,3);
  let opts=[target,...others].sort(()=>Math.random()-.5);

  $("puzzleTarget").textContent=target.name;

  $("puzzleGrid").innerHTML=opts.map(o=>
    `<button class="swatch" style="background:${o.hex}" data-name="${o.name}" aria-label="${o.name}"></button>`
  ).join("");

  document.querySelectorAll(".swatch").forEach(b=>
    b.onclick=()=>{
      if(b.dataset.name===target.name){
        puzzle.score++;
        $("puzzleScore").textContent=puzzle.score
      }
      newPuzzleRound()
    }
  )
}

// --- grounding exercise (5-4-3-2-1 style) ---
let ground={i:0};
const GROUND_STEPS=[
  "Name 3 things you can see around you",
  "Name 2 things you can hear right now",
  "Name 1 thing you can feel (your feet on the floor, the chair, anything)",
  "Take one slow breath in, and let it out slowly",
  "Notice: the urge is still just a feeling passing through"
];

function renderGround(){
  $("groundCount").textContent=`STEP ${ground.i+1} OF ${GROUND_STEPS.length}`;
  $("groundPrompt").textContent=GROUND_STEPS[ground.i]
}

$("groundNext").onclick=()=>{
  ground.i=(ground.i+1)%GROUND_STEPS.length;
  renderGround()
};

// --- punching bag ---
let punch={score:0};

$("punchBag").addEventListener("pointerdown",e=>{
  e.preventDefault();
  punch.score++;
  $("punchScore").textContent=punch.score;

  let bag=$("punchBag");
  bag.style.setProperty("--tilt",`${(8+Math.random()*10)*(Math.random()<.5?-1:1)}deg`);
  bag.classList.remove("hit");
  void bag.offsetWidth; // restart the CSS animation
  bag.classList.add("hit")
});

// --- slime blob ---
let slimeDrag=null;
const clampPct=v=>Math.max(20,Math.min(80,v));

$("slimeBlob").addEventListener("pointerdown",e=>{
  e.preventDefault();
  slimeDrag={x:e.clientX,y:e.clientY};
  $("slimeBlob").style.transition="none";
  try{$("slimeBlob").setPointerCapture(e.pointerId)}catch(_){}
});

$("slimeBlob").addEventListener("pointermove",e=>{
  if(!slimeDrag)return;

  let dx=Math.max(-40,Math.min(40,e.clientX-slimeDrag.x));
  let dy=Math.max(-40,Math.min(40,e.clientY-slimeDrag.y));
  let blob=$("slimeBlob");

  blob.style.transform=`translate(${dx*.3}px,${dy*.3}px) scale(${1+Math.abs(dx)/260},${1+Math.abs(dy)/260})`;
  blob.style.borderRadius=
    `${clampPct(50+dx/2)}% ${clampPct(50-dx/2)}% ${clampPct(50-dy/3)}% ${clampPct(50+dy/3)}% / 55% 45% 55% 45%`
});

function releaseSlime(){
  slimeDrag=null;
  let blob=$("slimeBlob");
  blob.style.transition="transform .5s cubic-bezier(.34,1.6,.5,1),border-radius .5s ease";
  blob.style.transform="";
  blob.style.borderRadius=""
}

$("slimeBlob").addEventListener("pointerup",releaseSlime);
$("slimeBlob").addEventListener("pointercancel",releaseSlime);

// --- confirm delay before logging resisted / acted ---
let confirmState={type:null,timer:null,seconds:0};

function startConfirm(x){
  if(S.busy||!pendingEvent())return;

  confirmState.type=x;
  confirmState.seconds=4;

  $("pendingActions").classList.add("hidden");
  $("openDistract").classList.add("hidden");
  $("confirmBox").classList.remove("hidden");

  updateConfirmText();

  confirmState.timer=setInterval(()=>{
    confirmState.seconds--;
    if(confirmState.seconds<=0){
      let x2=confirmState.type;
      endConfirm();
      outcome(x2)
    }else updateConfirmText()
  },1000)
}

function updateConfirmText(){
  let label=confirmState.type==="resisted"?"Resisted":"Acted";
  $("confirmText").textContent=`Logging "${label}" in ${confirmState.seconds}s…`
}

function endConfirm(){
  clearInterval(confirmState.timer);
  confirmState.type=null;
  $("confirmBox").classList.add("hidden");
  $("pendingActions").classList.remove("hidden");
  $("openDistract").classList.remove("hidden")
}

$("cancelConfirm").onclick=endConfirm;

$("authForm").onsubmit=async e=>{
  e.preventDefault();

  let{error}=await s.auth.signInWithPassword({
    email:$("email").value,
    password:$("password").value
  });

  if(error)toast(error.message);
  else load()
};

$("signup").onclick=async()=>{
  let{error}=await s.auth.signUp({
    email:$("email").value,
    password:$("password").value
  });

  toast(error?error.message:"Account created — check your email if confirmation is required")
};

$("urge").onclick=urge;
$("resist").onclick=()=>startConfirm("resisted");
$("acted").onclick=()=>startConfirm("acted");
$("exportCsv").onclick=exportCsv;

$("habitForm").onsubmit=async e=>{
  e.preventDefault();

  let n=$("newHabit").value.trim();
  let g=parseInt($("goal").value||"0");

  if(!n)return;

  let{data,error}=await s
    .from("habits")
    .insert({
      user_id:S.user.id,
      name:n,
      daily_goal:Number.isFinite(g)?g:0
    })
    .select()
    .single();

  if(error)
    toast(error.message);
  else{
    S.allHabits.push(data);
    S.habits=S.allHabits.filter(h=>!h.archived);
    S.active=data.id;

    $("newHabit").value="";
    $("goal").value="";

    await events();
    render();
    toast("Habit added")
  }
};

$("logout").onclick=async()=>{
  await s.auth.signOut();
  location.reload()
};

$("habitSelect").onchange=async()=>{
  S.active=$("habitSelect").value||null;
  await events();
  render()
};

document.querySelectorAll("nav button").forEach(b=>
  b.onclick=()=>{
    if(b.dataset.tab==="relax"){
      openDistract(true);
      return
    }

    let target=$(b.dataset.tab);
    if(!target)return; // unknown tab id — don't blank the screen

    document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".tab").forEach(x=>x.classList.add("hidden"));
    target.classList.remove("hidden")
  }
);

load();
