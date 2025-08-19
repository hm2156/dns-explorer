import random, time
from typing import Dict, List, Optional
import dns.message, dns.name, dns.query, dns.rdatatype, dns.flags, dns.rcode, dns.resolver
from .cache import TTLStore

ROOTS = ["198.41.0.4","199.9.14.201","192.33.4.12","199.7.91.13","192.203.230.10",
         "192.5.5.241","192.112.36.4","198.97.190.53","192.36.148.17","192.58.128.30",
         "193.0.14.129","199.7.83.42","202.12.27.33"]
TYPES = {"A": dns.rdatatype.A, "AAAA": dns.rdatatype.AAAA, "CNAME": dns.rdatatype.CNAME}

def _rrset(rrset):  # serialize for JSON
    return {
        "name": rrset.name.to_text(),
        "rdtype": dns.rdatatype.to_text(rrset.rdtype),
        "ttl": rrset.ttl,
        "records": [{"value": r.to_text()} for r in rrset]
    }

def _glue_ips(additional) -> Dict[str, List[str]]:
    m = {}
    for rr in additional:
        if rr.rdtype in (dns.rdatatype.A, dns.rdatatype.AAAA):
            host = rr.name.to_text().rstrip(".")
            ips = [getattr(r, "address", r.to_text()) for r in rr]
            m.setdefault(host, []).extend(ips)
    return m

class DNSResolver:
    def __init__(self, cache: Optional[TTLStore]=None, timeout: float=2.0):
        self.cache, self.timeout = cache, timeout

    def resolve(self, qname: str, qtype: str, use_cache: bool) -> Dict:
        if qtype not in TYPES: raise ValueError("Only A, AAAA, CNAME supported in MVP")
        name = dns.name.from_text(qname)
        if not name.is_absolute(): name = name.concatenate(dns.name.root)
        key = (str(name), qtype)

        # serve from cache if allowed and present
        if use_cache and self.cache:
            c = self.cache.get(key)
            if c:
                return {
                    "query":{"name":str(name),"type":qtype,"cache":"on"},
                    "summary":{"final_ips":c["final_ips"],"total_ms":0,"hops":1,"cache_saved_ms":c["ms"]},
                    "trace":[{"step":1,"server":"cache","role":"cache","question":{"name":str(name),"type":qtype},
                              "answer":c["answer"],"additional":[],"rtt_ms":0,"cached":True}],
                    "cname_chain": c["cname_chain"]
                }

        trace, cname_chain = [], []
        hop_id = 0   
        start_total = time.perf_counter()
        current = name
        ns_ips = [random.choice(ROOTS)]
        rdtype = TYPES[qtype]
        final_rrsets = []
        steps = 0

        while steps < 25:
            steps += 1 
            server = ns_ips[0]

            # build a NON-RECURSIVE query (iterative)
            msg = dns.message.make_query(current, rdtype, use_edns=True)
            msg.flags &= ~dns.flags.RD  # clear Recursion Desired

            # send UDP DNS query to that server
            t0 = time.perf_counter()
            try:
                resp = dns.query.udp(msg, server, timeout=self.timeout)
            except Exception as e:
                if len(ns_ips) > 1:
                    ns_ips = ns_ips[1:]       # try another IP from referral
                    continue

                hop_id += 1 
                # record the error and reset to a new root server
                trace.append({"step":hop_id,"server":server,"role":"ns",
                              "question":{"name":str(current),"type":qtype},
                              "answer":[],"additional":[],"rtt_ms":None,"cached":False,"error":str(e)})
                ns_ips = [random.choice(ROOTS)]
                continue

            
            rtt = round((time.perf_counter()-t0)*1000,2)
            hop_id += 1 
            hop = {
                "step": hop_id,
                "server": server,
                "role": "ns",
                "question": {"name": str(current), "type": qtype},
                "answer": [ _rrset(a) for a in resp.answer ],
                "additional": [ _rrset(a) for a in resp.additional ],
                "authority": [
                    {
                        "name": auth.name.to_text(),
                        "rdtype": dns.rdatatype.to_text(auth.rdtype),
                        "ttl": auth.ttl,
                        "records": [{ "value": r.to_text() } for r in auth]
                    } for auth in resp.authority
                ],
                "rtt_ms": rtt,
                "cached": False
            }
            trace.append(hop)


            if resp.rcode() == dns.rcode.NXDOMAIN:
                break

            # If we got an answer section:
            if resp.answer:
                # terminal? (contains requested rdtype)
                if any(a.rdtype == rdtype for a in resp.answer):
                    final_rrsets = hop["answer"]
                    break
                # otherwise follow CNAME: change the current name, restart from root
                for a in resp.answer:
                    if a.rdtype == dns.rdatatype.CNAME:
                        target = a[0].target
                        cname_chain.append(target.to_text().rstrip("."))
                        current = target
                        ns_ips = [random.choice(ROOTS)]
                        break
                else:
                    # no terminal A/AAAA and no CNAME → fall through to referral handling
                    pass

            # Referral: find next nameserver IPs from authority NS + additional glue
            glue = _glue_ips(resp.additional)
            next_ips = []
            for auth in resp.authority:
                if auth.rdtype == dns.rdatatype.NS:
                    for rr in auth:
                        host = rr.target.to_text().rstrip(".")
                        if host in glue:
                            next_ips += glue[host]  # use glue A/AAAA
                        else:
                            # fallback: resolve the NS host via system resolver (recursive)
                            try:
                                for r in dns.resolver.resolve(host, "A"):
                                    next_ips.append(r.address)
                            except Exception:
                                pass
                            try:
                                for r in dns.resolver.resolve(host, "AAAA"):
                                    next_ips.append(r.address)
                            except Exception:
                                pass
            # de-dupe while preserving order
            next_ips = list(dict.fromkeys(next_ips))
            if not next_ips:
                break
            ns_ips = next_ips

        total_ms = round((time.perf_counter()-start_total)*1000,2)

        # Extract final IPs (best-effort parse of "A"/"AAAA" answers)
        final_ips = []
        for rr in final_rrsets:
            if rr["rdtype"] in ("A","AAAA"):
                for r in rr["records"]:
                    final_ips.append(r["value"].split(" ")[0])

        # Store in cache using MIN TTL of the rrsets
        if final_rrsets and use_cache and self.cache:
            min_ttl = min((rr["ttl"] for rr in final_rrsets), default=0)
            self.cache.set(
                key,
                {"answer": final_rrsets, "final_ips": final_ips, "cname_chain": cname_chain, "ms": total_ms},
                min_ttl
            )

        return {
            "query":{"name":str(name),"type":qtype,"cache":"on" if use_cache else "off"},
            "summary":{"final_ips": final_ips or None, "total_ms": total_ms, "hops": len(trace), "cache_saved_ms": 0},
            "trace": trace,
            "cname_chain": cname_chain
        }
