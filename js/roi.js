/**
 * ROI 盈亏平衡计算器 - 计算逻辑
 */

(function () {
    'use strict';

    // ========== State ==========
    const modes = {
        roiGoodsCost: 'abs',
        roiShippingCost: 'abs',
        roiPlatformFee: 'pct',
    };

    // ========== DOM Refs ==========
    const $ = (id) => document.getElementById(id);

    const inputs = {
        roiPrice: $('roiPrice'),
        roiGoodsCost: $('roiGoodsCost'),
        roiShippingCost: $('roiShippingCost'),
        roiPlatformFee: $('roiPlatformFee'),
        roiReturnRate: $('roiReturnRate'),
        salary: $('salary'),
        rent: $('rent'),
        otherFixed: $('otherFixed'),
        monthlySales: $('monthlySales'),
    };

    // ========== Load data from Page 1 ==========
    function loadFromPage1() {
        try {
            const saved = JSON.parse(localStorage.getItem('profitCalc_data'));
            if (saved) {
                if (saved.price) inputs.roiPrice.value = saved.price;
                if (saved.goodsCost) inputs.roiGoodsCost.value = saved.goodsCost;
                if (saved.shippingCost) inputs.roiShippingCost.value = saved.shippingCost;
                if (saved.platformFee) inputs.roiPlatformFee.value = saved.platformFee;
                if (saved.returnRate) inputs.roiReturnRate.value = saved.returnRate;
                // Note: Page1 saves resolved absolute values, so set modes to abs for loaded data
                modes.roiGoodsCost = 'abs';
                modes.roiShippingCost = 'abs';
                modes.roiPlatformFee = 'abs';
                // Update toggle buttons
                updateToggleUI('roiGoodsCost', 'abs');
                updateToggleUI('roiShippingCost', 'abs');
                updateToggleUI('roiPlatformFee', 'abs');
            }
        } catch (e) {
            // Silently fail
        }
    }

    function updateToggleUI(target, mode) {
        const toggleBtns = document.querySelectorAll(`.mode-toggle button[data-target="${target}"]`);
        toggleBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        const prefix = document.querySelector(`.dynamic-prefix[data-for="${target}"]`);
        if (prefix) {
            prefix.textContent = mode === 'abs' ? '¥' : '%';
        }
    }

    // ========== Mode Toggle ==========
    document.querySelectorAll('.mode-toggle button').forEach((btn) => {
        btn.addEventListener('click', function () {
            const target = this.dataset.target;
            const mode = this.dataset.mode;
            modes[target] = mode;

            const parent = this.closest('.mode-toggle');
            parent.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
            this.classList.add('active');

            const prefix = document.querySelector(`.dynamic-prefix[data-for="${target}"]`);
            if (prefix) {
                prefix.textContent = mode === 'abs' ? '¥' : '%';
            }

            calculate();
        });
    });

    // ========== Calculation ==========
    function getVal(id) {
        return parseFloat(inputs[id].value) || 0;
    }

    function resolveAmount(id, price) {
        const raw = getVal(id);
        if (modes[id] === 'pct') {
            return (raw / 100) * price;
        }
        return raw;
    }

    function calculate() {
        const price = getVal('roiPrice');
        const monthlySales = getVal('monthlySales');

        if (price <= 0 || monthlySales <= 0) {
            showEmptyState();
            return;
        }

        // Resolve costs
        const goodsCost = resolveAmount('roiGoodsCost', price);
        const shippingCost = resolveAmount('roiShippingCost', price);
        const platformFee = resolveAmount('roiPlatformFee', price);
        const returnRate = getVal('roiReturnRate');

        // Return loss
        const returnLoss = (returnRate / 100) * (goodsCost + shippingCost);

        // Non-ad variable cost per unit
        const nonAdCost = goodsCost + shippingCost + platformFee + returnLoss;

        // Fixed costs
        const salary = getVal('salary');
        const rent = getVal('rent');
        const otherFixed = getVal('otherFixed');
        const totalFixed = salary + rent + otherFixed;
        const fixedPerUnit = totalFixed / monthlySales;

        // Total non-ad cost per unit
        const totalNonAdPerUnit = nonAdCost + fixedPerUnit;

        // Available ad budget per unit
        const adBudget = price - totalNonAdPerUnit;

        // ROI break-even point
        // ROI = Sales / Ad Spend = price / adSpendPerUnit
        // At break-even: adSpendPerUnit = adBudget (all remaining margin goes to ad)
        // So: ROI_breakeven = price / adBudget
        let roiBreakeven = adBudget > 0 ? price / adBudget : Infinity;

        // Update results
        updateResults(nonAdCost, fixedPerUnit, totalNonAdPerUnit, adBudget, roiBreakeven);

        // Update process
        updateProcess(price, goodsCost, shippingCost, platformFee, returnRate, returnLoss,
            nonAdCost, salary, rent, otherFixed, totalFixed, monthlySales, fixedPerUnit,
            totalNonAdPerUnit, adBudget, roiBreakeven);

        // Draw sensitivity chart (skip if no ad budget)
        if (adBudget > 0 && isFinite(roiBreakeven)) {
            drawSensitivityChart(price, totalNonAdPerUnit, roiBreakeven);
        } else {
            clearSensitivityChart();
        }
    }

    function updateResults(nonAdCost, fixedPerUnit, totalNonAdPerUnit, adBudget, roiBreakeven) {
        $('resultNonAdCost').textContent = `¥${nonAdCost.toFixed(2)}`;
        $('resultFixedPerUnit').textContent = `¥${fixedPerUnit.toFixed(2)}`;
        $('resultTotalNonAd').textContent = `¥${totalNonAdPerUnit.toFixed(2)}`;
        $('resultAdBudget').textContent = `¥${adBudget.toFixed(2)}`;
        $('resultAdBudget').style.color = adBudget >= 0 ? 'var(--accent-blue)' : 'var(--accent-red)';

        const badge = $('roiBadge');
        const interp = $('roiInterpretation');

        if (adBudget <= 0) {
            badge.textContent = '⚠️ 无法盈利';
            badge.className = 'roi-badge warning';
            interp.textContent = '即使不投广告也已亏损，请优化成本结构';
        } else {
            badge.textContent = `ROI ≥ ${roiBreakeven.toFixed(2)}`;
            badge.className = 'roi-badge good';
            interp.textContent = `广告投放 ROI 达到 ${roiBreakeven.toFixed(2)} 以上才能盈利。即每花 1 元广告费，需带来 ¥${roiBreakeven.toFixed(2)} 销售额。`;
        }
    }

    function formatCostInfo(id, price) {
        const raw = getVal(id);
        if (raw === 0) return '¥0.00';
        if (modes[id] === 'pct') {
            const abs = (raw / 100) * price;
            return `${raw}% × ¥${price.toFixed(2)} = ¥${abs.toFixed(2)}`;
        }
        return `¥${raw.toFixed(2)}`;
    }

    function updateProcess(price, goodsCost, shippingCost, platformFee, returnRate, returnLoss,
        nonAdCost, salary, rent, otherFixed, totalFixed, monthlySales, fixedPerUnit,
        totalNonAdPerUnit, adBudget, roiBreakeven) {

        const container = $('roiCalcProcess');
        let html = '';

        // Step 1
        html += `<div class="step-title">① 单件非广告成本</div>`;
        html += `<div class="formula">商品成本：${formatCostInfo('roiGoodsCost', price)}</div>`;
        html += `<div class="formula">快递成本：${formatCostInfo('roiShippingCost', price)}</div>`;
        html += `<div class="formula">平台扣点：${formatCostInfo('roiPlatformFee', price)}</div>`;
        if (returnRate > 0) {
            html += `<div class="formula">退货损失：${returnRate}% × (¥${goodsCost.toFixed(2)} + ¥${shippingCost.toFixed(2)}) = ¥${returnLoss.toFixed(2)}</div>`;
        }
        html += `<div class="formula">合计 = ¥${goodsCost.toFixed(2)} + ¥${shippingCost.toFixed(2)} + ¥${platformFee.toFixed(2)} + ¥${returnLoss.toFixed(2)}</div>`;
        html += `<div class="formula formula-result">= ¥${nonAdCost.toFixed(2)}</div>`;

        // Step 2
        html += `<div class="step-title">② 单件分摊固定成本</div>`;
        html += `<div class="formula">月固定 = ¥${salary.toFixed(0)}(工资) + ¥${rent.toFixed(0)}(房租) + ¥${otherFixed.toFixed(0)}(其他)</div>`;
        html += `<div class="formula">= ¥${totalFixed.toFixed(2)}</div>`;
        html += `<div class="formula">单件分摊 = ¥${totalFixed.toFixed(2)} / ${monthlySales}件</div>`;
        html += `<div class="formula formula-result">= ¥${fixedPerUnit.toFixed(2)}</div>`;

        // Step 3
        html += `<div class="step-title">③ 单件总成本（不含广告）</div>`;
        html += `<div class="formula">= ¥${nonAdCost.toFixed(2)} + ¥${fixedPerUnit.toFixed(2)}</div>`;
        html += `<div class="formula formula-result">= ¥${totalNonAdPerUnit.toFixed(2)}</div>`;

        // Step 4
        html += `<div class="step-title">④ 单件可用广告预算</div>`;
        html += `<div class="formula">= ¥${price.toFixed(2)}（售价）- ¥${totalNonAdPerUnit.toFixed(2)}（非广告成本）</div>`;
        html += `<div class="formula formula-result">= ¥${adBudget.toFixed(2)}</div>`;

        html += `<hr class="divider">`;

        // Step 5
        html += `<div class="step-title">⑤ ROI 盈亏平衡点</div>`;
        html += `<div class="formula">ROI = 售价 / 可用广告预算</div>`;
        if (adBudget > 0) {
            html += `<div class="formula">= ¥${price.toFixed(2)} / ¥${adBudget.toFixed(2)}</div>`;
            html += `<div class="formula formula-result">= ${roiBreakeven.toFixed(2)}</div>`;
            html += `<div class="formula" style="color: var(--accent-green); margin-top: 4px;">💡 投放 ROI ≥ ${roiBreakeven.toFixed(2)} 时盈利</div>`;
        } else {
            html += `<div class="formula formula-result" style="color: var(--accent-red);">⚠️ 可用广告预算为负，无法通过投放盈利</div>`;
        }

        container.innerHTML = html;
    }

    function showEmptyState() {
        $('resultNonAdCost').textContent = '¥0.00';
        $('resultFixedPerUnit').textContent = '¥0.00';
        $('resultTotalNonAd').textContent = '¥0.00';
        $('resultAdBudget').textContent = '¥0.00';
        $('roiBadge').textContent = 'ROI ≥ --';
        $('roiBadge').className = 'roi-badge good';
        $('roiInterpretation').textContent = '输入数据后自动计算盈亏平衡 ROI';
        $('roiCalcProcess').innerHTML = '<p style="color: var(--text-tertiary); text-align: center; font-family: -apple-system, sans-serif;">填写数据后点击「计算 ROI」</p>';
        clearSensitivityChart();
    }

    // ========== Sensitivity Chart ==========
    function drawSensitivityChart(price, totalNonAdPerUnit, roiBreakeven) {
        const canvas = $('sensitivityChart');
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.parentElement.clientWidth;
        const h = 200;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        // Config
        const padding = { top: 20, right: 20, bottom: 35, left: 50 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        // ROI range
        const roiMin = 1;
        const safeBE = Math.min(roiBreakeven, 100);
        const roiMax = Math.max(Math.ceil(safeBE * 2), 10);
        const roiStep = (roiMax - roiMin) / 100;

        // Calculate profits for each ROI
        const points = [];
        let minProfit = 0;
        let maxProfit = 0;
        for (let roi = roiMin; roi <= roiMax; roi += roiStep) {
            // adSpend per unit = price / roi
            const adSpend = price / roi;
            const profit = price - totalNonAdPerUnit - adSpend;
            points.push({ roi, profit });
            minProfit = Math.min(minProfit, profit);
            maxProfit = Math.max(maxProfit, profit);
        }

        // Ensure range includes 0
        minProfit = Math.min(minProfit, -10);
        maxProfit = Math.max(maxProfit, 10);
        const profitRange = maxProfit - minProfit;

        // Helper: map to canvas coords
        const toX = (roi) => padding.left + ((roi - roiMin) / (roiMax - roiMin)) * chartW;
        const toY = (profit) => padding.top + (1 - (profit - minProfit) / profitRange) * chartH;

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        // Horizontal lines
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (i / gridLines) * chartH;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
        }

        // Zero line
        const zeroY = toY(0);
        if (zeroY >= padding.top && zeroY <= padding.top + chartH) {
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(padding.left, zeroY);
            ctx.lineTo(w - padding.right, zeroY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '10px -apple-system, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('¥0', padding.left - 6, zeroY + 3);
        }

        // Break-even vertical line
        if (roiBreakeven > roiMin && roiBreakeven < roiMax) {
            const bx = toX(roiBreakeven);
            ctx.strokeStyle = 'rgba(255, 159, 10, 0.5)';
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bx, padding.top);
            ctx.lineTo(bx, padding.top + chartH);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label
            ctx.fillStyle = '#ff9f0a';
            ctx.font = 'bold 11px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`ROI=${roiBreakeven.toFixed(1)}`, bx, padding.top + chartH + 28);
        }

        // Draw profit curve
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
        gradient.addColorStop(0, 'rgba(48, 209, 88, 0.8)');
        gradient.addColorStop(0.5, 'rgba(90, 200, 250, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 69, 58, 0.8)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach((p, i) => {
            const x = toX(p.roi);
            const y = toY(p.profit);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Fill area below curve to zero-line
        const fillGradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
        fillGradient.addColorStop(0, 'rgba(48, 209, 88, 0.12)');
        fillGradient.addColorStop(1, 'rgba(255, 69, 58, 0.12)');

        ctx.fillStyle = fillGradient;
        ctx.beginPath();
        ctx.moveTo(toX(points[0].roi), zeroY);
        points.forEach((p) => {
            ctx.lineTo(toX(p.roi), toY(p.profit));
        });
        ctx.lineTo(toX(points[points.length - 1].roi), zeroY);
        ctx.closePath();
        ctx.fill();

        // Axis labels
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px -apple-system, sans-serif';

        // X axis
        ctx.textAlign = 'center';
        const xTicks = 5;
        for (let i = 0; i <= xTicks; i++) {
            const roi = roiMin + (i / xTicks) * (roiMax - roiMin);
            ctx.fillText(roi.toFixed(1), toX(roi), padding.top + chartH + 15);
        }
        ctx.fillText('ROI →', w - padding.right, padding.top + chartH + 28);

        // Y axis labels
        ctx.textAlign = 'right';
        ctx.fillText(`¥${maxProfit.toFixed(0)}`, padding.left - 6, padding.top + 10);
        ctx.fillText(`¥${minProfit.toFixed(0)}`, padding.left - 6, padding.top + chartH);

        // Zones label
        if (roiBreakeven > roiMin && roiBreakeven < roiMax) {
            const bx = toX(roiBreakeven);
            ctx.font = 'bold 11px -apple-system, sans-serif';
            ctx.textAlign = 'center';

            // Loss zone
            ctx.fillStyle = 'rgba(255, 69, 58, 0.5)';
            ctx.fillText('亏损区', (padding.left + bx) / 2, padding.top + 14);

            // Profit zone
            ctx.fillStyle = 'rgba(48, 209, 88, 0.5)';
            ctx.fillText('盈利区', (bx + w - padding.right) / 2, padding.top + 14);
        }
    }

    function clearSensitivityChart() {
        const canvas = $('sensitivityChart');
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.parentElement.clientWidth || 300;
        canvas.width = w * dpr;
        canvas.height = 200 * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, 200);
    }

    // ========== Event Listeners ==========
    $('roiCalcBtn').addEventListener('click', calculate);

    // Prevent zoom on iOS
    document.querySelectorAll('.input-field').forEach((input) => {
        input.addEventListener('focus', function () {
            if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
                this.style.fontSize = '16px';
            }
        });
    });

    // ========== Init ==========
    loadFromPage1();
    calculate();
})();
