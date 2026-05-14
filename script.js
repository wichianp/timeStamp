/* ==========================================================================
   CONFIG & GLOBAL VARIABLES
   ========================================================================== */
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxh00-RpMFXSfTM8zx9MgpuN94UapZNrYb7vM0kxexqb1W7jvFgO4Kg3ArTJbo-suJW/exec";
let EMPLOYEES = [];
let PINNED_NAMES = JSON.parse(localStorage.getItem('pinnedEmployees') || '[]');

// State Management
const STATE = {
  mode: null,          // 'in' หรือ 'out'
  employeeName: "", 
  location: "",        // 'ปฎิบัติงานในโรงเรียน' หรือ 'ปฎิบัติงานนอกโรงเรียน'
  latitude: null,
  longitude: null,
  imageBlob: null      // เก็บรูป Base64
};

/* ==========================================================================
   API CALL FUNCTIONS
   ========================================================================== */
async function gasCall(action, payload) {
  const res = await fetch(GAS_API_URL, {
    method: "POST",
    body: JSON.stringify({ action, payload: payload || {} })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "GAS error");
  return json.data;
}

/* ==========================================================================
   UI ELEMENT REFERENCES
   ========================================================================== */
const modeInBtn = document.getElementById('mode-in');
const modeOutBtn = document.getElementById('mode-out');
const locationSection = document.getElementById('locationSection');
const locationButtons = document.querySelectorAll('.location-button');

const nameSearchInput = document.getElementById('nameSearch');
const nameDropdown = document.getElementById('nameDropdown');
const nameSelect = document.getElementById('name');
const quickChipsContainer = document.getElementById('quickChips');

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const snapBtn = document.getElementById('snap');
const retakeBtn = document.getElementById('retake');
const switchCameraBtn = document.getElementById('switchCamera');
const submitBtn = document.getElementById('submit');
const loadingSpinner = document.getElementById('loadingSpinner');

/* ==========================================================================
   CLOCK & DATE SYSTEM
   ========================================================================== */
function updateDateTime() {
  const now = new Date();
  
  // Update Digital Clock
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('current-time-large').textContent = `${hours}:${minutes}:${seconds}`;

  // Update Date
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const thaiDate = now.toLocaleDateString('th-TH', options);
  document.getElementById('current-date-small').textContent = thaiDate;
  document.getElementById('infoDate').textContent = now.toLocaleDateString('th-TH');
}

/* ==========================================================================
   CAMERA & SNAPSHOT MANAGEMENT
   ========================================================================== */
let currentStream = null;
let useFacingMode = "user"; 

async function initializeCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: useFacingMode },
      audio: false
    });
    video.srcObject = currentStream;
    video.style.display = 'block';
  } catch (err) {
    console.error("เข้าถึงกล้องถ่ายภาพไม่สำเร็จ: ", err);
    Swal.fire("ข้อผิดพลาด", "ไม่สามารถเปิดกล้องถ่ายภาพได้ กรุณาตรวจสอบสิทธิ์การเข้าถึง", "error");
  }
}

// ถ่ายรูป
snapBtn.addEventListener('click', () => {
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  // วาดภาพจาก Video ลง Canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // แปลงผลลัพธ์เป็น Base64 Data URL
  STATE.imageBlob = canvas.toDataURL('image/jpeg', 0.85);

  video.style.display = 'none';
  canvas.style.display = 'block';
  snapBtn.style.display = 'none';
  retakeBtn.style.display = 'block';
});

// ถ่ายรูปใหม่
retakeBtn.addEventListener('click', () => {
  STATE.imageBlob = null;
  canvas.style.display = 'none';
  video.style.display = 'block';
  retakeBtn.style.display = 'none';
  snapBtn.style.display = 'block';
});

// สลับกล้อง (หน้า/หลัง)
switchCameraBtn.addEventListener('click', () => {
  useFacingMode = (useFacingMode === "user") ? "environment" : "user";
  initializeCamera();
});

