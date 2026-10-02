// ============================================================
// TerrainMovementSystem.js
// 战线 1937-1945
// V0.13.1 现代合成旅机动兼容版
//
// 直接替换：src/systems/TerrainMovementSystem.js
//
// ============================================================
// 核心规则
// ============================================================
//
// 1. water 对陆军绝对不可通行。
// 2. 道路/铁路不能把 water 自动视为桥梁。
// 3. bridges / crossingCells 才是合法跨水通道。
// 4. 杭州旧地图保留钱塘江大桥 (70,52) 兼容。
// 5. 西湖、青山湖等 water 对陆军不可进入。
// 6. 湿地根据单位移动类型计算。
// 7. 舰艇只能在 water 上移动。
// 8. bunker 为实体阻塞工事。
// 9. 支持现代合成旅：
//      - ZTZ-99A 等主战坦克
//      - ZBD-04A 等履带式步战车
//      - 轮式装甲车
//      - 猛士/卡车
//      - 自行火炮
//      - 防空车辆
// 10. 坦克/履带车辆允许进入森林，但成本增加。
// 11. 道路降低车辆移动成本。
// 12. 兼容旧二战单位 type。
// ============================================================

export class TerrainMovementSystem {

    constructor(world) {
        this.world = world;
    }


    // ========================================================
    // 基础工具
    // ========================================================

    sameHex(a, q, r) {

        if (!a) return false;

        const aq =
            Array.isArray(a)
                ? a[0]
                : a.q;

        const ar =
            Array.isArray(a)
                ? a[1]
                : a.r;

        return (
            Number(aq) === Number(q) &&
            Number(ar) === Number(r)
        );
    }


    scenarioId() {

        return String(
            this.world?.scenario?.id ??
            this.world?.scenario?.key ??
            this.world?.config?.id ??
            ""
        ).toLowerCase();
    }


    isHangzhouScenario() {

        const id = this.scenarioId();

        return (
            id.includes("hangzhou") ||
            id.includes("hangzhou_1937")
        );
    }


    // ========================================================
    // 道路 / 铁路
    // ========================================================

    isRoadHex(q, r) {

        return (
            this.world?.roads ??
            []
        ).some(
            road =>
                (
                    road.points ??
                    road.path ??
                    []
                ).some(
                    p =>
                        this.sameHex(
                            p,
                            q,
                            r
                        )
                )
        );
    }


    isRailwayHex(q, r) {

        return (
            this.world?.railways ??
            this.world?.rails ??
            []
        ).some(
            railway =>
                (
                    railway.points ??
                    railway.path ??
                    []
                ).some(
                    p =>
                        this.sameHex(
                            p,
                            q,
                            r
                        )
                )
        );
    }


    // ========================================================
    // 桥梁
    // ========================================================

    bridges() {

        const direct =
            this.world?.bridges;

        if (Array.isArray(direct)) {
            return direct;
        }

        const configBridges =
            this.world?.config?.bridges;

        if (Array.isArray(configBridges)) {
            return configBridges;
        }

        return [];
    }


    isBridgeActive(bridge) {

        if (!bridge) {
            return false;
        }

        const status =
            String(
                bridge.status ??
                "intact"
            ).toLowerCase();

        return ![
            "destroyed",
            "demolished",
            "collapsed",
            "blown",
            "closed"
        ].includes(status);
    }


    isBridgeHex(q, r) {

        const bridges =
            this.bridges();

        for (const bridge of bridges) {

            if (
                !this.isBridgeActive(
                    bridge
                )
            ) {
                continue;
            }

            // 桥梁中心格
            if (
                this.sameHex(
                    bridge,
                    q,
                    r
                )
            ) {
                return true;
            }

            if (
                this.sameHex(
                    bridge.hex,
                    q,
                    r
                )
            ) {
                return true;
            }

            // 桥梁通行格
            const cells =
                bridge.crossingCells ??
                bridge.cells ??
                bridge.points ??
                [];

            if (
                cells.some(
                    cell =>
                        this.sameHex(
                            cell,
                            q,
                            r
                        )
                )
            ) {
                return true;
            }
        }


        // ----------------------------------------------------
        // 杭州旧地图兼容
        // ----------------------------------------------------

        if (
            this.isHangzhouScenario() &&
            Number(q) === 70 &&
            Number(r) === 52
        ) {
            return true;
        }

        return false;
    }


