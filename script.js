/**
 * 震區水平譜加速度係數典籍查覽
 * script.js v5
 */

'use strict';

let seismicData       = [];
let nearFaultData     = null;
let amplificationData = null;
let mceData           = null;
let importanceData    = null;
let ductilityData     = null;
const DIST_NODES  = [1, 3, 5, 7, 9, 11, 13, 14];

/* ── 狀態變數（不依賴 DOM radio.checked） ── */
let selectedZone  = '';   // 'general' | 'near' | ''
let lastCoeffs    = null; // 最近一次查覽結果 { dss, ds1, mss, ms1 }，供地盤放大計算使用
let siteCoeffs    = null; // 工址放大後係數 { sds, sd1, sms, sm1, faDss, fvDs1, faMss, fvMs1 }，供未來 B/C 區塊取用
let bPeriodResult = null; // B 區計算結果 { T, t0d }，供 D 區計算 Fu 使用

/* ── C 區狀態變數 ── */
let selectedCategoryId = '';
let selectedItemId     = '';

/* ── D 區狀態變數 ── */
let selectedAlphaY       = null;
let selectedDCategoryId  = '';
let selectedDGroupId     = '';
let selectedLeaf         = null; // 已選定葉節點 { label, r, height_limit }
let selectedR            = null;
let selectedHeightLimit  = '';
let selectedSiteType     = '';
let raValue              = null;

/* ── DOM refs ── */
let elCounty, elDistrict, elZoneRow, elBtnGeneral, elBtnNear,
    elNearRow, elFaultSelect, elDistInput, elQueryBtn,
    elResult, elPlaceholder, elSoilSelect, elSoilBtn, elSiteDesignGrid,
    elNavItems, elContentPanels;

/* ── B 區 DOM refs ── */
let elBNoData, elBSiteGrid, elBT0Row, elBPeriodBox, elBBuildingType,
    elBHeightInput, elBCalcBtn, elBResult;

/* ── C 區 DOM refs ── */
let elCCategories, elCItemsPlaceholder, elCItemsList, elCNote,
    elCConfirmBtn, elCResult, elCPlaceholder;

/* ── D 區 DOM refs ── */
let elDAlphaYGrid, elDValAlphaY, elDCategories, elDItemsPlaceholder, elDCategoryNote,
    elDGroupsList, elDItemsList,
    elDConfirmBtn, elDRResult, elDRaBox, elDRaGrid, elDFuBox, elDFuNoData, elDFuContent;

document.addEventListener('DOMContentLoaded', async () => {
  await loadSections();
  initApp();
});

/* ════════════════════════════
   區塊載入（A／B…各區內容分別置於 sections/ 目錄）
   ════════════════════════════ */
async function loadSections() {
  try {
    const [aRes, bRes, cRes, dRes, eRes] = await Promise.all([
      fetch('sections/sec-a.html'),
      fetch('sections/sec-b.html'),
      fetch('sections/sec-c.html'),
      fetch('sections/sec-d.html'),
      fetch('sections/sec-e.html')
    ]);
    if (!aRes.ok || !bRes.ok || !cRes.ok || !dRes.ok || !eRes.ok) throw new Error(`HTTP ${aRes.status}/${bRes.status}/${cRes.status}/${dRes.status}/${eRes.status}`);
    document.getElementById('panel-a').innerHTML = await aRes.text();
    document.getElementById('panel-b').innerHTML = await bRes.text();
    document.getElementById('panel-c').innerHTML = await cRes.text();
    document.getElementById('panel-d').innerHTML = await dRes.text();
    document.getElementById('panel-e').innerHTML = await eRes.text();
  } catch (err) {
    console.error('區塊載入失敗：', err);
    document.querySelector('.app-content').innerHTML =
      '<p class="placeholder">⚠ 區塊載入失敗，請確認 sections/ 目錄存在。</p>';
  }
}

