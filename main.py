"""
Crop Monitoring Pipeline - FastAPI Webhook Receiver
Triggered by Supabase Database Webhook on new raw_data INSERT
Runs all formulas and writes processed results back to Supabase
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import httpx
import os
import logging
from dotenv import load_dotenv
from calculations import process_raw_data

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Crop Monitoring Pipeline")

SUPABASE_URL    = os.getenv("SUPABASE_URL")
# Use SUPABASE_KEY if SUPABASE_SERVICE_KEY is not set
SUPABASE_KEY    = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
WEBHOOK_SECRET  = os.getenv("WEBHOOK_SECRET", "") # optional security header

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/webhook/raw-data")
async def handle_raw_data(request: Request):
    """
    Supabase fires this when a new row is inserted into raw_data table.
    Payload shape: { "type": "INSERT", "record": { ...row fields... } }
    """

    # Optional: verify webhook secret
    if WEBHOOK_SECRET:
        secret = request.headers.get("x-webhook-secret", "")
        if secret != WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")

    payload = await request.json()
    logger.info(f"Webhook received: {payload.get('type')} on table {payload.get('table')}")

    if payload.get("type") != "INSERT":
        return JSONResponse({"status": "ignored", "reason": "not an INSERT"})

    raw = payload.get("record", {})
    if not raw:
        raise HTTPException(status_code=400, detail="Empty record in payload")

    # ── Run all calculations ──────────────────────────────────────────────────
    try:
        processed = process_raw_data(raw)
        logger.info(f"Processed row id={raw.get('id')}: {processed}")
    except Exception as e:
        logger.error(f"Calculation error: {e}")
        raise HTTPException(status_code=500, detail=f"Calculation error: {e}")

    # ── Write results back to Supabase ────────────────────────────────────────
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/processed_data",
            headers=SUPABASE_HEADERS,
            json=processed
        )
        if resp.status_code not in (200, 201):
            logger.error(f"Supabase write failed: {resp.status_code} {resp.text}")
            raise HTTPException(status_code=502, detail=f"Supabase write failed: {resp.text}")

    logger.info(f"Successfully wrote processed data for raw_id={raw.get('id')}")
    return JSONResponse({"status": "success", "processed_id": processed.get("raw_data_id")})
