import QRCode from "qrcode";

export function qrDataUrl(text: string, size = 512) {
  return QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: "M", color: { dark: "#1c1917", light: "#ffffff" } });
}

/** Renders a printable table card (restaurant name, QR, table name) as a PNG data URL. */
export async function tableCardPng(opts: { url: string; restaurantName: string; tableName: string; brandColor: string }) {
  const W = 1200, H = 1600;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = opts.brandColor;
  ctx.fillRect(0, 0, W, 24);

  const font = (weight: number, size: number) => `${weight} ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#1c1917";
  ctx.font = font(700, 64);
  ctx.fillText(opts.restaurantName, W / 2, 170);
  ctx.fillStyle = "#57534e";
  ctx.font = font(500, 40);
  ctx.fillText("Scan to view the menu, order & pay", W / 2, 240);

  const qr = new Image();
  qr.src = await qrDataUrl(opts.url, 820);
  await new Promise((res) => { qr.onload = res; });
  ctx.drawImage(qr, (W - 820) / 2, 320, 820, 820);

  ctx.fillStyle = opts.brandColor;
  ctx.font = font(700, 96);
  ctx.fillText(opts.tableName, W / 2, 1300);
  ctx.fillStyle = "#a8a29e";
  ctx.font = font(400, 30);
  ctx.fillText("No app needed · Pay with UPI or card", W / 2, 1380);
  ctx.font = font(500, 26);
  ctx.fillText("Powered by TableTap", W / 2, H - 70);
  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