function initApp() {
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
  elNavItems       = document.querySelectorAll('.nav-item');
  elContentPanels  = document.querySelectorAll('.content-panel');

  elBNoData        = document.getElementById('b-no-data');
  elBSiteGrid      = document.getElementById('b-site-grid');
  elBT0Row         = document.getElementById('b-t0-row');
  elBPeriodBox     = document.getElementById('b-period-box');
  elBBuildingType  = document.getElementById('b-building-type');
  elBHeightInput   = document.getElementById('b-height-input');
  elBCalcBtn       = document.getElementById('b-calc-btn');
  elBResult        = document.getElementById('b-result');

  elCCategories       = document.getElementById('c-categories');
  elCItemsPlaceholder = document.getElementById('c-items-placeholder');
  elCItemsList        = document.getElementById('c-items-list');
  elCNote             = document.getElementById('c-note');
  elCConfirmBtn       = document.getElementById('c-confirm-btn');
  elCResult           = document.getElementById('c-result');
  elCPlaceholder      = document.getElementById('c-placeholder');

  elDAlphaYGrid       = document.getElementById('d-alpha-y-grid');
  elDValAlphaY        = document.getElementById('d-val-alpha-y');
  elDCategories       = document.getElementById('d-categories');
  elDItemsPlaceholder = document.getElementById('d-items-placeholder');
  elDCategoryNote     = document.getElementById('d-category-note');
  elDGroupsList       = document.getElementById('d-groups-list');
  elDItemsList        = document.getElementById('d-items-list');
  elDConfirmBtn       = document.getElementById('d-confirm-btn');
  elDRResult          = document.getElementById('d-r-result');
  elDRaBox            = document.getElementById('d-ra-box');
  elDRaGrid           = document.getElementById('d-ra-grid');
  elDFuBox            = document.getElementById('d-fu-box');
  elDFuNoData         = document.getElementById('d-fu-no-data');
  elDFuContent        = document.getElementById('d-fu-content');

  /* 初始全隱藏 */
  hide(elZoneRow);
  hide(elNearRow);
  hide(elResult);
  hide(elSiteDesignGrid);
  hide(elBSiteGrid);
  hide(elBT0Row);
  hide(elBPeriodBox);
  hide(elBResult);
  hide(elCResult);
  hide(elDAlphaYGrid);
  hide(elDRResult);
  hide(elDRaBox);
  hide(elDRaGrid);
  hide(elDFuBox);

  /* 事件綁定 */
  elCounty.addEventListener('change', onCountyChange);
  elDistrict.addEventListener('change', onDistrictChange);
  elBtnGeneral.addEventListener('click', () => selectZone('general'));
  elBtnNear.addEventListener('click',    () => selectZone('near'));
  elQueryBtn.addEventListener('click', onQuery);
  elSoilBtn.addEventListener('click', onSoilCalc);
  elBCalcBtn.addEventListener('click', onBCalc);
  elCConfirmBtn.addEventListener('click', onImportanceConfirm);
  document.getElementById('btn-yield-asd').addEventListener('click', () => selectYieldMethod(1.2));
  document.getElementById('btn-yield-lrfd').addEventListener('click', () => selectYieldMethod(1.0));
  document.getElementById('btn-yield-rc').addEventListener('click', () => selectYieldMethod(1.5));
  elDConfirmBtn.addEventListener('click', onDuctilityConfirm);
  document.getElementById('btn-site-general').addEventListener('click', () => selectSiteType('general'));
  document.getElementById('btn-site-taipei').addEventListener('click',  () => selectSiteType('taipei'));
  elNavItems.forEach(btn => btn.addEventListener('click', () => selectPanel(btn.dataset.panel)));

  loadData();
}

/* ════════════════════════════
   資料載入
   ════════════════════════════ */
