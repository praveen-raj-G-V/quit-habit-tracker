import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* STEP 1: Replace these two values after creating your Supabase project. */
const SUPABASE_URL = "https://oeotdmstnlzjswtqfwth.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PUgX0JMxqT-c3TEIVDS3oQ_HNzi62yI";

const configured = !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let state = { user:null, habits:[], activeHabit:null, events:[] };

const $ = id => document.getElementById(id);
function toast(msg){$("toast").textContent=msg;$("toast").style.display="block";setTimeout(()=>$("toast").style.display="none",1800)}
function keyDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}

async function loadData(){
  if(!supabase) return;
  const {data:{user}}=await supabase.auth.getUser();
  state.user=user;
  $("user").textContent=user?.email||"Not signed in";
  if(!user){$("auth").classList.remove("hidden");$("app").classList.add("hidden");return}
  $("auth").classList.add("hidden");$("app").classList.remove("hidden");

  const {data:habits,error:herr}=await supabase.from("habits").select("*").order("created_at");
  if(herr){toast(herr.message);return}
  state.habits=habits||[];
  state.activeHabit=state.habits[0]?.id||null;
  await loadEvents();
  render();
}

async function loadEvents(){
  if(!state.activeHabit) {state.events=[];return}
  const {data,error}=await supabase.from("habit_events").select("*").eq("habit_id",state.activeHabit).order("created_at",{ascending:false}).limit(2000);
  if(error) toast(error.message);
  state.events=data||[];
}

async function addEvent(type){
  if(!state.user||!state.activeHabit){toast("Add a habit first");return}
  const {error}=await supabase.from("habit_events").insert({user_id:state.user.id,habit_id:state.activeHabit,event_type:type});
  if(error){toast(error.message);return}
  await loadEvents();render();toast(type==="urge"?"Urge recorded":"Recorded");
}
function countsFor(date){
  const e=state.events.filter(x=>x.created_at?.slice(0,10)===date);
  return {urge:e.filter(x=>x.event_type==="urge").length,resist:e.filter(x=>x.event_type==="resisted").length,acted:e.filter(x=>x.event_type==="acted").length};
}
function render(){
  const h=state.habits.find(x=>x.id===state.activeHabit);
  $("habitName").textContent=h?.name||"Create your first habit";
  $("habitTitle").textContent=h?"Current habit":"No habit selected";
  const c=countsFor(keyDate()); $("count").textContent=c.urge; $("uCount").textContent=c.urge; $("rCount").textContent=c.resist; $("aCount").textContent=c.acted;
  renderHistory();renderProgress();renderHabits();
}
function renderHistory(){
  if(!state.events.length){$("historyList").innerHTML='<div class="empty">No activity yet.</div>';return}
  $("historyList").innerHTML=state.events.slice(0,80).map(e=>{
    const label=e.event_type==="urge"?"Urge":e.event_type==="resisted"?"Resisted":"Acted";
    const d=new Date(e.created_at);
    return `<div style="display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--line)"><span>${label}</span><span class="muted">${d.toLocaleString()}</span></div>`
  }).join("");
}
function renderProgress(){
  const days=[];for(let i=13;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=keyDate(d);days.push({k,...countsFor(k)})}
  const max=Math.max(1,...days.map(x=>x.urge));
  $("chart").innerHTML=days.map(x=>`<div style="display:grid;grid-template-columns:58px 1fr 28px;gap:8px;align-items:center;margin:10px 0"><span class="muted">${x.k.slice(5)}</span><div class="bar"><i style="width:${x.urge/max*100}%"></i></div><b>${x.urge}</b></div>`).join("");
  const total=days.reduce((s,x)=>s+x.urge,0), acted=days.reduce((s,x)=>s+x.acted,0);
  $("summary").innerHTML=`<p><b>${total}</b> urges in the last 14 days.</p><p><b>${acted}</b> acted-on events.</p><p>Average: <b>${(total/14).toFixed(1)}</b> urges/day.</p>`;
}
function renderHabits(){
  if(!state.habits.length){$("habitList").innerHTML='<div class="empty">No habits yet.</div>';return}
  $("habitList").innerHTML=state.habits.map(h=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid var(--line)"><button class="btn" data-h="${h.id}">${h.id===state.activeHabit?"✓ ":""}${h.name}</button></div>`).join("");
  document.querySelectorAll("[data-h]").forEach(b=>b.onclick=async()=>{state.activeHabit=b.dataset.h;await loadEvents();render()});
}

$("authForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!configured){toast("Add Supabase keys in app.js first");return}
  const {error}=await supabase.auth.signInWithPassword({email:$("email").value,password:$("password").value});
  if(error) toast(error.message); else await loadData();
});
$("signup").onclick=async()=>{
  if(!configured){toast("Add Supabase keys in app.js first");return}
  const {error}=await supabase.auth.signUp({email:$("email").value,password:$("password").value});
  toast(error?error.message:"Account created. Check your email if confirmation is enabled.");
};
$("urge").onclick=()=>addEvent("urge");$("resist").onclick=()=>addEvent("resisted");$("acted").onclick=()=>addEvent("acted");
$("habitForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!state.user)return;
  const name=$("newHabit").value.trim();if(!name)return;
  const {data,error}=await supabase.from("habits").insert({user_id:state.user.id,name}).select().single();
  if(error){toast(error.message);return} state.habits.push(data);state.activeHabit=data.id;$("newHabit").value="";await loadEvents();render();
});
$("logout").onclick=async()=>{await supabase.auth.signOut();location.reload()};
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");
  document.querySelectorAll(".tab").forEach(x=>x.classList.add("hidden"));$(b.dataset.tab).classList.remove("hidden");
});
if(supabase){supabase.auth.onAuthStateChange(()=>loadData());loadData()}else{$("user").textContent="Setup required";toast("Create Supabase project, then add its keys to app.js")}
    
