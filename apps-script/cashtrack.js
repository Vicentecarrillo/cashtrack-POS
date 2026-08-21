const SHARED_SECRET = "";

/**
 * ──────────────────────────────────────────────
 * CashtrackLib
 * Auth
 * ──────────────────────────────────────────────
 */

const AUTH_CONFIG = {
  AUTH_SHEET_NAME: "Auth",
  AUTH_COLUMNS: ["api_key", "role", "active", "user_name", "devices"],
  DEBUG_SHEET_ID: "", // optional
};

/**
 * Return a consistent JSON response object.
 */
function _res(code, obj = {}) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: code, ...obj }),
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Basic spreadsheet logger for debugging.
 */
function debugLog(...msg) {
  try {
    const logSheet = AUTH_CONFIG.DEBUG_SHEET_ID
      ? SpreadsheetApp.openById(AUTH_CONFIG.DEBUG_SHEET_ID).getSheetByName(
          "logs",
        )
      : SpreadsheetApp.getActiveSpreadsheet().getSheetByName("logs");

    if (logSheet) {
      logSheet.appendRow([new Date(), ...msg.map(String)]);
    } else {
      console.log("[Debug]", ...msg);
    }
  } catch (err) {
    console.error("Debug log error:", err);
  }
}

/**
 * Return the Auth sheet, creating columns if empty.
 */
function openAuthSheet_(CONFIG_SHEET_ID) {
  const ss = SpreadsheetApp.openById(CONFIG_SHEET_ID);
  const sheet =
    ss.getSheetByName(AUTH_CONFIG.AUTH_SHEET_NAME) ||
    ss.insertSheet(AUTH_CONFIG.AUTH_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(AUTH_CONFIG.AUTH_COLUMNS);
  return sheet;
}

/**
 * Read all active API keys into a map.
 */
function _readAuthMap_(CONFIG_SHEET_ID) {
  const sh = openAuthSheet_(CONFIG_SHEET_ID);
  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const keyIdx = header.indexOf("api_key");
  const roleIdx = header.indexOf("role");
  const activeIdx = header.indexOf("active");
  const userIdx = header.indexOf("user_name");

  const map = {};
  for (const row of data) {
    const key = (row[keyIdx] || "").toString().trim();
    const role = (row[roleIdx] || "").toString().trim().toLowerCase();
    const user_name = (row[userIdx] || "").toString().trim();
    const active = row[activeIdx] === true || row[activeIdx] === "TRUE";
    if (key && active) map[key] = { role, active, user_name };
  }
  return map;
}

/**
 * Parse auth info from Apps Script request.
 */
function isAuthed(e, CONFIG_SHEET_ID) {
  let key = "";

  try {
    if (e.parameter?.api_key) {
      key = e.parameter.api_key.trim();
    } else if (e.postData?.contents) {
      const body = JSON.parse(e.postData.contents || "{}");
      if (body.api_key) key = body.api_key.trim();
    } else if (e.headers?.Authorization) {
      key = e.headers.Authorization.replace("Bearer ", "").trim();
    }
  } catch (err) {
    debugLog("Auth parse error:", err);
  }

  if (!key) {
    debugLog("No api_key provided");
    return null;
  }

  const authMap = _readAuthMap_(CONFIG_SHEET_ID);
  debugLog("AuthMap keys:", Object.keys(authMap).join(","));

  const record = authMap[key];
  if (!record || !record.active) {
    debugLog(
      "Invalid or inactive key:",
      key,
      "CONFIG_SHEET_ID:",
      CONFIG_SHEET_ID,
    );
    return null;
  }

  return record; // { role, active, user }
}

/**
 * Check if request comes from an admin.
 */
function isAdmin(e, CONFIG_SHEET_ID) {
  const record = isAuthed(e, CONFIG_SHEET_ID);
  return record && record.role === "admin";
}

/**
 * Generate a new unique API key.
 */
function generateApiKey() {
  return Utilities.getUuid();
}

/**
 * Generate a new unique API key.
 */
function createAdmin(CONFIG_SHEET_ID) {
  const sheet = openAuthSheet_(CONFIG_SHEET_ID);
  const newKey = generateApiKey();

  sheet.appendRow([newKey, "admin", true, "admin_user", ""]);

  return { api_key: newKey, role: "admin" };
}

/**
 * Link device IDs to API keys (many-to-one).
 */
function registerDevice(apiKey, deviceId, CONFIG_SHEET_ID) {
  const sh = openAuthSheet_(CONFIG_SHEET_ID);
  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const keyIdx = header.indexOf("api_key");
  const devicesIdx = header.indexOf("devices");

  for (let i = 0; i < data.length; i++) {
    const key = (data[i][keyIdx] || "").trim();
    if (key === apiKey) {
      const existing = (data[i][devicesIdx] || "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      if (!existing.includes(deviceId)) {
        existing.push(deviceId);
        sh.getRange(i + 2, devicesIdx + 1).setValue(existing.join(","));
      }
      return { linked: true };
    }
  }
  return { message: "API key not found" };
}

/**
 * ──────────────────────────────────────────────
 * CashtrackLib
 * Config
 * ──────────────────────────────────────────────
 */

const CONFIG = {
  PRODUCTS: "Catalog",
  SHEET_IDS: "Sheets",
  AUTH: "Auth",
  PRODUCTS_COLUMNS: [
    "product_id",
    "name",
    "price",
    "unit_cost",
    "category",
    "product_type",
    "vendor",
    "active",
    "location_visibility",
    "image_url",
    "updated_at",
  ],
  SHEET_IDS_COLUMNS: ["sheet_id", "created_at"],
  TABS: ["SalesItems", "Expenses", "_Dedup"],
  AUTH_COLUMNS: ["api_key", "role", "active", "user_name", "devices"],
};

function openSheetById(id, name, columns) {
  const sheet = SpreadsheetApp.openById(id);
  const tab = sheet.getSheetByName(name) || sheet.insertSheet(name);
  if (tab.getLastRow() === 0) tab.appendRow(columns);
  return tab;
}

function openSheet(name, columns) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const tab = sheet.getSheetByName(name) || sheet.insertSheet(name);
  if (tab.getLastRow() === 0) tab.appendRow(columns);
  return tab;
}

