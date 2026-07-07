/**
 * 震區水平譜加速度係數典籍查覽
 * script.js v5
 */

'use strict';

let seismicData       = [];
let nearFaultData     = null;
let amplificationData = null;
const DIST_NODES  = [1, 3, 5, 7, 9, 11, 13, 14];

/* ── 狀態變數（不依賴 DOM radio.checked） ── */
let selectedZone  = '';   // 'general' | 'near' | ''
let lastCoeffs    = null; // 最近一次查覽結果 { dss, ds1, mss, ms1 }，供地盤放大計算使用

/* ── DOM refs ── */
let elCounty, elDistrict, elZoneRow, elBtnGeneral, elBtnNear,
    elNearRow, elFaultSelect, elDistInput, elQueryBtn,
    elResult, elPlaceholder, elSoilSelect, elSoilBtn, elSiteDesignGrid;

document.addEventListener('DOMContentLoaded', () => {
  elCounty      = document.getElementById('county-select');
  elDistrict    = document.getElementById('district-select');
  elZoneRow     = document.getElementById('zone-row');
  elBtnGeneral  = document.getElementById('btn-general');
  elBtnNear     = document.getElementById('btn-near');
  elNearRow     = document.getElementById('near-row');
  elFaultSelect = document.getElementById('fault-select');
  elDistInput   = document.getElementById('dist-input');
  elQueryBtn    = document.getElementById('query-btn');
  elResult      = document.getElementById('result');
  elPlaceholder = document.getElementById('placeholder');
  elSoilSelect     = document.getElementById('soil-class-select');
  elSoilBtn        = document.getElementById('soil-calc-btn');
  elSiteDesignGrid = document.getElementById('site-design-grid');

  /* 初始全隱藏 */
  hide(elZoneRow);
  hide(elNearRow);
  hide(elResult);
  hide(elSiteDesignGrid);

  /* 事件綁定 */
  elCounty.addEventListener('change', onCountyChange);
  elDistrict.addEventListener('change', onDistrictChange);
  elBtnGeneral.addEventListener('click', () => selectZone('general'));
  elBtnNear.addEventListener('click',    () => selectZone('near'));
  elQueryBtn.addEventListener('click', onQuery);
  elSoilBtn.addEventListener('click', onSoilCalc);

  loadData();
});

/* ════════════════════════════
   資料載入
   ════════════════════════════ */
async function loadData() {
  try {
    const [r1, r2, r3] = await Promise.all([
      fetch('seismic.json'),
      fetch('near_fault.json'),
      fetch('amplification.json')
    ]);
    if (!r1.ok || !r2.ok || !r3.ok) throw new Error(`HTTP ${r1.status}/${r2.status}/${r3.status}`);
    seismicData       = await r1.json();
    nearFaultData     = await r2.json();
    amplificationData = await r3.json();
    populateCounties();
    populateSoilClasses();
  } catch (err) {
    console.error('資料載入失敗：', err);
    elPlaceholder.textContent = '⚠ 資料載入失敗，請確認 seismic.json、near_fault.json 與 amplification.json 位於同一目錄。';
  }
}

function populateCounties() {
  seismicData.forEach((item, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = item.county;
    elCounty.appendChild(opt);
  });
}

function populateSoilClasses() {
  amplificationData.fa.soil_classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.class;
    opt.textContent = c.label;
    elSoilSelect.appendChild(opt);
  });
}

/* ════════════════════════════
   縣市變更
   ════════════════════════════ */
function onCountyChange() {
  resetFrom('county');
  if (elCounty.value === '') { elDistrict.disabled = true; return; }
  seismicData[elCounty.value].districts.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = d.name;
    elDistrict.appendChild(opt);
  });
  elDistrict.disabled = false;
}

/* ════════════════════════════
   鄉鎮變更
   ════════════════════════════ */
function onDistrictChange() {
  resetFrom('district');
  if (elDistrict.value === '') return;
  const d = getDistData();
  if (d.faults && d.faults.length > 0) show(elZoneRow);
}

/* ════════════════════════════
   工址判斷：點擊卡片
   ════════════════════════════ */
function selectZone(zone) {
  selectedZone = zone;

  /* 更新卡片樣式 */
  elBtnGeneral.classList.toggle('is-selected', zone === 'general');
  elBtnNear.classList.toggle('is-selected',    zone === 'near');

  /* 同步 radio checked（輔助功能用） */
  document.getElementById('zone-general').checked = (zone === 'general');
  document.getElementById('zone-near').checked    = (zone === 'near');

  /* 清除結果與近斷層列 */
  hide(elResult);
  hide(elNearRow);
  elFaultSelect.innerHTML = '<option value="">── 請選擇斷層 ──</option>';
  elDistInput.value = '';

  if (zone === 'near') {
    const d = getDistData();
    d.faults.forEach(fname => {
      const rec = findRecord(fname);
      const opt = document.createElement('option');
      opt.value = fname;
      opt.textContent = fname + (rec ? '' : '（查無近斷層資料）');
      opt.disabled = !rec;
      elFaultSelect.appendChild(opt);
    });
    show(elNearRow);
  }
}

