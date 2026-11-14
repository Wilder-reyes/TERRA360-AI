"""Hackathon pilot: pretrained forecasts, with no model downloads at startup."""
import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from app.connectors.nasa_power import NasaPowerError
from app.ml.chronos_rain import ChronosPredictor, InsufficientRainHistory, ModelUnavailable, MODEL_ID, MODEL_REVISION
from app.schemas.rain_forecast import ForecastRequest
from app.services.rain_forecast import cached_experiment, cached_report, compute_report, fetch_rain_history, save_report

router = APIRouter(prefix="/api/agro", tags=["Experimental pretrained rainfall"])
logger = logging.getLogger(__name__)
_inference_lock = threading.Lock()
_predictor = None
PILOT_PATH = Path(__file__).resolve().parents[1] / "data" / "agro_pilot.json"


def inference_enabled() -> bool:
    return os.getenv("CHRONOS_INFERENCE_ENABLED", "false").lower() in ("true", "1", "yes")


def _predict(contexts, prediction_length):
    global _predictor
    if _predictor is None:
        # Public requests never fetch model weights. Prepare them with the CLI.
        _predictor = ChronosPredictor(local_files_only=True)
    return _predictor(contexts, prediction_length)


@router.get("/pilot")
def pilot():
    return {**json.loads(PILOT_PATH.read_text(encoding="utf-8")),
            "model": {"id": MODEL_ID, "revision": MODEL_REVISION, "fine_tuned": False},
            "live_inference_enabled": inference_enabled()}


def unavailable(status: str):
    messages = {
        "not_prepared": ("Todavía no hay una estimación preparada para esta ubicación. Puedes consultar el piloto de Calca.",
                         "No estimate has been prepared for this location yet. You can explore the Calca pilot."),
        "stale_report": ("La estimación guardada ha vencido. Debe actualizarse antes de volver a consultarla.",
                         "The saved estimate has expired. It must be updated before it can be shown again."),
        "invalid_report": ("No se pudo verificar la estimación guardada. Vuelve a prepararla antes de consultarla.",
                           "The saved estimate could not be verified. Prepare it again before using it."),
        "insufficient_history": ("Faltan meses completos y recientes de lluvia para elaborar esta estimación.",
                                 "There are not enough complete, recent rainfall months to prepare this estimate."),
        "model_unavailable": ("La estimación no está disponible en este momento. Puedes consultar las observaciones históricas.",
                              "The estimate is unavailable right now. You can explore historical observations."),
        "source_unavailable": ("No pudimos recuperar el histórico de NASA. Inténtalo nuevamente en un momento.",
                               "Could not retrieve the NASA history. Please try again shortly."),
    }
    es, en = messages[status]
    return {"status": status, "report": None, "message": es, "message_en": en}


@router.post("/rain-forecast")
async def rain_forecast(location: ForecastRequest):
    today = datetime.now(timezone.utc).date()
    status, report = cached_report(location, today)
    if report is not None:
        return {"status": "available", "report": report.model_dump(mode="json"), "delivery": "prepared_report",
                "experiment": cached_experiment(location, today, report.source.last_month)}
    if not inference_enabled():
        return unavailable(status)
    if not _inference_lock.acquire(blocking=False):
        raise HTTPException(429, "A forecast is already being prepared. Try again shortly.")
    try:
        records, retrieved_at = await fetch_rain_history(location, today)
        report = await run_in_threadpool(compute_report, records, location, today, retrieved_at, _predict)
        await run_in_threadpool(save_report, report)
        return {"status": "available", "report": report.model_dump(mode="json"), "delivery": "local_inference",
                "experiment": cached_experiment(location, today, report.source.last_month)}
    except InsufficientRainHistory:
        return unavailable("insufficient_history")
    except ModelUnavailable:
        return unavailable("model_unavailable")
    except NasaPowerError:
        return unavailable("source_unavailable")
    except (ValueError, OSError, RuntimeError):
        logger.exception("Experimental rainfall computation failed")
        return unavailable("model_unavailable")
    finally:
        _inference_lock.release()