function ensureRevenueOverviewV7_(ss) {
  const sheetName = "Revenue Overview";
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clear();

  const headerColor = "#1e293b";
  const bgLight = "#f8fafc";
  const borderColor = "#e2e8f0";
  const accentBlue = "#3b82f6";
  const accentGreen = "#10b981";

  // --- HEADER ---
  sheet.getRange("A1:P1").merge();
  sheet
    .getRange("A1")
    .setValue(
      "💹 CashTrack Revenue Overview — " +
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          "MMMM yyyy",
        ),
    )
    .setFontColor("#ffffff")
    .setBackground(headerColor)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setFontSize(14);

  // --- SUMMARY ---
  const summaryStart = 3;
  const summary = [
    ["💰 Total Sales", "=SUM(SalesItems!K2:K)"],
    ["📦 Total Items Sold", "=SUM(SalesItems!H2:H)"],
    ["💸 Total Expenses", "=SUM(Expenses!D2:D)"],
    ["🧾 Net Revenue", "=B3-B5"],
  ];
  sheet
    .getRange(`A${summaryStart}:B${summaryStart + summary.length - 1}`)
    .setValues(summary);
  const summaryRange = sheet.getRange(
    `A${summaryStart}:B${summaryStart + summary.length - 1}`,
  );
  summaryRange
    .setBackground(bgLight)
    .setBorder(
      true,
      true,
      true,
      true,
      false,
      false,
      borderColor,
      SpreadsheetApp.BorderStyle.SOLID,
    );
  sheet.getRange("B3").setNumberFormat("$#,##0");
  sheet.getRange("B4").setNumberFormat("#,##0");
  sheet.getRange("B5:B6").setNumberFormat("$#,##0");
  sheet
    .getRange("A6:B6")
    .setBackground("#dcfce7")
    .setFontWeight("bold")
    .setFontColor("#065f46");

  const totalSalesAbsRef = "$B$3";

  // --- PERFORMANCE SNAPSHOT (row 8) ---
  const snapshotRow = 8;
  const snapshotLabels = [
    "📆 Avg Daily Sales",
    "📈 Avg Weekly Sales",
    "💳 Avg Transaction Value",
    "🛒 Items per Sale",
  ];
  const snapshotFormulas = [
    // Avg Daily Sales
    "=IFERROR($B$3 / COUNTUNIQUE(ARRAYFORMULA(INT(SalesItems!L2:L))), 0)",
    // Avg Weekly Sales
    "=IFERROR($B$3 / COUNTUNIQUE(ARRAYFORMULA(ISOWeekNum(SalesItems!L2:L))), 0)",
    // Avg Transaction Value
    "=IFERROR($B$3 / COUNTUNIQUE(SalesItems!A2:A), 0)",
    // Items per Sale
    "=IFERROR($B$4 / COUNTUNIQUE(SalesItems!A2:A), 0)",
  ];

  const snapshotValues = snapshotLabels.map((label, i) => [
    label,
    snapshotFormulas[i],
  ]);
  sheet
    .getRange(`A${snapshotRow}:B${snapshotRow + snapshotLabels.length - 1}`)
    .setValues(snapshotValues);
  const snapshotRange = sheet.getRange(
    `A${snapshotRow}:B${snapshotRow + snapshotLabels.length - 1}`,
  );
  snapshotRange
    .setBackground("#f0fdf4")
    .setBorder(
      true,
      true,
      true,
      true,
      false,
      false,
      "#bbf7d0",
      SpreadsheetApp.BorderStyle.SOLID,
    );
  sheet
    .getRange(`B${snapshotRow}:B${snapshotRow + snapshotLabels.length - 1}`)
    .setNumberFormat("$#,##0");
  sheet.getRange(`B11`).setNumberFormat("#,##0");
  sheet
    .getRange(`A${snapshotRow}:A${snapshotRow + snapshotLabels.length - 1}`)
    .setFontWeight("bold");

  // //
  // // --- DAILY SALES TREND (helper sheet, fixed API) ---
  // // Place this after your summary and before the breakdowns
  // //
  // (function addDailyTrend() {
  //   const report = sheet;                      // your "Revenue Overview" sheet
  //   const ss = report.getParent();
  //   const helperName = "_TrendData";
  //   let helper = ss.getSheetByName(helperName);
  //   if (!helper) {
  //     helper = ss.insertSheet(helperName);
  //     helper.hideSheet();
  //   } else {
  //     helper.showSheet();  // clear() requires visible
  //   }
  //   helper.clear();

  //   // Headers
  //   helper.getRange(1, 1, 1, 2)
  //     .setValues([["Date", "Total Sales"]])
  //     .setFontWeight("bold")
  //     .setBackground("#f1f5f9");

  //   // Robust daily totals: INT() strips time so dates group per day
  //   helper.getRange(2, 1).setFormula(
  //     `=QUERY({ARRAYFORMULA(INT(SalesItems!L2:L)), SalesItems!K2:K},
  //       "select Col1, sum(Col2)
  //       where Col1 is not null
  //       group by Col1
  //       order by Col1
  //       label Col1 'Date', sum(Col2) 'Total Sales'", 0)`
  //   );

  //   SpreadsheetApp.flush();

  //   // Count actual populated rows (A2 downward should be contiguous)
  //   const last = helper.getLastRow();
  //   const n = Math.max(0, last - 1);
  //   if (n === 0) { helper.hideSheet(); return; }

  //   // Format
  //   helper.getRange(2, 1, n, 1).setNumberFormat("mmm d");
  //   helper.getRange(2, 2, n, 1).setNumberFormat("$#,##0");

  //   // Build chart on the REPORT sheet referencing helper range incl. header
  //   const dataRange = helper.getRange(1, 1, n + 1, 2);

  //   const chart = report.newChart()
  //     .asLineChart()
  //     .addRange(dataRange)
  //     .setNumHeaders(1) // <-- header row
  //     .setPosition(2, 5, 0, 0) // tweak placement
  //     .setOption("title", "📈 Daily Sales Trend")
  //     .setOption("legend", { position: "none" })
  //     .setOption("curveType", "function")
  //     .setOption("colors", ["#3b82f6"])
  //     .setOption("hAxis", { format: "MMM d", textStyle: { fontSize: 9 } })
  //     .setOption("vAxis", { format: "currency" })
  //     .build();

  //   report.insertChart(chart);
  //   helper.hideSheet(); // keep it tidy
  // })();

  // --- BREAKDOWNS (HORIZONTAL) ---
  const blockWidth = 4;
  const spacing = 1;
  let row = 13; // move down to make space for snapshot

  const sections = [
    { title: "Category", col: "E", color: accentBlue },
    { title: "Vendor", col: "F", color: "#6366f1" },
    { title: "Location", col: "G", color: "#f59e0b" },
    { title: "Top Products", col: "D", color: accentGreen, isProduct: true },
  ];

  sections.forEach((s, i) => {
    const startCol = 1 + i * (blockWidth + spacing);

    // Header for table
    const headerRow = row + 18;
    const headerRange = sheet.getRange(headerRow, startCol, 1, blockWidth);
    headerRange
      .setValues([["Name", "Total Sales", "Items Sold", "% of Sales"]])
      .setFontWeight("bold")
      .setBackground("#f1f5f9");

    // Query formula
    const dataRow = headerRow + 1;
    const query = s.isProduct
      ? `=QUERY(SalesItems!D2:K,
        "select D, sum(K), sum(H)
         where D is not null
         group by D
         order by sum(K) desc
         limit 10
         label sum(K) '', sum(H) ''", 0)`
      : `=QUERY(SalesItems!${s.col}2:K,
        "select ${s.col}, sum(K), sum(H)
         where ${s.col} is not null
         group by ${s.col}
         order by sum(K) desc
         label sum(K) '', sum(H) ''", 0)`;
    sheet.getRange(dataRow, startCol).setFormula(query);

    // % of Sales
    sheet
      .getRange(dataRow, startCol + 3, 40, 1)
      .setFormulaR1C1('=IF(RC[-2]<>"", RC[-2]/R3C2, "")')
      .setNumberFormat("0.0%");

    // Format totals
    sheet.getRange(dataRow, startCol + 1, 40, 1).setNumberFormat("$#,##0");
  });

  SpreadsheetApp.flush();

  // --- INSERT CHARTS ---
  const chartTopRow = row;
  sections.forEach((s, i) => {
    const startCol = 1 + i * (blockWidth + spacing);
    const dataRow = row + 18;
    const chartRange = sheet.getRange(dataRow + 1, startCol, 9, 2);

    const chart = sheet
      .newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(chartRange)
      .setPosition(chartTopRow, startCol, 0, 0)
      .setOption("title", `Sales by ${s.title}`)
      .setOption("legend", { position: "none" })
      .setOption("colors", [s.color])
      .setOption("hAxis", { textStyle: { fontSize: 9 }, slantedText: true })
      .setOption("vAxis", { format: "currency" })
      .build();

    sheet.insertChart(chart);
  });

  // --- STYLING ---
  sheet.getRange("A:P").setFontFamily("Roboto").setFontSize(10);
  sheet.autoResizeColumns(1, 16);
  sheet.setColumnWidth(6, 300);
  sheet.setColumnWidth(11, 300);
  sheet.setColumnWidth(16, 300);
  sheet.setFrozenRows(2);
  sheet.activate();
}

