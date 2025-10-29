// Minimal JS powering search, menu population, cart & nav toggle
let siteMenuData = JSON.parse(localStorage.getItem("siteMenuData")) || [];

// Load menu data from database
async function loadMenuFromDB() {
  try {
    const response = await fetch("get_menu.php");
    const data = await response.json();
    siteMenuData = data;
    localStorage.setItem("siteMenuData", JSON.stringify(siteMenuData));
    return true;
  } catch (error) {
    console.error("Error loading menu from database:", error);
    // Fallback to localStorage if DB fails
    return false;
  }
}

// --- DOM shortcuts ---
const yearElems = () =>
  document.querySelectorAll("#year, #year2, #year3, #year4, #year5");
const formatCurrency = (n) => Number(n).toLocaleString("en-IN");

document.addEventListener("DOMContentLoaded", async () => {
  // Load menu data from database
  await loadMenuFromDB();

  // set year
  yearElems().forEach((e) => {
    if (e) e.textContent = new Date().getFullYear();
  });

  // nav toggle (mobile)
  const navToggle = document.getElementById("navToggle");
  if (navToggle) {
    navToggle.addEventListener("click", () => {
      const navList = document.getElementById("navList");
      if (navList)
        navList.style.display =
          navList.style.display === "flex" ? "none" : "flex";
    });
  }

  // populate menu
  if (document.getElementById("menuGrid")) buildMenuGrid();
  if (document.getElementById("orderMenuList")) buildOrderMenu();

  // search on menu page
  const menuSearch = document.getElementById("menuSearch");
  if (menuSearch) {
    menuSearch.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      buildMenuGrid(q);
    });
  }

  // checkout
  const checkoutBtn = document.getElementById("checkoutBtn");
  if (checkoutBtn)
    checkoutBtn.addEventListener("click", () => {
      const cart = getCart();
      if (!cart.length) return alert("Your cart is empty.");
      const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
      // save last order for billing
      localStorage.setItem("last_order", JSON.stringify(cart));
      localStorage.removeItem("mk_cart");
      renderCart();
      alert("Thankyou For Your Ordering!.");
      window.location.href = "billing.html";
    });

  renderCart();

  // admin authentication
  if (document.getElementById("loginForm")) {
    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;
      if (login(username, password)) {
        checkLoginStatus();
      } else {
        alert("Invalid credentials!");
      }
    });
  }

  if (document.getElementById("logoutBtn")) {
    document.getElementById("logoutBtn").addEventListener("click", logout);
  }

  // check login status on admin page
  checkLoginStatus();

  // admin form
  const addItemForm = document.getElementById("addItemForm");
  if (addItemForm) {
    addItemForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("itemName").value;
      const category = document.getElementById("itemCategory").value;
      const price = document.getElementById("itemPrice").value;
      const desc = document.getElementById("itemDesc").value;
      const img = document.getElementById("itemImg").value;
      const editId = document.getElementById("editId").value;
      if (editId) {
        updateItem(parseInt(editId), name, category, price, desc, img);
        document.getElementById("editId").value = "";
        addItemForm.querySelector("button").textContent = "Add Item";
      } else {
        await addItemToDB(name, category, price, desc, img);
      }
      addItemForm.reset();
      buildAdminList();
      // also rebuild menu if on menu page
      if (document.getElementById("menuGrid")) buildMenuGrid();
      if (document.getElementById("orderMenuList")) buildOrderMenu();
    });
  }

  // build admin list
  if (document.getElementById("adminMenuList")) buildAdminList();
});

// build menu grid for menu.html
function buildMenuGrid(filter = "") {
  const grid = document.getElementById("menuGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const data = siteMenuData.filter((item) =>
    (item.name + item.desc + item.category)
      .toLowerCase()
      .includes(filter.toLowerCase())
  );
  if (!data.length) {
    grid.innerHTML =
      '<p class="text-muted">No dishes found. Try another search.</p>';
    return;
  }
  const grouped = data.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});
  for (const category in grouped) {
    const section = document.createElement("section");
    section.className = "menu-category";
    const h2 = document.createElement("h2");
    h2.textContent = category;
    section.appendChild(h2);
    const catGrid = document.createElement("div");
    catGrid.className = "menu-grid-category";
    grouped[category].forEach((item) => {
      const el = document.createElement("article");
      el.className = "menu-card";
      el.innerHTML = `
      <img src="${item.img}" alt="${
        item.name
      }" onerror="alert('Image failed to load for ${item.name}')">
      <div>
      <h4>${item.name} — ₹${formatCurrency(item.price)}</h4>
      <p class="text-muted">${item.desc}</p>
      <div style="margin-top:.6rem">
      <button class="btn" onclick="addToCart(${item.id})">Add</button>
      </div>
      </div>
      `;
      catGrid.appendChild(el);
    });
    section.appendChild(catGrid);
    grid.appendChild(section);
  }
}

