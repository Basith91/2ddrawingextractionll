
def log_debug(msg):
    try:
        with open("backend_debug.log", "a", encoding="utf-8") as f:
            import datetime
            timestamp = datetime.datetime.now().isoformat()
            f.write(f"[{timestamp}] {msg}\n")
        print("Log written successfully")
    except Exception as e:
        print(f"Log failed: {e}")

log_debug("Test log entry")
