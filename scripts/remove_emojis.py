# -*- coding: utf-8 -*-
"""
PRINCE ALEX DIGITAL HMS — Emoji Removal Script
Replaces all emoji icons in HTML files with inline SVG icons.
"""
import os
import re
import glob

# Emoji to SVG path mapping (Feather Icons style - stroke-based)
EMOJI_MAP = {
    # Dashboard / Stats
    "📊": "dashboard",
    "📈": "reports",
    "💰": "money",
    "📅": "appointments",
    "👥": "users",
    "🏨": "admissions",
    "🏥": "hospitals",
    "🛏️": "beds",
    "🔬": "laboratory",
    "💊": "pharmacy",
    "🧾": "invoices",
    "🔔": "bell",
    "⚠️": "warning",
    "⚙️": "settings",
    "🖥️": "admin",
    "💳": "payments",
    "📋": "lab-orders",
    "📄": "receipts",
    "📦": "inventory",
    "🏭": "suppliers",
    "🛒": "purchase-orders",
    "🏖️": "leave",
    "📜": "audit-logs",
    "💎": "plans",
    "🌡️": "vitals",
    "🩺": "consultation",
    "🏢": "wards",
    "💉": "medicines",
    "📝": "prescriptions",
    "👨‍⚕️": "staff",
    "🔥": "firebase",
    "🎨": "design",
    "⚡": "zap",
    "📄": "file",
    "❓": "help",
    "✏️": "edit",

    # Buttons / Actions (shortcodes)
    "➕": "plus",
    "✅": "check",
    "✕": "close",
    "←": "back",
    "🔍": "search",
    "🔄": "refresh",
}

# SVG path definitions (Feather-style)
ICON_PATHS = {
    "dashboard": '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    "reports": '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    "money": '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    "appointments": '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    "users": '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    "admissions": '<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/>',
    "hospitals": '<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>',
    "beds": '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
    "laboratory": '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M8 3h8"/><path d="M10 3v6a4 4 0 0 1-4 4h12a4 4 0 0 1-4-4V3"/>',
    "pharmacy": '<path d="M10.5 20h3a6.5 6.5 0 0 0 0-13h-3a6.5 6.5 0 0 0 0 13z"/><path d="M12 7v13"/>',
    "invoices": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    "bell": '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    "warning": '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    "admin": '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    "payments": '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    "lab-orders": '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    "receipts": '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="16" y2="15"/>',
    "inventory": '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/><line x1="12" y1="13" x2="12" y2="21"/>',
    "suppliers": '<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>',
    "purchase-orders": '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    "leave": '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
    "audit-logs": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    "plans": '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
    "vitals": '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    "consultation": '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    "wards": '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    "medicines": '<path d="M10.5 20h3a6.5 6.5 0 0 0 0-13h-3a6.5 6.5 0 0 0 0 13z"/><path d="M12 7v13"/><path d="M9 7V3h6v4"/>',
    "prescriptions": '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    "staff": '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    "firebase": '<path d="M4.5 16.5L7 2l3.5 5.5L13 2l2.5 5.5L22 16.5H4.5z"/><path d="M4.5 16.5L22 16.5l-6 5H10.5l-6-5z"/>',
    "design": '<circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/>',
    "zap": '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    "file": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    "help": '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    "edit": '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    "plus": '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    "check": '<polyline points="20 6 9 17 4 12"/>',
    "close": '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    "back": '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    "search": '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    "refresh": '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
}

def make_svg(icon_name, size="18", cls="icon-svg"):
    """Generate inline SVG string for an icon."""
    paths = ICON_PATHS.get(icon_name, ICON_PATHS["help"])
    cls_attr = f' class="{cls}"' if cls else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
            f'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round"{cls_attr}>{paths}</svg>')


def replace_emojis_in_file(filepath):
    """Replace all emojis in a file with SVG icons."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    count = 0

    # Sort emojis by length (longest first) to handle multi-codepoint emojis
    for emoji in sorted(EMOJI_MAP.keys(), key=len, reverse=True):
        if emoji in content:
            icon_name = EMOJI_MAP[emoji]
            # Determine size based on context
            svg = make_svg(icon_name)
            occurrences = content.count(emoji)
            count += occurrences
            content = content.replace(emoji, svg)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return count
    return 0


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    html_files = glob.glob(os.path.join(root, '**', '*.html'), recursive=True)
    # Exclude node_modules
    html_files = [f for f in html_files if 'node_modules' not in f]

    total = 0
    changed = []
    for filepath in html_files:
        n = replace_emojis_in_file(filepath)
        if n > 0:
            changed.append((os.path.relpath(filepath, root), n))
            total += n

    print(f"Total emojis replaced: {total}")
    print("Files changed:")
    for f, n in changed:
        print(f"  {f}: {n}")


if __name__ == "__main__":
    main()