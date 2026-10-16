"use strict";
/* =========================================================
   SUPRAGNA '27 - NIGHT-CARNIVAL BACKDROP

   Matches the main Supragna site: a deep navy night sky with a
   purple, crimson and gold nebula drifting across it, star
   dust, gold four-point sparkles, and a faint gold burst of
   carnival light behind the scroll.

   The sky is painted once into a canvas. A handful of DOM
   sparkles on top twinkle. Repainted only when the window
   grows well past what was painted; smaller changes are
   covered by object-fit.
========================================================= */
(() => {
    const canvas = document.getElementById("bgPrint");
    if (!canvas || !canvas.getContext) return;

    const SKY_TOP = [7, 8, 24];
    const SKY_BOTTOM = [16, 11, 38];
    const PURPLE = [92, 36, 124];
    const CRIMSON = [158, 32, 58];
    const GOLD = [232, 146, 58];
    const BLUE = [38, 58, 150];
    const RAYS = 28;            // gold light-burst behind the scroll
    const CENTER = [0.5, 0.42];

    /* ---------- value noise ---------- */
    const G = 256;
    const grid = new Float32Array(G * G);
    for (let i = 0; i < grid.length; i++) grid[i] = Math.random();

    function noise(x, y) {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const xf = x - xi;
        const yf = y - yi;
        const x0 = xi & 255;
        const y0 = yi & 255;
        const x1 = (x0 + 1) & 255;
        const y1 = (y0 + 1) & 255;
        const u = xf * xf * (3 - 2 * xf);
        const v = yf * yf * (3 - 2 * yf);
        const a = grid[y0 * G + x0];
        const b = grid[y0 * G + x1];
        const c = grid[y1 * G + x0];
        const d = grid[y1 * G + x1];
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }

    function fbm(x, y, octaves) {
        let sum = 0;
        let amp = 0.5;
        let freq = 1;
        let norm = 0;
        for (let o = 0; o < octaves; o++) {
            sum += amp * noise(x * freq, y * freq);
            norm += amp;
            amp *= 0.5;
            freq *= 2.03;
        }
        return sum / norm;
    }

    const smooth = (a, b, v) => {
        const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

    /* ---------- the sky ---------- */
    let painted = { w: 0, h: 0 };

    function paint() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const scale = w < 900 ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
        const W = Math.round(w * scale);
        const H = Math.round(h * scale);
        canvas.width = W;
        canvas.height = H;
        painted = { w, h };

        const ctx = canvas.getContext("2d");
        const img = ctx.createImageData(W, H);
        const d = img.data;

        /* the nebula runs diagonally, top left to lower right */
        const ax = w * 0.05;
        const ay = h * 0.05;
        const bx = w * 0.98;
        const by = h * 0.8;
        const len = Math.hypot(bx - ax, by - ay);
        const nx = -(by - ay) / len;
        const ny = (bx - ax) / len;
        const bandWidth = Math.max(h, w * 0.5) * 0.3;

        const cx = w * CENTER[0];
        const cy = h * CENTER[1];
        const reach = Math.hypot(w, h) * 0.7;
        const TAU = Math.PI * 2;

        let i = 0;
        for (let y = 0; y < H; y++) {
            const py = y / scale;
            const sky = mix(SKY_TOP, SKY_BOTTOM, py / h);
            for (let x = 0; x < W; x++, i += 4) {
                const px = x / scale;
                let r = sky[0];
                let g = sky[1];
                let b = sky[2];

                /* nebula: a warped band of clumpy dust */
                const warp = (fbm(px * 0.004 + 20, py * 0.004, 3) - 0.5) * bandWidth * 1.4;
                const off = ((px - ax) * nx + (py - ay) * ny + warp) / bandWidth;
                const band = Math.exp(-off * off);
                if (band > 0.02) {
                    const cloud = fbm(px * 0.0025, py * 0.0025, 5);
                    const clump = fbm(px * 0.03 + 7, py * 0.03, 3);
                    let dens = band * (0.25 + 1.5 * (cloud - 0.32));
                    dens *= 0.55 + 0.9 * clump;
                    dens = Math.min(1, Math.max(0, dens));

                    const hue = fbm(px * 0.0018 + 50, py * 0.0018, 3);
                    let col = mix(PURPLE, CRIMSON, smooth(0.42, 0.62, hue));
                    col = mix(col, GOLD, smooth(0.5, 0.95, dens * cloud * 1.7));
                    const haze = band * 0.22 * (1 - smooth(0.35, 0.55, hue));

                    r += col[0] * dens * 0.95 + BLUE[0] * haze;
                    g += col[1] * dens * 0.95 + BLUE[1] * haze;
                    b += col[2] * dens * 0.95 + BLUE[2] * haze;
                }

                /* faint gold light-burst behind the scroll */
                const dx = px - cx;
                const dy = py - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                let t = (Math.atan2(dy, dx) / TAU) * RAYS;
                t = ((t % RAYS) + RAYS) % RAYS;
                if ((Math.floor(t) & 1) === 0) {
                    const soft = Math.sin((t % 1) * Math.PI);
                    const fall = Math.max(0, 1 - dist / reach) * 0.11 * soft;
                    r += 240 * fall;
                    g += 170 * fall;
                    b += 80 * fall;
                }

                /* star dust, thicker inside the nebula */
                if (Math.random() < 0.0012 + 0.006 * band) {
                    const s = 110 + Math.random() * 145;
                    r += s;
                    g += s * 0.92;
                    b += s * 0.74;
                }

                /* darker toward the edges */
                const edge = Math.max(Math.abs(px / w - 0.5), Math.abs(py / h - 0.5)) * 2;
                const v = 1 - 0.4 * smooth(0.55, 1.1, edge);
                const grain = (Math.random() - 0.5) * 8;

                d[i] = r * v + grain;
                d[i + 1] = g * v + grain;
                d[i + 2] = b * v + grain;
                d[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);

        ctx.save();
        ctx.scale(scale, scale);
        drawGlowStars(ctx, w, h);
        drawSparkles(ctx, w, h);
        ctx.restore();

        canvas.classList.add("is-ready");
    }

    /* small stars with a soft warm halo */
    function drawGlowStars(ctx, w, h) {
        const count = Math.round((w * h) / 9000);
        for (let k = 0; k < count; k++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const rad = 0.6 + Math.random() * 1.4;
            const halo = ctx.createRadialGradient(x, y, 0, x, y, rad * 4);
            halo.addColorStop(0, "rgba(255, 244, 214, .95)");
            halo.addColorStop(0.3, "rgba(255, 206, 120, .35)");
            halo.addColorStop(1, "rgba(255, 190, 90, 0)");
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(x, y, rad * 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /* the big gold four-point sparkles from the main site */
    function sparklePath(ctx, x, y, r) {
        const k = r * 0.1;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.quadraticCurveTo(x + k, y - k, x + r, y);
        ctx.quadraticCurveTo(x + k, y + k, x, y + r);
        ctx.quadraticCurveTo(x - k, y + k, x - r, y);
        ctx.quadraticCurveTo(x - k, y - k, x, y - r);
        ctx.closePath();
    }

    function drawSparkles(ctx, w, h) {
        const count = Math.max(5, Math.round((w * h) / 70000));
        for (let k = 0; k < count; k++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const r = 8 + Math.random() * 22;

            const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 1.3);
            glow.addColorStop(0, "rgba(255, 214, 130, .45)");
            glow.addColorStop(1, "rgba(255, 180, 70, 0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x, y, r * 1.3, 0, Math.PI * 2);
            ctx.fill();

            const body = ctx.createRadialGradient(x, y, 0, x, y, r);
            body.addColorStop(0, "#fff8e0");
            body.addColorStop(0.35, "#ffd77e");
            body.addColorStop(1, "#e09a2e");
            ctx.fillStyle = body;
            sparklePath(ctx, x, y, r);
            ctx.fill();
        }
    }

    /* ---------- live sparkles that twinkle over the painted sky ---------- */
    function scatterLiveSparkles() {
        const layer = document.createElement("div");
        layer.className = "bg__sparkles";
        const count = window.innerWidth < 700 ? 7 : 14;
        let html = "";
        for (let k = 0; k < count; k++) {
            const size = Math.round(14 + Math.random() * 30);
            html += `<svg class="sparkle" style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;width:${size}px;height:${size}px;--d:${(2.4 + Math.random() * 3).toFixed(1)}s;--delay:-${(Math.random() * 5).toFixed(1)}s"><use href="#spark"/></svg>`;
        }
        layer.innerHTML = html;
        canvas.parentNode.append(layer);
    }

    /* paint just after load so the gate shows straight away (a
       timeout, not requestAnimationFrame, which background tabs pause) */
    setTimeout(paint, 60);
    scatterLiveSparkles();

    let timer = 0;
    window.addEventListener("resize", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            const flipped = (w > h) !== (painted.w > painted.h);
            if (flipped || w > painted.w * 1.12 || h > painted.h * 1.12) paint();
        }, 300);
    });
})();
