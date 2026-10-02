// src/ui/CampaignSelection.js

import { CAMPAIGNS } from "../../data/campaigns.js";

 

export class CampaignSelection {

    constructor() {

        this.overlay = null;

        this.theater = null;

        this.phase = null;

        this.onScenarioSelected = null;
        this.onMainMenu = null;
        this.onReturnToBattle = null;
        this.hasActiveBattle = false;
        this._escHandler = (event) => { if (event.key === "Escape" && this.overlay) this.returnOut(); };
        document.addEventListener("keydown", this._escHandler);
    }

    show(onScenarioSelected, options = {}) {
        this.onScenarioSelected = onScenarioSelected;
        this.onMainMenu = options.onMainMenu ?? null;
        this.onReturnToBattle = options.onReturnToBattle ?? null;
        this.hasActiveBattle = !!options.hasActiveBattle;
        this.renderTheaters();
    }

    returnOut() {
        this.close();
        if (this.hasActiveBattle && this.onReturnToBattle) this.onReturnToBattle();
        else this.onMainMenu?.();
    }

 

    close() {

        this.overlay?.remove();

        this.overlay = null;

    }

 

    ensureOverlay() {

        this.close();

        this.overlay = document.createElement("div");

        this.overlay.id = "campaign-selection";

        Object.assign(this.overlay.style, {

            position: "fixed", inset: "0", zIndex: "100000",

            background: "rgba(28,31,26,.94)",

            display: "flex", alignItems: "center", justifyContent: "center",

            fontFamily: "FangSong, STFangsong, SimSun, serif"

        });

        document.body.appendChild(this.overlay);

        return this.overlay;

    }

 

    shell(title, subtitle, body, back = "") {

        const overlay = this.ensureOverlay();

        overlay.innerHTML = `

            <div style="width:min(980px,calc(100vw - 48px));max-height:90vh;overflow:auto;

                padding:32px 38px;box-sizing:border-box;background:#d6cfb2;color:#24251f;

                border:2px solid #5a5646;outline:1px solid #c6b98b;outline-offset:-8px;">

                <h1 style="margin:0;text-align:center;font-size:34px;letter-spacing:.12em;">${title}</h1>

                <div style="margin:8px 0 28px;text-align:center;color:#666253;">${subtitle}</div>

                ${body}

                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:24px;">
                  ${back ? `<button id="campaign-back" style="padding:9px 18px;">← 返回上一级</button>` : ""}
                  <button id="campaign-main" style="padding:9px 18px;">返回主界面</button>
                  ${this.hasActiveBattle ? `<button id="campaign-battle" style="padding:9px 18px;">返回当前战役</button>` : ""}
                </div>
            </div>`;

        if (back) overlay.querySelector("#campaign-back").onclick = back;
        overlay.querySelector("#campaign-main").onclick = () => { this.close(); this.onMainMenu?.(); };
        overlay.querySelector("#campaign-battle")?.addEventListener("click", () => { this.close(); this.onReturnToBattle?.(); });

        return overlay;

    }

 

    renderTheaters() {

        const cards = CAMPAIGNS.filter(Boolean).map(item => `

            <button data-theater="${item.id}" style="min-height:${item.ui?.height ?? 150}px;${item.ui?.width ? `width:${item.ui.width}px;` : ''}padding:20px;

                border:1px solid #696553;background:#c8c1a4;cursor:pointer;font:inherit;text-align:left;">

                <strong style="display:block;font-size:26px;margin-bottom:10px;">${item.name}</strong>

                <span>${item.subtitle}</span>

            </button>`).join("");

 

        const overlay = this.shell(

            "选择战场",

            "1937–1945 主战役 · 特殊战役合集",

            `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;">${cards}</div>`

        );

 

        overlay.querySelectorAll("[data-theater]").forEach(button => {

            button.onclick = () => {

                this.rootTheater = null;
                this.theater = CAMPAIGNS.find(x => x?.id === button.dataset.theater);
                if (Array.isArray(this.theater?.subtheaters) && this.theater.subtheaters.length) this.renderSubtheaters();
                else this.renderPhases();

            };

        });

    }

 

