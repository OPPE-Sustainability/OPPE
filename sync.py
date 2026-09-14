import urllib.request
import json

APM_URL = "https://mahidol.ac.th/aqireport/data/APM.json"
GAS_URL = "https://script.google.com/macros/s/AKfycbyG1aEjY8weKwDRxyM2Wj_jO8UScw_wD7gcpgcKJzUjdYRykAQEs8VzVExlWqOtTY3NUA/exec"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Referer": "https://mahidol.ac.th/aqireport/"
}

try:
    req = urllib.request.Request(APM_URL, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as response:
        data = json.loads(response.read().decode("utf-8"))
        print(f"Fetch APM.json success: {len(data)} items")

    payload = json.dumps({"action": "sync_air_data", "airData": data}).encode("utf-8")
    post_req = urllib.request.Request(GAS_URL, data=payload, headers={"Content-Type": "text/plain"})
    with urllib.request.urlopen(post_req, timeout=15) as post_res:
        print("Relayed to Apps Script:", post_res.read().decode("utf-8"))

except Exception as e:
    print("Sync failed:", str(e))