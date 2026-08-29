import urllib.request
import json
import time

RUN_ID = 33271313661
URL = f"https://api.github.com/repos/layal113/S3/actions/runs/{RUN_ID}/jobs"

for attempt in range(12):
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            jobs = data.get("jobs", [])
            print(f"=== Check Attempt {attempt + 1} ===")
            all_done = True
            for job in jobs:
                name = job.get("name")
                status = job.get("status")
                conclusion = job.get("conclusion")
                print(f"  Job: {name:<35} | Status: {status:<12} | Conclusion: {conclusion}")
                if status != "completed":
                    all_done = False
            if all_done and jobs:
                print("\nALL JOBS COMPLETED!")
                break
    except Exception as e:
        print("Error fetching jobs:", e)
    time.sleep(10)
