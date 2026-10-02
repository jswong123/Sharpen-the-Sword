// src/scenarios/ScenarioManager.js

import { findScenarioById } from "../../data/campaigns.js";

import { FactionSystem } from "../systems/FactionSystem.js";
import { ModernBrigadeSystem } from "../systems/ModernBrigadeSystem.js";

 

export class ScenarioManager {

    constructor({ world, gameState }) {

        this.world = world;

        this.gameState = gameState;

        this.current = null;

    }

 

    getScenarioConfig(id) {

        return findScenarioById(id);

    }

 

    async load(id) {

        const found = this.getScenarioConfig(id);

        if (!found) throw new Error(`未知战役：${id}`);

 

        const { theater, phase, scenario: config } = found;

        if (config.status === "locked") throw new Error(`${config.name} 尚未开放`);

 

        const isModern = ModernBrigadeSystem.isModern(config);
        const scenarioResponse = await fetch(config.scenarioPath, { cache: "no-store" });
        const unitsResponse = isModern ? null : await fetch(config.unitsPath, { cache: "no-store" });

 

        if (!scenarioResponse.ok) {

            throw new Error(`${config.name} 地图加载失败：HTTP ${scenarioResponse.status}`);

        }

        if (!isModern && !unitsResponse.ok) {
            throw new Error(`${config.name} 单位加载失败：HTTP ${unitsResponse.status}`);
        }

 

        const scenarioData = await scenarioResponse.json();

        let units;
        if (isModern) {
            units = ModernBrigadeSystem.generate(config);
        } else {
            const rawUnits = await unitsResponse.json();
            units = Array.isArray(rawUnits) ? rawUnits : (rawUnits.units ?? []);
        }

 

        scenarioData.key = scenarioData.key ?? config.id;

        scenarioData.name = scenarioData.name ?? config.name;

 

        this.applyScenarioToWorld(scenarioData);

        FactionSystem.configureGameState(this.gameState, config.factions);

 

        this.current = {

            theater,

            phase,

            config,

            scenario: scenarioData,

            units

        };

 

        return this.current;

    }

 

    applyScenarioToWorld(data) {

        if (!data || !this.world) return;

 

        if (typeof this.world.loadScenario === "function") {

            this.world.loadScenario(data);

            return;

        }

        if (typeof this.world.applyScenario === "function") {

            this.world.applyScenario(data);

            return;

        }

        if (typeof this.world.loadMap === "function" && data.map) {

            this.world.loadMap(data.map);

            return;

        }

 

        const map = data.map ?? data.world ?? data;

        if (Number.isFinite(Number(map.width))) this.world.width = Number(map.width);

        if (Number.isFinite(Number(map.height))) this.world.height = Number(map.height);

 

        if (Array.isArray(map.terrain)) this.world.terrain = map.terrain;

 

        for (const key of [

            "roads", "railways", "rails", "rivers",

            "settlements", "cities", "towns", "fortifications"

        ]) {

            if (Array.isArray(map[key])) this.world[key] = map[key];

        }

 

        this.world.config = map;

        this.world.mapConfig = map;

    }

}