async function loadData() {
  try {
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      fetch('database/seismic.json'),
      fetch('database/near_fault.json'),
      fetch('database/amplification.json'),
      fetch('database/MCE.json'),
      fetch('database/importance.json'),
      fetch('database/ductility.json')
    ]);
    if (!r1.ok || !r2.ok || !r3.ok || !r4.ok || !r5.ok || !r6.ok) throw new Error(`HTTP ${r1.status}/${r2.status}/${r3.status}/${r4.status}/${r5.status}/${r6.status}`);
    seismicData       = await r1.json();
    nearFaultData     = await r2.json();
    amplificationData = await r3.json();
    mceData           = await r4.json();
    importanceData    = await r5.json();
    ductilityData      = await r6.json();
    populateCounties();
    populateSoilClasses();
    populateBuildingTypes();
    populateImportanceCategories();
    populateDuctilityCategories();
  } catch (err) {
    console.error('資料載入失敗：', err);
    elPlaceholder.textContent = '⚠ 資料載入失敗，請確認 database 目錄下之 seismic.json、near_fault.json、amplification.json、MCE.json、importance.json 與 ductility.json 是否存在。';
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

function populateBuildingTypes() {
  mceData.building_period.types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    elBBuildingType.appendChild(opt);
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

  siteCoeffs = { sds, sd1, sms, sm1, faDss, fvDs1, faMss, fvMs1 };

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
  // near-row is a flex container; site-design-grid/b-site-grid are grid containers; zone-row and result are block
  if (el.id === 'near-row' || el.id === 'c-items-list' || el.id === 'd-items-list' || el.id === 'd-groups-list') el.style.display = 'flex';
  else if (el.id === 'site-design-grid' || el.id === 'b-site-grid' || el.id === 'd-alpha-y-grid' || el.id === 'd-ra-grid') el.style.display = 'grid';
  else el.style.display = 'block';
}
function hide(el) { el.style.display = 'none'; }

/* ════════════════════════════
   側邊選單切換（A／未來 B、C…）
   ════════════════════════════ */
function selectPanel(panelId) {
  elNavItems.forEach(btn => btn.classList.toggle('is-active', btn.dataset.panel === panelId));
  elContentPanels.forEach(sec => sec.classList.toggle('is-active', sec.id === panelId));
  if (panelId === 'panel-b') refreshPanelB();
  if (panelId === 'panel-d') refreshPanelD();
}

/* ════════════════════════════
   B 區：工址設計與最大考量水平譜加速度係數（2.6 節）
   ════════════════════════════ */

/* 切入 B 區時，同步 A 區之工址放大結果（siteCoeffs） */
function refreshPanelB() {
  if (!siteCoeffs) {
    show(elBNoData);
    hide(elBSiteGrid);
    hide(elBT0Row);
    hide(elBPeriodBox);
    hide(elBResult);
    return;
  }

  hide(elBNoData);
  show(elBSiteGrid);
  show(elBT0Row);
  show(elBPeriodBox);

  document.getElementById('b-val-sds').textContent = siteCoeffs.sds.toFixed(2);
  document.getElementById('b-val-sd1').textContent = siteCoeffs.sd1.toFixed(2);
  document.getElementById('b-val-sms').textContent = siteCoeffs.sms.toFixed(2);
  document.getElementById('b-val-sm1').textContent = siteCoeffs.sm1.toFixed(2);

  /* (2-6) 式：短週期與中、長週期分界 */
  const t0d = siteCoeffs.sd1 / siteCoeffs.sds;
  const t0m = siteCoeffs.sm1 / siteCoeffs.sms;

  document.getElementById('b-val-t0d').textContent = t0d.toFixed(4) + ' 秒';
  document.getElementById('b-t0d-formula').innerHTML =
    `T<sub>0</sub><sup>D</sup> = S<sub>D1</sub> / S<sub>DS</sub> = ${siteCoeffs.sd1.toFixed(2)} / ${siteCoeffs.sds.toFixed(2)} = ${t0d.toFixed(4)} 秒　(2-6)`;

  document.getElementById('b-val-t0m').textContent = t0m.toFixed(4) + ' 秒';
  document.getElementById('b-t0m-formula').innerHTML =
    `T<sub>0</sub><sup>M</sup> = S<sub>M1</sub> / S<sub>MS</sub> = ${siteCoeffs.sm1.toFixed(2)} / ${siteCoeffs.sms.toFixed(2)} = ${t0m.toFixed(4)} 秒　(2-6)`;
}

/* 計算建築物基本振動週期 T，並依表 2-5(a)／2-5(b) 求 SaD、SaM */
function onBCalc() {
  if (!siteCoeffs) { alert('請先於 A 區完成工址地盤放大計算'); return; }
  if (!elBBuildingType.value) { alert('請先選擇建築物類型'); return; }

  const hn = parseFloat(elBHeightInput.value);
  if (isNaN(hn) || hn <= 0) { alert('請輸入正確的基面至屋頂面高度（公尺，正數）'); return; }

  const type = mceData.building_period.types.find(t => t.id === elBBuildingType.value);
  const n    = mceData.building_period.exponent;

  /* (2-7)／(2-8)／(2-9) 式：T = 係數 × hn^0.75 */
  const T = type.coefficient * Math.pow(hn, n);

  document.getElementById('b-val-t').textContent = T.toFixed(4) + ' 秒';
  document.getElementById('b-t-formula').innerHTML =
    `T = ${type.coefficient} × h<sub>n</sub><sup>${n}</sup> = ${type.coefficient} × ${hn}<sup>${n}</sup> = ${type.coefficient} × ${Math.pow(hn, n).toFixed(4)} = ${T.toFixed(4)} 秒　${type.eq}`;

  const t0d = siteCoeffs.sd1 / siteCoeffs.sds;
  const t0m = siteCoeffs.sm1 / siteCoeffs.sms;

  bPeriodResult = { T, t0d };

  document.getElementById('b-val-sad-02t0d').textContent = (0.2 * t0d).toFixed(4) + ' 秒';
  document.getElementById('b-val-sad-t0d').textContent    = t0d.toFixed(4) + ' 秒';
  document.getElementById('b-val-sad-25t0d').textContent  = (2.5 * t0d).toFixed(4) + ' 秒';

  document.getElementById('b-val-sam-02t0m').textContent = (0.2 * t0m).toFixed(4) + ' 秒';
  document.getElementById('b-val-sam-t0m').textContent    = t0m.toFixed(4) + ' 秒';
  document.getElementById('b-val-sam-25t0m').textContent  = (2.5 * t0m).toFixed(4) + ' 秒';

  const sad = calcSpectralAccel(T, t0d, siteCoeffs.sds, siteCoeffs.sd1, 'D');
  const sam = calcSpectralAccel(T, t0m, siteCoeffs.sms, siteCoeffs.sm1, 'M');

  document.getElementById('b-sad-range').textContent   = sad.label;
  document.getElementById('b-val-sad').textContent     = sad.value.toFixed(4);
  document.getElementById('b-sad-formula').innerHTML   = sad.formula;

  document.getElementById('b-sam-range').textContent   = sam.label;
  document.getElementById('b-val-sam').textContent     = sam.value.toFixed(4);
  document.getElementById('b-sam-formula').innerHTML   = sam.formula;

  show(elBResult);
}

/* 依表 2-5(a)／2-5(b) 之四段式規則，求反應譜加速度係數（D：設計地震；M：最大考量地震） */
function calcSpectralAccel(T, t0, Ss, S1, kind) {
  const sub  = kind === 'D' ? '<sub>DS</sub>'  : '<sub>MS</sub>';
  const sub1 = kind === 'D' ? '<sub>D1</sub>'  : '<sub>M1</sub>';
  const subA = kind === 'D' ? '<sub>aD</sub>'  : '<sub>aM</sub>';
  const t0sup = kind === 'D' ? 'T<sub>0</sub><sup>D</sup>' : 'T<sub>0</sub><sup>M</sup>';

  if (T <= 0.2 * t0) {
    const value = Ss * (0.4 + 3 * T / t0);
    return {
      label: '較短週期（T ≤ 0.2' + (kind === 'D' ? 'T0D' : 'T0M') + '）',
      value,
      formula: `S${subA} = S${sub} × (0.4 + 3T / ${t0sup}) = ${Ss.toFixed(2)} × (0.4 + 3×${T.toFixed(4)}/${t0.toFixed(4)}) = ${value.toFixed(4)}`
    };
  }
  if (T <= t0) {
    return {
      label: '短週期（0.2' + (kind === 'D' ? 'T0D' : 'T0M') + ' < T ≤ ' + (kind === 'D' ? 'T0D' : 'T0M') + '）',
      value: Ss,
      formula: `S${subA} = S${sub} = ${Ss.toFixed(4)}`
    };
  }
  if (T <= 2.5 * t0) {
    const value = S1 / T;
    return {
      label: '中週期（' + (kind === 'D' ? 'T0D' : 'T0M') + ' < T ≤ 2.5' + (kind === 'D' ? 'T0D' : 'T0M') + '）',
      value,
      formula: `S${subA} = S${sub1} / T = ${S1.toFixed(2)} / ${T.toFixed(4)} = ${value.toFixed(4)}`
    };
  }
  const value = 0.4 * Ss;
  return {
    label: '長週期（2.5' + (kind === 'D' ? 'T0D' : 'T0M') + ' < T）',
    value,
    formula: `S${subA} = 0.4 × S${sub} = 0.4 × ${Ss.toFixed(2)} = ${value.toFixed(4)}`
  };
}

/* ════════════════════════════
   C 區：建築物用途係數查詢（2.8 節）
   ════════════════════════════ */

function populateImportanceCategories() {
  elCCategories.innerHTML = '';
  importanceData.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-btn';
    btn.dataset.categoryId = cat.id;
    btn.innerHTML = `
      <span class="category-btn__body">
        <span class="category-btn__title">${cat.label}</span>
        <span class="category-btn__factor">I = ${cat.factor}</span>
      </span>`;
    btn.addEventListener('click', () => selectImportanceCategory(cat.id));
    elCCategories.appendChild(btn);
  });
}

