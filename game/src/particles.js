// Glimmerdeep — particles, floating text and screen shake. One job: every bit
// of feedback that flies, fades or rattles, in world space, so digging, gems,
// hits and victories all feel answered.

export function createParticles() {
  return {
    list: [],
    floaters: [],
    shake: 0,
    rng: Math.random,
    dustTimer: 0,
  };
}

export function burst(particles, x, y, { color = '#ffd98a', count = 10, speed = 120, life = 0.55, size = 4, gravity = 320, spread = Math.PI * 2 } = {}) {
  for (let i = 0; i < count; i++) {
    const angle = particles.rng() * spread - spread / 2 - Math.PI / 2;
    const v = speed * (0.35 + particles.rng() * 0.85);
    particles.list.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: life * (0.6 + particles.rng() * 0.7),
      maxLife: life,
      size: size * (0.6 + particles.rng() * 0.8),
      color,
      gravity,
    });
  }
}

export function floater(particles, x, y, text, color = '#f5eeda') {
  particles.floaters.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
}

export function addShake(particles, amount) {
  particles.shake = Math.min(18, particles.shake + amount);
}

export function shakeOffset(particles) {
  if (particles.shake <= 0.2) return { x: 0, y: 0 };
  return {
    x: (particles.rng() * 2 - 1) * particles.shake,
    y: (particles.rng() * 2 - 1) * particles.shake,
  };
}

export function updateParticles(particles, dt, spawnDust) {
  particles.shake = Math.max(0, particles.shake - dt * 34);
  for (let i = particles.list.length - 1; i >= 0; i--) {
    const p = particles.list[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.list.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = particles.floaters.length - 1; i >= 0; i--) {
    const f = particles.floaters[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) particles.floaters.splice(i, 1);
  }
  if (spawnDust) {
    particles.dustTimer -= dt;
    if (particles.dustTimer <= 0) {
      particles.dustTimer = 0.22;
      spawnDust(particles);
    }
  }
}

export function drawParticles(ctx, camera, particles) {
  for (const p of particles.list) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - camera.x - p.size / 2, p.y - camera.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of particles.floaters) {
    const alpha = Math.max(0, Math.min(1, f.life / (f.maxLife * 0.6)));
    ctx.globalAlpha = alpha;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillStyle = '#14101f';
    ctx.fillText(f.text, f.x - camera.x + 1, f.y - camera.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x - camera.x, f.y - camera.y);
  }
  ctx.globalAlpha = 1;
}
