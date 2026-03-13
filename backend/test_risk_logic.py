
import re

def extract_risk_info(value_str):
    risk_level = 1
    risk_color = "green"
    
    tol_match = re.search(r'(?:±|\+/-)\s*(\d*\.?\d+)', value_str)
    gdt_match = re.search(r'(?:\|| )(\d\.\d+)(?:\|| )', value_str)
    
    tolerance_value = None
    if tol_match:
        try:
            tolerance_value = float(tol_match.group(1))
        except: pass
    elif gdt_match:
        try:
            tolerance_value = float(gdt_match.group(1))
        except: pass
    
    if tolerance_value is None:
        val_match = re.search(r'(\d+\.\d+)', value_str)
        if val_match:
            decimal_part = val_match.group(1).split('.')[1]
            decimal_count = len(decimal_part)
            if decimal_count >= 2:
                tolerance_value = 0.01 if decimal_count == 2 else 0.001
            else:
                tolerance_value = 0.1
        else:
            if re.search(r'^\d+$', value_str.strip()):
                tolerance_value = 0.5

    if tolerance_value is not None:
        if tolerance_value < 0.05:
            risk_level = 3
            risk_color = "#ef4444"
        elif tolerance_value < 0.1:
            risk_level = 2
            risk_color = "#f59e0b"
        else:
            risk_level = 1
            risk_color = "#22c55e"
    else:
        risk_level = 1
        risk_color = "#22c55e"
    
    return risk_level, risk_color

test_cases = [
    ("50 ± 0.1", "green"),
    ("50 ± 0.04", "#ef4444"),
    ("50.00", "#ef4444"), # 2 decimals -> 0.01 tol
    ("110.1", "#22c55e"), # 1 decimal -> 0.1 tol
    ("20", "#22c55e"),    # 0 decimals -> 0.5 tol
    ("[⌖|0.03|A|B]", "#ef4444")
]

for val, expected in test_cases:
    lvl, col = extract_risk_info(val)
    print(f"Val: {val:15} | Risk: {lvl} | Color: {col} | Expected: {expected}")
    assert col == expected
