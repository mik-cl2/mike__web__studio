
const packageButtons = document.querySelectorAll(".choose-btn");
const packageCards = document.querySelectorAll(".package");
const packageSelect = document.querySelector("#package");
const orderForm = document.querySelector("#orderForm");
const result = document.querySelector("#result");

const packageOptions = {
  "Basic Website": "Basic Website - KSh 500",
  "Business Website": "Business Website - KSh 1,500",
  "Advanced Website": "Advanced Website - KSh 3,000"
};

// Package selection and animation
packageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const selected = button.dataset.package;

    packageCards.forEach((card) => {
      card.classList.remove("selected");
    });

    const selectedCard = button.closest(".package");
    selectedCard.classList.add("selected");

    packageSelect.value = packageOptions[selected];

    document.querySelector("#order").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
});

// Keep the selected card highlighted when the form package changes
packageSelect.addEventListener("change", () => {
  packageCards.forEach((card) => {
    card.classList.remove("selected");
  });

  const selectedButton = document.querySelector(
    `[data-package="${packageSelect.value.split(" - ")[0]}"]`
  );

  if (selectedButton) {
    selectedButton.closest(".package").classList.add("selected");
  }
});

// Demonstration order form
orderForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(orderForm);

  const heading = document.createElement("h3");
  heading.textContent = "Your request is ready!";

  const message = document.createElement("p");
  message.textContent =
    "Demonstration only: your request has not been sent or paid for.";

  const summary = document.createElement("p");

  summary.textContent = [
    `Name: ${formData.get("customer")}`,
    `Email: ${formData.get("email")}`,
    `Business: ${formData.get("business")}`,
    `Website: ${formData.get("type")}`,
    `Package: ${formData.get("package")}`,
    `Details: ${formData.get("details") || "Not provided"}`
  ].join(" | ");

  result.replaceChildren(heading, message, summary);

  result.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
});