/* ==========================================================================
   GEOLOCATION SYSTEM (GPS)
   ========================================================================== */
function getGeoLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        STATE.latitude = position.coords.latitude;
        STATE.longitude = position.coords.longitude;
        document.getElementById('lat').textContent = STATE.latitude.toFixed(5);
        document.getElementById('lng').textContent = STATE.longitude.toFixed(5);
      },
      (error) => {
        console.warn("GPS Error code: " + error.code);
        document.getElementById('lat').textContent = "ปฏิเสธ/หาไม่พบ";
        document.getElementById('lng').textContent = "ปฏิเสธ/หาไม่พบ";
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  } else {
    document.getElementById('lat').textContent = "ไม่รองรับ GPS";
    document.getElementById('lng').textContent = "ไม่รองรับ GPS";
  }
}

/* ==========================================================================
   MODE & LOCATION SELECTION LOGIC
   ========================================================================== */
function setMode(mode) {
  STATE.mode = mode;
  if (mode === 'in') {
    modeInBtn.classList.add('active');
    modeOutBtn.classList.remove('active');
    locationSection.classList.remove('hidden'); // แสดงขั้นตอนสถานที่เมื่อเลือกเข้างาน
  } else {
    modeOutBtn.classList.add('active');
    modeInBtn.classList.remove('active');
    locationSection.classList.add('hidden');    // ซ่อนสถานที่เมื่อเลือกออกงาน
    STATE.location = ""; 
    locationButtons.forEach(b => b.classList.remove('selected'));
  }
}

modeInBtn.addEventListener('click', () => setMode('in'));
modeOutBtn.addEventListener('click', () => setMode('out'));

locationButtons.forEach(btn => {
  btn.addEventListener('click', function() {
    locationButtons.forEach(b => b.classList.remove('selected'));
    this.classList.add('selected');
    STATE.location = this.getAttribute('data-value');
  });
});

/* ==========================================================================
   SEARCH & DROPDOWN MANAGEMENT
   ========================================================================== */
function selectEmployee(name) {
  STATE.employeeName = name;
  nameSearchInput.value = name;
  nameSelect.value = name;
  nameDropdown.style.display = 'none';
  renderChips();
}

function togglePinEmployee(name, e) {
  e.stopPropagation();
  if (PINNED_NAMES.includes(name)) {
    PINNED_NAMES = PINNED_NAMES.filter(n => n !== name);
  } else {
    PINNED_NAMES.push(name);
  }
  localStorage.setItem('pinnedEmployees', JSON.stringify(PINNED_NAMES));
  renderChips();
  showDropdown(nameSearchInput.value);
}

function renderChips() {
  quickChipsContainer.innerHTML = "";
  if (PINNED_NAMES.length === 0) return;

  PINNED_NAMES.forEach(name => {
    const chip = document.createElement('div');
    chip.className = `chip ${STATE.employeeName === name ? 'bg-primary text-white' : ''}`;
    chip.innerHTML = `<i class="fas fa-thumbtack text-warning"></i> <span>${name}</span>`;
    chip.addEventListener('click', () => selectEmployee(name));
    quickChipsContainer.appendChild(chip);
  });
}