    // ========================================================
    // 单位类型工具
    // ========================================================

    unitType(unit) {

        return String(
            unit?.type ??
            unit?.unitType ??
            unit?.category ??
            ""
        ).toLowerCase();
    }


    equipmentName(unit) {

        return String(
            unit?.equipment ??
            unit?.equipmentName ??
            unit?.vehicle ??
            unit?.name ??
            ""
        ).toLowerCase();
    }


    // ========================================================
    // 现代车辆进一步分类
    //
    // 返回：
    //
    // naval
    // tank
    // tracked
    // wheeled
    // artillery
    // infantry
    // engineer
    // cavalry
    //
    // ========================================================

    classOf(unit) {

        const type =
            this.unitType(unit);

        const equipment =
            this.equipmentName(unit);


        // ====================================================
        // 1. 海军
        // ====================================================

        if (
            unit?.naval === true ||
            [
                "naval",
                "ship",
                "boat",
                "heavy_cruiser",
                "light_cruiser",
                "destroyer",
                "transport_ship",
                "battleship",
                "carrier",
                "submarine"
            ].includes(type)
        ) {
            return "naval";
        }


        // ====================================================
        // 2. 工兵
        // ====================================================

        if (
            type === "engineer" ||
            type === "engineering"
        ) {
            return "engineer";
        }


        // ====================================================
        // 3. 骑兵
        // ====================================================

        if (
            type === "cavalry"
        ) {
            return "cavalry";
        }


        // ====================================================
        // 4. 主战坦克
        // ====================================================

        if (
            [
                "tank",
                "mbt",
                "main_battle_tank",
                "heavy_tank",
                "medium_tank",
                "light_tank"
            ].includes(type)
        ) {
            return "tank";
        }


        // 根据装备名称识别现代坦克

        if (
            equipment.includes("ztz") ||
            equipment.includes("99a") ||
            equipment.includes("96a") ||
            equipment.includes("主战坦克")
        ) {
            return "tank";
        }


        // ====================================================
        // 5. 履带式装甲车辆
        // ====================================================

        if (
            [
                "tracked",
                "tracked_vehicle",
                "ifv",
                "apc",
                "mechanized",
                "mechanized_infantry"
            ].includes(type)
        ) {
            return "tracked";
        }


        if (
            equipment.includes("zbd") ||
            equipment.includes("步战车") ||
            equipment.includes("履带")
        ) {
            return "tracked";
        }


        // ====================================================
        // 6. 轮式车辆
        // ====================================================

        if (
            [
                "vehicle",
                "truck",
                "motorized",
                "motorized_infantry",
                "reconnaissance",
                "recon",
                "wheeled",
                "wheeled_vehicle"
            ].includes(type)
        ) {
            return "wheeled";
        }


        if (
            equipment.includes("猛士") ||
            equipment.includes("卡车") ||
            equipment.includes("轮式")
        ) {
            return "wheeled";
        }


        // ====================================================
        // 7. 装甲旧类型
        //
        // 二战旧 scenario 中 armor / armored
        // 统一按坦克处理。
        // ====================================================

        if (
            type === "armor" ||
            type === "armored" ||
            type === "armour"
        ) {
            return "tank";
        }


        // ====================================================
        // 8. 火炮
        // ====================================================

        if (
            [
                "artillery",
                "field_artillery",
                "heavy_artillery",
                "antitank",
                "antiair",
                "air_defense",
                "sam",
                "sp_artillery",
                "self_propelled_artillery"
            ].includes(type)
        ) {
            return "artillery";
        }


        // ====================================================
        // 9. 默认步兵
        // ====================================================

        return "infantry";
    }


    // ========================================================
    // Scenario 自定义规则读取
    // ========================================================

    ruleCost(rule, unitClass) {

        if (
            !rule ||
            typeof rule !== "object"
        ) {
            return null;
        }


        let value =
            rule[unitClass];


        // ----------------------------------------------------
        // 向后兼容：
        // 旧地图只有 vehicle 时
        // tank/tracked/wheeled 自动读取 vehicle
        // ----------------------------------------------------

        if (
            value === undefined &&
            [
                "tank",
                "tracked",
                "wheeled"
            ].includes(unitClass)
        ) {
            value =
                rule.vehicle;
        }


        if (value === false) {
            return Infinity;
        }


        if (value === true) {
            return 1;
        }


        if (
            Number.isFinite(
                Number(value)
            )
        ) {
            return Number(value);
        }


        if (
            Number.isFinite(
                Number(
                    rule.movementCost
                )
            )
        ) {
            return Number(
                rule.movementCost
            );
        }


        return null;
    }