/* ════════════════════════════
   查詢
   ════════════════════════════ */
function onQuery() {
  if (!elCounty.value)   { alert('請先選擇縣市');     return; }
  if (!elDistrict.value) { alert('請先選擇鄉鎮市區'); return; }

  const county = seismicData[elCounty.value].county;
  const d      = getDistData();

  /* 無鄰近斷層 */
  if (!d.faults || d.faults.length === 0) {
    renderResult(county, d, 'general-nofault', null, null);
    return;
  }

  /* 需選擇工址判斷 */
  if (!selectedZone) {
    alert('請選擇工址位置判斷（非近斷層或屬近斷層）');
    return;
  }

  if (selectedZone === 'general') {
    renderResult(county, d, 'general', null, null);
    return;
  }

  /* 屬近斷層 */
  const fname = elFaultSelect.value;
  if (!fname) { alert('請選擇鄰近斷層'); return; }

  const r = parseFloat(elDistInput.value);
  if (isNaN(r) || r <= 0) { alert('請輸入正確的距離（公里，正數）'); return; }
  if (r >= 14) { alert('距離 ≥ 14 km 應改選「非近斷層」，或重新輸入距離。'); return; }

  const rec = findRecord(fname);
  if (!rec) { alert(`查無「${fname}」的近斷層係數資料`); return; }

  const coeffs = getZoneCoeffs(rec, county, d.name);
  renderResult(county, d, 'near', fname, { r, ...interpolate(coeffs, r) });
}

/* ════════════════════════════
   工址地盤放大計算（2.5 節、表 2-4）
   ════════════════════════════ */
function onSoilCalc() {
  if (!elSoilSelect.value) { alert('請先選擇地盤分類'); return; }
  const cls = parseInt(elSoilSelect.value, 10);

  const faVals = amplificationData.fa.soil_classes.find(c => c.class === cls).values;
  const fvVals = amplificationData.fv.soil_classes.find(c => c.class === cls).values;
  const faSs   = amplificationData.fa.ss_nodes;
  const fvS1   = amplificationData.fv.s1_nodes;

  const faDss = interpNodes(faSs, faVals, lastCoeffs.dss);
  const fvDs1 = interpNodes(fvS1, fvVals, lastCoeffs.ds1);
  const faMss = interpNodes(faSs, faVals, lastCoeffs.mss);
  const fvMs1 = interpNodes(fvS1, fvVals, lastCoeffs.ms1);

  const sds = faDss * lastCoeffs.dss;
  const sd1 = fvDs1 * lastCoeffs.ds1;
  const sms = faMss * lastCoeffs.mss;
  const sm1 = fvMs1 * lastCoeffs.ms1;

  document.getElementById('val-sds').textContent = sds.toFixed(2);
  document.getElementById('val-sd1').textContent = sd1.toFixed(2);
  document.getElementById('val-sms').textContent = sms.toFixed(2);
  document.getElementById('val-sm1').textContent = sm1.toFixed(2);

  document.getElementById('val-fa-sds').textContent = faDss.toFixed(2);
  document.getElementById('val-fv-sd1').textContent = fvDs1.toFixed(2);
  document.getElementById('val-fa-sms').textContent = faMss.toFixed(2);
  document.getElementById('val-fv-sm1').textContent = fvMs1.toFixed(2);

  show(elSiteDesignGrid);
}

/* ════════════════════════════
   工具
   ════════════════════════════ */
function getDistData() {
  return seismicData[elCounty.value].districts[elDistrict.value];
}

function findRecord(fname) {
  return nearFaultData.faults.find(f =>
    f.fault === fname ||
    (f.fault_aliases && f.fault_aliases.includes(fname)) ||
    f.fault.includes(fname)
  ) || null;
}

/* 判斷鄉鎮屬於 zone_a 或 zone_b，回傳對應係數組 */
function getZoneCoeffs(rec, countyName, districtName) {
  // 先在 zone_b 中找，找不到就用 zone_a
  if (rec.zone_b) {
    for (const grp of rec.zone_b.districts) {
      if (grp.county === countyName && grp.names.includes(districtName)) {
        return rec.zone_b;
      }
    }
  }
  return rec.zone_a;
}

