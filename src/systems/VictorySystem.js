// 通用多阵营胜利判定系统
export class VictorySystem {
    constructor(options={}){this.scenario=options.scenario??{};this.gameOver=false;this.winner=null;this.reason="";}
    normalizeSide(side){const v=String(side??"").trim().toLowerCase();return ({ger:"german",germany:"german",german:"german",axis:"german",ussr:"soviet",soviet:"soviet",redarmy:"soviet",chn:"chinese",china:"chinese",chinese:"chinese",jpn:"japanese",japan:"japanese",japanese:"japanese",allied:"allied",allies:"allied",rok_gov:"rok_government",rok_government:"rok_government",newmil:"new_military",new_military:"new_military"})[v]??v;}
    getUnitSide(u){return this.normalizeSide(u?.faction??u?.side??u?.camp);}
    isAlive(u){return !!u&&u.destroyed!==true&&Number(u.strength??u.manpower??1)>0;}
    isCombatUnit(u){const t=String(u?.type??u?.unitType??"").toLowerCase();return this.isAlive(u)&&!t.includes("headquarter")&&!t.includes("hq");}
    getRules(){return this.scenario?.victoryConditions??{};}
    getSides(units=[]){const rules=this.getRules();const ruleSides=Object.keys(rules).filter(k=>!["deadlineTurn","deadlineFailureText"].includes(k));if(ruleSides.length>=2)return ruleSides.map(x=>this.normalizeSide(x));return [...new Set(units.filter(u=>this.isAlive(u)).map(u=>this.getUnitSide(u)).filter(Boolean))];}
    unitAtObjective(units,obj,side){const rad=Math.max(0,Number(obj?.controlRadius??0));return units.some(u=>this.isAlive(u)&&u?.offMap!==true&&this.getUnitSide(u)===side&&Math.abs(Number(u.q)-Number(obj.q))<=rad&&Math.abs(Number(u.r)-Number(obj.r))<=rad);}
    objectivesSatisfied(units,side,capture){const objs=capture?.objectives??[];if(!objs.length)return false;const hits=objs.map(o=>this.unitAtObjective(units,o,side));return capture?.mode==="any"?hits.some(Boolean):hits.every(Boolean);}
    finish(winner,reason){this.gameOver=true;this.winner=winner;this.reason=reason;return {gameOver:true,winner,reason};}
    check(units=[],state={}){
        if(this.gameOver)return {gameOver:true,winner:this.winner,reason:this.reason};
        const rules=this.getRules(), sides=this.getSides(units);
        if(sides.length<2)return {gameOver:false};
        for(const side of sides){const enemies=sides.filter(s=>s!==side);const enemyCombat=units.filter(u=>enemies.includes(this.getUnitSide(u))&&this.isCombatUnit(u));const rule=rules[side]??rules[Object.keys(rules).find(k=>this.normalizeSide(k)===side)]??{};if(rule.eliminateEnemy&&enemyCombat.length===0)return this.finish(side,`${this.sideName(side)}消灭了敌方全部有效作战单位。`);}
        for(const side of sides){const rule=rules[side]??rules[Object.keys(rules).find(k=>this.normalizeSide(k)===side)]??{};if(rule.captureObjectives&&this.objectivesSatisfied(units,side,rule.captureObjectives))return this.finish(side,rule.captureObjectives.successText??`${this.sideName(side)}完成战略目标。`);}
        const deadline=Number(rules.deadlineTurn);if(Number.isFinite(deadline)&&Number(state.turn)>deadline){for(const side of sides){const rule=rules[side]??rules[Object.keys(rules).find(k=>this.normalizeSide(k)===side)]??{};const defend=rule.defendObjectivesUntilDeadline;if(defend){const enemy=sides.find(s=>s!==side);if(!this.objectivesSatisfied(units,enemy,{...defend,objectives:defend.objectives}))return this.finish(side,defend.successText??rules.deadlineFailureText??`${this.sideName(side)}坚持到规定时间。`);}}}
        return {gameOver:false};
    }
    sideName(side){return ({german:"德军",soviet:"苏军",chinese:"中国军",japanese:"日军",british:"英军",italian:"意军",american:"美军",allied:"联军",rok_government:"政府军",new_military:"新军部"})[this.normalizeSide(side)]??side;}
}
