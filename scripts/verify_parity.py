import json
import re
import os
import glob

# 1. Load tools_schema.json
with open("crates/browser-mcp-server/tools_schema.json", "r", encoding="utf-8") as f:
    schema = json.load(f)

schema_names = [t["name"] for t in schema]
unprefixed_schema = [n.replace("browser_", "") for n in schema_names]

print(f"1. tools_schema.json tool count: {len(schema_names)}")
assert len(schema_names) == 43, f"Expected 43 tools, got {len(schema_names)}"

# 2. Check Rust src/tools.rs
with open("crates/browser-mcp-server/src/tools.rs", "r", encoding="utf-8") as f:
    rust_code = f.read()

rust_tools = re.findall(r'm\.insert\("([^"]+)"', rust_code)
print(f"2. Rust METHOD_MAP tool count: {len(rust_tools)}")
assert set(schema_names) == set(rust_tools), f"Mismatch between schema and Rust METHOD_MAP: {set(schema_names) ^ set(rust_tools)}"

# 3. Check extension/background.js dispatch cases
with open("extension/background.js", "r", encoding="utf-8") as f:
    bg_code = f.read()

# Extract dispatch switch block
dispatch_match = re.search(r"async function dispatch\(port, method, params\)\s*\{(.*?)\n\s*default:", bg_code, re.DOTALL)
if not dispatch_match:
    raise RuntimeError("Could not find dispatch function in background.js")

dispatch_body = dispatch_match.group(1)
bg_dispatch_cases = set(re.findall(r"case\s+['\"]([^'\"]+)['\"]\s*:", dispatch_body))

local_tools = {"about", "provide_feedback"}
expected_in_bg = set(unprefixed_schema) - local_tools

print(f"3. Extension dispatch expected tools: {len(expected_in_bg)}")
print(f"   Actual matching cases in dispatch: {len(expected_in_bg & bg_dispatch_cases)}")

missing_in_bg = expected_in_bg - bg_dispatch_cases
if missing_in_bg:
    print(f"   [FAIL] Missing in extension background.js dispatch: {missing_in_bg}")
else:
    print(f"   [PASS] All {len(expected_in_bg)} routed tools implemented in background.js dispatch")

# 4. Check docs
doc_files = glob.glob("docs/**/*.html", recursive=True) + glob.glob("content/*.md")
print(f"4. Checked docs files count: {len(doc_files)}")
