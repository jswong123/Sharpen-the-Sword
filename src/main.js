// ============================================================
// main.js
// V1.4 — 玩家控制 / 阶段同步 / 目标胜利 / 存档 / 读取 / 撤销
// ============================================================
import { WorldMap } from "./WorldMap.js";
import { Camera } from "./Camera.js";
import { Renderer } from "./Renderer.js";
import { UnitSelection } from "./UnitSelection.js";
import { GameState } from "./GameState.js";
import { FactionSelection } from "./FactionSelection.js";
import { TurnSystem } from "./TurnSystem.js";
import { VictorySystem } from "./systems/VictorySystem.js";
import { MovementSystem } from "./systems/MovementSystem.js";
import { CombatSystem } from "./systems/CombatSystem.js";
import { AISystem } from "./systems/AISystem.js";
import { SaveSystem } from "./systems/SaveSystem.js";
import { UndoSystem } from "./systems/UndoSystem.js";
import { pixelToHex } from "./Hex.js";
import { CampaignSelection } from "./ui/CampaignSelection.js";
import { ScenarioManager } from "./scenarios/ScenarioManager.js";
import { FactionSystem } from "./systems/FactionSystem.js";
import { ReinforcementSystem } from "./systems/ReinforcementSystem.js";
import { StrategicObjectives } from "./systems/StrategicObjectives.js";
import { EngineerSystem } from "./systems/EngineerSystem.js";
import { EquipmentDeckSystem } from "./systems/EquipmentDeckSystem.js";
import { EQUIPMENT_CARDS, EQUIPMENT_DECKS } from "../data/equipment-cards.js";
import { AIRCRAFT } from "../data/aircraft.js";
import { AIR_SUPPORT_CARDS, AIR_SUPPORT_DECKS } from "../data/air-support-cards.js";
import { AirDefenseSystem } from "./systems/AirDefenseSystem.js";
import { AirSupportSystem } from "./systems/AirSupportSystem.js";
import { FortificationDamageSystem } from "./systems/FortificationDamageSystem.js";
import { FogOfWarSystem } from "./systems/FogOfWarSystem.js";
import { ZoneControlSystem } from "./systems/ZoneControlSystem.js";
import { FieldHospitalSystem } from "./systems/FieldHospitalSystem.js";
import { AirSuperioritySystem } from "./systems/AirSuperioritySystem.js";
import { HexInfoPanel } from "./ui/HexInfoPanel.js";
import { CAMPAIGNS } from "../data/campaigns.js";
import { IntegrityMonitor } from "./systems/IntegrityMonitor.js";
// ============================================================
// 多战场战役系统
// ============================================================
let currentScenarioKey = null;
let currentScenarioConfig = null;
let currentDifficulty = { name: "普通", multiplier: 1 };
const campaignSelection = new CampaignSelection();
function getScenarioConfig() {
    return currentScenarioConfig ?? {
        id: currentScenarioKey ?? "dubno",
        name: scenario?.name ?? "战役",
        factions: ["GER", "USSR"],
        start: { year:1941, month:6, day:26, hour:8, minute:0, hoursPerTurn:2, startingPhase:"german" }
    };
}
function showScenarioSelection() {
    const hasActiveBattle = !!currentScenarioKey && Array.isArray(units) && units.length > 0;
    campaignSelection.show(
        async (scenarioId, difficulty) => { currentDifficulty = difficulty ?? { name:"普通", multiplier:1 }; await loadScenario(scenarioId); },
        {
            hasActiveBattle,
            onMainMenu: () => showMainMenu(),
            onReturnToBattle: () => { hideMainMenu(); document.getElementById('pauseMenu')?.setAttribute('hidden',''); render(); }
        }
    );
}
// ============================================================
// DOM
// ============================================================
const canvas =
    document.getElementById("game-canvas");
const mapArea =
    document.getElementById("mapArea");
const unitInfo =
    document.getElementById("unitInfo");
const turnInfo =
    document.getElementById("turnInfo");
const turnNumber =
    document.getElementById("turnNumber");
const turnTime =
    document.getElementById("turnTime");
const turnPhase =
    document.getElementById("turnPhase");
const endPhaseButton =
    document.getElementById("endPhaseButton");
const reinforcementPanel = document.getElementById("reinforcementPanel");
const reinforcementNext = document.getElementById("reinforcementNext");
const reinforcementLog = document.getElementById("reinforcementLog");
const hexInfoElement = document.getElementById("hexInfoPanel");
const engineerActions = document.getElementById("engineerActions");
const buildFortButton = document.getElementById("buildFortButton");
const layMineButton = document.getElementById("layMineButton");
const clearMineButton = document.getElementById("clearMineButton");
const buildFoxholeButton=document.getElementById("buildFoxholeButton");
const buildBunkerButton=document.getElementById("buildBunkerButton");
const buildAA1Button=document.getElementById("buildAA1Button");
const buildAA2Button=document.getElementById("buildAA2Button");
const buildAA3Button=document.getElementById("buildAA3Button");
const buildBridgeButton=document.getElementById("buildBridgeButton");
const repairBridgeButton=document.getElementById("repairBridgeButton");
const demolishBridgeButton=document.getElementById("demolishBridgeButton");
const buildWallButton=document.getElementById("buildWallButton");
const demolishWallButton=document.getElementById("demolishWallButton");
if (!canvas) {
    throw new Error(
        "找不到 #game-canvas，请检查 index.html"
    );
}
// ============================================================
// 游戏核心对象
// ============================================================
const world =
    new WorldMap();
const camera =
    new Camera();
const renderer =
    new Renderer(
        canvas,
        world,
        camera
    );
const integrityMonitor = new IntegrityMonitor(world);
const casualtyState = { sides: {} };
// ============================================================
// 2.5D tabletop view (visual only; rules and hit testing remain Hex based)
// ============================================================
const view25DToggle = document.getElementById("view25d-toggle");
const controlZoneToggle = document.getElementById("control-zone-toggle");
const view25DLeft = document.getElementById("view25d-left");
const view25DRight = document.getElementById("view25d-right");
const view25DDirection = document.getElementById("view25d-direction");
const sandtablePitch = document.getElementById("sandtable-pitch");
const sandtableReset = document.getElementById("sandtable-reset");
const view25DLabels = { north:"北", east:"东", south:"南", west:"西" };
let view25DEnabled = false;
function refreshView25DControls() {
    if (view25DToggle) {
        view25DToggle.textContent = view25DEnabled ? "立体沙盘" : "二维地图";
        view25DToggle.classList.toggle("active", view25DEnabled);
    }
    if (view25DDirection) view25DDirection.textContent = view25DLabels[renderer.view25D.direction] ?? "南";
}
view25DToggle?.addEventListener("click", () => {
    view25DEnabled = !view25DEnabled;
    renderer.setView25D(view25DEnabled);
    refreshView25DControls();
    render();
});
view25DLeft?.addEventListener("click", () => { renderer.cycleViewDirection(-1); refreshView25DControls(); render(); });
view25DRight?.addEventListener("click", () => { renderer.cycleViewDirection(1); refreshView25DControls(); render(); });
view25DDirection?.addEventListener("click", () => { renderer.cycleViewDirection(1); refreshView25DControls(); render(); });
sandtablePitch?.addEventListener("input", () => {
    renderer.setViewPitch(Number(sandtablePitch.value));
    render();
});
sandtableReset?.addEventListener("click", () => {
    renderer.setViewDirection("south");
    renderer.setViewPitch(52);
    if (sandtablePitch) sandtablePitch.value = "52";
    refreshView25DControls();
    render();
});
renderer.setViewPitch(52);
refreshView25DControls();

const gameState =
    new GameState();
const scenarioManager = new ScenarioManager({ world, gameState });
const selection =
    new UnitSelection(
        renderer,
        gameState
    );
const movementSystem =
    new MovementSystem(
        world
    );
const combatSystem =
    new CombatSystem(
        world
    );
const aiSystem =
    new AISystem(
        movementSystem,
        combatSystem
    );
const factionSelection =
    new FactionSelection(
        gameState
    );
const saveSystem = new SaveSystem({ maxSlots: 3, storagePrefix: "frontline-1937-1945-v0.3" });
const undoSystem = new UndoSystem({ maxHistory: 30 });
// ============================================================
// 游戏状态
// 必须先声明，再初始化任何会读取 turnSystem / scenario 的系统。
// ============================================================
let scenario = null;
let units = [];
let turnSystem = null;
let victorySystem = null;
let lastBattleMessage = "";
let selectedUnit = null;
let gameOver = false;
let aiRunning = false;

const reinforcementSystem = new ReinforcementSystem(world);
const strategicObjectives = new StrategicObjectives({
    getPlayerFaction: () => getPlayerSide(),
    getTurn: () => turnSystem?.turn ?? 1,
    getUnits: () => units,
    container: document.getElementById("strategicObjectives")
});
// 此时 turnSystem 已经完成声明（初值为 null），因此首次渲染安全回退到第1回合。
strategicObjectives.init();
const engineerSystem = new EngineerSystem(world);
const equipmentDeckSystem = new EquipmentDeckSystem({cards:EQUIPMENT_CARDS,decks:EQUIPMENT_DECKS});
// 预留给开发者模式/战役脚本调用，不改变现有战斗规则。
window.frontlineEquipmentDecks = equipmentDeckSystem;
const airDefenseSystem = new AirDefenseSystem(world,()=>units);
const fortificationDamageSystem = new FortificationDamageSystem(world);
const zoneControlSystem = new ZoneControlSystem(world,()=>units);
const fogOfWarSystem = new FogOfWarSystem(world,()=>units,zoneControlSystem);
const fieldHospitalSystem = new FieldHospitalSystem({world,getUnits:()=>units,getTurn:()=>turnSystem?.getTurnNumber?.()??turnSystem?.turn??1});
const airSuperioritySystem = new AirSuperioritySystem();
const airSupportSystem = new AirSupportSystem({world,getUnits:()=>units,getTurn:()=>turnSystem?.getTurnNumber?.()??turnSystem?.turn??1,getPhase:()=>turnSystem?.phase,cards:AIR_SUPPORT_CARDS,decks:AIR_SUPPORT_DECKS,aircraft:AIRCRAFT,airDefense:airDefenseSystem,fortificationDamage:fortificationDamageSystem,airSuperiority:airSuperioritySystem,fogOfWar:fogOfWarSystem});
renderer.fogOfWar=fogOfWarSystem;
renderer.zoneControl=zoneControlSystem;
renderer.showControlZones=true;
window.frontlineFortificationDamage = fortificationDamageSystem;
window.frontlineAirSupport = airSupportSystem;
window.frontlineFogOfWar = fogOfWarSystem;
window.frontlineZoneControl = zoneControlSystem;
window.frontlineFieldHospital = fieldHospitalSystem;
window.frontlineAirSuperiority = airSuperioritySystem;
let pendingAirCard = null;
const hexInfoPanel = new HexInfoPanel(hexInfoElement, world);
let selectedHex = null;
renderer.movementSystem =
    movementSystem;
// ============================================================
// 鼠标状态
// ============================================================
let isDragging = false;
let dragMoved = false;
let lastMouseX = 0;
let lastMouseY = 0;
// ============================================================
// Canvas
// ============================================================
function resizeCanvas() {
    const container = mapArea ?? canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    // Renderer / Camera / 鼠标命中统一使用 CSS 像素。
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
}
// ============================================================
// 渲染
// ============================================================
function render() {
    fogOfWarSystem.recompute();
    const onMap=units.filter(unit => unit.offMap !== true);
    renderer.render(fogOfWarSystem.filterUnits(onMap));
}
if (controlZoneToggle) {
    controlZoneToggle.addEventListener("click", () => {
        renderer.showControlZones = !renderer.showControlZones;
        controlZoneToggle.textContent = renderer.showControlZones ? "控区：开" : "控区：关";
        controlZoneToggle.setAttribute("aria-pressed", renderer.showControlZones ? "true" : "false");
        render();
    });
}