function showDropdown(query = "") {
  nameDropdown.innerHTML = "";
  const cleanQuery = query.trim().toLowerCase();

  // กรองชื่อพนักงานตามการค้นหา
  const filtered = EMPLOYEES.filter(name => name.toLowerCase().includes(cleanQuery));

  // เรียงลำดับเอาชื่อที่ปักหมุดไว้ขึ้นก่อน
  filtered.sort((a, b) => {
    const aPinned = PINNED_NAMES.includes(a) ? 1 : 0;
    const bPinned = PINNED_NAMES.includes(b) ? 1 : 0;
    return bPinned - aPinned;
  });

  if (filtered.length === 0) {
    nameDropdown.innerHTML = '<div class="text-muted p-2 text-center">ไม่พบรายชื่อที่ค้นหา</div>';
    nameDropdown.style.display = 'block';
    return;
  }

  filtered.forEach(name => {
    const isPinned = PINNED_NAMES.includes(name);
    const isActive = STATE.employeeName === name;
    
    const item = document.createElement('div');
    item.className = `item ${isActive ? 'active' : ''}`;
    
    let displayName = name;
    if (cleanQuery) {
      const idx = name.toLowerCase().indexOf(cleanQuery);
      if (idx >= 0) {
        displayName = name.substring(0, idx) + '<mark>' + name.substring(idx, idx + cleanQuery.length) + '</mark>' + name.substring(idx + cleanQuery.length);
      }
    }

    item.innerHTML = `
      <i class="fas fa-user text-secondary"></i>
      <span class="name">${displayName}</span>
      <button type="button" class="pin-btn ${isPinned ? 'pinned' : ''}" title="ปักหมุดรายชื่อใช้บ่อย">
        <i class="fas fa-thumbtack"></i>
      </button>
    `;

    item.addEventListener('click', () => selectEmployee(name));
    item.querySelector('.pin-btn').addEventListener('click', (e) => togglePinEmployee(name, e));
    nameDropdown.appendChild(item);
  });

  nameDropdown.style.display = 'block';
}

nameSearchInput.addEventListener('focus', () => showDropdown(nameSearchInput.value));
nameSearchInput.addEventListener('input', () => showDropdown(nameSearchInput.value));

document.addEventListener('click', (e) => {
  if (!nameSearchInput.contains(e.target) && !nameDropdown.contains(e.target)) {
    nameDropdown.style.display = 'none';
  }
});

/* ==========================================================================
   SUBMIT DATA SYSTEM
   ========================================================================== */
submitBtn.addEventListener('click', async () => {

  // ตรวจสอบโหมด
  if (!selectedMode) {
    return Swal.fire({
      icon: 'warning',
      title: 'ยังไม่สมบูรณ์',
      text: 'กรุณาเลือกโหมด "เข้างาน" หรือ "ออกงาน" ก่อน'
    });
  }

  // ตรวจสอบชื่อ
  if (!nameSelect.value) {
    return Swal.fire({
      icon: 'warning',
      title: 'ยังไม่สมบูรณ์',
      text: 'กรุณาเลือกชื่อ-สกุลของคุณ'
    });
  }

  // ตรวจสอบสถานที่
  if (selectedMode === 'in' && !selectedLocation) {
    return Swal.fire({
      icon: 'warning',
      title: 'ยังไม่สมบูรณ์',
      text: 'กรุณาเลือกสถานที่ปฏิบัติงาน'
    });
  }

  // ตรวจสอบรูปภาพ
  if (!imageCaptured) {
    return Swal.fire({
      icon: 'warning',
      title: 'กรุณาถ่ายภาพก่อน',
      text: 'โปรดถ่ายภาพเพื่อยืนยันตัวตนก่อนทำการบันทึกเวลา'
    });
  }

  // ตรวจสอบ GPS
  if (latitude === null || longitude === null) {
    return Swal.fire({
      icon: 'warning',
      title: 'ไม่พบพิกัด',
      text: 'ระบบกำลังรอข้อมูลตำแหน่ง GPS โปรดรอสักครู่'
    });
  }

  try {

    showSpinner();

    // เตรียมข้อมูล
    const formData = {
      name: nameSelect.value,
      mode: selectedMode,
      locationType: selectedLocation,
      latitude,
      longitude,
      imageBase64: canvas.toDataURL('image/jpeg', 0.8),
      imageType: 'image/jpeg',
      imageName: `time_log_${Date.now()}.jpg`
    };

    // ส่งไป GAS API
    const response = await gasCall(
      'uploadImageAndSave',
      formData
    );

    // แจ้งสำเร็จ
    await Swal.fire({
      icon: 'success',
      title: 'บันทึกสำเร็จ!',
      text: response.message || 'บันทึกเวลาเรียบร้อย',
      showConfirmButton: false,
      timer: 2500
    });

    // reset form
    resetForm();

  } catch (error) {

    Swal.fire({
      icon: 'error',
      title: 'บันทึกไม่สำเร็จ',
      text: error.message || 'เกิดข้อผิดพลาด'
    });

  } finally {

    hideSpinner();

  }

});