function selectImportanceCategory(id) {
  selectedCategoryId = id;
  selectedItemId = '';

  elCCategories.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.toggle('is-selected', btn.dataset.categoryId === id);
  });

  const cat = importanceData.categories.find(c => c.id === id);

  elCItemsList.innerHTML = '';
  cat.items.forEach(item => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'item-option';
    opt.dataset.itemId = item.id;
    opt.textContent = item.label;
    opt.addEventListener('click', () => selectImportanceItem(item.id));
    elCItemsList.appendChild(opt);
  });

  hide(elCItemsPlaceholder);
  show(elCItemsList);

  if (cat.note) {
    elCNote.textContent = cat.note;
    show(elCNote);
  } else {
    hide(elCNote);
  }

  elCConfirmBtn.disabled = true;
  hide(elCResult);
  elCPlaceholder.style.display = 'block';
}

function selectImportanceItem(itemId) {
  selectedItemId = itemId;
  elCItemsList.querySelectorAll('.item-option').forEach(opt => {
    opt.classList.toggle('is-selected', opt.dataset.itemId === itemId);
  });
  elCConfirmBtn.disabled = false;
}

function onImportanceConfirm() {
  if (!selectedCategoryId || !selectedItemId) { alert('請先選擇建築物類別與所屬細項用途'); return; }

  const cat  = importanceData.categories.find(c => c.id === selectedCategoryId);
  const item = cat.items.find(i => i.id === selectedItemId);

  document.getElementById('c-result-category').textContent = cat.label;
  document.getElementById('c-result-item').textContent     = item.label;
  document.getElementById('c-val-i').textContent            = cat.factor.toFixed(2);

  elCPlaceholder.style.display = 'none';
  show(elCResult);
}

