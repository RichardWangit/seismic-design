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
let selectedSoilClass = null; // A 區地盤放大計算所選之地盤分類（1/2/3），供 F 區近斷層分支重算使用
let bPeriodResult = null; // B 區計算結果 { T, t0d }，供 D 區計算 Fu 使用
let bSpectralResult = null; // B 區計算結果 { sad, sam }，供 F 區取用

/* ── 臺北市／新北市（表 2-6(a)(b)(c)）狀態變數 ── */
let taipeiData      = null; // database/seismic_taipei.json
let siteRegionType  = '';   // '' | 'a' | 'b'：A 區查詢命中表2-6(a)臺北盆地微分區 或 表2-6(b)一般震區之里
let taipeiMicroZone = null; // 表2-6(a) 命中時之微分區資訊 { name, sds, sms, t0 }

/* ── C 區狀態變數 ── */
let selectedCategoryId = '';
let selectedItemId     = '';
let selectedImportanceFactor = null; // C 區已確認之用途係數 I，供 F 區取用

/* ── D 區狀態變數 ── */
let selectedAlphaY       = null;
let selectedDCategoryId  = '';
let selectedDGroupId     = '';
let selectedLeaf         = null; // 已選定葉節點 { label, r, height_limit }
let selectedR            = null;
let selectedHeightLimit  = '';
let selectedSiteType     = '';
let raValue              = null;
let dSiteLocked          = false; // Ra 工址類型是否已依 A 區工址位置自動鎖定
let fuResult              = null; // D 區計算結果 { fu, fum }，供 F 區取用

/* ── F 區狀態變數（供 G 區垂直地震力取用） ── */
let fCaseResult = null; // F 區三案例（V／V*／VM）對應之 SaD、SaM 與其未經期距折減之 SDS
                         // { saMin, saVstar, saMce, sdsMin, sdsVstar, sdsMce }

/* ── G 區狀態變數（垂直地震力，2.18 節；R 固定 3.0，與 D 區水平向 R 值互不相干） ── */
let raValueV   = null; // 垂直地震容許韌性容量 Ra,v
let fuvResult  = null; // { fuv, fuvm }

/* ── DOM refs ── */
let elCounty, elDistrict, elZoneRow, elBtnGeneral, elBtnNear,
    elNearRow, elFaultSelect, elDistInput, elQueryBtn,
    elResult, elPlaceholder, elSoilSelect, elSoilBtn, elSiteDesignGrid,
    elNavItems, elContentPanels;

/* ── 臺北市／新北市 DOM refs ── */
let elVillageRow, elVillageSelect, elTaipeiABox, elGeneralCoeffGrid, elSoilCalcRow, elFaultBox;

/* ── B 區 DOM refs ── */
let elBNoData, elBSiteGrid, elBTaipeiGrid, elBT0Row, elBPeriodBox, elBBuildingType,
    elBHeightInput, elBCalcBtn, elBResult;

/* ── C 區 DOM refs ── */
let elCCategories, elCItemsPlaceholder, elCItemsList, elCNote,
    elCConfirmBtn, elCResult, elCPlaceholder;

/* ── D 區 DOM refs ── */
let elDAlphaYGrid, elDValAlphaY, elDCategories, elDItemsPlaceholder, elDCategoryNote,
    elDGroupsList, elDItemsList, elDItemsRow,
    elDConfirmBtn, elDRResult, elDRaBox, elDRaGrid, elDSiteLockNote, elDFuBox, elDFuNoData, elDFuContent;

/* ── F 區 DOM refs ── */
let elFNoData, elFContent, elFNfRecalc;

/* ── G 區 DOM refs ── */
let elGNoData, elGContent;

document.addEventListener('DOMContentLoaded', async () => {
  await loadSections();
  initApp();
});

/* ════════════════════════════
   區塊載入（A／B…各區內容分別置於 sections/ 目錄）
   ════════════════════════════ */
async function loadSections() {
  try {
    const [aRes, bRes, cRes, dRes, eRes, fRes, gRes] = await Promise.all([
      fetch('sections/sec-a.html'),
      fetch('sections/sec-b.html'),
      fetch('sections/sec-c.html'),
      fetch('sections/sec-d.html'),
      fetch('sections/sec-e.html'),
      fetch('sections/sec-f.html'),
      fetch('sections/sec-g.html')
    ]);
    if (!aRes.ok || !bRes.ok || !cRes.ok || !dRes.ok || !eRes.ok || !fRes.ok || !gRes.ok) throw new Error(`HTTP ${aRes.status}/${bRes.status}/${cRes.status}/${dRes.status}/${eRes.status}/${fRes.status}/${gRes.status}`);
    document.getElementById('panel-a').innerHTML = await aRes.text();
    document.getElementById('panel-b').innerHTML = await bRes.text();
    document.getElementById('panel-c').innerHTML = await cRes.text();
    document.getElementById('panel-d').innerHTML = await dRes.text();
    document.getElementById('panel-e').innerHTML = await eRes.text();
    document.getElementById('panel-f').innerHTML = await fRes.text();
    document.getElementById('panel-g').innerHTML = await gRes.text();
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

  elVillageRow       = document.getElementById('village-row');
  elVillageSelect    = document.getElementById('village-select');
  elTaipeiABox       = document.getElementById('taipei-a-box');
  elGeneralCoeffGrid = document.getElementById('general-coeff-grid');
  elSoilCalcRow      = document.getElementById('soil-calc-row');
  elFaultBox         = document.getElementById('fault-box');

  elBNoData        = document.getElementById('b-no-data');
  elBSiteGrid      = document.getElementById('b-site-grid');
  elBTaipeiGrid    = document.getElementById('b-taipei-grid');
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
  elDItemsRow         = document.getElementById('d-items-row');
  elDConfirmBtn       = document.getElementById('d-confirm-btn');
  elDRResult          = document.getElementById('d-r-result');
  elDRaBox            = document.getElementById('d-ra-box');
  elDRaGrid           = document.getElementById('d-ra-grid');
  elDSiteLockNote     = document.getElementById('d-site-lock-note');
  elDFuBox            = document.getElementById('d-fu-box');
  elDFuNoData         = document.getElementById('d-fu-no-data');
  elDFuContent        = document.getElementById('d-fu-content');

  elFNoData  = document.getElementById('f-no-data');
  elFContent = document.getElementById('f-content');
  elFNfRecalc = document.getElementById('f-nf-recalc');

  elGNoData  = document.getElementById('g-no-data');
  elGContent = document.getElementById('g-content');

  /* 初始全隱藏 */
  hide(elZoneRow);
  hide(elNearRow);
  hide(elResult);
  hide(elSiteDesignGrid);
  hide(elVillageRow);
  hide(elTaipeiABox);
  hide(elBSiteGrid);
  hide(elBTaipeiGrid);
  hide(elBT0Row);
  hide(elBPeriodBox);
  hide(elBResult);
  hide(elCResult);
  hide(elDAlphaYGrid);
  hide(elDRResult);
  hide(elDRaBox);
  hide(elDRaGrid);
  hide(elDSiteLockNote);
  hide(elDFuBox);
  hide(elFContent);
  hide(elFNfRecalc);
  hide(elGContent);

  /* 事件綁定 */
  elCounty.addEventListener('change', onCountyChange);
  elDistrict.addEventListener('change', onDistrictChange);
  elVillageSelect.addEventListener('change', onVillageChange);
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
  document.getElementById('btn-site-general').addEventListener('click', () => onSiteTypeClick('general'));
  document.getElementById('btn-site-taipei').addEventListener('click',  () => onSiteTypeClick('taipei'));
  elNavItems.forEach(btn => btn.addEventListener('click', () => selectPanel(btn.dataset.panel)));

  loadData();
}

/* ════════════════════════════
   資料載入
   ════════════════════════════ */
async function loadData() {
  try {
    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      fetch('database/seismic.json'),
      fetch('database/near_fault.json'),
      fetch('database/amplification.json'),
      fetch('database/MCE.json'),
      fetch('database/importance.json'),
      fetch('database/ductility.json'),
      fetch('database/seismic_taipei.json')
    ]);
    if (!r1.ok || !r2.ok || !r3.ok || !r4.ok || !r5.ok || !r6.ok || !r7.ok) throw new Error(`HTTP ${r1.status}/${r2.status}/${r3.status}/${r4.status}/${r5.status}/${r6.status}/${r7.status}`);
    seismicData       = await r1.json();
    nearFaultData     = await r2.json();
    amplificationData = await r3.json();
    mceData           = await r4.json();
    importanceData    = await r5.json();
    ductilityData      = await r6.json();
    taipeiData         = await r7.json();
    populateCounties();
    populateSoilClasses();
    populateBuildingTypes();
    populateImportanceCategories();
    populateDuctilityCategories();
  } catch (err) {
    console.error('資料載入失敗：', err);
    elPlaceholder.textContent = '⚠ 資料載入失敗，請確認 database 目錄下之 seismic.json、near_fault.json、amplification.json、MCE.json、importance.json、ductility.json 與 seismic_taipei.json 是否存在。';
  }
}

