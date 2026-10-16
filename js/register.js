"use strict";
/* =========================================================
   SUPRAGNA '27 - REGISTRATION

   The scroll slides in and unrolls -> sign in unrolls the
   rest -> details -> the Register ticket is cut along its
   perforation, the stub tears away in a burst of confetti ->
   an Admit One ticket (canvas, downloadable as PNG).

   Fest details live in js/fest-data.js. The two hooks to wire
   to a real backend are signInWithGoogle() and
   submitRegistration(), in the BACKEND HOOKS block below.
========================================================= */
(() => {
    const FEST = window.SUPRAGNA_DATA.fest;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const wait = (ms) => new Promise((done) => setTimeout(done, reduceMotion ? 0 : ms));
    const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
    const rand = (min, max) => min + Math.random() * (max - min);

    /* Web Animations call that collapses to an instant jump when
       the visitor prefers reduced motion */
    function play(el, frames, options) {
        return el.animate(frames, {
            ...options,
            duration: reduceMotion ? 1 : options.duration,
            delay: reduceMotion ? 0 : options.delay || 0,
        });
    }

    const FIELDS = ["name", "email", "phone", "city", "college", "year", "gender"];

    const state = {
        stage: 0,          // 0 loading, 1 scroll open, 2 form open
        busy: false,
        registration: null,
    };

    /* elements */
    const scrollEl = $("#scroll");
    const paper = $("#paper");
    const bottomRoll = $("#bottomRoll");
    const formZone = $("#formZone");
    const form = $("#regForm");
    const submitBtn = $("#submitBtn");
    const submitLabel = $("#submitLabel");
    const submitSub = $("#submitSub");
    const regWrap = $("#regWrap");
    const regMain = $("#regMain");
    const regStub = $("#regStub");
    const regCut = $("#regCut");
    const scissors = $("#scissors");
    const fxLayer = $("#fxLayer");
    const formStatus = $("#formStatus");
    const confirmEl = $("#confirm");
    const canvas = $("#ticketCanvas");
    const printPaper = $("#printPaper");

    /* =========================================================
       PROPS: prop tickets, bunting, torn edges, split title
    ========================================================= */

    /* the Admit One tickets lying beside the scroll: a loose pair
       on the left, a strip of three on the right. Each gets its
       own stain spot so they don't look stamped out. */
    function propTicket(serial, extraClass) {
        const sx = Math.round(15 + Math.random() * 70);
        const sy = Math.round(20 + Math.random() * 60);
        return `
<div class="mini-ticket ${extraClass}" style="--sx:${sx}%;--sy:${sy}%">
    <span class="mini-ticket__serial">${serial}</span>
    <span class="mini-ticket__body">
        <span class="mini-ticket__name">${esc(FEST.name)}</span>
        <svg class="mini-ticket__tent"><use href="#tent"/></svg>
        <span class="mini-ticket__admit">Admit One</span>
    </span>
    <span class="mini-ticket__serial">${serial}</span>
</div>`;
    }

    function layPropTickets() {
        $("#propPair").innerHTML =
            propTicket(567420, "mini-ticket--a") + propTicket(567421, "mini-ticket--b");
        $("#propStrip").innerHTML =
            propTicket(567422, "") + propTicket(567423, "") + propTicket(567424, "");
    }

    /* two swags of pennants. The rope is a quadratic curve whose
       height at t is 6 + 100·t·(1−t) px, so flags sit on it */
    let buntingPerSwag = 0;
    function hangBunting() {
        const perSwag = window.innerWidth < 700 ? 6 : 11;
        if (perSwag === buntingPerSwag) return;
        buntingPerSwag = perSwag;
        const colors = ["#C8202E", "#F3E3BF", "#E0A93B", "#2B3F8F"];
        let flags = "";
        let n = 0;
        for (let swag = 0; swag < 2; swag++) {
            for (let i = 0; i < perSwag; i++) {
                const t = (i + 0.5) / perSwag;
                const x = ((swag + t) / 2) * 100;
                const y = 6 + 100 * t * (1 - t) - 1;
                flags += `<span class="pennant" style="left:${x.toFixed(2)}%;top:${y.toFixed(1)}px;background:${colors[n % colors.length]};--sw:-${(Math.random() * 3).toFixed(2)}s"></span>`;
                n++;
            }
        }
        $("#bunting").innerHTML =
            `<svg class="bunting__rope" viewBox="0 0 1000 80" preserveAspectRatio="none"><path d="M0 6Q250 56 500 6Q750 56 1000 6"/></svg>${flags}`;
    }

    /* ragged top and bottom edges for the section dividers */
    function tearEdges(el) {
        const steps = 40;
        const top = [];
        const bottom = [];
        for (let i = 0; i <= steps; i++) {
            const x = ((i / steps) * 100).toFixed(2);
            top.push(`${x}% ${(Math.random() * 7).toFixed(1)}px`);
            bottom.unshift(`${x}% calc(100% - ${(Math.random() * 7).toFixed(1)}px)`);
        }
        el.style.clipPath = `polygon(${top.concat(bottom).join(",")})`;
    }

    function splitTitle() {
        const title = $("#regTitle");
        const text = title.textContent.trim();
        title.setAttribute("aria-label", text);
        title.innerHTML = [...text]
            .map((ch, i) => `<span class="ch" aria-hidden="true" style="--i:${i}">${esc(ch)}</span>`)
            .join("");
    }

    /* =========================================================
       SCROLL UNROLL

       Grows the parchment from its current height to fit its
       content, with the bottom roll spinning on the way down.
       `follow` keeps the page scrolling with it until the
       target element is near the top of the screen.
    ========================================================= */
    function unroll(duration, follow) {
        const from = paper.getBoundingClientRect().height;
        paper.style.height = "auto";
        const to = paper.getBoundingClientRect().height;
        paper.style.height = `${from}px`;
        bottomRoll.classList.add("is-rolling");

        const anim = play(paper, [{ height: `${from}px` }, { height: `${to}px` }], {
            duration,
            easing: "cubic-bezier(.65,0,.35,1)",
        });
        if (follow) followScroll(follow, anim.finished);

        return anim.finished.then(() => {
            paper.style.height = "auto";
            bottomRoll.classList.remove("is-rolling");
        });
    }

    function followScroll(target, finished) {
        const goal = () => Math.max(0, target.getBoundingClientRect().top + window.scrollY - 40);
        const events = ["wheel", "touchstart", "keydown", "pointerdown"];
        let active = true;
        const stop = () => {
            active = false;
            events.forEach((type) => window.removeEventListener(type, stop));
        };
        events.forEach((type) => window.addEventListener(type, stop, { passive: true }));

        /* once the paper stops growing, glide the rest of the way */
        finished.then(() => {
            if (active) window.scrollTo({ top: goal(), behavior: reduceMotion ? "auto" : "smooth" });
            stop();
        });

        (function step() {
            if (!active) return;
            window.scrollTo(0, window.scrollY + (goal() - window.scrollY) * 0.09);
            requestAnimationFrame(step);
        })();
    }

    /* =========================================================
       INTRO: the scroll slides in and unrolls on load
    ========================================================= */
    async function openScroll() {
        if (state.stage > 0) return;
        state.stage = 1;
        await wait(250);
        scrollEl.classList.add("is-in");
        await wait(450);
        await unroll(1300);
        $("#googleBtn").focus({ preventScroll: true });
    }

    /* =========================================================
       SIGN IN -> unroll the rest of the scroll
    ========================================================= */
    async function openBoxOffice(viaGoogle) {
        if (state.stage >= 2) return;

        if (viaGoogle) {
            const btn = $("#googleBtn");
            btn.disabled = true;
            const profile = await signInWithGoogle().catch(() => null);
            btn.disabled = false;
            if (profile) {
                if (profile.name) $("#f-name").value = profile.name;
                if (profile.email) $("#f-email").value = profile.email;
            }
        }

        state.stage = 2;
        $("#signin").classList.add("is-done");
        formZone.hidden = false;
        observeReveals();

        await unroll(1800, $("#act1"));
        $("#f-name").focus({ preventScroll: true });
    }

    /* =========================================================
       REVEAL ON SCROLL
    ========================================================= */
    function observeReveals() {
        const items = $$(".rv", formZone);
        if (!("IntersectionObserver" in window) || reduceMotion) {
            items.forEach((el) => el.classList.add("is-in"));
            return;
        }

        /* fields in a row come in one after another */
        $$(".fields .rv", formZone).forEach((el, i) => el.style.setProperty("--rv-delay", `${(i % 2) * 90}ms`));

        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-in");
                io.unobserve(entry.target);
            });
        }, { rootMargin: "0px 0px -8% 0px" });
        items.forEach((el) => io.observe(el));
    }

    /* =========================================================
       VALIDATION
    ========================================================= */
    function setError(name, message) {
        const box = document.getElementById(`e-${name}`);
        if (box) box.textContent = message;
        const field = $(`[data-field="${name}"]`);
        if (!field) return;
        field.classList.toggle("is-error", Boolean(message));
        const input = $("input, select", field);
        if (input && input.type !== "radio") input.setAttribute("aria-invalid", String(Boolean(message)));
    }

    function normalisePhone(value) {
        const digits = value.replace(/\D/g, "");
        return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
    }

    function collect() {
        const fd = new FormData(form);
        const get = (key) => String(fd.get(key) || "").trim();
        return {
            name: get("name").replace(/\s+/g, " "),
            email: get("email").toLowerCase(),
            phone: normalisePhone(get("phone")),
            city: get("city"),
            college: get("college"),
            year: get("year"),
            gender: get("gender"),
        };
    }

    function validate(data) {
        const errors = {};
        if (data.name.length < 2) errors.name = "Tell us your name.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) errors.email = "That email doesn't look right.";
        if (!/^[6-9]\d{9}$/.test(data.phone)) errors.phone = "Enter a 10-digit Indian mobile number.";
        if (!data.city) errors.city = "Which city are you coming from?";
        if (!data.college) errors.college = "Add your college name.";
        if (!data.year) errors.year = "Pick your year of study.";
        if (!data.gender) errors.gender = "Pick one.";

        FIELDS.forEach((key) => setError(key, errors[key] || ""));

        const first = Object.keys(errors)[0];
        if (!first) return true;

        const target = $(`[data-field="${first}"]`);
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        target.classList.remove("is-shaking");
        void target.offsetWidth;
        target.classList.add("is-shaking");
        const input = $("input, select", target);
        if (input) setTimeout(() => input.focus({ preventScroll: true }), reduceMotion ? 0 : 450);

        /* the ticket refuses to tear */
        play(regWrap, [
            { translate: "0 0" }, { translate: "-8px 0" }, { translate: "8px 0" },
            { translate: "-5px 0" }, { translate: "0 0" },
        ], { duration: 420, easing: "ease-in-out" });
        formStatus.textContent = "A few details are missing. They're marked in red.";
        return false;
    }

    /* =========================================================
       SUBMIT -> cut -> ticket
    ========================================================= */
    async function onSubmit(e) {
        e.preventDefault();
        if (state.busy) return;
        if (state.registration) {
            openTicket();
            return;
        }

        const data = collect();
        if (!validate(data)) return;

        state.busy = true;
        submitBtn.disabled = true;
        submitSub.textContent = "Checking you in…";
        formStatus.textContent = "";

        let result;
        try {
            result = await submitRegistration(data);
        } catch (err) {
            state.busy = false;
            submitBtn.disabled = false;
            submitSub.textContent = "Tear here to take your seat";
            formStatus.textContent = "The box office couldn't take that. Try again in a moment.";
            return;
        }

        state.registration = {
            ...data,
            regId: result.regId,
            serial: String(100000 + parseInt(result.regId.replace(/\W/g, ""), 36) % 900000),
        };

        submitSub.textContent = "Snip…";
        await cutTicket();

        submitLabel.textContent = "View my ticket";
        submitSub.textContent = `Registered · ${result.regId}`;
        formStatus.textContent = `You're registered. Your number is ${result.regId}.`;
        submitBtn.disabled = false;
        state.busy = false;

        await wait(500);
        openTicket();
    }

    /* =========================================================
       THE CUT

       1. Scissors snip their way down the perforation, leaving
          a slit behind them.
       2. The stub tears free: a copy of it is lifted into the
          fixed effects layer and tumbles off the screen, while
          the ticket keeps a ragged edge where it was torn.
       3. Confetti, gold sparkles and a flash burst from the
          cut, and the ticket is stamped REGISTERED.
    ========================================================= */
    async function cutTicket() {
        const h = submitBtn.getBoundingClientRect().height;
        const travel = 950;
        const lead = 180;

        submitBtn.classList.add("is-cutting");
        play(scissors, [
            { opacity: 0, transform: "translateY(-96px) rotate(-10deg)" },
            { opacity: 1, transform: "translateY(-64px) rotate(0deg)", offset: lead / (lead + travel + 200) },
            { opacity: 1, transform: `translateY(${h - 64}px) rotate(0deg)`, offset: (lead + travel) / (lead + travel + 200) },
            { opacity: 0, transform: `translateY(${h - 30}px) rotate(8deg)` },
        ], { duration: lead + travel + 200, easing: "linear", fill: "forwards" });
        play(regCut, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
            duration: travel, delay: lead, easing: "linear", fill: "forwards",
        });

        await wait(lead + travel);
        submitBtn.classList.remove("is-cutting");
        tearStub();
        await wait(1100);
    }

    function tearStub() {
        const rect = regStub.getBoundingClientRect();
        const loose = regStub.cloneNode(true);
        loose.removeAttribute("id");
        loose.classList.add("fx-stub");
        loose.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;--n:16px`;
        fxLayer.append(loose);

        raggedEdge(regMain);
        submitBtn.classList.add("is-cut");

        play(loose, [
            { transform: "rotate(-1.2deg)", opacity: 1 },
            { transform: "translate(22px, -18px) rotate(12deg)", opacity: 1, offset: .18 },
            { transform: `translate(${rand(40, 120)}px, ${window.innerHeight * 0.85}px) rotate(${rand(60, 110)}deg)`, opacity: 0 },
        ], { duration: 1600, easing: "cubic-bezier(.45,0,.8,.6)", fill: "forwards" })
            .finished.then(() => loose.remove());

        scrollEl.classList.remove("is-thud");
        void scrollEl.offsetWidth;
        scrollEl.classList.add("is-thud");

        burst(rect.left, rect.top + rect.height / 2);
    }

    /* where the stub came away, the ticket keeps a torn edge */
    function raggedEdge(el) {
        const steps = 16;
        const pts = ["0 0", "calc(100% - 4px) 0"];
        for (let i = 1; i < steps; i++) {
            pts.push(`calc(100% - ${rand(0, 8).toFixed(1)}px) ${((i / steps) * 100).toFixed(2)}%`);
        }
        pts.push("calc(100% - 3px) 100%", "0 100%");
        el.style.clipPath = `polygon(${pts.join(",")})`;
    }

    function burst(x, y) {
        if (reduceMotion) return;
        const colors = ["#C8202E", "#E0A93B", "#F3E3BF", "#2B3F8F", "#3E7C8C", "#FFD77E"];
        const shapes = ["", "confetti--dot", "confetti--strip"];
        const frag = document.createDocumentFragment();
        const pieces = [];

        const flash = document.createElement("div");
        flash.className = "fx-flash";
        flash.style.cssText = `left:${x}px;top:${y}px`;
        frag.append(flash);
        pieces.push([flash, [
            { transform: "scale(.2)", opacity: 1 },
            { transform: "scale(2.4)", opacity: 0 },
        ], { duration: 650, easing: "ease-out" }]);

        for (let k = 0; k < 56; k++) {
            const bit = document.createElement("div");
            bit.className = `confetti ${shapes[k % shapes.length]}`;
            bit.style.cssText = `left:${x}px;top:${y + rand(-50, 50)}px;background:${colors[k % colors.length]}`;
            frag.append(bit);

            const angle = rand(-170, -10) * (Math.PI / 180);
            const speed = rand(140, 360);
            const dx = Math.cos(angle) * speed;
            const dy = Math.sin(angle) * speed;
            const fall = rand(260, 480);
            const spin = rand(-720, 720);
            pieces.push([bit, [
                { transform: "translate(0, 0) rotate(0deg) scale(.6)", opacity: 1 },
                { transform: `translate(${dx * 0.65}px, ${dy * 0.65}px) rotate(${spin * 0.4}deg) scale(1)`, opacity: 1, offset: .3 },
                { transform: `translate(${dx}px, ${dy + fall * 0.45}px) rotate(${spin * 0.75}deg) scale(1)`, opacity: 1, offset: .7 },
                { transform: `translate(${dx * 1.15}px, ${dy + fall}px) rotate(${spin}deg) scale(.9)`, opacity: 0 },
            ], { duration: rand(1300, 2100), easing: "cubic-bezier(.2,.6,.4,1)" }]);
        }

        for (let k = 0; k < 9; k++) {
            const spark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            spark.setAttribute("class", "fx-spark");
            spark.innerHTML = '<use href="#spark"/>';
            spark.style.cssText = `left:${x + rand(-90, 90)}px;top:${y + rand(-80, 80)}px`;
            frag.append(spark);
            pieces.push([spark, [
                { transform: "scale(0) rotate(0deg)", opacity: 0 },
                { transform: "scale(1.2) rotate(60deg)", opacity: 1, offset: .45 },
                { transform: "scale(0) rotate(120deg)", opacity: 0 },
            ], { duration: rand(700, 1100), delay: rand(0, 450), easing: "ease-out", fill: "backwards" }]);
        }

        fxLayer.append(frag);
        pieces.forEach(([el, frames, opts]) => {
            play(el, frames, opts).finished.then(() => el.remove());
        });
    }

    /* =========================================================
       CONFIRMATION
    ========================================================= */
    let lastFocus = null;

    async function openTicket() {
        lastFocus = document.activeElement;
        confirmEl.hidden = false;
        document.body.classList.add("is-locked");
        play(confirmEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });

        printPaper.style.visibility = "hidden";
        await drawTicket(canvas, state.registration);
        printPaper.style.visibility = "";

        /* fed out of the booth slot in short jerks, like a ticket printer */
        play(printPaper, [
            { transform: "translateY(-102%)" },
            { transform: "translateY(-74%)", offset: .18 },
            { transform: "translateY(-70%)", offset: .3 },
            { transform: "translateY(-38%)", offset: .5 },
            { transform: "translateY(-34%)", offset: .62 },
            { transform: "translateY(-4%)", offset: .85 },
            { transform: "translateY(0)" },
        ], { duration: 1700, easing: "ease-out", fill: "backwards" });

        $("#downloadBtn").focus({ preventScroll: true });
    }

    function closeTicket() {
        if (confirmEl.hidden) return;
        confirmEl.hidden = true;
        document.body.classList.remove("is-locked");
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    function downloadTicket() {
        const reg = state.registration;
        if (!reg) return;
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `supragna27-ticket-${reg.regId}.png`;
            document.body.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }, "image/png");
    }

    /* a fresh, uncut ticket for the next person */
    function registerAnother() {
        closeTicket();
        state.registration = null;
        form.reset();
        FIELDS.forEach((k) => setError(k, ""));
        submitBtn.classList.remove("is-cut");
        regMain.style.clipPath = "";
        scissors.getAnimations().forEach((a) => a.cancel());
        regCut.getAnimations().forEach((a) => a.cancel());
        submitLabel.textContent = "Register";
        submitSub.textContent = "Tear here to take your seat";
        formStatus.textContent = "";
        play(regWrap, [
            { opacity: 0, transform: "translateY(24px) rotate(-4deg)" },
            { opacity: 1, transform: "rotate(-1.2deg)" },
        ], { duration: 500, easing: "cubic-bezier(.34,1.4,.64,1)" });
        $("#act1").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        setTimeout(() => $("#f-name").focus({ preventScroll: true }), reduceMotion ? 0 : 600);
    }

    /* =========================================================
       TICKET CANVAS

       Drawn rather than screenshotted so the download matches
       exactly what is on screen. 1400 x 600, transparent
       notches. The QR holds the registration number only
       (ASCII, so any QR reader handles it).
    ========================================================= */
    const T = { W: 1400, H: 600, STUB: 1060 };
    let grainPattern = null;

    function loadFonts() {
        if (!document.fonts || !document.fonts.load) return Promise.resolve();
        return Promise.all([
            "96px 'Abril Fatface'",
            "30px Rye",
            "20px 'Special Elite'",
            "600 30px 'Playfair Display'",
            "italic 20px 'Playfair Display'",
        ].map((font) => document.fonts.load(font).catch(() => null)));
    }

    function makeGrain(ctx) {
        if (grainPattern) return grainPattern;
        const tile = document.createElement("canvas");
        tile.width = tile.height = 160;
        const t = tile.getContext("2d");
        const img = t.createImageData(160, 160);
        for (let i = 0; i < img.data.length; i += 4) {
            img.data[i] = 90;
            img.data[i + 1] = 58;
            img.data[i + 2] = 28;
            img.data[i + 3] = Math.random() * 30;
        }
        t.putImageData(img, 0, 0);
        grainPattern = ctx.createPattern(tile, "repeat");
        return grainPattern;
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function spacing(ctx, value) {
        if ("letterSpacing" in ctx) ctx.letterSpacing = value;
    }

    /* shrink a single line until it fits, then ellipsize */
    function fitText(ctx, text, maxWidth, size, minSize, family) {
        let s = size;
        ctx.font = `${family.replace("{s}", s)}`;
        while (ctx.measureText(text).width > maxWidth && s > minSize) {
            s -= 2;
            ctx.font = `${family.replace("{s}", s)}`;
        }
        let out = text;
        while (ctx.measureText(out).width > maxWidth && out.length > 1) {
            out = `${out.slice(0, -2)}…`;
        }
        return out;
    }

    function wrapLines(ctx, text, maxWidth, maxLines) {
        const words = text.split(" ");
        const lines = [];
        let line = "";
        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width <= maxWidth || !line) {
                line = test;
            } else {
                lines.push(line);
                line = word;
            }
        }
        if (line) lines.push(line);
        if (lines.length > maxLines) {
            const kept = lines.slice(0, maxLines);
            let last = `${kept[maxLines - 1]} …`;
            while (ctx.measureText(last).width > maxWidth && last.length > 2) {
                last = `${last.slice(0, -3)} …`;
            }
            kept[maxLines - 1] = last;
            return kept;
        }
        return lines;
    }

    function drawQR(ctx, text, x, y, size) {
        if (typeof window.qrcode !== "function") {
            ctx.fillStyle = "#2A1A10";
            ctx.font = "18px 'Special Elite'";
            ctx.textAlign = "center";
            ctx.fillText("QR code needs", x + size / 2, y + size / 2 - 6);
            ctx.fillText("an internet connection", x + size / 2, y + size / 2 + 18);
            return;
        }
        const qr = window.qrcode(0, "M");
        qr.addData(text);
        qr.make();
        const count = qr.getModuleCount();
        const cell = Math.floor(size / count);
        const offset = Math.floor((size - cell * count) / 2);
        ctx.fillStyle = "#2A1A10";
        for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
                if (qr.isDark(r, c)) ctx.fillRect(x + offset + c * cell, y + offset + r * cell, cell, cell);
            }
        }
    }

    async function drawTicket(cv, reg) {
        await loadFonts();
        const { W, H, STUB } = T;
        cv.width = W;
        cv.height = H;
        const ctx = cv.getContext("2d");
        ctx.clearRect(0, 0, W, H);

        ctx.save();
        roundRect(ctx, 0, 0, W, H, 22);
        ctx.clip();

        /* paper, side band, stub */
        ctx.fillStyle = "#F4E6C8";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#D8432E";
        ctx.fillRect(0, 0, 96, H);
        ctx.fillStyle = "#3E7C8C";
        ctx.fillRect(STUB, 0, W - STUB, H);

        /* sunburst on the stub */
        ctx.save();
        ctx.beginPath();
        ctx.rect(STUB, 0, W - STUB, H);
        ctx.clip();
        const cx = STUB + (W - STUB) / 2;
        const cy = 230;
        ctx.fillStyle = "rgba(241, 227, 198, .12)";
        for (let k = 0; k < 24; k += 2) {
            const a0 = (k / 24) * Math.PI * 2;
            const a1 = ((k + 1) / 24) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a0) * 900, cy + Math.sin(a0) * 900);
            ctx.lineTo(cx + Math.cos(a1) * 900, cy + Math.sin(a1) * 900);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        ctx.fillStyle = makeGrain(ctx);
        ctx.fillRect(0, 0, W, H);

        /* ADMIT ONE up the side band */
        ctx.save();
        ctx.translate(48, H / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = "#F1E3C6";
        ctx.font = "34px Rye";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        spacing(ctx, "6px");
        ctx.fillText("★ ADMIT ONE ★", 0, 0);
        spacing(ctx, "0px");
        ctx.restore();

        /* double frame */
        ctx.strokeStyle = "#D8432E";
        ctx.lineWidth = 3;
        ctx.strokeRect(122, 24, STUB - 146, H - 48);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(132, 34, STUB - 166, H - 68);

        /* main text */
        const X = 170;
        const maxW = STUB - 60 - X;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        ctx.fillStyle = "#285663";
        ctx.font = "19px 'Special Elite'";
        spacing(ctx, "3px");
        ctx.fillText(`${FEST.host.toUpperCase()} PRESENTS`, X, 84);
        spacing(ctx, "0px");

        const title = `${FEST.name} ${FEST.edition}`;
        ctx.font = "92px 'Abril Fatface'";
        ctx.fillStyle = "#E0A93B";
        ctx.fillText(title, X + 5, 180 + 5);
        ctx.fillStyle = "#D8432E";
        ctx.fillText(title, X, 180);

        ctx.font = "26px Rye";
        ctx.fillStyle = "#3E7C8C";
        spacing(ctx, "2px");
        ctx.fillText(`★ ${FEST.tagline.toUpperCase()} ★`, X, 224);
        spacing(ctx, "0px");

        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = "rgba(42, 26, 16, .45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(X, 252);
        ctx.lineTo(STUB - 60, 252);
        ctx.stroke();
        ctx.setLineDash([]);

        const label = (text, x, y) => {
            ctx.font = "17px 'Special Elite'";
            ctx.fillStyle = "#285663";
            spacing(ctx, "3px");
            ctx.fillText(text, x, y);
            spacing(ctx, "0px");
        };

        label("NAME", X, 290);
        ctx.fillStyle = "#2A1A10";
        const name = fitText(ctx, reg.name, 480, 36, 22, "600 {s}px 'Playfair Display'");
        ctx.fillText(name, X, 332);

        const yearX = X + 520;
        label("YEAR", yearX, 290);
        ctx.fillStyle = "#2A1A10";
        const year = fitText(ctx, reg.year, STUB - 60 - yearX, 36, 22, "600 {s}px 'Playfair Display'");
        ctx.fillText(year, yearX, 332);

        label("COLLEGE", X, 380);
        ctx.font = "600 28px 'Playfair Display'";
        ctx.fillStyle = "#2A1A10";
        wrapLines(ctx, reg.college, maxW, 2)
            .forEach((line, i) => ctx.fillText(line, X, 418 + i * 36));

        ctx.font = "19px 'Special Elite'";
        ctx.fillStyle = "#2A1A10";
        spacing(ctx, "1px");
        ctx.fillText(`REG. NO. ${reg.regId}   ·   DATE ${FEST.dates}   ·   ${FEST.venue.toUpperCase()}`, X, H - 64);
        spacing(ctx, "0px");

        /* REGISTERED rubber stamp */
        ctx.save();
        ctx.translate(860, 482);
        ctx.rotate(-0.17);
        ctx.globalAlpha = 0.78;
        ctx.strokeStyle = "#D8432E";
        ctx.fillStyle = "#D8432E";
        ctx.lineWidth = 5;
        roundRect(ctx, -150, -40, 300, 80, 10);
        ctx.stroke();
        ctx.lineWidth = 2;
        roundRect(ctx, -160, -50, 320, 100, 14);
        ctx.stroke();
        ctx.font = "40px Rye";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        spacing(ctx, "4px");
        ctx.fillText("REGISTERED", 0, 3);
        spacing(ctx, "0px");
        ctx.restore();

        /* perforation */
        ctx.setLineDash([12, 10]);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(42, 26, 16, .4)";
        ctx.beginPath();
        ctx.moveTo(STUB - 2, 30);
        ctx.lineTo(STUB - 2, H - 30);
        ctx.stroke();
        ctx.strokeStyle = "#F1E3C6";
        ctx.beginPath();
        ctx.moveTo(STUB + 2, 30);
        ctx.lineTo(STUB + 2, H - 30);
        ctx.stroke();
        ctx.setLineDash([]);

        /* stub: QR + serial */
        ctx.textAlign = "center";
        ctx.fillStyle = "#F1E3C6";
        ctx.font = "30px Rye";
        spacing(ctx, "3px");
        ctx.fillText("ADMIT ONE", cx, 82);
        spacing(ctx, "0px");

        const qrSize = 236;
        const qrX = cx - qrSize / 2;
        const qrY = 108;
        ctx.fillStyle = "#F4E6C8";
        roundRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 10);
        ctx.fill();
        drawQR(ctx, `SUPRAGNA27|${reg.regId}`, qrX, qrY, qrSize);

        ctx.textAlign = "center";
        ctx.fillStyle = "#F1E3C6";
        ctx.font = "22px 'Special Elite'";
        spacing(ctx, "3px");
        ctx.fillText(`No. ${reg.serial}`, cx, 410);
        spacing(ctx, "0px");
        ctx.font = "italic 21px 'Playfair Display'";
        ctx.fillText("Show this at the gate", cx, 446);
        ctx.font = "15px 'Special Elite'";
        spacing(ctx, "3px");
        ctx.fillText("KEEP THIS STUB", cx, H - 64);
        spacing(ctx, "0px");

        ctx.restore();

        /* punch the notches out */
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        [[0, H / 2, 30], [W, H / 2, 30], [STUB, 0, 24], [STUB, H, 24]].forEach(([x, y, r]) => {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }

    /* =========================================================
       BACKEND HOOKS
    ========================================================= */

    /* Supragna has no Google client ID or auth server yet, so this
       resolves to null and the visitor types their details in.
       To wire it up: load Google Identity Services, get the ID
       token, verify it on your server and resolve with
       { name, email } to prefill the form. */
    function signInWithGoogle() {
        return Promise.resolve(null);
    }

    /* There is no registration API yet, so this waits a moment
       and makes a registration number in the browser. Nothing is
       saved anywhere. Replace the body with a POST to your API
       and return { regId } from its response. */
    async function submitRegistration(data) {
        await wait(900);
        return { regId: makeRegId() };
    }

    function makeRegId() {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const bytes = crypto.getRandomValues(new Uint8Array(6));
        return `SUP27-${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
    }

    /* =========================================================
       DESK PROPS PARALLAX
    ========================================================= */
    function parallax() {
        if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;
        const root = document.documentElement;
        let frame = 0;
        window.addEventListener("pointermove", (e) => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                root.style.setProperty("--mx", (e.clientX / window.innerWidth - 0.5).toFixed(3));
                root.style.setProperty("--my", (e.clientY / window.innerHeight - 0.5).toFixed(3));
            });
        }, { passive: true });
    }

    /* =========================================================
       WIRING
    ========================================================= */
    layPropTickets();
    hangBunting();
    $$("[data-tear]").forEach(tearEdges);
    splitTitle();
    parallax();

    openScroll();
    $("#googleBtn").addEventListener("click", () => openBoxOffice(true));
    $("#manualBtn").addEventListener("click", () => openBoxOffice(false));

    /* clear a field's error as soon as it is fixed */
    form.addEventListener("input", (e) => {
        const field = e.target.closest("[data-field]");
        if (field && field.classList.contains("is-error")) setError(field.dataset.field, "");
    });

    form.addEventListener("submit", onSubmit);

    $("#downloadBtn").addEventListener("click", downloadTicket);
    $("#againBtn").addEventListener("click", registerAnother);
    $("#confirmClose").addEventListener("click", closeTicket);
    confirmEl.addEventListener("click", (e) => {
        if (e.target === confirmEl) closeTicket();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeTicket();
    });

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(hangBunting, 200);
    });
})();