/* ════════════════════════════
   D 區：結構系統韌性容量與地震力折減係數（表 1-3、2.9 節）
   ════════════════════════════ */

/* 起始降伏地震力放大倍數 αy 選擇（僅供對照 2.9 節說明，不參與 Fu 計算） */
function selectYieldMethod(alphaY) {
  selectedAlphaY = alphaY;

  const map = { 1.2: 'yield-asd', 1.0: 'yield-lrfd', 1.5: 'yield-rc' };
  ['yield-asd', 'yield-lrfd', 'yield-rc'].forEach(id => {
    document.getElementById('btn-' + id).classList.toggle('is-selected', map[alphaY] === id);
    document.getElementById(id).checked = (map[alphaY] === id);
  });

  elDValAlphaY.textContent = alphaY.toFixed(1);
  show(elDAlphaYGrid);
}

/* 結構系統韌性容量 R 值查詢（依表 1-3，分類定義依 1.7 節） */
function populateDuctilityCategories() {
  elDCategories.innerHTML = '';
  ductilityData.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-btn';
    btn.dataset.categoryId = cat.id;
    btn.innerHTML = `
      <span class="category-btn__body">
        <span class="category-btn__title">${cat.label}</span>
      </span>`;
    btn.addEventListener('click', () => selectDuctilityCategory(cat.id));
    elDCategories.appendChild(btn);
  });
}

/* 選擇基本結構系統：顯示分類定義，並列出該分類下「1./2./3.」階層選項 */
function selectDuctilityCategory(id) {
  selectedDCategoryId = id;
  selectedDGroupId = '';
  selectedLeaf = null;

  elDCategories.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.toggle('is-selected', btn.dataset.categoryId === id);
  });

  const cat = ductilityData.categories.find(c => c.id === id);

  elDCategoryNote.textContent = cat.definition;
  show(elDCategoryNote);

  elDGroupsList.innerHTML = '';
  cat.groups.forEach(group => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'item-option';
    opt.dataset.groupId = group.id;
    opt.textContent = group.items
      ? group.label
      : `${group.label}　R = ${group.r}　高度限制 ${group.height_limit} m`;
    opt.addEventListener('click', () => selectDuctilityGroup(group.id));
    elDGroupsList.appendChild(opt);
  });

  hide(elDItemsPlaceholder);
  show(elDGroupsList);
  elDItemsList.innerHTML = '';
  hide(elDItemsList);

  elDConfirmBtn.disabled = true;
  hide(elDRResult);
  hide(elDRaBox);
  hide(elDRaGrid);
  hide(elDFuBox);
}

