/* =====================================================================
   api.js — CRUD в стиле REST. Данные хранятся в localStorage браузера.
   Сервер, Python или интернет НЕ НУЖНЫ — достаточно открыть index.html.

   Интерфейс такой же, как у настоящего API:
       api.get("/products", {category: "audio"})   -> READ
       api.post("/products", {...})                -> CREATE
       api.patch("/products/3", {...})             -> UPDATE (частично)
       api.put("/products/3", {...})               -> UPDATE (полностью)
       api.del("/products/3")                      -> DELETE
   ===================================================================== */

window.ApiError = class ApiError extends Error {
    constructor(message, status, field) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.field = field;
    }
};

window.api = (function () {
    "use strict";

    const KEY = "voltix.db.v1";

    /* ВНИМАНИЕ — это НЕ ЗАЩИТА, а просто демо-замок.
       На сайте без сервера пароль спрятать невозможно: и код, и данные
       находятся в браузере пользователя. Кто откроет файл — увидит эти строки
       или поменяет "auth" в localStorage и войдёт в панель.
       Настоящая защита админки возможна только на сервере. */
    const ADMIN_EMAIL = "admin@voltix.com";
    const ADMIN_PASSWORD = "admin123";

    /* =================================================================
       НАЧАЛЬНЫЕ ДАННЫЕ (названия и цены из макета)
       ================================================================= */

    const SEED_CATEGORIES = [
        { slug: "laptops",     name: "Laptops & PCs",      count: 1250, image: "img/cat/laptops.jpg" },
        { slug: "smartphones", name: "Smartphones",        count: 860,  image: "img/cat/smartphones.jpg" },
        { slug: "audio",       name: "Audio & Headphones", count: 2110, image: "img/cat/audio.jpg" },
        { slug: "tv",          name: "TV & Video",         count: 540,  image: "img/cat/tv.jpg" },
        { slug: "gaming",      name: "Gaming",             count: 1310, image: "img/cat/gaming.png" },
        { slug: "smart-home",  name: "Smart Home",         count: 415,  image: "img/cat/smart-home.jpg" }
    ];

    const SEED_PRODUCTS = [
        { name: "Wireless Headphones XR-40", price: 129,  old_price: 159,  category: "audio",       image: "img/product/headphones-xr40.jpg", sku: "AUD-XR40",  stock: 42 },
        { name: '27" 4K IPS Monitor',        price: 349,  old_price: null, category: "laptops",     image: "img/product/monitor-27.png",      sku: "MON-27IPS", stock: 18 },
        { name: "Mechanical Keyboard K2",    price: 89,   old_price: 109,  category: "gaming",      image: "img/product/keyboard-k2.jpg",     sku: "GAM-K2",    stock: 76 },
        { name: "Ultrabook Pro 14",          price: 1099, old_price: null, category: "laptops",     image: "img/product/ultrabook-14.png",    sku: "LAP-UP14",  stock: 9 },
        { name: "Smartphone A9x 128 GB",     price: 459,  old_price: 529,  category: "smartphones", image: "img/product/smartphone-a9x.jpg",  sku: "PHN-A9X",   stock: 55 },
        { name: "Smartwatch Fit 2",          price: 199,  old_price: null, category: "smartphones", image: "img/product/smartwatch-fit2.jpg", sku: "WCH-FIT2",  stock: 31 },
        { name: "Bluetooth Speaker Mini",    price: 59,   old_price: 79,   category: "audio",       image: "img/product/speaker-mini.jpg",    sku: "AUD-SPKM",  stock: 120 },
        { name: "Gaming Mouse G-Pro",        price: 69,   old_price: null, category: "gaming",      image: "img/product/mouse-gpro.jpg",      sku: "GAM-GPRO",  stock: 64 },
        { name: "Action Camera 4K",          price: 249,  old_price: 299,  category: "tv",          image: "img/product/action-cam.jpg",      sku: "CAM-4K",    stock: 23 },
        { name: "Robot Vacuum V8",           price: 299,  old_price: null, category: "smart-home",  image: "img/product/robot-vacuum.jpg",    sku: "SMH-V8",    stock: 14 },
        { name: 'Tablet 11" 256 GB',         price: 529,  old_price: 599,  category: "smartphones", image: "img/product/tablet-11.jpg",       sku: "TAB-11",    stock: 27 },
        { name: "Power Bank 20 000 mAh",     price: 39,   old_price: null, category: "smartphones", image: "img/product/power-bank.jpg",      sku: "ACC-PB20",  stock: 210 },
        { name: "Soundbar 2.1 Home",         price: 189,  old_price: 229,  category: "audio",       image: "img/product/soundbar.jpg",        sku: "AUD-SB21",  stock: 33 },
        { name: "Air Purifier Clean",        price: 249,  old_price: null, category: "smart-home",  image: "img/product/air-purifier.jpg",    sku: "SMH-AIR",   stock: 19 },
        { name: "Drone Air Lite",            price: 649,  old_price: 749,  category: "tv",          image: "img/product/drone.jpg",           sku: "DRN-LITE",  stock: 7 },
        { name: 'E-Reader Paper 7"',         price: 149,  old_price: null, category: "laptops",     image: "img/product/ereader.jpg",         sku: "ERD-P7",    stock: 48 }
    ];

    const SEED_BANNERS = [
        {
            eyebrow: "Summer tech sale", title: "Up to 40% off", subtitle: "laptops & audio",
            text: "Free next-day delivery on orders over $99",
            primary_label: "Shop the sale", primary_link: "#top-sales",
            secondary_label: "All deals", secondary_link: "#top-sales",
            image: "img/hero/hero-1.jpg"
        },
        {
            eyebrow: "New arrivals", title: "Ultrabook Pro 14", subtitle: "from $1 099",
            text: "14-inch display, 32 GB RAM, 18 hours of battery",
            primary_label: "Buy now", primary_link: "#top-sales",
            secondary_label: "Compare", secondary_link: "#top-sales",
            image: "img/hero/hero-2.jpg"
        },
        {
            eyebrow: "0% installments", title: "Smart home", subtitle: "starter kits",
            text: "Pay in 12 months with no overpayment",
            primary_label: "Browse kits", primary_link: "#categories",
            secondary_label: "How it works", secondary_link: "#categories",
            image: "img/hero/hero-3.jpg"
        }
    ];

    const SEED_USP = [
        { title: "Free delivery",   text: "on orders over $99" },
        { title: "2-year warranty", text: "on all products" },
        { title: "14-day returns",  text: "no questions asked" },
        { title: "0% installments", text: "up to 12 months" }
    ];

    /* =================================================================
       ХРАНИЛИЩЕ (localStorage)
       ================================================================= */

    let db;

    function now() {
        return new Date().toISOString().slice(0, 19) + "Z";
    }

    function nextId(table) {
        db._seq[table] = (db._seq[table] || 0) + 1;
        return db._seq[table];
    }

    function seedDb() {
        db = {
            _seq: {}, categories: [], products: [], banners: [], usp: [],
            orders: [], subscribers: [], cart: [], wishlist: [], auth: false
        };

        SEED_CATEGORIES.forEach((c) => {
            db.categories.push(Object.assign({}, c, { id: nextId("categories"), created_at: now() }));
        });
        SEED_PRODUCTS.forEach((p) => {
            db.products.push(Object.assign({}, p, {
                id: nextId("products"),
                description: p.name + " — оригинал с гарантией. Из официального магазина Voltix.",
                is_active: true, created_at: now(), updated_at: now()
            }));
        });
        SEED_BANNERS.forEach((b, i) => {
            db.banners.push(Object.assign({}, b, { id: nextId("banners"), position: i, is_active: true }));
        });
        SEED_USP.forEach((u, i) => {
            db.usp.push(Object.assign({}, u, { id: nextId("usp"), position: i }));
        });
        return db;
    }

    /* В некоторых браузерах localStorage на file:// заблокирован —
       в этом случае используем обычную память (сайт всё равно работает). */
    const storage = (function () {
        try {
            const probe = "__voltix_probe__";
            localStorage.setItem(probe, "1");
            localStorage.removeItem(probe);
            return localStorage;
        } catch (err) {
            console.warn("localStorage недоступен — данные сохранятся только пока открыта эта страница.");
            const mem = {};
            return {
                getItem: (k) => (k in mem ? mem[k] : null),
                setItem: (k, v) => { mem[k] = String(v); },
                removeItem: (k) => { delete mem[k]; }
            };
        }
    })();

    function load() {
        try {
            const raw = storage.getItem(KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.products && parsed.products.length) {
                    db = parsed;
                    return db;
                }
            }
        } catch (err) {
            console.warn("Не удалось прочитать localStorage, создаём заново", err);
        }
        seedDb();
        save();
        return db;
    }

    function save() {
        try {
            storage.setItem(KEY, JSON.stringify(db));
        } catch (err) {
            throw new ApiError("Память браузера переполнена. Уменьшите загружаемые изображения.", 507);
        }
    }

    /* Если данные изменило другое окно или вкладка, чтобы это увидеть,
       перед каждым запросом перечитываем хранилище. */
    function sync() {
        try {
            const raw = storage.getItem(KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.products && parsed.products.length) db = parsed;
        } catch (err) {
            /* если данные повреждены — продолжаем с копией из памяти */
        }
    }

    load();

    /* =================================================================
       ВАЛИДАЦИЯ
       ================================================================= */

    function need(data, field) {
        const value = data[field];
        if (value === undefined || value === null || String(value).trim() === "") {
            throw new ApiError("'" + field + "' обязательно для заполнения", 422, field);
        }
        return typeof value === "string" ? value.trim() : value;
    }

    function positive(value, field, allowZero) {
        const num = Number(value);
        if (value === "" || value === null || value === undefined || isNaN(num)) {
            throw new ApiError("'" + field + "' должно быть числом", 422, field);
        }
        if (num < 0 || (num === 0 && !allowZero)) {
            throw new ApiError("'" + field + "' должно быть положительным числом", 422, field);
        }
        return Math.round(num * 100) / 100;
    }

    function validEmail(value) {
        return /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(String(value || "").trim());
    }

    function needAdmin() {
        if (!db.auth) throw new ApiError("Сначала войдите как администратор", 401);
    }

    function find(table, id) {
        return db[table].find((row) => row.id === Number(id)) || null;
    }

    function mustFind(table, id, label) {
        const row = find(table, id);
        if (!row) throw new ApiError(label, 404);
        return row;
    }

    function catMap() {
        const map = {};
        db.categories.forEach((c) => { map[c.slug] = c; });
        return map;
    }

    function publicProduct(p) {
        const cat = catMap()[p.category];
        return Object.assign({}, p, {
            category_name: cat ? cat.name : p.category,
            discount: p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : 0
        });
    }

    function cartPayload() {
        const items = [];
        let total = 0;
        db.cart.forEach((item) => {
            const product = find("products", item.product_id);
            if (!product) return;
            const line = product.price * item.qty;
            total += line;
            items.push({
                id: item.id, product_id: product.id, name: product.name,
                image: product.image, price: product.price, qty: item.qty,
                line_total: Math.round(line * 100) / 100, stock: product.stock
            });
        });
        const delivery = (total >= 99 || total === 0) ? 0 : 9;
        return {
            items: items,
            count: items.reduce((sum, i) => sum + i.qty, 0),
            subtotal: Math.round(total * 100) / 100,
            delivery: delivery,
            total: Math.round((total + delivery) * 100) / 100
        };
    }

    function wishPayload() {
        return {
            items: db.products.filter((p) => db.wishlist.indexOf(p.id) !== -1).map(publicProduct),
            ids: db.wishlist.slice(),
            count: db.wishlist.length
        };
    }

    /* =================================================================
       ROUTER
       ================================================================= */

    const ROUTES = [];

    function on(method, pattern, handler) {
        ROUTES.push({ method: method, parts: pattern.split("/").filter(Boolean), handler: handler });
    }

    function match(method, path) {
        const parts = path.split("/").filter(Boolean);
        for (let i = 0; i < ROUTES.length; i++) {
            const r = ROUTES[i];
            if (r.method !== method || r.parts.length !== parts.length) continue;
            const params = [];
            let ok = true;
            for (let j = 0; j < r.parts.length; j++) {
                if (r.parts[j] === ":id") {
                    if (!/^\d+$/.test(parts[j])) { ok = false; break; }
                    params.push(Number(parts[j]));
                } else if (r.parts[j] !== parts[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return { handler: r.handler, params: params };
        }
        return null;
    }

    /* ---------------- AUTH ---------------- */

    on("GET", "/auth/me", () => db.auth
        ? { authenticated: true, user: { email: ADMIN_EMAIL, role: "admin" } }
        : { authenticated: false, user: null });

    on("POST", "/auth/login", (p, data) => {
        const email = need(data, "email");
        const password = need(data, "password");
        if (email.toLowerCase() !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
            throw new ApiError("Неверный email или пароль", 401);
        }
        db.auth = true;
        save();
        return { ok: true, user: { email: email, role: "admin" } };
    });

    on("POST", "/auth/logout", () => {
        db.auth = false;
        save();
        return { ok: true };
    });

    /* ---------------- CATEGORIES ---------------- */

    on("GET", "/categories", () => ({
        items: db.categories.slice().sort((a, b) => a.id - b.id).map((c) => Object.assign({}, c, {
            in_stock: db.products.filter((p) => p.category === c.slug && p.is_active !== false).length
        })),
        total: db.categories.length
    }));

    on("GET", "/categories/:id", (p) => mustFind("categories", p[0], "Категория не найдена"));

    on("POST", "/categories", (p, data) => {
        needAdmin();
        const name = need(data, "name");
        const slug = data.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!slug) throw new ApiError("Slug не может быть пустым", 422, "slug");
        if (db.categories.some((c) => c.slug === slug)) {
            throw new ApiError("Такой slug уже существует", 409, "slug");
        }
        const row = {
            id: nextId("categories"), slug: slug, name: name,
            count: Number(data.count || 0),
            image: data.image || "img/cat/laptops.jpg",
            created_at: now()
        };
        db.categories.push(row);
        save();
        return row;
    });

    function updateCategory(id, data, replace) {
        needAdmin();
        const row = mustFind("categories", id, "Категория не найдена");
        if (replace) need(data, "name");

        if ("name" in data) row.name = need(data, "name");
        if ("slug" in data && data.slug && data.slug !== row.slug) {
            if (db.categories.some((c) => c.slug === data.slug && c.id !== row.id)) {
                throw new ApiError("Такой slug уже существует", 409, "slug");
            }
            const old = row.slug;
            row.slug = data.slug;
            db.products.forEach((p) => { if (p.category === old) p.category = row.slug; });
        }
        if ("count" in data) row.count = positive(data.count, "count", true);
        if ("image" in data && data.image) row.image = data.image;

        row.updated_at = now();
        save();
        return row;
    }

    on("PATCH", "/categories/:id", (p, data) => updateCategory(p[0], data, false));
    on("PUT", "/categories/:id", (p, data) => updateCategory(p[0], data, true));

    on("DELETE", "/categories/:id", (p) => {
        needAdmin();
        const row = mustFind("categories", p[0], "Категория не найдена");
        const used = db.products.filter((x) => x.category === row.slug);
        if (used.length) {
            throw new ApiError("В этой категории " + used.length + " товаров — сначала перенесите их", 409);
        }
        db.categories = db.categories.filter((c) => c.id !== row.id);
        save();
        return { ok: true, deleted: row.id };
    });

    /* ---------------- PRODUCTS ---------------- */

    on("GET", "/products", (p, data, query) => {
        let rows = db.products.filter((x) => x.is_active !== false || db.auth);

        if (query.category && query.category !== "all") {
            rows = rows.filter((x) => x.category === query.category);
        }
        if (query.q) {
            const q = String(query.q).toLowerCase();
            rows = rows.filter((x) =>
                x.name.toLowerCase().indexOf(q) !== -1 ||
                String(x.sku || "").toLowerCase().indexOf(q) !== -1 ||
                String(x.description || "").toLowerCase().indexOf(q) !== -1);
        }
        if (query.min_price) rows = rows.filter((x) => x.price >= Number(query.min_price));
        if (query.max_price) rows = rows.filter((x) => x.price <= Number(query.max_price));

        const sort = query.sort || "default";
        if (sort === "price_asc") rows.sort((a, b) => a.price - b.price);
        else if (sort === "price_desc") rows.sort((a, b) => b.price - a.price);
        else if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
        else if (sort === "new") rows.sort((a, b) => b.id - a.id);
        else rows.sort((a, b) => a.id - b.id);

        const total = rows.length;
        const offset = Math.max(Number(query.offset || 0), 0);
        const hasLimit = query.limit !== undefined && query.limit !== null && query.limit !== "";
        const limit = hasLimit ? Number(query.limit) : null;
        const page = limit === null ? rows.slice(offset) : rows.slice(offset, offset + limit);

        return {
            items: page.map(publicProduct),
            total: total,
            offset: offset,
            limit: limit,
            has_more: offset + page.length < total
        };
    });

    on("GET", "/products/:id", (p) => publicProduct(mustFind("products", p[0], "Товар не найден")));

    on("POST", "/products", (p, data) => {
        needAdmin();
        const name = need(data, "name");
        const price = positive(need(data, "price"), "price");
        const category = need(data, "category");
        if (!catMap()[category]) throw new ApiError("Такой категории нет", 422, "category");

        const raw = data.old_price;
        const oldPrice = (raw === "" || raw === null || raw === undefined)
            ? null : positive(raw, "old_price");
        if (oldPrice !== null && oldPrice <= price) {
            throw new ApiError("Старая цена должна быть больше текущей", 422, "old_price");
        }

        const row = {
            id: nextId("products"), name: name, price: price, old_price: oldPrice,
            category: category,
            image: data.image || "img/product/headphones-xr40.jpg",
            sku: data.sku || ("SKU-" + (db.products.length + 1)),
            stock: positive(data.stock === undefined ? 0 : data.stock, "stock", true),
            description: data.description || "",
            is_active: data.is_active !== false,
            created_at: now(), updated_at: now()
        };
        db.products.push(row);
        save();
        return publicProduct(row);
    });

    function updateProduct(id, data, replace) {
        needAdmin();
        const row = mustFind("products", id, "Товар не найден");
        if (replace) { need(data, "name"); need(data, "price"); need(data, "category"); }

        if ("name" in data) row.name = need(data, "name");
        if ("price" in data) row.price = positive(data.price, "price");
        if ("old_price" in data) {
            const raw = data.old_price;
            row.old_price = (raw === "" || raw === null || raw === undefined)
                ? null : positive(raw, "old_price");
        }
        if ("category" in data) {
            const category = need(data, "category");
            if (!catMap()[category]) throw new ApiError("Такой категории нет", 422, "category");
            row.category = category;
        }
        if ("image" in data && data.image) row.image = data.image;
        if ("sku" in data) row.sku = data.sku;
        if ("stock" in data) row.stock = positive(data.stock, "stock", true);
        if ("description" in data) row.description = data.description;
        if ("is_active" in data) row.is_active = !!data.is_active;

        if (row.old_price && row.old_price <= row.price) {
            throw new ApiError("Старая цена должна быть больше текущей", 422, "old_price");
        }

        row.updated_at = now();
        save();
        return publicProduct(row);
    }

    on("PATCH", "/products/:id", (p, data) => updateProduct(p[0], data, false));
    on("PUT", "/products/:id", (p, data) => updateProduct(p[0], data, true));

    on("DELETE", "/products/:id", (p) => {
        needAdmin();
        const row = mustFind("products", p[0], "Товар не найден");
        db.products = db.products.filter((x) => x.id !== row.id);
        db.cart = db.cart.filter((i) => i.product_id !== row.id);
        db.wishlist = db.wishlist.filter((i) => i !== row.id);
        save();
        return { ok: true, deleted: row.id };
    });

    /* =================================================================
       ГЕНЕРАТОР ТОВАРОВ
       Название собирается из шаблона (бренд + тип + модель),
       фото берётся из интернета, а если сети нет — из локальной папки img/.
       ================================================================= */

    const GEN_BRANDS = ["Voltix", "Nexon", "Auralis", "Kytron", "Orbita",
                        "Zenoq", "Lumex", "Vanta", "Ridex", "Solux"];

    /* Model nomi mahsulot turiga bog'langan — shunda "Smartphone 55 dyuym"
       kabi mantiqsiz nomlar chiqmaydi. */
    const GEN = {
        laptops: {
            prefix: "LAP",
            search: ["laptop computer", "computer monitor display", "mini pc computer"],
            images: ["img/product/ultrabook-14.png", "img/product/monitor-27.png", "img/cat/laptops.jpg"],
            types: [
                { name: "Ultrabook", specs: ["Pro 14", "Air 13", "Ultra 17", "Slim 15"] },
                { name: "Gaming Laptop", specs: ["X15", "X17", "RTX Edition", "Storm 16"] },
                { name: "4K Monitor", specs: ['27"', '32"', "UltraWide", "IPS Pro"], band: [0.15, 0.45] },
                { name: "Mini PC", specs: ["Cube", "Max 16", "Office Pro"], band: [0.2, 0.5] },
                { name: "Docking Station", specs: ["USB-C 12-in-1", "Dual HDMI", "Pro Hub"], band: [0.03, 0.12] }
            ]
        },
        smartphones: {
            prefix: "PHN",
            search: ["smartphone", "tablet computer", "smartwatch"],
            images: ["img/product/smartphone-a9x.jpg", "img/product/tablet-11.jpg",
                     "img/product/smartwatch-fit2.jpg", "img/product/power-bank.jpg"],
            types: [
                { name: "Smartphone", specs: ["A9x 128 GB", "S20 256 GB", "Neo 5G", "Mini 64 GB"] },
                { name: "Tablet", specs: ['11" 256 GB', '10" 128 GB', "Kids Edition"] },
                { name: "Smartwatch", specs: ["Fit 3", "Sport GPS", "Active 2"], band: [0.06, 0.25] },
                { name: "Power Bank", specs: ["20 000 mAh", "10 000 mAh", "MagSafe 5K"], band: [0.01, 0.06] },
                { name: "Wireless Charger", specs: ["Duo 15W", "Stand 30W", "Pad Slim"], band: [0.01, 0.05] }
            ]
        },
        audio: {
            prefix: "AUD",
            search: ["wireless headphones", "bluetooth speaker portable", "soundbar speaker"],
            images: ["img/product/headphones-xr40.jpg", "img/product/speaker-mini.jpg",
                     "img/product/soundbar.jpg", "img/cat/audio.jpg"],
            types: [
                { name: "Wireless Headphones", specs: ["XR-50", "Studio ANC", "Comfort 700"] },
                { name: "True Wireless Earbuds", specs: ["Air Pro", "Buds 3", "Sport ANC"] },
                { name: "Bluetooth Speaker", specs: ["Mini 2", "Boom 360", "Outdoor IPX7"] },
                { name: "Soundbar", specs: ["2.1 Home", "5.1 Cinema", "Compact 200W"] },
                { name: "Studio Monitor", specs: ['5"', '8"', "Nearfield Pro"] }
            ]
        },
        tv: {
            prefix: "TVD",
            search: ["LG OLED TV", "video projector", "action camera", "quadcopter drone"],
            images: ["img/cat/tv.jpg", "img/product/action-cam.jpg", "img/product/drone.jpg"],
            types: [
                { name: "4K Smart TV", specs: ['50"', '55"', '65"', '75"'] },
                { name: "OLED TV", specs: ['48"', '55"', '65"'] },
                { name: "Projector", specs: ["Full HD", "4K Ultra", "Portable LED"], band: [0.1, 0.55] },
                { name: "Action Camera", specs: ["4K 60fps", "Pro Waterproof", "Mini"], band: [0.08, 0.3] },
                { name: "Drone", specs: ["Air Lite", "Pro 4K", "Nano FPV"], band: [0.12, 0.6] }
            ]
        },
        gaming: {
            prefix: "GAM",
            search: ["mechanical keyboard", "computer mouse gaming", "DualSense controller"],
            images: ["img/product/keyboard-k2.jpg", "img/product/mouse-gpro.jpg", "img/cat/gaming.png"],
            types: [
                { name: "Mechanical Keyboard", specs: ["K3 RGB", "TKL Red", "75% Wireless"] },
                { name: "Gaming Mouse", specs: ["G-Pro", "Elite 8K", "Lightweight 60g"] },
                { name: "Gaming Headset", specs: ["H7 Surround", "Pro Wireless", "Studio 7.1"] },
                { name: "Controller", specs: ["Elite", "Wireless Pro", "Arcade Edition"] },
                { name: "Mouse Pad", specs: ["XL RGB", "Speed XXL", "Hard Pro"], band: [0.01, 0.04] }
            ]
        },
        "smart-home": {
            prefix: "SMH",
            search: ["robotic vacuum cleaner", "air purifier", "smart speaker home"],
            images: ["img/product/robot-vacuum.jpg", "img/product/air-purifier.jpg", "img/cat/smart-home.jpg"],
            types: [
                { name: "Robot Vacuum", specs: ["V9 LiDAR", "Mop Combo", "Mini"] },
                { name: "Air Purifier", specs: ["Clean Pro", "HEPA 13", "Compact"] },
                { name: "Smart Speaker", specs: ["Mini", "Display 8", "Sound Max"] },
                { name: "Smart Bulb Kit", specs: ["RGB 4-pack", "Warm 2-pack", "Strip 5 m"], band: [0.01, 0.06] },
                { name: "Video Doorbell", specs: ["2K", "Battery Pro", "Wired HD"] }
            ]
        }
    };

    const GEN_DEFAULT = {
        prefix: "GEN",
        search: ["consumer electronics"],
        images: ["img/product/headphones-xr40.jpg"],
        types: [
            { name: "Device", specs: ["One", "Plus", "Max"] },
            { name: "Gadget", specs: ["Neo", "Lite", "Pro"] },
            { name: "Accessory", specs: ["Basic", "Premium"] }
        ]
    };

    /* Har kategoriya narx oralig'ining qaysi qismida turishi
       (aks holda "gaming mouse" $1 299 bo'lib qolishi mumkin). */
    const GEN_BAND = {
        laptops: [0.35, 1.00],
        tv: [0.20, 1.00],
        smartphones: [0.05, 0.60],
        audio: [0.05, 0.40],
        "smart-home": [0.05, 0.35],
        gaming: [0.02, 0.20]
    };

    const pick = (arr, i) => arr[i % arr.length];
    const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const nicePrice = (v) => Math.max(Math.round(v / 10) * 10 - 1, 9);

    /* dummyjson kategoriyalarini bizning slug'larga moslash */
    function mapDummyCategory(cat, title) {
        const t = String(title || "").toLowerCase();
        if (cat === "laptops") return "laptops";
        if (cat === "smartphones" || cat === "tablets") return "smartphones";
        if (cat === "mens-watches" || cat === "womens-watches") return "smartphones";
        if (cat === "mobile-accessories") {
            return /airpod|headphone|earphone|beats|speaker|homepod|echo/.test(t) ? "audio" : "smartphones";
        }
        return null;
    }

    function imageLoads(url) {
        return new Promise((resolve) => {
            let done = false;
            const finish = (v) => { if (!done) { done = true; resolve(v); } };
            const im = new Image();
            im.onload = () => finish(im.naturalWidth > 0);
            im.onerror = () => finish(false);
            im.src = url;
            setTimeout(() => finish(false), 7000);
        });
    }

    /* Commons qidiruvi ba'zan mavzuga umuman mos kelmaydigan fayl beradi
       (do'kon javoni, muzey eksponati, sxema, eski kontsept). Shularni chetlaymiz. */
    const JUNK_RE = /concept|study|museum|exhibit|diagram|schematic|isle|aisle|shelf|store|shop|market|fair|expo|meetup|remote control|logo|poster|map|chart|screenshot|patent|drawing|19\d\d|200\d/i;

    async function commonsImages(query) {
        const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*"
            + "&generator=search&gsrnamespace=6&gsrlimit=16"
            + "&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=600"
            + "&gsrsearch=" + encodeURIComponent(query);
        const res = await fetch(url);
        const json = await res.json();
        const pages = (json.query && json.query.pages) || {};

        const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

        return Object.keys(pages)
            .map((k) => ({ title: pages[k].title || "", ii: pages[k].imageinfo && pages[k].imageinfo[0] }))
            .filter((x) => x.ii && x.ii.thumburl
                && (x.ii.mime === "image/jpeg" || x.ii.mime === "image/png")
                && x.ii.width >= 400
                && !JUNK_RE.test(x.title))
            .sort((a, b) => {
                const score = (t) => words.filter((w) => t.toLowerCase().indexOf(w) !== -1).length;
                return score(b.title) - score(a.title);
            })
            .map((x) => x.ii.thumburl);
    }

    async function fetchImagePools(slugs) {
        const pools = {};

        try {
            const res = await fetch("https://dummyjson.com/products?limit=194&select=title,category,thumbnail");
            const json = await res.json();
            (json.products || []).forEach((item) => {
                const target = mapDummyCategory(item.category, item.title);
                if (target && item.thumbnail) {
                    if (!pools[target]) pools[target] = [];
                    pools[target].push(item.thumbnail);
                }
            });
        } catch (err) {
            /* dummyjson ishlamasa — Commons qoladi */
        }

        for (let i = 0; i < slugs.length; i++) {
            const slug = slugs[i];
            if (pools[slug] && pools[slug].length >= 5) continue;
            const conf = GEN[slug] || GEN_DEFAULT;
            for (let j = 0; j < conf.search.length; j++) {
                try {
                    const urls = await commonsImages(conf.search[j]);
                    if (!pools[slug]) pools[slug] = [];
                    pools[slug] = pools[slug].concat(urls);
                } catch (err) {
                    /* bitta so'rov yiqilsa — keyingisiga o'tamiz */
                }
                if (pools[slug] && pools[slug].length >= 8) break;
            }
        }

        /* Tartibni saqlaymiz (eng mosi birinchi), faqat boshlanish nuqtasini
           tasodifiy siljitamiz — shunda har safar boshqa rasmlar tushadi. */
        Object.keys(pools).forEach((k) => {
            const list = pools[k];
            if (list && list.length > 1) {
                const shift = rnd(0, list.length - 1);
                pools[k] = list.slice(shift).concat(list.slice(0, shift));
            }
        });
        return pools;
    }

    async function generateProducts(data) {
        needAdmin();

        const count = Math.min(Math.max(parseInt(data.count, 10) || 10, 1), 100);
        const known = db.categories.map((c) => c.slug);
        let slugs = (data.category && data.category !== "all") ? [data.category] : known;
        slugs = slugs.filter((s) => known.indexOf(s) !== -1);
        if (!slugs.length) throw new ApiError("Такой категории нет", 422, "category");

        let minPrice = Number(data.min_price) || 29;
        let maxPrice = Number(data.max_price) || 1499;
        if (minPrice < 1) minPrice = 1;
        if (maxPrice <= minPrice) maxPrice = minPrice + 100;

        const withDiscounts = data.discounts !== false;
        const wantNet = data.source !== "offline";

        let pools = {};
        if (wantNet) {
            try {
                pools = await fetchImagePools(slugs);
            } catch (err) {
                pools = {};
            }
        }
        const netUsed = Object.keys(pools).some((k) => pools[k] && pools[k].length);

        const taken = {};
        db.products.forEach((p) => { taken[p.name.toLowerCase()] = true; });

        const created = [];
        for (let i = 0; i < count; i++) {
            const slug = pick(slugs, i);
            const conf = GEN[slug] || GEN_DEFAULT;

            let name = "";
            let type = pick(conf.types, i);
            for (let attempt = 0; attempt < 40; attempt++) {
                type = conf.types[rnd(0, conf.types.length - 1)];
                const candidate = GEN_BRANDS[rnd(0, GEN_BRANDS.length - 1)] + " "
                    + type.name + " " + type.specs[rnd(0, type.specs.length - 1)];
                if (!taken[candidate.toLowerCase()]) { name = candidate; break; }
            }
            if (!name) {
                name = pick(GEN_BRANDS, i) + " " + type.name
                    + " #" + (db.products.length + i + 1);
            }
            taken[name.toLowerCase()] = true;

            const band = type.band || GEN_BAND[slug] || [0.05, 1];
            const share = band[0] + Math.random() * (band[1] - band[0]);
            const price = nicePrice(minPrice + (maxPrice - minPrice) * share);
            const oldPrice = (withDiscounts && Math.random() < 0.45)
                ? nicePrice(price * (1.12 + Math.random() * 0.3)) : null;

            let image = pick(conf.images, i);
            const pool = pools[slug];
            if (pool && pool.length) {
                const candidate = pool[i % pool.length];
                if (await imageLoads(candidate)) image = candidate;
            }

            const row = {
                id: nextId("products"),
                name: name,
                price: price,
                old_price: (oldPrice && oldPrice > price) ? oldPrice : null,
                category: slug,
                image: image,
                sku: conf.prefix + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(),
                stock: Math.random() < 0.1 ? 0 : rnd(3, 140),
                description: name + " — оригинал с гарантией 2 года. Доставка от 1 дня.",
                is_active: true,
                generated: true,
                created_at: now(),
                updated_at: now()
            };
            db.products.push(row);
            created.push(row);
        }

        save();
        return {
            created: created.length,
            source: netUsed ? "internet" : "offline",
            items: created.map(publicProduct)
        };
    }

    on("POST", "/products/generate", (p, data) => generateProducts(data));

    on("DELETE", "/products/generated", () => {
        needAdmin();
        const ids = db.products.filter((p) => p.generated).map((p) => p.id);
        db.products = db.products.filter((p) => !p.generated);
        db.cart = db.cart.filter((i) => ids.indexOf(i.product_id) === -1);
        db.wishlist = db.wishlist.filter((i) => ids.indexOf(i) === -1);
        save();
        return { ok: true, deleted: ids.length };
    });

    /* ---------------- BANNERS / USP ---------------- */

    on("GET", "/banners", () => {
        const rows = db.banners.filter((b) => b.is_active !== false || db.auth)
            .sort((a, b) => (a.position - b.position) || (a.id - b.id));
        return { items: rows, total: rows.length };
    });

    on("POST", "/banners", (p, data) => {
        needAdmin();
        const row = {
            id: nextId("banners"),
            eyebrow: data.eyebrow || "",
            title: need(data, "title"),
            subtitle: data.subtitle || "",
            text: data.text || "",
            primary_label: data.primary_label || "Shop now",
            primary_link: data.primary_link || "#top-sales",
            secondary_label: data.secondary_label || "",
            secondary_link: data.secondary_link || "#top-sales",
            image: data.image || "img/hero/hero-1.jpg",
            position: Number(data.position || db.banners.length),
            is_active: data.is_active !== false
        };
        db.banners.push(row);
        save();
        return row;
    });

    on("PATCH", "/banners/:id", (p, data) => {
        needAdmin();
        const row = mustFind("banners", p[0], "Баннер не найден");
        ["eyebrow", "title", "subtitle", "text", "primary_label", "primary_link",
            "secondary_label", "secondary_link", "image"].forEach((f) => {
                if (f in data) row[f] = data[f];
            });
        if ("position" in data) row.position = Number(data.position || 0);
        if ("is_active" in data) row.is_active = !!data.is_active;
        if (!row.title) throw new ApiError("'title' обязательно для заполнения", 422, "title");
        save();
        return row;
    });

    on("DELETE", "/banners/:id", (p) => {
        needAdmin();
        const row = mustFind("banners", p[0], "Баннер не найден");
        db.banners = db.banners.filter((b) => b.id !== row.id);
        save();
        return { ok: true, deleted: row.id };
    });

    on("GET", "/usp", () => ({
        items: db.usp.slice().sort((a, b) => a.position - b.position),
        total: db.usp.length
    }));

    /* ---------------- CART ---------------- */

    on("GET", "/cart", () => cartPayload());

    on("POST", "/cart", (p, data) => {
        const pid = Number(need(data, "product_id"));
        const qty = Number(data.qty || 1);
        if (qty < 1) throw new ApiError("Количество не может быть меньше 1", 422, "qty");

        const product = mustFind("products", pid, "Товар не найден");
        if (product.is_active === false) throw new ApiError("Этого товара нет в продаже", 409);

        const existing = db.cart.find((i) => i.product_id === pid);
        const newQty = (existing ? existing.qty : 0) + qty;
        if (newQty > product.stock) {
            throw new ApiError("На складе осталось только " + product.stock + " шт.", 409, "qty");
        }
        if (existing) existing.qty = newQty;
        else db.cart.push({ id: nextId("cart"), product_id: pid, qty: qty, added_at: now() });

        save();
        return cartPayload();
    });

    on("PATCH", "/cart/:id", (p, data) => {
        const qty = Number(need(data, "qty"));
        const item = db.cart.find((i) => i.id === p[0]);
        if (!item) throw new ApiError("В корзине нет такого товара", 404);

        if (qty < 1) {
            db.cart = db.cart.filter((i) => i.id !== item.id);
        } else {
            const product = find("products", item.product_id);
            if (product && qty > product.stock) {
                throw new ApiError("На складе осталось только " + product.stock + " шт.", 409, "qty");
            }
            item.qty = qty;
        }
        save();
        return cartPayload();
    });

    on("DELETE", "/cart/:id", (p) => {
        const item = db.cart.find((i) => i.id === p[0]);
        if (!item) throw new ApiError("В корзине нет такого товара", 404);
        db.cart = db.cart.filter((i) => i.id !== item.id);
        save();
        return cartPayload();
    });

    on("DELETE", "/cart", () => {
        db.cart = [];
        save();
        return cartPayload();
    });

    /* ---------------- WISHLIST ---------------- */

    on("GET", "/wishlist", () => wishPayload());

    on("POST", "/wishlist", (p, data) => {
        const pid = Number(need(data, "product_id"));
        mustFind("products", pid, "Товар не найден");
        if (db.wishlist.indexOf(pid) === -1) db.wishlist.push(pid);
        save();
        return wishPayload();
    });

    on("DELETE", "/wishlist/:id", (p) => {
        if (db.wishlist.indexOf(p[0]) === -1) {
            throw new ApiError("В избранном нет такого товара", 404);
        }
        db.wishlist = db.wishlist.filter((id) => id !== p[0]);
        save();
        return wishPayload();
    });

    on("DELETE", "/wishlist", () => {
        db.wishlist = [];
        save();
        return wishPayload();
    });

    /* ---------------- ORDERS ---------------- */

    on("GET", "/orders", () => ({
        items: db.orders.slice().sort((a, b) => b.id - a.id),
        total: db.orders.length
    }));

    on("POST", "/orders", (p, data) => {
        const name = need(data, "name");
        const phone = need(data, "phone");
        const email = String(data.email || "").trim();
        if (email && !validEmail(email)) throw new ApiError("Неверный формат email", 422, "email");

        const payload = cartPayload();
        if (!payload.items.length) throw new ApiError("Корзина пуста", 409);

        payload.items.forEach((line) => {
            const product = find("products", line.product_id);
            if (product && line.qty > product.stock) {
                throw new ApiError("'" + product.name + "' — не хватает на складе", 409);
            }
        });
        payload.items.forEach((line) => {
            const product = find("products", line.product_id);
            if (product) product.stock -= line.qty;
        });

        const id = nextId("orders");
        const order = {
            id: id, number: "VX-" + String(id).padStart(5, "0"),
            name: name, phone: phone, email: email,
            address: String(data.address || "").trim(),
            comment: String(data.comment || "").trim(),
            items: payload.items, subtotal: payload.subtotal,
            delivery: payload.delivery, total: payload.total,
            status: "new", created_at: now()
        };
        db.orders.push(order);
        db.cart = [];
        save();
        return order;
    });

    const STATUSES = ["new", "confirmed", "shipped", "done", "cancelled"];

    on("PATCH", "/orders/:id", (p, data) => {
        needAdmin();
        const row = mustFind("orders", p[0], "Заказ не найден");
        if ("status" in data) {
            if (STATUSES.indexOf(data.status) === -1) {
                throw new ApiError("Статус может быть только одним из: " + STATUSES.join(", "), 422, "status");
            }
            row.status = data.status;
        }
        ["name", "phone", "email", "address", "comment"].forEach((f) => {
            if (f in data) row[f] = data[f];
        });
        row.updated_at = now();
        save();
        return row;
    });

    on("DELETE", "/orders/:id", (p) => {
        needAdmin();
        const row = mustFind("orders", p[0], "Заказ не найден");
        db.orders = db.orders.filter((o) => o.id !== row.id);
        save();
        return { ok: true, deleted: row.id };
    });

    /* ---------------- SUBSCRIBERS ---------------- */

    on("GET", "/subscribers", () => {
        needAdmin();
        return {
            items: db.subscribers.slice().sort((a, b) => b.id - a.id),
            total: db.subscribers.length
        };
    });

    on("POST", "/subscribers", (p, data) => {
        const email = need(data, "email");
        if (!validEmail(email)) throw new ApiError("Неверный формат email", 422, "email");
        if (db.subscribers.some((s) => s.email.toLowerCase() === email.toLowerCase())) {
            throw new ApiError("Этот email уже подписан", 409, "email");
        }
        const row = { id: nextId("subscribers"), email: email, created_at: now() };
        db.subscribers.push(row);
        save();
        return row;
    });

    on("DELETE", "/subscribers/:id", (p) => {
        needAdmin();
        const row = mustFind("subscribers", p[0], "Подписчик не найден");
        db.subscribers = db.subscribers.filter((s) => s.id !== row.id);
        save();
        return { ok: true, deleted: row.id };
    });

    /* ---------------- STATS / UPLOAD / RESET ---------------- */

    on("GET", "/stats", () => {
        needAdmin();
        const revenue = db.orders
            .filter((o) => o.status !== "cancelled")
            .reduce((sum, o) => sum + o.total, 0);
        return {
            products: db.products.length,
            active_products: db.products.filter((p) => p.is_active !== false).length,
            out_of_stock: db.products.filter((p) => (p.stock || 0) === 0).length,
            categories: db.categories.length,
            orders: db.orders.length,
            new_orders: db.orders.filter((o) => o.status === "new").length,
            revenue: Math.round(revenue * 100) / 100,
            subscribers: db.subscribers.length,
            banners: db.banners.length
        };
    });

    on("POST", "/upload", (p, data) => {
        needAdmin();
        const file = data && typeof data.get === "function" ? data.get("file") : null;
        if (!file || !file.name) throw new ApiError("Файл не выбран", 422, "file");
        if (!/^image\//.test(file.type)) throw new ApiError("Только файлы изображений", 415, "file");
        if (file.size > 1.5 * 1024 * 1024) {
            throw new ApiError("Изображение должно быть меньше 1.5 МБ (память браузера ограничена)", 413, "file");
        }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ ok: true, url: reader.result });
            reader.onerror = () => reject(new ApiError("Не удалось прочитать файл", 500, "file"));
            reader.readAsDataURL(file);
        });
    });

    on("POST", "/admin/reset", () => {
        needAdmin();
        seedDb();
        db.auth = true;
        save();
        return { ok: true, message: "Данные возвращены в исходное состояние" };
    });

    on("GET", "/health", () => ({
        status: "ok", time: now(),
        products: db.products.length, categories: db.categories.length, orders: db.orders.length
    }));

    /* =================================================================
       ПУБЛИЧНЫЙ ИНТЕРФЕЙС
       ================================================================= */

    function route(method, path, query, payload) {
        return new Promise((resolve) => {
            const found = match(method, path);
            if (!found) throw new ApiError("Адрес не найден: " + method + " " + path, 404);
            sync();
            resolve(found.handler(found.params, payload || {}, query || {}));
        }).then((result) => (result && typeof result === "object")
            ? JSON.parse(JSON.stringify(result))
            : result);
    }

    return {
        get: (path, params) => route("GET", path, params || {}),
        post: (path, payload) => route("POST", path, {}, payload === undefined ? {} : payload),
        patch: (path, payload) => route("PATCH", path, {}, payload),
        put: (path, payload) => route("PUT", path, {}, payload),
        del: (path, payload) => route("DELETE", path, {}, payload),
        raw: (method, path, payload) => route(method, path, {}, payload)
    };
})();
