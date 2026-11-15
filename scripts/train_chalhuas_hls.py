"""Train a scoped NASA-HLS low-vegetation model ONLY from reviewed Junín field data.

Inputs: monthly history JSON produced by app.services.hls_history.monthly_history
and a WGS84 GeoJSON polygon reviewed separately. No automatic deployment.
Examples:
 python scripts/train_chalhuas_hls.py --source data/history.json --polygon data/field.geojson \
 --field-reference CHALHUAS-001 --geometry-reviewed --output data/andes-model.json

The tool refuses to produce a model if data quality, class diversity, temporal
holdout, or baseline improvement are insufficient. Never predicts crop type/yield.
"""
from __future__ import annotations
import argparse
from datetime import date
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"backend"))
from app.services.field_shift_ai import THRESHOLD,fit_logistic,_probability
from app.ml.holdout_metrics import binary_holdout_metrics
from app.geospatial.parcel_validation import validate_parcel

def compute(raw:dict,polygon:dict,field_reference:str,source_sha256:str)->dict:
    if raw.get("sensor_id")!="hls" or not str(raw.get("sensor","")).startswith("NASA HLS"):
        raise ValueError("Solo datos NASA HLS reales de una parcela revisada.")
    try: _,area_m2=validate_parcel(polygon)
    except Exception as exc: raise ValueError("Contorno de parcela no válido") from exc
    if area_m2<1000 or area_m2>5_000_000:raise ValueError("Superficie fuera de intervalo")
    source_area=float(raw.get("parcel_area_ha_approx") or 0)
    area_ha=area_m2/10000
    if source_area<=0 or abs(source_area-area_ha)>max(.2,.08*area_ha):
        raise ValueError("El historial satelital no coincide en superficie con el polígono")
    months=raw.get("months")
    if not isinstance(months,list) or len(months)<40:raise ValueError("Serie satelital demasiado corta")
    seen=set()
    valid=[]
    for row in months:
        key=row.get("month","")
        if (not isinstance(key,str) or len(key)!=7 or key in seen
                or not key[:4].isdigit() or not key[5:7].isdigit()):
            raise ValueError("Meses duplicados o mal formados")
        seen.add(key)
        ndvi=row.get("ndvi")
        if ndvi is None:continue
        if not isinstance(ndvi,(float,int)) or isinstance(ndvi,bool) or not math.isfinite(ndvi) or not -1<=ndvi<=1:
            raise ValueError("NDVI fuera de rango físico")
        # The recorded monthly value must point to the actual NASA HLS scene
        # used; do not train from a list of made-up monthly scalar values.
        scene=row.get("best_scene") or {}
        if not scene.get("date") or not (scene.get("source_url") or scene.get("url") or scene.get("scene_id")):
            raise ValueError("Cada mes válido debe conservar la procedencia de la escena HLS")
        valid.append({"month":key,"ndvi":ndvi})
    if valid!=sorted(valid,key=lambda r:r["month"]):raise ValueError("Meses desordenados")
    if len(valid)<40:raise ValueError("Menos de 40 meses HLS útiles: entrenamiento pospuesto")
    cut=int(len(valid)*.75)
    train,test=valid[:cut],valid[cut:]
    if len(train)<30 or len(test)<10:raise ValueError("Split temporal insuficiente")
    labels=[int(v["ndvi"]<THRESHOLD) for v in train]
    if len(set(labels))<2:raise ValueError("La serie de entrenamiento no incluye ambas clases")
    baseline=sum(labels)/len(labels)
    coeff=fit_logistic(train)
    brier_model=sum((_probability(r["month"],coeff)-int(r["ndvi"]<THRESHOLD))**2 for r in test)/len(test)
    brier_baseline=sum((baseline-int(r["ndvi"]<THRESHOLD))**2 for r in test)/len(test)
    metrics=binary_holdout_metrics([int(r["ndvi"]<THRESHOLD) for r in test],
        [_probability(r["month"],coeff) for r in test],baseline_probability=baseline)
    if abs(metrics['brier_model']-brier_model)>1e-9:
        raise ValueError("Holdout de clasificación inconsistente")
    if brier_model>=brier_baseline-.01:
        raise ValueError("El modelo no mejora suficientemente el baseline temporal (Brier)")
    final=fit_logistic(valid)
    return {"status":"holdout_validated_pending_agronomic_review",
            "field_reference":field_reference,
            "field_area_ha_approx":round(area_ha,2),
            "source_sha256":source_sha256,
            "model":"L2-regularized seasonal logistic regression, NASA HLS polygon NDVI",
            "target":"observed_NDVI_below_0.20_low_vegetation_proxy_not_crop_identity",
            "training":{"months_total":len(months),"months_valid":len(valid),
                        "train_count":len(train),"test_count":len(test),
                        "holdout_first":test[0]["month"],"holdout_last":test[-1]["month"]},
            "evaluation":{"brier_model":round(brier_model,7),"brier_train_prevalence_baseline":round(brier_baseline,7),
                          "classification":metrics},
            "fitted_coefficients":[round(v,10) for v in final],
            "not_validated_for_irrigation_or_yield":True,
            "public_inference_enabled":False}

def main()->int:
    p=argparse.ArgumentParser()
    p.add_argument("--source",type=Path,required=True)
    p.add_argument("--polygon",type=Path,required=True)
    p.add_argument("--field-reference",required=True)
    p.add_argument("--geometry-reviewed",action="store_true",help="Confirm a person reviewed polygon provenance and field identity")
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    if not args.geometry_reviewed:
        p.error("Se requiere --geometry-reviewed para no entrenar sobre parcelas sintéticas.")
    raw_bytes=args.source.read_bytes()
    raw=json.loads(raw_bytes)
    polygon=json.loads(args.polygon.read_text(encoding="utf-8"))
    if polygon.get("type")=="Feature":polygon=polygon["geometry"]
    report=compute(raw,polygon,args.field_reference,hashlib.sha256(raw_bytes).hexdigest())
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":report["status"],"evaluation":report["evaluation"],"output":str(args.output)},ensure_ascii=False))
    return 0

if __name__=="__main__":raise SystemExit(main())
