// Deletes the local demo database (data/db.json) so you can record a clean demo.
import fs from "fs";
fs.rmSync("data/db.json", { force: true });
console.log("Local demo data cleared.");