    renderSubtheaters() {
        const rootTheater = this.theater;
        const cards = rootTheater.subtheaters.map(item => `
            <button data-subtheater="${item.id}" style="min-height:${item.ui?.height ?? 150}px;padding:20px;
                border:1px solid #696553;background:#c8c1a4;cursor:pointer;font:inherit;text-align:left;">
                <strong style="display:block;font-size:26px;margin-bottom:10px;">${item.name}</strong>
                <span>${item.subtitle ?? ""}</span>
            </button>`).join("");
        const overlay = this.shell(
            rootTheater.name,
            "选择欧洲战区",
            `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;">${cards}</div>`,
            () => { this.theater = rootTheater; this.renderTheaters(); }
        );
        overlay.querySelectorAll("[data-subtheater]").forEach(button => {
            button.onclick = () => {
                const sub = rootTheater.subtheaters.find(x => x.id === button.dataset.subtheater);
                this.rootTheater = rootTheater;
                this.theater = sub;
                this.renderPhases();
            };
        });
    }

    renderPhases() {

        const phases = Array.isArray(this.theater?.phases) ? this.theater.phases : [];
        const cards = phases.filter(Boolean).map(item => `

            <button data-phase="${item.id}" style="min-height:${item.ui?.height ?? 110}px;${item.ui?.width ? `width:${item.ui.width}px;` : ''}padding:18px;

                border:1px solid #696553;background:#c8c1a4;cursor:pointer;font:inherit;text-align:left;">

                <strong style="font-size:21px;">${item.name}</strong>

                <div style="margin-top:10px;color:#625e50;">

                    ${(item.scenarios ?? []).some(s => s?.status === "available") ? "可进入" : ((item.scenarios ?? []).some(s => s?.status === "interface") ? "战役接口已建立" : "尚未开放")}

                </div>

            </button>`).join("");

 

        const overlay = this.shell(

            this.theater.name,

            "选择战役阶段",

            `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">${cards}</div>`,

            () => {
                if (this.rootTheater?.subtheaters?.includes(this.theater)) {
                    const root = this.rootTheater;
                    this.theater = root;
                    this.rootTheater = null;
                    this.renderSubtheaters();
                } else this.renderTheaters();
            }

        );

 

        overlay.querySelectorAll("[data-phase]").forEach(button => {

            button.onclick = () => {

                this.phase = (this.theater?.phases ?? []).find(x => x?.id === button.dataset.phase);

                this.renderScenarios();

            };

        });

    }

 

    renderScenarios() {

        const scenarios = Array.isArray(this.phase?.scenarios) ? this.phase.scenarios : [];
        const list = scenarios.length

            ? scenarios.filter(Boolean).map(item => {

                const locked = !["available", "interface"].includes(item.status);
                const interfaceOnly = item.status === "interface" || item.interfaceOnly === true;

                return `<button data-scenario="${item.id}" ${locked ? "disabled" : ""}

                    style="min-height:${item.ui?.height ?? 130}px;${item.ui?.width ? `width:${item.ui.width}px;` : ''}padding:20px;border:1px solid #696553;

                    background:${locked ? "#aaa58f" : "#c8c1a4"};cursor:${locked ? "not-allowed" : "pointer"};

                    font:inherit;text-align:left;opacity:${locked ? ".65" : "1"};">

                    <strong style="display:block;font-size:24px;">${item.name}</strong>

                    ${Array.isArray(item.children) && item.children.length ? `<span style="display:inline-block;margin-top:8px;padding:3px 8px;border:1px solid #817a62;background:#ded7bb;color:#403d32;font-size:13px;">含 ${item.children.length} 个子战役</span>` : ""}

                    <span style="display:block;margin-top:8px;">${item.dateText ?? "开发中"}</span>

                    <span style="display:block;margin-top:8px;color:#625e50;">

                        ${locked ? "尚未开放" : (interfaceOnly ? `${item.location ?? ""} · 接口已建立 / 地图与单位待制作` : (item.location ?? "可进入战役"))}

                    </span>

                </button>`;

            }).join("")

            : `<div style="padding:40px;text-align:center;">该阶段战役尚未开放。</div>`;

 

        const overlay = this.shell(

            this.phase.name,

            this.theater.name,

            `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">${list}</div>`,

            () => this.renderPhases()

        );

 

        overlay.querySelectorAll("[data-scenario]:not([disabled])").forEach(button => {

            button.onclick = () => {
                const item = this.phase.scenarios.find(x => x.id === button.dataset.scenario);
                if (Array.isArray(item?.children) && item.children.length) this.renderScenarioGroup(item);
                else this.renderBriefing(button.dataset.scenario);
            };

        });

    }

 