// ============================================================
// 阵营标准化
// ============================================================
function normalizeSide(side) {
    const faction = FactionSystem.getFaction(side);
    if (faction?.side) return faction.side;
    const value = String(side ?? "").trim().toLowerCase();
    const aliases = { chinese:"chinese", china:"chinese", chn:"chinese", japanese:"japanese", japan:"japanese", jpn:"japanese" };
    return aliases[value] ?? value;
}
// ============================================================
// 获取单位阵营
// ============================================================
function getUnitSide(unit) {
    return normalizeSide(
        unit?.side ??
        unit?.faction ??
        unit?.camp
    );
}
// ============================================================
// 玩家阵营
// ============================================================
function getPlayerSide() {
    // FactionSelection / GameState 不同版本可能使用不同字段。
    // 这里统一兼容，避免“界面显示苏军，但控制逻辑仍读取德军”的问题。
    const candidates = [
        gameState.playerFaction,
        gameState.playerSide,
        gameState.selectedFaction,
        gameState.selectedSide,
        gameState.side,
        gameState.faction
    ];
    for (const value of candidates) {
        const side = normalizeSide(value);
        if (["german", "soviet", "chinese", "japanese", "british", "italian", "american", "allied", "rok_government", "new_military"].includes(side)) {
            return side;
        }
    }
    return "";
}
// ============================================================
// 单位是否存活
// ============================================================
function isUnitAlive(unit) {
    if (!unit) {
        return false;
    }
    if (unit.destroyed === true || unit.offMap === true) {
        return false;
    }
    const strength =
        Number(unit.strength);
    const manpower =
        Number(unit.manpower);
    // 任意一个有效兵力字段 <= 0，都视为阵亡
    if (
        Number.isFinite(strength) &&
        strength <= 0
    ) {
        return false;
    }
    if (
        Number.isFinite(manpower) &&
        manpower <= 0
    ) {
        return false;
    }
    return true;
}
// ============================================================
// 单位名称
// ============================================================
function unitName(unit) {
    return (
        unit?.nameZh ??
        unit?.name ??
        unit?.id ??
        "未命名单位"
    );
}
// ============================================================
// 当前兵力
// ============================================================
function getUnitStrength(unit) {
    // strength 是唯一的实时生命力主字段。
    // manpower 仅作为旧数据兼容回退。
    const value =
        Number(
            unit?.strength ??
            unit?.manpower ??
            100
        );
    return Number.isFinite(value)
        ? value
        : 100;
}
// ============================================================
// 最大兵力
// ============================================================
function getUnitMaxStrength(unit) {
    // maxStrength 是最大生命力主字段。
    // maxManpower 仅作为旧数据兼容回退。
    const value =
        Number(
            unit?.maxStrength ??
            unit?.initialStrength ??
            unit?.maxManpower ??
            100
        );
    return Number.isFinite(value)
        ? value
        : 100;
}
// ============================================================
// 兵力显示
// ============================================================
function getStrengthText(unit) {
    return (
        `${Math.max(0, Math.round(getUnitStrength(unit)))} / ` +
        `${Math.max(1, Math.round(getUnitMaxStrength(unit)))}`
    );
}
// ============================================================
// units.json 单位标准化
// ============================================================
function normalizeUnit(rawUnit) {
 const strength =
    Number(
        rawUnit.strength ??
        rawUnit.manpower ??
        100
    );
const maxStrength =
    Number(
        rawUnit.maxStrength ??
        rawUnit.maxManpower ??
        rawUnit.strength ??
        rawUnit.manpower ??
        100
    );
    const movement =
        Number(
            rawUnit.movement ??
            rawUnit.maxMovementPoints ??
            rawUnit.movementPoints ??
            4
        );
    const faction =
        normalizeSide(
            rawUnit.faction ??
            rawUnit.side ??
            rawUnit.camp
        );
    return {
        ...rawUnit,
        id:
            String(
                rawUnit.id ?? ""
            ),
        name:
            String(
                rawUnit.name ??
                rawUnit.nameZh ??
                rawUnit.id ??
                "未知单位"
            ),
        faction,
        side:
            faction,
        type:
            rawUnit.type ??
            rawUnit.unitType ??
            "infantry",
        q:
            Number(
                rawUnit.q
            ),
        r:
            Number(
                rawUnit.r
            ),
        strength:
            Math.max(
                0,
                strength
            ),
        maxStrength:
            Math.max(
                1,
                maxStrength
            ),
        manpower:
            Math.max(
                0,
                strength
            ),
        maxManpower:
            Math.max(
                1,
                maxStrength
            ),
        echelon:
            rawUnit.echelon ??
            "battalion",
        minRange:
            Number(
                rawUnit.minRange ??
                (rawUnit.type === "artillery" ? 2 : 1)
            ),
        maxRange:
            Number(
                rawUnit.maxRange ??
                rawUnit.range ??
                1
            ),
        attack:
            Number(
                rawUnit.attack ?? 5
            ),
        defense:
            Number(
                rawUnit.defense ?? 5
            ),
        range:
            Number(
                rawUnit.range ?? 1
            ),
        movement,
        maxMovementPoints:
            movement,
        movementPoints:
            movement,
        destroyed:
            strength <= 0,
        hasAttacked:
            false,
        morale:
            Number(
                rawUnit.morale ?? 80
            ),
        suppression:
            Number(
                rawUnit.suppression ?? 0
            ),
        fatigue:
            Number(
                rawUnit.fatigue ?? 0
            ),
        ammunition:
            Number(
                rawUnit.ammunition ??
                rawUnit.ammo ??
                100
            ),
        ammo:
            Number(
                rawUnit.ammo ??
                rawUnit.ammunition ??
                100
            )
    };
}
// ============================================================
// 加载 units.json
// ============================================================
async function loadUnitsFromJSON(unitsPath = "./data/units.json") {
    console.log(
        `[单位系统] 正在读取 ${unitsPath}`
    );
    const response =
        await fetch(
            unitsPath,
            {
                cache: "no-store"
            }
        );
    if (!response.ok) {
        throw new Error(
            `units.json 加载失败：HTTP ${response.status}`
        );
    }
    const data =
        await response.json();
    if (
        !data ||
        !Array.isArray(
            data.units
        )
    ) {
        throw new Error(
            "units.json 格式错误：找不到 units 数组"
        );
    }
    const loadedUnits =
        data.units.map(
            normalizeUnit
        );
    console.log(
        `[单位系统] units.json 加载成功：${loadedUnits.length} 个单位`
    );
    return loadedUnits;
}
// ============================================================
// 主系统部署安全检查
// - 手工编制冲突：阻止战役启动，避免静默破坏历史部署
// - 系统自动生成单位（AUTO_RECON / AUTO_AA 等）：自动寻找最近合法空格
// ============================================================
function isSystemGeneratedUnit(unit) {
    const id = String(unit?.id ?? "").toUpperCase();
    return id.includes("_AUTO_") || id.startsWith("AUTO_") || unit?.autoGenerated === true;
}
function deploymentTerrainAllowed(unit, q, r) {
    if (!Number.isFinite(q) || !Number.isFinite(r)) return false;
    if (q < 0 || r < 0 || q >= Number(world?.width ?? 0) || r >= Number(world?.height ?? 0)) return false;
    const terrain = world?.terrainAt?.(q, r) ?? "plain";
    const naval = unit?.domain === "naval" || unit?.unitClass === "naval";
    if (!naval && ["water", "deep_water", "sea", "lake"].includes(terrain)) return false;
    if (naval && !["water", "deep_water", "sea", "lake"].includes(terrain)) return false;
    return true;
}
function findNearestSafeDeployment(unit, occupied, maxRadius = 12) {
    const oq = Number(unit.q), or = Number(unit.r);
    for (let radius = 1; radius <= maxRadius; radius++) {
        const candidates = [];
        for (let dq = -radius; dq <= radius; dq++) {
            for (let dr = -radius; dr <= radius; dr++) {
                const ds = -dq-dr;
                if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds)) !== radius) continue;
                candidates.push([oq+dq, or+dr]);
            }
        }
        // 固定排序保证每次加载结果一致
        candidates.sort((a,b)=>a[1]-b[1] || a[0]-b[0]);
        for (const [q,r] of candidates) {
            if (occupied.has(`${q},${r}`)) continue;
            if (!deploymentTerrainAllowed(unit,q,r)) continue;
            return {q,r};
        }
    }
    return null;
}
function runDeploymentSafetyCheck(unitList, { autoRepair = true } = {}) {
    const occupied = new Map();
    const report = { repaired: [], conflicts: [], invalid: [] };
    for (const unit of unitList) {
        if (unit?.offMap === true || !isUnitAlive(unit)) continue;
        const q=Number(unit.q), r=Number(unit.r);
        if (!deploymentTerrainAllowed(unit,q,r)) {
            report.invalid.push({id:unit.id,q,r,reason:"非法坐标或地形"});
            continue;
        }
        const key=`${q},${r}`;
        if (!occupied.has(key)) { occupied.set(key,unit); continue; }
        const existing=occupied.get(key);
        // 优先移动系统自动生成单位；若先遇到 AUTO 而后遇到历史单位，也移动 AUTO
        let mover = null;
        if (isSystemGeneratedUnit(unit)) mover=unit;
        else if (isSystemGeneratedUnit(existing)) mover=existing;
        if (autoRepair && mover) {
            if (mover === existing) occupied.delete(key);
            const safe=findNearestSafeDeployment(mover,occupied);
            if (safe) {
                const from={q:Number(mover.q),r:Number(mover.r)};
                mover.q=safe.q; mover.r=safe.r;
                occupied.set(`${safe.q},${safe.r}`,mover);
                if (mover !== unit) occupied.set(key,unit);
                report.repaired.push({id:mover.id,from,to:safe,blockedBy:(mover===unit?existing.id:unit.id)});
                console.warn(`[部署安全] ${mover.id} 与 ${mover===unit?existing.id:unit.id} 冲突，已从 (${from.q}, ${from.r}) 自动调整到 (${safe.q}, ${safe.r})`);
                continue;
            }
        }
        report.conflicts.push({a:existing.id,b:unit.id,q,r});
    }
    if (report.repaired.length) console.info(`[部署安全] 已自动修复 ${report.repaired.length} 个系统生成单位部署冲突`);
    if (report.invalid.length) console.error("[部署安全] 非法部署",report.invalid);
    if (report.conflicts.length) console.error("[部署安全] 无法自动修复的部署冲突",report.conflicts);
    return report;
}
// ============================================================
// 单位数据检查
// ============================================================
function validateUnits(
    unitList
) {
    const ids =
        new Set();
    const positions =
        new Map();
    let errors =
        0;
    for (
        const unit
        of unitList
    ) {
        // ----------------------------------------------------
        // ID
        // ----------------------------------------------------
        if (!unit.id) {
            console.error(
                "[单位数据] 存在没有 ID 的单位",
                unit
            );
            errors++;
        }
        else if (
            ids.has(
                unit.id
            )
        ) {
            console.error(
                `[单位数据] 重复单位 ID：${unit.id}`
            );
            errors++;
        }
        else {
            ids.add(
                unit.id
            );
        }
        // ----------------------------------------------------
        // 阵营
        // ----------------------------------------------------
        if (
            !["german", "soviet", "chinese", "japanese", "british", "italian", "american", "allied", "rok_government", "new_military"].includes(getUnitSide(unit))
        ) {
            console.error(
                `[单位数据] ${unit.id} 阵营错误：${unit.faction}`
            );
            errors++;
        }
        // ----------------------------------------------------
        // 地图外增援单位不参与坐标/占格检查
        // ----------------------------------------------------
        if (unit.offMap === true) {
            continue;
        }
        // ----------------------------------------------------
        // 坐标
        // ----------------------------------------------------
        if (
            !Number.isFinite(
                unit.q
            ) ||
            !Number.isFinite(
                unit.r
            )
        ) {
            console.error(
                `[单位数据] ${unit.id} 坐标无效`
            );
            errors++;
            continue;
        }
        // ----------------------------------------------------
        // 一格一单位
        // ----------------------------------------------------
        if (
            isUnitAlive(unit)
        ) {
            const key =
                `${unit.q},${unit.r}`;
            if (
                positions.has(
                    key
                )
            ) {
                const existing =
                    positions.get(
                        key
                    );
                console.error(
                    `[部署冲突] ${existing.id} 与 ${unit.id} 同时位于 (${unit.q}, ${unit.r})`
                );
                errors++;
            }
            else {
                positions.set(
                    key,
                    unit
                );
            }
        }
    }
    if (
        errors === 0
    ) {
        console.log(
            `[单位系统] 数据检查通过：${unitList.length} 个单位`
        );
        return true;
    }
    console.error(
        `[单位系统] 数据检查失败：发现 ${errors} 个问题`
    );
    return false;
}
// ============================================================
// 初始化单位
// ============================================================
function initializeUnits() {
    for (
        const unit
        of units
    ) {
        const side =
            getUnitSide(
                unit
            );
        unit.side =
            side;
        unit.faction =
            side;
        if (
            unit.strength ==
            null
        ) {
            unit.strength =
                100;
        }
        if (
            unit.maxStrength ==
            null
        ) {
            unit.maxStrength =
                unit.strength;
        }
        if (
            unit.strength <= 0
        ) {
            unit.strength = 0;
            unit.destroyed = true;
        }
        combatSystem.resetUnit(
            unit
        );
        if (
            typeof movementSystem.initializeUnit ===
            "function"
        ) {
            movementSystem.initializeUnit(
                unit
            );
        }
        if (
            unit.morale ==
            null
        ) {
            unit.morale =
                80;
        }
        if (
            unit.suppression ==
            null
        ) {
            unit.suppression =
                0;
        }
        if (
            unit.fatigue ==
            null
        ) {
            unit.fatigue =
                0;
        }
        if (
            unit.ammunition ==
            null
        ) {
            unit.ammunition =
                unit.ammo ??
                100;
        }
        if (
            unit.ammo ==
            null
        ) {
            unit.ammo =
                unit.ammunition;
        }
    }
}
// ============================================================
// 回合系统
// ============================================================
function initializeTurnSystem() {
    const config = getScenarioConfig();

    const attacker = normalizeSide(
        config?.roles?.attacker ??
        FactionSystem.getFaction(config?.factions?.[0])?.side ??
        "german"
    );

    const defender = normalizeSide(
        config?.roles?.defender ??
        FactionSystem.getFaction(config?.factions?.[1])?.side ??
        "soviet"
    );

    const startingPhase = normalizeSide(
        config?.start?.startingPhase ?? attacker
    );

    // 当前战役颜色规则同步给 Renderer。
    renderer.setScenarioSides?.(attacker, defender);

    // 行动顺序必须从 startingPhase 开始。
    const phaseOrder = startingPhase === defender
        ? [defender, attacker]
        : [attacker, defender];

    turnSystem = new TurnSystem({
        units,
        year: config.start.year,
        month: config.start.month,
        day: config.start.day,
        hour: config.start.hour,
        minute: config.start.minute,
        hoursPerTurn: config.start.hoursPerTurn,
        startingPhase,
        phaseOrder
    });

    turnSystem.onPhaseChanged = () => {
        clearSelection();
        updateTurnUI();
        render();
    };

    turnSystem.onTurnChanged = () => {
        fogOfWarSystem.advanceTurn();
        airSuperioritySystem.advanceTurn();
        for(const msg of engineerSystem.advanceAllTasks(units)){ writeBattleMessage(msg); }
        processReinforcementsForCurrentTurn();
        updateTurnUI();
        if (!gameOver) checkVictory();
        render();
    };

    turnSystem.onTimeChanged = () => {
        updateTurnUI();
    };

    updateTurnUI();
}
// ============================================================
// 增援 UI
// ============================================================
function updateReinforcementUI() {
    if (!reinforcementPanel || !turnSystem) return;
    const supportsReinforcements = reinforcementSystem.groups.length > 0;
    reinforcementPanel.hidden = !supportsReinforcements;
    if (!supportsReinforcements) return;

    const pending = reinforcementSystem.getPendingGroups(turnSystem.turn, units);
    if (reinforcementNext) {
        if (!pending.length) {
            reinforcementNext.innerHTML = `<div class="reinforcement-empty">暂无待到达增援</div>`;
        } else {
            reinforcementNext.innerHTML = pending.slice(0,4).map(g => `
                <div class="reinforcement-item">
                    <div class="reinforcement-title">第${g.turn}回合 · ${g.name}</div>
                    <div class="reinforcement-detail">${g.detail}</div>
                    <div class="reinforcement-meta">${g.unitCount}个算子 · ${g.turnsRemaining===0?'本回合到达':`还有${g.turnsRemaining}回合`}</div>
                </div>`).join("");
        }
    }
    if (reinforcementLog) {
        const log=reinforcementSystem.getArrivalLog();
        reinforcementLog.innerHTML = log.length
            ? log.slice(0,4).map(x=>`<div class="reinforcement-log-item">第${x.turn}回合：${x.name}（${x.count}个算子）</div>`).join("")
            : `<div class="reinforcement-empty">暂无增援到达</div>`;
    }
}

function processReinforcementsForCurrentTurn() {
    if (!turnSystem || reinforcementSystem.groups.length === 0) return;
    const result=reinforcementSystem.processTurn(turnSystem.turn, units);
    for (const arrival of result.reinforcements ?? []) {
        console.log(`[增援] ${arrival.message}`);
        writeBattleMessage?.(`增援到达：${arrival.message}`);
    }
    applyDifficultyToEnemyUnits();
    updateReinforcementUI();
}

