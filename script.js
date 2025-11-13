/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const productSearch = document.getElementById("productSearch");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const clearSelectionsBtn = document.getElementById("clearSelections");
const rtlToggle = document.getElementById("rtlToggle");

const WORKER_URL = "https://broad-frog-68ee.lthomas15.workers.dev/";

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;
/* App state */
let allProducts = [];
let selectedIds = new Set(
  JSON.parse(localStorage.getItem("selectedProducts") || "[]")
);
let chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");

/* Load product data from JSON file */
async function loadProducts() {
  try {
    const response = await fetch("products.json");
    const data = await response.json();
    allProducts = data.products || [];
    renderProducts();
    updateSelectedProductsList();
  } catch (err) {
    productsContainer.innerHTML = `<div class="placeholder-message">Failed to load products</div>`;
    console.error(err);
  }
}

/* Render products using active filters */
function renderProducts() {
  const category = categoryFilter.value;
  const search =
    productSearch && productSearch.value
      ? productSearch.value.trim().toLowerCase()
      : "";

  const filtered = allProducts.filter((p) => {
    const matchesCategory = !category || p.category === category;
    const text = (
      p.name +
      " " +
      p.brand +
      " " +
      (p.description || "")
    ).toLowerCase();
    const matchesSearch = !search || text.includes(search);
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    productsContainer.innerHTML = `<div class="placeholder-message">No products match your filters</div>`;
    return;
  }

  productsContainer.innerHTML = filtered
    .map((product) => {
      const isSelected = selectedIds.has(String(product.id));
      return `
      <div class="product-card ${isSelected ? "selected" : ""}" data-id="${
        product.id
      }">
        <img src="${product.image}" alt="${product.name}">
        <div class="product-info">
          <h3>${product.name}</h3>
          <p>${product.brand}</p>
          <div class="product-controls">
            <button class="info-btn" data-id="${
              product.id
            }" aria-label="More info">ℹ️</button>
          </div>
          <div class="product-desc" id="desc-${product.id}">${
        product.description
      }</div>
        </div>
      </div>
    `;
    })
    .join("");
}

/* Toggle selection for a product id */
function toggleSelection(productId) {
  const idStr = String(productId);
  if (selectedIds.has(idStr)) selectedIds.delete(idStr);
  else selectedIds.add(idStr);
  localStorage.setItem("selectedProducts", JSON.stringify([...selectedIds]));
  renderProducts();
  updateSelectedProductsList();
}

/* Update the Selected Products list UI */
function updateSelectedProductsList() {
  const selected = allProducts.filter((p) => selectedIds.has(String(p.id)));
  if (selected.length === 0) {
    selectedProductsList.innerHTML = `<div class="placeholder-message">No products selected</div>`;
    return;
  }
  selectedProductsList.innerHTML = selected
    .map(
      (p) => `
    <div class="selected-item" data-id="${p.id}">
      <strong>${p.name}</strong>
      <span>• ${p.brand}</span>
      <button class="remove" data-id="${p.id}" aria-label="Remove">✖</button>
    </div>
  `
    )
    .join("");
}

/* Helper: append message to chat window */
function appendChatMessage(role, text) {
  const el = document.createElement("div");
  el.className = role === "user" ? "chat-user" : "chat-assistant";
  el.innerText = text;
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Build messages array to send to Worker (includes conversation history) */
function buildMessagesWithSystem(additionalUserContent) {
  const system = {
    role: "system",
    content:
      "You are a helpful beauty routine assistant. Answer concisely and in a friendly tone. Only discuss skincare, haircare, makeup, fragrance, and related topics.",
  };
  const messages = [
    system,
    ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
  ];
  messages.push({ role: "user", content: additionalUserContent });
  return messages;
}

/* Send messages to Worker and return assistant content */
async function sendToWorker(messages) {
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    const data = await res.json();
    // support multiple response shapes
    if (
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      return data.choices[0].message.content;
    }
    if (data.reply) return data.reply;
    if (data.content) return data.content;
    return JSON.stringify(data);
  } catch (err) {
    console.error(err);
    return "Sorry — there was an error contacting the assistant.";
  }
}

/* Loading indicator helpers (simple spinner shown in the chat window) */
function showLoading() {
  // avoid duplicates
  if (document.getElementById("loadingIndicator")) return;
  const el = document.createElement("div");
  el.id = "loadingIndicator";
  el.className = "chat-loading";
  el.innerHTML = `<div class="spinner" aria-hidden="true"></div><div class="loading-text">Thinking...</div>`;
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideLoading() {
  const el = document.getElementById("loadingIndicator");
  if (el) el.remove();
}

/* Click handlers: delegate product card interactions */
productsContainer.addEventListener("click", (e) => {
  const infoBtn = e.target.closest(".info-btn");
  if (infoBtn) {
    const id = infoBtn.dataset.id;
    const desc = document.getElementById(`desc-${id}`);
    if (desc) desc.classList.toggle("open");
    return;
  }

  const card = e.target.closest(".product-card");
  if (card) {
    const id = card.dataset.id;
    toggleSelection(id);
  }
});

/* Remove from selected list */
selectedProductsList.addEventListener("click", (e) => {
  const rem = e.target.closest(".remove");
  if (rem) {
    const id = rem.dataset.id;
    selectedIds.delete(String(id));
    localStorage.setItem("selectedProducts", JSON.stringify([...selectedIds]));
    renderProducts();
    updateSelectedProductsList();
  }
});

/* Clear all selections */
clearSelectionsBtn.addEventListener("click", () => {
  selectedIds = new Set();
  localStorage.setItem("selectedProducts", JSON.stringify([]));
  renderProducts();
  updateSelectedProductsList();
});

/* Category and search filters */
categoryFilter.addEventListener("change", () => renderProducts());
if (productSearch) {
  productSearch.addEventListener("input", () => renderProducts());
}

/* RTL toggle */
function applyDir(dir) {
  document.documentElement.setAttribute("dir", dir);
  localStorage.setItem("dir", dir);
}
const savedDir = localStorage.getItem("dir") || "ltr";
applyDir(savedDir);
rtlToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("dir") || "ltr";
  applyDir(current === "ltr" ? "rtl" : "ltr");
});