/* ==========================================================================
   ADMIN LOGIN & LOGOUT SYSTEM
   ========================================================================== */
async function verifyAdminCode() {

  const result = await Swal.fire({
    title: 'เข้าสู่ระบบสำหรับผู้ดูแลระบบ',
    input: 'password',
    inputPlaceholder: 'กรอกรหัสผ่าน Admin',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0d6efd',
    cancelButtonColor: '#6c757d'
  });

  // กดยกเลิก
  if (!result.isConfirmed) return;

  const password = result.value?.trim();
  console.log(password)
  // ไม่กรอกรหัส
  if (!password) {
    Swal.fire({
      icon: 'warning',
      title: 'กรุณากรอกรหัสผ่าน'
    });
    return;
  }

  try {

    loadingSpinner.classList.add('show');

    // ตรวจสอบรหัสผ่าน
    await gasCall('login', {
      pwd: password
    });

    // แจ้งสำเร็จ
    await Swal.fire({
      icon: 'success',
      title: 'เข้าสู่ระบบสำเร็จ',
      text: 'ยินดีต้อนรับผู้ดูแลระบบ',
      timer: 1800,
      showConfirmButton: false
    });

    // ซ่อนหน้าหลัก
    document.getElementById('mainAppContainer').style.display = 'none';

    // แสดง Dashboard
    document.getElementById('dataTableContainer').style.display = 'block';

    // ตั้งค่าวันปัจจุบัน
    document.getElementById('summaryDate').value =
      new Date().toISOString().split('T')[0];

    // โหลดข้อมูล Dashboard
    await loadDailySummary();

  } catch (error) {

    Swal.fire({
      icon: 'error',
      title: 'เข้าสู่ระบบไม่สำเร็จ',
      text: error.message || 'เกิดข้อผิดพลาด'
    });

  } finally {

    loadingSpinner.classList.remove('show');

  }
}

function logoutAdmin() {
  document.getElementById('dataTableContainer').style.display = 'none';
  document.getElementById('mainAppContainer').style.display = 'grid';
}

/* ==========================================================================
   INITIALIZATION & INITIAL LOAD
   ========================================================================== */
async function populateEmployeeNamesEnhanced() {
  try {
    const names = await gasCall('getEmployeeNames');
    if (Array.isArray(names)) {
      EMPLOYEES = names.filter(Boolean);
      nameSelect.innerHTML = '<option value="" disabled selected>-- กรุณาเลือก --</option>';
      EMPLOYEES.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        nameSelect.appendChild(opt);
      });
      renderChips();
    }
  } catch (e) {
    console.warn('โหลดรายชื่อพนักงานล้มเหลว:', e.message);
  }
}

// ผูกฟังก์ชันเข้ากับ Global/Window object เพื่อเรียกใช้งานจากจุดอื่นภายนอกได้
window.verifyAdminCode = verifyAdminCode;
window.logoutAdmin = logoutAdmin;
window.loadDailySummary = () => { console.log("กำลังเรียกฟังก์ชันโหลดข้อมูลแดชบอร์ด..."); };
window.printDailyReport = () => { window.print(); };

// ดำเนินการเมื่อโหลด DOM เสร็จสิ้น
document.addEventListener('DOMContentLoaded', () => {
  initializeCamera();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  getGeoLocation();
  populateEmployeeNamesEnhanced();
});