// build order menu for order.html
function buildOrderMenu() {
  const wrap = document.getElementById("orderMenuList");
  if (!wrap) return;
  wrap.innerHTML = "";
  siteMenuData.forEach((item) => {
    const div = document.createElement("div");
    div.className = "order-item";
    div.innerHTML = `
<div style="display:flex;gap:12px;align-items:center">
<img src="${item.img}" alt="${
      item.name
    }" style="width:72px;height:54px;object-fit:cover;border-radius:8px">
<div>
<strong>${item.name}</strong>
<div class="text-muted" style="font-size:.9rem">₹${formatCurrency(
      item.price
    )} — ${item.desc}</div>
</div>
</div>
<div style="display:flex;flex-direction:column;align-items:flex-end">
<div>
<button onclick="changeQty(${item.id}, -1)">−</button>
<span id="qty-${item.id}" style="margin:0 8px">0</span>
<button onclick="changeQty(${item.id}, 1)">+</button>
</div>
<button class="btn" style="margin-top:8px" onclick="addToCart(${
      item.id
    })">Add to cart</button>
</div>
`;
    wrap.appendChild(div);
  });
}
// cart helpers
function getCart() {
  return JSON.parse(localStorage.getItem("mk_cart") || "[]");
}
function saveCart(cart) {
  localStorage.setItem("mk_cart", JSON.stringify(cart));
}

function addToCart(id) {
  const item = siteMenuData.find((i) => i.id === id);
  if (!item) return;
  const cart = getCart();
  const existing = cart.find((c) => c.id === id);
  if (existing) existing.qty += 1;
  else cart.push({ id: id, name: item.name, price: item.price, qty: 1 });
  saveCart(cart);
  renderCart();
  // Show popup message with item name
  showPopup(item.name);
}

function showPopup(itemName) {
  const popup = document.getElementById("addPopup");
  if (popup) {
    popup.textContent = `${itemName} added to cart!`;
    popup.classList.add("show");
    setTimeout(() => {
      popup.classList.remove("show");
    }, 2000); // Auto-close after 2 seconds
  }
}

function changeQty(id, delta) {
  const cart = getCart();
  let item = cart.find((c) => c.id === id);
  if (!item) {
    if (delta > 0) {
      addToCart(id);
    }
    return;
  }
  item.qty += delta;
  if (item.qty <= 0) {
    const idx = cart.findIndex((c) => c.id === id);
    if (idx > -1) cart.splice(idx, 1);
  }
  saveCart(cart);
  renderCart();
}

function renderCart() {
  const wrap = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  if (!wrap || !totalEl) return;
  const cart = getCart();
  wrap.innerHTML = "";
  let total = 0;
  if (!cart.length)
    wrap.innerHTML = '<p class="text-muted">Your cart is empty.</p>';
  cart.forEach((i) => {
    total += i.price * i.qty;
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.margin = "6px 0";
    div.innerHTML = `<div>${i.name} <small class="text-muted">×${
      i.qty
    }</small></div><div>₹${formatCurrency(i.price * i.qty)}</div>`;
    wrap.appendChild(div);
  });
  totalEl.textContent = formatCurrency(total);
  // update quantity spans on order page
  siteMenuData.forEach((i) => {
    const span = document.getElementById("qty-" + i.id);
    const cartItem = cart.find((c) => c.id === i.id);
    if (span) span.textContent = cartItem ? cartItem.qty : 0;
  });
}

// simple search helper exposed (no module system)
window.addToCart = addToCart;
window.changeQty = changeQty;