    // ========================================================
    // 桥梁移动成本
    // ========================================================

    bridgeCost(unitClass) {

        if (
            unitClass === "tank" ||
            unitClass === "tracked" ||
            unitClass === "wheeled" ||
            unitClass === "artillery"
        ) {
            return 1;
        }

        return 1;
    }


    // ========================================================
    // 水域
    // ========================================================

    waterCost(
        unit,
        q,
        r
    ) {

        const unitClass =
            this.classOf(unit);


        // 舰艇
        if (
            unitClass === "naval"
        ) {
            return 1;
        }


        // 桥梁
        if (
            this.isBridgeHex(
                q,
                r
            )
        ) {
            return this.bridgeCost(
                unitClass
            );
        }


        // 陆军不得直接进入水域
        return Infinity;
    }


    // ========================================================
    // 湿地
    // ========================================================

    wetlandCost(
        unit,
        rules
    ) {

        const unitClass =
            this.classOf(unit);


        // Scenario 自定义规则优先

        const customCost =
            this.ruleCost(
                rules?.marsh ??
                rules?.wetland,
                unitClass
            );


        if (
            customCost !== null
        ) {
            return customCost;
        }


        // ----------------------------------------------------
        // 默认湿地
        // ----------------------------------------------------

        const table = {

            infantry:
                3,

            engineer:
                2,

            cavalry:
                4,

            artillery:
                4,

            // 主战坦克禁止直接穿越深湿地
            tank:
                Infinity,

            // 履带式步战车允许缓慢通过
            tracked:
                4,

            // 轮式车辆禁止
            wheeled:
                Infinity
        };


        return (
            table[unitClass] ??
            3
        );
    }


    // ========================================================
    // 道路移动成本
    // ========================================================

    roadCost(
        unitClass,
        terrain
    ) {

        // 极陡山区即使有道路，
        // 重装备仍然不能随意通行。

        if (
            terrain === "steepMountain"
        ) {

            if (
                unitClass === "tank" ||
                unitClass === "tracked" ||
                unitClass === "wheeled" ||
                unitClass === "artillery"
            ) {
                return Infinity;
            }

            return 2;
        }


        // ----------------------------------------------------
        // 公路应提高车辆机动能力
        // ----------------------------------------------------

        switch (unitClass) {

            case "tank":
                return 1;

            case "tracked":
                return 1;

            case "wheeled":
                return 1;

            case "artillery":
                return 1;

            case "engineer":
                return 1;

            case "cavalry":
                return 1;

            case "infantry":
            default:
                return 1;
        }
    }


    // ========================================================
    // 碉堡检查
    // ========================================================

    isBlockingBunker(q, r) {

        return (
            this.world?.fortifications ??
            []
        ).some(
            f =>
                Number(f?.q) === Number(q) &&
                Number(f?.r) === Number(r) &&
                String(
                    f?.type ??
                    ""
                ).toLowerCase() === "bunker" &&
                String(
                    f?.status ??
                    "intact"
                ).toLowerCase() !== "destroyed"
        );
    }


    // ========================================================
    // 主移动成本函数
    // ========================================================

