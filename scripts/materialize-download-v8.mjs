import fs from "node:fs";

const workflowPath = ".github/workflows/windows-quality.yml";
const contractPath = "scripts/test-workflow-contracts.mjs";
const copyPath = "scripts/windows-quality-download-v8.yml";
const oldUse = "actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7";
const newUse = "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1";
const oldPin = '["download-artifact", "37930b1c2abaa49bbe596cd826c3c89aef350131"]';
const newPin = '["download-artifact", "3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c"]';

const workflow = fs.readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
if ((workflow.match(new RegExp(oldUse.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length !== 1) {
  throw new Error("Expected exactly one download-artifact v7 pin");
}
const updatedWorkflow = workflow.replace(oldUse, newUse);
fs.writeFileSync(copyPath, updatedWorkflow);

const contract = fs.readFileSync(contractPath, "utf8").replace(/\r\n/g, "\n");
if ((contract.match(new RegExp(oldPin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length !== 1) {
  throw new Error("Expected exactly one approved download-artifact v7 pin");
}
fs.writeFileSync(contractPath, contract.replace(oldPin, newPin));

fs.writeFileSync(workflowPath, updatedWorkflow);
console.log("download-artifact v8.0.1 materialized");
