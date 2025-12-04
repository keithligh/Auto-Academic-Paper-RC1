
import mammoth from "mammoth";
import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "uploads", "1764836887416-pn4ypc9x7");

async function testExtraction() {
    console.log(`Testing extraction for: ${filePath}`);
    if (!fs.existsSync(filePath)) {
        console.error("File not found!");
        return;
    }

    try {
        const result = await mammoth.extractRawText({ path: filePath });
        console.log(`Extraction Result:`);
        console.log(`Value length: ${result.value.length}`);
        console.log(`Messages:`, result.messages);
        if (result.value.length < 100) {
            console.log("Content:", result.value);
        } else {
            console.log("Content preview:", result.value.substring(0, 100));
        }
    } catch (error) {
        console.error("Extraction failed:", error);
    }
}

testExtraction();
