import time

class TTLStore:
    def __init__(self, maxsize=1000):
        self.s = {}
        self.maxsize = maxsize

    def get(self, k):
        v = self.s.get(k)
        if not v:
            return None
        exp, data = v
        if time.time() >= exp:
            self.s.pop(k, None)
            return None
        return data

    def set(self, k, data, ttl):
        if ttl <= 0:
            return
        if len(self.s) >= self.maxsize:
            self.s.pop(next(iter(self.s)))  
        self.s[k] = (time.time() + ttl, data)
