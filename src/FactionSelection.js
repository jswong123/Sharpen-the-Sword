import { FactionSystem } from "./systems/FactionSystem.js";

export class FactionSelection {
    constructor(gameState) {
        this.gameState = gameState;
        this.overlay = null;
        this.currentScenario = null;
        this.isModernExercise = false;
    }

    show(onStart = null, options = {}) {
        this.close();

        const scenario = options.scenario ?? {};
        const config = options.config ?? {};

        this.currentScenario = scenario;

        /*
         * =========================================================
         * 现代红蓝对抗识别
         * =========================================================
         *
         * 底层仍然保留：
         * CHN = 红方
         * JPN = 蓝方
         *
         * 这样不会破坏现有：
         * - AI
         * - Movement
         * - ZOC
         * - Combat
         * - Victory
         * - Casualty
         * - Save
         * 等依赖 CHN/JPN 的系统。
         */
        const scenarioId = String(
            scenario.id ??
            scenario.scenarioId ??
            scenario.key ??
            config.id ??
            ""
        ).toLowerCase();

        const scenarioName = String(
            config.name ??
            scenario.name ??
            scenario.scenario ??
            ""
        );

        this.isModernExercise =
            scenarioId.includes("lijian26") ||
            scenarioId.includes("lijian-26") ||
            scenarioName.includes("砺剑-26") ||
            scenarioName.includes("合成旅红蓝对抗");

        /*
         * 现代演习强制使用 CHN / JPN 两个底层阵营。
         * 历史战役继续读取原来的 faction 配置。
         */
        const factionIds = this.isModernExercise
            ? ["CHN", "JPN"]
            : (config.factions ?? Object.keys(this.gameState?.factions ?? {}));

        const title = config.name ??
            scenario.name ??
            scenario.scenario ??
            "选择阵营";

        const dateText = this.isModernExercise
            ? "现代 · 虚构训练对抗"
            : (config.dateText ?? scenario.date ?? "");

        const cards = factionIds
            .map(id => this.createFactionCard(id))
            .join("");

        this.overlay = document.createElement("div");

        Object.assign(this.overlay.style, {
            position: "fixed",
            inset: "0",
            background: "rgba(25,29,24,.96)",
            zIndex: "9999",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "FangSong,仿宋,SimSun,serif"
        });

        const panel = document.createElement("div");

        Object.assign(panel.style, {
            width: "820px",
            maxWidth: "92vw",
            color: "#e8e2c8",
            textAlign: "center"
        });

        panel.innerHTML = `
            <div style="font-size:40px;margin-bottom:8px;">
                ${title}
            </div>

            <div style="font-size:18px;opacity:.7;margin-bottom:32px;">
                ${dateText} · ${this.isModernExercise ? "选择参演阵营" : "选择参战阵营"}
            </div>

            <div style="
                display:flex;
                gap:20px;
                justify-content:center;
                flex-wrap:wrap;
            ">
                ${cards}
            </div>

            <div style="
                display:flex;
                gap:12px;
                justify-content:center;
                margin-top:28px;
            ">
                <button
                    id="observerButton"
                    type="button"
                    style="
                        padding:10px 24px;
                        background:transparent;
                        color:#c9c4ae;
                        border:1px solid #777565;
                        cursor:pointer;
                        font-family:inherit;
                        font-size:15px;
                    "
                >
                    观察员模式
                </button>

                <button
                    id="developerButton"
                    type="button"
                    style="
                        padding:10px 24px;
                        background:#8d7b4e;
                        color:#fff8dc;
                        border:1px solid #c8b98b;
                        cursor:pointer;
                        font-family:inherit;
                        font-size:15px;
                        font-weight:700;
                    "
                >
                    开发者模式
                </button>
            </div>
        `;

        this.overlay.appendChild(panel);
        document.body.appendChild(this.overlay);

        /*
         * =========================================================
         * 玩家选择阵营
         * =========================================================
         */

        panel.querySelectorAll("[data-faction]").forEach(button => {
            button.addEventListener("click", () => {

                const faction = button.dataset.faction;

                /*
                 * 注意：
                 *
                 * 现代模式仍然传：
                 * CHN / JPN
                 *
                 * 而不是 RED / BLUE。
                 *
                 * 这是为了兼容现有游戏系统。
                 */
                this.gameState.setPlayerFaction(faction);

                this.close();

                if (typeof onStart === "function") {
                    onStart(faction);
                }
            });
        });

        /*
         * =========================================================
         * 观察员
         * =========================================================
         */

        panel.querySelector("#observerButton")
            ?.addEventListener("click", () => {

                this.gameState.setObserverMode();
                this.close();

                if (typeof onStart === "function") {
                    onStart("OBSERVER");
                }
            });

        /*
         * =========================================================
         * 开发者模式
         * =========================================================
         */

        panel.querySelector("#developerButton")
            ?.addEventListener("click", () => {

                // 前端访问门禁，不等同于服务器安全认证。
                const key = window.prompt(
                    "请输入开发者模式密钥：",
                    ""
                );

                if (key === null) return;

                if (key !== "123456wrx") {
                    window.alert(
                        "开发者密钥错误，无法进入开发者模式。"
                    );
                    return;
                }

                this.gameState.setDeveloperMode();
                this.close();

                if (typeof onStart === "function") {
                    onStart("DEVELOPER");
                }
            });
    }