    renderScenarioGroup(parent) {
        const entries = [parent, ...(parent.children ?? [])];
        const cards = entries.map((item, index) => {
            const interfaceOnly = item.status === "interface" || item.interfaceOnly === true;
            const label = index === 0 ? (interfaceOnly ? "会战总览接口" : "进入会战主战役") : "子战役";
            return `<button data-child="${item.id}" style="min-height:${item.ui?.height ?? 130}px;${item.ui?.width ? `width:${item.ui.width}px;` : ''}padding:20px;border:1px solid #696553;background:#c8c1a4;cursor:pointer;font:inherit;text-align:left;">
                <strong style="display:block;font-size:24px;">${item.name}</strong>
                <span style="display:block;margin-top:8px;">${item.dateText ?? ""}</span>
                <span style="display:block;margin-top:8px;color:#625e50;">${label} · ${item.location ?? ""}</span>
            </button>`;
        }).join("");
        const overlay = this.shell(parent.name, "会战主战役与所属子战役", `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">${cards}</div>`, () => this.renderScenarios());
        overlay.querySelectorAll("[data-child]").forEach(button => {
            button.onclick = () => {
                const id = button.dataset.child;
                const item = entries.find(x => x.id === id);
                this.renderBriefingObject(item, parent);
            };
        });
    }

    difficultySelector() {
        return `<div style="margin-top:22px;padding:14px;border:1px solid #77715d;background:rgba(255,255,255,.12);">
            <div style="font-weight:700;margin-bottom:10px;">难度选择</div>
            <div class="campaign-difficulty" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
                <label><input type="radio" name="campaign-difficulty" value="0.5"> 简单 ×0.5</label>
                <label><input type="radio" name="campaign-difficulty" value="1" checked> 普通 ×1</label>
                <label><input type="radio" name="campaign-difficulty" value="2"> 困难 ×2</label>
                <label><input type="radio" name="campaign-difficulty" value="3"> 试炼 ×3</label>
            </div>
            <div style="margin-top:7px;color:#625e50;font-size:13px;">倍率作用于敌军现有战斗参数；移动力与射程保持原值。</div>
        </div>`;
    }

    selectedDifficulty(overlay) {
        const multiplier = Number(overlay.querySelector('input[name="campaign-difficulty"]:checked')?.value ?? 1);
        const names = {0.5:'简单',1:'普通',2:'困难',3:'试炼'};
        return { multiplier, name:names[multiplier] ?? '普通' };
    }

    renderModernBrigadeSelection(scenario, parent = null) {
        const types = [
            ["heavy","重型合成旅","ZTZ-99A / ZBD-04A / PLZ-05","火力、防护强；后勤压力高"],
            ["medium","中型合成旅","ZTL-11 / ZBL-08 / PCL-181","轮式高速机动；综合均衡"],
            ["light","轻型合成旅","CSK-181 / PCL-181","高机动；正面装甲对抗较弱"]
        ];
        const opts = types.map(([id,n,e])=>`<option value="${id}">${n}｜${e}</option>`).join("");
        const overlay=this.shell("选择红蓝双方旅级单位","砺剑-26 · 现代合成旅红蓝对抗",
          `<div style="padding:22px;background:#c8c1a4;border:1px solid #696553;line-height:1.7">
             <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
               <label><strong>红方旅型</strong><br><select id="modern-red" style="width:100%;padding:10px;margin-top:8px">${opts}</select></label>
               <label><strong>蓝方旅型</strong><br><select id="modern-blue" style="width:100%;padding:10px;margin-top:8px">${opts}</select></label>
             </div>
             <div id="modern-preview" style="margin-top:18px;padding:14px;border:1px solid #817a62"></div>
             <button id="modern-next" style="display:block;margin:22px auto 0;padding:11px 30px;font:inherit">确认编组</button>
           </div>`,()=>parent?this.renderScenarioGroup(parent):this.renderScenarios());
        const red=overlay.querySelector("#modern-red"), blue=overlay.querySelector("#modern-blue"), preview=overlay.querySelector("#modern-preview");
        blue.value="medium";
        const info=()=>{const get=v=>types.find(x=>x[0]===v);const a=get(red.value),b=get(blue.value);
          preview.innerHTML=`<strong>红方：</strong>${a[1]} · ${a[2]}<br>${a[3]}<br><br><strong>蓝方：</strong>${b[1]} · ${b[2]}<br>${b[3]}<br><br><span style="font-size:13px">装备数量与性能数值为游戏化抽象；单位名称会直接显示主要装备型号。</span>`;};
        red.onchange=info;blue.onchange=info;info();
        overlay.querySelector("#modern-next").onclick=()=>{sessionStorage.setItem("modernBrigadeSelection",JSON.stringify({red:red.value,blue:blue.value}));this.renderBriefingObject({...scenario,modernSelectionDone:true},parent);};
    }

