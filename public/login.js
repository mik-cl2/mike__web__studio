
const loginForm = document.querySelector("#loginForm");
const message = document.querySelector("#message");
const loginButton = document.querySelector("#loginButton");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.querySelector("#username").value;
    const password = document.querySelector("#password").value;

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";
    message.textContent = "";

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Login failed.");
        }

        window.location.href = "/admin.html";

    } catch (error) {
        message.textContent = error.message;
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Sign In";
    }
});
const passwordInput = document.querySelector("#password");
const togglePassword = document.querySelector("#togglePassword");

togglePassword.addEventListener("click", () => {
    const passwordIsHidden = passwordInput.type === "password";

    passwordInput.type = passwordIsHidden ? "text" : "password";

    togglePassword.textContent = passwordIsHidden
        ? "Hide"
        : "Show";
});