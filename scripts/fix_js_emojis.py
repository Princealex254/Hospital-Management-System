import os
import re

root = r"c:\Users\Alex Senerwa\Desktop\In Progresss\Hospital"

files = [
    "js/beds.js", "js/inventory.js", "js/invoices.js", "js/leave.js",
    "js/medicines.js", "js/staff.js", "js/suppliers.js", "js/wards.js",
    "js/payments.js", "js/purchase-orders.js", "js/stock-movements.js",
    "js/attendance.js"
]

# Map emoji -> icon name
emoji_map = {
    "\U0001F3D6": "leave",      # 🏖️
    "\U0001F9FE": "invoices",   # 🧾
    "\U0001F4B3": "payments",   # 💳
    "\U0001F441": "eye",        # 👁️
    "\U0001F48A": "medicines",  # 💊
    "\u270F": "edit",           # ✏️
    "\U0001F5D1": "trash",      # 🗑️
    "\U0001F4E6": "inventory",  # 📦
    "\U0001F4CB": "lab-orders", # 📋
    "\U0001F6CF": "beds",       # 🛏️
    "\U0001F3ED": "suppliers",  # 🏭
    "\U0001F465": "patients",   # 👥
    "\U0001F3E2": "wards",      # 🏢
    "\u2713": "check",          # ✓
    "\u2715": "close",          # ✕
    "\uFE0F": "",               # variation selector
}

for f in files:
    path = os.path.join(root, f)
    with open(path, "r", encoding="utf-8") as fh:
        content = fh.read()

    changed = False

    # Add icon import if missing
    if "icons.js" not in content:
        # Find the debug import line and add icon import after it
        pattern = r'(import \{ debug, debugError \} from "\./debug\.js";)'
        if re.search(pattern, content):
            content = re.sub(
                pattern,
                r'\1\nimport { icon } from "./icons.js";',
                content
            )
            changed = True

    # Replace emojis
    for emoji, icon_name in emoji_map.items():
        if emoji in content:
            if icon_name:
                content = content.replace(
                    emoji,
                    "${icon('" + icon_name + "', '18', 'icon-svg')}"
                )
            else:
                content = content.replace(emoji, "")
            changed = True

    if changed:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)
        print(f"Updated: {f}")
    else:
        print(f"No changes: {f}")

print("Done!")