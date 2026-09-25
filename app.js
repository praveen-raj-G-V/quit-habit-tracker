import{createClient}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import{SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}from"./config.js";

const s=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

let S={
  user:null,
  habits:[],
  active:null,
  events:[]
};

const $=x=>document.getElementById(x);
const D=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

function toast(x){
  $("toast").textContent=x;
  $("toast").style.display="block";
  setTimeout(()=>$("toast").style.display="none",1600)
}

function H(){
  return S.habits.find(x=>x.id===S.active)
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

  S.habits=data||[];
  S.active=S.active||S.habits[0]?.id;

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
  if(!S.active){
    toast("Add a habit first");
    return
  }

  let{error}=await s.from("habit_events").insert({
    user_id:S.user.id,
    habit_id:S.active,
    event_type:"urge",
    outcome_status:"pending"
  });

  if(error)toast(error.message);
  else{
    await events();
    render();
    toast("Urge recorded")
  }
}

async function outcome(x){
  let p=S.events.find(
    e=>e.event_type==="urge"&&e.outcome_status==="pending"
  );

  if(!p){
    toast("Record an urge first");
    return
  }

  let{error}=await s
    .from("habit_events")
    .update({outcome_status:x})
    .eq("id",p.id)
    .eq("user_id",S.user.id);

  if(error)toast(error.message);
  else{
    await events();
    render();
    toast(x==="resisted"?"Resisted recorded":"Acted recorded")
  }
}

function render(){
  let h=H();
  let c=C(D(new Date()));

  $("habitName").textContent=h?.name||"Create a habit";

  habitSelect();

  $("goalText").textContent=
    h?.daily_goal
      ?`Goal: ${h.daily_goal} urges or fewer today`
      :"";

  $("count").textContent=c.u;
  $("uCount").textContent=c.u;
  $("rCount").textContent=c.r;
  $("aCount").textContent=c.a;
  $("pCount").textContent=c.p;

  let p=S.events.find(
    e=>e.event_type==="urge"&&e.outcome_status==="pending"
  );

  $("pendingBox").classList.toggle("hidden",!p);

  $("resist").disabled=$("acted").disabled=!p;

  history();
  habits();
  progress()
}

function history(){
  $("historyList").innerHTML=
    S.events.length
      ?S.events.slice(0,120).map(e=>{
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
            <span class="pill ${
              x==="Resisted"
                ?"good"
                :x==="Acted"
                  ?"bad"
                  :x==="Pending"
                    ?"pending"
                    :""
            }">${x}</span>
            <span class="muted">${d.toLocaleString()}</span>
          </div>`
        }).join("")
      :"<div class='muted'>No activity yet.</div>"
}

function habitSelect(){
  let q=$("habitSelect");

  if(!q)return;

  // Clear the existing options first
  q.innerHTML="";

  // If there are no habits
  if(!S.habits.length){
    q.innerHTML='<option value="">No habits yet</option>';
    q.disabled=true;
    return
  }

  // Add every habit to the dropdown
  S.habits.forEach(h=>{
    let option=document.createElement("option");

    option.value=h.id;
    option.textContent=h.name;

    if(h.id===S.active){
      option.selected=true
    }

    q.appendChild(option)
  });

  q.disabled=false
}

function habits(){
  $("habitList").innerHTML=
    S.habits.map(h=>
      `<div class="habitrow">
        <button class="btn" data-h="${h.id}">
          ${h.id===S.active?"✓ ":""}${h.name}
        </button>
      </div>`
    ).join("");

  document.querySelectorAll("[data-h]").forEach(b=>
    b.onclick=async()=>{
      S.active=b.dataset.h;
      await events();
      render()
    }
  )
}

function progress(){
  let ds=[];

  for(let i=29;i>=0;i--){
    let d=new Date();
    d.setDate(d.getDate()-i);

    ds.push({
      d:D(d),
      ...C(D(d))
    })
  }

  let total=ds.reduce((a,x)=>a+x.u,0);
  let r=ds.reduce((a,x)=>a+x.r,0);

  $("kpis").innerHTML=`
    <div class="kpi">
      <b>${total}</b>
      <span>Urges / 30 days</span>
    </div>

    <div class="kpi">
      <b>${(total/30).toFixed(1)}</b>
      <span>Average / day</span>
    </div>

    <div class="kpi">
      <b>${total?Math.round(r/total*100):0}%</b>
      <span>Resisted share</span>
    </div>

    <div class="kpi">
      <b>${ds.reduce((a,x)=>a+x.p,0)}</b>
      <span>Pending</span>
    </div>
  `;

  let W=700,
      H=210,
      P=25,
      m=Math.max(1,...ds.map(x=>x.u));

  let pts=ds.map((x,i)=>
    `${P+i*(W-2*P)/29},${H-P-x.u/m*(H-2*P)}`
  ).join(" ");

  $("chart").innerHTML=`
    <svg viewBox="0 0 ${W} ${H}">
      <line
        x1="${P}"
        y1="${H-P}"
        x2="${W-P}"
        y2="${H-P}"
        stroke="#ddd"
      />

      <polyline
        points="${pts}"
        fill="none"
        stroke="#111827"
        stroke-width="3"
      />

      ${ds.map((x,i)=>{
        let px=P+i*(W-2*P)/29;
        let py=H-P-x.u/m*(H-2*P);

        return`
          <circle
            cx="${px}"
            cy="${py}"
            r="3"
            fill="#111827"
          >
            <title>${x.d}: ${x.u}</title>
          </circle>
        `
      }).join("")}
    </svg>
  `
}

$("authForm").onsubmit=async e=>{
  e.preventDefault();

  let{error}=await s.auth.signInWithPassword({
    email:$("email").value,
    password:$("password").value
  });

  if(error)
    toast(error.message);
  else
    load()
};

$("signup").onclick=async()=>{
  let{error}=await s.auth.signUp({
    email:$("email").value,
    password:$("password").value
  });

  toast(error?error.message:"Account created")
};

$("urge").onclick=urge;

$("resist").onclick=()=>outcome("resisted");

$("acted").onclick=()=>outcome("acted");

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
    S.habits.push(data);
    S.active=data.id;

    $("newHabit").value="";
    $("goal").value="";

    await events();
    render()
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
    document
      .querySelectorAll("nav button")
      .forEach(x=>x.classList.remove("active"));

    b.classList.add("active");

    document
      .querySelectorAll(".tab")
      .forEach(x=>x.classList.add("hidden"));

    $(b.dataset.tab).classList.remove("hidden")
  }
);

load();
