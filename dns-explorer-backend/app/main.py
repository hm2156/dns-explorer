from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .resolver import DNSResolver
from .cache import TTLStore

load_dotenv() 

app = FastAPI(title="DNS Explorer API")

allowed = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
allow_origins = [o.strip() for o in allowed.split(",") if o.strip()]

# allow your React dev server during dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cache = TTLStore(maxsize=1000)
resolver = DNSResolver(cache=cache, timeout=3.0)

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.get("/resolve")
def resolve(
    name: str = Query(...),
    type: str = Query("A"),
    cache: str = Query("on")
):
    use_cache = (cache == "on")
    return resolver.resolve(name, type, use_cache)
