// 简单的 PoolManager，用来注册并渲染不同卡池模块
window.PoolManager = (function () {
    const pools = [];
    const root = document.getElementById('pools');

    function register(pool) {
        pools.push(pool);
        renderPool(pool);
    }

    function renderPool(cfg) {
        const card = document.createElement('div');
        card.className = 'pool-card';
        card.innerHTML = `
         <div class="pool-hero" style="position:relative;">
            <div class="guarantee-badge" id="guarantee-${cfg.id}" style="display:none;position:absolute;right:12px;top:12px;padding:6px 8px;border-radius:6px;z-index:3;font-weight:600;font-size:13px;"></div>
             <img src="${cfg.hero || 'pools/' + cfg.id + '/hero.svg'}" alt="${cfg.name}">
             <div class="pool-info-overlay" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,0.65);color:#fff;z-index:2;align-items:center;justify-content:center;font-size:15px;padding:18px;text-align:left;"></div>
         </div>
        <div class="pool-body">
            <div>
                <div style="font-weight:600">${cfg.name}</div>
                <div class="pill">单抽 ${cfg.costSingle} / 十连 ${cfg.costTen}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <div class="pill" id="remain-${cfg.id}"></div>
                    <div class="pill" id="pity-${cfg.id}"></div> <!-- 显示无4次数与当前4概率 -->
                    <div class="pill" id="warn-${cfg.id}" style="display:none;background:#ffecb3;color:#111;"></div> <!-- 预计X抽内3级+概率提示 -->
                </div>
            </div>
            <div class="pool-controls">
                <button class="btn" data-action="ten">十连</button>
                <button class="btn secondary" data-action="one">单抽</button>
                <button class="btn secondary" data-action="info">说明</button>
            </div>
        </div>`;

        root.appendChild(card);

        // 按钮事件
        const btnOne = card.querySelector('[data-action="one"]');
        const btnTen = card.querySelector('[data-action="ten"]');
        btnOne.addEventListener('click', () => openConfirm(cfg, 1));
        btnTen.addEventListener('click', () => openConfirm(cfg, 10));
        // 说明按钮：显示/隐藏说明区域
        const infoBtn = card.querySelector('[data-action="info"]');
        const infoOverlay = card.querySelector('.pool-info-overlay');
        infoBtn.addEventListener('click', () => {
            if (infoOverlay.style.display === 'none') {
                infoOverlay.innerHTML = `<div>${cfg.name}<br><br>${cfg.description || '暂无详细说明'}<br><br><span style='font-size:13px;opacity:0.7;'>点击说明按钮关闭</span></div>`;
                infoOverlay.style.display = 'flex';
            } else {
                infoOverlay.style.display = 'none';
            }
        });
        // 刷新卡池剩余次数和按钮状态
        setTimeout(updatePoolButtons, 100);
    }

    // 刷新所有卡池按钮禁用、剩余次数和窗体变灰
    function updatePoolButtons() {
        pools.forEach(cfg => {
            const s = getState();
            const pstate = (s.poolState || {})[cfg.id] || {};
            const card = Array.from(document.querySelectorAll('.pool-card')).find(c => c.innerHTML.includes(cfg.name));
            if (card) {
                const btnOne = card.querySelector('[data-action="one"]');
                const btnTen = card.querySelector('[data-action="ten"]');
                const remainEl = card.querySelector(`#remain-${cfg.id}`);
                const pityEl = card.querySelector(`#pity-${cfg.id}`);
                const badgeEl = card.querySelector(`#guarantee-${cfg.id}`);
                const warnEl = card.querySelector(`#warn-${cfg.id}`);
                let remain = cfg.maxDraws ? Math.max(0, cfg.maxDraws - (pstate.drawnCount || 0)) : '∞';
                remainEl.textContent = `剩余次数：${remain}`;
                // 十连不足10次禁用
                if (cfg.maxDraws && remain < 10) {
                    btnTen.disabled = true; btnTen.classList.add('disabled');
                } else {
                    btnTen.disabled = false; btnTen.classList.remove('disabled');
                }
                // 单抽不足1次禁用
                if (cfg.maxDraws && remain < 1) {
                    btnOne.disabled = true; btnOne.classList.add('disabled');
                } else {
                    btnOne.disabled = false; btnOne.classList.remove('disabled');
                }
                // 全部禁用且卡池灰化
                if (cfg.maxDraws && remain < 1) {
                    card.style.opacity = '0.5';
                } else {
                    card.style.opacity = '1';
                }

                // 显示连续无4级次数与当前4级概率（当有 pity 生效时）
                try {
                    // 使用 lastSeen 计算 since（避免只看最后一发导致漏判）
                    const main4code = cfg.main4code || 6;
                    const main3code = cfg.main3code || 5;
                    const pityStart = cfg.pityStart || 50;
                    const incr = (cfg.pityIncrementPerDraw || 0) / 100;
                    const drawn = (pstate.drawnCount || 0);
                    const since4 = (typeof pstate.last4Seen === 'number') ? (drawn - pstate.last4Seen) : drawn;
                    const since3 = (typeof pstate.last3Seen === 'number') ? (drawn - pstate.last3Seen) : drawn;
                     // 当 since4 为 0 时不显示 pity 信息
                     if (pityEl) {
                        if (since4 > 0) {
                            let pityText = `无4级次数：${since4}`;
                            if (since4 >= pityStart && incr > 0) {
                                const base = (cfg.probabilities || {})[main4code] || 0;
                                const extra = (since4 - pityStart + 1) * incr;
                                const current4Prob = Math.max(0, base + extra);
                                if (current4Prob > 0) {
                                    pityText += ` • 当前4级概率：${(current4Prob * 100).toFixed(2)}%`;
                                }
                            }
                            pityEl.style.display = 'inline-block';
                            pityEl.textContent = pityText;
                        } else {
                            pityEl.style.display = 'none';
                        }
                     }

                    // 如果卡池配置了“必出≥3级”的保底（兼容多种写法）
                    const guarantee3X = Number.isInteger(cfg.guaranteeAtLeast3Within) ? cfg.guaranteeAtLeast3Within
                         : Number.isInteger(cfg.guaranteeWithin) ? cfg.guaranteeWithin
                         : Number.isInteger(cfg.guarantee3Within) ? cfg.guarantee3Within
                         : (cfg.guaranteeAtLeast3Within === true || cfg.guarantee3 === true || cfg.guarantee3Within === true) ? 10 : null;
 
                     // 识别 4 级保底配置（21抽内必出4级等）
                     const guarantee4X = Number.isInteger(cfg.guaranteeAtLeast4Within) ? cfg.guaranteeAtLeast4Within
                         : Number.isInteger(cfg.guarantee4Within) ? cfg.guarantee4Within
                         : Number.isInteger(cfg.guarantee4) ? cfg.guarantee4
                         : (cfg.guaranteeAtLeast4Within === true || cfg.guarantee4 === true) ? 21 : null;
                        
                    // 剩余抽数 = X - drawsSinceLastHit（若 lastSeen 无值则视为从头计算）
                    const remaining3 = guarantee3X ? Math.max(0, guarantee3X - since3) : null;
                    const remaining4 = guarantee4X ? Math.max(0, guarantee4X - since4) : null;

                    // 判断是否在当前保底窗口内已命中（即：在最近 guaranteeX 抽内曾出现过对应等级）
                    const alreadyGot3 = !!(guarantee3X && typeof pstate.last3Seen === 'number' && (drawn - pstate.last3Seen) < guarantee3X);
                    const alreadyGot4 = !!(guarantee4X && typeof pstate.last4Seen === 'number' && (drawn - pstate.last4Seen) < guarantee4X);
 
                     // 在 badge（卡面右上）显示单条优先信息：优先 4 级保底，其次 3 级保底；如果已触发或剩余为0则不显示
                     if (badgeEl) {
                        if (guarantee4X && !alreadyGot4 && remaining4 > 0) {
                            badgeEl.style.display = 'block';
                            badgeEl.textContent = `${remaining4}次寻访内必出4级道具`;
                            badgeEl.style.background = '#fff3e0';
                            badgeEl.style.color = '#5a3200';
                        } else if (guarantee3X && !alreadyGot3 && remaining3 > 0) {
                            badgeEl.style.display = 'block';
                            badgeEl.textContent = `${remaining3}次寻访内必出3级以上道具`;
                            badgeEl.style.background = '#dff6e0';
                            badgeEl.style.color = '#0b3b12';
                        } else {
                            badgeEl.style.display = 'none';
                        }
                     }
                 } catch (e) { /* ignore display errors */ }
             }
         });
     }

    // 本地存储和累计消耗
    function getState() {
        try { return JSON.parse(localStorage.getItem('gacha_state') || '{}') } catch (e) { return {} }
    }
    function saveState(s) { localStorage.setItem('gacha_state', JSON.stringify(s)) }

    function addCost(n) {
        const s = getState(); s.totalCost = (s.totalCost || 0) + n; saveState(s); updateTopbar();
    }
    function updateTopbar() { const s = getState(); document.getElementById('total-cost').innerText = s.totalCost || 0 }

    function showInfo(cfg) {
        alert(cfg.name + "\n\n点击卡牌图标查看详情。\n特殊规则见配置文件。");
    }

    // 打开确认弹窗并执行抽卡动画
    function openConfirm(cfg, count) {
        const modalRoot = document.getElementById('modal-root');
        modalRoot.innerHTML = '';
        const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
        const modal = document.createElement('div'); modal.className = 'modal';
        modal.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:16px;"><div>从【${cfg.name}】抽取 ${count} 次</div><div class="skip" id="skip-btn">跳过</div></div>
            <div class="confirm" style="font-size:15px;padding:10px 0 0 0;"><div>确认消耗 ${count === 10 ? cfg.costTen : cfg.costSingle} 美分？</div><div style="margin-left:auto"><button class="btn" id="do-draw">抽卡</button> <button class="btn secondary" id="cancel">取消</button></div></div>
            <div class="cards" id="cards"></div>`;
        overlay.appendChild(modal); modalRoot.appendChild(overlay);

        const cancel = modal.querySelector('#cancel'); const doDraw = modal.querySelector('#do-draw');
        const skip = modal.querySelector('#skip-btn');
        cancel.onclick = () => { modalRoot.innerHTML = '' };
        skip.onclick = () => {
            overlay.dataset.skip = '1';
            // 立即翻开所有卡片
            const cardsEl = modal.querySelector('#cards');
            if (cardsEl) {
                Array.from(cardsEl.querySelectorAll('.card')).forEach(c => c.classList.add('flipped'));
            }
        };

        doDraw.onclick = async () => {
            // 先检查剩余可抽次数，避免扣钱却没有抽取到结果
            try {
                const s = getState(); const pstate = (s.poolState || {})[cfg.id] || {};
                const avail = cfg.maxDraws ? Math.max(0, cfg.maxDraws - (pstate.drawnCount || 0)) : Infinity;
                if (avail < count) {
                    alert('剩余抽取次数不足，无法完成本次操作。');
                    return;
                }
            } catch (e) { /* ignore */ }
            // 扣费
            const cost = count === 10 ? cfg.costTen : cfg.costSingle; addCost(cost);
            // 生成抽卡结果
            const results = drawMany(cfg, count);

            // 立即刷新卡池状态（last3Seen/last4Seen 已由 drawMany 更新）
            try { updatePoolButtons(); } catch (e) { /* ignore */ }

             // 自动复制 Lua 脚本（若开关开启）
             try {
                 const autoCopy = localStorage.getItem('auto_copy_isaac') === '1';
                 if (autoCopy) {
                     const script = buildIsaacScript(results, cost);
                     const ok = await copyToClipboard(script);
                     if (ok) {
                         showTempNotice('已复制 Lua 脚本到剪贴板');
                     } else {
                         showTempNotice('复制失败，请允许剪贴板权限');
                     }
                 }
             } catch (e) { console.warn('auto copy error', e); }
            // 关闭当前弹窗
            modalRoot.innerHTML = '';

            // 创建独立抽卡结果弹窗
            const resultOverlay = document.createElement('div'); resultOverlay.className = 'modal-overlay';
            const resultModal = document.createElement('div'); resultModal.className = 'modal';
            resultModal.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div>抽卡结果</div><div class="skip" id="skip-result">跳过</div></div>
            <div class="cards" id="result-cards"></div>`;
            resultOverlay.appendChild(resultModal); modalRoot.appendChild(resultOverlay);

            // 填充卡牌
            const cardsEl = resultModal.querySelector('#result-cards'); cardsEl.innerHTML = '';
            results.forEach(r => {
                const c = document.createElement('div'); c.className = 'card';
                const inner = document.createElement('div'); inner.className = 'card-inner';
                // 卡背用默认色，正面根据品质设置颜色
                let frontColor = '#fff';
                let border = '';
                switch (r.rank) {
                    case 6: frontColor = 'linear-gradient(135deg, #ffe066, #fffbe6)'; border = '2px solid #ffd700'; break;
                    case 5: frontColor = 'linear-gradient(135deg, #d6aaff, #f3e6ff)'; border = '2px solid #a020f0'; break;
                    case 4: frontColor = 'linear-gradient(135deg, #a6c8ff, #e6f0ff)'; border = '2px solid #4169e1'; break;
                    case 3: frontColor = 'linear-gradient(135deg, #b6e6b6, #e6ffe6)'; border = '2px solid #2ecc40'; break;
                    case 2: frontColor = 'linear-gradient(135deg, #e6e6e6, #f6f6f6)'; border = '2px solid #ccc'; break;
                    case 1: frontColor = 'linear-gradient(135deg, #999999, #f6f6f6)'; border = '2px solid #888'; break;
                }
                // inner.innerHTML = `
                // <div class="card-face card-back"></div>
                // <div class="card-face card-front" style="background:${frontColor};border:${border}">
                //     <img src="icon/${r.icon}" style="width:68px;height:68px;object-fit:cover">
                //     <div style="position:absolute;bottom:6px;font-size:12px">${r.name}</div>
                // </div>`;
                // 替换为以下动态构建（只替换此区域）
                const cardFront = document.createElement('div');
                cardFront.className = 'card-face card-front';
                cardFront.style.background = frontColor;
                cardFront.style.border = border;
                const iconEl = createIconElement(r.icon || 'placeholder.svg', 68, 'item-icon');
                cardFront.appendChild(iconEl);
                const nameDiv = document.createElement('div');
                nameDiv.style.position = 'absolute';
                nameDiv.style.bottom = '6px';
                nameDiv.style.fontSize = '12px';
                nameDiv.textContent = r.name;
                cardFront.appendChild(nameDiv);
                inner.appendChild(cardFront);
                c.appendChild(inner); cardsEl.appendChild(c);
            });

            // 根据最高品质设置 glow（品质越高颜色更亮）
            const highest = Math.max(...results.map(r => r.rank));
            const glow = document.createElement('div');
            glow.className = 'glow';
            glow.style.position = 'absolute';
            glow.style.inset = '0';
            glow.style.zIndex = '0';
            glow.style.pointerEvents = 'none';
            glow.style.borderRadius = '20px';
            glow.style.mixBlendMode = 'screen';
            glow.style.background = highest >= 6
                ? 'radial-gradient(circle at 50% 90%, rgba(255,220,120,0.75) 0%, rgba(255,220,120,0.32) 60%, transparent 100%)'
                : highest >= 5
                    ? 'radial-gradient(circle at 50% 90%, rgba(160,200,255,0.65) 0%, rgba(160,200,255,0.22) 60%, transparent 100%)'
                    : 'radial-gradient(circle at 50% 90%, rgba(255,255,255,0.22) 0%, transparent 100%)';
            // 插入到卡片区下方
            resultModal.insertBefore(glow, cardsEl);

            // 翻卡动画按序列，允许随时跳过
            const cardEls = Array.from(cardsEl.querySelectorAll('.card'));
            let skipFlag = false;
            const skipBtn = resultModal.querySelector('#skip-result');
            if (skipBtn) {
                skipBtn.onclick = () => {
                    resultOverlay.dataset.skip = '1';
                    skipFlag = true;
                    cardEls.forEach(c => c.classList.add('flipped'));
                };
            }
            for (let i = 0; i < cardEls.length; i++) {
                if (resultOverlay.dataset.skip === '1' || skipFlag) {
                    cardEls.forEach(c => c.classList.add('flipped'));
                    break;
                }
                await wait(200);
                cardEls[i].classList.add('flipped');
            }

            // 存储抽卡记录
            pushRecord(cfg, results);

            // 等待用户关闭
            await wait(300);
            resultOverlay.addEventListener('click', () => {
                modalRoot.innerHTML = '';
                updatePoolButtons(); // 抽完后刷新卡池状态
            }, { once: true });
            // skip按钮已提前处理
        };
    }

    // 辅助等待
    function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

    // 抽多次并更新 pool state
    function drawMany(cfg, n) {
        const s = getState(); s.pools = s.pools || {}; s.poolState = s.poolState || {}; s.records = s.records || [];
        const pstate = s.poolState[cfg.id] || { last4Seen: undefined, last3Seen: undefined, drawnCount: 0 };
        const out = [];
        // 等级映射：3级对应码（默认5），4级对应码（默认6）
        const main3code = cfg.main3code || 5;
        const main4code = cfg.main4code || 6;
        // 解析保底配置（与 UI 保持一致）
        const guarantee3X = Number.isInteger(cfg.guaranteeAtLeast3Within) ? cfg.guaranteeAtLeast3Within
            : Number.isInteger(cfg.guaranteeWithin) ? cfg.guaranteeWithin
                : Number.isInteger(cfg.guarantee3Within) ? cfg.guarantee3Within
                    : (cfg.guaranteeAtLeast3Within === true || cfg.guarantee3 === true || cfg.guarantee3Within === true) ? 10 : null;

        // 解析 4 级保底（优先级高）
        const guarantee4X = Number.isInteger(cfg.guaranteeAtLeast4Within) ? cfg.guaranteeAtLeast4Within
            : Number.isInteger(cfg.guarantee4Within) ? cfg.guarantee4Within
                : Number.isInteger(cfg.guarantee4) ? cfg.guarantee4
                    : (cfg.guaranteeAtLeast4Within === true || cfg.guarantee4 === true) ? 21 : null;
                
    for (let i = 0; i < n; i++) {
            // 处理最大抽取限制
            if (cfg.maxDraws && pstate.drawnCount >= cfg.maxDraws) {
                // 如果配置保证在 maxDraws 之内必定出4，则在最后抽取强制4
                if (cfg.guaranteeBeforeMax) {
                    // 强制抽取 4 级中的某一项
                    const item = pickItemFromTier(cfg, main4code, true);
                    out.push(item);
                    pstate.drawnCount++;
                    // 记录最后一次命中位置（以当前 total drawnCount 表示）
                    pstate.last4Seen = pstate.drawnCount;
                    continue;
                } else {
                    // 超出限制，不再抽
                    break;
                }
            }

            // 优先：若配置了前X抽必出4级且接近窗口末尾，强制本次出4级
            if (guarantee4X) {
                const drawn = pstate.drawnCount || 0;
                const since4 = (typeof pstate.last4Seen === 'number') ? (drawn - pstate.last4Seen) : drawn;
                if (since4 >= (guarantee4X - 1)) {
                    const forced4 = pickItemFromTier(cfg, main4code);
                    out.push(forced4);
                    // 更新计数
                    pstate.drawnCount++;
                    // 记录最后一次命中位置（以当前 total drawnCount 表示）
                    pstate.last4Seen = pstate.drawnCount;
                    pstate.had4 = true;
                    if ((forced4.rank || 0) >= main3code) pstate.last3Seen = pstate.drawnCount;
                    continue;
                }
            }

            // 若设置了前X抽必出>=3 的保底并且已接近窗口末尾，则强制本次出 >=3
            if (guarantee3X) {
                const drawnNow = pstate.drawnCount || 0;
                // 以 last3Seen 计算 since3，避免十连中途出的情况被漏判
                const since3 = (typeof pstate.last3Seen === 'number') ? (drawnNow - pstate.last3Seen) : drawnNow;
                if (since3 >= (guarantee3X - 1)) {
                    // 计算当前 4 级 概率（考虑 pity），保留该概率不变
                    const base = cfg.probabilities || { 6: 0.02, 5: 0.05, 4: 0.10, 3: 0.20, 2: 0.15, 1: 0.48 };
                    const pityStart = cfg.pityStart || 50;
                    const incr = (cfg.pityIncrementPerDraw || 0) / 100;
                    const since4 = (typeof pstate.last4Seen === 'number') ? (drawnNow - pstate.last4Seen) : drawnNow;
                    let p4 = Math.max(0, base[main4code] || 0);
                    if (since4 >= pityStart && incr > 0) {
                        p4 = Math.min(1, p4 + ((since4 - pityStart + 1) * incr));
                    }
                    // 按 p4 决定是否出 4；否则出 3（保证 >=3，同时保持 4 的概率不变）
                    const forced = (Math.random() < p4)
                        ? pickItemFromTier(cfg, main4code)
                        : pickItemFromTier(cfg, main3code);
                    out.push(forced);
                    // 更新 pstate 与相关计数
                    pstate.drawnCount++;
                    if (forced.rank === main4code) { pstate.last4Seen = pstate.drawnCount; pstate.had4 = true; }
                    if (forced.rank >= main3code) { pstate.last3Seen = pstate.drawnCount; }
                    continue;
                }
            }

            const r = singleDraw(cfg, pstate);
            out.push(r);
            pstate.drawnCount++;
            if (r.rank === main4code) {
                pstate.last4Seen = pstate.drawnCount;
                pstate.had4 = true;
            }
            if (r.rank >= main3code) {
                pstate.last3Seen = pstate.drawnCount;
            }
        }
        s.poolState[cfg.id] = pstate; saveState(s);
        return out;
    }

    // push record and render bottom list
    function pushRecord(cfg, results) {
        const s = getState(); s.records = s.records || [];
        const rec = { pool: cfg.name, time: new Date().toLocaleString(), results: results };
        s.records.unshift(rec); if (s.records.length > 200) s.records.length = 200; saveState(s);
        renderResults();
        // 抽完并保存记录后立即刷新卡池状态（更新 badge/warn）
        try { updatePoolButtons(); } catch (e) { /* ignore */ }
    }

    function renderResults() {
        const s = getState(); const wrap = document.getElementById('results'); wrap.innerHTML = '';
        (s.records || []).forEach(r => {
            r.results.forEach((item, idx) => {
                const el = document.createElement('div'); el.className = 'result-item';
                // const icon = document.createElement('img'); icon.src = 'icon/' + (item?.icon || 'placeholder.svg');
                // el.appendChild(icon);
                // 替换为：
                const iconEl = createIconElement(item?.icon || 'placeholder.svg', 36, 'result-icon');
                el.appendChild(iconEl);
                const txt = document.createElement('div'); txt.innerHTML = `<div style="font-weight:600">抽卡结果 - ${r.pool}</div><div style="font-size:12px;color:#9fbadb">${r.time}${r.results.length > 1 ? ` #${idx + 1}` : ''}</div>`;
                el.appendChild(txt); wrap.appendChild(el);
            });
        });
    }

    // 单次抽卡逻辑：返回 {id,name,icon,rank}
    function singleDraw(cfg, pstate) {
        // 基础概率（假定，若 cfg.probabilities 指定则使用）
        const base = cfg.probabilities || { 6: 0.02, 5: 0.05, 4: 0.10, 3: 0.20, 2: 0.15, 1: 0.48 };
        // 4级在代码中可能标注为 6（按示例）——我们统一处理：cfg.main4code (默认为6)
        const main4code = cfg.main4code || 6;

        // 计算保底影响
        let probs = Object.assign({}, base);
        const pityStart = cfg.pityStart || 50; const incr = (cfg.pityIncrementPerDraw || 0) / 100;
        // 使用 last4Seen（记录“最后一次出现4级时的全局抽数”）计算 since4，避免 pstate.since4 未同步问题
        const drawnTotal = (pstate.drawnCount || 0);
        const since4 = (typeof pstate.last4Seen === 'number') ? (drawnTotal - pstate.last4Seen) : drawnTotal;
        if (since4 >= pityStart) {
            const extra = (since4 - pityStart + 1) * incr;
            probs[main4code] = (probs[main4code] || 0) + extra;
            // 从其它等级扣除按比例（简单做法：从最低等级扣）
            const reduceFrom = Object.keys(probs).filter(k => k != main4code).sort();
            if (reduceFrom.length > 0) {
                const dec = extra / reduceFrom.length;
                reduceFrom.forEach(k => probs[k] = Math.max(0, (probs[k] || 0) - dec));
            }
        }

        // 抽出等级
        const tier = weightedPick(Object.entries(probs).map(([k, v]) => ({ key: parseInt(k), w: v }))) || { key: 1 };
        const rank = tier.key;

        // 在对应等级内抽取物品
        // 特殊规则：若该卡池开启 first4Unique 并且这是该池的首个4级，则尽量挑选一个全局未获得的4级
        if (rank === main4code && cfg.first4Unique && !(pstate && pstate.had4)) {
            const acquired = getGlobalAcquired4();
            const candidates = (cfg.items || []).filter(it => it.rank === main4code && !acquired.has(it.id));
            if (candidates.length > 0) {
                // 若有未获得的4级，从中随机或按权重选一个
                const total = candidates.reduce((s, i) => s + (i.weight || 0), 0);
                if (total <= 0) return candidates[Math.floor(Math.random() * candidates.length)];
                const picked = weightedPick(candidates.map(i => ({ key: i, w: i.weight }))); return picked.key;
            }
        }

        const item = pickItemFromTier(cfg, rank);
        return item;
    }

    // 从本地记录中读取已获得的4级 id 集合
    function getGlobalAcquired4() {
        const s = getState(); const set = new Set();
        const pools = (s.records || []);
        pools.forEach(rec => { rec.results && rec.results.forEach(it => { if (it && it.rank && it.rank >= 6) set.add(it.id); }) });
        return set;
    }

    // 从某个品质池中选择 item（若权重缺失则均等）
    function pickItemFromTier(cfg, rank, force) {
        // cfg.items should be array of {id,name,rank,icon,weight}
        const list = (cfg.items || []).filter(it => it.rank == rank);
        if (list.length === 0) {
            // fallback: pick from nearest lower/higher
            const fallback = (cfg.items || [])[Math.floor(Math.random() * (cfg.items || []).length)];
            return fallback || { id: 'none', name: '占位', icon: 'icon/placeholder.svg', rank: rank };
        }
        // 权重分配逻辑：weight字段为总概率，剩余概率均分给weight为空的道具
        const withWeight = list.filter(i => typeof i.weight === 'number');
        const noWeight = list.filter(i => typeof i.weight !== 'number');
        const totalWeight = withWeight.reduce((s, i) => s + i.weight, 0);
        let arr = [];
        if (noWeight.length > 0) {
            const remain = Math.max(0, 1 - totalWeight);
            const avg = remain / noWeight.length;
            arr = withWeight.map(i => ({ key: i, w: i.weight })).concat(noWeight.map(i => ({ key: i, w: avg })));
        } else {
            arr = list.map(i => ({ key: i, w: i.weight }));
        }
        // 若所有权重为0或均分后仍为0，则等概率
        const sum = arr.reduce((s, a) => s + (a.w || 0), 0);
        if (sum <= 0) {
            return list[Math.floor(Math.random() * list.length)];
        }
        const picked = weightedPick(arr); return picked.key;
    }

	// 从所有 rank >= minRank 的道具中按权重选一个：先按等级概率选择 rank，再在该 rank 内选择 item
	function pickItemAtLeastRank(cfg, minRank) {
		const probs = cfg.probabilities || { 6: 0.02, 5: 0.05, 4: 0.10, 3: 0.20, 2: 0.15, 1: 0.48 };
		const ranks = Object.keys(probs).map(k => parseInt(k)).filter(r => r >= minRank);
		if (ranks.length === 0) {
			const list = (cfg.items || []).filter(it => (it.rank || 0) >= minRank);
			if (list.length === 0) return (cfg.items || [])[Math.floor(Math.random() * (cfg.items || []).length)] || { id: 'none', name: '占位', icon: 'icon/placeholder.svg', rank: minRank };
			return list[Math.floor(Math.random() * list.length)];
		}
		const rankArr = ranks.map(r => ({ key: r, w: Math.max(0, probs[r] || 0) }));
		const sumRankW = rankArr.reduce((s, a) => s + (a.w || 0), 0);
		let chosenRank;
		if (sumRankW <= 0) {
			chosenRank = ranks[Math.floor(Math.random() * ranks.length)];
		} else {
			const picked = weightedPick(rankArr);
			chosenRank = picked.key;
		}
		return pickItemFromTier(cfg, chosenRank);
	}

    // 加权选择工具：输入 [{key:..., w:...}] 返回选中对象
    function weightedPick(arr) {
        const sum = arr.reduce((s, a) => s + (a.w || 0), 0);
        if (sum === 0) { // equal chance
            return arr[Math.floor(Math.random() * arr.length)];
        }
        let r = Math.random() * sum; for (const a of arr) { r -= (a.w || 0); if (r <= 0) return a; }
        return arr[arr.length - 1];
    }

    // 新：加载 manifest 并预加载 atlas 图片
    let __atlasManifest = null;
    async function loadAtlasManifest(manifestPath = 'assets/atlas/manifest.json') {
        try {
            const res = await fetch(manifestPath, { cache: 'no-cache' });
            if (!res.ok) { __atlasManifest = null; return; }
            __atlasManifest = await res.json();
            // ensure basePath exists (manifest.basePath may be relative)
            __atlasManifest.basePath = __atlasManifest.basePath || manifestPath.replace(/\/manifest\.json$/, '');
            // normalize path (remove trailing slash if any)
            __atlasManifest.basePath = __atlasManifest.basePath.replace(/\/$/, '');
            // atlasSize fallback
            __atlasManifest.atlasSize = __atlasManifest.atlasSize || (__atlasManifest.atlasSize === 0 ? 0 : null);
            // 预加载所有不同的 atlas 文件 to warm browser cache
            const atlasFiles = new Set(Object.values(__atlasManifest.map || {}).map(m => m.atlas));
            atlasFiles.forEach(fname => {
                const img = new Image();
                img.src = `${__atlasManifest.basePath}/${fname}`;
            });
        } catch (e) {
            __atlasManifest = null;
        }
    }

    // 创建图标元素：优先用 atlas（背景图 + background-position），否则回退到 <img src="icon/...">
    function createIconElement(filename, size = 68, className = 'item-icon') {
        const useAtlas = !!(__atlasManifest && __atlasManifest.map && __atlasManifest.map[filename]);
        const el = document.createElement(useAtlas ? 'div' : 'img');
        if (useAtlas) {
            const meta = __atlasManifest.map[filename];
            const atlasUrl = `${__atlasManifest.basePath}/${meta.atlas}`;
            el.className = className;
            el.style.width = (meta.w || size) + 'px';
            el.style.height = (meta.h || size) + 'px';
            el.style.backgroundImage = `url("${atlasUrl}")`;
            el.style.backgroundPosition = `-${meta.x}px -${meta.y}px`;
            // 将 atlasSize 作为 background-size（确保定位与像素不被拉伸）
            if (__atlasManifest.atlasSize) {
                el.style.backgroundSize = `${__atlasManifest.atlasSize}px ${__atlasManifest.atlasSize}px`;
            } else {
                el.style.backgroundSize = 'auto';
            }
        } else {
            // img fallback
            el.src = 'icon/' + (filename || 'placeholder.svg');
            el.width = size; el.height = size;
            el.className = className;
            el.style.objectFit = 'cover';
        }
        return el;
    }

    // 初始化：先加载 atlas manifest，再执行其余初始化（确保图标使用 atlas 而非回退单图）
    async function init() {
        // 尝试加载 manifest；若不存在也继续（回退到单图）
        try { await loadAtlasManifest('assets/atlas/manifest.json'); } catch (e) { /* ignore */ }

        updateTopbar();
        renderResults();
        // 自动复制开关初始化
        try {
            const toggle = document.getElementById('auto-copy-toggle');
            const stored = localStorage.getItem('auto_copy_isaac') === '1';
            if (toggle) {
                toggle.checked = stored; toggle.addEventListener('change', () => {
                    localStorage.setItem('auto_copy_isaac', toggle.checked ? '1' : '0');
                });
            }
        } catch (e) { /* ignore */ }
        const clearBtn = document.getElementById('clear-records');
        if (clearBtn) {
            clearBtn.onclick = function () {
                if (confirm('确定要清空所有抽卡记录和累计消耗吗？此操作不可恢复。')) {
                    localStorage.removeItem('gacha_state');
                    updateTopbar();
                    renderResults();
                    // 刷新卡池状态与 UI（剩余次数、保底标识等）
                    updatePoolButtons();
                }
            };
        }
    }

    // 复制到剪贴板（优先使用 navigator.clipboard）
    function copyToClipboard(text) {
        if (!text) return Promise.resolve(false);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
        }
        return new Promise((resolve) => {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                resolve(true);
            } catch (e) { resolve(false); }
        });
    }

    // 根据抽卡结果构建 Lua 脚本（清理并尽量生成合理的数字 id 列表）
    function buildIsaacScript(results, cost) {
        // results: array of items with id/name/rank
        const ids = (results || []).map(it => {
            const n = Number(it && it.id);
            return (Number.isFinite(n) ? n : 0);
        });
        const listStr = ids.join(', ');
        // 生成更规范的 Lua 脚本
        const script = [
            'l local p = Isaac.GetPlayer()',
            `local m = ${Number(cost || 0)}`,
            `local list = { ${listStr} }`,
            'if p:GetNumCoins() < m then print("Not enough money") return end',
            'p:AddCoins(-m)',
            'for _, v in ipairs(list) do',
            'Isaac.Spawn(5, v > 0 and 100 or -v, v > 0 and v or 0, Isaac.GetFreeNearPosition(p.Position, 40), Vector(0,0), nil)',
            'end'
        ].join(' ');
        return script;
    }

    // 短时提示（顶部居中，自动消失）
    function showTempNotice(msg, ms = 1500) {
        try {
            const id = 'gacha-temp-notice';
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement('div');
                el.id = id;
                el.style.position = 'fixed';
                el.style.left = '50%';
                el.style.top = '60px';
                el.style.transform = 'translateX(-50%)';
                el.style.padding = '8px 14px';
                el.style.background = 'rgba(0,0,0,0.7)';
                el.style.color = '#fff';
                el.style.borderRadius = '8px';
                el.style.zIndex = 3000;
                el.style.fontSize = '13px';
                document.body.appendChild(el);
            }
            el.textContent = msg;
            el.style.opacity = '1';
            clearTimeout(el._hideTimer);
            el._hideTimer = setTimeout(() => {
                el.style.opacity = '0';
            }, ms);
        } catch (e) { /* ignore */ }
    }

    return { register, init };
})();

// 启动（等待异步 init 完成以避免 race 导致回退加载单图）
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.PoolManager.init();
    } catch (e) {
        console.warn('PoolManager.init error', e);
        // 尽量让页面继续工作，即便 atlas 加载/解析异常
    }
});