function createNewSalesSheet(SHEET_PREFIX, FOLDER_ID) {
  const now = new Date();
  const name = Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    "yyyy-MM",
  );

  // Create blank sheet and rename default tab
  const newSS = SpreadsheetApp.create(`${SHEET_PREFIX} ${name}`);
  const sheet1 = newSS.getSheets()[0];
  sheet1.setName("Sales");
  CONFIG.TABS.forEach((name) => {
    if (!newSS.getSheetByName(name)) {
      newSS.insertSheet(name);
    }
  });

  ensureRevenueOverviewV7_(newSS);

  // Append new ID to config
  const idsSheet = openSheet(CONFIG.SHEET_IDS, CONFIG.SHEET_IDS_COLUMNS);
  idsSheet.appendRow([newSS.getId(), new Date()]);

  if (FOLDER_ID && FOLDER_ID !== "") {
    const file = DriveApp.getFileById(newSS.getId());
    const folder = DriveApp.getFolderById(FOLDER_ID);
    file.moveTo(folder);
  }

  return newSS;
}

function getActiveSalesSheetID(CONFIG_SHEET_ID) {
  const id_sheet = openSheetById(
    CONFIG_SHEET_ID,
    CONFIG.SHEET_IDS,
    CONFIG.SHEET_IDS_COLUMNS,
  );

  // Grab latest active sheet ID
  const lastRow = id_sheet.getLastRow();
  if (lastRow < 2) return;

  const activeId = id_sheet.getRange(lastRow, 1).getValue();
  return activeId;
}

