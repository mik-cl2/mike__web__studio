const ordersList = document.querySelector("#ordersList");
const message = document.querySelector("#message");

const totalOrders = document.querySelector("#totalOrders");
const pendingOrders = document.querySelector("#pendingOrders");
const progressOrders = document.querySelector("#progressOrders");
const completedOrders = document.querySelector("#completedOrders");

const statuses = ["Pending", "In Progress", "Completed"];

// Check whether the admin is logged in before loading orders.
async function checkLogin() {
    try {
        const response = await fetch("/api/auth/status");

        if (!response.ok) {
            throw new Error("Could not check login status.");
        }

        const data = await response.json();

        if (!data.loggedIn) {
            window.location.replace("/login.html");
            return false;
        }

        return true;

    } catch (error) {
        window.location.replace("/login.html");
        return false;
    }
}

// Log out and return to the login page.
async function logout() {
    try {
        const response = await fetch("/api/logout", {
            method: "POST"
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not log out.");
        }

    } catch (error) {
        console.error(error.message);
    }

    window.location.replace("/login.html");
}

// Update an order's status.
async function updateOrderStatus(orderId, newStatus, select) {
    const previousStatus = select.dataset.previousStatus;

    select.disabled = true;
    message.textContent = `Updating order MWS-${orderId}...`;

    try {
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();

        if (response.status === 401) {
            window.location.replace("/login.html");
            return;
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not update status.");
        }

        select.dataset.previousStatus = newStatus;
        message.textContent = `Order MWS-${orderId} updated successfully.`;

        await loadOrders();

    } catch (error) {
        select.value = previousStatus;
        message.textContent = error.message;
        select.disabled = false;
    }
}

// Load all orders.
async function loadOrders() {
    message.textContent = "Loading orders...";
    ordersList.replaceChildren();

    try {
        const response = await fetch("/api/orders");

        if (response.status === 401) {
            window.location.replace("/login.html");
            return;
        }

        if (!response.ok) {
            throw new Error("Could not load orders.");
        }

        const orders = await response.json();

        totalOrders.textContent = orders.length;

        pendingOrders.textContent = orders.filter(
            order => (order.status || "Pending") === "Pending"
        ).length;

        progressOrders.textContent = orders.filter(
            order => order.status === "In Progress"
        ).length;

        completedOrders.textContent = orders.filter(
            order => order.status === "Completed"
        ).length;

        if (orders.length === 0) {
            message.textContent = "No orders have been received yet.";
            return;
        }

        message.textContent = `${orders.length} order(s) found.`;

        orders.forEach(order => {
            const card = document.createElement("article");
            card.className = "order-card";

            const heading = document.createElement("h3");
            heading.textContent = `Order MWS-${order.id}`;
            card.appendChild(heading);

            const fields = [
                ["Customer", order.customer_name],
                ["Email", order.email],
                ["Business", order.business_name],
                ["Website type", order.website_type],
                ["Package", order.package_name],
                ["Details", order.details],
                ["Date received", order.created_at]
            ];

            fields.forEach(([label, value]) => {
                const paragraph = document.createElement("p");
                paragraph.textContent =
                    `${label}: ${value || "Not provided"}`;
                card.appendChild(paragraph);
            });

            const statusLabel = document.createElement("p");
            statusLabel.textContent = "Order status:";
            card.appendChild(statusLabel);

            const statusSelect = document.createElement("select");
            statusSelect.className = "status-select";

            const currentStatus = statuses.includes(order.status)
                ? order.status
                : "Pending";

            statusSelect.dataset.previousStatus = currentStatus;

            statuses.forEach(status => {
                const option = document.createElement("option");
                option.value = status;
                option.textContent = status;
                statusSelect.appendChild(option);
            });

            statusSelect.value = currentStatus;

            statusSelect.addEventListener("change", () => {
                updateOrderStatus(
                    order.id,
                    statusSelect.value,
                    statusSelect
                );
            });

            card.appendChild(statusSelect);
            ordersList.appendChild(card);
        });

    } catch (error) {
        message.textContent = error.message;
    }
}

// Connect the Logout button.
const logoutButton = document.querySelector("#logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", logout);
}

// Start the dashboard safely.
(async function startDashboard() {
    const loggedIn = await checkLogin();

    if (loggedIn) {
        loadOrders();
    }
})();