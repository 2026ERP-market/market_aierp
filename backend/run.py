import os
import sys
import uvicorn

if __name__ == "__main__":
    # 프로젝트 루트 및 backend 디렉터리 경로 등록
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    print("[INFO] Starting Mart AI ERP FastAPI Server on http://localhost:8000 ...")
    print("[INFO] Swagger Docs available at http://localhost:8000/docs")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