function openProductsSheet_() {
  return openSheet(CONFIG.PRODUCTS, CONFIG.PRODUCTS_COLUMNS);
}

function getProducts() {
  e = {};
  const sheet = openProductsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  // --- Read header and data ---
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet
    .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
    .getValues();

  // --- Build a column map dynamically (case-insensitive) ---
  const colIndex = {};
  header.forEach((h, i) => {
    const key = String(h).trim().toLowerCase();
    if (key) colIndex[key] = i;
  });

  // --- Read "since" parameter if present ---
  const since =
    (typeof e !== "undefined" && e.parameter && e.parameter.since) || "";

  // --- Map rows into product objects safely ---
  const products = data.map((r) => ({
    product_id: r[colIndex["product_id"]] || "",
    name: r[colIndex["name"]] || "",
    price: Number(r[colIndex["price"]] || 0),
    unit_cost: Number(r[colIndex["unit_cost"]] || 0),
    category: r[colIndex["category"]] || "",
    product_type: r[colIndex["product_type"]] || "",
    vendor: r[colIndex["vendor"]] || "",
    active: String(r[colIndex["active"]] || "").toLowerCase() !== "false",
    location_visibility: r[colIndex["location_visibility"]] || "*",
    image_url: r[colIndex["image_url"]] || "",
    updated_at: r[colIndex["updated_at"]] || "",
  }));

  // --- Optional filter by last update time ---
  return products.filter(
    (p) => !since || (p.updated_at && p.updated_at > since),
  );
}