    cost(
        unit,
        q,
        r
    ) {

        const terrain =
            this.world?.terrainAt?.(
                q,
                r
            ) ??
            "plain";


        const unitClass =
            this.classOf(unit);


        // ====================================================
        // 0. 碉堡阻塞
        // ====================================================

        if (
            this.isBlockingBunker(
                q,
                r
            )
        ) {
            return Infinity;
        }


        const rules =
            this.world?.waterRules ??
            this.world?.config?.waterRules ??
            this.world?.config?.movementRules ??
            null;


        // ====================================================
        // 1. 舰艇
        // ====================================================

        if (
            unitClass === "naval"
        ) {

            if (
                terrain === "water"
            ) {
                return 1;
            }

            return Infinity;
        }


        // ====================================================
        // 2. 水域
        // ====================================================

        if (
            terrain === "water"
        ) {

            return this.waterCost(
                unit,
                q,
                r
            );
        }


        // ====================================================
        // 3. 湿地
        // ====================================================

        if (
            terrain === "marsh" ||
            terrain === "wetland"
        ) {

            return this.wetlandCost(
                unit,
                rules
            );
        }


        // ====================================================
        // 4. 租界
        // ====================================================

        if (
            terrain === "concession"
        ) {

            const side =
                String(
                    unit?.faction ??
                    unit?.side ??
                    ""
                ).toLowerCase();


            if (
                side === "japanese"
            ) {
                return Infinity;
            }


            return 1;
        }


        // ====================================================
        // 5. 道路 / 铁路
        //
        // water 已经在上方处理，
        // 所以道路不会自动变成桥。
        // ====================================================

        const road =
            this.isRoadHex(
                q,
                r
            );


        const railway =
            this.isRailwayHex(
                q,
                r
            );


        if (
            road ||
            railway
        ) {

            return this.roadCost(
                unitClass,
                terrain
            );
        }


        // ====================================================
        // 6. 普通地形移动表
        // ====================================================

        const table = {

            // ------------------------------------------------
            // 平原
            // ------------------------------------------------

            plain: {

                infantry: 1,

                engineer: 1,

                artillery: 2,

                cavalry: 1,

                tank: 1,

                tracked: 1,

                wheeled: 1
            },


            // ------------------------------------------------
            // 丘陵
            // ------------------------------------------------

            hill: {

                infantry: 2,

                engineer: 2,

                artillery: 3,

                cavalry: 2,

                tank: 3,

                tracked: 2,

                wheeled: 3
            },


            // ------------------------------------------------
            // 森林
            //
            // 关键修复：
            // ZTZ-99A 不再被 Infinity 完全锁死。
            // ------------------------------------------------

            forest: {

                infantry: 2,

                engineer: 2,

                artillery: 3,

                cavalry: 3,

                // 主战坦克可进入，
                // 但移动效率明显下降。
                tank: 3,

                // 履带步战车森林机动优于坦克
                tracked: 2,

                // 轮式车辆受到更大限制
                wheeled: 4
            },


            // ------------------------------------------------
            // 山地
            // ------------------------------------------------

            mountain: {

                infantry: 3,

                engineer: 3,

                artillery: 4,

                cavalry: 4,

                // 坦克可以通过一般山地，
                // 但代价很高。
                tank: 4,

                tracked: 3,

                // 轮式车辆原则上禁止离路穿越山地。
                wheeled: Infinity
            },


            // ------------------------------------------------
            // 极陡山区
            // ------------------------------------------------

            steepMountain: {

                infantry: 4,

                engineer: 4,

                artillery:
                    Infinity,

                cavalry:
                    Infinity,

                tank:
                    Infinity,

                tracked:
                    Infinity,

                wheeled:
                    Infinity
            },


            // ------------------------------------------------
            // 城市
            // ------------------------------------------------

            urban: {

                infantry: 1,

                engineer: 1,

                artillery: 2,

                cavalry: 2,

                tank: 2,

                tracked: 1,

                wheeled: 1
            },


            // ------------------------------------------------
            // 城镇
            // ------------------------------------------------

            town: {

                infantry: 1,

                engineer: 1,

                artillery: 2,

                cavalry: 1,

                tank: 1,

                tracked: 1,

                wheeled: 1
            },


            // ------------------------------------------------
            // 农田
            // ------------------------------------------------

            farmland: {

                infantry: 1,

                engineer: 1,

                artillery: 2,

                cavalry: 1,

                tank: 1,

                tracked: 1,

                wheeled: 1
            },


            // ------------------------------------------------
            // 沙漠
            // ------------------------------------------------

            desert: {

                infantry: 2,

                engineer: 2,

                artillery: 2,

                cavalry: 2,

                tank: 1,

                tracked: 1,

                wheeled: 1
            }
        };


        // ====================================================
        // 7. 返回移动成本
        // ====================================================

        const terrainTable =
            table[terrain];


        /*
         * 未知地形继续保持兼容：
         * 不因为新 scenario 出现一个新 terrain 名称
         * 就让整个移动系统失效。
         */

        if (!terrainTable) {
            return 1;
        }


        const movementCost =
            terrainTable[unitClass];


        if (
            movementCost === Infinity
        ) {
            return Infinity;
        }


        if (
            Number.isFinite(
                Number(movementCost)
            )
        ) {
            return Number(
                movementCost
            );
        }


        return 1;
    }
}
