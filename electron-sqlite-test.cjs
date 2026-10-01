console.log("=== TEST START ===");
console.log("Electron:", process.versions.electron);
console.log("Node:", process.versions.node);

console.log("Loading better-sqlite3...");

const Database = require("better-sqlite3");

console.log("better-sqlite3 loaded successfully!");
console.log("Opening test database...");

const db = new Database(":memory:");

console.log("SQLite database opened successfully!");

const result = db.prepare("SELECT 1 AS test").get();

console.log("SQLite result:", result);

db.close();

console.log("=== TEST PASSED ===");
process.exit(0);