/* Generate Routine: send selected products to Worker and display response */
generateRoutineBtn.addEventListener("click", async () => {
  const selected = allProducts
    .filter((p) => selectedIds.has(String(p.id)))
    .map((p) => ({
      name: p.name,
      brand: p.brand,
      category: p.category,
      description: p.description,
    }));
  if (selected.length === 0) {
    appendChatMessage(
      "assistant",
      "Please select at least one product to generate a routine."
    );
    return;
  }

  const userContent = `Please create a personalized routine using only the following products (return clearly labeled steps and product order). Respond in plain text. \n\nProducts:\n${JSON.stringify(
    selected,
    null,
    2
  )}`;
  appendChatMessage("user", "Generate routine for selected products...");
  // build messages with history
  const messages = buildMessagesWithSystem(userContent);
  // show loading indicator while waiting for the Worker
  showLoading();
  try {
    let reply = await sendToWorker(messages);
    appendChatMessage("assistant", reply);
    // save assistant reply in history
    chatHistory.push({ role: "user", content: userContent });
    chatHistory.push({ role: "assistant", content: reply });
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  } finally {
    hideLoading();
  }
  // (history already saved inside try)
});

/* Chat follow-ups */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  if (!text) return;
  appendChatMessage("user", text);
  chatHistory.push({ role: "user", content: text });
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));

  const messages = buildMessagesWithSystem(text);
  showLoading();
  try {
    const reply = await sendToWorker(messages);
    appendChatMessage("assistant", reply);
    chatHistory.push({ role: "assistant", content: reply });
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  } finally {
    hideLoading();
  }
  input.value = "";
});

/* Initial load */
loadProducts();

/* Render persisted chat history in the window */
if (chatHistory && chatHistory.length) {
  chatHistory.forEach((m) => appendChatMessage(m.role, m.content));
} else {
  chatWindow.innerHTML = `<div class="placeholder-message">Let's build your routine — select products and click "Generate Routine"</div>`;
}
