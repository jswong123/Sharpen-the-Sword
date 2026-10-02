// 现代合成旅动态编组系统 v0.1.3
// 旅级骨架按公开资料抽象；具体装备数量/战斗参数均为游戏化数值。
const EQUIPMENT = {
 ZTZ99A:{name:"ZTZ-99A主战坦克"}, ZBD04A:{name:"ZBD-04A步兵战车"}, PLZ05:{name:"PLZ-05自行榴弹炮"},
 HQ17A:{name:"红旗-17A野战防空系统"}, ZTL11:{name:"ZTL-11轮式突击车"}, ZBL08:{name:"ZBL-08轮式步兵战车"},
 PCL181:{name:"PCL-181车载榴弹炮"}, CSK181:{name:"CSK-181装甲高机动车"},
 PCP001:{name:"轻型火力支援车"}, UAV_RECON:{name:"战术侦察无人机系统"},
 ENG_VEH:{name:"装甲工程保障车辆"}, LOG_VEH:{name:"综合保障车辆"}
};
const TEMPLATES = {
 heavy:{name:"重型合成旅",maneuver:"heavy",tank:"ZTZ99A",ifv:"ZBD04A",art:"PLZ05",ad:"HQ17A",support:"ZBD04A",atk:1.12,def:1.15,mov:.92},
 medium:{name:"中型合成旅",maneuver:"medium",tank:"ZTL11",ifv:"ZBL08",art:"PCL181",ad:"HQ17A",support:"ZBL08",atk:1.02,def:.98,mov:1.16},
 light:{name:"轻型合成旅",maneuver:"light",tank:"CSK181",ifv:"CSK181",art:"PCL181",ad:"HQ17A",support:"PCP001",atk:.90,def:.86,mov:1.25}
};
const eqName=id=>EQUIPMENT[id]?.name??id;
function make(id,name,faction,type,echelon,q,r,strength,attack,defense,movement,range,equipment,qty,formation,parentHQ=null){
 return {id,name:`${name}｜${eqName(equipment)}`,fullName:name,faction,type,echelon,q,r,strength,maxStrength:strength,
  manpower:strength,maxManpower:strength,attack,defense,movement,movementPoints:movement,maxMovementPoints:movement,
  actionPoints:4,maxActionPoints:4,range,morale:82,ammo:100,fuel:100,supply:100,formation,parentHQ,
  equipment:[{type:equipment,name:eqName(equipment),initial:qty,operational:qty,damaged:0,destroyed:0}],
  equipmentSummary:`${eqName(equipment)} ${qty}/${qty}`,modern:{c2:100,intelLevel:0,supply:100,ammo:100,fuel:100,parentHQ}};
}
function maneuverCompanies(T, side, b, faction, baseQ, baseR, stepQ, stepR, form, bnHQ){
 const p=`${side}_BN${b}`; const pos=i=>({q:baseQ+stepQ*(i%2),r:baseR+stepR*Math.floor(i/2)}); const a=[];
 const add=(suffix,name,type,eq,qty,atk,def,mov,i)=>{const x=pos(i);a.push(make(`${p}_${suffix}`,name,faction,type,"company",x.q,x.r,100,Math.round(atk*T.atk),Math.round(def*T.def),Math.max(4,Math.round(mov*T.mov)),type==="tank"?2:1,eq,qty,form,bnHQ));};
 if(T.maneuver==="heavy"){
  add("T1",`第${b}合成营坦克1连`,"tank",T.tank,14,12,10,5,0); add("T2",`第${b}合成营坦克2连`,"tank",T.tank,14,12,10,5,1);
  add("M1",`第${b}合成营装甲步兵1连`,"infantry",T.ifv,14,9,9,5,2); add("M2",`第${b}合成营装甲步兵2连`,"infantry",T.ifv,14,9,9,5,3);
 } else if(T.maneuver==="medium"){
  add("A1",`第${b}合成营轮式突击连`,"tank",T.tank,14,10,8,6,0);
  add("M1",`第${b}合成营轮式装步1连`,"infantry",T.ifv,14,9,8,6,1); add("M2",`第${b}合成营轮式装步2连`,"infantry",T.ifv,14,9,8,6,2); add("M3",`第${b}合成营轮式装步3连`,"infantry",T.ifv,14,9,8,6,3);
 } else {
  for(let i=0;i<4;i++) add(`L${i+1}`,`第${b}合成营高机动步兵${i+1}连`,"infantry",T.ifv,18,8,7,7,i);
 }
 const s=pos(4); a.push(make(`${p}_SUP`,`第${b}合成营支援保障连`,faction,"support","company",s.q,s.r,90,4,6,5,2,T.support,10,form,bnHQ));
 return a;
}
function brigade(side,type,flip=false){
 const T=TEMPLATES[type]??TEMPLATES.heavy, faction=side==="RED"?"chinese":"japanese", prefix=side;
 // 红方部署在西侧，蓝方部署在东侧；旅指挥/火力/保障置于纵深，四个合成营分上下两梯队。
 const rearQ=flip?53:6, frontQ=flip?44:15, dir=flip?-1:1, arr=[];
 const bdeHQ=`${prefix}_BDE_HQ`;
 arr.push(make(bdeHQ,`${side==="RED"?"红方":"蓝方"}${T.name}旅指挥所`,faction,"headquarters","brigade",rearQ,20,320,3,12,3,1,"LOG_VEH",8,T.name,null));
 const anchors=[{q:frontQ,r:9},{q:frontQ,r:16},{q:frontQ-dir*4,r:25},{q:frontQ-dir*4,r:32}];
 anchors.forEach((p,i)=>{
  const b=i+1,bnHQ=`${prefix}_BN${b}_HQ`,form=`${T.name}·第${b}合成营`;
  arr.push(make(bnHQ,`第${b}合成营指挥所`,faction,"headquarters","battalion",p.q-dir*2,p.r,180,3,9,4,1,"LOG_VEH",4,form,bdeHQ));
  arr.push(...maneuverCompanies(T,prefix,b,faction,p.q,p.r-1,dir*2,2,form,bnHQ));
 });
 arr.push(make(`${prefix}_ART1`,"旅炮兵营第1火力连",faction,"artillery","company",rearQ+dir*4,13,120,13,5,4,6,T.art,6,T.name,bdeHQ));
 arr.push(make(`${prefix}_ART2`,"旅炮兵营第2火力连",faction,"artillery","company",rearQ+dir*4,27,120,13,5,4,6,T.art,6,T.name,bdeHQ));
 arr.push(make(`${prefix}_AD`,"旅防空营野战防空连",faction,"air_defense","company",rearQ+dir*2,17,110,7,7,4,4,T.ad,6,T.name,bdeHQ));
 arr.push(make(`${prefix}_RECON`,"旅侦察营无人侦察连",faction,"recon","company",frontQ+dir*3,20,90,4,5,7,4,"UAV_RECON",6,T.name,bdeHQ));
 arr.push(make(`${prefix}_ENG`,"旅作战支援营工程连",faction,"engineer","company",rearQ+dir*3,22,100,5,7,4,1,"ENG_VEH",10,T.name,bdeHQ));
 arr.push(make(`${prefix}_LOG`,"旅勤务保障营保障连",faction,"supply","company",rearQ,24,100,2,6,4,1,"LOG_VEH",18,T.name,bdeHQ));
 return arr;
}
export class ModernBrigadeSystem {
 static isModern(config){return config?.modernBrigadeSelection===true;}
 static getSelection(){try{return JSON.parse(sessionStorage.getItem("modernBrigadeSelection")||"{}");}catch{return {};}}
 static generate(config){const s=this.getSelection();return [...brigade("RED",s.red||"heavy",false),...brigade("BLUE",s.blue||"medium",true)];}
 static templateInfo(){return TEMPLATES;}
}
