const packageButtons = document.querySelectorAll(".choose-btn");
const packageCards = document.querySelectorAll(".package");
const packageSelect = document.querySelector("#package");
const orderForm = document.querySelector("#orderForm");
const result = document.querySelector("#result");
const submitButton = orderForm.querySelector('button[type="submit"]');

const packageOptions = {
  "Basic Website": "Basic Website - KSh 500",
  "Business Website": "Business Website - KSh 1,500",
  "Advanced Website": "Advanced Website - KSh 3,000"
};

// Highlight the selected package.
function highlightPackage(packageName) {
  packageCards.forEach((card) => {
    card.classList.remove("selected");
  });

  const selectedButton = document.querySelector(
    `[data-package="${packageName}"]`
  );

  if (selectedButton) {
    selectedButton.closest(".package").classList.add("selected");
  }
}

// Package selection.
packageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const selected = button.dataset.package;

    highlightPackage(selected);
    packageSelect.value = packageOptions[selected];

    document.querySelector("#order").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
});

// Highlight the package when changed in the form.
packageSelect.addEventListener("change", () => {
  const selected = packageSelect.value.split(" - ")[0];
  highlightPackage(selected);
});

// Send the order to the backend.
orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(orderForm);

  const packageValue = formData.get("package");

  if (!packageValue) {
    result.textContent = "Please select a website package.";
    return;
  }

  const selectedPackage = packageValue.split(" - ")[0];

  const order = {
    customer_name: formData.get("customer").trim(),
    email: formData.get("email").trim(),
    business_name: formData.get("business").trim(),
    website_type: formData.get("type"),
    package_name: selectedPackage,
    details: formData.get("details").trim() || "Not provided"
  };

  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";
  result.textContent = "Sending your website request...";

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(order)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Your request could not be submitted."
      );
    }

    // Create professional confirmation.
    const heading = document.createElement("h3");
    heading.textContent = "🎉 Order Received Successfully!";

    const reference = document.createElement("p");
    reference.innerHTML = `<strong>Order Number:</strong> MWS-${data.order_id}`;

    const packageInfo = document.createElement("p");
    packageInfo.innerHTML =
      `<strong>Selected Package:</strong> ${packageOptions[selectedPackage]}`;

    const nextStep = document.createElement("p");
    nextStep.textContent =
      "Thank you for choosing MIKE WEB STUDIO. We have received your request and will review your website requirements.";

    const contactInfo = document.createElement("p");
    contactInfo.textContent =
      "Please keep your order number for future communication about your website.";

    result.replaceChildren(
      heading,
      reference,
      packageInfo,
      nextStep,
      contactInfo
    );

    // Reset the form.
    orderForm.reset();

    packageCards.forEach((card) => {
      card.classList.remove("selected");
    });

    result.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

  } catch (error) {
    const heading = document.createElement("h3");
    heading.textContent = "⚠️ Order Not Submitted";

    const message = document.createElement("p");
    message.textContent =
      error.message || "Something went wrong. Please try again.";

    result.replaceChildren(heading, message);

    result.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Prepare My Request";
  }
});