// Gera assets/icon.png (512x512) e assets/icon.ico a partir da paleta
// glassmorphism do app (rosa/roxo/ciano) + um mostrador de relógio simples.
// Rodar manualmente quando quiser trocar o ícone: node scripts/generate-icon.js
const path = require('node:path');
const fs = require('node:fs');
const { Jimp, rgbaToInt } = require('jimp');
const pngToIco = require('png-to-ico').default;

const SIZE = 512;

const PINK = [255, 95, 174];
const PURPLE = [155, 107, 255];
const CYAN = [75, 245, 227];
const BG_DARK = [13, 11, 22];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function gradientColor(t) {
  // 0 -> pink, 0.55 -> purple, 1 -> cyan (equivalente ao --allus-gradient)
  if (t <= 0.55) return lerpColor(PINK, PURPLE, t / 0.55);
  return lerpColor(PURPLE, CYAN, (t - 0.55) / 0.45);
}

async function main() {
  const image = new Jimp({ width: SIZE, height: SIZE, color: 0x000000ff });
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const t = (x + y) / (2 * SIZE); // diagonal 135deg aprox.
      const [r, g, b] = gradientColor(t);
      image.setPixelColor(rgbaToInt(Math.round(r), Math.round(g), Math.round(b), 255), x, y);
    }
  }

  // Mostrador do relógio: anel branco translúcido + ponteiros.
  const outerR = SIZE * 0.34;
  const ringWidth = SIZE * 0.045;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= outerR && dist >= outerR - ringWidth) {
        image.setPixelColor(rgbaToInt(255, 255, 255, 235), x, y);
      } else if (dist < outerR - ringWidth) {
        const [r, g, b] = BG_DARK;
        image.setPixelColor(rgbaToInt(r, g, b, 235), x, y);
      }
    }
  }

  function drawHand(angleDeg, length, thickness, color) {
    const angle = ((angleDeg - 90) * Math.PI) / 180;
    const steps = Math.ceil(length);
    for (let i = 0; i < steps; i++) {
      const px = cx + Math.cos(angle) * i;
      const py = cy + Math.sin(angle) * i;
      for (let ox = -thickness; ox <= thickness; ox++) {
        for (let oy = -thickness; oy <= thickness; oy++) {
          const x = Math.round(px + ox);
          const y = Math.round(py + oy);
          if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) {
            image.setPixelColor(rgbaToInt(color[0], color[1], color[2], 255), x, y);
          }
        }
      }
    }
  }

  // 10:10 clássico
  drawHand(300, outerR * 0.55, SIZE * 0.012, [255, 255, 255]);
  drawHand(60, outerR * 0.8, SIZE * 0.01, [255, 255, 255]);

  const assetsDir = path.join(__dirname, '..', 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  const pngPath = path.join(assetsDir, 'icon.png');
  await image.write(pngPath);

  const icoBuffer = await pngToIco([pngPath]);
  fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoBuffer);

  console.log('Gerado:', pngPath, 'e icon.ico');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