// ============================================================
// 回合 UI
// ============================================================
function updateTurnUI() {
    if (!turnSystem) {
        return;
    }
    updateReinforcementUI();
    strategicObjectives.onTurnChanged();
    if (
        turnInfo &&
        typeof turnSystem.getHeaderText ===
        "function"
    ) {
        turnInfo.textContent =
            turnSystem.getHeaderText();
    }
    const number =
        typeof turnSystem.getTurnNumber ===
        "function"
            ? turnSystem.getTurnNumber()
            : turnSystem.turn ?? 1;
    if (turnNumber) {
        turnNumber.textContent =
            `第${number}回合`;
    }
    if (
        turnTime &&
        typeof turnSystem.getTurnTimeRange ===
        "function"
    ) {
        turnTime.textContent =
            turnSystem.getTurnTimeRange();
    }
    const phase =
        normalizeSide(
            turnSystem.phase
        );
    const phaseName = `${FactionSystem.getSideName(phase)}行动`;
    if (turnPhase) {
        turnPhase.textContent =
            typeof turnSystem.getPhaseName ===
            "function"
                ? turnSystem.getPhaseName()
                : phaseName;
    }
    if (endPhaseButton) {
        endPhaseButton.textContent = "结束回合";
    }
    updateReinforcementUI();
}
// ============================================================
// 当前行动阶段
// ============================================================
function isUnitActive(unit) {
    if (!unit) {
        return false;
    }
    if (!turnSystem) {
        return true;
    }
    return (
        getUnitSide(unit) ===
        normalizeSide(
            turnSystem.phase
        )
    );
}
// ============================================================
// 玩家能否控制单位
// ============================================================
function playerCanControlUnit(unit) {
    if (!unit || !isUnitAlive(unit) || gameOver || aiRunning) {
        return false;
    }
    if (String(gameState.mode).toLowerCase() === "developer") {
        return true;
    }
    if (String(gameState.mode).toLowerCase() === "observer") {
        return false;
    }
    const unitSide = getUnitSide(unit);
    const playerSide = getPlayerSide();
    const phaseSide = normalizeSide(turnSystem?.phase);
    // 没有明确玩家阵营时，绝不默认允许控制，防止误控 AI 阵营。
    if (!["german", "soviet", "chinese", "japanese", "british", "italian", "american", "allied", "rok_government", "new_military"].includes(playerSide)) {
        return false;
    }
    // 只能控制玩家自己选择的阵营。
    if (unitSide !== playerSide) {
        return false;
    }
    // 只能在本方行动阶段操作。
    if (turnSystem && phaseSide !== playerSide) {
        return false;
    }
    return true;
}
// ============================================================
// 查看单位
// ============================================================
function playerCanViewUnit(unit) {
    return (
        unit != null &&
        isUnitAlive(unit)
    );
}
// ============================================================
// 清除移动范围
// ============================================================
function clearReachable() {
    if (
        typeof renderer.clearReachable ===
        "function"
    ) {
        renderer.clearReachable();
    }
    if (
        movementSystem.reachable instanceof
        Map
    ) {
        movementSystem.reachable.clear();
    }
}
// ============================================================
// 清除选择
// ============================================================
function clearSelection() {
    // 切换阶段/取消选择时必须释放工程目标状态，避免幽灵锁定。
    pendingEngineeringAction = null;
    pendingEngineeringUnitId = null;
    selectedUnit =
        null;
    if (
        typeof selection.clear ===
        "function"
    ) {
        selection.clear();
    }
    if (
        typeof renderer.setSelectedUnit ===
        "function"
    ) {
        renderer.setSelectedUnit(
            null
        );
    }
    if (
        typeof movementSystem.clear ===
        "function"
    ) {
        movementSystem.clear();
    }
    clearReachable();
    if (unitInfo) {
        unitInfo.innerHTML =
            '<p class="hint">点击地图上的单位查看详情</p>';
    }
}
// ============================================================
// 单位信息
// ============================================================
function showUnitInfo(unit) {
    if (
        !unitInfo ||
        !unit
    ) {
        return;
    }
    const side =
        getUnitSide(
            unit
        );
    const sideName = FactionSystem.getSideName(side) || "未知";
    const name =
        unitName(
            unit
        );
    const type =
        unit.typeZh ??
        unit.type ??
        unit.unitType ??
        "未知";
    const ap =
        unit.movementPoints ??
        unit.actionPoints ??
        unit.ap ??
        "—";
    const maxAP =
        unit.maxMovementPoints ??
        unit.maxActionPoints ??
        unit.maxAP ??
        "—";
    const attackValue =
        combatSystem.getAttack(
            unit
        );
    const defenseValue =
        combatSystem.getDefense(
            unit
        );
    const rangeValue =
        combatSystem.getRange(
            unit
        );
    const active =
        playerCanControlUnit(
            unit
        );
    unitInfo.innerHTML = `
        <div class="unit-title">
            ${name}
        </div>
        <div class="unit-row">
            <span>指挥官</span>
            <strong class="unit-commander">${unit.commander ?? unit.commanderName ?? "不详"}</strong>
        </div>
        <div class="unit-row">
            <span>隶属</span>
            <strong>${unit.parentFormation ?? unit.parent ?? unit.formation ?? "—"}</strong>
        </div>
        <div class="unit-row">
            <span>ID</span>
            <strong>${unit.id}</strong>
        </div>
        <div class="unit-row">
            <span>阵营</span>
            <strong>${sideName}</strong>
        </div>
        <div class="unit-row">
            <span>兵种</span>
            <strong>${type}</strong>
        </div>
        <div class="unit-row">
            <span>编制</span>
            <strong>${unit.echelon ?? "—"}</strong>
        </div>
        <div class="unit-row">
            <span>行动点</span>
            <strong>${ap} / ${maxAP}</strong>
        </div>
        <div class="unit-row">
            <span>兵力</span>
            <strong>${getStrengthText(unit)}</strong>
        </div>
        <div class="unit-row">
            <span>攻击</span>
            <strong>${attackValue}</strong>
        </div>
        <div class="unit-row">
            <span>防御</span>
            <strong>${defenseValue}</strong>
        </div>
        <div class="unit-row">
            <span>射程</span>
            <strong>${rangeValue}</strong>
        </div>
        <div class="unit-row">
            <span>攻击状态</span>
            <strong>
                ${
                    unit.hasAttacked
                        ? "本阶段已攻击"
                        : "可攻击"
                }
            </strong>
        </div>
        <div class="unit-row">
            <span>士气</span>
            <strong>${unit.morale ?? "—"}</strong>
        </div>
        <div class="unit-row">
            <span>压制</span>
            <strong>${unit.suppression ?? "—"}</strong>
        </div>
        <div class="unit-row">
            <span>疲劳</span>
            <strong>${unit.fatigue ?? "—"}</strong>
        </div>
        <div class="unit-row">
            <span>弹药</span>
            <strong>${unit.ammunition ?? "—"}</strong>
        </div>
        <div class="unit-row">
            <span>位置</span>
            <strong>${unit.q}, ${unit.r}</strong>
        </div>
        <div class="unit-row">
            <span>状态</span>
            <strong>
                ${
                    active
                        ? "可行动"
                        : "不可行动"
                }
            </strong>
        </div>
    `;
    if (lastBattleMessage) {
        unitInfo.insertAdjacentHTML(
            "beforeend",
            `<hr><div class="battle-message" role="status" aria-live="polite"></div>`
        );
        const messageBox = unitInfo.querySelector(".battle-message");
        if (messageBox) messageBox.textContent = lastBattleMessage;
    }
}
// ============================================================
// 计算移动范围
// ============================================================
function calculateReachable(unit) {
    clearReachable();
    if (
        !unit ||
        !isUnitAlive(unit)
    ) {
        return;
    }
    movementSystem.selectUnit(
        unit,
        units
    );
    if (
        typeof renderer.setReachable ===
        "function"
    ) {
        renderer.setReachable(
            movementSystem.reachable
        );
    }
}
// ============================================================
// 选择单位
// ============================================================
function selectUnit(unit) {
    if (selectedUnit && unit && selectedUnit !== unit) { pendingEngineeringAction=null; pendingEngineeringUnitId=null; }
    if (
        !unit ||
        !isUnitAlive(unit)
    ) {
        return;
    }
    selectedUnit =
        unit;
    if (
        typeof selection.select ===
        "function"
    ) {
        selection.select(
            unit
        );
    }
    if (
        typeof renderer.setSelectedUnit ===
        "function"
    ) {
        renderer.setSelectedUnit(
            unit
        );
    }
    showUnitInfo(
        unit
    );
    if (
        playerCanControlUnit(
            unit
        )
    ) {
        calculateReachable(
            unit
        );
    }
    else {
        clearReachable();
    }
    render();
}
// ============================================================
// 查找 Hex 上的存活单位
// ============================================================
function unitAtHex(
    q,
    r
) {
    return (
        units.find(
            unit =>
                isUnitAlive(unit) &&
                Number(unit.q) ===
                Number(q) &&
                Number(unit.r) ===
                Number(r)
        ) ?? null
    );
}
// ============================================================
// 屏幕 -> 世界坐标
// ============================================================
function screenToWorld(
    screenX,
    screenY
) {
    const zoom =
        camera.zoom ?? 1;
    const offsetX =
        camera.x ??
        camera.offsetX ??
        0;
    const offsetY =
        camera.y ??
        camera.offsetY ??
        0;
    return {
        x:
            (
                screenX -
                offsetX
            ) / zoom,
        y:
            (
                screenY -
                offsetY
            ) / zoom
    };
}
// ============================================================
// 鼠标 -> Hex
// ============================================================
function mouseToHex(event) {
    const rect =
        canvas.getBoundingClientRect();
    const mouseX =
        event.clientX -
        rect.left;
    const mouseY =
        event.clientY -
        rect.top;
    const worldPosition =
        screenToWorld(
            mouseX,
            mouseY
        );
    const hexSize =
        renderer.hexSize ??
        renderer.size ??
        18;
    return pixelToHex(
        worldPosition.x,
        worldPosition.y,
        hexSize
    );
}
// ============================================================
// 点击单位检测
// ============================================================
function findUnitAtMouse(event) {
    const hex =
        mouseToHex(
            event
        );
    if (!hex) {
        return null;
    }
    const direct =
        unitAtHex(
            hex.q,
            hex.r
        );
    if (direct) {
        return direct;
    }
    if (
        typeof selection.findUnitAt ===
        "function"
    ) {
        const rect =
            canvas.getBoundingClientRect();
        const x =
            event.clientX -
            rect.left;
        const y =
            event.clientY -
            rect.top;
        const found =
            selection.findUnitAt(
                x,
                y,
                units,
                camera,
                renderer
            );
        if (
            found &&
            isUnitAlive(found)
        ) {
            return found;
        }
    }
    return null;
}
// ============================================================
// 玩家移动
// ============================================================
function tryMoveSelectedUnit(
    q,
    r
) {
    if (
        !selectedUnit ||
        !playerCanControlUnit(
            selectedUnit
        )
    ) {
        return false;
    }
    // ========================================================
    // 一格一单位
    // ========================================================
    const occupyingUnit =
        unitAtHex(
            q,
            r
        );
    if (
        occupyingUnit &&
        occupyingUnit !==
        selectedUnit
    ) {
        console.log(
            `[移动] Hex (${q}, ${r}) 已被 ${unitName(occupyingUnit)} 占据`
        );
        return false;
    }
    if (
        !movementSystem.canMoveTo(
            q,
            r,
            units
        )
    ) {
        return false;
    }
    undoSystem.push({ units, turnSystem, gameOver }, `移动：${unitName(selectedUnit)}`);
    const moveResult =
        movementSystem.moveTo(
            q,
            r,
            units
        );
    if (
        !moveResult ||
        moveResult.success === false
    ) {
        undoSystem.discardLast();
        return false;
    }
    pendingEngineeringAction=null; pendingEngineeringUnitId=null;
    selectedUnit =
        moveResult.unit ??
        selectedUnit;
    if (
        typeof selection.select ===
        "function"
    ) {
        selection.select(
            selectedUnit
        );
    }
    if (
        typeof renderer.setSelectedUnit ===
        "function"
    ) {
        renderer.setSelectedUnit(
            selectedUnit
        );
    }
    if (
        typeof renderer.setReachable ===
        "function"
    ) {
        renderer.setReachable(
            movementSystem.reachable
        );
    }
    selectedHex = { q:Number(selectedUnit.q), r:Number(selectedUnit.r) };
    hexInfoPanel.show(selectedHex.q, selectedHex.r);
    refreshEngineerActions();
    showUnitInfo(
        selectedUnit
    );
    render();
    updateSaveControls();
    return true;
}
// ============================================================
// 战斗消息
// ============================================================
function writeBattleMessage(
    message
) {
    lastBattleMessage = String(message ?? "");
    console.log(
        "[战斗]",
        lastBattleMessage
    );
    if (unitInfo) {
        const existing = unitInfo.querySelector(".battle-message");
        if (existing) {
            existing.textContent = lastBattleMessage;
        } else {
            unitInfo.insertAdjacentHTML(
                "beforeend",
                `<hr><div class="battle-message" role="status" aria-live="polite"></div>`
            );
            const messageBox = unitInfo.querySelector(".battle-message");
            if (messageBox) messageBox.textContent = lastBattleMessage;
        }
    }
}
// ============================================================
// 死亡单位处理
// ============================================================
function echelonZh(unit){
    const e=String(unit?.echelon??'').toLowerCase();
    const map={squad:'班',platoon:'排',company:'连',battalion:'营',regiment:'团',brigade:'旅',division:'师',corps:'军',army:'集团军'};
    if(String(unit?.faction??unit?.side)==='japanese'){const j={company:'中队',battalion:'大队',regiment:'联队',brigade:'旅团',division:'师团',corps:'军',army:'方面军'};return j[e]??map[e]??(unit?.echelon??'未知');}
    return map[e]??(unit?.echelon??'未知');
}
function isCommandUnit(unit){return unit?.isCommandUnit===true||String(unit?.type??unit?.unitType??'').toLowerCase()==='hq'||/司令部|指挥部|师部|军部/.test(String(unit?.name??''));}
function commandLevelZh(unit){
    const e=String(unit?.commandLevel??unit?.echelon??'').toLowerCase();
    const map={regiment:'团指',brigade:'旅指',division:'师指',corps:'军指',army:'集团军司令部','army_group':'集团军群司令部',front:'方面军司令部'};
    return map[e]??`${echelonZh(unit)}指`;
}
function resetCasualtyState(){
    casualtyState.sides={};
    for(const u of units){
        u._casualtyLastStrength=Math.max(0,Number(u.strength??u.manpower??0));
        u._casualtyDestroyedRecorded=!!u.destroyed;
        u._casualtyCommittedRecorded=false;
        if(u.offMap!==true) ensureCommitted(u);
    }
}
function casualtySide(side){return casualtyState.sides[side]??(casualtyState.sides[side]={losses:0,committed:0,destroyed:{},commandDestroyed:{},commandNames:[]});}
function ensureCommitted(unit){if(!unit||unit.offMap===true||unit._casualtyCommittedRecorded)return;const s=casualtySide(getUnitSide(unit));s.committed+=Math.max(0,Number(unit.maxStrength??unit.maxManpower??unit.strength??unit.manpower??0));unit._casualtyCommittedRecorded=true;}
function recordCasualtyDelta(unit){
    if(!unit)return; ensureCommitted(unit); if(unit.offMap===true)return;
    const now=Math.max(0,Number(unit.strength??unit.manpower??0)),prev=Number.isFinite(Number(unit._casualtyLastStrength))?Number(unit._casualtyLastStrength):now;
    if(now<prev)casualtySide(getUnitSide(unit)).losses+=Math.round(prev-now);unit._casualtyLastStrength=now;
    if((unit.destroyed===true||now<=0)&&!unit._casualtyDestroyedRecorded){const z=echelonZh(unit),s=casualtySide(getUnitSide(unit));s.destroyed[z]=(s.destroyed[z]??0)+1;if(isCommandUnit(unit)){const cz=commandLevelZh(unit);s.commandDestroyed[cz]=(s.commandDestroyed[cz]??0)+1;s.commandNames.push(String(unit.name??unit.id??cz));}unit._casualtyDestroyedRecorded=true;}
}
function renderCasualtyPanel(){
    const panel=document.getElementById('casualtyPanel');if(!panel)return;const sides=Object.entries(casualtyState.sides);
    if(!sides.length){panel.innerHTML='<h3>战损统计</h3><div class="hint">暂无战损</div>';return;}
    panel.innerHTML='<h3>战损统计</h3>'+sides.map(([side,s])=>{
        const rate=s.committed>0?(s.losses/s.committed*100):0;
        const current=Math.max(0,s.committed-s.losses);
        const kills=Object.entries(s.destroyed).filter(([,n])=>n>0).map(([e,n])=>`${e}×${n}`).join(' · ')||'无';
        const cmd=Object.entries(s.commandDestroyed).filter(([,n])=>n>0).map(([e,n])=>`${e}×${n}`).join(' · ')||'无';
        const names=s.commandNames.length?`<div class="casualty-command-names">${s.commandNames.map(x=>`• ${x}`).join('<br>')}</div>`:'';
        return `<div class="casualty-side"><strong>${FactionSystem.getSideName(side)||side}</strong><div>累计投入：${s.committed}</div><div>当前有效兵力：${current}</div><div>累计损失：${s.losses} <b>（${rate.toFixed(1)}%）</b></div><div>被消灭：${kills}</div><div class="casualty-command"><b>指挥机构损失：</b>${cmd}${names}</div></div>`;
    }).join('');
}
function syncCasualties(){for(const u of units)recordCasualtyDelta(u);renderCasualtyPanel();}
function removeDestroyedUnits() {
    for (const unit of units) {
        if (!unit) {
            continue;
        }
        // --------------------------------------------------------
        // 同时读取 strength / manpower
        //
        // CombatSystem 的不同版本可能修改其中任意一个字段，
        // 因此不能再只依赖 manpower ?? strength。
        // --------------------------------------------------------
        const strengthValue =
            Number(unit.strength);
        const manpowerValue =
            Number(unit.manpower);
        const strengthDead =
            Number.isFinite(strengthValue) &&
            strengthValue <= 0;
        const manpowerDead =
            Number.isFinite(manpowerValue) &&
            manpowerValue <= 0;
        // --------------------------------------------------------
        // 任意一套兵力系统确认单位死亡，就统一判定阵亡
        // --------------------------------------------------------
        const dead =
            unit.destroyed === true ||
            strengthDead ||
            manpowerDead;
        if (!dead) {
            continue;
        }
        // --------------------------------------------------------
        // 统一死亡状态
        // --------------------------------------------------------
        unit.strength = 0;
        unit.manpower = 0;
        unit.destroyed = true;
        unit.movementPoints = 0;
        unit.actionPoints = 0;
        unit.hasAttacked = true;
        console.log(
            `[单位系统] ${unit.id} 已被消灭，停止显示与行动`
        );
        // --------------------------------------------------------
        // 如果当前选中的正好是阵亡单位
        // --------------------------------------------------------
        if (
            selectedUnit === unit ||
            (
                selectedUnit?.id &&
                unit.id &&
                selectedUnit.id === unit.id
            )
        ) {
            selectedUnit = null;
        }
    }
    // ------------------------------------------------------------
    // 清除死亡单位选择状态
    // ------------------------------------------------------------
    if (
        selectedUnit &&
        !isUnitAlive(selectedUnit)
    ) {
        clearSelection();
    }
    // ------------------------------------------------------------
    // 阵亡单位继续保留在 units 中。
    // VictorySystem 的 HQ 全灭判定仍然需要这些数据。
    // ------------------------------------------------------------
    gameState.units = units;
    syncCasualties();
}
// ============================================================
// 胜负检查
// ============================================================
// ============================================================
// 战役结束弹窗
// ============================================================
function showVictoryModal(result) {
    // 弹窗样式由 main.js 自行注入，避免依赖额外 CSS 文件。
    if (!document.getElementById("victory-modal-style")) {
        const style = document.createElement("style");
        style.id = "victory-modal-style";
        style.textContent = `
            #victory-modal { position: fixed; inset: 0; z-index: 100000; font-family: FangSong, STFangsong, SimSun, serif; }
            #victory-modal .victory-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; background: rgba(18,20,17,.72); backdrop-filter: blur(2px); }
            #victory-modal .victory-window { width: min(560px, calc(100vw - 48px)); box-sizing: border-box; padding: 34px 38px 30px; border: 2px solid #5a5646; outline: 1px solid #c6b98b; outline-offset: -8px; background: #d6cfb2; color: #24251f; box-shadow: 0 18px 60px rgba(0,0,0,.48); text-align: center; }
            #victory-modal .victory-decoration { margin-bottom: 18px; font-size: 14px; letter-spacing: .18em; color: #5b584b; }
            #victory-modal .victory-title { font-size: clamp(34px,5vw,52px); font-weight: 700; letter-spacing: .12em; line-height: 1.15; }
            #victory-modal .victory-subtitle { margin-top: 8px; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; letter-spacing: .16em; color: #555246; }
            #victory-modal .victory-line { width: 72%; height: 1px; margin: 22px auto; background: #77715d; }
            #victory-modal .victory-reason { min-height: 28px; margin-bottom: 22px; font-size: 18px; line-height: 1.65; }
            #victory-modal .victory-details { width: min(390px,100%); margin: 0 auto 24px; border-top: 1px solid rgba(70,68,57,.35); border-bottom: 1px solid rgba(70,68,57,.35); padding: 10px 0; }
            #victory-modal .victory-detail-row { display: flex; justify-content: space-between; gap: 20px; padding: 6px 4px; font-size: 15px; text-align: left; }
            #victory-modal .victory-detail-row strong { text-align: right; }
            #victory-modal .victory-button { min-width: 150px; padding: 10px 24px; border: 1px solid #4d4b40; background: #666754; color: #f0ecd9; font: inherit; font-size: 16px; cursor: pointer; }
            #victory-modal .victory-button:hover { background: #555746; }
            #victory-modal .victory-button:focus-visible { outline: 2px solid #262820; outline-offset: 3px; }
        `;
        document.head.appendChild(style);
    }
    // --------------------------------------------------------
    // 防止重复生成弹窗
    // --------------------------------------------------------
    const oldModal =
        document.getElementById(
            "victory-modal"
        );
    if (oldModal) {
        oldModal.remove();
    }
    // --------------------------------------------------------
    // 胜利阵营
    // --------------------------------------------------------
    const winner =
        normalizeSide(
            result?.winner
        );
    const winnerName = FactionSystem.getSideName(winner);
    // --------------------------------------------------------
    // 中文标题
    // --------------------------------------------------------
    const title = winnerName ? `${winnerName}胜利` : "战斗结束";
    // --------------------------------------------------------
    // 外文副标题
    // --------------------------------------------------------
    const subtitle = winnerName ? "VICTORY" : "BATTLE ENDED";
    // --------------------------------------------------------
    // 胜负原因
    // --------------------------------------------------------
    const reason =
        result?.reason ??
        "战役已经结束";
    // --------------------------------------------------------
    // 当前战役日期
    // --------------------------------------------------------
    let dateText =
        "1941年6月";
    if (turnSystem) {
        const year =
            turnSystem.year ??
            1941;
        const month =
            turnSystem.month ??
            6;
        const day =
            turnSystem.day ??
            26;
        const hour =
            turnSystem.hour ??
            8;
        const minute =
            turnSystem.minute ??
            0;
        const hourText =
            String(hour).padStart(
                2,
                "0"
            );
        const minuteText =
            String(minute).padStart(
                2,
                "0"
            );
        dateText =
            `${year}年${month}月${day}日　${hourText}:${minuteText}`;
    }
    // --------------------------------------------------------
    // 当前回合
    // --------------------------------------------------------
    const currentTurn =
        turnSystem?.turn ??
        (
            typeof turnSystem?.getTurnNumber ===
            "function"
                ? turnSystem.getTurnNumber()
                : 1
        );
    // --------------------------------------------------------
    // 创建弹窗
    // --------------------------------------------------------
    const modal =
        document.createElement(
            "div"
        );
    modal.id =
        "victory-modal";
    modal.innerHTML = `
        <div class="victory-overlay">
            <div class="victory-window">
                <div class="victory-decoration">
                    东线 1941 · ${getScenarioConfig().name}
                </div>
                <div class="victory-title">
                    ${title}
                </div>
                <div class="victory-subtitle">
                    ${subtitle}
                </div>
                <div class="victory-line"></div>
                <div class="victory-reason">
                    ${reason}
                </div>
                <div class="victory-details">
                    <div class="victory-detail-row">
                        <span>
                            战役时间
                        </span>
                        <strong>
                            ${dateText}
                        </strong>
                    </div>
                    <div class="victory-detail-row">
                        <span>
                            战役回合
                        </span>
                        <strong>
                            第${currentTurn}回合
                        </strong>
                    </div>
                </div>
                <button
                    class="victory-button"
                    id="victory-close-button"
                    type="button"
                >
                    查看战场
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(
        modal
    );
    // --------------------------------------------------------
    // 查看战场
    // --------------------------------------------------------
    const closeButton =
        document.getElementById(
            "victory-close-button"
        );
    if (closeButton) {
        closeButton.addEventListener(
            "click",
            () => {
                modal.remove();
            }
        );
    }
}
function checkVictory() {
    // 综合测试场永不触发历史胜负，保证每个版本都可无限结束回合测试。
    const __cfg = getScenarioConfig?.() ?? {};
    const __sid = String(scenario?.id ?? scenario?.key ?? gameState?.scenarioKey ?? "");
    if (__sid === "system_test_range" || scenario?.specialRules?.disableVictory === true || __cfg?.specialRules?.disableVictory === true) {
        gameOver = false;
        if (endPhaseButton) endPhaseButton.disabled = false;
        return false;
    }

    if (
        gameOver ||
        !victorySystem
    ) {
        return gameOver;
    }
    // 清除兵力为 0 / 已摧毁的单位，确保地图和判定同步
  // ============================================================
// 胜负检查时必须保留阵亡单位
// HQ 全灭判定需要知道哪些指挥单位已经被摧毁
// ============================================================
gameState.units =
    units;
    const result =
        victorySystem.check(
            units,
            {
                turn: turnSystem?.turn ?? 1,
                phase: normalizeSide(turnSystem?.phase ?? getScenarioConfig().start.startingPhase),
                playerSide: getPlayerSide(),
                scenario,
                year: turnSystem?.year ?? 1941,
                month: turnSystem?.month ?? 6,
                day: turnSystem?.day ?? 26,
                hour: turnSystem?.hour ?? 8,
                minute: turnSystem?.minute ?? 0
            }
        );
    if (!result.gameOver) {
        return false;
    }
    gameOver = true;
    clearSelection();
    const winnerText = result.winner ? `${FactionSystem.getSideName(result.winner)}胜利` : "战斗结束";
    if (unitInfo) {
        unitInfo.innerHTML = `
            <div class="unit-title">
                战斗结束
            </div>
            <div class="unit-row">
                <strong>
                    ${winnerText}
                </strong>
            </div>
            <div class="unit-row">
                <span>
                    ${result.reason ?? ""}
                </span>
            </div>
        `;
    }
    if (turnInfo) {
        turnInfo.textContent =
            winnerText;
    }
    if (endPhaseButton) {
        endPhaseButton.disabled =
            true;
    }
    console.log(
        "========================================"
    );
    console.log(
        `[胜负系统] ${winnerText}`
    );
    console.log(
        `[胜负系统] ${result.reason ?? ""}`
    );
    console.log(
        "========================================"
    );
    render();
    // 胜负确认后显示中央弹窗。
    // units 不删除阵亡单位，因此 HQ 全灭判定仍保留完整历史状态。
    showVictoryModal(result);
    return true;
}
// ============================================================
// 玩家攻击
// ============================================================
function performAttack(
    attacker,
    defender,
    {
        ai = false
    } = {}
) {
    if (
        gameOver ||
        !attacker ||
        !defender ||
        !isUnitAlive(attacker) ||
        !isUnitAlive(defender)
    ) {
        return false;
    }
    if (
        !combatSystem.canAttack(
            attacker,
            defender
        )
    ) {
        return false;
    }
    if (!ai) {
        undoSystem.push({ units, turnSystem, gameOver }, `攻击：${unitName(attacker)}`);
    }
    const result =
        combatSystem.attack(
            attacker,
            defender
        );
    if (
        !result?.success
    ) {
        if (!ai) undoSystem.discardLast();
        writeBattleMessage(
            result?.reason ??
            "攻击失败"
        );
        return false;
    }
    // CombatSystem 以 strength 为实时兵力；同步旧 manpower 字段，避免地图继续显示战前兵力。
    defender.manpower = Math.max(0, Number(defender.strength ?? result.afterStrength ?? 0));
    const sideLabel = FactionSystem.getSideName(getUnitSide(attacker));
    const prefix =
        ai
            ? `${sideLabel} AI：`
            : "";
    const destroyedText =
        result.destroyed
            ? "，目标被消灭"
            : "";
    writeBattleMessage(
        `${prefix}${unitName(attacker)} 攻击 ${unitName(defender)}，` +
        `造成 ${result.damage} 点损失 ` +
        `（${result.beforeStrength}/${getUnitMaxStrength(defender)} → ` +
        `${result.afterStrength}/${getUnitMaxStrength(defender)}）` +
        destroyedText
    );
    removeDestroyedUnits();
    // 攻击后立即同步当前被查看单位的数据与右侧信息栏。
    if (selectedUnit) {
        const refreshedSelected = units.find(
            (u) => u === selectedUnit || (u.id && u.id === selectedUnit.id)
        );
        if (refreshedSelected && isUnitAlive(refreshedSelected)) {
            selectedUnit = refreshedSelected;
            showUnitInfo(refreshedSelected);
        } else if (!isUnitAlive(selectedUnit)) {
            clearSelection();
        }
    }
    // 强制重绘，确保地图兵力标签立即反映战损。
    render();
    if (
        !checkVictory()
    ) {
        if (
            selectedUnit &&
            isUnitAlive(
                selectedUnit
            )
        ) {
            showUnitInfo(
                selectedUnit
            );
            calculateReachable(
                selectedUnit
            );
        }
        render();
    }
    updateSaveControls();
    return true;
}
// ============================================================
// 阵营阶段重置
// ============================================================
function resetFactionForPhase(
    faction
) {
    movementSystem.resetFaction?.(
        units,
        faction
    );
    combatSystem.resetFaction?.(
        units,
        faction
    );
}
// ============================================================
// 延时
// ============================================================
function sleep(ms) {
    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}
// ============================================================
// AI 航空支援：敌方使用自己的卡组、次数、冷却和场景限制
// ============================================================
function runAIAirSupport(side) {
    const cards = airSupportSystem.available(side).filter(c=>c.availability?.ok!==false);
    if (!cards.length) return null;
    const own=units.filter(u=>isUnitAlive(u)&&getUnitSide(u)===side);
    const enemy=units.filter(u=>isUnitAlive(u)&&getUnitSide(u)!==side);
    if(!enemy.length)return null;
    const scoreTarget=(u)=>{
        const t=String(u.type??u.unitType??'').toLowerCase();
        const command=/hq|headquarters|command/.test(t)||/司令|指挥部|团部/.test(String(u.name??''));
        const dense=enemy.reduce((n,e)=>n+(combatSystem.getDistance(u,e)<=2?1:0),0);
        return (command?80:0)+dense*8+Number(u.strength??0)/20;
    };
    const target=[...enemy].sort((a,b)=>scoreTarget(b)-scoreTarget(a))[0];
    const ownTarget=[...own].sort((a,b)=>Number(a.strength??0)-Number(b.strength??0))[0];
    // 每个 AI 阶段最多执行一次航空任务，防止一回合瞬间清空整副卡组。
    const priority=[...cards].sort((a,b)=>{const w=x=>x.missionType==='cap'?60:x.missionType==='recon'?50:x.missionType==='supply'?25:70;return w(b)-w(a);});
    for(const c of priority){
        const tgt=c.missionType==='supply'?(ownTarget??target):target;
        const result=airSupportSystem.execute(side,c.id,{q:tgt.q,r:tgt.r});
        if(result?.ok){writeBattleMessage(`${FactionSystem.getSideName(side)} AI航空兵：${c.name} 已出动（剩余 ${airSupportSystem.state?.[side]?.cards?.[c.id]??0} 次）`);return result;}
    }
    return null;
}

// ============================================================
// AI 阶段
// ============================================================
async function runAIPhase() {
    if (
        aiRunning ||
        gameOver ||
        !turnSystem ||
        String(gameState.mode).toLowerCase() === "developer"
    ) {
        return;
    }
    const currentSide =
        normalizeSide(
            turnSystem.phase
        );
    const playerSide =
        getPlayerSide();
    if (
        !currentSide ||
        currentSide ===
        playerSide
    ) {
        return;
    }
    undoSystem.clear();
    aiRunning =
        true;
    if (endPhaseButton) {
        endPhaseButton.disabled =
            true;
    }
    try {
        resetFactionForPhase(
            currentSide
        );
        const aiUnits =
            units.filter(
                unit =>
                    getUnitSide(unit) ===
                        currentSide &&
                    isUnitAlive(unit)
            );
        const passiveAI = String(getScenarioConfig()?.aiMode ?? scenario?.aiMode ?? "").toLowerCase() === "passive";
        const sideLabel = `${FactionSystem.getSideName(currentSide)} AI`;
        // 综合测试场使用被动 AI：敌军保留在地图上用于射程、工事、战斗等测试，
        // 但不会自行移动或攻击；其阶段仍会自动结束，避免测试流程卡死。
        const unitsToAct = passiveAI ? [] : aiUnits;
        if (!passiveAI) { try { runAIAirSupport(currentSide); } catch(e) { console.warn('[AI航空] 跳过本阶段航空行动',e); } }
        for (
            const unit
            of unitsToAct
        ) {
            if (gameOver) {
                break;
            }
            if (
                !isUnitAlive(
                    unit
                )
            ) {
                continue;
            }
            const result =
                aiSystem.actUnit(
                    unit,
                    units
                );
            if (
                result?.type ===
                    "attack" &&
                result.result?.success
            ) {
                const combat =
                    result.result;
                writeBattleMessage(
                    `${sideLabel}：${unitName(combat.attacker)} 攻击 ${unitName(combat.defender)}，` +
                    `造成 ${combat.damage} 点损失 ` +
                    `（${combat.beforeStrength}/${getUnitMaxStrength(combat.defender)} → ` +
                    `${combat.afterStrength}/${getUnitMaxStrength(combat.defender)}）` +
                    `${combat.destroyed ? "，目标被消灭" : ""}`
                );
            }
            if (
                result?.type ===
                    "move-and-attack" &&
                result.combat?.success
            ) {
                const combat =
                    result.combat;
                writeBattleMessage(
                    `${sideLabel}：${unitName(combat.attacker)} 移动后攻击 ${unitName(combat.defender)}，` +
                    `造成 ${combat.damage} 点损失 ` +
                    `（${combat.beforeStrength}/${getUnitMaxStrength(combat.defender)} → ` +
                    `${combat.afterStrength}/${getUnitMaxStrength(combat.defender)}）` +
                    `${combat.destroyed ? "，目标被消灭" : ""}`
                );
            }
            removeDestroyedUnits();
            render();
            if (
                checkVictory()
            ) {
                break;
            }
            await sleep(
                220
            );
        }
        if (
            !gameOver &&
            normalizeSide(
                turnSystem.phase
            ) ===
                currentSide
        ) {
            clearSelection();
            turnSystem.endPhase?.();
            const nextSide =
                normalizeSide(
                    turnSystem.phase
                );
            resetFactionForPhase(
                nextSide
            );
            updateTurnUI();
            render();
            if (
                !gameOver &&
                nextSide &&
                nextSide !==
                    getPlayerSide()
            ) {
                setTimeout(
                    () => {
                        runAIPhase();
                    },
                    250
                );
            }
        }
    }
    catch (error) {
        console.error(
            "AI 行动失败：",
            error
        );
        if (unitInfo) {
            unitInfo.innerHTML = `
                <div class="unit-title">
                    AI 行动失败
                </div>
                <div>
                    ${error?.message ?? error}
                </div>
            `;
        }
    }
    finally {
        aiRunning =
            false;
        if (
            endPhaseButton &&
            !gameOver
        ) {
            endPhaseButton.disabled =
                false;
        }
    }
}
// ============================================================
// 鼠标按下
// ============================================================
canvas.addEventListener(
    "mousedown",
    event => {
        if (
            event.button !==
            0
        ) {
            return;
        }
        isDragging =
            true;
        dragMoved =
            false;
        lastMouseX =
            event.clientX;
        lastMouseY =
            event.clientY;
    }
);
// ============================================================
// 拖动地图
// ============================================================
window.addEventListener(
    "mousemove",
    event => {
        if (!isDragging) {
            return;
        }
        const dx =
            event.clientX -
            lastMouseX;
        const dy =
            event.clientY -
            lastMouseY;
        if (
            Math.abs(dx) > 2 ||
            Math.abs(dy) > 2
        ) {
            dragMoved =
                true;
        }
        if (
            typeof camera.pan ===
            "function"
        ) {
            camera.pan(
                dx,
                dy
            );
        }
        else {
            if (
                Number.isFinite(
                    camera.x
                )
            ) {
                camera.x +=
                    dx;
            }
            if (
                Number.isFinite(
                    camera.y
                )
            ) {
                camera.y +=
                    dy;
            }
            if (
                Number.isFinite(
                    camera.offsetX
                )
            ) {
                camera.offsetX +=
                    dx;
            }
            if (
                Number.isFinite(
                    camera.offsetY
                )
            ) {
                camera.offsetY +=
                    dy;
            }
        }
        lastMouseX =
            event.clientX;
        lastMouseY =
            event.clientY;
        render();
    }
);
// ============================================================
// 鼠标释放
// ============================================================
window.addEventListener(
    "mouseup",
    () => {
        isDragging =
            false;
    }
);
// ============================================================
// 地块与工程行动
// ============================================================
function refreshEngineerActions(){
    if(!engineerActions) return;
    // 主系统工兵状态看门狗：目标模式引用的单位不存在/已切换/已阵亡时立即释放锁。
    if(pendingEngineeringAction && (!selectedUnit || !isUnitAlive(selectedUnit) || (pendingEngineeringUnitId!=null && String(pendingEngineeringUnitId)!==String(selectedUnit.id??selectedUnit.name??'')))) {
        pendingEngineeringAction=null; pendingEngineeringUnitId=null;
    }
    const p=selectedUnit?engineerSystem.profile(selectedUnit):null;
    const canWork=!!(selectedUnit&&engineerSystem.canWork(selectedUnit));
    const q=Number(selectedUnit?.q),r=Number(selectedUnit?.r);
    const mine=selectedUnit?engineerSystem.getMinefield(q,r):null;
    const canEngineer=!!(p&&(p.canEntrench||p.canLayMines||p.canClearMines||p.canBuildBridge));
    engineerActions.hidden=!canEngineer;
    if(buildFortButton)buildFortButton.disabled=!(p?.canEntrench&&canWork);
    if(layMineButton)layMineButton.disabled=!(p?.canLayMines&&canWork);
    if(clearMineButton)clearMineButton.disabled=!(p?.canClearMines&&canWork&&mine);
    [buildFoxholeButton,buildBunkerButton,buildAA1Button,buildAA2Button,buildAA3Button,buildBridgeButton,repairBridgeButton,demolishBridgeButton,buildWallButton,demolishWallButton].forEach(b=>{if(b)b.disabled=!(engineerSystem.isEngineer(selectedUnit)&&canWork);});
}
function selectHexAtEvent(event){const h=mouseToHex(event);if(!h)return null;selectedHex=h;hexInfoPanel.show(h.q,h.r);return h;}
let pendingEngineeringAction = null;
let pendingEngineeringUnitId = null;
const ENGINEER_TARGET_ACTIONS = new Set(['bridge','repairBridge','demolishBridge','wall','demolishWall']);
function engineerActionLabel(kind){ return ({bridge:'架设浮桥',repairBridge:'修复桥梁',demolishBridge:'爆破桥梁',wall:'建设防御墙',demolishWall:'拆毁墙体'})[kind] ?? '工程作业'; }
function beginEngineerTargeting(kind){
    if(!selectedUnit){writeBattleMessage('请先选择工兵单位');return;}
    if(!engineerSystem.isEngineer(selectedUnit)){writeBattleMessage('当前单位不是工兵，不能执行该工程');return;}
    if(!engineerSystem.canWork(selectedUnit)){writeBattleMessage('该工兵当前没有可用行动点');refreshEngineerActions();return;}
    const check=engineerSystem.validateAction(selectedUnit,kind,null);
    if(!check.ok){writeBattleMessage(check.message);refreshEngineerActions();return;}
    pendingEngineeringAction=kind;
    pendingEngineeringUnitId=selectedUnit.id??selectedUnit.name??null;
    writeBattleMessage(`${engineerActionLabel(kind)}：请在地图上点击合法目标格；按 ESC 可取消`);
    render();
}
function doEngineerAction(kind){
    if(!selectedUnit)return;
    const own={q:Number(selectedUnit.q),r:Number(selectedUnit.r)};
    const target=(['bridge','repairBridge','demolishBridge','wall','demolishWall'].includes(kind)&&selectedHex)?selectedHex:own;
    const validation=engineerSystem.validateAction(selectedUnit,kind,target);
    if(!validation.ok){writeBattleMessage(validation.message);refreshEngineerActions();render();return;}
    let result;
    if(kind==='fort')result=engineerSystem.entrench(selectedUnit,own.q,own.r);
    if(kind==='foxhole')result=engineerSystem.buildFortification(selectedUnit,own.q,own.r,'foxhole');
    if(kind==='bunker')result=engineerSystem.buildFortification(selectedUnit,own.q,own.r,'bunker');
    if(kind==='aa1')result=engineerSystem.buildAAPosition(selectedUnit,own.q,own.r,1);
    if(kind==='aa2')result=engineerSystem.buildAAPosition(selectedUnit,own.q,own.r,2);
    if(kind==='aa3')result=engineerSystem.buildAAPosition(selectedUnit,own.q,own.r,3);
    if(kind==='lay')result=engineerSystem.layMine(selectedUnit,own.q,own.r);
    if(kind==='clear')result=engineerSystem.clearMine(selectedUnit,own.q,own.r);
    if(kind==='bridge')result=engineerSystem.buildBridge(selectedUnit,target.q,target.r,true);
    if(kind==='repairBridge')result=engineerSystem.repairBridge(selectedUnit,target.q,target.r);
    if(kind==='demolishBridge')result=engineerSystem.demolishBridge(selectedUnit,target.q,target.r);
    if(kind==='wall')result=engineerSystem.buildWall(selectedUnit,target.q,target.r);
    if(kind==='demolishWall')result=engineerSystem.demolishWall(selectedUnit,target.q,target.r);
    if(result?.message)writeBattleMessage(result.message);
    hexInfoPanel.show(target.q,target.r);refreshEngineerActions();showUnitInfo(selectedUnit);render();updateSaveControls();
}
buildFortButton?.addEventListener('click',()=>doEngineerAction('fort'));
buildFoxholeButton?.addEventListener('click',()=>doEngineerAction('foxhole'));
buildBunkerButton?.addEventListener('click',()=>doEngineerAction('bunker'));
buildAA1Button?.addEventListener('click',()=>doEngineerAction('aa1'));
buildAA2Button?.addEventListener('click',()=>doEngineerAction('aa2'));
buildAA3Button?.addEventListener('click',()=>doEngineerAction('aa3'));
layMineButton?.addEventListener('click',()=>doEngineerAction('lay'));
clearMineButton?.addEventListener('click',()=>doEngineerAction('clear'));
buildBridgeButton?.addEventListener('click',()=>beginEngineerTargeting('bridge'));
repairBridgeButton?.addEventListener('click',()=>beginEngineerTargeting('repairBridge'));
demolishBridgeButton?.addEventListener('click',()=>beginEngineerTargeting('demolishBridge'));
buildWallButton?.addEventListener('click',()=>beginEngineerTargeting('wall'));
demolishWallButton?.addEventListener('click',()=>beginEngineerTargeting('demolishWall'));

// ============================================================
// 点击地图
// ============================================================
canvas.addEventListener(
    "click",
    event => {
        if (
            gameOver ||
            aiRunning
        ) {
            return;
        }
        if (dragMoved) {
            dragMoved =
                false;
            return;
        }
        const clickedUnit =
            findUnitAtMouse(
                event
            );
        const clickedHex = selectHexAtEvent(event);
        if(pendingAirCard && clickedHex){
            const card=pendingAirCard; pendingAirCard=null;
            const side=getPlayerSide(); const result=airSupportSystem.execute(side,card,clickedHex);
            if(result?.refund&&airSupportSystem.state?.[side]?.cards?.[card]!=null){airSupportSystem.state[side].cards[card]++;delete airSupportSystem.state[side].nextAvailable?.[card];}
            if(result?.message)writeBattleMessage(result.message);
            renderAirSupportPanel(); render(); return;
        }
        if(pendingEngineeringAction && selectedUnit && clickedHex){
            const action=pendingEngineeringAction;
            const expected=pendingEngineeringUnitId;
            pendingEngineeringAction=null; pendingEngineeringUnitId=null;
            if(expected!=null && String(expected)!==String(selectedUnit.id??selectedUnit.name??'')){writeBattleMessage('工程单位已改变，已取消本次工程选择');render();return;}
            selectedHex=clickedHex;
            doEngineerAction(action);
            return;
        }
        if (String(gameState.mode).toLowerCase() === "developer" && developerEditorHandleClick(event, clickedUnit, clickedHex)) { return; }
        // ====================================================
        // 点击了单位
        // ====================================================
        if (clickedUnit) {
            // ------------------------------------------------
            // 已选择玩家单位 + 点击敌军
            // = 尝试攻击
            // ------------------------------------------------
            if (
                selectedUnit &&
                playerCanControlUnit(
                    selectedUnit
                ) &&
                getUnitSide(
                    clickedUnit
                ) !==
                getUnitSide(
                    selectedUnit
                )
            ) {
                if (
                    performAttack(
                        selectedUnit,
                        clickedUnit
                    )
                ) {
                    return;
                }
                writeBattleMessage(
                    `无法攻击 ${unitName(clickedUnit)}：` +
                    `请检查射程或该单位是否已经攻击`
                );
                render();
                return;
            }
            if (
                playerCanViewUnit(
                    clickedUnit
                )
            ) {
                selectUnit(
                    clickedUnit
                );
                selectedHex = { q:Number(clickedUnit.q), r:Number(clickedUnit.r) };
                hexInfoPanel.show(selectedHex.q, selectedHex.r);
                refreshEngineerActions();
            }
            return;
        }
        // ====================================================
        // 点击空格 = 尝试移动
        // ====================================================
        if (selectedUnit) {
            const hex =
                mouseToHex(
                    event
                );
            if (
                hex &&
                tryMoveSelectedUnit(
                    hex.q,
                    hex.r
                )
            ) {
                return;
            }
        }
        clearSelection();
        selectedUnit = null;
        refreshEngineerActions();
        render();
    }
);
// ============================================================
// iPad / 触屏：单指拖动、轻触选择、双指缩放
// ============================================================
let touchMoved = false;
let touchStartX = 0, touchStartY = 0;
let touchLastX = 0, touchLastY = 0;
let pinchStartDistance = 0, pinchStartZoom = 1;

function touchDistance(a,b){ return Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY); }
function setCameraZoomAt(clientX, clientY, newZoom){
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    const oldZoom = camera.zoom ?? 1;
    const minZoom = camera.minZoom ?? 0.35, maxZoom = camera.maxZoom ?? 3;
    newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
    if (typeof camera.zoomAt === 'function') camera.zoomAt(x,y,newZoom);
    else {
        const oldX = camera.x ?? camera.offsetX ?? 0, oldY = camera.y ?? camera.offsetY ?? 0;
        const worldX=(x-oldX)/oldZoom, worldY=(y-oldY)/oldZoom;
        const nx=x-worldX*newZoom, ny=y-worldY*newZoom;
        camera.zoom=newZoom;
        if('x' in camera) camera.x=nx; if('y' in camera) camera.y=ny;
        if('offsetX' in camera) camera.offsetX=nx; if('offsetY' in camera) camera.offsetY=ny;
    }
}
canvas.addEventListener('touchstart', e=>{
    e.preventDefault();
    touchMoved=false;
    if(e.touches.length===1){
        const t=e.touches[0]; touchStartX=touchLastX=t.clientX; touchStartY=touchLastY=t.clientY;
    } else if(e.touches.length===2){
        pinchStartDistance=touchDistance(e.touches[0],e.touches[1]);
        pinchStartZoom=camera.zoom ?? 1; touchMoved=true;
    }
},{passive:false});
canvas.addEventListener('touchmove', e=>{
    e.preventDefault();
    if(e.touches.length===1){
        const t=e.touches[0], dx=t.clientX-touchLastX, dy=t.clientY-touchLastY;
        if(Math.hypot(t.clientX-touchStartX,t.clientY-touchStartY)>7) touchMoved=true;
        if(touchMoved){
            if(typeof camera.pan==='function') camera.pan(dx,dy);
            else { if(Number.isFinite(camera.x))camera.x+=dx; if(Number.isFinite(camera.y))camera.y+=dy; if(Number.isFinite(camera.offsetX))camera.offsetX+=dx; if(Number.isFinite(camera.offsetY))camera.offsetY+=dy; }
            render();
        }
        touchLastX=t.clientX; touchLastY=t.clientY;
    } else if(e.touches.length===2 && pinchStartDistance>0){
        const a=e.touches[0], b=e.touches[1], d=touchDistance(a,b);
        const cx=(a.clientX+b.clientX)/2, cy=(a.clientY+b.clientY)/2;
        setCameraZoomAt(cx,cy,pinchStartZoom*(d/pinchStartDistance)); touchMoved=true; render();
    }
},{passive:false});
canvas.addEventListener('touchend', e=>{
    e.preventDefault();
    if(e.touches.length===0){
        if(!touchMoved && e.changedTouches.length){
            const t=e.changedTouches[0];
            canvas.dispatchEvent(new MouseEvent('click',{clientX:t.clientX,clientY:t.clientY,bubbles:true}));
        }
        pinchStartDistance=0;
    } else if(e.touches.length===1){
        touchLastX=e.touches[0].clientX; touchLastY=e.touches[0].clientY;
        pinchStartDistance=0; touchMoved=true;
    }
},{passive:false});
canvas.addEventListener('touchcancel',()=>{pinchStartDistance=0;touchMoved=false;},{passive:false});

// ============================================================
// 滚轮缩放
// ============================================================
canvas.addEventListener(
    "wheel",
    event => {
        event.preventDefault();
        const rect =
            canvas.getBoundingClientRect();
        const mouseX =
            event.clientX -
            rect.left;
        const mouseY =
            event.clientY -
            rect.top;
        const oldZoom =
            camera.zoom ?? 1;
        const factor =
            event.deltaY < 0
                ? 1.1
                : 0.9;
        const minZoom =
            camera.minZoom ??
            0.35;
        const maxZoom =
            camera.maxZoom ??
            3;
        const newZoom =
            Math.max(
                minZoom,
                Math.min(
                    maxZoom,
                    oldZoom *
                    factor
                )
            );
        if (
            typeof camera.zoomAt ===
            "function"
        ) {
            camera.zoomAt(
                mouseX,
                mouseY,
                newZoom
            );
            render();
            return;
        }
        const oldX =
            camera.x ??
            camera.offsetX ??
            0;
        const oldY =
            camera.y ??
            camera.offsetY ??
            0;
        const worldX =
            (
                mouseX -
                oldX
            ) /
            oldZoom;
        const worldY =
            (
                mouseY -
                oldY
            ) /
            oldZoom;
        const newX =
            mouseX -
            worldX *
            newZoom;
        const newY =
            mouseY -
            worldY *
            newZoom;
        camera.zoom =
            newZoom;
        if (
            "x" in camera
        ) {
            camera.x =
                newX;
        }
        if (
            "y" in camera
        ) {
            camera.y =
                newY;
        }
        if (
            "offsetX" in camera
        ) {
            camera.offsetX =
                newX;
        }
        if (
            "offsetY" in camera
        ) {
            camera.offsetY =
                newY;
        }
        render();
    },
    {
        passive: false
    }
);
// ============================================================
// 结束当前阶段
// ============================================================
function endCurrentPhase() {
    // 综合测试场：敌军为静态靶标。一次“结束回合”直接跳过被动 AI 阶段，
    // 回到玩家下一回合，避免按钮被 AI 锁定或胜负系统误禁用。
    const __testId = String(scenario?.id ?? scenario?.key ?? gameState?.scenarioKey ?? "");
    if (__testId === "system_test_range" && turnSystem && !aiRunning) {
        gameOver = false;
        saveSystem.autoSave({ units, turnSystem, gameState, gameOver, scenario, world, reinforcementSystem });
        undoSystem.clear(); clearSelection();
        const __player = getPlayerSide();
        let __guard = 0;
        do {
            turnSystem.endPhase?.();
            __guard++;
        } while (__guard < 8 && normalizeSide(turnSystem.phase) !== __player);
        resetFactionForPhase(normalizeSide(turnSystem.phase));
        processReinforcementsForCurrentTurn();
        if (endPhaseButton) endPhaseButton.disabled = false;
        updateTurnUI(); render();
        return;
    }
    if (
        gameOver ||
        aiRunning ||
        !turnSystem
    ) {
        return;
    }
    const currentSide =
        normalizeSide(
            turnSystem.phase
        );
    const playerSide =
        getPlayerSide();
    if (String(gameState.mode).toLowerCase() === "developer") {
        saveSystem.autoSave({ units, turnSystem, gameState, gameOver, scenario, world, reinforcementSystem });
        undoSystem.clear(); clearSelection(); turnSystem.endPhase?.();
        resetFactionForPhase(normalizeSide(turnSystem.phase)); updateTurnUI(); render(); updateDeveloperPanel();
        return;
    }
    if (
        playerSide &&
        currentSide !==
            playerSide
    ) {
        runAIPhase();
        return;
    }
    saveSystem.autoSave({ units, turnSystem, gameState, gameOver, scenario, world, reinforcementSystem });
    undoSystem.clear();
    clearSelection();
    turnSystem.endPhase?.();
    const nextSide =
        normalizeSide(
            turnSystem.phase
        );
    resetFactionForPhase(
        nextSide
    );
    if (nextSide === getPlayerSide()) {
        saveSystem.autoSave({ units, turnSystem, gameState, gameOver, scenario, world, reinforcementSystem });
    }
    updateTurnUI();
    render();
    if (
        !gameOver &&
        nextSide &&
        nextSide !==
            getPlayerSide()
    ) {
        setTimeout(
            () => {
                runAIPhase();
            },
            250
        );
    }
}
// ============================================================
// 存档 / 读取 / 撤销
// ============================================================
function applySnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.units)) return false;
    units = JSON.parse(JSON.stringify(snapshot.units));
    gameState.units = units;
    gameOver = snapshot.gameOver === true;
    if (snapshot.playerFaction) {
        gameState.playerFaction = snapshot.playerFaction;
        gameState.playerSide = snapshot.playerFaction;
        gameState.selectedFaction = snapshot.playerFaction;
        gameState.selectedSide = snapshot.playerFaction;
    }
    if (snapshot.mode) gameState.mode = snapshot.mode;
    if (snapshot.world) {
        world.fortifications = JSON.parse(JSON.stringify(snapshot.world.fortifications ?? []));
        world.minefields = JSON.parse(JSON.stringify(snapshot.world.minefields ?? []));
        if (Array.isArray(snapshot.world.wallEdges)) world.wallEdges = JSON.parse(JSON.stringify(snapshot.world.wallEdges));
    }
    if (snapshot.reinforcements) {
        reinforcementSystem.arrivedGroups = new Set(snapshot.reinforcements.arrivedGroups ?? []);
        reinforcementSystem.arrivalLog = JSON.parse(JSON.stringify(snapshot.reinforcements.arrivalLog ?? []));
    }
    reinforcementSystem.initialize(units, snapshot.turn?.turn ?? 1);
    const t = snapshot.turn ?? {};
    if (turnSystem) {
        for (const key of ["turn", "phase", "year", "month", "day", "hour", "minute"]) {
            if (t[key] != null) turnSystem[key] = t[key];
        }
        if (Array.isArray(t.units)) turnSystem.units = units;
    }
    clearSelection();
    removeDestroyedUnits();
    updateTurnUI();
    render();
    return true;
}
function saveGame(slot = 1) {
    if (aiRunning) return false;
    saveSystem.save(slot, { units, turnSystem, gameState, gameOver, scenario, world, reinforcementSystem });
    updateSaveControls();
    console.log(`[存档] 槽位 ${slot} 保存成功`);
    return true;
}
function loadGame(slot = 1) {
    if (aiRunning) return false;
    const snapshot = saveSystem.load(slot);
    if (!snapshot) return false;
    undoSystem.clear();
    applySnapshot(snapshot);
    updateSaveControls();
    console.log(`[存档] 槽位 ${slot} 读取成功`);
    return true;
}
function undoLastAction() {
    if (aiRunning || gameOver) return false;
    const entry = undoSystem.undo();
    if (!entry) return false;
    applySnapshot(entry.snapshot);
    updateSaveControls();
    console.log(`[撤销] ${entry.label}`);
    return true;
}
function ensureSaveControls() {
    const slotSelect = document.getElementById("save-slot-select");
    const saveButton = document.getElementById("save-game-button");
    const loadButton = document.getElementById("load-game-button");
    const undoButton = document.getElementById("undo-game-button");
    if (!slotSelect || !saveButton || !loadButton || !undoButton) {
        console.error("[存档系统] index.html 缺少存档/读取/撤销控件");
        return;
    }
    const selectedSlot = () => Number(slotSelect.value ?? 1);
    saveButton.addEventListener("click", () => {
        saveGame(selectedSlot());
    });
    loadButton.addEventListener("click", () => {
        if (!loadGame(selectedSlot())) {
            alert("该槽位没有可读取的存档。");
        }
    });
    undoButton.addEventListener("click", () => {
        undoLastAction();
    });
    slotSelect.addEventListener("change", updateSaveControls);
    updateSaveControls();
}
function updateSaveControls() {
    const slot = Number(document.getElementById("save-slot-select")?.value ?? 1);
    const loadButton = document.getElementById("load-game-button");
    const undoButton = document.getElementById("undo-game-button");
    if (loadButton) loadButton.disabled = aiRunning || !saveSystem.has(slot);
    if (undoButton) undoButton.disabled = aiRunning || gameOver || !undoSystem.canUndo();
}
// ============================================================
// 结束行动按钮
// ============================================================
endPhaseButton?.addEventListener(
    "click",
    () => {
        endCurrentPhase();
    }
);
// ============================================================
// 键盘
// ============================================================
window.addEventListener(
    "keydown",
    event => {
        if (event.ctrlKey && event.key.toLowerCase() === "s") { event.preventDefault(); saveGame(Number(document.getElementById("save-slot-select")?.value ?? 1)); return; }
        if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); undoLastAction(); return; }
        if (
            event.key ===
            "Escape"
        ) {
            clearSelection();
            render();
            return;
        }
        if (
            event.key.toLowerCase() ===
            "e"
        ) {
            endCurrentPhase();
        }
    }
);
// ============================================================
// 玩家选择阵营之后
// ============================================================
function applyDifficultyToEnemyUnits() {
    const playerSide = getPlayerSide();
    const factor = Number(currentDifficulty?.multiplier ?? gameState.difficultyMultiplier ?? 1);
    gameState.difficultyName = currentDifficulty?.name ?? gameState.difficultyName ?? "普通";
    gameState.difficultyMultiplier = factor;
    for (const unit of units) {
        if (!unit || unit.offMap === true || getUnitSide(unit) === playerSide || unit._difficultyApplied === factor) continue;
        // 只缩放战斗参数；不改变移动力、射程、弹药，避免改变地图节奏。
        for (const key of ["strength","maxStrength","attack","defense","morale"]) {
            if (Number.isFinite(Number(unit[key]))) unit[key] = Math.max(1, Math.round(Number(unit[key]) * factor));
        }
        unit.difficultyMultiplier = factor;
        unit._difficultyApplied = factor;
    }
}

function startGame() {
    ensureSaveControls();
    saveSystem.autoSave({ units, turnSystem, gameState, gameOver, scenario, world, reinforcementSystem });
    updateSaveControls();
    console.log(
        "玩家阵营：",
        getPlayerSide()
    );
    console.log(
        "游戏模式：",
        gameState.mode
    );
    clearSelection();
    fogOfWarSystem.setSide(getPlayerSide());
    updateTurnUI();
    resizeCanvas();
    render();
    const currentSide =
        normalizeSide(
            turnSystem?.phase
        );
    const playerSide =
        getPlayerSide();
    // 把最终选择结果同步回所有常见字段，确保其它系统读取到同一阵营。
    if (playerSide) {
        const id = FactionSystem.normalizeFaction(playerSide);
        gameState.playerFaction = id ?? gameState.playerFaction;
        gameState.playerSide = playerSide;
        gameState.selectedFaction = id ?? gameState.selectedFaction;
        gameState.selectedSide = playerSide;
    }
    applyDifficultyToEnemyUnits();
    strategicObjectives.onFactionChanged();
    updateDeveloperPanel();
    renderAirSupportPanel();
    console.log("[控制系统] 玩家阵营已统一为：", playerSide);
    console.log("[控制系统] 当前行动方：", currentSide);
    // ========================================================
    // 如果开局行动方不是玩家
    // AI 自动行动
    // ========================================================
    if (
        gameState.mode !==
            "observer" &&
        String(gameState.mode).toLowerCase() !== "developer" &&
        currentSide &&
        playerSide &&
        currentSide !==
            playerSide
    ) {
        setTimeout(
            () => {
                runAIPhase();
            },
            250
        );
    }
}
// ============================================================
// 航空支援卡组 UI
// ============================================================
function ensureAirSupportPanel(){
    let panel=document.getElementById('airSupportPanel');if(panel)return panel;
    panel=document.createElement('div');panel.id='airSupportPanel';panel.style.cssText='margin-top:14px;padding-top:10px;border-top:1px solid #aaa;font-size:13px';
    const aside=document.querySelector('.right-panel, aside:last-of-type')||document.querySelector('aside');aside?.appendChild(panel);return panel;
}
function renderAirSupportPanel(){
    const panel=ensureAirSupportPanel();if(!panel)return;const side=getPlayerSide();const cards=airSupportSystem.available(side);
    if(!cards.length){panel.innerHTML='';panel.hidden=true;return;}panel.hidden=false;
    panel.innerHTML='<h3 style="margin:0 0 8px">航空支援</h3><div style="font-size:11px;margin-bottom:6px">航空卡受战役次数、回合窗口与冷却限制</div>';
    for(const c of cards){const b=document.createElement('button');b.type='button';b.style.cssText='width:100%;margin:2px 0;padding:6px;text-align:left';const ok=c.availability?.ok!==false;b.disabled=!ok;b.title=ok?'选择后点击地图目标格':c.availability?.reason??'';b.textContent=`${c.name} ×${c.remaining}${ok?'':` · ${c.availability?.reason??'暂不可用'}`}`;b.onclick=()=>{pendingAirCard=c.id;writeBattleMessage(`${c.name}：请点击地图目标格；ESC取消`);};panel.appendChild(b);}
}

// ============================================================
// 加载游戏数据
// ============================================================
async function loadScenario(scenarioKey = "dubno", resumeSnapshot = null) {
    try {
        currentScenarioKey = scenarioKey; gameOver=false; aiRunning=false; clearSelection(); undoSystem.clear?.();
        const loaded = await scenarioManager.load(scenarioKey);
        currentScenarioConfig = loaded.config; scenario = loaded.scenario; units = loaded.units; strategicObjectives.setScenario(scenario);
        // 战役 JSON 的时间参数优先于战役目录默认值，避免 hoursPerTurn=24 时钟永远显示同一小时。
        currentScenarioConfig.start = { ...(currentScenarioConfig.start ?? {}) };
        if (Number.isFinite(Number(scenario?.hoursPerTurn))) currentScenarioConfig.start.hoursPerTurn = Number(scenario.hoursPerTurn);
        if (typeof scenario?.startTime === "string" && /^\d{1,2}:\d{2}$/.test(scenario.startTime)) {
            const [h,m] = scenario.startTime.split(":").map(Number); currentScenarioConfig.start.hour=h; currentScenarioConfig.start.minute=m;
        }
        airSupportSystem.configure(scenario);
        console.log(`[战役系统] ${loaded.theater.name} / ${loaded.phase.name} / ${loaded.config.name}`);
        initializeUnits();
        const integrityReport = integrityMonitor.auditScenario(scenario, units);
        if (integrityReport.errors.length) throw new Error(`主系统完整性检查失败：发现 ${integrityReport.errors.length} 个严重问题，请查看控制台 [完整性监测]`);
        resetCasualtyState(); renderCasualtyPanel();
        reinforcementSystem.arrivedGroups.clear();
        reinforcementSystem.arrivalLog.length = 0;
        reinforcementSystem.initialize(units, 1);
        units = units.filter(unit => unit.offMap === true || isUnitAlive(unit));
        const deploymentReport = runDeploymentSafetyCheck(units, { autoRepair: true });
        if (deploymentReport.invalid.length || deploymentReport.conflicts.length) {
            throw new Error(`${loaded.config.unitsPath} 主系统部署安全检查失败，请查看浏览器控制台`);
        }
        if(!validateUnits(units)) throw new Error(`${loaded.config.unitsPath} 单位数据检查失败，请查看浏览器控制台`);
        const counts={}; for(const unit of units){const side=getUnitSide(unit);counts[side]=(counts[side]??0)+1;}
        console.log("[单位系统] 战斗序列加载完成", counts);
        gameState.units=units; gameState.scenarioKey=loaded.config.id; gameState.scenarioName=loaded.config.name;
        gameState.setAvailableFactions?.(loaded.config.factions ?? []);
        initializeTurnSystem(); victorySystem=new VictorySystem({scenario});
        if(typeof camera.reset==="function") camera.reset();
        if(typeof camera.centerOnMap==="function") camera.centerOnMap(world,canvas,renderer);
        resizeCanvas(); render();
        if (resumeSnapshot) {
            currentDifficulty = { name: resumeSnapshot.difficultyName ?? "普通", multiplier: Number(resumeSnapshot.difficultyMultiplier ?? 1) };
            applySnapshot(resumeSnapshot);
            document.getElementById("mainMenu")?.setAttribute("hidden", "");
            startGame();
        } else {
            factionSelection.show(startGame,{scenario,config:loaded.config});
        }
        console.log(`战役已启动：${loaded.config.name}`);
    } catch(error) {
        console.error("游戏初始化失败：",error);
        if(unitInfo){unitInfo.innerHTML=`<strong>游戏数据加载失败</strong><br><br>${error.message}<br><br><button id="return-scenario-selection" type="button">返回战役选择</button>`;document.getElementById("return-scenario-selection")?.addEventListener("click",showScenarioSelection);} else showScenarioSelection();
    }
}

// ============================================================
// V0.3.1 主界面 / 存档槽 UI
// ============================================================
function factionLabel(side){ const v=normalizeSide(side); return v==='chinese'?'中国军':v==='japanese'?'日军':v==='german'?'德军':v==='soviet'?'苏军':v==='rok_government'?'政府军':v==='new_military'?'新军部':(side??''); }
function showMainMenu(){ document.getElementById('pauseMenu')?.setAttribute('hidden',''); document.getElementById('mainMenu')?.removeAttribute('hidden'); updateMainMenu(); }
function hideMainMenu(){ document.getElementById('mainMenu')?.setAttribute('hidden',''); }
function updateMainMenu(){ const b=document.getElementById('menuContinue'); if(b)b.disabled=!(saveSystem.hasResume()||saveSystem.hasAutoSave()); }
function openSaveModal(mode='load'){
  const modal=document.getElementById('saveLoadModal'), box=document.getElementById('saveSlotCards'), title=document.getElementById('saveModalTitle'); if(!modal||!box)return;
  title.textContent=mode==='save'?'保存游戏':'读取存档'; box.innerHTML='';
  const auto=saveSystem.getAutoSummary(); if(mode==='load') box.appendChild(makeSlotCard('自动存档',auto,'auto',mode));
  for(let i=1;i<=3;i++) box.appendChild(makeSlotCard(`存档 ${i}`,saveSystem.getSummary(i),i,mode));
  modal.dataset.mode=mode; modal.removeAttribute('hidden');
}
function makeSlotCard(label,summary,slot,mode){
  const d=document.createElement('div');d.className='save-slot-card'; const when=summary?.savedAt?new Date(summary.savedAt).toLocaleString():'空';
  d.innerHTML=`<div class="save-slot-title">${label}</div><div class="save-slot-meta">${summary?`${summary.scenarioName} · ${factionLabel(summary.playerFaction)} · 第${summary.turn}回合 · ${when}`:'空槽位'}</div><div class="save-slot-buttons"></div>`;
  const row=d.querySelector('.save-slot-buttons');
  if(mode==='save'&&slot!=='auto'){const b=document.createElement('button');b.textContent=summary?'覆盖保存':'保存';b.onclick=()=>{saveGame(slot);openSaveModal('save');};row.appendChild(b);}
  if(mode==='load'&&summary){const b=document.createElement('button');b.textContent='读取';b.onclick=async()=>{const snap=slot==='auto'?saveSystem.loadAutoSave():saveSystem.load(slot);document.getElementById('saveLoadModal')?.setAttribute('hidden','');await resumeFromSnapshot(snap);};row.appendChild(b);}
  if(summary&&slot!=='auto'){const ex=document.createElement('button');ex.textContent='导出';ex.onclick=()=>saveSystem.exportSlot(slot);row.appendChild(ex);const del=document.createElement('button');del.textContent='删除';del.onclick=()=>{if(confirm(`删除${label}？`)){saveSystem.remove(slot);openSaveModal(mode);updateMainMenu();}};row.appendChild(del);}
  return d;
}
async function resumeFromSnapshot(snapshot){ if(!snapshot)return false; const key=snapshot.scenarioKey ?? snapshot.scenario?.id ?? 'wanjialing'; hideMainMenu(); await loadScenario(key,snapshot); return true; }
function initializeMainMenu(){
  const main=document.getElementById('mainMenu'); main?.removeAttribute('hidden'); updateMainMenu();
  document.getElementById('menuNewGame')?.addEventListener('click',()=>{hideMainMenu();showScenarioSelection();});
  document.getElementById('menuContinue')?.addEventListener('click',()=>resumeFromSnapshot(saveSystem.loadResume() ?? saveSystem.loadAutoSave()));
  document.getElementById('menuDeveloper')?.addEventListener('click',openMainDeveloperEditor);
  document.getElementById('menuLoad')?.addEventListener('click',()=>openSaveModal('load'));
  document.getElementById('menuSettings')?.addEventListener('click',()=>alert('设置面板将在后续版本继续扩展。'));
  document.getElementById('menuAbout')?.addEventListener('click',()=>document.getElementById('aboutModal')?.removeAttribute('hidden'));
  document.getElementById('closeAboutModal')?.addEventListener('click',()=>document.getElementById('aboutModal')?.setAttribute('hidden',''));
  document.getElementById('menu-game-button')?.addEventListener('click',()=>document.getElementById('pauseMenu')?.removeAttribute('hidden'));
  document.getElementById('pauseResume')?.addEventListener('click',()=>document.getElementById('pauseMenu')?.setAttribute('hidden',''));
  document.getElementById('pauseSave')?.addEventListener('click',()=>{document.getElementById('pauseMenu')?.setAttribute('hidden','');openSaveModal('save');});
  document.getElementById('pauseLoad')?.addEventListener('click',()=>{document.getElementById('pauseMenu')?.setAttribute('hidden','');openSaveModal('load');});
  document.getElementById('pauseMain')?.addEventListener('click',()=>{document.getElementById('pauseMenu')?.setAttribute('hidden','');showMainMenu();});
  document.getElementById('closeSaveModal')?.addEventListener('click',()=>document.getElementById('saveLoadModal')?.setAttribute('hidden',''));
  document.getElementById('importSaveButton')?.addEventListener('click',()=>document.getElementById('importSaveFile')?.click());
  document.getElementById('importSaveFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{await saveSystem.importFile(file,1);alert('已导入到存档1。');openSaveModal('load');updateMainMenu();}catch(err){alert(`导入失败：${err.message}`);}e.target.value='';});
}

// ============================================================
// 开发者模式控制面板（与普通战役完全隔离）
// ============================================================
function updateDeveloperPanel(){
  const panel=document.getElementById('developerPanel'); if(!panel)return;
  const dev=String(gameState.mode).toLowerCase()==='developer'; panel.hidden=!dev;
  if(dev){const input=document.getElementById('devTurnInput');if(input&&turnSystem)input.value=turnSystem.turn??1;}
}
function developerAdvanceFullTurn(){
  if(String(gameState.mode).toLowerCase()!=='developer'||!turnSystem)return;
  const start=Number(turnSystem.turn??1); let guard=0;
  do{turnSystem.endPhase?.();resetFactionForPhase(normalizeSide(turnSystem.phase));guard++;}while(Number(turnSystem.turn??1)===start&&guard<10);
  clearSelection();updateTurnUI();render();updateDeveloperPanel();
}
function developerSetTurn(){
  if(String(gameState.mode).toLowerCase()!=='developer'||!turnSystem)return;
  const n=Math.max(1,Math.floor(Number(document.getElementById('devTurnInput')?.value)||1));
  turnSystem.turn=n; reinforcementSystem.processTurn?.(n,units); strategicObjectives.onTurnChanged?.(); updateTurnUI();render();updateDeveloperPanel();
}
document.getElementById('devEndPhase')?.addEventListener('click',endCurrentPhase);
document.getElementById('devNextTurn')?.addEventListener('click',developerAdvanceFullTurn);
document.getElementById('devSetTurn')?.addEventListener('click',developerSetTurn);

// ============================================================
// 窗口变化
// ============================================================
window.addEventListener(
    "resize",
    () => {
        resizeCanvas();
        render();
    }
);
window.addEventListener("orientationchange", () => {
    setTimeout(() => { resizeCanvas(); render(); }, 180);
});

// ============================================================
// v0.20 主界面开发者编辑器
// ============================================================
let mainDevSelection=null;
function mainDevKey(){return 'frontline_campaign_editor_v020';}
function mainDevClone(x){return JSON.parse(JSON.stringify(x));}
function mainDevLoadDraft(){try{const d=JSON.parse(localStorage.getItem(mainDevKey())||'null');if(Array.isArray(d)){CAMPAIGNS.splice(0,CAMPAIGNS.length,...d);}}catch(e){}}
function mainDevUIData(){return {tagline:document.getElementById('mainMenuTagline')?.textContent?.trim()??'',version:document.getElementById('mainMenuVersion')?.textContent?.trim()??'',updateTitle:document.getElementById('mainUpdateTitle')?.textContent?.trim()??'',updateDetail:document.getElementById('mainUpdateDetail')?.textContent?.trim()??'',about:(document.getElementById('aboutContent')?.innerText??'').trim()};}
function mainDevApplyUIData(d={}){const set=(id,v)=>{const e=document.getElementById(id);if(e&&v!=null)e.textContent=v};set('mainMenuTagline',d.tagline);set('mainMenuVersion',d.version);set('mainUpdateTitle',d.updateTitle);set('mainUpdateDetail',d.updateDetail);const a=document.getElementById('aboutContent');if(a&&d.about!=null)a.innerText=d.about;}
function mainDevFillContent(){const d=mainDevUIData(), map={mainDevTagline:d.tagline,mainDevVersionText:d.version,mainDevUpdateTitle:d.updateTitle,mainDevUpdateDetail:d.updateDetail,mainDevAbout:d.about};for(const [id,v] of Object.entries(map)){const e=document.getElementById(id);if(e)e.value=v;}}
function openMainDeveloperEditor(){const key=window.prompt('请输入开发者模式密钥：','');if(key!=='123456wrx'){if(key!==null)alert('开发者密钥错误。');return;}mainDevLoadDraft();try{const ui=JSON.parse(localStorage.getItem('frontline_main_ui_v021')||'null');if(ui)mainDevApplyUIData(ui);}catch(e){}document.getElementById('mainDeveloperEditor')?.removeAttribute('hidden');mainDevFillContent();renderMainDevTree();}
function renderMainDevTree(){const box=document.getElementById('mainDevTree');if(!box)return;box.innerHTML='';CAMPAIGNS.forEach((t,ti)=>{const tb=document.createElement('button');tb.style.cssText='width:100%;text-align:left;margin:2px 0;font-weight:700';tb.textContent=`▾ ${t.name}`;tb.onclick=()=>selectMainDev('theater',ti);box.appendChild(tb);(t.phases||[]).forEach((ph,pi)=>{const pb=document.createElement('button');pb.style.cssText='width:calc(100% - 14px);margin-left:14px;text-align:left;margin-top:2px';pb.textContent=`└ ${ph.name}`;pb.onclick=()=>selectMainDev('phase',ti,pi);box.appendChild(pb);(ph.scenarios||[]).forEach((sc,si)=>{const sb=document.createElement('button');sb.style.cssText='width:calc(100% - 30px);margin-left:30px;text-align:left;margin-top:2px';sb.textContent=`• ${sc.name}`;sb.onclick=()=>selectMainDev('scenario',ti,pi,si);box.appendChild(sb);});});});}
function selectMainDev(type,ti,pi=null,si=null){mainDevSelection={type,ti,pi,si};const obj=type==='theater'?CAMPAIGNS[ti]:type==='phase'?CAMPAIGNS[ti].phases[pi]:CAMPAIGNS[ti].phases[pi].scenarios[si];const props=document.getElementById('mainDevProps');const common=`<label>名称</label><input id="mdName" value="${String(obj.name??'').replaceAll('"','&quot;')}" style="width:100%"><label>副标题/说明</label><input id="mdSubtitle" value="${String(obj.subtitle??'').replaceAll('"','&quot;')}" style="width:100%"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>模块宽度(px)<input id="mdWidth" type="number" value="${obj.ui?.width??''}" style="width:100%"></label><label>模块高度(px)<input id="mdHeight" type="number" value="${obj.ui?.height??''}" style="width:100%"></label></div>`;let extra='';if(type==='scenario')extra=`<label>日期</label><input id="mdDate" value="${obj.dateText??''}" style="width:100%"><label>地点</label><input id="mdLocation" value="${obj.location??''}" style="width:100%"><label>Scenario路径</label><input id="mdScenarioPath" value="${obj.scenarioPath??''}" style="width:100%"><label>Units路径</label><input id="mdUnitsPath" value="${obj.unitsPath??''}" style="width:100%"><label>状态</label><select id="mdStatus"><option value="available">available</option><option value="interface">interface</option><option value="locked">locked</option></select><label>移动到阶段</label><select id="mdParent"></select>`;props.innerHTML=`<h3>${type==='theater'?'战场':type==='phase'?'阶段':'战役'}属性</h3>${common}${extra}<div style="display:flex;gap:8px;margin-top:12px"><button id="mdApply">应用</button><button id="mdDelete">删除</button></div>`;if(type==='scenario'){document.getElementById('mdStatus').value=obj.status??'available';const sel=document.getElementById('mdParent');CAMPAIGNS.forEach((t,a)=>(t.phases||[]).forEach((ph,b)=>{const o=document.createElement('option');o.value=`${a}:${b}`;o.textContent=`${t.name} / ${ph.name}`;if(a===ti&&b===pi)o.selected=true;sel.appendChild(o);}));}document.getElementById('mdApply').onclick=applyMainDev;document.getElementById('mdDelete').onclick=deleteMainDev;}
function applyMainDev(){if(!mainDevSelection)return;let {type,ti,pi,si}=mainDevSelection;const obj=type==='theater'?CAMPAIGNS[ti]:type==='phase'?CAMPAIGNS[ti].phases[pi]:CAMPAIGNS[ti].phases[pi].scenarios[si];obj.name=document.getElementById('mdName').value;obj.subtitle=document.getElementById('mdSubtitle').value;obj.ui=obj.ui||{};const w=Number(document.getElementById('mdWidth').value),h=Number(document.getElementById('mdHeight').value);if(w)obj.ui.width=w;else delete obj.ui.width;if(h)obj.ui.height=h;else delete obj.ui.height;if(type==='scenario'){obj.dateText=document.getElementById('mdDate').value;obj.location=document.getElementById('mdLocation').value;obj.scenarioPath=document.getElementById('mdScenarioPath').value;obj.unitsPath=document.getElementById('mdUnitsPath').value;obj.status=document.getElementById('mdStatus').value;const [nti,npi]=document.getElementById('mdParent').value.split(':').map(Number);if(nti!==ti||npi!==pi){CAMPAIGNS[ti].phases[pi].scenarios.splice(si,1);CAMPAIGNS[nti].phases[npi].scenarios.push(obj);mainDevSelection=null;document.getElementById('mainDevProps').textContent='战役已移动。';}}renderMainDevTree();}
function deleteMainDev(){if(!mainDevSelection||!confirm('确定删除这个目录项目？'))return;const {type,ti,pi,si}=mainDevSelection;if(type==='scenario')CAMPAIGNS[ti].phases[pi].scenarios.splice(si,1);else if(type==='phase')CAMPAIGNS[ti].phases.splice(pi,1);else CAMPAIGNS.splice(ti,1);mainDevSelection=null;renderMainDevTree();document.getElementById('mainDevProps').textContent='已删除。';}
function addMainDev(kind){if(kind==='theater'){CAMPAIGNS.push({id:`theater_${Date.now()}`,name:'新战场',subtitle:'',phases:[]});}else if(kind==='phase'){const ti=mainDevSelection?.ti??0;if(!CAMPAIGNS[ti])return alert('请先选择战场。');CAMPAIGNS[ti].phases.push({id:`phase_${Date.now()}`,name:'新阶段',scenarios:[]});}else{const ti=mainDevSelection?.ti??0,pi=mainDevSelection?.pi??0;if(!CAMPAIGNS[ti]?.phases?.[pi])return alert('请先选择阶段。');CAMPAIGNS[ti].phases[pi].scenarios.push({id:`scenario_${Date.now()}`,name:'新战役',dateText:'',location:'',status:'interface',scenarioPath:'./data/scenario-new.json',unitsPath:'./data/units-new.json'});}renderMainDevTree();}
document.getElementById('mainDevClose')?.addEventListener('click',()=>document.getElementById('mainDeveloperEditor')?.setAttribute('hidden',''));document.getElementById('mainDevAddTheater')?.addEventListener('click',()=>addMainDev('theater'));document.getElementById('mainDevAddPhase')?.addEventListener('click',()=>addMainDev('phase'));document.getElementById('mainDevAddScenario')?.addEventListener('click',()=>addMainDev('scenario'));
document.getElementById('mainDevApplyContent')?.addEventListener('click',()=>{const d={tagline:document.getElementById('mainDevTagline')?.value??'',version:document.getElementById('mainDevVersionText')?.value??'',updateTitle:document.getElementById('mainDevUpdateTitle')?.value??'',updateDetail:document.getElementById('mainDevUpdateDetail')?.value??'',about:document.getElementById('mainDevAbout')?.value??''};mainDevApplyUIData(d);localStorage.setItem('frontline_main_ui_v021',JSON.stringify(d));alert('主界面内容已应用并保存为浏览器草稿。');});
document.getElementById('mainDevSave')?.addEventListener('click',()=>{localStorage.setItem(mainDevKey(),JSON.stringify(CAMPAIGNS));localStorage.setItem('frontline_main_ui_v021',JSON.stringify(mainDevUIData()));alert('主界面编辑草稿已保存。');});document.getElementById('mainDevExport')?.addEventListener('click',()=>devDownload('campaigns.json',{campaigns:CAMPAIGNS}));document.getElementById('mainDevExportUI')?.addEventListener('click',()=>devDownload('main-ui.json',mainDevUIData()));document.getElementById('mainDevReset')?.addEventListener('click',()=>{localStorage.removeItem(mainDevKey());localStorage.removeItem('frontline_main_ui_v021');location.reload();});

// ============================================================
// 启动：先选择战役，再选择阵营
// ============================================================
resizeCanvas();
render();
initializeMainMenu();

// V0.3 刷新恢复：游戏进行中每10秒保存当前快照，并在页面离开前再写一次。
setInterval(()=>{try{if(turnSystem&&Array.isArray(units)&&units.length&&currentScenarioKey)saveSystem.saveResume({units,turnSystem,gameState,gameOver,scenario,world});}catch(e){}},10000);
window.addEventListener('beforeunload',()=>{try{if(turnSystem&&Array.isArray(units)&&units.length&&currentScenarioKey)saveSystem.saveResume({units,turnSystem,gameState,gameOver,scenario,world});}catch(e){}});


// ============================================================
// 开发者地图编辑器 v0.15
// 正式数据通过“导出战役 JSON / 导出单位 JSON”更新，不直接写源文件。
// ============================================================
let devWallStart = null;
let devUnitToMove = null;
function devStatus(text){const e=document.getElementById('devEditorStatus');if(e)e.textContent=text;}
function devHexKey(q,r){return `${Number(q)},${Number(r)}`;}
function devAdjacent(a,b){const dq=Number(b.q)-Number(a.q),dr=Number(b.r)-Number(a.r);return [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]].some(d=>d[0]===dq&&d[1]===dr);}
function devSameEdge(e,a,b){const f=e?.from??{},t=e?.to??{};return (Number(f.q)===Number(a.q)&&Number(f.r)===Number(a.r)&&Number(t.q)===Number(b.q)&&Number(t.r)===Number(b.r))||(Number(f.q)===Number(b.q)&&Number(f.r)===Number(b.r)&&Number(t.q)===Number(a.q)&&Number(t.r)===Number(a.r));}
function devSyncMap(){
 const map=scenario?.map ?? world?.scenario?.map; if(!map)return null;
 map.terrain=Array.from(world.specialTerrain?.entries?.()??[]).map(([k,type])=>{const [q,r]=k.split(',').map(Number);return {q,r,type};}).filter(x=>x.type!=='plain');
 map.settlements=JSON.parse(JSON.stringify(world.settlements??map.settlements??[]));
 map.fortifications=JSON.parse(JSON.stringify(world.fortifications??[])); map.wallEdges=JSON.parse(JSON.stringify(world.wallEdges??[])); map.gates=JSON.parse(JSON.stringify(world.gates??[])); return map;
}
function devPrompt(label,value=''){const v=window.prompt(label,String(value??''));return v===null?null:v.trim();}
function devPickSide(current='chinese'){const raw=devPrompt('阵营：chinese / japanese / soviet / german / allied / rok_government / new_military',current);return raw||null;}
function devRefreshScenarioUI(){devSyncMap();strategicObjectives.setScenario(scenario);reinforcementSystem.initialize(units,turnSystem?.turn??1);updateReinforcementUI();render();}
function devSettlementAt(hex){return (world.settlements??[]).find(x=>Number(x.q)===Number(hex.q)&&Number(x.r)===Number(hex.r));}
function devEditPlaceName(hex){
 world.settlements=Array.isArray(world.settlements)?world.settlements:[]; let x=devSettlementAt(hex);
 if(x){const name=devPrompt('地名（留空并确认可删除该地名）：',x.nameZh??x.name??'');if(name===null)return;if(!name){if(confirm('删除这个地名？'))world.settlements=world.settlements.filter(v=>v!==x);else return;}else{x.name=name;x.nameZh=name;const type=devPrompt('类型：city / town / village / hill / station / port',x.type??'town');if(type!==null&&type)x.type=type;}}
 else {const name=devPrompt(`在 (${hex.q}, ${hex.r}) 新建地名：`,'');if(!name)return;const type=devPrompt('类型：city / town / village / hill / station / port','town')||'town';world.settlements.push({id:`place_${hex.q}_${hex.r}`,name,nameZh:name,q:Number(hex.q),r:Number(hex.r),type});}
 devSyncMap();devStatus(`已更新 (${hex.q}, ${hex.r}) 地名。`);render();
}
function devEditNode(hex){
 world.settlements=Array.isArray(world.settlements)?world.settlements:[]; let x=devSettlementAt(hex);
 if(!x){const name=devPrompt(`重要节点名称 (${hex.q}, ${hex.r})：`,'重要节点');if(!name)return;x={id:`node_${hex.q}_${hex.r}`,name,nameZh:name,q:Number(hex.q),r:Number(hex.r),type:'objective'};world.settlements.push(x);}
 const action=devPrompt('重要节点：输入 on 标记，off 取消；也可直接修改名称',x.strategicObjective?'on':'on');if(action===null)return;
 if(action.toLowerCase()==='off'){x.strategicObjective=false;devStatus(`${x.nameZh??x.name} 已取消重要节点标记。`);}else{x.strategicObjective=true;if(action&&action.toLowerCase()!=='on'){x.name=action;x.nameZh=action;}devStatus(`${x.nameZh??x.name} 已设为重要节点。`);}devSyncMap();render();
}
function devEditObjective(hex){
 scenario.strategicObjectives=scenario.strategicObjectives&&typeof scenario.strategicObjectives==='object'?scenario.strategicObjectives:{};
 const side=devPickSide('chinese');if(!side)return;scenario.strategicObjectives[side]=Array.isArray(scenario.strategicObjectives[side])?scenario.strategicObjectives[side]:[];
 const arr=scenario.strategicObjectives[side];let o=arr.find(x=>Number(x.q)===Number(hex.q)&&Number(x.r)===Number(hex.r));
 if(o&&confirm(`这里已有目标“${o.title??o.name??o.id}”。确定=编辑，取消=删除/退出选择。` )===false){if(confirm('删除这个战术目标？'))arr.splice(arr.indexOf(o),1);else return;devRefreshScenarioUI();devStatus('已删除战术目标。');return;}
 const title=devPrompt('战术目标标题：',o?.title??'');if(!title)return;const description=devPrompt('目标说明：',o?.description??'')??(o?.description??'');const priority=devPrompt('优先级：primary / secondary / optional',o?.priority??'secondary')||'secondary';const action=devPrompt('行动：capture / defend / survive',o?.action??(side==='chinese'?'defend':'capture'))||'capture';const dl=devPrompt('截止回合（留空=无截止）：',o?.deadlineTurn??'');
 const data={...(o??{}),id:o?.id??`dev_obj_${side}_${Date.now()}`,title,description,priority,action,q:Number(hex.q),r:Number(hex.r)};if(dl)data.deadlineTurn=Math.max(1,Number(dl)||1);else delete data.deadlineTurn;if(o)Object.assign(o,data);else arr.push(data);devRefreshScenarioUI();devStatus(`已更新${side}战术目标：${title}`);
}
let devReinfEditingUnit=null, devReinfClickedHex=null, devUnitInitialMode=false;
const DEV_UNIT_TEMPLATES={
 infantry:{strength:500,attack:60,defense:55,movement:4,range:1,morale:70,ammo:100},guard:{strength:600,attack:72,defense:70,movement:4,range:1,morale:85,ammo:100},engineer:{strength:350,attack:52,defense:58,movement:4,range:1,morale:75,ammo:90},machinegun:{strength:220,attack:68,defense:72,movement:3,range:2,morale:72,ammo:100},artillery:{strength:300,attack:90,defense:30,movement:3,range:4,morale:70,ammo:80},antitank:{strength:220,attack:82,defense:42,movement:3,range:2,morale:72,ammo:80},anti_air:{strength:200,attack:55,defense:38,movement:3,range:3,morale:70,ammo:85},recon:{strength:180,attack:38,defense:35,movement:7,range:1,morale:75,ammo:85},cavalry:{strength:420,attack:58,defense:45,movement:7,range:1,morale:72,ammo:90},motorized:{strength:500,attack:68,defense:55,movement:7,range:1,morale:75,ammo:95},armor:{strength:300,attack:88,defense:82,movement:6,range:2,morale:80,ammo:85},tank:{strength:320,attack:96,defense:88,movement:6,range:2,morale:82,ammo:85},headquarters:{strength:180,attack:20,defense:38,movement:5,range:1,morale:85,ammo:70}
};
function devNum(id,fallback=0){const n=Number(document.getElementById(id)?.value);return Number.isFinite(n)?n:fallback;}
function devApplyUnitTemplate(){const t=DEV_UNIT_TEMPLATES[document.getElementById('devReinfType')?.value]??DEV_UNIT_TEMPLATES.infantry;for(const [id,k] of [['devReinfStrength','strength'],['devReinfMaxStrength','strength'],['devReinfAttack','attack'],['devReinfDefense','defense'],['devReinfMovement','movement'],['devReinfRange','range'],['devReinfMorale','morale'],['devReinfAmmo','ammo']]){const e=document.getElementById(id);if(e)e.value=t[k];}}
document.getElementById('devReinfType')?.addEventListener('change',devApplyUnitTemplate);document.getElementById('devReinfDefaults')?.addEventListener('click',devApplyUnitTemplate);
function devObjectiveChoices(){
 const out=[['nearest_enemy','最近敌军']]; const so=scenario?.strategicObjectives??{};
 for(const [side,arr] of Object.entries(so)) if(Array.isArray(arr)) for(const o of arr) if(o?.q!=null) out.push([`hex:${o.q},${o.r}`,`${o.title??o.name??o.id} (${o.q},${o.r})`]);
 for(const x of (world?.settlements??[])) out.push([`hex:${x.q},${x.r}`,`${x.nameZh??x.name??'地名/节点'} (${x.q},${x.r})`]);
 return out;
}
function devOpenReinforcementEditor(clickedUnit,hex,initialMode=false){
 const panel=document.getElementById('devReinforcementEditor'); if(!panel)return; devUnitInitialMode=initialMode;
 devReinfEditingUnit=clickedUnit??null; devReinfClickedHex=hex?{q:Number(hex.q),r:Number(hex.r)}:null;
 const u=clickedUnit??{}; const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??'';};
 document.getElementById('devUnitEditorTitle').textContent=initialMode?'正面战场单位编辑器':'战术增援单位编辑器';
 set('devReinfName',u.name??u.fullName??(initialMode?'新部署单位':'新增援单位'));set('devReinfType',u.type??'infantry');set('devReinfScale',u.scale??u.unitScale??'battalion');set('devReinfCommander',u.commander?.name??u.commanderName??'');set('devReinfCommanderRank',u.commander?.rank??u.commanderRank??'');set('devReinfFaction',u.faction??'chinese');
 if(clickedUnit){set('devReinfStrength',u.strength??100);set('devReinfMaxStrength',u.maxStrength??u.strength??100);set('devReinfAttack',u.attack??10);set('devReinfDefense',u.defense??10);set('devReinfMovement',u.movement??4);set('devReinfRange',u.range??1);set('devReinfMorale',u.morale??80);set('devReinfAmmo',u.ammo??100);}else devApplyUnitTemplate();
 set('devReinfTurn',initialMode?1:(u.reinforcementTurn??Math.max(2,(turnSystem?.turn??1)+1)));set('devReinfEntry',u.entryPoint?'point':(u.entryZone??'AUTO'));set('devReinfMission',u.mission??u.orderType??'attack');set('devReinfGroupName',u.reinforcementName??'战术增援');set('devReinfDetail',u.reinforcementDetail??'');
 const sel=document.getElementById('devReinfTarget');sel.innerHTML='';for(const [v,t] of devObjectiveChoices()){const o=document.createElement('option');o.value=v;o.textContent=t;sel.appendChild(o);} const target=u.missionTarget??u.attackTarget;if(target?.q!=null){const v=`hex:${target.q},${target.r}`;if(![...sel.options].some(o=>o.value===v)){const o=document.createElement('option');o.value=v;o.textContent=`指定目标 (${target.q},${target.r})`;sel.appendChild(o);}sel.value=v;}else sel.value='nearest_enemy';
 panel.hidden=false;devStatus(clickedUnit?`正在编辑单位：${unitName(clickedUnit)}`:`在 (${hex.q}, ${hex.r}) 新建${initialMode?'正面战场':'增援'}单位。`);
}
function devSaveReinforcementEditor(){
 let u=devReinfEditingUnit; if(!u){u={id:`DEV_UNIT_${Date.now()}`,q:devReinfClickedHex?.q??1,r:devReinfClickedHex?.r??1,suppression:0,fatigue:0};units.push(u);gameState.units=units;}
 const val=id=>document.getElementById(id)?.value;u.name=val('devReinfName')||'单位';u.fullName=u.name;u.type=val('devReinfType')||'infantry';u.scale=val('devReinfScale')||'battalion';u.unitScale=u.scale;u.commander={name:val('devReinfCommander')||'',rank:val('devReinfCommanderRank')||''};u.faction=val('devReinfFaction')||'chinese';u.strength=Math.max(1,devNum('devReinfStrength',100));u.maxStrength=Math.max(u.strength,devNum('devReinfMaxStrength',u.strength));u.attack=Math.max(0,devNum('devReinfAttack',10));u.defense=Math.max(0,devNum('devReinfDefense',10));u.movement=Math.max(0,devNum('devReinfMovement',4));u.movementPoints=u.movement;u.maxMovementPoints=u.movement;u.range=Math.max(1,devNum('devReinfRange',1));u.morale=Math.max(0,Math.min(100,devNum('devReinfMorale',80)));u.ammo=Math.max(0,Math.min(100,devNum('devReinfAmmo',100)));u.mission=val('devReinfMission')||'attack';
 const target=val('devReinfTarget');if(target?.startsWith('hex:')){const [q,r]=target.slice(4).split(',').map(Number);u.missionTarget={q,r};if(u.mission==='attack')u.attackTarget={q,r};else delete u.attackTarget;}else{delete u.missionTarget;delete u.attackTarget;}
 const arrival=Math.max(1,devNum('devReinfTurn',1)); if(arrival<=1){for(const k of ['reinforcementGroup','reinforcementTurn','reinforcementName','reinforcementDetail','entryZone','entryPoint','entryRadius','requiresFriendlyAt'])delete u[k];u.offMap=false;if(devReinfClickedHex){u.q=devReinfClickedHex.q;u.r=devReinfClickedHex.r;}}
 else{u.reinforcementGroup=u.reinforcementGroup||`DEV_REINF_${Date.now()}`;u.reinforcementTurn=arrival;u.reinforcementName=val('devReinfGroupName')||'战术增援';u.reinforcementDetail=val('devReinfDetail')||'';const entry=val('devReinfEntry')||'AUTO';if(entry==='point'){u.entryPoint={...(devReinfClickedHex??{q:u.q,r:u.r})};delete u.entryZone;}else{u.entryZone=entry;delete u.entryPoint;}u.offMap=Number(turnSystem?.turn??1)<arrival;}
 reinforcementSystem.initialize(units,turnSystem?.turn??1);updateReinforcementUI();document.getElementById('devReinforcementEditor').hidden=true;devStatus(`已保存：${u.name}；出现回合 ${arrival}；任务 ${u.mission}。`);render();
}
function devDeleteReinforcementEditor(){const u=devReinfEditingUnit;if(u){const i=units.indexOf(u);if(confirm(`删除单位“${unitName(u)}”？`)&&i>=0)units.splice(i,1);}document.getElementById('devReinforcementEditor').hidden=true;reinforcementSystem.initialize(units,turnSystem?.turn??1);updateReinforcementUI();render();}
document.getElementById('devReinfClose')?.addEventListener('click',()=>document.getElementById('devReinforcementEditor').hidden=true);document.getElementById('devReinfSave')?.addEventListener('click',devSaveReinforcementEditor);document.getElementById('devReinfDelete')?.addEventListener('click',devDeleteReinforcementEditor);
function devEditReinforcement(clickedUnit,hex){devOpenReinforcementEditor(clickedUnit,hex,false);}

function developerEditorHandleClick(event,clickedUnit,clickedHex){
 const tool=document.getElementById('devTool')?.value??'unit'; const hex=clickedHex??mouseToHex(event); if(!hex)return false;
 if(tool==='deployment'){devOpenReinforcementEditor(clickedUnit,hex,true);return true;} if(tool==='placename'){devEditPlaceName(hex);return true;} if(tool==='node'){devEditNode(hex);return true;} if(tool==='objective'){devEditObjective(hex);return true;} if(tool==='reinforcement'){devEditReinforcement(clickedUnit,hex);return true;}
 if(tool==='unit'){if(clickedUnit){devUnitToMove=clickedUnit;selectUnit(clickedUnit);devStatus(`已选择 ${unitName(clickedUnit)}；点击任意空格直接移动。`);render();return true;}if(devUnitToMove){const occupied=unitAtHex(hex.q,hex.r);if(occupied&&occupied!==devUnitToMove){devStatus('目标格已有单位。');return true;}devUnitToMove.q=Number(hex.q);devUnitToMove.r=Number(hex.r);selectedHex={q:Number(hex.q),r:Number(hex.r)};devStatus(`${unitName(devUnitToMove)} → (${hex.q}, ${hex.r})`);showUnitInfo(devUnitToMove);render();return true;}devStatus('先点击任意一方算子，再点击目标格。');return true;}
 if(tool==='terrain'){const type=document.getElementById('devTerrain')?.value??'plain';if(type==='plain')world.specialTerrain.delete(devHexKey(hex.q,hex.r));else world.specialTerrain.set(devHexKey(hex.q,hex.r),type);devSyncMap();devStatus(`(${hex.q}, ${hex.r}) 地形 → ${type}`);render();return true;}
 if(tool==='fort'){world.fortifications=Array.isArray(world.fortifications)?world.fortifications:[];const i=world.fortifications.findIndex(f=>Number(f.q)===Number(hex.q)&&Number(f.r)===Number(hex.r));if(i>=0){world.fortifications.splice(i,1);devStatus(`删除 (${hex.q}, ${hex.r}) 工事`);}else{const level=Math.max(1,Math.min(3,Number(document.getElementById('devFortLevel')?.value)||1));world.fortifications.push({q:Number(hex.q),r:Number(hex.r),type:'fieldworks',level,progress:100,owner:null});devStatus(`建立 (${hex.q}, ${hex.r}) ${level}级工事`);}devSyncMap();render();return true;}
 if(tool==='wall'||tool==='gate'){if(!devWallStart){devWallStart={q:Number(hex.q),r:Number(hex.r)};devStatus(`起点 (${hex.q}, ${hex.r})；再点一个相邻格。`);return true;}const a=devWallStart,b={q:Number(hex.q),r:Number(hex.r)};devWallStart=null;if(!devAdjacent(a,b)){devStatus('两格不相邻，未修改。');return true;}world.wallEdges=Array.isArray(world.wallEdges)?world.wallEdges:[];world.gates=Array.isArray(world.gates)?world.gates:[];if(tool==='wall'){const i=world.wallEdges.findIndex(e=>devSameEdge(e,a,b));if(i>=0){world.wallEdges.splice(i,1);world.gates=world.gates.filter(g=>!devSameEdge(g,a,b));devStatus('已删除城墙边。');}else{world.wallEdges.push({from:a,to:b});devStatus('已建立城墙边。');}}else{if(!world.wallEdges.some(e=>devSameEdge(e,a,b)))world.wallEdges.push({from:a,to:b});const i=world.gates.findIndex(g=>devSameEdge(g,a,b));if(i>=0){world.gates.splice(i,1);devStatus('城门关闭：恢复城墙。');}else{const name=devPrompt('城门名称：','城门')||'城门';world.gates.push({id:`gate_${a.q}_${a.r}_${b.q}_${b.r}`,name,nameZh:name,from:a,to:b,open:true,type:'gate'});devStatus(`城门开放：${name}`);}}devSyncMap();render();return true;}
 return false;
}
function devDownload(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);}
function devDraftKey(){return `frontline_dev_${currentScenarioKey??scenario?.id??'scenario'}`;}
function devSnapshot(){devSyncMap();return {scenario:JSON.parse(JSON.stringify(scenario)),units:JSON.parse(JSON.stringify(units))};}
function devApplyDraft(d){if(!d?.scenario||!Array.isArray(d.units))return false;scenario=d.scenario;units=d.units;gameState.units=units;world.loadScenario?.(scenario);strategicObjectives.setScenario(scenario);reinforcementSystem.initialize(units,turnSystem?.turn??1);updateReinforcementUI();clearSelection();devUnitToMove=null;devWallStart=null;render();return true;}
document.getElementById('devTool')?.addEventListener('change',()=>{devWallStart=null;devUnitToMove=null;devStatus('工具已切换。');});
document.getElementById('devExitMode')?.addEventListener('click',()=>{document.getElementById('devReinforcementEditor')?.setAttribute('hidden','');gameState.setObserverMode();clearSelection();devUnitToMove=null;devWallStart=null;updateDeveloperPanel();render();});
document.getElementById('devSaveDraft')?.addEventListener('click',()=>{localStorage.setItem(devDraftKey(),JSON.stringify(devSnapshot()));devStatus('编辑已保存为浏览器草稿。正式更新请导出 JSON。');});
document.getElementById('devLoadDraft')?.addEventListener('click',()=>{try{const d=JSON.parse(localStorage.getItem(devDraftKey())||'null');devStatus(devApplyDraft(d)?'已读取开发者编辑。':'没有找到编辑存档。');}catch(e){devStatus('读取失败：'+e.message);}});
document.getElementById('devExportScenario')?.addEventListener('click',()=>{devSyncMap();devDownload(`scenario-${currentScenarioKey??scenario?.id??'edited'}.json`,scenario);devStatus('已导出战役 JSON（含地名、重要节点、战术目标、地形、工事、城墙/城门）。');});
document.getElementById('devExportUnits')?.addEventListener('click',()=>{devDownload(`units-${currentScenarioKey??scenario?.id??'edited'}.json`,units);devStatus('已导出单位 JSON（含单位位置与战术增援设置）。');});

window.addEventListener('keydown',e=>{if(e.key==='Escape'&&pendingEngineeringAction){pendingEngineeringAction=null;pendingEngineeringUnitId=null;writeBattleMessage('已取消工程目标选择');refreshEngineerActions();render();}});
