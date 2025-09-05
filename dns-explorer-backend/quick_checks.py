import requests, json, sys

BASE = "https://dns-explorer.onrender.com"

def fetch(path, **params):
    r = requests.get(f"{BASE}{path}", params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def print_steps(tag, data):
    print(f"\n== {tag} ==")
    for h in data.get("trace", []):
        ans_types = ",".join([a["rdtype"] for a in h.get("answer", [])]) if h.get("answer") else ""
        print(f"step {h.get('step')} | {h.get('server')} | rtt={h.get('rtt_ms')}ms | ans={ans_types} | err={h.get('error')}")

def assert_monotonic_steps(data):
    steps = [h.get("step") for h in data.get("trace", []) if isinstance(h.get("step"), int)]
    assert steps == list(range(1, len(steps)+1)), f"non-monotonic steps: {steps}"

def main():
    # A) Google A cold
    g_cold = fetch("/resolve", name="www.google.com", type="A", cache="off")
    print_steps("google A (cold)", g_cold)
    assert g_cold["summary"]["final_ips"], "Expected final IPv4s"
    assert_monotonic_steps(g_cold)

    # B) Google A warm x2 (cache)
    g_warm1 = fetch("/resolve", name="www.google.com", type="A", cache="on")
    g_warm2 = fetch("/resolve", name="www.google.com", type="A", cache="on")
    print_steps("google A (warm2)", g_warm2)
    assert g_warm2["trace"][0]["server"] == "cache", "Expected cache hit on 2nd warm call"
    assert g_warm2["summary"]["hops"] == 1, "Expected a single cache hop"

    # C) Google AAAA (IPv6)
    g_v6 = fetch("/resolve", name="www.google.com", type="AAAA", cache="off")
    print_steps("google AAAA (cold)", g_v6)
    assert g_v6["summary"]["final_ips"], "Expected final IPv6s"
    assert all(":" in ip for ip in g_v6["summary"]["final_ips"]), "Expected IPv6 addresses"

    # D) YouTube A (CNAME)
    yt = fetch("/resolve", name="www.youtube.com", type="A", cache="off")
    print_steps("youtube A (cold)", yt)
    assert yt["summary"]["final_ips"], "Expected A records for youtube-ui.l.google.com"
    # CNAME may be in answer OR in cname_chain depending on the reply shape
    has_cname = any(a["rdtype"] == "CNAME" for a in yt.get("answer", [])) or any(
        any(a["rdtype"] == "CNAME" for a in h.get("answer", [])) for h in yt.get("trace", [])
    )
    assert has_cname, "Expected a CNAME for www.youtube.com"

    # E) NXDOMAIN
    nx = fetch("/resolve", name="thisdoesnotexist-zz12345.com", type="A", cache="off")
    print_steps("NXDOMAIN", nx)
    assert nx["summary"]["final_ips"] in (None, []), "Expected no final IPs for NXDOMAIN"
    assert_monotonic_steps(nx)

    print("\n✅ All checks passed")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("❌ Check failed:", e)
        sys.exit(1)
