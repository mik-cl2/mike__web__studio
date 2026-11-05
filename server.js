
require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// Check private login and database settings.
if (
    !process.env.ADMIN_USERNAME ||
    !process.env.ADMIN_PASSWORD ||
    !process.env.SESSION_SECRET ||
    !process.env.DATABASE_URL ||
    process.env.ADMIN_PASSWORD.startsWith("CHANGE_THIS") ||
    process.env.SESSION_SECRET.startsWith("CHANGE_THIS")
) {
    console.error("Missing required environment settings.");
    process.exit(1);
}

// Trust Render's reverse proxy.
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

// PostgreSQL connection.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5
});

pool.on("error", error => {
    console.error("Unexpected database error:", error.message);
});

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

// Session configuration.
app.use(session({
    name: "mws_admin_session",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 60 * 1000
    }
}));

// Login rate limiter.
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

// Create the PostgreSQL orders table.
async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id BIGSERIAL PRIMARY KEY,
            customer_name TEXT NOT NULL,
            email TEXT NOT NULL,
            business_name TEXT NOT NULL,
            website_type TEXT NOT NULL,
            package_name TEXT NOT NULL,
            details TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL DEFAULT 'Pending'
        )
    `);

    await pool.query(`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS status
        TEXT NOT NULL DEFAULT 'Pending'
    `);

    console.log("PostgreSQL database connected successfully.");
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

// Authentication status.
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
            secure: process.env.NODE_ENV === "production"
        });

        res.json({
            success: true,
            message: "You have logged out."
        });
    });
});

// Serve website files.
app.use(express.static(path.join(__dirname, "public")));

// Receive customer orders.
app.post("/api/orders", async (req, res) => {
    try {
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

        if (fields.some(value =>
            typeof value !== "string" || !value.trim()
        )) {
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

        const result = await pool.query(`
            INSERT INTO orders (
                customer_name,
                email,
                business_name,
                website_type,
                package_name,
                details
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [
            customer_name.trim(),
            email.trim(),
            business_name.trim(),
            website_type.trim(),
            package_name,
            details.trim()
        ]);

        res.json({
            success: true,
            order_id: result.rows[0].id,
            message: "Your test order was received successfully."
        });

    } catch (error) {
        console.error("Order submission error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not save your order. Please try again."
        });
    }
});

// Admin: retrieve orders.
app.get("/api/orders", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM orders ORDER BY id DESC"
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Order retrieval error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not retrieve orders."
        });
    }
});

// Admin: update order status.
app.patch("/api/orders/:id/status", requireAdmin, async (req, res) => {
    try {
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

        const result = await pool.query(
            "UPDATE orders SET status = $1 WHERE id = $2 RETURNING id",
            [status, orderId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        res.json({
            success: true,
            message: "Order status updated."
        });

    } catch (error) {
        console.error("Order update error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not update order status."
        });
    }
});

// Start only after the database is ready.
async function startServer() {
    try {
        await initializeDatabase();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`MIKE WEB STUDIO running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
}

startServer();