/* 選擇「1./2./3.」階層：若無 (1)(2)(3) 子項，直接視為葉節點；否則列出子項 */
function selectDuctilityGroup(groupId) {
  selectedDGroupId = groupId;
  selectedLeaf = null;
  elDConfirmBtn.disabled = true;

  elDGroupsList.querySelectorAll('.item-option').forEach(opt => {
    opt.classList.toggle('is-selected', opt.dataset.groupId === groupId);
  });

  const cat   = ductilityData.categories.find(c => c.id === selectedDCategoryId);
  const group = cat.groups.find(g => g.id === groupId);

  if (!group.items) {
    hide(elDItemsList);
    elDItemsList.innerHTML = '';
    selectedLeaf = { label: group.label, r: group.r, height_limit: group.height_limit };
    elDConfirmBtn.disabled = false;
    return;
  }

  elDItemsList.innerHTML = '';
  group.items.forEach(item => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'item-option';
    opt.dataset.itemId = item.id;
    opt.textContent = `${item.label}　R = ${item.r}　高度限制 ${item.height_limit} m`;
    opt.addEventListener('click', () => selectDuctilityItem(item.id));
    elDItemsList.appendChild(opt);
  });
  show(elDItemsList);
}

/* 選擇「(1)(2)(3)…」階層子項 */
function selectDuctilityItem(itemId) {
  const cat   = ductilityData.categories.find(c => c.id === selectedDCategoryId);
  const group = cat.groups.find(g => g.id === selectedDGroupId);
  const item  = group.items.find(i => i.id === itemId);

  elDItemsList.querySelectorAll('.item-option').forEach(opt => {
    opt.classList.toggle('is-selected', opt.dataset.itemId === itemId);
  });

  selectedLeaf = { label: group.label + item.label, r: item.r, height_limit: item.height_limit };
  elDConfirmBtn.disabled = false;
}

function onDuctilityConfirm() {
  if (!selectedLeaf) { alert('請先選擇基本結構系統之細項'); return; }

  const cat = ductilityData.categories.find(c => c.id === selectedDCategoryId);

  selectedR           = selectedLeaf.r;
  selectedHeightLimit = selectedLeaf.height_limit;

  document.getElementById('d-result-category').textContent = cat.label;
  document.getElementById('d-result-item').textContent     = selectedLeaf.label;
  document.getElementById('d-val-r').textContent            = selectedLeaf.r.toFixed(1);
  document.getElementById('d-val-height').textContent       = selectedLeaf.height_limit;
  show(elDRResult);

  /* R 值變更，重設下游之 Ra／Fu 計算 */
  selectedSiteType = '';
  raValue = null;
  document.getElementById('d-site-general').checked = false;
  document.getElementById('d-site-taipei').checked  = false;
  document.getElementById('btn-site-general').classList.remove('is-selected');
  document.getElementById('btn-site-taipei').classList.remove('is-selected');
  hide(elDRaGrid);
  hide(elDFuBox);

  show(elDRaBox);
}

/* 結構系統容許韌性容量 Ra 計算（(2-10)／(2-11) 式） */
function selectSiteType(type) {
  if (selectedR === null) { alert('請先查詢結構系統韌性容量 R 值'); return; }
  selectedSiteType = type;

  document.getElementById('btn-site-general').classList.toggle('is-selected', type === 'general');
  document.getElementById('btn-site-taipei').classList.toggle('is-selected',  type === 'taipei');
  document.getElementById('d-site-general').checked = (type === 'general');
  document.getElementById('d-site-taipei').checked  = (type === 'taipei');

  const divisor = type === 'general' ? 1.5 : 2.0;
  const eq      = type === 'general' ? '(2-10)' : '(2-11)';
  raValue = 1 + (selectedR - 1) / divisor;

  document.getElementById('d-val-ra').textContent = raValue.toFixed(4);
  document.getElementById('d-ra-formula').innerHTML =
    `R<sub>a</sub> = 1 + (R－1) / ${divisor.toFixed(1)} = 1 + (${selectedR.toFixed(1)}－1) / ${divisor.toFixed(1)} = ${raValue.toFixed(4)}　${eq}`;
  show(elDRaGrid);

  refreshFuResult();
}

