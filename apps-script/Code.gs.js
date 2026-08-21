const CONFIG_SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const FOLDER_ID = "";
const SHEET_PREFIX = "";
const ENV_NAME = "";

/**
 * Installs all required time-based triggers for CashTrack.
 * Call this once manually after transferring ownership or first deployment.
 */
function installTriggers() {
  // First, clear any old triggers (so you don't get duplicates)
  const existing = ScriptApp.getProjectTriggers();
  existing.forEach((t) => ScriptApp.deleteTrigger(t));

  // 1️⃣ Monthly rotation — runs on the 1st of each month at 8 AM
  ScriptApp.newTrigger("autoRotateSheet")
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();

  Logger.log("✅ CashTrack triggers installed successfully");
}

function createNewSalesSheet() {
  return CashtrackLib.createNewSalesSheet(SHEET_PREFIX, FOLDER_ID);
}

function autoRotateSheet() {
  createNewSalesSheet();
}

function _res(code, obj = {}) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: code, ...obj }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function createAdmin() {
  const record = CashtrackLib.createAdmin(CONFIG_SHEET_ID);
  return _res(200, record);
}

function doGet(e) {
  return CashtrackLib.doGetProducts(
    e,
    CONFIG_SHEET_ID,
    FOLDER_ID,
    SHEET_PREFIX,
  );
}

function doPost(e) {
  return CashtrackLib.doPostConfig(e, CONFIG_SHEET_ID, FOLDER_ID, SHEET_PREFIX);
}
