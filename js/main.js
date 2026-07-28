/* =====================================================================
   main.js — логика лендинга. Все кнопки работают через API.
   ===================================================================== */

(function () {
    "use strict";

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));

    const PAGE_SIZE = 16;

    const state = {
        products: [],
        total: 0,
        offset: 0,
        category: "all",
        query: "",
        wishIds: [],
        cart: null,
        banners: [],
        slide: 0,
        timer: null,
        user: null,
    };

    /* ---------------- utils ---------------- */

    const money = (n) => "$" + Number(n).toLocaleString("en-US");

    function escapeHtml(str) {
        return String(str == null ? "" : str).replace(/[&<>"']/g, (ch) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[ch]));
    }

    let toastTimer;
    function toast(message, kind) {
        const el = $("#toast");
        el.textContent = message;
        el.className = "toast" + (kind ? " toast--" + kind : "");
        el.hidden = false;
        requestAnimationFrame(() => el.classList.add("is-show"));
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            el.classList.remove("is-show");
            setTimeout(() => { el.hidden = true; }, 300);
        }, 2600);
    }

    function fail(err) {
        console.error(err);
        toast(err && err.message ? err.message : "Непредвиденная ошибка", "error");
    }

    function busy(button, on) {
        if (!button) return;
        button.disabled = !!on;
        if (on) {
            button.dataset.label = button.textContent;
            button.textContent = "...";
        } else if (button.dataset.label) {
            button.textContent = button.dataset.label;
            delete button.dataset.label;
        }
    }

    /* ---------------- overlay / modal ---------------- */

    function lock(on) {
        document.body.classList.toggle("is-locked", on);
        $("#overlay").hidden = !on;
    }

    function openModal(id) {
        $(id).hidden = false;
        lock(true);
        $("#overlay").hidden = true;
    }

    function closeAll() {
        $$(".modal").forEach((m) => { m.hidden = true; });
        $("#cartDrawer").hidden = true;
        lock(false);
    }

    $("#overlay").addEventListener("click", closeAll);

    document.addEventListener("click", (e) => {
        if (e.target.matches("[data-close]") || e.target.classList.contains("modal")) closeAll();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAll();
    });

    /* =================================================================
       HERO (GET /api/banners)
       ================================================================= */

    async function loadBanners() {
        try {
            const data = await api.get("/banners");
            state.banners = data.items;
            renderHero();
        } catch (err) {
            $("#heroSlides").innerHTML = '<p class="empty">Не удалось загрузить баннеры</p>';
            fail(err);
        }
    }

    function renderHero() {
        const box = $("#heroSlides");
        const dots = $("#heroDots");
        if (!state.banners.length) {
            box.innerHTML = '<p class="empty">Баннеров нет</p>';
            dots.innerHTML = "";
            return;
        }

        box.innerHTML = state.banners.map((b, i) => `
            <article class="slide${i === 0 ? " is-active" : ""}">
                <div class="slide__text">
                    ${b.eyebrow ? `<span class="badge">${escapeHtml(b.eyebrow)}</span>` : ""}
                    <h1 class="slide__title">${escapeHtml(b.title)}${b.subtitle ? `<br><span>${escapeHtml(b.subtitle)}</span>` : ""}</h1>
                    ${b.text ? `<p class="slide__desc">${escapeHtml(b.text)}</p>` : ""}
                    <div class="slide__btns">
                        <a class="btn btn--dark" href="${escapeHtml(b.primary_link || "#top-sales")}">${escapeHtml(b.primary_label || "Shop now")}</a>
                        ${b.secondary_label ? `<a class="btn btn--ghost" href="${escapeHtml(b.secondary_link || "#top-sales")}">${escapeHtml(b.secondary_label)}</a>` : ""}
                    </div>
                </div>
                <div class="slide__media" style="background-image:url('${escapeHtml(b.image)}')"></div>
            </article>
        `).join("");

        dots.innerHTML = state.banners.map((_, i) =>
            `<button class="dot${i === 0 ? " is-active" : ""}" type="button" role="tab" data-i="${i}" aria-label="Banner ${i + 1}"></button>`
        ).join("");

        state.slide = 0;
        autoplay();
    }

    function goSlide(index) {
        const slides = $$("#heroSlides .slide");
        if (!slides.length) return;
        state.slide = (index + slides.length) % slides.length;
        slides.forEach((s, i) => s.classList.toggle("is-active", i === state.slide));
        $$("#heroDots .dot").forEach((d, i) => d.classList.toggle("is-active", i === state.slide));
        autoplay();
    }

    function autoplay() {
        clearInterval(state.timer);
        state.timer = setInterval(() => goSlide(state.slide + 1), 6000);
    }

    $("#heroDots").addEventListener("click", (e) => {
        const dot = e.target.closest(".dot");
        if (dot) goSlide(Number(dot.dataset.i));
    });

    /* =================================================================
       USP (GET /api/usp)
       ================================================================= */

    async function loadUsp() {
        try {
            const data = await api.get("/usp");
            $("#uspGrid").innerHTML = data.items.map((u) => `
                <li class="usp__item">
                    <span class="usp__dot" aria-hidden="true"></span>
                    <span><b>${escapeHtml(u.title)}</b><span>${escapeHtml(u.text)}</span></span>
                </li>
            `).join("");
        } catch (err) {
            fail(err);
        }
    }

    /* =================================================================
       CATEGORIES (GET /api/categories)
       ================================================================= */

    async function loadCategories() {
        try {
            const data = await api.get("/categories");
            $("#catsGrid").innerHTML = data.items.map((c) => `
                <a class="cat" href="#top-sales" data-slug="${escapeHtml(c.slug)}">
                    <span class="cat__img" style="background-image:url('${escapeHtml(c.image)}')"></span>
                    <span class="cat__name">${escapeHtml(c.name)}</span>
                    <span class="cat__count">${Number(c.count).toLocaleString("en-US")} items</span>
                    <span class="cat__more">Browse →</span>
                </a>
            `).join("");

            $("#footerCats").innerHTML = data.items.slice(0, 5).map((c) =>
                `<li><a href="#top-sales" data-slug="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</a></li>`
            ).join("");
        } catch (err) {
            $("#catsGrid").innerHTML = '<p class="empty">Не удалось загрузить категории</p>';
            fail(err);
        }
    }

    function pickCategory(slug) {
        state.category = state.category === slug ? "all" : slug;
        state.query = "";
        $("#searchInput").value = "";
        state.offset = 0;
        $$(".cat").forEach((c) => c.classList.toggle("is-active", c.dataset.slug === state.category));
        loadProducts();
    }

    document.addEventListener("click", (e) => {
        const link = e.target.closest("[data-slug]");
        if (!link) return;
        e.preventDefault();
        pickCategory(link.dataset.slug);
        $("#top-sales").scrollIntoView({ behavior: "smooth" });
    });

    /* =================================================================
       PRODUCTS (GET /api/products)
       ================================================================= */

    async function loadProducts(append) {
        const grid = $("#productsGrid");
        if (!append) {
            state.offset = 0;
            grid.innerHTML = '<p class="empty">Загрузка…</p>';
        }

        try {
            const data = await api.get("/products", {
                category: state.category,
                q: state.query,
                limit: PAGE_SIZE,
                offset: state.offset,
            });

            state.total = data.total;
            state.products = append ? state.products.concat(data.items) : data.items;

            if (!append) grid.innerHTML = "";
            if (!state.products.length) {
                grid.innerHTML = "";
                $("#productsEmpty").hidden = false;
            } else {
                $("#productsEmpty").hidden = true;
                grid.insertAdjacentHTML("beforeend", data.items.map(cardHtml).join(""));
            }

            $("#showMore").hidden = !data.has_more;
            $("#showMore").textContent = "Show more (" + Math.max(state.total - state.products.length, 0) + ")";

            const label = state.query
                ? 'Search: "' + state.query + '"'
                : (state.category === "all" ? "Top sales" : catName(state.category));
            $("#salesTitle").textContent = label;
            $("#viewAll").textContent = state.category === "all" && !state.query
                ? "View all →" : "Reset →";
        } catch (err) {
            grid.innerHTML = '<p class="empty">Не удалось загрузить товары</p>';
            fail(err);
        }
    }

    function catName(slug) {
        const el = $('.cat[data-slug="' + slug + '"] .cat__name');
        return el ? el.textContent : slug;
    }

    function cardHtml(p) {
        const fav = state.wishIds.indexOf(p.id) !== -1;
        const out = (p.stock || 0) <= 0;
        return `
        <article class="card" data-id="${p.id}">
            <button class="card__media" type="button" data-open="${p.id}"
                    style="background-image:url('${escapeHtml(p.image)}')" aria-label="${escapeHtml(p.name)}"></button>
            ${p.discount ? `<span class="card__tag">-${p.discount}%</span>` : ""}
            <button class="card__fav${fav ? " is-on" : ""}" type="button" data-fav="${p.id}"
                    aria-label="Wishlist">${fav ? "♥" : "♡"}</button>
            <h3 class="card__name" data-open="${p.id}">${escapeHtml(p.name)}</h3>
            <p class="card__stock${out ? " card__stock--out" : ""}">${out ? "Out of stock" : "In stock: " + p.stock}</p>
            <div class="card__bottom">
                <p class="card__price">${money(p.price)}
                    ${p.old_price ? `<span class="card__old">${money(p.old_price)}</span>` : ""}
                </p>
                <button class="card__buy" type="button" data-buy="${p.id}" ${out ? "disabled" : ""} aria-label="Add to cart">
                    <svg viewBox="0 0 24 24"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M6 6L5 3H2"/></svg>
                </button>
            </div>
        </article>`;
    }

    $("#showMore").addEventListener("click", async function () {
        busy(this, true);
        state.offset = state.products.length;
        await loadProducts(true);
        busy(this, false);
    });

    $("#viewAll").addEventListener("click", (e) => {
        e.preventDefault();
        state.category = "all";
        state.query = "";
        $("#searchInput").value = "";
        $$(".cat").forEach((c) => c.classList.remove("is-active"));
        loadProducts();
    });

    $("#catalogBtn").addEventListener("click", () => {
        $("#categories").scrollIntoView({ behavior: "smooth" });
    });

    /* ---------------- card actions ---------------- */

    $("#productsGrid").addEventListener("click", async (e) => {
        const open = e.target.closest("[data-open]");
        const buy = e.target.closest("[data-buy]");
        const fav = e.target.closest("[data-fav]");

        if (open) return showProduct(Number(open.dataset.open));
        if (buy) return addToCart(Number(buy.dataset.buy), 1, buy);
        if (fav) return toggleWish(Number(fav.dataset.fav));
    });

    /* =================================================================
       PRODUCT MODAL (GET /api/products/:id)
       ================================================================= */

    async function showProduct(id) {
        openModal("#productModal");
        $("#pmodalBody").innerHTML = '<p class="empty">Загрузка…</p>';
        try {
            const p = await api.get("/products/" + id);
            const fav = state.wishIds.indexOf(p.id) !== -1;
            $("#pmodalBody").innerHTML = `
                <div class="pmodal__img" style="background-image:url('${escapeHtml(p.image)}')"></div>
                <div class="pmodal__body">
                    <p class="pmodal__cat">${escapeHtml(p.category_name)}</p>
                    <h2 class="pmodal__name">${escapeHtml(p.name)}</h2>
                    <p class="pmodal__desc">${escapeHtml(p.description || "")}</p>
                    <p class="pmodal__meta">SKU: <b>${escapeHtml(p.sku)}</b> · Stock: <b>${p.stock}</b></p>
                    <div class="pmodal__price">
                        <b>${money(p.price)}</b>
                        ${p.old_price ? `<s>${money(p.old_price)}</s>` : ""}
                    </div>
                    <div class="pmodal__btns">
                        <button class="btn btn--dark" type="button" data-buy="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>
                            ${p.stock <= 0 ? "Out of stock" : "Add to cart"}
                        </button>
                        <button class="btn btn--ghost" type="button" data-fav="${p.id}">
                            ${fav ? "♥ In wishlist" : "♡ Wishlist"}
                        </button>
                    </div>
                </div>`;
        } catch (err) {
            $("#pmodalBody").innerHTML = '<p class="empty">' + escapeHtml(err.message) + "</p>";
        }
    }

    $("#pmodalBody").addEventListener("click", (e) => {
        const buy = e.target.closest("[data-buy]");
        const fav = e.target.closest("[data-fav]");
        if (buy) addToCart(Number(buy.dataset.buy), 1, buy);
        if (fav) toggleWish(Number(fav.dataset.fav)).then(() => showProduct(Number(fav.dataset.fav)));
    });

    /* =================================================================
       WISHLIST (GET / POST / DELETE /api/wishlist)
       ================================================================= */

    async function loadWishlist() {
        try {
            const data = await api.get("/wishlist");
            state.wishIds = data.ids;
            paintWish();
        } catch (err) {
            console.error(err);
        }
    }

    function paintWish() {
        const badge = $("#wishCount");
        badge.textContent = state.wishIds.length;
        badge.hidden = state.wishIds.length === 0;
        $$("[data-fav]").forEach((btn) => {
            const on = state.wishIds.indexOf(Number(btn.dataset.fav)) !== -1;
            if (btn.classList.contains("card__fav")) {
                btn.classList.toggle("is-on", on);
                btn.textContent = on ? "♥" : "♡";
            }
        });
    }

    async function toggleWish(id) {
        const on = state.wishIds.indexOf(id) !== -1;
        try {
            const data = on
                ? await api.del("/wishlist/" + id)
                : await api.post("/wishlist", { product_id: id });
            state.wishIds = data.ids;
            paintWish();
            toast(on ? "Удалено из избранного" : "Добавлено в избранное", on ? null : "ok");
        } catch (err) {
            fail(err);
        }
    }

    $("#wishBtn").addEventListener("click", async () => {
        try {
            const data = await api.get("/wishlist");
            state.wishIds = data.ids;
            paintWish();
            openDrawer("Wishlist", data.items.length
                ? data.items.map((p) => `
                    <div class="citem">
                        <span class="citem__img" style="background-image:url('${escapeHtml(p.image)}')"></span>
                        <div class="citem__mid">
                            <p class="citem__name">${escapeHtml(p.name)}</p>
                            <p class="citem__price">${money(p.price)}</p>
                            <button class="btn btn--ghost" style="height:34px;padding:0 14px;font-size:13px"
                                    type="button" data-wbuy="${p.id}">Add to cart</button>
                        </div>
                        <div class="citem__right">
                            <button class="citem__del" type="button" data-wdel="${p.id}">Remove</button>
                        </div>
                    </div>`).join("")
                : '<div class="drawer__empty"><b>Избранное пусто</b><span>Нажмите на сердечко</span></div>');
            $("#cartFoot").hidden = true;
        } catch (err) {
            fail(err);
        }
    });

    /* =================================================================
       CART (GET / POST / PATCH / DELETE /api/cart)
       ================================================================= */

    async function loadCart() {
        try {
            state.cart = await api.get("/cart");
            paintCart();
        } catch (err) {
            console.error(err);
        }
    }

    function paintCart() {
        const badge = $("#cartCount");
        const count = state.cart ? state.cart.count : 0;
        badge.textContent = count;
        badge.hidden = count === 0;
    }

    async function addToCart(id, qty, button) {
        busy(button, true);
        try {
            state.cart = await api.post("/cart", { product_id: id, qty: qty || 1 });
            paintCart();
            toast("Добавлено в корзину", "ok");
        } catch (err) {
            fail(err);
        } finally {
            busy(button, false);
        }
    }

    function openDrawer(title, html) {
        $("#drawerTitle").textContent = title;
        $("#cartBody").innerHTML = html;
        $("#cartDrawer").hidden = false;
        lock(true);
    }

    function renderCart() {
        const cart = state.cart;
        if (!cart || !cart.items.length) {
            openDrawer("Cart", '<div class="drawer__empty"><b>Корзина пуста</b><span>Добавьте товар</span></div>');
            $("#cartFoot").hidden = true;
            return;
        }

        openDrawer("Cart", cart.items.map((i) => `
            <div class="citem">
                <span class="citem__img" style="background-image:url('${escapeHtml(i.image)}')"></span>
                <div class="citem__mid">
                    <p class="citem__name">${escapeHtml(i.name)}</p>
                    <p class="citem__price">${money(i.price)} / шт.</p>
                    <div class="qty">
                        <button type="button" data-qty="${i.id}" data-to="${i.qty - 1}" aria-label="minus">−</button>
                        <span>${i.qty}</span>
                        <button type="button" data-qty="${i.id}" data-to="${i.qty + 1}" aria-label="plus">+</button>
                    </div>
                </div>
                <div class="citem__right">
                    <b class="citem__total">${money(i.line_total)}</b>
                    <button class="citem__del" type="button" data-del="${i.id}">Remove</button>
                </div>
            </div>`).join(""));

        $("#cartFoot").hidden = false;
        $("#cartSubtotal").textContent = money(cart.subtotal);
        $("#cartDelivery").textContent = cart.delivery ? money(cart.delivery) : "Free";
        $("#cartTotal").textContent = money(cart.total);
    }

    $("#cartBtn").addEventListener("click", async () => {
        await loadCart();
        renderCart();
    });

    $("#cartClose").addEventListener("click", closeAll);

    $("#cartBody").addEventListener("click", async (e) => {
        const qtyBtn = e.target.closest("[data-qty]");
        const delBtn = e.target.closest("[data-del]");
        const wDel = e.target.closest("[data-wdel]");
        const wBuy = e.target.closest("[data-wbuy]");

        try {
            if (qtyBtn) {
                state.cart = await api.patch("/cart/" + qtyBtn.dataset.qty, { qty: Number(qtyBtn.dataset.to) });
                paintCart();
                renderCart();
            } else if (delBtn) {
                state.cart = await api.del("/cart/" + delBtn.dataset.del);
                paintCart();
                renderCart();
                toast("Удалено из корзины");
            } else if (wDel) {
                const data = await api.del("/wishlist/" + wDel.dataset.wdel);
                state.wishIds = data.ids;
                paintWish();
                $("#wishBtn").click();
            } else if (wBuy) {
                await addToCart(Number(wBuy.dataset.wbuy), 1, wBuy);
            }
        } catch (err) {
            fail(err);
        }
    });

    $("#clearCartBtn").addEventListener("click", async () => {
        if (!confirm("Очистить корзину?")) return;
        try {
            state.cart = await api.del("/cart");
            paintCart();
            renderCart();
            toast("Корзина очищена");
        } catch (err) {
            fail(err);
        }
    });

    /* =================================================================
       CHECKOUT (POST /api/orders)
       ================================================================= */

    $("#checkoutBtn").addEventListener("click", () => {
        if (!state.cart || !state.cart.items.length) return toast("Корзина пуста", "error");
        $("#cartDrawer").hidden = true;
        $("#checkoutMsg").textContent = "";
        openModal("#checkoutModal");
    });

    $("#checkoutForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        const payload = {
            name: form.name.value.trim(),
            phone: form.phone.value.trim(),
            email: form.email.value.trim(),
            address: form.address.value.trim(),
            comment: form.comment.value.trim(),
        };

        $$("#checkoutForm .is-error").forEach((el) => el.classList.remove("is-error"));
        if (!payload.name || !payload.phone) {
            $("#checkoutMsg").textContent = "Имя и телефон обязательны";
            (!payload.name ? form.name : form.phone).classList.add("is-error");
            return;
        }

        const submit = $("#checkoutSubmit");
        busy(submit, true);
        try {
            const order = await api.post("/orders", payload);
            form.reset();
            closeAll();
            await loadCart();
            await loadProducts();
            $("#doneTitle").textContent = "Order " + order.number;
            $("#doneText").textContent = "Спасибо! Заказ принят, сумма: " + money(order.total)
                + ". Наш оператор перезвонит на номер " + order.phone + ".";
            openModal("#doneModal");
        } catch (err) {
            $("#checkoutMsg").textContent = err.message;
            if (err.field && form[err.field]) form[err.field].classList.add("is-error");
        } finally {
            busy(submit, false);
        }
    });

    /* =================================================================
       SEARCH (GET /api/products?q=)
       ================================================================= */

    let searchTimer;

    $("#searchInput").addEventListener("input", function () {
        clearTimeout(searchTimer);
        const value = this.value.trim();
        if (value.length < 2) {
            $("#searchDrop").hidden = true;
            return;
        }
        searchTimer = setTimeout(async () => {
            try {
                const data = await api.get("/products", { q: value, limit: 6 });
                const drop = $("#searchDrop");
                drop.innerHTML = data.items.length
                    ? data.items.map((p) => `
                        <button class="sug" type="button" data-open="${p.id}">
                            <img src="${escapeHtml(p.image)}" alt="">
                            <span class="sug__name">${escapeHtml(p.name)}</span>
                            <span class="sug__price">${money(p.price)}</span>
                        </button>`).join("")
                    : '<p class="sug--empty">Ничего не найдено</p>';
                drop.hidden = false;
            } catch (err) {
                console.error(err);
            }
        }, 250);
    });

    $("#searchDrop").addEventListener("click", (e) => {
        const item = e.target.closest("[data-open]");
        if (!item) return;
        $("#searchDrop").hidden = true;
        showProduct(Number(item.dataset.open));
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search")) $("#searchDrop").hidden = true;
    });

    $("#searchForm").addEventListener("submit", (e) => {
        e.preventDefault();
        state.query = $("#searchInput").value.trim();
        state.category = "all";
        state.offset = 0;
        $$(".cat").forEach((c) => c.classList.remove("is-active"));
        $("#searchDrop").hidden = true;
        loadProducts();
        $("#top-sales").scrollIntoView({ behavior: "smooth" });
    });

    /* =================================================================
       AUTH (POST /api/auth/login, /logout, GET /me)
       ================================================================= */

    async function loadMe() {
        try {
            const data = await api.get("/auth/me");
            state.user = data.user;
            $("#signLabel").textContent = data.authenticated ? "Admin" : "Sign in";
        } catch (err) {
            console.error(err);
        }
    }

    $("#signBtn").addEventListener("click", () => {
        if (state.user) {
            location.href = "admin.html";
            return;
        }
        $("#loginMsg").textContent = "";
        openModal("#loginModal");
    });

    $("#loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            await api.post("/auth/login", {
                email: form.email.value.trim(),
                password: form.password.value,
            });
            location.href = "admin.html";
        } catch (err) {
            $("#loginMsg").textContent = err.message;
        }
    });

    /* =================================================================
       SUBSCRIBE (POST /api/subscribers)
       ================================================================= */

    $("#subscribeForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = $("#subscribeInput");
        const msg = $("#subscribeMsg");
        input.classList.remove("is-error");
        msg.className = "form__msg";

        try {
            await api.post("/subscribers", { email: input.value.trim() });
            msg.textContent = "Спасибо! Подписка оформлена.";
            input.value = "";
        } catch (err) {
            msg.className = "form__msg form__msg--error";
            msg.textContent = err.message;
            input.classList.add("is-error");
        }
    });

    /* =================================================================
       МОБИЛЬНОЕ МЕНЮ + АККОРДЕОН В ФУТЕРЕ
       ================================================================= */

    const burger = $("#burger");
    burger.addEventListener("click", () => {
        const open = burger.getAttribute("aria-expanded") === "true";
        burger.setAttribute("aria-expanded", String(!open));
        $("#mobileMenu").hidden = open;
    });

    $("#mobileMenu").addEventListener("click", (e) => {
        if (e.target.tagName === "A") {
            burger.setAttribute("aria-expanded", "false");
            $("#mobileMenu").hidden = true;
        }
    });

    $$(".footer__title button").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (window.innerWidth > 768) return;
            btn.closest(".footer__col").classList.toggle("is-open");
        });
    });

    function syncMenu() {
        if (window.innerWidth > 768) {
            $("#mobileMenu").hidden = true;
            burger.setAttribute("aria-expanded", "false");
        }
    }
    window.addEventListener("resize", syncMenu);

    /* =================================================================
       START
       ================================================================= */

    (async function init() {
        syncMenu();
        await Promise.all([loadMe(), loadWishlist(), loadCart()]);
        await Promise.all([loadBanners(), loadUsp(), loadCategories()]);
        await loadProducts();
        paintWish();
    })();
})();
