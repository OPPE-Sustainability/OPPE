import urllib.request

URL = "https://mahidol.ac.th/aqireport/data/APM.json"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/122.0.0.0 Safari/537.36",
    "Referer": "https://mahidol.ac.th/aqireport/"
}

try:
    req = urllib.request.Request(URL, headers=headers)

    with urllib.request.urlopen(req, timeout=15) as response:
        print("HTTP STATUS:", response.status)
        print("SERVER:", response.headers.get("Server"))
        print("CONTENT-TYPE:", response.headers.get("Content-Type"))

        data = response.read()

        print("SIZE:", len(data))
        print(data[:500].decode("utf-8", errors="replace"))

except Exception as e:
    print("ERROR:", repr(e))