    /*
     * =============================================================
     * 创建阵营卡片
     * =============================================================
     */

    createFactionCard(id) {

        const faction = FactionSystem.getFaction(id);

        /*
         * ---------------------------------------------------------
         * 现代演习显示层
         * ---------------------------------------------------------
         *
         * CHN -> 红方
         * JPN -> 蓝方
         *
         * 只改变显示名称。
         * data-faction 仍然保存 CHN / JPN。
         */

        let title;
        let fullName;
        let description;
        let actionText;
        let accent;

        if (this.isModernExercise) {

            if (id === "CHN") {

                title = "红方";
                fullName = "红方合成旅";

                description =
                    "以红方身份参加本次合成旅对抗演习";

                actionText = "选择红方";

                accent = "#9b5549";

            } else if (id === "JPN") {

                title = "蓝方";
                fullName = "蓝方合成旅";

                description =
                    "以蓝方身份参加本次合成旅对抗演习";

                actionText = "选择蓝方";

                accent = "#586f83";

            } else {

                title = faction?.name ?? id;
                fullName = faction?.fullName ?? title;

                description =
                    `以${title}身份进入本战役`;

                actionText = "选择阵营";

                accent = "#777565";
            }

        } else {

            /*
             * -----------------------------------------------------
             * 历史战役保持原逻辑
             * -----------------------------------------------------
             */

            title = faction?.name ?? id;

            fullName =
                faction?.fullName ??
                title;

            description =
                `以${title}身份进入本战役`;

            actionText =
                "选择阵营";

            accent = {
                GER: "#8495a5",
                USSR: "#b75d58",
                CHN: "#647a55",
                JPN: "#a86b55",
                GBR: "#8a8065",
                ITA: "#7d8065",
                USA: "#65788a",
                ROK_GOV: "#667f96",
                NEWMIL: "#b65b55"
            }[id] ?? "#777565";
        }

        return `
            <button
                type="button"
                data-faction="${id}"
                style="
                    width:300px;
                    min-height:210px;
                    padding:28px;
                    background:#ded8bd;
                    border:3px solid ${accent};
                    cursor:pointer;
                    color:#292b25;
                    font-family:inherit;
                "
            >

                <div style="
                    font-size:30px;
                    margin-bottom:20px;
                ">
                    ${title}
                </div>

                <div style="
                    font-size:18px;
                    margin-bottom:16px;
                ">
                    ${fullName}
                </div>

                <div style="
                    font-size:14px;
                    line-height:1.7;
                    opacity:.75;
                ">
                    ${description}
                </div>

                <div style="
                    margin-top:25px;
                    font-size:16px;
                ">
                    ${actionText}
                </div>

            </button>
        `;
    }

    /*
     * =============================================================
     * 关闭选择界面
     * =============================================================
     */

    close() {

        if (this.overlay?.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }

        this.overlay = null;
    }
}