function doGetProducts(e, CONFIG_SHEET_ID, FOLDER_ID, SHEET_PREFIX) {
  try {
    const auth = isAuthed(e, CONFIG_SHEET_ID);
    if (!auth) {
      return _res(401, { error: JSON.stringify(e) });
    }

    // Optional read key
    // if (CONFIG.SHARED_SECRET_READ) {
    //   const key = (e.parameter && e.parameter.key) || '';
    //   if (key !== CONFIG.SHARED_SECRET_READ) return _res(403, { error: 'unauthorized' });
    // }

    const products = getProducts(e);
    const activeSheetID =
      getActiveSalesSheetID(CONFIG_SHEET_ID) ||
      createNewSalesSheet(SHEET_PREFIX, FOLDER_ID).getId();
    const version = new Date().toISOString();

    return _res(200, {
      version,
      products,
      role: auth.role,
      user_name: auth.user_name,
      activeSheetID,
      configSheetID: CONFIG_SHEET_ID,
    });
  } catch (err) {
    return _res(500, { error: String(err) });
  }
}

// function createKey(body) {
//   const { requester_device_id, requester_api_key, role } = body;

//   // Require requester is admin
//   if (!isAdmin(requester_device_id, requester_api_key)) {
//     return _res(403);
//   }

//   const sheet = openAuthSheet_();
//   const newKey = generateApiKey();

//   sheet.appendRow([newKey, role || "employee", "active", 'user_name', '']);

//   return _res(200, { api_key: newKey, role: role || "employee" });
// }

// function revokeKey(body) {
//   const { requester_device_id, requester_api_key, target_api_key } = body;

//   if (!isAdmin(requester_device_id, requester_api_key)) {
//     return _res(403);
//   }

//   const sheet = openAuthSheet_();
//   const data = sheet.getDataRange().getValues();
//   const header = data.shift();
//   const keyIdx = header.indexOf("api_key");
//   const statusIdx = header.indexOf("status");

//   for (let r = 1; r < data.length; r++) {
//     if (data[r][keyIdx] === target_api_key) { // api_key col
//       sheet.getRange(r+1, statusIdx).setValue("revoked"); // status col
//       return _res(200);
//     }
//   }
//   return _res(404);
// }

// function listKeys(body) {
//   const { requester_device_id, requester_api_key } = body;

//   if (!isAdmin(requester_device_id, requester_api_key)) {
//     return _res(403);
//   }

//   const ss = SpreadsheetApp.getActiveSpreadsheet();
//   const sheet = ss.getSheetByName("Auth");
//   const data = sheet.getDataRange().getValues();

//   const out = [];
//   for (let r = 1; r < data.length; r++) {
//     out.push({
//       device_id: data[r][0],
//       api_key: data[r][1],
//       role: data[r][2],
//       status: data[r][3],
//     });
//   }
//   return _res(200, { keys: out });
// }