function populateCounties() {
  seismicData.forEach((item, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = item.county;
    elCounty.appendChild(opt);
  });
  taipeiData.cities.forEach((item, idx) => {
    const opt = document.createElement('option');
    opt.value = 'tp-' + idx;
    opt.textContent = item.city;
    elCounty.appendChild(opt);
  });
}

/* 判斷目前選取之縣市是否為臺北市／新北市（表 2-6(a)(b)(c) 流程） */
function isTaipeiCounty() {
  return elCounty.value.indexOf('tp-') === 0;
}

function getTaipeiCity() {
  return taipeiData.cities[parseInt(elCounty.value.slice(3), 10)];
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
  if (isTaipeiCounty()) { onCountyChangeTaipei(); return; }

  resetFrom('county');
  hide(elVillageRow);
  elVillageSelect.innerHTML = '<option value="">── 請先選擇鄉鎮市區 ──</option>';
  elVillageSelect.disabled  = true;
  siteRegionType  = '';
  taipeiMicroZone = null;

  if (elCounty.value === '') { elDistrict.disabled = true; return; }
  seismicData[elCounty.value].districts.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = d.name;
    elDistrict.appendChild(opt);
  });
  elDistrict.disabled = false;
}

/* 縣市變更（臺北市／新北市，表 2-6(a)(b)(c) 流程） */
function onCountyChangeTaipei() {
  hide(elResult);
  hide(elZoneRow);
  hide(elNearRow);
  siteRegionType  = '';
  taipeiMicroZone = null;

  elDistrict.innerHTML = '<option value="">── 請選擇鄉鎮市區 ──</option>';
  elVillageSelect.innerHTML = '<option value="">── 請先選擇鄉鎮市區 ──</option>';
  elVillageSelect.disabled  = true;
  hide(elVillageRow);

  getTaipeiCity().districts.forEach((d, i) => {
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
  if (isTaipeiCounty()) { onDistrictChangeTaipei(); return; }

  resetFrom('district');
  if (elDistrict.value === '') return;
  const d = getDistData();
  if (d.faults && d.faults.length > 0) show(elZoneRow);
}

/* 鄉鎮變更（臺北市／新北市）：依所屬區填入「里」選單（表 2-6(a)/(b) 混合或全區適用） */
function onDistrictChangeTaipei() {
  hide(elResult);
  siteRegionType  = '';
  taipeiMicroZone = null;

  elVillageSelect.innerHTML = '<option value="">── 請選擇里 ──</option>';
  if (elDistrict.value === '') {
    elVillageSelect.disabled = true;
    hide(elVillageRow);
    return;
  }

  const dist = getTaipeiCity().districts[elDistrict.value];
  if (dist.villages === 'all') {
    const opt = document.createElement('option');
    opt.value = 'all';
    opt.textContent = '（全區適用）';
    elVillageSelect.appendChild(opt);
  } else {
    dist.villages.forEach((v, i) => {
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = v.name;
      elVillageSelect.appendChild(opt);
    });
  }
  elVillageSelect.disabled = false;
  show(elVillageRow);
}

/* 里變更（臺北市／新北市）：先前查覽結果失效 */
function onVillageChange() {
  hide(elResult);
  siteRegionType  = '';
  taipeiMicroZone = null;
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
  if (!elCounty.value) { alert('請先選擇縣市'); return; }

  if (isTaipeiCounty()) { onQueryTaipei(); return; }

  if (!elDistrict.value) { alert('請先選擇鄉鎮市區'); return; }

  const county = seismicData[elCounty.value].county;
  const d      = getDistData();
  siteRegionType  = '';
  taipeiMicroZone = null;

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

/* 查詢（臺北市／新北市，依表 2-6(a)(b)(c) 分流） */
function onQueryTaipei() {
  if (!elDistrict.value)      { alert('請先選擇鄉鎮市區'); return; }
  if (!elVillageSelect.value) { alert('請先選擇里');       return; }

  const city = getTaipeiCity();
  const dist = city.districts[elDistrict.value];

  let record, villageLabel;
  if (dist.villages === 'all') {
    record = dist;
    villageLabel = '（全區適用）';
  } else {
    record = dist.villages[elVillageSelect.value];
    villageLabel = record.name;
  }

  const districtLabel = dist.name + '・' + villageLabel;

  if (record.table === 'a') {
    siteRegionType = 'a';
    renderTaipeiZoneResult(city.city, districtLabel, record.microZone);
  } else {
    siteRegionType  = 'b';
    taipeiMicroZone = null;
    renderResult(city.city, {
      name: districtLabel,
      dss: record.dss, ds1: record.ds1, mss: record.mss, ms1: record.ms1,
      faults: []
    }, 'general-nofault', null, null);
  }
}

/* 表 2-6(a) 臺北盆地微分區結果渲染（依表 2-6(c) 直接查得，無需地盤放大計算） */
function renderTaipeiZoneResult(county, districtLabel, microZoneName) {
  document.getElementById('result-county').textContent   = county;
  document.getElementById('result-district').textContent = districtLabel;

  const modeEl = document.getElementById('result-mode');
  modeEl.textContent = `◆ 臺北盆地微分區「${microZoneName}」｜依表 2-6(c) 直接查得工址係數`;
  modeEl.className   = 'result__mode mode--general';

  const zone = taipeiData.microZones[microZoneName];
  taipeiMicroZone = { name: microZoneName, sds: zone.sds, sms: zone.sms, t0: zone.t0 };

  document.getElementById('val-taipei-zone').textContent = microZoneName;
  document.getElementById('val-taipei-sds').textContent  = zone.sds.toFixed(2);
  document.getElementById('val-taipei-sms').textContent  = zone.sms.toFixed(2);
  document.getElementById('val-taipei-t0d').textContent  = zone.t0.toFixed(2) + ' 秒';
  document.getElementById('val-taipei-t0m').textContent  = zone.t0.toFixed(2) + ' 秒';

  hide(elGeneralCoeffGrid);
  hide(elSoilCalcRow);
  hide(elSiteDesignGrid);
  hide(elFaultBox);
  show(elTaipeiABox);

  elPlaceholder.style.display = 'none';
  show(elResult);

  /* D 區若已完成 R 值查詢，同步更新 Ra 工址類型鎖定 */
  applyDSiteLock();
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
  selectedSoilClass = cls;

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

  /* 一般流程（含表 2-6(b) 一般震區之里）：還原表 2-6(a) 微分區結果面板為隱藏 */
  hide(elTaipeiABox);
  show(elGeneralCoeffGrid);
  show(elSoilCalcRow);
  show(elFaultBox);

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

  /* D 區若已完成 R 值查詢，同步更新 Ra 工址類型鎖定 */
  applyDSiteLock();
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
  if (el.id === 'near-row' || el.id === 'c-items-list' || el.id === 'd-groups-list') el.style.display = 'flex';
  else if (el.id === 'site-design-grid' || el.id === 'b-site-grid' || el.id === 'd-alpha-y-grid' || el.id === 'd-ra-grid' || el.id === 'general-coeff-grid') el.style.display = 'grid';
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
  if (panelId === 'panel-f') refreshPanelF();
  if (panelId === 'panel-g') refreshPanelG();
}

/* ════════════════════════════
   B 區：工址設計與最大考量水平譜加速度係數（2.6 節）
   ════════════════════════════ */

/* 切入 B 區時，同步 A 區之工址係數（表 2-6(a) 微分區：siteRegionType==='a'；否則沿用 siteCoeffs） */
function refreshPanelB() {
  document.getElementById('b-t0-row-label').textContent =
    siteRegionType === 'a' ? '⊹ 短週期與中、長週期分界（取自 A 區表 2-6(c) 微分區查詢結果）' : '⊹ 短週期與中、長週期分界（依 2-6 式計算）';

  if (siteRegionType === 'a') {
    hide(elBSiteGrid);

    if (!taipeiMicroZone) {
      show(elBNoData);
      hide(elBTaipeiGrid);
      hide(elBT0Row);
      hide(elBPeriodBox);
      hide(elBResult);
      return;
    }

    hide(elBNoData);
    show(elBTaipeiGrid);
    show(elBT0Row);
    show(elBPeriodBox);

    document.getElementById('b-val-taipei-sds').textContent = taipeiMicroZone.sds.toFixed(2);
    document.getElementById('b-val-taipei-sms').textContent = taipeiMicroZone.sms.toFixed(2);

    const t0 = taipeiMicroZone.t0;
    document.getElementById('b-val-t0d').textContent = t0.toFixed(2) + ' 秒';
    document.getElementById('b-t0d-formula').innerHTML =
      `T<sub>0</sub><sup>D</sup> = ${t0.toFixed(2)} 秒　（表 2-6(c)，臺北盆地「${taipeiMicroZone.name}」）`;

    document.getElementById('b-val-t0m').textContent = t0.toFixed(2) + ' 秒';
    document.getElementById('b-t0m-formula').innerHTML =
      `T<sub>0</sub><sup>M</sup> = ${t0.toFixed(2)} 秒　（表 2-6(c)，臺北盆地「${taipeiMicroZone.name}」）`;
    return;
  }

  hide(elBTaipeiGrid);

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

/* 計算建築物基本振動週期 T，並依表 2-5(a)／2-5(b)（或臺北盆地微分區之表 2-7(a)／2-7(b)）求 SaD、SaM */
function onBCalc() {
  if (siteRegionType === 'a') {
    if (!taipeiMicroZone) { alert('請先於 A 區完成臺北盆地微分區查詢'); return; }
  } else if (!siteCoeffs) {
    alert('請先於 A 區完成工址地盤放大計算'); return;
  }
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

  let t0d, t0m, sad, sam;

  if (siteRegionType === 'a') {
    t0d = taipeiMicroZone.t0;
    t0m = taipeiMicroZone.t0;
    bPeriodResult = { T, t0d };

    document.getElementById('b-sad-table-label').innerHTML = '⊹ 工址設計水平譜加速度係數 S<sub>aD</sub>（表 2-7(a)）';
    document.getElementById('b-sam-table-label').innerHTML = '⊹ 工址最大考量水平譜加速度係數 S<sub>aM</sub>（表 2-7(b)）';

    sad = calcSpectralAccelTaipei(T, t0d, taipeiMicroZone.sds, 'D');
    sam = calcSpectralAccelTaipei(T, t0m, taipeiMicroZone.sms, 'M');
  } else {
    t0d = siteCoeffs.sd1 / siteCoeffs.sds;
    t0m = siteCoeffs.sm1 / siteCoeffs.sms;
    bPeriodResult = { T, t0d };

    document.getElementById('b-sad-table-label').innerHTML = '⊹ 工址設計水平譜加速度係數 S<sub>aD</sub>（表 2-5(a)）';
    document.getElementById('b-sam-table-label').innerHTML = '⊹ 工址最大考量水平譜加速度係數 S<sub>aM</sub>（表 2-5(b)）';

    sad = calcSpectralAccel(T, t0d, siteCoeffs.sds, siteCoeffs.sd1, 'D');
    sam = calcSpectralAccel(T, t0m, siteCoeffs.sms, siteCoeffs.sm1, 'M');
  }

  bSpectralResult = { sad: sad.value, sam: sam.value };

  document.getElementById('b-val-sad-02t0d').textContent = (0.2 * t0d).toFixed(4) + ' 秒';
  document.getElementById('b-val-sad-t0d').textContent    = t0d.toFixed(4) + ' 秒';
  document.getElementById('b-val-sad-25t0d').textContent  = (2.5 * t0d).toFixed(4) + ' 秒';

  document.getElementById('b-val-sam-02t0m').textContent = (0.2 * t0m).toFixed(4) + ' 秒';
  document.getElementById('b-val-sam-t0m').textContent    = t0m.toFixed(4) + ' 秒';
  document.getElementById('b-val-sam-25t0m').textContent  = (2.5 * t0m).toFixed(4) + ' 秒';

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

/* 依表 2-7(a)／2-7(b) 之四段式規則（臺北盆地微分區專用，以 SDS／SMS 及 T0 直接代入，不經 SD1／SM1）求反應譜加速度係數 */
function calcSpectralAccelTaipei(T, t0, Ss, kind) {
  const sub   = kind === 'D' ? '<sub>DS</sub>' : '<sub>MS</sub>';
  const subA  = kind === 'D' ? '<sub>aD</sub>' : '<sub>aM</sub>';
  const t0sup = kind === 'D' ? 'T<sub>0</sub><sup>D</sup>' : 'T<sub>0</sub><sup>M</sup>';
  const t0lbl = kind === 'D' ? 'T0D' : 'T0M';

  if (T <= 0.2 * t0) {
    const value = Ss * (0.4 + 3 * T / t0);
    return {
      label: '較短週期（T ≤ 0.2' + t0lbl + '）',
      value,
      formula: `S${subA} = S${sub} × (0.4 + 3T / ${t0sup}) = ${Ss.toFixed(2)} × (0.4 + 3×${T.toFixed(4)}/${t0.toFixed(4)}) = ${value.toFixed(4)}　(2-7)`
    };
  }
  if (T <= t0) {
    return {
      label: '短週期（0.2' + t0lbl + ' < T ≤ ' + t0lbl + '）',
      value: Ss,
      formula: `S${subA} = S${sub} = ${Ss.toFixed(4)}　(2-7)`
    };
  }
  if (T <= 2.5 * t0) {
    const value = Ss * t0 / T;
    return {
      label: '中週期（' + t0lbl + ' < T ≤ 2.5' + t0lbl + '）',
      value,
      formula: `S${subA} = S${sub} × ${t0sup} / T = ${Ss.toFixed(2)} × ${t0.toFixed(4)} / ${T.toFixed(4)} = ${value.toFixed(4)}　(2-7)`
    };
  }
  const value = 0.4 * Ss;
  return {
    label: '長週期（2.5' + t0lbl + ' < T）',
    value,
    formula: `S${subA} = 0.4 × S${sub} = 0.4 × ${Ss.toFixed(2)} = ${value.toFixed(4)}　(2-7)`
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
  selectedImportanceFactor = cat.factor;

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
  hide(elDItemsRow);

  elDConfirmBtn.disabled = true;
  hide(elDRResult);
  hide(elDRaBox);
  hide(elDRaGrid);
  hide(elDSiteLockNote);
  dSiteLocked = false;
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
    hide(elDItemsRow);
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
  show(elDItemsRow);
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

  /* R 值變更，重設下游之 Ra／Fu 計算，並依 A 區工址位置自動鎖定 Ra 類型 */
  selectedSiteType = '';
  raValue = null;
  document.getElementById('d-site-general').checked = false;
  document.getElementById('d-site-taipei').checked  = false;
  document.getElementById('btn-site-general').classList.remove('is-selected');
  document.getElementById('btn-site-taipei').classList.remove('is-selected');
  hide(elDRaGrid);
  hide(elDFuBox);

  show(elDRaBox);
  applyDSiteLock();
}

/* 工址類型卡片點擊入口：鎖定期間不回應點擊 */
function onSiteTypeClick(type) {
  if (dSiteLocked) return;
  selectSiteType(type);
}

/* 依 A 區工址位置（siteRegionType）自動選定並鎖定 Ra 工址類型：
   表 2-6(a) 臺北盆地微分區 → 「臺北盆地」；其餘（含表 2-6(b) 一般震區之里與既有各縣市） → 「一般工址與近斷層工址」 */
function applyDSiteLock() {
  if (selectedR === null) return;

  const target = siteRegionType === 'a' ? 'taipei' : 'general';
  const other  = target === 'taipei' ? 'general' : 'taipei';

  selectSiteType(target);
  dSiteLocked = true;

  document.getElementById('btn-site-' + target).classList.remove('is-locked');
  document.getElementById('btn-site-' + other).classList.add('is-locked');

  elDSiteLockNote.textContent = target === 'taipei'
    ? '⊹ 已依 A 區工址位置（表 2-6(a) 臺北盆地微分區）自動鎖定為「臺北盆地」。'
    : '⊹ 已依 A 區工址位置自動鎖定為「一般工址與近斷層工址」。';
  show(elDSiteLockNote);
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

  const fum = calcFuM(T, t0d, selectedR);
  document.getElementById('d-val-fum').textContent = fum.value.toFixed(4);
  document.getElementById('d-fum-range').textContent = fum.label;
  document.getElementById('d-fum-formula').innerHTML = fum.formula;

  fuResult = { fu: fu.value, fum: fum.value };
}

/* 依 (2-12) 式之四段規則，求折減係數（列出符號式、數值代入式與計算過程）
   X 為代入 (2-12) 式之韌性容量值，symX／symOut 為其顯示符號（Ra／Fu 或 R／FuM） */
function calcFuByFormula(T, t0d, X, symX, symOut) {
  const sq    = Math.sqrt(2 * X - 1);
  const t0sup = 'T<sub>0</sub><sup>D</sup>';
  const symSq = `√(2${symX}－1)`;
  const XS    = X.toFixed(4);
  const t0dS  = t0d.toFixed(4);
  const TS    = T.toFixed(4);
  const sqS   = sq.toFixed(4);

  if (T >= t0d) {
    return {
      label: 'T ≥ T0D',
      value: X,
      formula:
        `${symOut} = ${symX}<br>` +
        `　= ${XS}　(2-12)`
    };
  }
  if (T >= 0.6 * t0d) {
    const xMinusSq = X - sq;
    const tMinus06 = T - 0.6 * t0d;
    const denom04  = 0.4 * t0d;
    const value    = sq + xMinusSq * tMinus06 / denom04;
    return {
      label: '0.6T0D ≤ T ≤ T0D',
      value,
      formula:
        `${symOut} = ${symSq} + (${symX}－${symSq}) × (T－0.6${t0sup}) / (0.4${t0sup})<br>` +
        `　= √(2×${XS}－1) + (${XS}－${sqS}) × (${TS}－0.6×${t0dS}) / (0.4×${t0dS})<br>` +
        `　= ${sqS} + (${xMinusSq.toFixed(4)}) × (${tMinus06.toFixed(4)}) / (${denom04.toFixed(4)})<br>` +
        `　= ${value.toFixed(4)}　(2-12)`
    };
  }
  if (T >= 0.2 * t0d) {
    return {
      label: '0.2T0D ≤ T ≤ 0.6T0D',
      value: sq,
      formula:
        `${symOut} = ${symSq}<br>` +
        `　= √(2×${XS}－1)<br>` +
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
      `${symOut} = ${symSq} + (${symSq}－1) × (T－0.2${t0sup}) / (0.2${t0sup})<br>` +
      `　= √(2×${XS}－1) + (√(2×${XS}－1)－1) × (${TS}－0.2×${t0dS}) / (0.2×${t0dS})<br>` +
      `　= ${sqS} + (${sqMinus1.toFixed(4)}) × (${tMinus02.toFixed(4)}) / (${denom02.toFixed(4)})<br>` +
      `　= ${value.toFixed(4)}　(2-12)`
  };
}

/* 結構系統地震力折減係數 Fu（以容許韌性容量 Ra 代入） */
function calcFu(T, t0d, Ra) {
  return calcFuByFormula(T, t0d, Ra, 'R<sub>a</sub>', 'F<sub>u</sub>');
}

/* 結構系統地震力折減係數 FuM（以韌性容量 R 值取代 Ra 代入） */
function calcFuM(T, t0d, R) {
  return calcFuByFormula(T, t0d, R, 'R', 'F<sub>uM</sub>');
}

/* ════════════════════════════
   F 區：設計地震力（2.2、2.10.1、2.10.2 節）
   ════════════════════════════ */

/* 依 (2-2)／(2-13d) 式之三段規則，計算 Sa/Fu 修正值
   kind：'D' → SaD/Fu 符號；'M' → SaM/FuM 符號；eqLabel 為引用之式號 */
function calcRatioMod(sa, fu, kind, eqLabel) {
  const symSa  = kind === 'D' ? 'S<sub>aD</sub>' : 'S<sub>aM</sub>';
  const symFu  = kind === 'D' ? 'F<sub>u</sub>'  : 'F<sub>uM</sub>';
  const ratio  = sa / fu;
  const saS    = sa.toFixed(4);
  const fuS    = fu.toFixed(4);
  const ratioS = ratio.toFixed(4);

  const ratioFormula = `${symSa} / ${symFu} = ${saS} / ${fuS} = ${ratioS}`;

  let mod, label, modFormula;
  if (ratio <= 0.3) {
    mod = ratio;
    label = `${symSa}/${symFu} ≤ 0.3`;
    modFormula = `(${symSa}/${symFu})<sub>m</sub> = ${symSa}/${symFu} = ${ratioS}　${eqLabel}`;
  } else if (ratio < 0.8) {
    mod = 0.52 * ratio + 0.144;
    label = `0.3 < ${symSa}/${symFu} < 0.8`;
    modFormula = `(${symSa}/${symFu})<sub>m</sub> = 0.52 × ${symSa}/${symFu} + 0.144 = 0.52 × ${ratioS} + 0.144 = ${mod.toFixed(4)}　${eqLabel}`;
  } else {
    mod = 0.70 * ratio;
    label = `${symSa}/${symFu} ≥ 0.8`;
    modFormula = `(${symSa}/${symFu})<sub>m</sub> = 0.70 × ${symSa}/${symFu} = 0.70 × ${ratioS} = ${mod.toFixed(4)}　${eqLabel}`;
  }

  return { ratio, mod, label, ratioFormula, modFormula };
}

/* 切入 F 區時，彙整 B（SaD／SaM）、C（I）、D（Fu／FuM）、E（αy）之成果，
   計算 V（2-3 式）、V*（2-13a／2-13b 式）、VM（2-13c 式） */
function refreshPanelF() {
  if (!bSpectralResult || !fuResult || selectedImportanceFactor === null || selectedAlphaY === null) {
    show(elFNoData);
    hide(elFContent);
    return;
  }
  hide(elFNoData);
  show(elFContent);

  const I   = selectedImportanceFactor;
  const ay  = selectedAlphaY;
  const sad = bSpectralResult.sad;
  const sam = bSpectralResult.sam;
  const fu  = fuResult.fu;
  const fum = fuResult.fum;

  /* ── F-1：最小設計水平總橫力 V（(2-1)～(2-3) 式） ── */
  document.getElementById('f-val-sad').textContent    = sad.toFixed(4);
  document.getElementById('f-val-fu').textContent     = fu.toFixed(4);
  document.getElementById('f-val-i').textContent      = I.toFixed(2);
  document.getElementById('f-val-alphay').textContent = ay.toFixed(1);

  const rv = calcRatioMod(sad, fu, 'D', '(2-2)');
  document.getElementById('f-val-ratio-v').textContent   = rv.ratio.toFixed(4);
  document.getElementById('f-ratio-v-formula').innerHTML = rv.ratioFormula;
  document.getElementById('f-val-mod-v').textContent     = rv.mod.toFixed(4);
  document.getElementById('f-mod-v-range').innerHTML     = rv.label;
  document.getElementById('f-mod-v-formula').innerHTML   = rv.modFormula;

  const vCoeff = I / (1.4 * ay) * rv.mod;
  document.getElementById('f-val-v').textContent   = `${vCoeff.toFixed(4)} × W`;
  document.getElementById('f-v-formula').innerHTML =
    `V = I / (1.4α<sub>y</sub>) × (S<sub>aD</sub>/F<sub>u</sub>)<sub>m</sub> × W = ` +
    `${I.toFixed(2)} / (1.4×${ay.toFixed(1)}) × ${rv.mod.toFixed(4)} × W = ${vCoeff.toFixed(4)} × W　(2-3)`;

  /* ── F-2：避免中小度地震降伏之設計地震力 V*（2.10.1 節） ── */
  const modeNoteEl = document.getElementById('f-vstar-mode-note');
  let sadForVstar, vstarDivisor, vstarEq, sdsForVstarRaw;

  if (selectedZone === 'near') {
    show(elFNfRecalc);
    modeNoteEl.textContent =
      '⊹ A 區工址位置屬近斷層，依 2.10.1 節規定，(2-13a) 式中之 SaD 不須考慮近斷層效應，逕以表 2-1 之值重新計算工址係數；近斷層工址依規定採 (2-13a) 式計算 V*。';

    const d = getDistData();
    const dssNf = +d.dss, ds1Nf = +d.ds1, mssNf = +d.mss, ms1Nf = +d.ms1;

    document.getElementById('f-nf-val-dss').textContent = dssNf.toFixed(2);
    document.getElementById('f-nf-val-ds1').textContent = ds1Nf.toFixed(2);
    document.getElementById('f-nf-val-mss').textContent = mssNf.toFixed(2);
    document.getElementById('f-nf-val-ms1').textContent = ms1Nf.toFixed(2);

    const cls    = selectedSoilClass;
    const faVals = amplificationData.fa.soil_classes.find(c => c.class === cls).values;
    const fvVals = amplificationData.fv.soil_classes.find(c => c.class === cls).values;
    const faSs   = amplificationData.fa.ss_nodes;
    const fvS1   = amplificationData.fv.s1_nodes;

    const faDssNf = interpNodes(faSs, faVals, dssNf);
    const fvDs1Nf = interpNodes(fvS1, fvVals, ds1Nf);
    const faMssNf = interpNodes(faSs, faVals, mssNf);
    const fvMs1Nf = interpNodes(fvS1, fvVals, ms1Nf);

    const sdsNf = faDssNf * dssNf;
    const sd1Nf = fvDs1Nf * ds1Nf;
    const smsNf = faMssNf * mssNf;
    const sm1Nf = fvMs1Nf * ms1Nf;

    document.getElementById('f-nf-val-sds').textContent    = sdsNf.toFixed(2);
    document.getElementById('f-nf-val-fa-sds').textContent = faDssNf.toFixed(2);
    document.getElementById('f-nf-val-sd1').textContent    = sd1Nf.toFixed(2);
    document.getElementById('f-nf-val-fv-sd1').textContent = fvDs1Nf.toFixed(2);
    document.getElementById('f-nf-val-sms').textContent    = smsNf.toFixed(2);
    document.getElementById('f-nf-val-fa-sms').textContent = faMssNf.toFixed(2);
    document.getElementById('f-nf-val-sm1').textContent    = sm1Nf.toFixed(2);
    document.getElementById('f-nf-val-fv-sm1').textContent = fvMs1Nf.toFixed(2);

    const t0dNf = sd1Nf / sdsNf;
    document.getElementById('f-nf-val-t0d').textContent = t0dNf.toFixed(4) + ' 秒';
    document.getElementById('f-nf-t0d-formula').innerHTML =
      `T<sub>0</sub><sup>D</sup> = S<sub>D1</sub> / S<sub>DS</sub> = ${sd1Nf.toFixed(2)} / ${sdsNf.toFixed(2)} = ${t0dNf.toFixed(4)} 秒　(2-6)`;

    const sadNf = calcSpectralAccel(bPeriodResult.T, t0dNf, sdsNf, sd1Nf, 'D');
    document.getElementById('f-nf-val-sad').textContent = sadNf.value.toFixed(4);

    let sadNfRangeHtml = sadNf.label;
    if (bPeriodResult.T <= 0.2 * t0dNf) {
      sadNfRangeHtml += `　T = ${bPeriodResult.T.toFixed(4)} 秒，` +
        `0.2T<sub>0</sub><sup>D</sup> = ${(0.2 * t0dNf).toFixed(4)} 秒`;
    } else if (bPeriodResult.T <= t0dNf) {
      sadNfRangeHtml += `　0.2T<sub>0</sub><sup>D</sup> = ${(0.2 * t0dNf).toFixed(4)} 秒，` +
        `T = ${bPeriodResult.T.toFixed(4)} 秒，` +
        `T<sub>0</sub><sup>D</sup> = ${t0dNf.toFixed(4)} 秒`;
    } else if (bPeriodResult.T <= 2.5 * t0dNf) {
      sadNfRangeHtml += `　T<sub>0</sub><sup>D</sup> = ${t0dNf.toFixed(4)} 秒，` +
        `T = ${bPeriodResult.T.toFixed(4)} 秒，` +
        `2.5T<sub>0</sub><sup>D</sup> = ${(2.5 * t0dNf).toFixed(4)} 秒`;
    } else {
      sadNfRangeHtml += `　2.5T<sub>0</sub><sup>D</sup> = ${(2.5 * t0dNf).toFixed(4)} 秒，` +
        `T = ${bPeriodResult.T.toFixed(4)} 秒`;
    }
    document.getElementById('f-nf-sad-range').innerHTML   = sadNfRangeHtml;
    document.getElementById('f-nf-sad-formula').innerHTML = sadNf.formula;

    sadForVstar    = sadNf.value;
    sdsForVstarRaw = sdsNf;
    vstarDivisor   = 4.2;
    vstarEq        = '(2-13a)';

    document.getElementById('f-vstar-params-label').innerHTML = '⊹ 不考慮近斷層效應之 S<sub>aD</sub> 與 F<sub>u</sub>';
  } else {
    hide(elFNfRecalc);
    sadForVstar    = sad; // 非近斷層：直接沿用 F-1（B 區）之 SaD
    sdsForVstarRaw = siteRegionType === 'a' ? taipeiMicroZone.sds : siteCoeffs.sds;

    if (siteRegionType === 'a') {
      modeNoteEl.textContent =
        '⊹ A 區工址位置為非近斷層，且位於表 2-6(a) 臺北盆地微分區，依 2.10.1 節採 (2-13b) 式計算 V*，SaD 沿用 B 區計算成果。';
      vstarDivisor = 3.5;
      vstarEq      = '(2-13b)';
    } else {
      modeNoteEl.textContent =
        '⊹ A 區工址位置為非近斷層，依 2.10.1 節採 (2-13a) 式計算 V*，SaD 沿用 B 區計算成果。';
      vstarDivisor = 4.2;
      vstarEq      = '(2-13a)';
    }
    document.getElementById('f-vstar-params-label').innerHTML = '⊹ S<sub>aD</sub> 與 F<sub>u</sub>（SaD 同取自 B 區）';
  }

  document.getElementById('f-val-sad-vstar').textContent = sadForVstar.toFixed(4);
  document.getElementById('f-val-fu-vstar').textContent  = fu.toFixed(4);

  const rvs = calcRatioMod(sadForVstar, fu, 'D', '(2-2)');
  document.getElementById('f-val-ratio-vstar').textContent   = rvs.ratio.toFixed(4);
  document.getElementById('f-ratio-vstar-formula').innerHTML = rvs.ratioFormula;
  document.getElementById('f-val-mod-vstar').textContent     = rvs.mod.toFixed(4);
  document.getElementById('f-mod-vstar-range').innerHTML     = rvs.label;
  document.getElementById('f-mod-vstar-formula').innerHTML   = rvs.modFormula;

  const vStarCoeff = (I * fu) / (vstarDivisor * ay) * rvs.mod;
  document.getElementById('f-vstar-eq-label').textContent =
    `⊹ 避免中小度地震降伏之設計地震力（依 ${vstarEq} 式，W 為建築物全部靜載重）`;
  document.getElementById('f-val-vstar').textContent = `${vStarCoeff.toFixed(4)} × W`;
  document.getElementById('f-vstar-formula').innerHTML =
    `V* = IF<sub>u</sub> / (${vstarDivisor.toFixed(1)}α<sub>y</sub>) × (S<sub>aD</sub>/F<sub>u</sub>)<sub>m</sub> × W = ` +
    `${I.toFixed(2)}×${fu.toFixed(4)} / (${vstarDivisor.toFixed(1)}×${ay.toFixed(1)}) × ${rvs.mod.toFixed(4)} × W = ${vStarCoeff.toFixed(4)} × W　${vstarEq}`;

  /* ── F-3：避免最大考量地震崩塌之設計地震力 VM（2.10.2 節） ── */
  document.getElementById('f-val-sam').textContent = sam.toFixed(4);
  document.getElementById('f-val-fum').textContent = fum.toFixed(4);

  const rm = calcRatioMod(sam, fum, 'M', '(2-13d)');
  document.getElementById('f-val-ratio-vm').textContent   = rm.ratio.toFixed(4);
  document.getElementById('f-ratio-vm-formula').innerHTML = rm.ratioFormula;
  document.getElementById('f-val-mod-vm').textContent     = rm.mod.toFixed(4);
  document.getElementById('f-mod-vm-range').innerHTML     = rm.label;
  document.getElementById('f-mod-vm-formula').innerHTML   = rm.modFormula;

  const vmCoeff = I / (1.4 * ay) * rm.mod;
  document.getElementById('f-val-vm').textContent   = `${vmCoeff.toFixed(4)} × W`;
  document.getElementById('f-vm-formula').innerHTML =
    `V<sub>M</sub> = I / (1.4α<sub>y</sub>) × (S<sub>aM</sub>/F<sub>uM</sub>)<sub>m</sub> × W = ` +
    `${I.toFixed(2)} / (1.4×${ay.toFixed(1)}) × ${rm.mod.toFixed(4)} × W = ${vmCoeff.toFixed(4)} × W　(2-13c)`;

  /* ── F-4：三力並列 ── */
  document.getElementById('f-val-v-final').textContent     = `${vCoeff.toFixed(4)} × W`;
  document.getElementById('f-val-vstar-final').textContent = `${vStarCoeff.toFixed(4)} × W`;
  document.getElementById('f-val-vm-final').textContent    = `${vmCoeff.toFixed(4)} × W`;

  /* 三案例之 SaD／SaM 與其未經期距折減之 SDS，供 G 區垂直地震力（2.18 節）取用 */
  fCaseResult = {
    saMin: sad,
    saVstar: sadForVstar,
    saMce: sam,
    sdsMin: siteRegionType === 'a' ? taipeiMicroZone.sds : siteCoeffs.sds,
    sdsVstar: sdsForVstarRaw,
    sdsMce: siteRegionType === 'a' ? taipeiMicroZone.sms : siteCoeffs.sms
  };
}

/* ════════════════════════════
   G 區：垂直地震力（2.18 節）
   ════════════════════════════ */

/* 依 (2-19) 式，由水平向 SaD／SaM 換算垂直向 SaD,V／SaM,V：
   一般區域與臺北盆地之工址 → 1/2 倍；近斷層工址 → 2/3 倍 */
function calcSaDV(sa, zone, symIn, symOut) {
  const near = zone === 'near';
  const factor = near ? 2 / 3 : 1 / 2;
  const factorLabel = near ? '2/3' : '1/2';
  const value = sa * factor;
  return {
    value,
    formula: `${symOut} = ${factorLabel} × ${symIn} = ${factorLabel} × ${sa.toFixed(4)} = ${value.toFixed(4)}　(2-19)`
  };
}

/* 依 (C2-11a)（一般區域與臺北盆地）／(C2-11b)（近斷層）式之三段規則，求 (SaD,V/Fuv)m 或 (SaM,V/FuvM)m */
function calcRatioModVertical(saV, fuv, zone, symSa, symFu, eqLabel) {
  const near = zone === 'near';
  const b1 = near ? 0.2  : 0.15;
  const b2 = near ? 0.53 : 0.4;
  const c  = near ? 0.096 : 0.072;

  const ratio  = saV / fuv;
  const saS    = saV.toFixed(4);
  const fuS    = fuv.toFixed(4);
  const ratioS = ratio.toFixed(4);
  const ratioFormula = `${symSa} / ${symFu} = ${saS} / ${fuS} = ${ratioS}`;

  let mod, label, modFormula;
  if (ratio <= b1) {
    mod = ratio;
    label = `${symSa}/${symFu} ≤ ${b1}`;
    modFormula = `(${symSa}/${symFu})<sub>m</sub> = ${symSa}/${symFu} = ${ratioS}　${eqLabel}`;
  } else if (ratio < b2) {
    mod = 0.52 * ratio + c;
    label = `${b1} < ${symSa}/${symFu} < ${b2}`;
    modFormula = `(${symSa}/${symFu})<sub>m</sub> = 0.52 × ${symSa}/${symFu} + ${c} = 0.52 × ${ratioS} + ${c} = ${mod.toFixed(4)}　${eqLabel}`;
  } else {
    mod = 0.70 * ratio;
    label = `${symSa}/${symFu} ≥ ${b2}`;
    modFormula = `(${symSa}/${symFu})<sub>m</sub> = 0.70 × ${symSa}/${symFu} = 0.70 × ${ratioS} = ${mod.toFixed(4)}　${eqLabel}`;
  }

  return { ratio, mod, label, ratioFormula, modFormula };
}

/* 柱垂直地震力係數（2.18 節解說）：一般區域與臺北盆地之工址 0.40SDS·I/(2αy)；近斷層工址 0.80SDS·I/(3αy) */
function calcColumnCoeff(sds, I, ay, zone) {
  const near = zone === 'near';
  const numCoeff = near ? 0.80 : 0.40;
  const divisor  = near ? 3 : 2;
  const value = numCoeff * sds * I / (divisor * ay);
  const formula =
    `${numCoeff.toFixed(2)} × S<sub>DS</sub> × I / (${divisor}α<sub>y</sub>) = ` +
    `${numCoeff.toFixed(2)} × ${sds.toFixed(2)} × ${I.toFixed(2)} / (${divisor}×${ay.toFixed(1)}) = ${value.toFixed(4)}`;
  return { value, formula };
}

/* 切入 G 區時，彙整 A（selectedZone／siteRegionType）、B（T／T0D）、C（I）、E（αy）、
   F（三案例 SaD／SaM／SDS，取自 fCaseResult）之成果，
   計算樓版系統垂直地震力 Vz（依 (2-19)、(C2-10)、(C2-11a/b)）與柱垂直地震力係數（2.18 節解說） */
function refreshPanelG() {
  refreshPanelF(); // 確保 F 區三案例之 fCaseResult 為最新（refreshPanelF 為純重算，無副作用）

  if (!bPeriodResult || !fCaseResult || selectedImportanceFactor === null || selectedAlphaY === null) {
    show(elGNoData);
    hide(elGContent);
    return;
  }
  hide(elGNoData);
  show(elGContent);

  const zone = selectedZone; // 'near' → 近斷層工址；其餘 → 一般區域與臺北盆地之工址（(2-19)/(C2-11a,b)/柱公式所依據之分類）
  const I  = selectedImportanceFactor;
  const ay = selectedAlphaY;

  const zoneLockNoteEl = document.getElementById('g-zone-lock-note');
  zoneLockNoteEl.textContent = zone === 'near'
    ? '⊹ 已依 A 區工址位置自動鎖定為「近斷層工址」，垂直地震力採 SaD,V = (2/3)SaD、(C2-11b) 式與柱公式 0.80SDS·I/(3αy)。'
    : '⊹ 已依 A 區工址位置自動鎖定為「一般區域與臺北盆地之工址」，垂直地震力採 SaD,V = (1/2)SaD、(C2-11a) 式與柱公式 0.40SDS·I/(2αy)。';

  const colZoneNoteEl = document.getElementById('g-col-zone-note');
  colZoneNoteEl.textContent = zone === 'near'
    ? '⊹ 近斷層工址：柱垂直地震力係數 = 0.80 × SDS × I / (3αy)'
    : '⊹ 一般區域與臺北盆地之工址：柱垂直地震力係數 = 0.40 × SDS × I / (2αy)';

  /* ── Ra,v／Fuv／FuvM（同 D 區邏輯，R 固定 3.0；工址類型依 siteRegionType 鎖定，與上方 zone 分類為不同軸線） ── */
  const RV = 3.0;
  const siteType  = siteRegionType === 'a' ? 'taipei' : 'general';
  const divisorRa = siteType === 'general' ? 1.5 : 2.0;
  const eqRa      = siteType === 'general' ? '(2-10)' : '(2-11)';
  raValueV = 1 + (RV - 1) / divisorRa;

  document.getElementById('g-site-general').checked = siteType === 'general';
  document.getElementById('g-site-taipei').checked  = siteType === 'taipei';
  document.getElementById('btn-g-site-general').classList.toggle('is-selected', siteType === 'general');
  document.getElementById('btn-g-site-taipei').classList.toggle('is-selected',  siteType === 'taipei');
  document.getElementById('btn-g-site-general').classList.toggle('is-locked', siteType !== 'general');
  document.getElementById('btn-g-site-taipei').classList.toggle('is-locked',  siteType !== 'taipei');

  document.getElementById('g-site-lock-note').textContent = siteType === 'taipei'
    ? '⊹ 已依 A 區工址位置（表 2-6(a) 臺北盆地微分區）自動鎖定為「臺北盆地」。'
    : '⊹ 已依 A 區工址位置自動鎖定為「一般工址與近斷層工址」。';

  document.getElementById('g-val-ra').textContent = raValueV.toFixed(4);
  document.getElementById('g-ra-formula').innerHTML =
    `R<sub>a,v</sub> = 1 + (R－1) / ${divisorRa.toFixed(1)} = 1 + (${RV.toFixed(1)}－1) / ${divisorRa.toFixed(1)} = ${raValueV.toFixed(4)}　${eqRa}`;

  const { T, t0d } = bPeriodResult;
  document.getElementById('g-val-t').textContent     = T.toFixed(4)   + ' 秒';
  document.getElementById('g-val-t0d').textContent   = t0d.toFixed(4) + ' 秒';
  document.getElementById('g-val-06t0d').textContent = (0.6 * t0d).toFixed(4) + ' 秒';

  const fuv = calcFuByFormula(T, t0d, raValueV, 'R<sub>a,v</sub>', 'F<sub>uv</sub>');
  document.getElementById('g-val-fuv').textContent   = fuv.value.toFixed(4);
  document.getElementById('g-fuv-range').textContent = fuv.label;
  document.getElementById('g-fuv-formula').innerHTML = fuv.formula;

  const fuvm = calcFuByFormula(T, t0d, RV, 'R', 'F<sub>uvM</sub>');
  document.getElementById('g-val-fuvm').textContent   = fuvm.value.toFixed(4);
  document.getElementById('g-fuvm-range').textContent = fuvm.label;
  document.getElementById('g-fuvm-formula').innerHTML = fuvm.formula;

  fuvResult = { fuv: fuv.value, fuvm: fuvm.value };

  const eqRatio = zone === 'near' ? '(C2-11b)' : '(C2-11a)';

  /* ── G-1-1：最小設計水平總橫力對應之 Vz ── */
  document.getElementById('g-v-val-sad').textContent = fCaseResult.saMin.toFixed(4);
  const sadvMin = calcSaDV(fCaseResult.saMin, zone, 'S<sub>aD</sub>', 'S<sub>aD,V</sub>');
  document.getElementById('g-v-val-sadv').textContent   = sadvMin.value.toFixed(4);
  document.getElementById('g-v-sadv-formula').innerHTML = sadvMin.formula;

  const rvMin = calcRatioModVertical(sadvMin.value, fuv.value, zone, 'S<sub>aD,V</sub>', 'F<sub>uv</sub>', eqRatio);
  document.getElementById('g-v-val-ratio').textContent   = rvMin.ratio.toFixed(4);
  document.getElementById('g-v-ratio-formula').innerHTML = rvMin.ratioFormula;
  document.getElementById('g-v-val-mod').textContent     = rvMin.mod.toFixed(4);
  document.getElementById('g-v-mod-range').innerHTML     = rvMin.label;
  document.getElementById('g-v-mod-formula').innerHTML   = rvMin.modFormula;

  const vzMin = I / (1.4 * ay) * rvMin.mod;
  document.getElementById('g-v-val-vz').textContent = `${vzMin.toFixed(4)} × W`;
  document.getElementById('g-v-vz-formula').innerHTML =
    `V<sub>z</sub> = I / (1.4α<sub>y</sub>) × (S<sub>aD,V</sub>/F<sub>uv</sub>)<sub>m</sub> × W = ` +
    `${I.toFixed(2)} / (1.4×${ay.toFixed(1)}) × ${rvMin.mod.toFixed(4)} × W = ${vzMin.toFixed(4)} × W　(C2-10)`;

  /* ── G-1-2：避免中小度地震降伏對應之 Vz* ── */
  document.getElementById('g-vs-val-sad').textContent = fCaseResult.saVstar.toFixed(4);
  const sadvVstar = calcSaDV(fCaseResult.saVstar, zone, 'S<sub>aD</sub>', 'S<sub>aD,V</sub>');
  document.getElementById('g-vs-val-sadv').textContent   = sadvVstar.value.toFixed(4);
  document.getElementById('g-vs-sadv-formula').innerHTML = sadvVstar.formula;

  const rvVstar = calcRatioModVertical(sadvVstar.value, fuv.value, zone, 'S<sub>aD,V</sub>', 'F<sub>uv</sub>', eqRatio);
  document.getElementById('g-vs-val-ratio').textContent   = rvVstar.ratio.toFixed(4);
  document.getElementById('g-vs-ratio-formula').innerHTML = rvVstar.ratioFormula;
  document.getElementById('g-vs-val-mod').textContent     = rvVstar.mod.toFixed(4);
  document.getElementById('g-vs-mod-range').innerHTML     = rvVstar.label;
  document.getElementById('g-vs-mod-formula').innerHTML   = rvVstar.modFormula;

  const vzVstar = I / (1.4 * ay) * rvVstar.mod;
  document.getElementById('g-vs-val-vz').textContent = `${vzVstar.toFixed(4)} × W`;
  document.getElementById('g-vs-vz-formula').innerHTML =
    `V<sub>z</sub>* = I / (1.4α<sub>y</sub>) × (S<sub>aD,V</sub>/F<sub>uv</sub>)<sub>m</sub> × W = ` +
    `${I.toFixed(2)} / (1.4×${ay.toFixed(1)}) × ${rvVstar.mod.toFixed(4)} × W = ${vzVstar.toFixed(4)} × W　(C2-10)`;

  /* ── G-1-3：避免最大考量地震崩塌對應之 VzM ── */
  document.getElementById('g-vm-val-sam').textContent = fCaseResult.saMce.toFixed(4);
  const samvMce = calcSaDV(fCaseResult.saMce, zone, 'S<sub>aM</sub>', 'S<sub>aM,V</sub>');
  document.getElementById('g-vm-val-samv').textContent   = samvMce.value.toFixed(4);
  document.getElementById('g-vm-samv-formula').innerHTML = samvMce.formula;

  const rvMce = calcRatioModVertical(samvMce.value, fuvm.value, zone, 'S<sub>aM,V</sub>', 'F<sub>uvM</sub>', eqRatio);
  document.getElementById('g-vm-val-ratio').textContent   = rvMce.ratio.toFixed(4);
  document.getElementById('g-vm-ratio-formula').innerHTML = rvMce.ratioFormula;
  document.getElementById('g-vm-val-mod').textContent     = rvMce.mod.toFixed(4);
  document.getElementById('g-vm-mod-range').innerHTML     = rvMce.label;
  document.getElementById('g-vm-mod-formula').innerHTML   = rvMce.modFormula;

  const vzMce = I / (1.4 * ay) * rvMce.mod;
  document.getElementById('g-vm-val-vz').textContent = `${vzMce.toFixed(4)} × W`;
  document.getElementById('g-vm-vz-formula').innerHTML =
    `V<sub>zM</sub> = I / (1.4α<sub>y</sub>) × (S<sub>aM,V</sub>/F<sub>uvM</sub>)<sub>m</sub> × W = ` +
    `${I.toFixed(2)} / (1.4×${ay.toFixed(1)}) × ${rvMce.mod.toFixed(4)} × W = ${vzMce.toFixed(4)} × W　(C2-10)`;

  /* ── G-1-4：三力並列 ── */
  document.getElementById('g-val-v-final').textContent     = `${vzMin.toFixed(4)} × W`;
  document.getElementById('g-val-vstar-final').textContent = `${vzVstar.toFixed(4)} × W`;
  document.getElementById('g-val-vm-final').textContent    = `${vzMce.toFixed(4)} × W`;

  /* ── G-2：柱垂直地震力係數（2.18 節解說，不涉及 Ra／Fuv） ── */
  document.getElementById('g-col-min-val-sds').textContent    = fCaseResult.sdsMin.toFixed(2);
  document.getElementById('g-col-min-val-i').textContent      = I.toFixed(2);
  document.getElementById('g-col-min-val-alphay').textContent = ay.toFixed(1);
  const colMin = calcColumnCoeff(fCaseResult.sdsMin, I, ay, zone);
  document.getElementById('g-col-min-val-coeff').textContent = colMin.value.toFixed(4);
  document.getElementById('g-col-min-formula').innerHTML     = colMin.formula;

  document.getElementById('g-col-vstar-val-sds').textContent    = fCaseResult.sdsVstar.toFixed(2);
  document.getElementById('g-col-vstar-val-i').textContent      = I.toFixed(2);
  document.getElementById('g-col-vstar-val-alphay').textContent = ay.toFixed(1);
  const colVstar = calcColumnCoeff(fCaseResult.sdsVstar, I, ay, zone);
  document.getElementById('g-col-vstar-val-coeff').textContent = colVstar.value.toFixed(4);
  document.getElementById('g-col-vstar-formula').innerHTML     = colVstar.formula;

  document.getElementById('g-col-mce-val-sds').textContent    = fCaseResult.sdsMce.toFixed(2);
  document.getElementById('g-col-mce-val-i').textContent      = I.toFixed(2);
  document.getElementById('g-col-mce-val-alphay').textContent = ay.toFixed(1);
  const colMce = calcColumnCoeff(fCaseResult.sdsMce, I, ay, zone);
  document.getElementById('g-col-mce-val-coeff').textContent = colMce.value.toFixed(4);
  document.getElementById('g-col-mce-formula').innerHTML     = colMce.formula;

  document.getElementById('g-col-val-min-final').textContent   = colMin.value.toFixed(4);
  document.getElementById('g-col-val-vstar-final').textContent = colVstar.value.toFixed(4);
  document.getElementById('g-col-val-mce-final').textContent   = colMce.value.toFixed(4);
}
