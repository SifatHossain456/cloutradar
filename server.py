import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"🐧 NicheScan starting on http://localhost:{port}")
    uvicorn.run("api.index:app", host="0.0.0.0", port=port, reload=True)
