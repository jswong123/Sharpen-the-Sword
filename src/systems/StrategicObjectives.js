export class StrategicObjectives {
  constructor({scenario=null,getPlayerFaction=()=>'',getTurn=()=>1,getUnits=()=>[],container=null}={}){
    this.scenario=scenario; this.getPlayerFaction=getPlayerFaction; this.getTurn=getTurn; this.getUnits=getUnits;
    this.container=container; this.objectiveStates={};
  }
  init(){
    if(!this.container) this.container=document.getElementById('strategicObjectives');
    if(!this.container){
      const parent=document.getElementById('operationPanel'); if(!parent)return false;
      this.container=document.createElement('div'); this.container.id='strategicObjectives';
      const reinf=document.getElementById('reinforcementPanel'); parent.insertBefore(this.container,reinf||parent.querySelector('.operation-help'));
    }
    this.render(); return true;
  }
  normalizeSide(v){v=String(v??'').toLowerCase(); return ({china:'chinese',chn:'chinese',japan:'japanese',jpn:'japanese',ussr:'soviet',sov:'soviet',ger:'german',allies:'allied',ally:'allied',alliance:'allied',anzac:'allied',allied_force:'allied',newmil:'new_military',new_military:'new_military',rebel:'new_military',rok_gov:'rok_government',rok_government:'rok_government',government:'rok_government'})[v]||v;}
  side(){return this.normalizeSide(this.getPlayerFaction?.()||'');}
  turn(){const n=Number(this.getTurn?.()||1);return Number.isFinite(n)&&n>0?n:1;}
  setScenario(s){this.scenario=s||null;this.objectiveStates={};this.render();}
  setObjectiveStatus(id,status,extra={}){this.objectiveStates[id]={...(this.objectiveStates[id]||{}),...extra,status};this.render();}
  completeObjective(id){this.setObjectiveStatus(id,'completed');}
  failObjective(id){this.setObjectiveStatus(id,'failed');}
  updateProgress(id,current,target){this.objectiveStates[id]={...(this.objectiveStates[id]||{status:'active'}),progress:{current,target}};this.render();}
  deriveFromVictory(){
    const side=this.side(), vc=this.scenario?.victoryConditions, rule=vc?.[side]; if(!rule)return [];
    const deadline=Number(vc.deadlineTurn??vc.turnLimit??rule.deadlineTurn??0)||null, out=[];
    const addObjective=(o,i,action,successText)=>{const name=o?.nameZh||o?.name||`战略目标${i+1}`;out.push({id:o?.id||`${side}_${action}_${i}`,title:`${action==='defend'?'坚守':'攻占'}：${name}`,description:successText||`${action==='defend'?'坚守':'控制'}${name}。`,priority:i===0?'primary':'secondary',deadlineTurn:deadline,q:o?.q,r:o?.r,action});};
    if(rule.captureObjectives){(rule.captureObjectives.objectives||[]).forEach((o,i)=>addObjective(o,i,'capture',rule.captureObjectives.successText));}
    if(rule.defendObjectivesUntilDeadline){(rule.defendObjectivesUntilDeadline.objectives||[]).forEach((o,i)=>addObjective(o,i,'defend',rule.defendObjectivesUntilDeadline.successText));}
    if(Array.isArray(rule.primary)) rule.primary.forEach((x,i)=>out.push({id:`${side}_primary_${i}`,title:x,description:deadline?`在第${deadline}回合结束前完成该战役任务。`:'完成该战役任务。',priority:i===0?'primary':'secondary',deadlineTurn:deadline}));
    if(rule.eliminateEnemy && !out.length) out.push({id:`${side}_eliminate`,title:'歼灭敌军主力',description:deadline?`在第${deadline}回合结束前消灭敌军主要作战力量。`:'消灭敌军主要作战力量。',priority:'primary',deadlineTurn:deadline});
    return out;
  }
  controllerAt(o){
    if(o?.q===undefined||o?.r===undefined)return null;
    const rad=Math.max(0,Number(o?.controlRadius??0)); const here=(this.getUnits?.()||[]).filter(u=>u?.offMap!==true&&Math.abs(Number(u.q)-Number(o.q))<=rad&&Math.abs(Number(u.r)-Number(o.r))<=rad&&Number(u.strength??u.manpower??1)>0);
    const sides=[...new Set(here.map(u=>this.normalizeSide(u.side??u.faction??u.camp)).filter(Boolean))];
    return sides.length===1?sides[0]:(sides.length>1?'contested':null);
  }
  objectives(){const own=this.scenario?.strategicObjectives?.[this.side()];return Array.isArray(own)&&own.length?own:this.deriveFromVictory();}
  esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  state(o){return this.objectiveStates[o.id]||{status:o.status||'active',progress:o.progress||null};}
  evaluateObjectives(){
    const side=this.side(), t=this.turn();
    for(const o of this.objectives()){
      const st=this.state(o);
      if(st.status==='completed'||st.status==='failed'||st.status==='locked') continue;
      const dl=Number(o.deadlineTurn||0)||null;
      const ctl=this.controllerAt(o);
      // 防守型：敌军实际进入目标格即失守；若坚持到截止回合结束仍未失守，则完成。
      if(o.action==='defend'){
        if(ctl && ctl!=='contested' && ctl!==side){ this.objectiveStates[o.id]={...st,status:'failed',resolvedTurn:t,reason:'enemy_control'}; continue; }
        if(dl && t>dl){ this.objectiveStates[o.id]={...st,status:'completed',resolvedTurn:dl,reason:'held_to_deadline'}; continue; }
      }
      // 占领型：截止前占领即完成；超过期限仍未占领才失败。
      if(o.action==='capture'){
        if(ctl===side){ this.objectiveStates[o.id]={...st,status:'completed',resolvedTurn:t,reason:'captured'}; continue; }
        if(dl && t>dl && o.failOnDeadline!==false){ this.objectiveStates[o.id]={...st,status:'failed',resolvedTurn:dl,reason:'deadline'}; continue; }
      }
      if(o.action==='survive'&&dl&&t>dl){ this.objectiveStates[o.id]={...st,status:'completed',resolvedTurn:dl,reason:'survived_to_deadline'}; continue; }
      // 其他有期限任务维持旧规则，但只在明确要求 failOnDeadline 时自动失败。
      if(o.action!=='defend'&&o.action!=='capture'&&dl&&t>dl&&o.failOnDeadline===true){
        this.objectiveStates[o.id]={...st,status:'failed',resolvedTurn:dl,reason:'deadline'};
      }
    }
  }
  onTurnChanged(){this.evaluateObjectives();this.render();} onFactionChanged(){this.render();}
  render(){
    if(!this.container)return; const side=this.side(), t=this.turn(), objs=this.objectives();
    const sideName={chinese:'中国军',japanese:'日军',german:'德军',soviet:'苏军',allied:'联军',rok_government:'政府军',new_military:'新军部'}[side]||'我方';
    this.evaluateObjectives(); const cards=objs.map(o=>{const st=this.state(o);let status=st.status||'active';const ctl=this.controllerAt(o);if(st.status!=='completed'&&st.status!=='failed'){if(ctl==='contested')status='contested';else if(ctl&&ctl!==side)status='enemy';else if(ctl===side)status='friendly';}const dl=Number(o.deadlineTurn||0)||null;const remain=dl?Math.max(0,dl-t):null;const label={active:'进行中',friendly:o.action==='defend'?'坚守中':'我方控制',enemy:'敌军控制',contested:'争夺中',completed:'已完成',failed:'已失败',locked:'尚未开放'}[status]||'进行中';const symbol={active:'◆',friendly:'★',enemy:'×',contested:'⚔',completed:'✓',failed:'×',locked:'—'}[status]||'◆';const pri={primary:'主要目标',secondary:'阶段目标',optional:'次要目标'}[o.priority]||'战略目标';let prog='';if(st.progress?.target){const p=Math.max(0,Math.min(100,Number(st.progress.current||0)/Number(st.progress.target)*100));prog=`<div class="objective-progress"><div class="objective-progress-info"><span>进度</span><span>${this.esc(st.progress.current)}/${this.esc(st.progress.target)}</span></div><div class="objective-progress-bar"><div class="objective-progress-fill" style="width:${p}%"></div></div></div>`;}
      return `<div class="strategic-objective objective-${this.esc(o.priority||'secondary')} objective-${status}"><div class="objective-header"><div class="objective-name"><span class="objective-symbol">${symbol}</span>${this.esc(o.title)}</div><div class="objective-status status-${status}">${label}</div></div><div class="objective-meta">${pri}</div>${o.description?`<div class="objective-description">${this.esc(o.description)}</div>`:''}${dl?`<div class="objective-turn ${status}">${status==='completed'?'已于期限内完成':status==='failed'?`截止第${dl}回合 · 已超过期限`:`第 ${t} / ${dl} 回合 · 剩余 ${remain} 回合`}</div>`:''}${prog}</div>`;
    }).join('');
    this.container.innerHTML=`<section class="strategic-objectives-panel"><div class="strategic-objectives-title-row"><h3>我方战略目标</h3><span class="strategic-objectives-faction">${sideName}</span></div>${cards||'<div class="strategic-objectives-empty">本战役未设置独立战略目标</div>'}</section>`;
  }
  serialize(){return{objectiveStates:structuredClone?structuredClone(this.objectiveStates):JSON.parse(JSON.stringify(this.objectiveStates))};}
  deserialize(x){this.objectiveStates=x?.objectiveStates?JSON.parse(JSON.stringify(x.objectiveStates)):{};this.render();}
}
export default StrategicObjectives;