// billing page
if (document.getElementById("billItems")) {
  const lastOrder = JSON.parse(localStorage.getItem("last_order") || "[]");
  const billItems = document.getElementById("billItems");
  const billTotal = document.getElementById("billTotal");
  const billDate = document.getElementById("billDate");
  const billTime = document.getElementById("billTime");
  const billNo = document.getElementById("billNo");
  const customerName = document.getElementById("customerName");
  const now = new Date();
  billDate.textContent = now.toLocaleDateString();
  billTime.textContent = now.toLocaleTimeString();
  billNo.textContent = "BILL-" + Date.now(); // Generate a unique bill number
  customerName.textContent = localStorage.getItem("customer_name") || "Mani"; // Get customer name from localStorage or default to Guest
  let total = 0;
  if (!lastOrder.length) {
    billItems.innerHTML = "<tr><td colspan='4'>No order found.</td></tr>";
  }
  lastOrder.forEach((item) => {
    const subtotal = item.price * item.qty;
    total += subtotal;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.qty}</td>
      <td>₹${item.price}</td>
      <td>₹${subtotal.toLocaleString("en-IN")}</td>
    `;
    billItems.appendChild(tr);
  });
  billTotal.textContent = total.toLocaleString("en-IN");
}

if (document.getElementById("downloadBtn")) {
  document.getElementById("downloadBtn").addEventListener("click", () => {
    const element = document.createElement("a");
    const billContent = document.querySelector("main").innerHTML;
    const htmlContent = `
      <html>
        <head>
          <title>Mani's Kitchen - Bill</title>
          <style>
            body { font-family: Montserrat, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial; padding: 1rem; }
            table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
            th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #ffdbcbff; font-weight: 600; }
            .billing-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
            img { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; }
          </style>
        </head>
        <body>
          ${billContent}
        </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: "text/html" });
    element.href = URL.createObjectURL(blob);
    element.download = `ManisKitchen_Bill_${new Date()
      .toISOString()
      .slice(0, 10)}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  });
}

// Admin functions
function saveMenuData() {
  localStorage.setItem("siteMenuData", JSON.stringify(siteMenuData));
}

async function addItemToDB(name, category, price, desc, img) {
  try {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("category", category);
    formData.append("price", price);
    formData.append("description", desc);
    formData.append("img", img);

    const response = await fetch("add_item.php", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (result.success) {
      alert("Item added successfully!");
      // Reload menu data from database
      await loadMenuFromDB();
    } else {
      alert("Error adding item: " + result.message);
    }
  } catch (error) {
    console.error("Error adding item to database:", error);
    alert("Error adding item to database. Please try again.");
  }
}

function addItem(name, category, price, desc, img) {
  const newId = Math.max(...siteMenuData.map((i) => i.id)) + 1;
  siteMenuData.push({
    id: newId,
    name,
    category,
    price: parseInt(price),
    desc,
    img,
  });
  saveMenuData();
}

function updateItem(id, name, category, price, desc, img) {
  const item = siteMenuData.find((i) => i.id === id);
  if (item) {
    item.name = name;
    item.category = category;
    item.price = parseInt(price);
    item.desc = desc;
    item.img = img;
    saveMenuData();
  }
}

function deleteItem(id) {
  siteMenuData = siteMenuData.filter((i) => i.id !== id);
  saveMenuData();
}

function buildAdminList() {
  const wrap = document.getElementById("adminMenuList");
  if (!wrap) return;
  wrap.innerHTML = "";
  siteMenuData.forEach((item) => {
    const div = document.createElement("div");
    div.className = "admin-item";
    div.innerHTML = `
      <div>
        <strong>${item.name}</strong> - ${item.category} - ₹${formatCurrency(
      item.price
    )}
        <p>${item.desc}</p>
        <img src="${item.img}" alt="${
      item.name
    }" style="width:100px;height:75px;object-fit:cover;">
      </div>
      <div>
        <button class="btn" onclick="editItem(${item.id})">Edit</button>
        <button class="btn" onclick="deleteItem(${
          item.id
        }); buildAdminList(); if (document.getElementById('menuGrid')) buildMenuGrid(); if (document.getElementById('orderMenuList')) buildOrderMenu();">Delete</button>
      </div>
    `;
    wrap.appendChild(div);
  });
}

function editItem(id) {
  const item = siteMenuData.find((i) => i.id === id);
  if (item) {
    document.getElementById("itemName").value = item.name;
    document.getElementById("itemCategory").value = item.category;
    document.getElementById("itemPrice").value = item.price;
    document.getElementById("itemDesc").value = item.desc;
    document.getElementById("itemImg").value = item.img;
    document.getElementById("editId").value = item.id;
    document.getElementById("addItemForm").querySelector("button").textContent =
      "Update Item";
  }
}

// Admin authentication functions
function checkLoginStatus() {
  const isLoggedIn = localStorage.getItem("adminLoggedIn") === "true";
  const loginSection = document.getElementById("loginSection");
  const adminContent = document.getElementById("adminContent");
  if (loginSection && adminContent) {
    if (isLoggedIn) {
      loginSection.style.display = "none";
      adminContent.style.display = "block";
    } else {
      loginSection.style.display = "block";
      adminContent.style.display = "none";
    }
  }
}

function login(username, password) {
  // Hardcoded credentials for simplicity
  if (username === "Mani" && password === "A25MIT06") {
    localStorage.setItem("adminLoggedIn", "true");
    return true;
  }
  return false;
}

function logout() {
  localStorage.removeItem("adminLoggedIn");
  checkLoginStatus();
}

// expose functions
window.editItem = editItem;
window.deleteItem = deleteItem;