// modify config
function doPostConfig(e, CONFIG_SHEET_ID, FOLDER_ID, SHEET_PREFIX) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action;
    const auth = isAuthed(e, CONFIG_SHEET_ID);

    if ((SHARED_SECRET && body.key !== SHARED_SECRET) || !auth) {
      return _res(401, { error: "Unauthorized" });
    }

    if (action === "registerDevice") {
      const body = JSON.parse(e.postData.contents);
      const apiKey = (body.api_key || "").trim();
      const deviceId = (body.device_id || "").trim();

      if (!apiKey || !deviceId) {
        return _res(400, { error: "Missing api_key or device_id" });
      }

      const result = registerDevice(apiKey, deviceId, CONFIG_SHEET_ID);
      return _res(200, result);
    }

    // Sale logging
    if (action === "log_event") {
      return logEvent(body, CONFIG_SHEET_ID);
    }

    // Admin actions
    if (auth.role !== "admin") return _res(401, { error: "Unauthorized" });

    // if (action === "createKey") {
    //   return createKey(body);
    // }
    // if (action === "revokeKey") {
    //   return revokeKey(body);
    // }
    // if (action === "listKeys") {
    //   return listKeys(body);
    // }

    if (action === "createNewSheet") {
      const newSS = createNewSalesSheet(SHEET_PREFIX, FOLDER_ID);
      return _res(200, { activeSheetID: newSS.getId() });
    }

    return _res(400, { error: "unknown action" });
  } catch (err) {
    return _res(500, { error: String(err) });
  }
}

/**
 * ──────────────────────────────────────────────
 * CashtrackLib
 * Sales
 * ──────────────────────────────────────────────
 */
const SALES_CONFIG = {
  SHEET_IDS_TAB: "Sheets",
  SALES: "Sales",
  ITEMS: "SalesItems",
  EXPENSES: "Expenses",
  DEDUP: "_Dedup",
  SALES_COLUMNS: [
    "sale_id",
    "date",
    "location",
    "item_count",
    "discount_pct",
    "total_before_discount",
    "discount",
    "total_after_discount",
    "note",
    "device_id",
    "app_version",
    "payment_type",
  ],
  ITEMS_COLUMNS: [
    "sale_id",
    "line_no",
    "product_id",
    "name",
    "category",
    "vendor",
    "location",
    "quantity",
    "unit_price",
    "discount_pct",
    "line_total",
    "date",
    "payment_type",
  ],
  EXPENSE_COLUMNS: [
    "event_id",
    "date",
    "location",
    "amount",
    "note",
    "device_id",
    "app_version",
  ],
  DEDUP_COLUMNS: ["event_id"],
};

function getActiveSalesSheet(CONFIG_SHEET_ID) {
  const activeSheet = SpreadsheetApp.openById(
    getActiveSalesSheetID(CONFIG_SHEET_ID),
  );
  return activeSheet;
}

function getSalesSheet(sheet) {
  const s =
    sheet.getSheetByName(SALES_CONFIG.SALES) ||
    sheet.insertSheet(SALES_CONFIG.SALES);
  if (s.getLastRow() === 0) s.appendRow(SALES_CONFIG.SALES_COLUMNS);
  return s;
}

function getItemsSheet(sheet) {
  const s =
    sheet.getSheetByName(SALES_CONFIG.ITEMS) ||
    sheet.insertSheet(SALES_CONFIG.ITEMS);
  if (s.getLastRow() === 0) s.appendRow(SALES_CONFIG.ITEMS_COLUMNS);
  return s;
}

function getDedupeSheet(sheet) {
  const s =
    sheet.getSheetByName(SALES_CONFIG.DEDUP) ||
    sheet.insertSheet(SALES_CONFIG.DEDUP);
  if (s.getLastRow() === 0) s.appendRow(SALES_CONFIG.DEDUP_COLUMNS);
  return s;
}

function getExpenseSheet(sheet) {
  const s =
    sheet.getSheetByName(SALES_CONFIG.EXPENSES) ||
    sheet.insertSheet(SALES_CONFIG.EXPENSE_COLUMNS);
  if (s.getLastRow() === 0) s.appendRow(SALES_CONFIG.EXPENSE_COLUMNS);
  return s;
}