function interpolate(coeffs, r) {
  const n = DIST_NODES;
  if (r <= n[0]) return { dss:coeffs.dss[0], ds1:coeffs.ds1[0], mss:coeffs.mss[0], ms1:coeffs.ms1[0] };
  const last = n.length - 1;
  if (r >= n[last]) return { dss:coeffs.dss[last], ds1:coeffs.ds1[last], mss:coeffs.mss[last], ms1:coeffs.ms1[last] };
  let lo = 0;
  for (let i = 0; i < n.length - 1; i++) {
    if (r >= n[i] && r <= n[i+1]) { lo = i; break; }
  }
  const hi = lo + 1, t = (r - n[lo]) / (n[hi] - n[lo]);
  const lp = a => +(a[lo] + t * (a[hi] - a[lo])).toFixed(4);
  return { dss:lp(coeffs.dss), ds1:lp(coeffs.ds1), mss:lp(coeffs.mss), ms1:lp(coeffs.ms1) };
}

/* 通用節點內插（用於表 2-4 Fa／Fv 查表），x 超出節點範圍時取端點值 */
function interpNodes(nodes, values, x) {
  const last = nodes.length - 1;
  if (x <= nodes[0])    return values[0];
  if (x >= nodes[last]) return values[last];
  for (let i = 0; i < last; i++) {
    if (x >= nodes[i] && x <= nodes[i + 1]) {
      const t = (x - nodes[i]) / (nodes[i + 1] - nodes[i]);
      return values[i] + t * (values[i + 1] - values[i]);
    }
  }
}

/* ════════════════════════════
   渲染結果
   ════════════════════════════ */
function renderResult(county, d, mode, activeFault, nv) {
  document.getElementById('result-county').textContent   = county;
  document.getElementById('result-district').textContent = d.name;

  /* 重置工址地盤放大計算區（每次查覽結果改變，先前的放大結果即失效） */
  elSoilSelect.value = '';
  hide(elSiteDesignGrid);

  let vals, label, cls;
  if (mode === 'near') {
    vals  = nv;
    label = `⚡ 近斷層效應｜${activeFault}｜距離 ${nv.r} km（表 2-3 線性內插）`;
    cls   = 'mode--near';
  } else {
    vals  = d;
    label = mode === 'general'
      ? '◎ 非近斷層（距離 ≥ 14 km）｜採表 2-1 一般值'
      : '◎ 採表 2-1 一般值（無鄰近活動斷層）';
    cls   = 'mode--general';
  }
  lastCoeffs = { dss:+vals.dss, ds1:+vals.ds1, mss:+vals.mss, ms1:+vals.ms1 };
  const modeEl = document.getElementById('result-mode');
  modeEl.textContent = label;
  modeEl.className   = 'result__mode ' + cls;

  document.getElementById('val-dss').textContent = (+vals.dss).toFixed(2);
  document.getElementById('val-ds1').textContent = (+vals.ds1).toFixed(2);
  document.getElementById('val-mss').textContent = (+vals.mss).toFixed(2);
  document.getElementById('val-ms1').textContent = (+vals.ms1).toFixed(2);

  const tags = document.getElementById('fault-tags');
  tags.innerHTML = '';
  if (d.faults && d.faults.length > 0) {
    d.faults.forEach(fn => {
      const sp = document.createElement('span');
      sp.className   = 'fault-tag' + (mode === 'near' && fn === activeFault ? ' fault-tag--active' : '');
      sp.textContent = fn;
      tags.appendChild(sp);
    });
  } else {
    const sp = document.createElement('span');
    sp.className = 'fault-none';
    sp.textContent = '本區域無列載鄰近活動斷層';
    tags.appendChild(sp);
  }

  elPlaceholder.style.display = 'none';
  show(elResult);
}

/* ════════════════════════════
   重設（階層式）
   ════════════════════════════ */
function resetFrom(level) {
  hide(elResult);
  if (level === 'county') {
    elDistrict.innerHTML = '<option value="">── 請選擇鄉鎮市區 ──</option>';
    elDistrict.disabled  = true;
  }
  selectedZone = '';
  hide(elZoneRow);
  hide(elNearRow);
  elBtnGeneral.classList.remove('is-selected');
  elBtnNear.classList.remove('is-selected');
  document.getElementById('zone-general').checked = false;
  document.getElementById('zone-near').checked    = false;
  elFaultSelect.innerHTML = '<option value="">── 請選擇斷層 ──</option>';
  elDistInput.value = '';
}

function show(el) {
  // near-row is a flex container; site-design-grid is a grid container; zone-row and result are block
  if (el.id === 'near-row') el.style.display = 'flex';
  else if (el.id === 'site-design-grid') el.style.display = 'grid';
  else el.style.display = 'block';
}
function hide(el) { el.style.display = 'none'; }
