# Print "<udid> <iOS version>" for an available iPhone 17 simulator, creating one on the newest iOS runtime if needed.
import json
import subprocess
import sys

j = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "-j"]))
runtimes = [r for r in j["runtimes"] if r.get("platform") == "iOS" and r.get("isAvailable")]
runtimes.sort(key=lambda r: [int(x) for x in r["version"].split(".")])
for rt in reversed(runtimes):
    for d in j["devices"].get(rt["identifier"], []):
        if d["name"] == "iPhone 17" and d.get("isAvailable"):
            print(d["udid"], rt["version"])
            sys.exit(0)
types = [t for t in j["devicetypes"] if t["name"] == "iPhone 17"]
if not types or not runtimes:
    sys.exit("No iPhone 17 device type or iOS runtime on this runner")
udid = subprocess.check_output(["xcrun", "simctl", "create", "iPhone 17", types[0]["identifier"], runtimes[-1]["identifier"]]).decode().strip()
print(udid, runtimes[-1]["version"])
