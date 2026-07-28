/* =====================================================================
   admin.js — CRUD panel (GET / POST / PATCH / PUT / DELETE)
   ===================================================================== */

(function () {
    "use strict";

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));

    const state = { categories: [], products: [], banners: [], orders: [], subs: [] };
    const money = (n) => "$" + Number(n).toLocaleString("en-US");

    function escapeHtml(str) {
        return String(str == null ? "" : str).replace(/[&<>"']/g, (ch) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[ch]));
    }

    function shortDate(iso) {
        if (!iso) return "—";
        const d = new Date(iso);
        return isNaN(d) ? iso : d.toLocaleString("en-GB", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
        });
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
        toast(err && err.message ? err.message : "Ошибка", "error");
        if (err && err.status === 401) showGate();
    }

    function closeModals() {
        $$(".modal").forEach((m) => { m.hidden = true; });
        document.body.classList.remove("is-locked");
    }

    document.addEventListener("click", (e) => {
        if (e.target.matches("[data-close]") || e.target.classList.contains("modal")) closeModals();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModals();
    });

    /* =================================================================
       AUTH
       ================================================================= */

    function showGate() {
        $("#gate").hidden = false;
        $("#panel").hidden = true;
    }

    function showPanel() {
        $("#gate").hidden = true;
        $("#panel").hidden = false;
    }

    $("#gateForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        $("#gateMsg").textContent = "";
        try {
            await api.post("/auth/login", {
                email: form.email.value.trim(),
                password: form.password.value,
            });
            showPanel();
            boot();
        } catch (err) {
            $("#gateMsg").textContent = err.message;
        }
    });

    $("#logoutBtn").addEventListener("click", async () => {
        try {
            await api.post("/auth/logout");
            showGate();
            toast("Вы вышли");
        } catch (err) {
            fail(err);
        }
    });

    $("#resetBtn").addEventListener("click", () => {
        confirmAction("Восстановить демо-данные?",
            "Все изменения, заказы и подписчики будут удалены.", async () => {
                await api.post("/admin/reset");
                toast("Данные восстановлены", "ok");
                boot();
            });
    });

    /* =================================================================
       TABS
       ================================================================= */

    $("#sideNav").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tab]");
        if (!btn) return;
        $$(".side__link[data-tab]").forEach((b) => b.classList.toggle("is-active", b === btn));
        $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.panel === btn.dataset.tab));
        const loaders = {
            dash: loadDash, products: loadProducts, categories: loadCategories,
            banners: loadBanners, orders: loadOrders, subs: loadSubs,
        };
        (loaders[btn.dataset.tab] || function () {})();
    });

    /* =================================================================
       CONFIRM
       ================================================================= */

    let confirmFn = null;

    function confirmAction(title, text, fn) {
        $("#confirmTitle").textContent = title;
        $("#confirmText").textContent = text || "";
        confirmFn = fn;
        $("#confirmModal").hidden = false;
        document.body.classList.add("is-locked");
    }

    $("#confirmYes").addEventListener("click", async () => {
        const fn = confirmFn;
        confirmFn = null;
        closeModals();
        if (fn) {
            try {
                await fn();
            } catch (err) {
                fail(err);
            }
        }
    });

    /* =================================================================
       FORM MODAL
       ================================================================= */

    let submitFn = null;

    /**
     * fields: [{name, label, type, value, options, full, placeholder}]
     * type: text | number | textarea | select | checkbox | image
     */
    function openForm(title, fields, onSubmit) {
        $("#formTitle").textContent = title;
        $("#formMsg").textContent = "";
        $("#formFields").innerHTML = fields.map(fieldHtml).join("");
        submitFn = onSubmit;
        $("#formModal").hidden = false;
        document.body.classList.add("is-locked");
        const first = $("#formFields input, #formFields textarea, #formFields select");
        if (first) first.focus();
    }

    function fieldHtml(f) {
        const cls = "field" + (f.full || f.type === "textarea" || f.type === "image" ? " field--full" : "");
        const val = f.value == null ? "" : f.value;

        if (f.type === "checkbox") {
            return `<label class="check field--full">
                        <input type="checkbox" name="${f.name}" ${val ? "checked" : ""}>${escapeHtml(f.label)}
                    </label>`;
        }
        if (f.type === "textarea") {
            return `<label class="${cls}"><span>${escapeHtml(f.label)}</span>
                        <textarea name="${f.name}" rows="3">${escapeHtml(val)}</textarea></label>`;
        }
        if (f.type === "select") {
            return `<label class="${cls}"><span>${escapeHtml(f.label)}</span>
                        <select name="${f.name}">${f.options.map((o) =>
                            `<option value="${escapeHtml(o.value)}"${String(o.value) === String(val) ? " selected" : ""}>${escapeHtml(o.label)}</option>`
                        ).join("")}</select></label>`;
        }
        if (f.type === "image") {
            return `<div class="${cls}"><span style="display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:var(--muted)">${escapeHtml(f.label)}</span>
                        <div class="upload">
                            <span class="upload__preview" id="upPreview" style="background-image:url('${escapeHtml(val)}')"></span>
                            <div style="flex:1;min-width:0">
                                <input name="${f.name}" value="${escapeHtml(val)}" placeholder="img/product/name.jpg">
                                <input type="file" id="upFile" accept="image/*" style="margin-top:8px">
                            </div>
                        </div>
                    </div>`;
        }
        return `<label class="${cls}"><span>${escapeHtml(f.label)}</span>
                    <input name="${f.name}" type="${f.type || "text"}" value="${escapeHtml(val)}"
                           placeholder="${escapeHtml(f.placeholder || "")}"></label>`;
    }

    /* загрузка изображения (POST /api/upload) */
    $("#formFields").addEventListener("change", async (e) => {
        if (e.target.id !== "upFile" || !e.target.files.length) return;
        const fd = new FormData();
        fd.append("file", e.target.files[0]);
        try {
            const res = await api.raw("POST", "/upload", fd);
            const input = $('#formFields input[name="image"]');
            input.value = res.url;
            $("#upPreview").style.backgroundImage = "url('" + res.url + "')";
            toast("Изображение загружено", "ok");
        } catch (err) {
            fail(err);
        }
    });

    $("#crudForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {};
        $$("#formFields [name]").forEach((el) => {
            data[el.name] = el.type === "checkbox" ? el.checked : el.value.trim();
        });

        $$("#formFields .is-error").forEach((el) => el.classList.remove("is-error"));
        $("#formMsg").textContent = "";
        const submit = $("#formSubmit");
        submit.disabled = true;

        try {
            if (submitFn) await submitFn(data);
            closeModals();
        } catch (err) {
            $("#formMsg").textContent = err.message;
            const bad = err.field && $('#formFields [name="' + err.field + '"]');
            if (bad) bad.classList.add("is-error");
        } finally {
            submit.disabled = false;
        }
    });

    /* =================================================================
       DASHBOARD
       ================================================================= */

    async function loadDash() {
        try {
            const [stats, orders] = await Promise.all([api.get("/stats"), api.get("/orders")]);
            $("#stats").innerHTML = [
                ["Products", stats.products], ["Orders", stats.orders],
                ["Revenue", money(stats.revenue)], ["Subscribers", stats.subscribers],
                ["Active", stats.active_products], ["Out of stock", stats.out_of_stock],
                ["New orders", stats.new_orders], ["Categories", stats.categories],
            ].map(([label, value]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`).join("");

            $("#dashOrders").innerHTML = orders.items.length
                ? table(["#", "Customer", "Items", "Total", "Status", "Date"],
                    orders.items.slice(0, 6).map((o) => `
                        <tr>
                            <td><b>${escapeHtml(o.number)}</b></td>
                            <td>${escapeHtml(o.name)}<div class="muted">${escapeHtml(o.phone)}</div></td>
                            <td>${o.items.length}</td>
                            <td><b>${money(o.total)}</b></td>
                            <td><span class="chip chip--${o.status}">${o.status}</span></td>
                            <td class="muted">${shortDate(o.created_at)}</td>
                        </tr>`).join(""))
                : '<p class="empty-row">Заказов пока нет</p>';
        } catch (err) {
            fail(err);
        }
    }

    function table(head, rows) {
        return `<table><thead><tr>${head.map((h) =>
            `<th${h === "" ? ' style="text-align:right"' : ""}>${h}</th>`).join("")}</tr></thead>
            <tbody>${rows}</tbody></table>`;
    }

    /* =================================================================
       PRODUCTS
       ================================================================= */

    async function loadProducts() {
        try {
            if (!state.categories.length) {
                state.categories = (await api.get("/categories")).items;
                $("#pCat").innerHTML = '<option value="">All categories</option>' +
                    state.categories.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("");
            }
            const data = await api.get("/products", {
                q: $("#pSearch").value.trim(),
                category: $("#pCat").value,
            });
            state.products = data.items;
            renderProducts();
        } catch (err) {
            fail(err);
        }
    }

    function renderProducts() {
        if (!state.products.length) {
            $("#pTable").innerHTML = '<p class="empty-row">Товары не найдены</p>';
            return;
        }
        $("#pTable").innerHTML = table(
            ["", "Name", "Category", "Price", "Stock", "Status", ""],
            state.products.map((p) => `
                <tr>
                    <td><span class="thumb" style="background-image:url('${escapeHtml(p.image)}')"></span></td>
                    <td><b>${escapeHtml(p.name)}</b><div class="muted">${escapeHtml(p.sku)}</div></td>
                    <td>${escapeHtml(p.category_name)}</td>
                    <td><b>${money(p.price)}</b>${p.old_price ? `<div class="muted"><s>${money(p.old_price)}</s></div>` : ""}</td>
                    <td>${p.stock}</td>
                    <td><span class="chip chip--${p.is_active ? "on" : "off"}">${p.is_active ? "active" : "hidden"}</span></td>
                    <td><div class="row-actions">
                        <button class="mini" type="button" data-ptoggle="${p.id}">${p.is_active ? "Hide" : "Show"}</button>
                        <button class="mini" type="button" data-pedit="${p.id}">Edit</button>
                        <button class="mini mini--danger" type="button" data-pdel="${p.id}">Delete</button>
                    </div></td>
                </tr>`).join(""));
    }

    function productFields(p) {
        p = p || {};
        return [
            { name: "name", label: "Name *", value: p.name, full: true },
            { name: "price", label: "Price ($) *", type: "number", value: p.price },
            { name: "old_price", label: "Old price ($)", type: "number", value: p.old_price || "" },
            {
                name: "category", label: "Category *", type: "select", value: p.category,
                options: state.categories.map((c) => ({ value: c.slug, label: c.name })),
            },
            { name: "stock", label: "Stock", type: "number", value: p.stock == null ? 0 : p.stock },
            { name: "sku", label: "SKU", value: p.sku || "" },
            { name: "image", label: "Image", type: "image", value: p.image || "img/product/headphones-xr40.jpg" },
            { name: "description", label: "Description", type: "textarea", value: p.description || "" },
            { name: "is_active", label: "Active (показывать в магазине)", type: "checkbox", value: p.is_active !== false },
        ];
    }

    function normalizeProduct(data) {
        return {
            name: data.name,
            price: Number(data.price),
            old_price: data.old_price === "" ? null : Number(data.old_price),
            category: data.category,
            stock: Number(data.stock || 0),
            sku: data.sku,
            image: data.image,
            description: data.description,
            is_active: data.is_active,
        };
    }

    $("#pNew").addEventListener("click", () => {
        openForm("New product", productFields(), async (data) => {
            await api.post("/products", normalizeProduct(data));
            toast("Товар добавлен", "ok");
            loadProducts();
        });
    });

    /* ---------------- ГЕНЕРАТОР ТОВАРОВ ---------------- */

    $("#pGen").addEventListener("click", () => {
        const fields = [
            { name: "count", label: "Сколько товаров (1–100)", type: "number", value: 20 },
            {
                name: "category", label: "Категория", type: "select", value: "all",
                options: [{ value: "all", label: "Все категории (по очереди)" }].concat(
                    state.categories.map((c) => ({ value: c.slug, label: c.name }))),
            },
            {
                name: "source", label: "Изображения", type: "select", value: "internet",
                options: [
                    { value: "internet", label: "Из интернета (реальные фото)" },
                    { value: "offline", label: "Локальные (без интернета)" },
                ],
            },
            { name: "min_price", label: "Цена от ($)", type: "number", value: 29 },
            { name: "max_price", label: "Цена до ($)", type: "number", value: 1499 },
            { name: "discounts", label: "Добавить скидки части товаров", type: "checkbox", value: true },
        ];

        openForm("Генератор товаров", fields, async (data) => {
            $("#formMsg").style.color = "var(--muted)";
            $("#formMsg").textContent = "Генерация… загружаем изображения, это займёт несколько секунд.";
            try {
                const res = await api.post("/products/generate", {
                    count: Number(data.count),
                    category: data.category,
                    source: data.source,
                    min_price: Number(data.min_price),
                    max_price: Number(data.max_price),
                    discounts: data.discounts,
                });
                toast("Создано товаров: " + res.created
                    + (res.source === "internet" ? " (фото из интернета)" : " (локальные фото)"), "ok");
                loadProducts();
            } finally {
                $("#formMsg").style.color = "";
            }
        });
    });

    $("#pGenDel").addEventListener("click", () => {
        confirmAction("Удалить сгенерированные товары?",
            "Товары из макета останутся на месте.", async () => {
                const res = await api.del("/products/generated");
                toast(res.deleted ? "Удалено товаров: " + res.deleted : "Сгенерированных товаров нет");
                loadProducts();
            });
    });

    $("#pTable").addEventListener("click", async (e) => {
        const edit = e.target.closest("[data-pedit]");
        const del = e.target.closest("[data-pdel]");
        const toggle = e.target.closest("[data-ptoggle]");

        try {
            if (edit) {
                const p = await api.get("/products/" + edit.dataset.pedit);
                openForm("Edit — " + p.name, productFields(p), async (data) => {
                    await api.patch("/products/" + p.id, normalizeProduct(data));
                    toast("Сохранено", "ok");
                    loadProducts();
                });
            } else if (toggle) {
                const p = state.products.find((x) => x.id === Number(toggle.dataset.ptoggle));
                await api.patch("/products/" + p.id, { is_active: !p.is_active });
                toast(p.is_active ? "Скрыто" : "Показано");
                loadProducts();
            } else if (del) {
                const p = state.products.find((x) => x.id === Number(del.dataset.pdel));
                confirmAction("Удалить товар?", p.name, async () => {
                    await api.del("/products/" + p.id);
                    toast("Удалено");
                    loadProducts();
                });
            }
        } catch (err) {
            fail(err);
        }
    });

    let pTimer;
    $("#pSearch").addEventListener("input", () => {
        clearTimeout(pTimer);
        pTimer = setTimeout(loadProducts, 250);
    });
    $("#pCat").addEventListener("change", loadProducts);

    /* =================================================================
       CATEGORIES
       ================================================================= */

    async function loadCategories() {
        try {
            state.categories = (await api.get("/categories")).items;
            $("#cTable").innerHTML = table(
                ["", "Name", "Slug", "Catalog count", "In store", ""],
                state.categories.map((c) => `
                    <tr>
                        <td><span class="thumb" style="background-image:url('${escapeHtml(c.image)}')"></span></td>
                        <td><b>${escapeHtml(c.name)}</b></td>
                        <td class="muted">${escapeHtml(c.slug)}</td>
                        <td>${Number(c.count).toLocaleString("en-US")}</td>
                        <td>${c.in_stock}</td>
                        <td><div class="row-actions">
                            <button class="mini" type="button" data-cedit="${c.id}">Edit</button>
                            <button class="mini mini--danger" type="button" data-cdel="${c.id}">Delete</button>
                        </div></td>
                    </tr>`).join(""));
        } catch (err) {
            fail(err);
        }
    }

    function categoryFields(c) {
        c = c || {};
        return [
            { name: "name", label: "Name *", value: c.name },
            { name: "slug", label: "Slug", value: c.slug || "", placeholder: "auto" },
            { name: "count", label: "Catalog count", type: "number", value: c.count == null ? 0 : c.count },
            { name: "image", label: "Image", type: "image", value: c.image || "img/cat/laptops.jpg" },
        ];
    }

    $("#cNew").addEventListener("click", () => {
        openForm("New category", categoryFields(), async (data) => {
            await api.post("/categories", { name: data.name, slug: data.slug || undefined, count: Number(data.count || 0), image: data.image });
            toast("Категория добавлена", "ok");
            loadCategories();
        });
    });

    $("#cTable").addEventListener("click", (e) => {
        const edit = e.target.closest("[data-cedit]");
        const del = e.target.closest("[data-cdel]");

        if (edit) {
            const c = state.categories.find((x) => x.id === Number(edit.dataset.cedit));
            openForm("Edit — " + c.name, categoryFields(c), async (data) => {
                await api.patch("/categories/" + c.id, {
                    name: data.name, slug: data.slug, count: Number(data.count || 0), image: data.image,
                });
                toast("Сохранено", "ok");
                loadCategories();
            });
        } else if (del) {
            const c = state.categories.find((x) => x.id === Number(del.dataset.cdel));
            confirmAction("Удалить категорию?", c.name, async () => {
                await api.del("/categories/" + c.id);
                toast("Удалено");
                loadCategories();
            });
        }
    });

    /* =================================================================
       BANNERS
       ================================================================= */

    async function loadBanners() {
        try {
            state.banners = (await api.get("/banners")).items;
            $("#bTable").innerHTML = state.banners.length ? table(
                ["", "Title", "Eyebrow", "Position", "Status", ""],
                state.banners.map((b) => `
                    <tr>
                        <td><span class="thumb" style="background-image:url('${escapeHtml(b.image)}')"></span></td>
                        <td><b>${escapeHtml(b.title)}</b><div class="muted">${escapeHtml(b.subtitle || "")}</div></td>
                        <td>${escapeHtml(b.eyebrow || "—")}</td>
                        <td>${b.position}</td>
                        <td><span class="chip chip--${b.is_active ? "on" : "off"}">${b.is_active ? "active" : "hidden"}</span></td>
                        <td><div class="row-actions">
                            <button class="mini" type="button" data-btoggle="${b.id}">${b.is_active ? "Hide" : "Show"}</button>
                            <button class="mini" type="button" data-bedit="${b.id}">Edit</button>
                            <button class="mini mini--danger" type="button" data-bdel="${b.id}">Delete</button>
                        </div></td>
                    </tr>`).join(""))
                : '<p class="empty-row">Баннеров нет</p>';
        } catch (err) {
            fail(err);
        }
    }

    function bannerFields(b) {
        b = b || {};
        return [
            { name: "eyebrow", label: "Eyebrow (badge)", value: b.eyebrow || "" },
            { name: "title", label: "Title *", value: b.title || "" },
            { name: "subtitle", label: "Subtitle (accent)", value: b.subtitle || "" },
            { name: "position", label: "Position", type: "number", value: b.position == null ? 0 : b.position },
            { name: "text", label: "Text", type: "textarea", value: b.text || "" },
            { name: "primary_label", label: "Button 1 label", value: b.primary_label || "Shop now" },
            { name: "primary_link", label: "Button 1 link", value: b.primary_link || "#top-sales" },
            { name: "secondary_label", label: "Button 2 label", value: b.secondary_label || "" },
            { name: "secondary_link", label: "Button 2 link", value: b.secondary_link || "#top-sales" },
            { name: "image", label: "Image", type: "image", value: b.image || "img/hero/hero-1.jpg" },
            { name: "is_active", label: "Active", type: "checkbox", value: b.is_active !== false },
        ];
    }

    $("#bNew").addEventListener("click", () => {
        openForm("New banner", bannerFields(), async (data) => {
            await api.post("/banners", Object.assign({}, data, { position: Number(data.position || 0) }));
            toast("Баннер добавлен", "ok");
            loadBanners();
        });
    });

    $("#bTable").addEventListener("click", async (e) => {
        const edit = e.target.closest("[data-bedit]");
        const del = e.target.closest("[data-bdel]");
        const toggle = e.target.closest("[data-btoggle]");

        try {
            if (edit) {
                const b = state.banners.find((x) => x.id === Number(edit.dataset.bedit));
                openForm("Edit banner", bannerFields(b), async (data) => {
                    await api.patch("/banners/" + b.id, Object.assign({}, data, { position: Number(data.position || 0) }));
                    toast("Сохранено", "ok");
                    loadBanners();
                });
            } else if (toggle) {
                const b = state.banners.find((x) => x.id === Number(toggle.dataset.btoggle));
                await api.patch("/banners/" + b.id, { is_active: !b.is_active });
                loadBanners();
            } else if (del) {
                const b = state.banners.find((x) => x.id === Number(del.dataset.bdel));
                confirmAction("Удалить баннер?", b.title, async () => {
                    await api.del("/banners/" + b.id);
                    toast("Удалено");
                    loadBanners();
                });
            }
        } catch (err) {
            fail(err);
        }
    });

    /* =================================================================
       ORDERS
       ================================================================= */

    const STATUSES = ["new", "confirmed", "shipped", "done", "cancelled"];

    async function loadOrders() {
        try {
            state.orders = (await api.get("/orders")).items;
            $("#oTable").innerHTML = state.orders.length ? table(
                ["#", "Customer", "Items", "Total", "Status", "Date", ""],
                state.orders.map((o) => `
                    <tr>
                        <td><b>${escapeHtml(o.number)}</b></td>
                        <td>${escapeHtml(o.name)}<div class="muted">${escapeHtml(o.phone)}${o.address ? " · " + escapeHtml(o.address) : ""}</div></td>
                        <td>${o.items.map((i) => escapeHtml(i.name) + " ×" + i.qty).join("<br>")}</td>
                        <td><b>${money(o.total)}</b></td>
                        <td>
                            <select class="inp" style="height:34px;font-size:13px" data-ostatus="${o.id}">
                                ${STATUSES.map((s) => `<option value="${s}"${s === o.status ? " selected" : ""}>${s}</option>`).join("")}
                            </select>
                        </td>
                        <td class="muted">${shortDate(o.created_at)}</td>
                        <td><div class="row-actions">
                            <button class="mini mini--danger" type="button" data-odel="${o.id}">Delete</button>
                        </div></td>
                    </tr>`).join(""))
                : '<p class="empty-row">Заказов нет</p>';
        } catch (err) {
            fail(err);
        }
    }

    $("#oTable").addEventListener("change", async (e) => {
        const sel = e.target.closest("[data-ostatus]");
        if (!sel) return;
        try {
            await api.patch("/orders/" + sel.dataset.ostatus, { status: sel.value });
            toast("Статус обновлён", "ok");
            loadOrders();
        } catch (err) {
            fail(err);
        }
    });

    $("#oTable").addEventListener("click", (e) => {
        const del = e.target.closest("[data-odel]");
        if (!del) return;
        const o = state.orders.find((x) => x.id === Number(del.dataset.odel));
        confirmAction("Удалить заказ?", o.number, async () => {
            await api.del("/orders/" + o.id);
            toast("Удалено");
            loadOrders();
        });
    });

    /* =================================================================
       SUBSCRIBERS
       ================================================================= */

    async function loadSubs() {
        try {
            state.subs = (await api.get("/subscribers")).items;
            $("#sTable").innerHTML = state.subs.length ? table(
                ["Email", "Date", ""],
                state.subs.map((s) => `
                    <tr>
                        <td><b>${escapeHtml(s.email)}</b></td>
                        <td class="muted">${shortDate(s.created_at)}</td>
                        <td><div class="row-actions">
                            <button class="mini mini--danger" type="button" data-sdel="${s.id}">Delete</button>
                        </div></td>
                    </tr>`).join(""))
                : '<p class="empty-row">Подписчиков нет</p>';
        } catch (err) {
            fail(err);
        }
    }

    $("#sTable").addEventListener("click", (e) => {
        const del = e.target.closest("[data-sdel]");
        if (!del) return;
        const s = state.subs.find((x) => x.id === Number(del.dataset.sdel));
        confirmAction("Удалить подписчика?", s.email, async () => {
            await api.del("/subscribers/" + s.id);
            toast("Удалено");
            loadSubs();
        });
    });

    /* =================================================================
       START
       ================================================================= */

    function boot() {
        state.categories = [];
        $("#pCat").innerHTML = '<option value="">All categories</option>';
        loadDash();
    }

    (async function init() {
        try {
            const me = await api.get("/auth/me");
            if (me.authenticated) {
                showPanel();
                boot();
            } else {
                showGate();
            }
        } catch (err) {
            showGate();
        }
    })();
})();