    renderBriefingObject(scenario, parent = null) {
        if (scenario.modernBrigadeSelection && !scenario.modernSelectionDone) { this.renderModernBrigadeSelection(scenario, parent); return; }
        const overlay = this.shell(
            scenario.name, `${scenario.dateText ?? ""} · ${scenario.location ?? ""}`,
            `<div style="padding:24px;background:#c8c1a4;border:1px solid #696553;line-height:1.8;">
                ${parent && parent.id !== scenario.id ? `<div><strong>所属会战：</strong>${parent.name}</div>` : ""}
                <div><strong>战场：</strong>${this.rootTheater ? `${this.rootTheater.name} · ${this.theater.name}` : this.theater.name}</div><div><strong>阶段：</strong>${this.phase.name}</div>
                <div><strong>战役：</strong>${scenario.name}</div><div><strong>规模：</strong>营 / 连级战术单位</div>
                ${scenario.urbanDefense ? `<div><strong>城市防御：</strong>启用分段城墙系统（独立耐久 / 0耐久形成缺口 / 完整城墙禁止绕行）</div>` : ""}
                ${scenario.interfaceOnly ? `<div style="margin-top:18px;padding:12px;border:1px dashed #696553;"><strong>开发状态：</strong>战役接口已建立；地图、单位与具体任务数据将在后续版本制作。</div>` : ""}
                ${scenario.interfaceOnly ? "" : this.difficultySelector()}
                <button id="campaign-start" ${scenario.interfaceOnly ? "disabled" : ""} style="display:block;margin:28px auto 0;padding:12px 34px;font:inherit;font-size:18px;cursor:${scenario.interfaceOnly ? "not-allowed" : "pointer"};opacity:${scenario.interfaceOnly ? ".55" : "1"};">${scenario.interfaceOnly ? "接口已建立 · 待制作" : "开始战役"}</button>
            </div>`, () => parent ? this.renderScenarioGroup(parent) : this.renderScenarios());
        if (!scenario.interfaceOnly) overlay.querySelector("#campaign-start").onclick = () => { this.close(); this.onScenarioSelected?.(scenario.id, this.selectedDifficulty(overlay)); };
    }

    renderBriefing(id) {

        const parent = this.phase.scenarios.find(x => x.id === id || x.children?.some(c => c.id === id));
        const scenario = parent?.id === id ? parent : parent?.children?.find(c => c.id === id);
        if (!scenario) return;
        if (parent?.id !== id) return this.renderBriefingObject(scenario, parent);

        const overlay = this.shell(

            scenario.name,

            `${scenario.dateText ?? ""} · ${scenario.location ?? ""}`,

            `<div style="padding:24px;background:#c8c1a4;border:1px solid #696553;line-height:1.8;">

                <div><strong>战场：</strong>${this.rootTheater ? `${this.rootTheater.name} · ${this.theater.name}` : this.theater.name}</div>

                <div><strong>阶段：</strong>${this.phase.name}</div>

                <div><strong>战役：</strong>${scenario.name}</div>

                <div><strong>规模：</strong>营 / 连级战术单位</div>
                ${scenario.urbanDefense ? `<div><strong>城市防御：</strong>启用分段城墙系统（独立耐久 / 0耐久形成缺口 / 完整城墙禁止绕行）</div>` : ""}
                ${scenario.interfaceOnly ? `<div style="margin-top:18px;padding:12px;border:1px dashed #696553;"><strong>开发状态：</strong>战役接口已建立；地图、单位与具体任务数据将在后续版本制作。</div>` : ""}
                ${scenario.interfaceOnly ? "" : this.difficultySelector()}

                <button id="campaign-start" ${scenario.interfaceOnly ? "disabled" : ""} style="display:block;margin:28px auto 0;padding:12px 34px;

                    font:inherit;font-size:18px;cursor:${scenario.interfaceOnly ? "not-allowed" : "pointer"};opacity:${scenario.interfaceOnly ? ".55" : "1"};">${scenario.interfaceOnly ? "接口已建立 · 待制作" : "开始战役"}</button>

            </div>`,

            () => this.renderScenarios()

        );

 

        if (!scenario.interfaceOnly) {
            overlay.querySelector("#campaign-start").onclick = () => {
                this.close();
                this.onScenarioSelected?.(scenario.id, this.selectedDifficulty(overlay));
            };
        }

    }

}
