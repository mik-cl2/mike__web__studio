
require("dotenv").config();

const express = require("express");
const Database = require("better-sqlite3");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// Check that private login settings have been configured.
if (
    !process.env.ADMIN_USERNAME ||
    !process.env.ADMIN_PASSWORD ||
    !process.env.SESSION_SECRET ||
    process.env.ADMIN_PASSWORD.startsWith("CHANGE_THIS") ||
    process.env.SESSION_SECRET.startsWith("CHANGE_THIS")
) {
    console.error("Please configure ADMIN_USERNAME, ADMIN_PASSWORD and SESSION_SECRET in .env");
    process.exit(1);
}

// Create or open the existing database.
const dataFolder = path.join(__dirname, "data");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder);
}

const db = new Database(path.join(dataFolder, "orders.db"));

db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        email TEXT NOT NULL,
        business_name TEXT NOT NULL,
        website_type TEXT NOT NULL,
        package_name TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// Add a status column if the database does not already have one.
const columns = db.prepare("PRAGMA table_info(orders)").all();

if (!columns.some(column => column.name === "status")) {
    db.exec(`
        ALTER TABLE orders
        ADD COLUMN status TEXT NOT NULL DEFAULT 'Pending'
    `);
}

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

// Local development session configuration.
app.use(session({
    name: "mws_admin_session",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "strict",
        secure: false,
        maxAge: 30 * 60 * 1000
    }
}));

// Limit repeated login attempts.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many login attempts. Please wait 15 minutes."
    }
});

function safeEqual(valueA, valueB) {
    const a = Buffer.from(String(valueA));
    const b = Buffer.from(String(valueB));

    if (a.length !== b.length) {
        return false;
    }

    return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
    if (!req.session || !req.session.isAdmin) {
        return res.status(401).json({
            success: false,
            message: "Please log in to access the dashboard."
        });
    }

    next();
}

// Login.
app.post("/api/login", loginLimiter, (req, res) => {
    const { username, password } = req.body || {};

    if (
        typeof username !== "string" ||
        typeof password !== "string" ||
        username.length > 100 ||
        password.length > 200
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid username and password."
        });
    }

    const usernameMatches = safeEqual(
        username,
        process.env.ADMIN_USERNAME
    );

    const passwordMatches = safeEqual(
        password,
        process.env.ADMIN_PASSWORD
    );

    if (!usernameMatches || !passwordMatches) {
        return res.status(401).json({
            success: false,
            message: "Incorrect username or password."
        });
    }

    req.session.regenerate(error => {
        if (error) {
            return res.status(500).json({
                success: false,
                message: "Could not start your login session."
            });
        }

        req.session.isAdmin = true;

        req.session.save(error => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Could not save your login session."
                });
            }

            res.json({
                success: true,
                message: "Login successful."
            });
        });
    });
});

// Check whether the browser is logged in.
app.get("/api/auth/status", (req, res) => {
    res.json({
        loggedIn: Boolean(req.session && req.session.isAdmin)
    });
});

// Logout.
app.post("/api/logout", requireAdmin, (req, res) => {
    req.session.destroy(error => {
        if (error) {
            return res.status(500).json({
                success: false,
                message: "Could not log out."
            });
        }

        res.clearCookie("mws_admin_session", {
            httpOnly: true,
            sameSite: "strict",
            secure: false
        });

        res.json({
            success: true,
            message: "You have logged out."
        });
    });
});

// Serve website files.
app.use(express.static(path.join(__dirname, "public")));

// Receive a website order.
app.post("/api/orders", (req, res) => {
    const {
        customer_name,
        email,
        business_name,
        website_type,
        package_name,
        details
    } = req.body || {};

    const fields = [
        customer_name,
        email,
        business_name,
        website_type,
        package_name,
        details
    ];

    if (fields.some(value => typeof value !== "string" || !value.trim())) {
        return res.status(400).json({
            success: false,
            message: "Please complete all required fields."
        });
    }

    if (
        customer_name.length > 100 ||
        email.length > 254 ||
        business_name.length > 150 ||
        website_type.length > 100 ||
        package_name.length > 100 ||
        details.length > 2000
    ) {
        return res.status(400).json({
            success: false,
            message: "Some information is too long."
        });
    }

    const validPackages = [
        "Basic Website",
        "Business Website",
        "Advanced Website"
    ];

    if (!validPackages.includes(package_name)) {
        return res.status(400).json({
            success: false,
            message: "Please select a valid package."
        });
    }

    const result = db.prepare(`
        INSERT INTO orders (
            customer_name,
            email,
            business_name,
            website_type,
            package_name,
            details
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        customer_name.trim(),
        email.trim(),
        business_name.trim(),
        website_type.trim(),
        package_name,
        details.trim()
    );

    res.json({
        success: true,
        order_id: result.lastInsertRowid,
        message: "Your test order was received successfully."
    });
});

// Only logged-in admins can view orders.
app.get("/api/orders", requireAdmin, (req, res) => {
    const orders = db.prepare(
        "SELECT * FROM orders ORDER BY id DESC"
    ).all();

    res.json(orders);
});

// Only logged-in admins can change order statuses.
app.patch("/api/orders/:id/status", requireAdmin, (req, res) => {
    const orderId = Number(req.params.id);
    const { status } = req.body || {};

    const validStatuses = [
        "Pending",
        "In Progress",
        "Completed"
    ];

    if (!Number.isInteger(orderId) || orderId < 1) {
        return res.status(400).json({
            success: false,
            message: "Invalid order number."
        });
    }

    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid order status."
        });
    }

    const result = db.prepare(
        "UPDATE orders SET status = ? WHERE id = ?"
    ).run(status, orderId);

    if (result.changes === 0) {
        return res.status(404).json({
            success: false,
            message: "Order not found."
        });
    }

    res.json({
        success: true,
        message: "Order status updated."
    });
});

// Keep this development server on your own computer.
app.listen(PORT, "0.0.0.0", () => {
    console.log(`MIKE WEB STUDIO running on port ${PORT}`);
});