function doPostSale(e, CONFIG_SHEET_ID) {
  try {
    const body = JSON.parse(e.postData.contents);
    const auth = isAuthed(e, CONFIG_SHEET_ID);

    // Secret via query OR body OR header (pick one in production)
    const key =
      (e.parameter && e.parameter.key) ||
      body.key ||
      (e.headers && e.headers["x-shared-secret"]);
    if ((SHARED_SECRET && body.key !== SHARED_SECRET) || !auth) {
      return _res(401, { error: "Unauthorized" });
    }

    const data = body.data || {};
    if (!data.kind) return _res(400, { error: "missing attribute kind" });
    const kind = data.kind;
    const uuid = data.local_event_id;

    if (!uuid) {
      return _res(422, { error: "Missing UUID" });
    }

    // --- Lock to avoid concurrent appends --- might be unnecessary
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);

    try {
      const ss = getActiveSalesSheet(CONFIG_SHEET_ID);
      const dedupeSheet = getDedupeSheet(ss);
      const values = dedupeSheet.getRange("A:A").getValues().flat();
      if (values.includes(uuid)) return _res(200, { message: "duplicate" });

      // Append to correct sheet
      if (kind === "sale") {
        const discountPct = Math.max(
          0,
          Math.min(100, Number(data.discount_pct || 0)),
        );
        const lines = (data.line_items || []).map((li, idx) => {
          const quantity = Math.max(1, Number(li.quantity || 1));
          const unit = Math.max(0, Number(li.unit_price || 0));
          const gross = unit * quantity;
          const net = Math.round((gross * (100 - discountPct)) / 100);
          return {
            line_no: idx + 1,
            product_id: String(li.product_id || ""),
            name: String(li.name || ""),
            category: String(li.category || ""),
            vendor: String(li.vendor || ""),
            location: String(li.location || ""),
            date: new Date(li.timestamp),
            quantity,
            payment_type: String(li.payment_type || ""),
            unit,
            gross,
            net,
          };
        });

        const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
        const totalBefore = lines.reduce((n, l) => n + l.gross, 0);
        const discount = totalBefore - data.amount;

        const sheet = getSalesSheet(ss);
        const items = getItemsSheet(ss);
        sheet.appendRow([
          uuid,
          new Date(data.timestamp_utc),
          data.location,
          itemCount,
          discountPct,
          totalBefore,
          discount,
          data.amount,
          data.note || "",
          data.device_id,
          data.app_version || "",
          data.payment_type || "test",
        ]);

        // --- write item rows ---
        if (lines.length) {
          const rows = lines.map((l) => [
            uuid,
            l.line_no,
            l.product_id,
            l.name,
            l.category,
            l.vendor,
            l.location,
            l.quantity,
            l.unit,
            discountPct,
            l.net,
            l.date,
            l.payment_type,
          ]);
          items
            .getRange(items.getLastRow() + 1, 1, rows.length, rows[0].length)
            .setValues(rows);
        }
      } else if (kind === "customSale") {
        const sheet = getSalesSheet(ss);
        sheet.appendRow([
          uuid,
          new Date(data.timestamp_utc),
          data.location,
          1, //items count
          0, //discount pct
          data.amount, //total before
          0, //discount
          data.amount,
          data.note || "",
          data.device_id,
          data.app_version || "",
          data.payment_type || "",
        ]);

        const items = getItemsSheet(ss);
        const row = [
          uuid,
          1, // line_no
          "CUSTOM_SALE", // product_id
          "CUSTOM", // name
          "CUSTOM", // category
          "CUSTOM", // vendor
          data.location,
          1, // qty
          data.amount, // unit_price
          0, // discount
          data.amount, // line total
          new Date(data.timestamp_utc), // date
          data.payment_type,
        ];
        items
          .getRange(items.getLastRow() + 1, 1, 1, row.length)
          .setValues([row]); // use same .setValues as above
      } else if (kind === "expense") {
        const sheet = getExpenseSheet(ss);
        sheet.appendRow([
          uuid,
          new Date(data.timestamp_utc),
          data.location,
          data.amount,
          data.note || "",
          data.device_id,
          data.app_version || "",
        ]);
      }

      // Record UUID in Dedupes
      dedupeSheet.appendRow([uuid]);

      return _res(200, { message: "save success" });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return _res(500, { error: err.message });
  }
}

