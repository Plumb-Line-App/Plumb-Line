# Drive real Mobile Safari in the iOS Simulator through safaridriver: the slip → Honest Script flow.
import os
import time

from selenium import webdriver
from selenium.webdriver.common.by import By

URL = os.environ["URL"].split("#")[0]
OUT = os.environ.get("OUT", "results/webdriver")
os.makedirs(OUT, exist_ok=True)
results = []


def check(cond, msg):
    results.append(("PASS " if cond else "FAIL ") + msg)
    print(results[-1], flush=True)


opts = webdriver.SafariOptions()
opts.set_capability("platformName", "iOS")
opts.set_capability("safari:useSimulator", True)
opts.set_capability("safari:deviceUDID", os.environ["UDID"])
d = webdriver.Safari(options=opts)
try:
    d.get(URL + "#today")
    time.sleep(4)
    d.execute_script("localStorage.clear()")
    d.get(URL + "?fresh=1#today")
    time.sleep(4)
    print("UA:", d.execute_script("return navigator.userAgent"))
    print("viewport:", d.execute_script("return [innerWidth, innerHeight, devicePixelRatio]"))
    check(d.execute_script("return !!(window.VT && VT.app)"), "app booted in Mobile Safari")
    check(d.execute_script("return CSS.supports('color', 'color-mix(in srgb, red 50%, blue)')"), "color-mix supported")
    check(
        d.execute_script("return document.documentElement.scrollWidth <= document.documentElement.clientWidth"),
        "no sideways scroll on Today",
    )
    d.save_screenshot(f"{OUT}/01-today.png")
    d.find_element(By.ID, "door-slip").click()
    time.sleep(2.5)
    check(d.execute_script("return location.hash") == "#script", "slip opens the Honest Script")
    check(d.find_element(By.ID, "window-card").get_attribute("data-state") == "running", "window is running")
    t1 = d.find_element(By.ID, "ring-time").text
    time.sleep(2)
    t2 = d.find_element(By.ID, "ring-time").text
    check(t1 != t2, f"ring counts down ({t1} -> {t2})")
    d.save_screenshot(f"{OUT}/02-script.png")
    d.execute_script("document.getElementById('predict-card').scrollIntoView({block: 'center'})")
    time.sleep(0.5)
    d.find_element(By.ID, "told-btn").click()
    time.sleep(1)
    check(d.find_element(By.ID, "victory").is_displayed(), "double victory shows")
    d.save_screenshot(f"{OUT}/03-victory.png")
    d.find_element(By.ID, "victory-done").click()
    time.sleep(2)
    check(d.execute_script("return location.hash") == "#progress", "save goes to Progress")
    check(d.execute_script("return document.querySelectorAll('#fear-chart svg').length") == 1, "fear chart drawn")
    d.save_screenshot(f"{OUT}/04-progress.png")
finally:
    with open(f"{OUT}/results.txt", "w") as f:
        f.write("\n".join(results) + "\n")
    d.quit()
