/**
 * 电商毛利计算器 - 计算逻辑
 */

(function () {
  'use strict';

  // ========== State ==========
  const modes = {
    goodsCost: 'abs',
    shippingCost: 'abs',
    platformFee: 'pct',
    adCost: 'pct',
  };

  // ========== DOM Refs ==========
  const $ = (id) => document.getElementById(id);

  const inputs = {
    price: $('price'),
    goodsCost: $('goodsCost'),
    shippingCost: $('shippingCost'),
    platformFee: $('platformFee'),
    adCost: $('adCost'),
    returnRate: $('returnRate'),
  };

  // ========== Mode Toggle ==========
  document.querySelectorAll('.mode-toggle button').forEach((btn) => {
    btn.addEventListener('click', function () {
      const target = this.dataset.target;
      const mode = this.dataset.mode;

      // Update mode state
      modes[target] = mode;

      // Update UI
      const parent = this.closest('.mode-toggle');
      parent.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      this.classList.add('active');

      // Update prefix
      const prefix = document.querySelector(`.dynamic-prefix[data-for="${target}"]`);
      if (prefix) {
        prefix.textContent = mode === 'abs' ? '¥' : '%';
      }

      // Recalculate
      calculate();
    });
  });

  // ========== Calculation ==========
  function getVal(id) {
    return parseFloat(inputs[id].value) || 0;
  }

  function resolveAmount(id, price) {
    const raw = getVal(id);
    if (id === 'returnRate') return raw; // Always percentage
    if (modes[id] === 'pct') {
      return (raw / 100) * price;
    }
    return raw;
  }

  function calculate() {
    const price = getVal('price');
    if (price <= 0) {
      showEmptyState();
      return;
    }

    // Resolve all costs to absolute values
    const goodsCost = resolveAmount('goodsCost', price);
    const shippingCost = resolveAmount('shippingCost', price);
    const platformFee = resolveAmount('platformFee', price);
    const adCost = resolveAmount('adCost', price);
    const returnRate = getVal('returnRate');

    // Return loss = returnRate% × (goodsCost + shippingCost)
    const returnLoss = (returnRate / 100) * (goodsCost + shippingCost);

    // Total cost
    const totalCost = goodsCost + shippingCost + platformFee + adCost + returnLoss;

    // Profit
    const profit = price - totalCost;
    const profitRate = (profit / price) * 100;

    // Update result display
    updateResults(price, goodsCost, shippingCost, platformFee, adCost, returnRate, returnLoss, totalCost, profit, profitRate);

    // Update calculation process
    updateProcess(price, goodsCost, shippingCost, platformFee, adCost, returnRate, returnLoss, totalCost, profit, profitRate);

    // Update pie chart
    drawPieChart(goodsCost, shippingCost, platformFee, adCost, returnLoss, profit);

    // Save data to localStorage for ROI page
    saveDataForROI(price, goodsCost, shippingCost, platformFee, returnRate);
  }

  function updateResults(price, goodsCost, shippingCost, platformFee, adCost, returnRate, returnLoss, totalCost, profit, profitRate) {
    const profitEl = $('profitValue');
    const rateEl = $('profitRateValue');

    profitEl.textContent = `¥${profit.toFixed(2)}`;
    profitEl.className = `result-value number-animate ${profit >= 0 ? 'positive' : 'negative'}`;

    rateEl.textContent = `${profitRate.toFixed(1)}%`;
    rateEl.className = `result-value number-animate ${profit >= 0 ? 'positive' : 'negative'}`;

    $('resultGoods').textContent = `¥${goodsCost.toFixed(2)}`;
    $('resultShipping').textContent = `¥${shippingCost.toFixed(2)}`;
    $('resultPlatform').textContent = `¥${platformFee.toFixed(2)}`;
    $('resultAd').textContent = `¥${adCost.toFixed(2)}`;
    $('resultReturn').textContent = `¥${returnLoss.toFixed(2)}`;
    $('resultTotal').textContent = `¥${totalCost.toFixed(2)}`;
  }

  function formatModeInfo(id, price) {
    const raw = getVal(id);
    if (raw === 0) return '0';
    if (modes[id] === 'pct') {
      const abs = (raw / 100) * price;
      return `${raw}% × ¥${price.toFixed(2)} = ¥${abs.toFixed(2)}`;
    }
    const pct = (raw / price * 100).toFixed(1);
    return `¥${raw.toFixed(2)}（占售价 ${pct}%）`;
  }

  function updateProcess(price, goodsCost, shippingCost, platformFee, adCost, returnRate, returnLoss, totalCost, profit, profitRate) {
    const container = $('calcProcess');

    let html = '';

    // Step 1: Cost conversion
    html += `<div class="step-title">① 成本换算</div>`;
    html += `<div class="formula">商品成本：${formatModeInfo('goodsCost', price)}</div>`;
    html += `<div class="formula">快递成本：${formatModeInfo('shippingCost', price)}</div>`;
    html += `<div class="formula">平台扣点：${formatModeInfo('platformFee', price)}</div>`;
    html += `<div class="formula">广告费用：${formatModeInfo('adCost', price)}</div>`;

    // Step 2: Return loss
    html += `<div class="step-title">② 退货损失</div>`;
    if (returnRate > 0) {
      html += `<div class="formula">退货率 ${returnRate}%</div>`;
      html += `<div class="formula">= ${returnRate}% × (¥${goodsCost.toFixed(2)} + ¥${shippingCost.toFixed(2)})</div>`;
      html += `<div class="formula formula-result">= ¥${returnLoss.toFixed(2)}</div>`;
    } else {
      html += `<div class="formula">退货率 0%，无退货损失</div>`;
    }

    // Step 3: Total cost
    html += `<div class="step-title">③ 成本合计</div>`;
    html += `<div class="formula">¥${goodsCost.toFixed(2)} + ¥${shippingCost.toFixed(2)} + ¥${platformFee.toFixed(2)} + ¥${adCost.toFixed(2)} + ¥${returnLoss.toFixed(2)}</div>`;
    html += `<div class="formula formula-result">= ¥${totalCost.toFixed(2)}</div>`;

    // Divider
    html += `<hr class="divider">`;

    // Final result
    html += `<div class="step-title">④ 毛利</div>`;
    html += `<div class="formula">¥${price.toFixed(2)}（售价）- ¥${totalCost.toFixed(2)}（成本）</div>`;
    html += `<div class="formula formula-result">= ¥${profit.toFixed(2)}</div>`;

    html += `<div class="step-title">⑤ 毛利率</div>`;
    html += `<div class="formula">¥${profit.toFixed(2)} / ¥${price.toFixed(2)} × 100%</div>`;
    html += `<div class="formula formula-result">= ${profitRate.toFixed(1)}%</div>`;

    container.innerHTML = html;
  }

  function showEmptyState() {
    $('profitValue').textContent = '¥0.00';
    $('profitValue').className = 'result-value number-animate';
    $('profitRateValue').textContent = '0.0%';
    $('profitRateValue').className = 'result-value number-animate';
    $('resultGoods').textContent = '¥0.00';
    $('resultShipping').textContent = '¥0.00';
    $('resultPlatform').textContent = '¥0.00';
    $('resultAd').textContent = '¥0.00';
    $('resultReturn').textContent = '¥0.00';
    $('resultTotal').textContent = '¥0.00';
    $('calcProcess').innerHTML = '<p style="color: var(--text-tertiary); text-align: center; font-family: -apple-system, sans-serif;">填写数据后点击「计算毛利」</p>';
    clearPieChart();
  }

  // ========== Pie Chart (Canvas) ==========
  function drawPieChart(goodsCost, shippingCost, platformFee, adCost, returnLoss, profit) {
    const canvas = $('pieChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = 280;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const data = [
      { label: '商品成本', value: goodsCost, color: '#5ac8fa' },
      { label: '快递成本', value: shippingCost, color: '#bf5af2' },
      { label: '平台扣点', value: platformFee, color: '#ff9f0a' },
      { label: '广告费用', value: adCost, color: '#ff453a' },
      { label: '退货损失', value: returnLoss, color: '#ffd60a' },
      { label: '毛利', value: Math.max(profit, 0), color: '#30d158' },
    ].filter(d => d.value > 0);

    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total <= 0) {
      clearPieChart();
      return;
    }

    const cx = size / 2;
    const cy = size / 2;
    const radius = 110;
    const innerRadius = 60;

    let startAngle = -Math.PI / 2;

    data.forEach((item) => {
      const sliceAngle = (item.value / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(startAngle) * innerRadius, cy + Math.sin(startAngle) * innerRadius);
      ctx.arc(cx, cy, radius, startAngle, endAngle, false);
      ctx.lineTo(cx + Math.cos(endAngle) * innerRadius, cy + Math.sin(endAngle) * innerRadius);
      ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle = item.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();

      // Slice border
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.globalAlpha = 1;

      // Percentage label
      const pct = ((item.value / total) * 100).toFixed(0);
      if (pct >= 5) {
        const midAngle = startAngle + sliceAngle / 2;
        const labelRadius = (radius + innerRadius) / 2;
        const lx = cx + Math.cos(midAngle) * labelRadius;
        const ly = cy + Math.sin(midAngle) * labelRadius;
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${11 * 1}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${pct}%`, lx, ly);
      }

      startAngle = endAngle;
    });

    // Center text
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('成本占比', cx, cy);

    // Update legend
    const legendEl = $('chartLegend');
    legendEl.innerHTML = data.map(d =>
      `<div class="chart-legend-item">
        <span class="dot" style="background:${d.color}"></span>
        ${d.label} ¥${d.value.toFixed(2)}
      </div>`
    ).join('');
  }

  function clearPieChart() {
    const canvas = $('pieChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 280 * dpr;
    canvas.height = 280 * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, 280, 280);
    $('chartLegend').innerHTML = '';
  }

  // ========== Data persistence for ROI page ==========
  function saveDataForROI(price, goodsCost, shippingCost, platformFee, returnRate) {
    const data = {
      price,
      goodsCost,
      shippingCost,
      platformFee,
      returnRate,
      timestamp: Date.now(),
    };
    localStorage.setItem('profitCalc_data', JSON.stringify(data));
  }

  // ========== Event Listeners ==========
  $('calcBtn').addEventListener('click', calculate);

  // Prevent zoom on input focus (iOS)
  document.querySelectorAll('.input-field').forEach((input) => {
    input.addEventListener('focus', function () {
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        this.style.fontSize = '16px';
      }
    });
  });

  // Initial state
  showEmptyState();
})();