function logEvent(body = {}, CONFIG_SHEET_ID) {
  try {
    const data = body.data || {};
    if (!data.kind) return _res(400, { error: "missing attribute kind" });
    const kind = data.kind;
    const uuid = data.local_event_id;

    if (!uuid) {
      return _res(422, { error: "Missing UUID" });
    }

    // --- Lock to avoid concurrent appends --- might be unnecessary
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);

    try {
      const ss = getActiveSalesSheet(CONFIG_SHEET_ID);
      const dedupeSheet = getDedupeSheet(ss);
      const values = dedupeSheet.getRange("A:A").getValues().flat();
      if (values.includes(uuid)) return _res(200, { message: "duplicate" });

      // Append to correct sheet
      if (kind === "sale") {
        const discountPct = Math.max(
          0,
          Math.min(100, Number(data.discount_pct || 0)),
        );
        const lines = (data.line_items || []).map((li, idx) => {
          const quantity = Math.max(1, Number(li.quantity || 1));
          const unit = Math.max(0, Number(li.unit_price || 0));
          const gross = unit * quantity;
          const net = Math.round((gross * (100 - discountPct)) / 100);
          return {
            line_no: idx + 1,
            product_id: String(li.product_id || ""),
            name: String(li.name || ""),
            category: String(li.category || ""),
            vendor: String(li.vendor || ""),
            location: String(li.location || ""),
            date: new Date(li.timestamp),
            quantity,
            payment_type: String(li.payment_type),
            unit,
            gross,
            net,
          };
        });

        const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
        const totalBefore = lines.reduce((n, l) => n + l.gross, 0);
        const discount = totalBefore - data.amount;

        const sheet = getSalesSheet(ss);
        const items = getItemsSheet(ss);
        sheet.appendRow([
          uuid,
          new Date(data.timestamp_utc),
          data.location,
          itemCount,
          discountPct,
          totalBefore,
          discount,
          data.amount,
          data.note || "",
          data.device_id,
          data.app_version || "",
          data.payment_type || "",
        ]);

        // --- write item rows ---
        if (lines.length) {
          const rows = lines.map((l) => [
            uuid,
            l.line_no,
            l.product_id,
            l.name,
            l.category,
            l.vendor,
            l.location,
            l.quantity,
            l.unit,
            discountPct,
            l.net,
            l.date,
            l.payment_type,
          ]);
          items
            .getRange(items.getLastRow() + 1, 1, rows.length, rows[0].length)
            .setValues(rows);
        }
      } else if (kind === "customSale") {
        const sheet = getSalesSheet(ss);
        sheet.appendRow([
          uuid,
          new Date(data.timestamp_utc),
          data.location,
          1, //items count
          0, //discount pct
          data.amount, //total before
          0, //discount
          data.amount,
          data.note || "",
          data.device_id,
          data.app_version || "",
          data.payment_type || "",
        ]);

        const items = getItemsSheet(ss);
        const row = [
          uuid,
          1, // line_no
          "CUSTOM_SALE", // product_id
          "CUSTOM", // name
          "CUSTOM", // category
          "CUSTOM", // vendor
          data.location,
          1, // qty
          data.amount, // unit_price
          0, // discount
          data.amount, // line total
          new Date(data.timestamp_utc), // date
          data.payment_type || "",
        ];
        items
          .getRange(items.getLastRow() + 1, 1, 1, row.length)
          .setValues([row]); // use same .setValues as above
      } else if (kind === "expense") {
        const sheet = getExpenseSheet(ss);
        sheet.appendRow([
          uuid,
          new Date(data.timestamp_utc),
          data.location,
          data.amount,
          data.note || "",
          data.device_id,
          data.app_version || "",
        ]);
      }

      // Record UUID in Dedupes
      dedupeSheet.appendRow([uuid]);

      return _res(200, { message: "save success" });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return _res(500, { error: err.message });
  }
}

function withSheetLock(sheetId, fn) {
  const globalLock = LockService.getScriptLock();
  globalLock.waitLock(5000);

  const cache = CacheService.getScriptCache();
  const key = `lock_${sheetId}`;
  const myToken = Utilities.getUuid();

  try {
    // 1️⃣ Check if sheet is already locked
    if (cache.get(key)) {
      throw new Error(`Sheet ${sheetId} is busy`);
    }

    // 2️⃣ Mark it as locked
    cache.put(key, myToken, 30); // lock expires after 30s
  } finally {
    // 🔓 Release global lock so other sheets can set theirs
    globalLock.releaseLock();
  }

  try {
    // 3️⃣ Run your operation safely
    const result = fn();
    return result;
  } finally {
    // 4️⃣ Verify and release this sheet’s cache lock
    const current = cache.get(key);
    if (current === myToken) cache.remove(key);
  }
}
