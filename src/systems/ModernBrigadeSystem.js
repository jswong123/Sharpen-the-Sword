
const EQUIPMENT = {
 ZTZ99A:{name:"ZTZ-99A主战坦克"}, ZBD04A:{name:"ZBD-04A步兵战车"}, PLZ05:{name:"PLZ-05自行榴弹炮"},
 HQ17A:{name:"红旗-17A野战防空系统"}, ZTL11:{name:"ZTL-11轮式突击车"}, ZBL08:{name:"ZBL-08轮式步兵战车"},
 PCL181:{name:"PCL-181车载榴弹炮"}, CSK181:{name:"CSK-181装甲高机动车"},
 UAV_RECON:{name:"战术侦察无人机系统"}, ENG_VEH:{name:"装甲工程保障车辆"}, LOG_VEH:{name:"综合保障车辆"}
};
const TEMPLATES = {
 heavy:{name:"重型合成旅",tank:"ZTZ99A",ifv:"ZBD04A",art:"PLZ05",ad:"HQ17A",atk:1.12,def:1.15,mov:.92},
 medium:{name:"中型合成旅",tank:"ZTL11",ifv:"ZBL08",art:"PCL181",ad:"HQ17A",atk:1.02,def:.98,mov:1.16},
 light:{name:"轻型合成旅",tank:"CSK181",ifv:"CSK181",art:"PCL181",ad:"HQ17A",atk:.90,def:.86,mov:1.25}
};
const eqName=id=>EQUIPMENT[id]?.name??id;
function make(id,name,faction,type,echelon,q,r,strength,attack,defense,movement,range,equipment,qty,formation){
 const t={id,name:`${name}｜${eqName(equipment)}`,fullName:name,faction,type,echelon,q,r,strength,maxStrength:strength,
 manpower:strength,maxManpower:strength,attack,defense,movement,movementPoints:movement,maxMovementPoints:movement,
 actionPoints:4,maxActionPoints:4,range,morale:82,ammo:100,fuel:100,supply:100,formation,
 equipment:[{type:equipment,name:eqName(equipment),initial:qty,operational:qty,damaged:0,destroyed:0}],
 equipmentSummary:`${eqName(equipment)} ${qty}/${qty}`,modern:{c2:100,intelLevel:0,supply:100,ammo:100,fuel:100}};
 return t;
}
function brigade(side,type,originQ,flip=false){
 const T=TEMPLATES[type]??TEMPLATES.heavy, f=side==="RED"?"chinese":"japanese", prefix=side, dir=flip?-1:1;
 const r0=flip?25:5, rows=n=>r0+dir*n, arr=[];
 arr.push(make(`${prefix}_BDE_HQ`,`${side==="RED"?"红方":"蓝方"}${T.name}旅指挥所`,f,"headquarters","brigade",originQ+10,rows(0),320,3,12,3,1,"LOG_VEH",8,T.name));
 for(let b=1;b<=4;b++){
   const x=originQ+(b-1)*7;
   arr.push(make(`${prefix}_BN${b}_HQ`,`第${b}合成营指挥所`,f,"headquarters","battalion",x+2,rows(3),180,3,9,4,1,"LOG_VEH",4,`${T.name}·第${b}合成营`));
   arr.push(make(`${prefix}_BN${b}_A`,`第${b}合成营突击1连`,f,"tank","company",x,rows(5),100,Math.round(12*T.atk),Math.round(10*T.def),Math.max(4,Math.round(5*T.mov)),2,T.tank,14,`${T.name}·第${b}合成营`));
   arr.push(make(`${prefix}_BN${b}_B`,`第${b}合成营突击2连`,f,"tank","company",x+2,rows(6),100,Math.round(12*T.atk),Math.round(10*T.def),Math.max(4,Math.round(5*T.mov)),2,T.tank,14,`${T.name}·第${b}合成营`));
   arr.push(make(`${prefix}_BN${b}_C`,`第${b}合成营装步1连`,f,"infantry","company",x+4,rows(5),100,Math.round(9*T.atk),Math.round(9*T.def),Math.max(4,Math.round(5*T.mov)),1,T.ifv,14,`${T.name}·第${b}合成营`));
   arr.push(make(`${prefix}_BN${b}_D`,`第${b}合成营装步2连`,f,"infantry","company",x+6,rows(6),100,Math.round(9*T.atk),Math.round(9*T.def),Math.max(4,Math.round(5*T.mov)),1,T.ifv,14,`${T.name}·第${b}合成营`));
 }
 arr.push(make(`${prefix}_ART1`,"旅炮兵营第1火力连",f,"artillery","company",originQ+5,rows(1),120,13,5,4,6,T.art,6,T.name));
 arr.push(make(`${prefix}_ART2`,"旅炮兵营第2火力连",f,"artillery","company",originQ+12,rows(1),120,13,5,4,6,T.art,6,T.name));
 arr.push(make(`${prefix}_AD`,"旅防空营野战防空连",f,"air_defense","company",originQ+18,rows(1),110,7,7,4,4,T.ad,6,T.name));
 arr.push(make(`${prefix}_RECON`,"旅侦察营无人侦察连",f,"recon","company",originQ+22,rows(2),90,4,5,7,4,"UAV_RECON",6,T.name));
 arr.push(make(`${prefix}_ENG`,"旅作战支援营工程连",f,"engineer","company",originQ+25,rows(2),100,5,7,4,1,"ENG_VEH",10,T.name));
 arr.push(make(`${prefix}_LOG`,"旅勤务保障营保障连",f,"supply","company",originQ+28,rows(1),100,2,6,4,1,"LOG_VEH",18,T.name));
 return arr;
}
export class ModernBrigadeSystem {
 static isModern(config){return config?.modernBrigadeSelection===true;}
 static getSelection(){try{return JSON.parse(sessionStorage.getItem("modernBrigadeSelection")||"{}");}catch{return {};}}
 static generate(config){
   const s=this.getSelection(), red=s.red||"heavy", blue=s.blue||"medium";
   return [...brigade("RED",red,3,false),...brigade("BLUE",blue,3,true)];
 }
 static templateInfo(){return TEMPLATES;}
}
