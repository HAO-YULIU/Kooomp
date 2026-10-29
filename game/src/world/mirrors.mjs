// 交誼廳的古鏡（帳號二，2026-10-29）：對鏡子哈一口氣，鏡面起霧，霧上浮出手指寫的反字（像是從鏡子裡面寫的），幾秒後慢慢消失。
// 不是謎題，是伏筆：四間寫的字不一樣（data/world-ch1.mjs 的 MIRRORS）。
import * as THREE from 'three';
import { MIRRORS } from '../data/world-ch1.mjs';
import { sfx } from '../art/sfx.mjs';
import { L } from '../ui/overlay.mjs';

const W = 0.9, H = 1.4, Y = 1.55; // 鏡面的寬、高、中心高度

function fogTex(text) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 600; const g = c.getContext('2d');
  // 霧：白白的、邊緣淡一點
  const grd = g.createRadialGradient(192, 300, 40, 192, 300, 340); grd.addColorStop(0, 'rgba(225,230,235,0.95)'); grd.addColorStop(1, 'rgba(210,215,220,0.55)');
  g.fillStyle = grd; g.fillRect(0, 0, 384, 600);
  // 手指劃過的地方：霧被擦掉（看得到後面黑黑的鏡子）。整個左右相反
  g.save(); g.translate(384, 0); g.scale(-1, 1);
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const zh = /[一-鿿]/.test(text);
  const lines = zh ? (text.length > 4 ? [text.slice(0, Math.ceil(text.length / 2)), text.slice(Math.ceil(text.length / 2))] : [text]) : text.split(' ').reduce((a, w) => { const last = a[a.length - 1]; if (last && (last + ' ' + w).length <= 8) a[a.length - 1] = last + ' ' + w; else a.push(w); return a; }, []);
  g.font = zh ? 'bold 92px serif' : 'bold 58px serif';
  const lh = zh ? 120 : 76, y0 = 300 - ((lines.length - 1) * lh) / 2;
  lines.forEach((ln, i) => { for (let k = 0; k < 3; k++) g.fillText(ln, 192 + (Math.random() - 0.5) * 4, y0 + i * lh + (Math.random() - 0.5) * 4 + k * 3); }); // 手指寫的：抖一點、往下拖
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createMirrors(scene) {
  const group = new THREE.Group(); group.name = 'dorm-mirrors'; scene.add(group);
  const frameMat = new THREE.MeshStandardMaterial({ color: '#8a6a2a', roughness: 0.35, metalness: 0.8 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#4a525a', roughness: 0.12, metalness: 0.9 });
  const fogs = {};
  for (const m of MIRRORS) {
    const g = new THREE.Group(); g.position.set(m.x, 0, m.z); g.rotation.y = m.face > 0 ? 0 : Math.PI; // 鏡面朝房間裡
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.16, H + 0.16, 0.06), frameMat); frame.position.set(0, Y, 0.03);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), glassMat); glass.position.set(0, Y, 0.065);
    const fog = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: fogTex(L(m.text)), transparent: true, opacity: 0, depthWrite: false }));
    fog.position.set(0, Y, 0.07); fog.visible = false;
    g.add(frame, glass, fog); group.add(g);
    fogs['mirror_' + m.house] = { fog, t: -1 };
  }
  return {
    /** 對鏡子哈氣（id＝那面鏡子的 thing id）；回傳 true＝開始起霧 */
    breathe(id) { const f = fogs[id]; if (!f || f.t >= 0) return false; f.t = 0; f.fog.visible = true; sfx('whoosh'); return true; },
    update(dt) {
      for (const f of Object.values(fogs)) {
        if (f.t < 0) continue;
        f.t += dt;
        f.fog.material.opacity = f.t < 0.8 ? f.t / 0.8 * 0.9 : f.t < 6 ? 0.9 : Math.max(0, 0.9 - (f.t - 6) / 3); // 起霧 0.8 秒、停 5 秒、慢慢散掉 3 秒
        if (f.t > 9) { f.t = -1; f.fog.visible = false; }
      }
    },
  };
}