/* 切入 D 區時，重新整理 Fu 計算結果（若已選定 Ra） */
function refreshPanelD() {
  if (raValue !== null) refreshFuResult();
}

/* 結構系統地震力折減係數 Fu 計算（依 (2-12) 式，取用 B 區之 T、T0D） */
function refreshFuResult() {
  show(elDFuBox);

  if (!bPeriodResult) {
    show(elDFuNoData);
    hide(elDFuContent);
    return;
  }
  hide(elDFuNoData);
  show(elDFuContent);

  const { T, t0d } = bPeriodResult;
  const t06 = 0.6 * t0d;
  const t02 = 0.2 * t0d;

  document.getElementById('d-val-t').textContent    = T.toFixed(4)   + ' 秒';
  document.getElementById('d-val-t0d').textContent   = t0d.toFixed(4) + ' 秒';
  document.getElementById('d-val-06t0d').textContent = t06.toFixed(4) + ' 秒';
  document.getElementById('d-val-02t0d').textContent = t02.toFixed(4) + ' 秒';

  const fu = calcFu(T, t0d, raValue);
  document.getElementById('d-val-fu').textContent = fu.value.toFixed(4);
  document.getElementById('d-fu-range').textContent = fu.label;
  document.getElementById('d-fu-formula').innerHTML = fu.formula;
}

/* 依 (2-12) 式之四段規則，求結構系統地震力折減係數 Fu（列出符號式、數值代入式與計算過程） */
function calcFu(T, t0d, Ra) {
  const sq    = Math.sqrt(2 * Ra - 1);
  const t0sup = 'T<sub>0</sub><sup>D</sup>';
  const symFu = 'F<sub>u</sub>';
  const symRa = 'R<sub>a</sub>';
  const symSq = `√(2${symRa}－1)`;
  const RaS   = Ra.toFixed(4);
  const t0dS  = t0d.toFixed(4);
  const TS    = T.toFixed(4);
  const sqS   = sq.toFixed(4);

  if (T >= t0d) {
    return {
      label: 'T ≥ T0D',
      value: Ra,
      formula:
        `${symFu} = ${symRa}<br>` +
        `　= ${RaS}　(2-12)`
    };
  }
  if (T >= 0.6 * t0d) {
    const raMinusSq = Ra - sq;
    const tMinus06  = T - 0.6 * t0d;
    const denom04   = 0.4 * t0d;
    const value     = sq + raMinusSq * tMinus06 / denom04;
    return {
      label: '0.6T0D ≤ T ≤ T0D',
      value,
      formula:
        `${symFu} = ${symSq} + (${symRa}－${symSq}) × (T－0.6${t0sup}) / (0.4${t0sup})<br>` +
        `　= √(2×${RaS}－1) + (${RaS}－${sqS}) × (${TS}－0.6×${t0dS}) / (0.4×${t0dS})<br>` +
        `　= ${sqS} + (${raMinusSq.toFixed(4)}) × (${tMinus06.toFixed(4)}) / (${denom04.toFixed(4)})<br>` +
        `　= ${value.toFixed(4)}　(2-12)`
    };
  }
  if (T >= 0.2 * t0d) {
    return {
      label: '0.2T0D ≤ T ≤ 0.6T0D',
      value: sq,
      formula:
        `${symFu} = ${symSq}<br>` +
        `　= √(2×${RaS}－1)<br>` +
        `　= ${sqS}　(2-12)`
    };
  }
  const sqMinus1 = sq - 1;
  const tMinus02 = T - 0.2 * t0d;
  const denom02  = 0.2 * t0d;
  const value    = sq + sqMinus1 * tMinus02 / denom02;
  return {
    label: 'T ≤ 0.2T0D',
    value,
    formula:
      `${symFu} = ${symSq} + (${symSq}－1) × (T－0.2${t0sup}) / (0.2${t0sup})<br>` +
      `　= √(2×${RaS}－1) + (√(2×${RaS}－1)－1) × (${TS}－0.2×${t0dS}) / (0.2×${t0dS})<br>` +
      `　= ${sqS} + (${sqMinus1.toFixed(4)}) × (${tMinus02.toFixed(4)}) / (${denom02.toFixed(4)})<br>` +
      `　= ${value.toFixed(4)}　(2-12)`
  };
}
