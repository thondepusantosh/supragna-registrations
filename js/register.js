"use strict";
/* =========================================================
   SUPRAGNA '27 - REGISTRATION

   The scroll slides in and unrolls -> sign in unrolls the
   rest -> details + event tickets -> REGISTERED stamp ->
   an Admit One ticket (canvas, downloadable as PNG).

   Content lives in js/events-data.js. The two hooks to wire to
   a real backend are signInWithGoogle() and
   submitRegistration(), in the BACKEND HOOKS block below.
========================================================= */
(() => {
    const DATA = window.SUPRAGNA_DATA;
    const FEST = DATA.fest;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const wait = (ms) => new Promise((done) => setTimeout(done, reduceMotion ? 0 : ms));
    const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

    /* Web Animations call that collapses to an instant jump when
       the visitor prefers reduced motion */
    function play(el, frames, options) {
        return el.animate(frames, { ...options, duration: reduceMotion ? 1 : options.duration });
    }

    /* =========================================================
       TONES

       Ticket colour per category. Hex rather than CSS variables
       so the canvas ticket can use the same values.
    ========================================================= */
    const TONES = {
        Dance: "#D8432E",
        Music: "#3E7C8C",
        Fashion: "#C98E22",
        Theatre: "#9E2A1B",
        Film: "#285663",
    };
    const toneOf = (ev) => TONES[ev.category] || "#D8432E";

    const eventsById = new Map(DATA.events.map((ev) => [ev.id, ev]));

    function teamLabel(ev) {
        const { min, max } = ev.team;
        if (max <= 1) return "Solo";
        if (min === max) return `Team of ${max}`;
        return `Team of ${min}–${max}`;
    }

    function serialOf(ev) {
        return String(567420 + DATA.events.indexOf(ev) * 137);
    }

    const state = {
        stage: 0,          // 0 loading, 1 scroll open, 2 form open
        selected: new Set(),
        filter: "All",
        focused: null,     // event id shown on the poster
        dealt: false,
        registration: null,
    };

    /* elements */
    const scrollEl = $("#scroll");
    const paper = $("#paper");
    const bottomRoll = $("#bottomRoll");
    const formZone = $("#formZone");
    const form = $("#regForm");
    const tabs = $("#tabs");
    const ticketList = $("#tickets");
    const wanted = $("#wanted");
    const wantedCard = $("#wantedCard");
    const teamField = $("#teamField");
    const pickedList = $("#picked");
    const pickedEmpty = $("#pickedEmpty");
    const pickCount = $("#pickCount");
    const submitBtn = $("#submitBtn");
    const submitLabel = $("#submitLabel");
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
            dealTickets();
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

        const dealer = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                dealTickets();
                dealer.disconnect();
            }
        }, { rootMargin: "0px 0px -10% 0px" });
        dealer.observe(ticketList);
    }

    /* =========================================================
       TABS + TICKETS
    ========================================================= */
    function renderTabs() {
        const cats = ["All", ...DATA.categories];
        const tilts = [-2, 1.5, -1, 2, -1.5, 1];
        tabs.innerHTML = cats.map((cat, i) =>
            `<button type="button" class="booth-tab" data-cat="${esc(cat)}" aria-pressed="${cat === state.filter}" style="--r:${tilts[i % tilts.length]}deg">${esc(cat)}</button>`
        ).join("");
    }

    function ticketHTML(ev, i) {
        const tilt = [-1.1, .8, -.5, 1.2, -.9, .6][i % 6];
        const full = Boolean(ev.seatsFull);
        return `
<li class="tk-item" data-cat="${esc(ev.category)}" data-id="${esc(ev.id)}">
    <button type="button" class="eticket" data-id="${esc(ev.id)}" aria-pressed="false"${full ? ' aria-disabled="true"' : ""}
        aria-label="${esc(`${ev.name}, ${ev.category}, ${teamLabel(ev)}${full ? ", seats full" : ""}`)}"
        style="--tone:${toneOf(ev)};--tilt:${tilt}deg">
        <span class="eticket__main">
            <span class="eticket__top"><span>${esc(ev.category)}</span><span>${esc(teamLabel(ev))}</span></span>
            <span class="eticket__name">${esc(ev.name)}</span>
            <span class="eticket__admit">Admit One</span>
            ${full
                ? '<span class="stamp stamp--full">Seats Full</span>'
                : '<span class="stamp stamp--ok">Admitted</span>'}
        </span>
        <span class="eticket__stub"><span class="eticket__serial">No. ${serialOf(ev)}</span></span>
    </button>
    <button type="button" class="eticket__more" data-more="${esc(ev.id)}">Rules</button>
</li>`;
    }

    function renderTickets() {
        ticketList.innerHTML = DATA.events.map(ticketHTML).join("");
    }

    function setFilter(cat) {
        state.filter = cat;
        $$(".booth-tab", tabs).forEach((tab) => tab.setAttribute("aria-pressed", String(tab.dataset.cat === cat)));
        const shown = [];
        $$(".tk-item", ticketList).forEach((li) => {
            const on = cat === "All" || li.dataset.cat === cat;
            li.hidden = !on;
            if (on) shown.push(li);
        });
        dealTickets(shown, true);
    }

    /* tickets are dealt onto the paper, each from a slightly
       different angle */
    function dealTickets(items, force) {
        if (state.dealt && !force) return;
        state.dealt = true;
        (items || $$(".tk-item:not([hidden])", ticketList)).forEach((li, i) => {
            const dx = Math.round(Math.random() * 60 - 30);
            const rot = (Math.random() * 16 - 8).toFixed(1);
            play(li, [
                { opacity: 0, transform: `translate(${dx}px, 46px) rotate(${rot}deg)` },
                { opacity: 1, transform: "none" },
            ], { duration: 560, delay: reduceMotion ? 0 : i * 60, easing: "cubic-bezier(.34,1.4,.64,1)", fill: "backwards" });
        });
    }

    function toggleEvent(id) {
        const ev = eventsById.get(id);
        const li = $(`.tk-item[data-id="${id}"]`);
        const btn = $(".eticket", li);

        if (ev.seatsFull) {
            play(li, [
                { transform: "translateX(0)" }, { transform: "translateX(-7px)" },
                { transform: "translateX(7px)" }, { transform: "translateX(-4px)" },
                { transform: "translateX(0)" },
            ], { duration: 420, easing: "ease-in-out" });
            showPoster(ev);
            formStatus.textContent = `${ev.name} is full. Pick another act.`;
            return;
        }

        const on = !state.selected.has(id);
        if (on) state.selected.add(id);
        else state.selected.delete(id);
        btn.setAttribute("aria-pressed", String(on));

        if (on) {
            /* the thump of the rubber stamp */
            play(li, [
                { transform: "scale(1)" },
                { transform: "scale(.965) translateY(2px)", offset: .3 },
                { transform: "scale(1)" },
            ], { duration: 380, delay: 120, easing: "ease-out" });
            showPoster(ev);
        }

        formStatus.textContent = "";
        updatePicked();
        updateTeamField();
        refreshPosterPick();
    }

    function updatePicked() {
        const picked = DATA.events.filter((ev) => state.selected.has(ev.id));
        pickedList.innerHTML = picked.map((ev) =>
            `<li class="picked__chip" style="--tone:${toneOf(ev)}"><span>${esc(ev.name)}</span><button type="button" class="picked__x" data-unpick="${esc(ev.id)}" aria-label="Remove ${esc(ev.name)}">&times;</button></li>`
        ).join("");
        pickedEmpty.hidden = picked.length > 0;

        pickCount.textContent = String(picked.length);
        $("#pickWord").textContent = picked.length === 1 ? "ticket" : "tickets";
        pickCount.classList.remove("is-bump");
        void pickCount.offsetWidth;
        pickCount.classList.add("is-bump");

        if (picked.length) setError("events", "");
    }

    function needsTeam() {
        return [...state.selected].some((id) => eventsById.get(id).team.max > 1);
    }

    function updateTeamField() {
        const needed = needsTeam();
        if (needed === !teamField.hidden) return;
        teamField.hidden = !needed;
        if (needed) {
            play(teamField, [
                { opacity: 0, transform: "translateY(-12px) rotate(-1deg)" },
                { opacity: 1, transform: "none" },
            ], { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" });
        } else {
            setError("team", "");
        }
    }

    /* =========================================================
       POSTER: "Grand Opening" until a ticket is picked, then a
       "Wanted" bill for that event. It swings over on its nails.
    ========================================================= */
    function grandHTML() {
        return `
<p class="wanted__kicker">&#9733; Now Showing &#9733;</p>
<h3 class="wanted__head wanted__head--grand">Grand Opening</h3>
<p class="wanted__sub">${esc(FEST.name)} ${esc(FEST.edition)} &middot; ${esc(FEST.tagline)}</p>
<dl class="wanted__facts">
    <div><dt>Dates</dt><dd>${esc(FEST.dates)}</dd></div>
    <div><dt>Venue</dt><dd>${esc(FEST.venue)}</dd></div>
    <div><dt>Acts</dt><dd>${DATA.events.length}</dd></div>
</dl>
<p class="wanted__hint">Tap a ticket to pin its poster here: date, venue, prize pool and the rules.</p>`;
    }

    function wantedHTML(ev) {
        const picked = state.selected.has(ev.id);
        const action = ev.seatsFull
            ? '<span class="stamp stamp--full">Seats Full</span>'
            : `<button type="button" class="wanted__pick" data-pick="${esc(ev.id)}" aria-pressed="${picked}">${picked ? "&#10003; Ticket in hand" : "Grab this ticket"}</button>`;
        return `
<p class="wanted__kicker">&#9733; ${esc(FEST.name)} ${esc(FEST.edition)} &#9733;</p>
<h3 class="wanted__head">Wanted</h3>
<p class="wanted__sub">Daring performers for</p>
<p class="wanted__event">${esc(ev.name)}</p>
<p class="wanted__meta">${esc(ev.category)} &middot; ${esc(teamLabel(ev))}</p>
<dl class="wanted__facts">
    <div><dt>Date</dt><dd>${esc(ev.date)}</dd></div>
    <div><dt>Venue</dt><dd>${esc(ev.venue)}</dd></div>
    <div><dt>Prize pool</dt><dd>${esc(ev.prize)}</dd></div>
</dl>
<h4 class="wanted__rules-title">The Rules</h4>
<ol class="wanted__rules">${ev.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>
${action}`;
    }

    function posterHTML() {
        return state.focused ? wantedHTML(eventsById.get(state.focused)) : grandHTML();
    }

    let flipping = false;
    function showPoster(ev) {
        const id = ev ? ev.id : null;
        if (id === state.focused) return;
        state.focused = id;

        if (reduceMotion) {
            wantedCard.innerHTML = posterHTML();
            return;
        }
        if (flipping) return;   // the running flip renders the latest event
        flipping = true;

        const out = wantedCard.animate([
            { transform: "perspective(900px) rotateX(0deg)" },
            { transform: "perspective(900px) rotateX(-90deg)" },
        ], { duration: 200, easing: "ease-in", fill: "forwards" });

        out.finished.then(() => {
            wantedCard.innerHTML = posterHTML();
            out.cancel();
            const back = wantedCard.animate([
                { transform: "perspective(900px) rotateX(90deg)" },
                { transform: "perspective(900px) rotateX(-12deg)", offset: .65 },
                { transform: "perspective(900px) rotateX(5deg)", offset: .85 },
                { transform: "perspective(900px) rotateX(0deg)" },
            ], { duration: 560, easing: "ease-out" });
            return back.finished;
        }).finally(() => {
            flipping = false;
        });
    }

    function refreshPosterPick() {
        const pick = $(".wanted__pick", wantedCard);
        if (!pick) return;
        const on = state.selected.has(pick.dataset.pick);
        pick.setAttribute("aria-pressed", String(on));
        pick.innerHTML = on ? "&#10003; Ticket in hand" : "Grab this ticket";
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
            team: needsTeam() ? get("team") : "",
            events: DATA.events.filter((ev) => state.selected.has(ev.id)).map((ev) => ev.id),
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
        if (!data.events.length) errors.events = "Pick at least one ticket in Act II.";
        if (needsTeam() && !data.team) errors.team = "Team events need a team name.";

        ["name", "email", "phone", "city", "college", "year", "gender", "events", "team"]
            .forEach((key) => setError(key, errors[key] || ""));

        const first = Object.keys(errors)[0];
        if (first) {
            const target = first === "events" ? $("#act2") : $(`[data-field="${first}"]`);
            target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
            const shake = first === "events" ? $("#seal") : target;
            shake.classList.remove("is-shaking");
            void shake.offsetWidth;
            shake.classList.add("is-shaking");
            const input = first === "events" ? null : $("input, select", target);
            if (input) setTimeout(() => input.focus({ preventScroll: true }), reduceMotion ? 0 : 450);
            formStatus.textContent = "A few details are missing. They're marked in red.";
            return false;
        }
        return true;
    }

    /* =========================================================
       SUBMIT -> stamp -> ticket
    ========================================================= */
    async function onSubmit(e) {
        e.preventDefault();
        if (submitBtn.disabled) return;
        if (state.registration) {
            openTicket();
            return;
        }

        const data = collect();
        if (!validate(data)) return;

        submitBtn.disabled = true;
        submitBtn.classList.add("is-busy");
        submitLabel.textContent = "Printing your ticket…";
        formStatus.textContent = "";

        let result;
        try {
            result = await submitRegistration(data);
        } catch (err) {
            submitBtn.disabled = false;
            submitBtn.classList.remove("is-busy");
            submitLabel.textContent = "Step Right Up · Register";
            formStatus.textContent = "The box office couldn't take that. Try again in a moment.";
            return;
        }

        state.registration = {
            ...data,
            regId: result.regId,
            serial: String(100000 + parseInt(result.regId.replace(/\W/g, ""), 36) % 900000),
            eventNames: DATA.events.filter((ev) => data.events.includes(ev.id)).map((ev) => ev.name),
        };

        await slamStamp("Registered");

        const seal = document.createElement("span");
        seal.className = "seal-stamp";
        seal.setAttribute("aria-hidden", "true");
        seal.textContent = "Registered";
        $("#seal").append(seal);

        submitBtn.disabled = false;
        submitBtn.classList.remove("is-busy");
        submitLabel.textContent = "View my ticket";
        formStatus.textContent = `Registered. Your number is ${result.regId}.`;

        openTicket();
    }

    async function slamStamp(text) {
        const layer = $("#stampLayer");
        const stamp = document.createElement("div");
        stamp.className = "big-stamp";
        stamp.textContent = text;
        layer.append(stamp);

        play(stamp, [
            { opacity: 0, transform: "rotate(-30deg) scale(3.2)" },
            { opacity: 1, transform: "rotate(-10deg) scale(.92)", offset: .6 },
            { opacity: 1, transform: "rotate(-12deg) scale(1)" },
        ], { duration: 480, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });

        await wait(300);
        scrollEl.classList.remove("is-thud");
        void scrollEl.offsetWidth;
        scrollEl.classList.add("is-thud");

        await wait(1000);
        await play(stamp, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }).finished;
        stamp.remove();
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

    function registerAnother() {
        closeTicket();
        state.registration = null;
        state.selected.clear();
        form.reset();
        $$(".eticket[aria-pressed='true']", ticketList).forEach((btn) => btn.setAttribute("aria-pressed", "false"));
        $$(".seal-stamp").forEach((el) => el.remove());
        ["name", "email", "phone", "city", "college", "year", "gender", "events", "team"].forEach((k) => setError(k, ""));
        updatePicked();
        updateTeamField();
        state.focused = "__reset";
        showPoster(null);
        submitLabel.textContent = "Step Right Up · Register";
        formStatus.textContent = "";
        $("#act1").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        setTimeout(() => $("#f-name").focus({ preventScroll: true }), reduceMotion ? 0 : 600);
    }

    /* =========================================================
       TICKET CANVAS

       Drawn rather than screenshotted so the download matches
       exactly what is on screen. 1400 x 600, transparent
       notches. The QR holds the registration number and event
       ids only (ASCII, so any QR reader handles it).
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

        const teamX = X + 520;
        label(reg.team ? "TEAM" : "ENTRY", teamX, 290);
        ctx.fillStyle = "#2A1A10";
        const team = fitText(ctx, reg.team || "Solo performer", STUB - 60 - teamX, 36, 22, "600 {s}px 'Playfair Display'");
        ctx.fillText(team, teamX, 332);

        label(reg.eventNames.length > 1 ? "EVENTS" : "EVENT", X, 380);
        ctx.font = "600 28px 'Playfair Display'";
        ctx.fillStyle = "#2A1A10";
        wrapLines(ctx, reg.eventNames.join("  ·  "), maxW, 2)
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
        drawQR(ctx, `SUPRAGNA27|${reg.regId}|${reg.events.join(",")}`, qrX, qrY, qrSize);

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
    renderTabs();
    renderTickets();
    wantedCard.innerHTML = grandHTML();
    updatePicked();
    parallax();

    openScroll();
    $("#googleBtn").addEventListener("click", () => openBoxOffice(true));
    $("#manualBtn").addEventListener("click", () => openBoxOffice(false));

    tabs.addEventListener("click", (e) => {
        const tab = e.target.closest(".booth-tab");
        if (tab && tab.dataset.cat !== state.filter) setFilter(tab.dataset.cat);
    });

    ticketList.addEventListener("click", (e) => {
        const more = e.target.closest("[data-more]");
        if (more) {
            showPoster(eventsById.get(more.dataset.more));
            if (window.matchMedia("(max-width: 860px)").matches) {
                wanted.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
            }
            return;
        }
        const ticket = e.target.closest(".eticket");
        if (ticket) toggleEvent(ticket.dataset.id);
    });

    wantedCard.addEventListener("click", (e) => {
        const pick = e.target.closest("[data-pick]");
        if (pick) toggleEvent(pick.dataset.pick);
    });

    pickedList.addEventListener("click", (e) => {
        const x = e.target.closest("[data-unpick]");
        if (x) toggleEvent(x.dataset.unpick);
    });

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
